// src/content-scripts/youtube/ui.ts
// Updated implementation for Knugget panel

import { Summary, UI_ELEMENTS } from "./types";
import { saveSummary } from "./api";

// Function to show loading state in panel
export function showLoading(contentElement: HTMLElement, message = "Loading") {
  contentElement.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center;">
      <div class="knugget-spinner" style="width: 32px; height: 32px; margin-bottom: 16px;"></div>
      <p style="font-family: 'AirbnbCerealApp-Medium', Helvetica; font-weight: 500; color: #dfdfdf; margin-bottom: 8px;">${message}</p>
      <p style="font-family: 'AirbnbCerealApp-Medium', Helvetica; font-weight: 400; color: #aaaaaa; font-size: 0.875rem;">Please wait...</p>
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
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center;">
      <div style="color: #ff4757; margin-bottom: 16px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 7V13M12 16V16.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <p style="font-family: 'AirbnbCerealApp-Medium', Helvetica; font-weight: 500; color: #dfdfdf; margin-bottom: 8px;">Error</p>
      <p style="font-family: 'AirbnbCerealApp-Medium', Helvetica; font-weight: 400; color: #aaaaaa; font-size: 0.875rem; margin-bottom: 16px;">${errorMessage}</p>
      ${
        typeof retryFunction === "function"
          ? `
        <button id="retry-btn" style="background: linear-gradient(90deg, rgba(255,177,0,1) 0%, rgba(255,70,6,1) 100%); color: #362b1e; font-family: 'AirbnbCerealApp-Black', Helvetica; font-weight: 900; font-size: 0.75rem; padding: 6px 12px; border: none; border-radius: 17.5px; cursor: pointer;">
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
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center;">
      <div style="color: #ffc048; margin-bottom: 16px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 15v2m0 0v2m0-2h2m-2 0H8m10-6a6 6 0 01-6 6 6 6 0 01-6-6 6 6 0 016-6 6 6 0 016 6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <p style="font-family: 'AirbnbCerealApp-Black', Helvetica; font-weight: 900; color: #dfdfdf; margin-bottom: 8px;">Login Required</p>
      <p style="font-family: 'AirbnbCerealApp-Medium', Helvetica; font-weight: 400; color: #aaaaaa; font-size: 0.875rem; margin-bottom: 16px;">Please log in to generate and view summaries</p>
      <div style="display: flex; gap: 8px;">
        <button id="knugget-login-btn" style="background: linear-gradient(90deg, rgba(255,177,0,1) 0%, rgba(255,70,6,1) 100%); color: #362b1e; font-family: 'AirbnbCerealApp-Black', Helvetica; font-weight: 900; font-size: 0.75rem; padding: 6px 12px; border: none; border-radius: 17.5px; cursor: pointer;">
          Login
        </button>
        <button id="knugget-signup-btn" style="background: #2e2e2e; color: #cccccc; font-family: 'AirbnbCerealApp-Black', Helvetica; font-weight: 900; font-size: 0.75rem; padding: 6px 12px; border: none; border-radius: 17.5px; cursor: pointer;">
          Create Account
        </button>
      </div>
    </div>
  `;

  // Add event listeners to login and signup buttons
  const loginBtn = document.getElementById("knugget-login-btn");
  const signupBtn = document.getElementById("knugget-signup-btn");

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_LOGIN_PAGE" });
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener("click", () => {
      // Pass the current URL to the background script so it can be included in registration flow
      chrome.runtime.sendMessage({
        type: "OPEN_SIGNUP_PAGE",
        payload: { url: window.location.href },
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
  const keyPointsHTML =
    normalizedSummary.keyPoints.length > 0
      ? normalizedSummary.keyPoints
          .map(
            (point: string) => `
        <li class="knugget-list-item">
          <span class="knugget-takeaway-text">${point}</span>
        </li>
      `
          )
          .join("")
      : `<li class="knugget-list-item">
         <span class="knugget-takeaway-text">No key points available</span>
       </li>`;

  // Update content
  summaryContentElement.innerHTML = `
    <h2 class="knugget-title">${normalizedSummary.title}</h2>
    <div class="knugget-summary-content">
      ${formattedSummary}
    </div>
    <ul class="knugget-list">
      ${keyPointsHTML}
    </ul>
  `;

  // Add save button if not already present
  if (!document.getElementById("save-btn")) {
    const saveButton = document.createElement("button");
    saveButton.id = "save-btn";
    saveButton.className = "knugget-save-btn";
    saveButton.textContent = "Save";

    // Add to container
    const container = document.querySelector(".knugget-box");
    if (container) {
      container.appendChild(saveButton);
    }

    // Add event listener
    saveButton.addEventListener("click", async () => {
      try {
        saveButton.disabled = true;
        saveButton.textContent = "...";

        // Get video metadata
        const videoId =
          new URLSearchParams(window.location.search).get("v") || "";
        const videoUrl = window.location.href;

        // Prepare summary for saving
        const summaryToSave = {
          ...summary,
          videoId,
          sourceUrl: videoUrl,
          source: "youtube",
        };

        // Call API to save summary
        const response = await saveSummary(summaryToSave);

        if (response && response.success) {
          saveButton.textContent = "Saved";
          setTimeout(() => {
            saveButton.textContent = "Save";
            saveButton.disabled = false;
          }, 2000);
        } else {
          saveButton.textContent = "Failed";
          setTimeout(() => {
            saveButton.textContent = "Save";
            saveButton.disabled = false;
          }, 2000);
        }
      } catch (error) {
        console.error("Error saving summary:", error);
        saveButton.textContent = "Error";
        setTimeout(() => {
          saveButton.textContent = "Save";
          saveButton.disabled = false;
        }, 2000);
      }
    });
  }
}

// Function to inject Knugget panel into the page
export function injectKnuggetPanel(targetElement: HTMLElement) {
  console.log("Knugget AI: Injecting panel with updated UI");

  // Create our container
  const knuggetContainer = document.createElement("div");
  knuggetContainer.id = "knugget-container";
  knuggetContainer.className = "knugget-extension";

  // Create the UI based on the design in the provided image
  knuggetContainer.innerHTML = `
    <div class="knugget-box">
      <!-- Header with logo and credits -->
      <div class="knugget-header">
        <!-- Gold icon -->
        <div style="display: flex; align-items: center;">
          <img
            alt="Gold ingots"
            src="https://i.ibb.co/23dhZ9F/gold-ingots.png"
            style="width: 21px; height: 21px; margin-right: 8px;"
          />
          <span class="knugget-logo">Knugget</span>
        </div>
        
        <!-- Credits Badge -->
        <div class="knugget-credits">
          <img
            alt="Gold bar"
            src="https://i.ibb.co/zZQK6W0/gold-bar.png"
            style="width: 18px; height: 18px; margin-right: 4px;"
          />
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
      
      <!-- Save Button -->
      <button id="save-btn" class="knugget-save-btn">Save</button>
    </div>
  `;

  // Add the container to the target element
  targetElement.prepend(knuggetContainer);

  // Show loading state initially
  const transcriptContent = document.getElementById("transcript-content");
  const summaryContent = document.getElementById("summary-content");

  if (transcriptContent) {
    showLoading(transcriptContent, "Loading Transcript");
  }

  if (summaryContent) {
    // Still initialize the summary content, but it will be hidden
    showLoading(summaryContent, "Generating Key Takeaways");
  }

  // Setup event listeners for tabs
  setupTabEventListeners();

  // Load transcript by default
  loadAndDisplayTranscript();
}

// Function to set up tab event listeners
function setupTabEventListeners() {
  const transcriptTab = document.getElementById("transcript-tab");
  const summaryTab = document.getElementById("summary-tab");
  const transcriptContent = document.getElementById("transcript-content");
  const summaryContent = document.getElementById("summary-content");

  if (transcriptTab && summaryTab && transcriptContent && summaryContent) {
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

      // Load summary content if needed
      loadAndDisplaySummary();
    });
  }
}

// Import these functions from your contentHandler.js
import {
  loadAndDisplayTranscript,
  loadAndDisplaySummary,
} from "./contentHandler";

// Add styles to the page
export function addStyles() {
  const style = document.createElement("style");
  style.textContent = `
    /* Knugget AI Extension Styling */
    
    /* Base styles */
    .knugget-extension {
      font-family: "AirbnbCerealApp", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin-bottom: 16px;
      width: 100%;
      max-width: 465px;
    }
    
    .knugget-box {
      background-color: black;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
      height: 519px;
      position: relative;
    }
    
    /* Header section */
    .knugget-header {
      padding: 8px 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .knugget-logo {
      font-family: "AirbnbCerealApp-Black", Helvetica;
      font-weight: 900;
      background: linear-gradient(90deg, rgba(255,177,0,1) 0%, rgba(255,70,6,1) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      text-fill-color: transparent;
      font-size: 1.25rem;
      letter-spacing: 1.27px;
    }
    
    .knugget-credits {
      font-family: "AirbnbCerealApp-Medium", Helvetica;
      font-weight: 500;
      color: #dfdfdf;
      font-size: 0.75rem;
      letter-spacing: 0.76px;
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
      padding: 8px 12px;
    }
    
    .knugget-tab {
      flex: 1;
      height: 37px;
      border-radius: 17.5px;
      font-family: "AirbnbCerealApp-Black", Helvetica;
      font-weight: 900;
      font-size: 15px;
      letter-spacing: 0.95px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    .knugget-tab-inactive {
      background-color: #2e2e2e;
      color: #cccccc;
    }
    
    .knugget-tab-active {
      background: linear-gradient(90deg, rgba(255,177,0,1) 0%, rgba(255,70,6,1) 100%);
      color: #362b1e;
    }
    
    /* Content area */
    .knugget-content {
      margin: 10px 12px;
      background-color: #0f0f0f;
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
      font-family: "AirbnbCerealApp-Black", Helvetica;
      font-weight: 900;
      color: #dfdfdf;
      font-size: 1.25rem;
      margin-bottom: 16px;
      letter-spacing: 0.25px;
    }
    
    /* List items */
    .knugget-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    
    .knugget-list-item {
      display: flex;
      align-items: flex-start;
    }
    
    .knugget-bullet {
      width: 10px;
      height: 10px;
      background-color: #dfdfdf;
      border-radius: 5px;
      margin-top: 6px;
      margin-right: 20px;
      flex-shrink: 0;
    }
    
    .knugget-transcript-text {
      font-family: "Istok Web", Helvetica;
      font-weight: bold;
      color: #f6f6f6;
      font-size: 1.25rem;
    }
    
    .knugget-takeaway-text {
      font-family: "AirbnbCerealApp-Medium", Helvetica;
      font-weight: 500;
      color: #dfdfdf;
      font-size: 0.875rem;
      letter-spacing: 0.12px;
      line-height: 1.4;
    }
    
    /* Save button */
    .knugget-save-btn {
      position: absolute;
      bottom: 7px;
      right: 14px;
      height: 24px;
      width: 54px;
      background: linear-gradient(90deg, rgba(255,177,0,1) 0%, rgba(255,70,6,1) 100%);
      color: #362b1e;
      font-family: "AirbnbCerealApp-Black", Helvetica;
      font-weight: 900;
      font-size: 0.75rem;
      letter-spacing: 0.76px;
      border: none;
      border-radius: 17.5px;
      cursor: pointer;
    }
    
    /* Custom scrollbar */
    .knugget-content-inner::-webkit-scrollbar {
      width: 2.5px;
    }
    
    .knugget-content-inner::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .knugget-content-inner::-webkit-scrollbar-thumb {
      background-color: #aaaaaa;
      border-radius: 5.5px;
    }
    
    /* Transcript timestamp */
    .knugget-timestamp {
      font-family: 'AirbnbCerealApp-Medium', Helvetica;
      font-weight: 500;
      color: #ffa500;
      font-size: 0.875rem;
      min-width: 60px;
      margin-right: 12px;
      padding-top: 3px;
      flex-shrink: 0;
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
    /* Summary formatting */
    .knugget-summary-content {
      font-family: "AirbnbCerealApp-Medium", Helvetica;
      font-weight: 400;
      color: #dfdfdf;
      font-size: 0.875rem;
      line-height: 1.5;
      margin-bottom: 16px;
      padding: 12px;
      background-color: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
    }
    
    .knugget-summary-content strong {
      color: #ffa500;
      font-weight: 700;
    }
    
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
      padding: 8px 12px;
      background-color: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      transition: background-color 0.2s ease;
    }
    
    .knugget-list-item:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
    
    .knugget-takeaway-text {
      font-family: "AirbnbCerealApp-Medium", Helvetica;
      font-weight: 400;
      color: #dfdfdf;
      font-size: 0.875rem;
      letter-spacing: 0.12px;
      line-height: 1.4;
    }
      
  `;
  document.head.appendChild(style);
}
