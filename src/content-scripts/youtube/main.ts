// Updated src/content-scripts/youtube/main.ts

import { addStyles } from "./ui";
import {
  setupPanelEventListeners,
  setupURLChangeDetection,
  setupMessageListener,
  setupButtonEventListeners,
} from "./domHandler";
import { observeYouTubeDOM } from "./domObserver";
import {
  loadAndDisplaySummary,
  loadAndDisplayTranscript,
  resetContentData,
} from "./contentHandler";
import { debugAuthStorage } from "./utils";

const UI_ELEMENTS = {
  SECONDARY_COLUMN: "secondary",
  CONTAINER_ID: "knugget-container",
  CONTAINER_CLASS: "knugget-extension knugget-summary-widget",
};

// Track the current video ID to detect changes
let currentVideoId: string | null = null;

// Handle URL changes
function handleURLChange(): void {
  // Check if we're on a watch page
  if (!window.location.pathname.includes("/watch")) {
    return;
  }

  // Get the new video ID
  const newVideoId = new URLSearchParams(window.location.search).get("v");
  console.log(`URL change detected, new video ID: ${newVideoId}`);

  // If the video ID has changed, reinitialize the extension
  if (newVideoId && newVideoId !== currentVideoId) {
    console.log(
      `Knugget AI: Video changed from ${currentVideoId} to ${newVideoId}`
    );
    processCurrentPage(newVideoId);
  }
}

// Process the current page
function processCurrentPage(videoId: string | null): void {
  console.log(`Knugget AI: Processing page for video ID ${videoId}`);

  // Update current video ID
  currentVideoId = videoId;

  // Reset data for new video
  resetContentData();

  // Notify background script
  chrome.runtime.sendMessage({
    type: "PAGE_LOADED",
    payload: { url: window.location.href, videoId },
  });

  // Remove any existing panel
  const existingPanel = document.getElementById(UI_ELEMENTS.CONTAINER_ID);
  if (existingPanel) {
    existingPanel.remove();
  }

  // Start observing the DOM for the secondary column to appear
  observeYouTubeDOM();
}

/**
 * Set up additional message listener for auth refresh events
 * This allows the extension to update its state when the user logs in on the website
 */
function setupAuthRefreshListener() {
  console.log("Setting up auth refresh listener");

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "REFRESH_AUTH_STATE") {
      console.log("Received auth refresh message:", message);

      // Force auth state refresh
      if (message.payload?.forceCheck) {
        chrome.runtime.sendMessage(
          { type: "FORCE_CHECK_WEBSITE_LOGIN" },
          () => {
            console.log(
              "Forced website login check after external auth refresh"
            );

            // Check if we're now authenticated
            chrome.storage.local.get(["knuggetUserInfo"], (result) => {
              const isLoggedIn = !!(
                result.knuggetUserInfo && result.knuggetUserInfo.token
              );
              console.log(
                "Auth state after refresh:",
                isLoggedIn ? "Logged in" : "Not logged in"
              );

              // Force reload of the current page to update UI
              if (isLoggedIn) {
                const videoId = new URLSearchParams(window.location.search).get(
                  "v"
                );
                if (videoId) {
                  console.log("Reprocessing page for video ID:", videoId);
                  processCurrentPage(videoId);
                }
              }
            });
          }
        );
      }

      // Always respond to avoid hung message channels
      sendResponse({ received: true });
    }

    // Continue message processing for other listeners
    return true;
  });
}

// Call this function during initialization
function initKnuggetAI(): void {
  console.log("Knugget AI: Initializing extension");

  // Check if we're on a YouTube watch page
  if (!window.location.pathname.includes("/watch")) {
    return;
  }

  // Get current video ID
  const videoId = new URLSearchParams(window.location.search).get("v");

  // Log the initialization
  console.log(`Initializing Knugget AI for video ID: ${videoId}`);

  // Force check with background script for authentication first
  chrome.runtime.sendMessage(
    { type: "FORCE_CHECK_WEBSITE_LOGIN" },
    (response) => {
      console.log(
        "Sent authentication check to background script, response:",
        response
      );

      // Send a message to request a refresh of all YouTube tabs
      // This ensures that if the user logged in on the website, all tabs get updated
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: "AUTH_STATE_CHANGED",
          payload: { checkAllTabs: true },
        });
      }, 1000);
    }
  );

  // Set up URL change detection only once
  setupURLChangeDetection(handleURLChange);

  // Set up message listener for background script
  setupMessageListener();

  // Set up auth refresh listener
  setupAuthRefreshListener();

  // Process the current page
  processCurrentPage(videoId);
}

// Add panel event listeners after panel is injected
export function initPanelAfterInjection(): void {
  // Set up event listeners
  setupPanelEventListeners();

  // Add event listeners to buttons
  setupButtonEventListeners();

  // Load transcript by default
  loadAndDisplayTranscript();
}

// Initialize the extension when the page loads
document.addEventListener("DOMContentLoaded", () => {
  addStyles();
  initKnuggetAI();
});

// Also initialize when the page is already loaded (for SPA navigation)
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  addStyles();
  initKnuggetAI();
}

// Setup a more robust YouTube navigation listener
document.addEventListener("yt-navigate-finish", () => {
  console.log("YouTube navigation detected via yt-navigate-finish event");
  setTimeout(() => {
    const videoId = new URLSearchParams(window.location.search).get("v");
    if (videoId && videoId !== currentVideoId) {
      console.log(`Navigation to new video detected: ${videoId}`);
      processCurrentPage(videoId);
    }
  }, 500);
});

// Debug auth storage for troubleshooting
debugAuthStorage();

// Export for other modules
export { currentVideoId };
