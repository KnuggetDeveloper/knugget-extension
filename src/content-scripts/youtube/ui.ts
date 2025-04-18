// src/content-scripts/youtube/ui.ts
// Updated implementation for Knugget panel

import { Summary, UI_ELEMENTS } from "./types";
import { saveSummary } from "./api";
import {
  loadAndDisplayTranscript,
  loadAndDisplaySummary,
  getTranscriptData,
} from "./contentHandler";

// Function to show loading state in panel
export function showLoading(contentElement: HTMLElement, message = "Loading") {
  contentElement.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center;">
      <div class="knugget-spinner" style="margin-bottom: 20px;"></div>
      <p style="font-family: 'Inter', sans-serif; font-weight: 600; color: #ffffff; font-size: 16px; margin-bottom: 8px;">${message}</p>
      <p style="font-family: 'Inter', sans-serif; font-weight: 400; color: #aaaaaa; font-size: 14px;">Please wait...</p>
    </div>
  `;
}

// Function to show error state in container
export function showError(
  contentElement: HTMLElement,
  errorMessage: string,
  retryFunction: () => void
) {
  contentElement.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center;">
      <div style="margin-bottom: 20px; color: #ff5757;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p style="font-family: 'Inter', sans-serif; font-weight: 600; color: #ffffff; font-size: 16px; margin-bottom: 8px;">Error</p>
      <p style="font-family: 'Inter', sans-serif; font-weight: 400; color: #aaaaaa; font-size: 14px; margin-bottom: 20px;">${errorMessage}</p>
      ${
        typeof retryFunction === "function"
          ? `
        <button id="retry-btn" style="background: linear-gradient(90deg, rgba(255,177,0,1) 0%, rgba(255,70,6,1) 100%); color: #ffffff; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; padding: 8px 16px; border: none; border-radius: 20px; cursor: pointer;">
          Try Again
        </button>
      `
          : ""
      }
    </div>
  `;

  // Add retry button event listener if function provided
  if (retryFunction) {
    const retryButton = document.getElementById("retry-btn");
    if (retryButton) {
      retryButton.addEventListener("click", retryFunction);
    }
  }
}

