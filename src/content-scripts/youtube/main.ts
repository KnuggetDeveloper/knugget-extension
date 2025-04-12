import { addStyles } from "./ui";
import {
  setupPanelEventListeners,
  setupURLChangeDetection,
  setupMessageListener,
} from "./domHandler";
import { observeYouTubeDOM } from "./domObserver";
import { loadAndDisplayTranscript, resetContentData } from "./contentHandler";
import { debugAuthStorage } from "./utils";

const UI_ELEMENTS = {
  SECONDARY_COLUMN: "secondary",
  CONTAINER_ID: "knugget-container",
  CONTAINER_CLASS: "knugget-extension knugget-summary-widget",
  DIAMOND_ICON_COLOR: "#00b894",
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
    payload: { url: window.location.href },
  });

  // Remove any existing panel
  const existingPanel = document.getElementById(UI_ELEMENTS.CONTAINER_ID);
  if (existingPanel) {
    existingPanel.remove();
  }

  // Start observing the DOM for the secondary column to appear
  observeYouTubeDOM();
}

// Main function to initialize the extension
function initKnuggetAI(): void {
  console.log("Knugget AI: Initializing extension");

  // Check if we're on a YouTube watch page
  if (!window.location.pathname.includes("/watch")) {
    return;
  }

  // Get current video ID
  const videoId = new URLSearchParams(window.location.search).get("v");

  // Set up URL change detection only once
  setupURLChangeDetection(handleURLChange);

  // Set up message listener for background script
  setupMessageListener();

  // Process the current page
  processCurrentPage(videoId);
}

// Add panel event listeners after panel is injected
export function initPanelAfterInjection(): void {
  // Set up event listeners
  setupPanelEventListeners();

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

// Debug auth storage for troubleshooting
debugAuthStorage();

// Export for other modules
export { currentVideoId };