// Function to show login required state for summary tab
export function showLoginRequired(summaryContentElement: HTMLElement) {
  summaryContentElement.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center;">
      <div style="margin-bottom: 20px; color: #00a8ff;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <p style="font-family: 'Inter', sans-serif; font-weight: 600; color: #ffffff; font-size: 16px; margin-bottom: 8px;">Login Required</p>
      <p style="font-family: 'Inter', sans-serif; font-weight: 400; color: #aaaaaa; font-size: 14px; margin-bottom: 20px;">
        Please log in to generate and view summaries. If you've already logged in on the website, 
        clicking the button below will sync your account with the extension.
      </p>
      <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 220px;">
        <button id="knugget-login-btn" style="background: linear-gradient(90deg, rgba(255,177,0,1) 0%, rgba(255,70,6,1) 100%); color: #ffffff; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; padding: 8px 16px; border: none; border-radius: 20px; cursor: pointer; width: 100%;">
          Log In
        </button>
        <button id="knugget-signup-btn" style="background: #333333; color: #ffffff; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; padding: 8px 16px; border: none; border-radius: 20px; cursor: pointer; width: 100%;">
          Sign Up
        </button>
        <button id="knugget-sync-btn" style="background: #2a2a2a; color: #ffffff; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; padding: 8px 16px; border: 1px solid #555; border-radius: 20px; cursor: pointer; width: 100%;">
          Sync with Website
        </button>
      </div>
    </div>
  `;

  // Add event listeners to login and signup buttons
  const loginBtn = document.getElementById("knugget-login-btn");
  const signupBtn = document.getElementById("knugget-signup-btn");
  const syncBtn = document.getElementById(
    "knugget-sync-btn"
  ) as HTMLButtonElement;

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_LOGIN_PAGE" });
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({
        type: "OPEN_SIGNUP_PAGE",
        payload: { url: window.location.href },
      });
    });
  }

  if (syncBtn) {
    syncBtn.addEventListener("click", () => {
      // Show syncing state
      syncBtn.textContent = "Syncing...";
      syncBtn.disabled = true;

      // Force background to check cookies and reload after a delay
      chrome.runtime.sendMessage({ type: "FORCE_CHECK_WEBSITE_LOGIN" }, () => {
        setTimeout(() => {
          // Reload summary panel after sync attempt
          loadAndDisplaySummary();
        }, 2000);
      });
    });
  }
}

// Function to display summary with enhanced formatting
export function displaySummary(
  summaryContentElement: HTMLElement,
  summary: Summary
) {
  // First, check and normalize the summary data
  const normalizedSummary = {
    title: summary.title || "Video Summary",
    keyPoints: Array.isArray(summary.keyPoints) ? summary.keyPoints : [],
    fullSummary: summary.fullSummary || "No summary content available.",
  };

  // Format the summary content - convert markdown to HTML
  let formattedSummary = normalizedSummary.fullSummary;

  // Convert markdown bold to HTML
  formattedSummary = formattedSummary.replace(
    /\*\*(.*?)\*\*/g,
    "<strong>$1</strong>"
  );

  // Create HTML for key points
  const keyPointsHTML = summary.keyPoints
    .map((point) => {
      // Extract emoji and text
      const match = point.match(
        /^([\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}])\s+(.*)/u
      );
      if (match) {
        const emoji = match[1];
        const text = match[2];

        return `
        <div class="key-point-item">
          <div class="key-point-emoji">${emoji}</div>
          <div class="key-point-text">${text}</div>
        </div>
      `;
      }
      return `
    <div class="key-point-item">
      <div class="key-point-emoji"></div>
      <div class="key-point-text">${point}</div>
    </div>
  `;
    })
    .join("");

  // Update content with improved styling
  summaryContentElement.innerHTML = `
    <h2 class="knugget-title">${summary.title}</h2>
    <div class="knugget-summary-content">
      ${formattedSummary}
    </div>
    <div class="key-points-container">
      ${keyPointsHTML}
    </div>
  `;

  // Get the save button
  const saveButton = document.getElementById("save-btn") as HTMLButtonElement;

  if (saveButton) {
    // Make sure save button is visible when in summary tab
    saveButton.style.display = "block";

    // Set button text and state based on whether summary is already saved
    if (summary.alreadySaved) {
      saveButton.textContent = "Saved";
      saveButton.disabled = true;
      saveButton.classList.add("already-saved");
    } else {
      saveButton.textContent = "Save";
      saveButton.disabled = false;
      saveButton.classList.remove("already-saved");

      // Add event listener to save button if not already saved
      // Remove existing listeners first to prevent duplicates
      const newSaveButton = saveButton.cloneNode(true) as HTMLButtonElement;
      saveButton.parentNode?.replaceChild(newSaveButton, saveButton);

      newSaveButton.addEventListener("click", async () => {
        try {
          newSaveButton.disabled = true;
          newSaveButton.textContent = "Saving...";

          // Get video metadata
          const videoId =
            new URLSearchParams(window.location.search).get("v") || "";
          const videoUrl = window.location.href;

          // Get the transcript data to save along with the summary
          const transcriptData = getTranscriptData();
          const transcriptText = transcriptData
            ? transcriptData.map((s) => s.text).join(" ")
            : "";

          // Prepare summary for saving
          const summaryToSave = {
            ...summary,
            videoId,
            sourceUrl: videoUrl,
            source: "youtube",
            transcript: transcriptText, // Include transcript
          };

          console.log("Saving summary:", {
            videoId,
            title: summaryToSave.title,
            transcriptLength: transcriptText.length,
          });

          // Call API to save summary
          const response = await saveSummary(summaryToSave);

          if (response && response.success) {
            newSaveButton.textContent = "Saved";
            newSaveButton.classList.add("already-saved");
            newSaveButton.disabled = true;
            console.log("Summary saved successfully!");
          } else {
            console.error("Error saving summary:", response?.error);
            newSaveButton.textContent = "Error";
            setTimeout(() => {
              newSaveButton.textContent = "Save";
              newSaveButton.disabled = false;
            }, 2000);
          }
        } catch (error) {
          console.error("Exception when saving summary:", error);
          newSaveButton.textContent = "Error";
          setTimeout(() => {
            newSaveButton.textContent = "Save";
            newSaveButton.disabled = false;
          }, 2000);
        }
      });
    }
  }
}

function setupTabEventListeners() {
  const transcriptTab = document.getElementById("transcript-tab");
  const summaryTab = document.getElementById("summary-tab");
  const transcriptContent = document.getElementById("transcript-content");
  const summaryContent = document.getElementById("summary-content");
  const saveButton = document.getElementById("save-btn");

  if (transcriptTab && summaryTab && transcriptContent && summaryContent) {
    // Initially hide the save button when viewing transcript
    if (saveButton) {
      saveButton.style.display = "none";
    }

    // Transcript tab click
    transcriptTab.addEventListener("click", () => {
      // Update tab styles
      transcriptTab.classList.remove("knugget-tab-inactive");
      transcriptTab.classList.add("knugget-tab-active");
      summaryTab.classList.remove("knugget-tab-active");
      summaryTab.classList.add("knugget-tab-inactive");

      // Show transcript, hide summary
      transcriptContent.style.display = "block";
      summaryContent.style.display = "none";

      // Hide save button when viewing transcript
      if (saveButton) {
        saveButton.style.display = "none";
      }

      // Load transcript content if needed
      loadAndDisplayTranscript();
    });

    // Summary tab click
    summaryTab.addEventListener("click", () => {
      // Update tab styles
      summaryTab.classList.remove("knugget-tab-inactive");
      summaryTab.classList.add("knugget-tab-active");
      transcriptTab.classList.remove("knugget-tab-active");
      transcriptTab.classList.add("knugget-tab-inactive");

      // Show summary, hide transcript
      summaryContent.style.display = "block";
      transcriptContent.style.display = "none";

      // Show save button when viewing summary
      if (saveButton) {
        saveButton.style.display = "block";
      }

      // Load summary content if needed
      loadAndDisplaySummary();
    });
  }
}

// Updated injectKnuggetPanel function to initially hide the save button
export function injectKnuggetPanel(targetElement: HTMLElement) {
  console.log("Knugget AI: Injecting panel with professional styling");

  // Create our container
  const knuggetContainer = document.createElement("div");
  knuggetContainer.id = "knugget-container";
  knuggetContainer.className = "knugget-extension";

  // Create the UI based on the design in the reference images
  knuggetContainer.innerHTML = `
  <div class="knugget-box">
    <!-- Header with logo and credits -->
    <div class="knugget-header">
      <!-- Logo -->
      <div style="display: flex; align-items: center;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
          <path d="M12 2L22 12L12 22L2 12L12 2Z" fill="#00a8ff"/>
        </svg>
        <span class="knugget-logo">Knugget</span>
      </div>
      
      <!-- Credits Badge -->
      <div class="knugget-credits">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 6px;">
          <path d="M20 6H4V18H20V6Z" fill="#00a8ff"/>
        </svg>
        3 Free Credits Left
      </div>
    </div>
    
    <!-- Separator Line -->
    <div class="knugget-separator"></div>
    
    <!-- Tab Navigation -->
    <div class="knugget-tabs">
      <button id="transcript-tab" class="knugget-tab knugget-tab-active">
        View Transcript
      </button>
      <button id="summary-tab" class="knugget-tab knugget-tab-inactive">
        View Key Takeaways
      </button>
    </div>
    
    <!-- Content Area -->
    <div class="knugget-content">
      <!-- Transcript content (initially visible) -->
      <div id="transcript-content" class="knugget-content-inner">
        <!-- Transcript will be loaded here -->
      </div>
      
      <!-- Summary content (initially hidden) -->
      <div id="summary-content" class="knugget-content-inner" style="display: none;">
        <!-- Summary will be loaded here -->
      </div>
    </div>
    
    <!-- Action buttons -->
    <div class="knugget-actions">
      <button id="save-btn" class="knugget-save-btn">Save</button>
      <button id="dashboard-btn" class="knugget-dashboard-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
        Dashboard
      </button>
    </div>
  </div>
`;

  // Add the container to the target element
  targetElement.prepend(knuggetContainer);

  // Setup event listeners for tabs
  setupTabEventListeners();

  // Load initial content
  loadAndDisplayTranscript();
}
// Import these functions from your contentHandler.js

// Add styles to the page
export function addStyles() {
  const style = document.createElement("style");
  style.textContent = `
    /* Knugget AI Extension Styling */
/* Enhanced professional styling for Knugget extension */

/* Base styles */
.knugget-extension {
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  margin-bottom: 16px;
  width: 100%;
  max-width: 465px;
}

.knugget-box {
  background-color: #0f0f0f;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  height: 519px;
  position: relative;
}

/* Header section */
.knugget-header {
  padding: 12px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.knugget-logo {
  font-family: "AirbnbCerealApp-Black", Helvetica, Arial, sans-serif;
  font-weight: 900;
  background: linear-gradient(90deg, rgba(255,177,0,1) 0%, rgba(255,70,6,1) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-fill-color: transparent;
  font-size: 18px;
  letter-spacing: 1px;
}

.knugget-credits {
  font-family: "AirbnbCerealApp-Medium", Helvetica, Arial, sans-serif;
  font-weight: 500;
  color: #ffffff;
  font-size: 13px;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
}

/* Separator line */
.knugget-separator {
  height: 1px;
  background-color: #333;
  margin: 0 12px;
}

/* Tab navigation */
.knugget-tabs {
  display: flex;
  gap: 8px;
  padding: 12px;
}

.knugget-tab {
  flex: 1;
  height: 42px;
  border-radius: 21px;
  font-family: "AirbnbCerealApp-Bold", Helvetica, Arial, sans-serif;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.5px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.knugget-tab-inactive {
  background-color: #222222;
  color: #cccccc;
}

.knugget-tab-active {
  background: linear-gradient(90deg, rgba(255,177,0,1) 0%, rgba(255,70,6,1) 100%);
  color: #ffffff;
  text-shadow: 0 1px 1px rgba(0,0,0,0.2);
}

/* Content area */
.knugget-content {
  margin: 10px 12px;
  background-color: #121212;
  border-radius: 10px;
  height: 388px;
  overflow: hidden;
}

.knugget-content-inner {
  padding: 14px;
  height: 100%;
  overflow-y: auto;
}

.knugget-title {
  font-family: "AirbnbCerealApp-Bold", Helvetica, Arial, sans-serif;
  font-weight: 700;
  color: #ffffff;
  font-size: 18px;
  margin-bottom: 16px;
  letter-spacing: 0.5px;
}

/* List items - Summary */
.knugget-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.knugget-list-item {
  display: flex;
  align-items: flex-start;
  padding: 10px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.knugget-list-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.knugget-bullet {
  width: 7px;
  height: 7px;
  background-color: #dfdfdf;
  border-radius: 50%;
  margin-top: 7px;
  margin-right: 12px;
  flex-shrink: 0;
}

.knugget-takeaway-text {
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-weight: 400;
  color: #ffffff;
  font-size: 15px;
  letter-spacing: 0.2px;
  line-height: 1.5;
}

/* Transcript styles */
.knugget-timestamp {
  font-family: 'Roboto Mono', monospace;
  font-weight: 500;
  color: #ffa500;
  font-size: 13px;
  min-width: 40px;
  margin-right: 12px;
  flex-shrink: 0;
  opacity: 0.9;
}

.knugget-transcript-text {
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-weight: 400;
  color: #ffffff;
  font-size: 15px;
  line-height: 1.5;
}

.transcript-segment {
  display: flex;
  align-items: flex-start;
  padding: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.transcript-segment:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

/* Summary content */
.knugget-summary-content {
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-weight: 400;
  color: #ffffff;
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: 20px;
  padding: 16px;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.knugget-summary-content strong {
  color: #ffa500;
  font-weight: 600;
}

/* Save button styling - UPDATED */
.knugget-save-btn {
  position: absolute;
  bottom: 12px;
  right: 14px;
  height: 32px;
  width: 64px;
  background: linear-gradient(90deg, rgba(255,177,0,1) 0%, rgba(255,70,6,1) 100%);
  color: #ffffff;
  font-family: "AirbnbCerealApp-Bold", Helvetica, Arial, sans-serif;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.5px;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  text-shadow: 0 1px 1px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
}

/* Hover state */
.knugget-save-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* Active/pressed state */
.knugget-save-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: none;
}

/* Disabled state */
.knugget-save-btn:disabled {
  cursor: default;
}

/* Saved state */
.knugget-save-btn.already-saved {
  background: #2e7d32; /* Green color for saved state */
  opacity: 0.9;
}

/* Loading state animation */
@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}

.knugget-save-btn.loading {
  animation: pulse 1.5s infinite;
  background: #888;
}

/* Custom scrollbar */
.knugget-content-inner::-webkit-scrollbar {
  width: 5px;
}

.knugget-content-inner::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2.5px;
}

.knugget-content-inner::-webkit-scrollbar-thumb {
  background-color: rgba(255, 177, 0, 0.5);
  border-radius: 2.5px;
}

/* Loading spinner */
.knugget-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(255, 177, 0, 0.1);
  border-radius: 50%;
  border-top: 2px solid rgba(255, 70, 6, 1);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Key Points Styling - Similar to Image 1 */
.key-point-item {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  margin-bottom: 12px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.key-point-emoji {
  margin-right: 12px;
  font-size: 16px;
  line-height: 1.5;
}

.key-point-text {
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  color: #ffffff;
  flex: 1;
}

/* Focus state */
.knugget-tab:focus, .knugget-save-btn:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(255, 177, 0, 0.5);
}
      
  `;
  document.head.appendChild(style);
}
