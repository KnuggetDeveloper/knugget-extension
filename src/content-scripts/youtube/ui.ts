import { Summary, UI_ELEMENTS } from './types';
import { saveSummary } from './api';

// Function to show loading state in transcript/summary container
export function showLoading(
  contentElement: HTMLElement,
  message: string = "Loading"
): void {
  contentElement.innerHTML = `
    <div class="flex flex-col items-center justify-center p-6 text-center">
      <div class="knugget-spinner mb-4 w-8 h-8 border-2 border-t-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-base font-medium text-gray-200 mb-1">${message}</p>
      <p class="text-sm text-gray-400">Please wait...</p>
    </div>
  `;
}

// Function to show error state in container
export function showError(
  contentElement: HTMLElement,
  errorMessage: string,
  retryFunction?: () => void
): void {
  contentElement.innerHTML = `
    <div class="flex flex-col items-center justify-center p-6 text-center">
      <div class="mb-4 text-red-400">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 7V13M12 16V16.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="text-base font-medium text-gray-200 mb-1">Error</p>
      <p class="text-sm text-gray-400 mb-4">${errorMessage}</p>
      ${
        retryFunction
          ? `
        <button id="retry-btn" class="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2 rounded-md inline-flex items-center">
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
export function showLoginRequired(summaryContentElement: HTMLElement): void {
  summaryContentElement.innerHTML = `
    <div class="p-4 bg-gray-800 rounded-lg text-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-yellow-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H8m10-6a6 6 0 01-6 6 6 6 0 01-6-6 6 6 0 016-6 6 6 0 016 6z" />
      </svg>
      <h3 class="text-lg font-semibold text-white mb-2">Login Required</h3>
      <p class="text-gray-300 mb-4">Please log in to generate and view summaries</p>
      <button id="knugget-login-btn" class="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-md transition-colors">
        Login to Knugget
      </button>
      <button id="knugget-signup-btn" class="ml-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-md transition-colors">
        Create Account
      </button>
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

// Function to display summary
export function displaySummary(
  summaryContentElement: HTMLElement,
  summary: Summary
): void {
  // Create HTML for key points
  const keyPointsHTML = summary.keyPoints
    .map(
      (point) => `<li class="mb-3 flex items-start">
                     <span class="inline-block mr-2 text-teal-400">•</span>
                     <span>${point}</span>
                   </li>`
    )
    .join("");

  // Get video ID for generating the share URL
  const videoId = new URLSearchParams(window.location.search).get("v") || "";
  const shareUrl = `https://your-production-frontend.com/summary/${videoId}?ref=ext`;

  summaryContentElement.innerHTML = `
  <div class="p-4">
    <h3 class="text-xl font-medium text-white mb-3">${
      summary.title || "Summary"
    }</h3>
    
    <div class="mb-5 bg-gray-800 p-3 rounded-lg">
      <h4 class="text-md font-medium text-teal-400 mb-2">Key Points</h4>
      <ul class="list-none pl-1 text-gray-200">
        ${keyPointsHTML}
      </ul>
    </div>
    
    <div class="bg-gray-800 p-3 rounded-lg">
      <h4 class="text-md font-medium text-teal-400 mb-2">Full Summary</h4>
      <p class="text-gray-200 whitespace-pre-wrap leading-relaxed">${
        summary.fullSummary
      }</p>
    </div>

    <div class="mt-5 flex justify-between">
      <div class="flex gap-2">
        <button id="copy-summary-btn" class="bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium px-3 py-1.5 rounded-md inline-flex items-center transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          </svg>
          Copy
        </button>
        <button id="share-summary-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-md inline-flex items-center transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
            <polyline points="16 6 12 2 8 6"></polyline>
            <line x1="12" y1="2" x2="12" y2="15"></line>
          </svg>
          Share
        </button>
      </div>
      <!-- Remove the save button for now -->
      <!--
      <button id="save-summary-btn" class="bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium px-3 py-1.5 rounded-md inline-flex items-center transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Save Summary
      </button>
      -->
    </div>
  </div>
`;
  // Add copy button event listener
  const copyButton = document.getElementById("copy-summary-btn");
  if (copyButton) {
    copyButton.addEventListener("click", () => {
      try {
        // Create text to copy
        const textToCopy = `${summary.title}\n\nKEY POINTS:\n${summary.keyPoints
          .map((point) => `• ${point}`)
          .join("\n")}\n\nSUMMARY:\n${
          summary.fullSummary
        }\n\nGenerated by Knugget AI`;

        // Copy to clipboard
        navigator.clipboard.writeText(textToCopy).then(() => {
          copyButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5"></path>
            </svg>
            Copied!
          `;

          setTimeout(() => {
            copyButton.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" class="mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
              Copy
            `;
          }, 2000);
        });
      } catch (error) {
        console.error("Copy to clipboard failed:", error);
      }
    });
  }

  // Add share button event listener
  const shareButton = document.getElementById("share-summary-btn");
  if (shareButton) {
    shareButton.addEventListener("click", () => {
      try {
        navigator.clipboard.writeText(shareUrl).then(() => {
          shareButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5"></path>
            </svg>
            Link Copied!
          `;

          setTimeout(() => {
            shareButton.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" class="mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                <polyline points="16 6 12 2 8 6"></polyline>
                <line x1="12" y1="2" x2="12" y2="15"></line>
              </svg>
              Share
            `;
          }, 2000);
        });
      } catch (error) {
        console.error("Copy share link failed:", error);
      }
    });
  }

  // Add save button event listener
  const saveButton = document.getElementById("save-summary-btn");
  if (saveButton) {
    saveButton.addEventListener("click", async () => {
      try {
        (saveButton as HTMLButtonElement).disabled = true;
        saveButton.innerHTML = `
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Saving...
        `;

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

        if (response) {
          saveButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5"></path>
            </svg>
            Saved!
          `;

          // Add view button after saving
          const buttonsContainer = saveButton.parentElement;
          if (buttonsContainer) {
            const viewButton = document.createElement("button");
            viewButton.id = "view-saved-summaries-btn";
            viewButton.className =
              "ml-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium px-3 py-1.5 rounded-md inline-flex items-center transition-colors";
            viewButton.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" class="mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              View All
            `;

            // Add click handler to view saved summaries
            viewButton.addEventListener("click", () => {
              chrome.runtime.sendMessage({
                type: "OPEN_SAVED_SUMMARIES_PAGE",
              });
            });

            // Insert before the save button
            buttonsContainer.insertBefore(viewButton, saveButton);

            // Hide the save button
            saveButton.style.display = "none";
          }
        } else {
          saveButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Save Summary
          `;
          (saveButton as HTMLButtonElement).disabled = false;

          // Show error notification
          const notification = document.createElement("div");
          notification.className =
            "fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50";
          notification.textContent = "Failed to save summary";
          document.body.appendChild(notification);

          setTimeout(() => {
            notification.remove();
          }, 3000);
        }
      } catch (error) {
        console.error("Error saving summary:", error);
        (saveButton as HTMLButtonElement).disabled = false;
        saveButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          Save Summary
        `;
      }
    });
  }
}

// Function to inject Knugget panel into the page
export function injectKnuggetPanel(targetElement: HTMLElement): void {
  console.log("Knugget AI: Injecting panel");

  // Create our container
  const knuggetContainer = document.createElement("div");
  knuggetContainer.id = UI_ELEMENTS.CONTAINER_ID;
  knuggetContainer.className = UI_ELEMENTS.CONTAINER_CLASS;

  // Extract video ID from URL for potential API calls
  const videoId = new URLSearchParams(window.location.search).get("v") || "";

  // Create the improved UI with modern design
  knuggetContainer.innerHTML = `
  <div class="knugget-box bg-black min-w-[320px] rounded-lg shadow-lg border border-gray-800 overflow-hidden mb-4">
    <!-- Header with diamond icon -->
    <div class="flex justify-between items-center py-3 px-4 border-b border-gray-800">
      <div class="flex items-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="mr-2">
          <path d="M12 2L22 12L12 22L2 12L12 2Z" fill="${UI_ELEMENTS.DIAMOND_ICON_COLOR}"/>
        </svg>
        <span class="text-gray-200 font-medium text-sm">Knugget AI</span>
      </div>
      <div>
        <button id="knugget-settings-btn" class="text-gray-400 hover:text-gray-200">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </div>
    
    <!-- Tabs -->
    <div class="flex border-b border-gray-800">
      <button id="transcript-tab" class="flex-1 py-3 px-4 text-center text-sm font-medium bg-gray-900 text-white border-b-2 border-teal-500">
        Transcript
      </button>
      <button id="summary-tab" class="flex-1 py-3 px-4 text-center text-sm font-medium bg-black text-gray-400 border-b-2 border-transparent">
        Summary
      </button>
    </div>
    
    <!-- Content area -->
    <div class="knugget-content-area">
      <!-- Transcript content -->
      <div id="transcript-content" class="bg-black text-gray-200 max-h-[400px] overflow-y-auto">
        <!-- Transcript will be loaded here -->
        <div class="flex flex-col items-center justify-center p-6 text-center">
          <div class="knugget-spinner mb-4 w-8 h-8 border-2 border-t-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-base font-medium text-gray-200 mb-1">Loading Transcript</p>
          <p class="text-sm text-gray-400">Please wait while we load the transcript...</p>
        </div>
      </div>
      
      <!-- Summary content (initially hidden) -->
      <div id="summary-content" class="hidden bg-black text-gray-200 max-h-[400px] overflow-y-auto">
        <!-- Summary login prompt will be loaded here -->
      </div>
    </div>

    <!-- Footer -->
    <div class="py-2 px-4 border-t border-gray-800 flex justify-between items-center">
      <div class="text-xs text-gray-500">
        Powered by Knugget AI
      </div>
      <div>
        <a href="#" id="knugget-feedback" class="text-xs text-teal-500 hover:text-teal-400">Send feedback</a>
      </div>
    </div>
  </div>
  `;

  // Add the container to the target element
  targetElement.prepend(knuggetContainer);
  
  // Import from main.ts to avoid circular dependencies
  import('./main').then(module => {
    module.initPanelAfterInjection();
  });
}

// Add styles to the page
export function addStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
    .knugget-extension {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin-bottom: 16px;
    }
    
    .knugget-box {
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .knugget-spinner {
      animation: spin 1s linear infinite;
    }
    
    .transcript-segment {
      padding: 6px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      transition: background-color 0.2s;
    }
    
    .transcript-segment:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }
    
    .segment-timestamp {
      min-width: 50px;
      color: #00b894;
      font-family: monospace;
      font-weight: 500;
    }
    
    #transcript-content, #summary-content {
      scrollbar-width: thin;
      scrollbar-color: rgba(0, 184, 148, 0.5) rgba(0, 0, 0, 0.1);
      padding: 8px 0;
    }
    
    #transcript-content::-webkit-scrollbar,
    #summary-content::-webkit-scrollbar {
      width: 6px;
    }
    
    #transcript-content::-webkit-scrollbar-track,
    #summary-content::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.1);
    }
    
    #transcript-content::-webkit-scrollbar-thumb,
    #summary-content::-webkit-scrollbar-thumb {
      background-color: rgba(0, 184, 148, 0.5);
      border-radius: 6px;
    }
    
    #transcript-tab, #summary-tab {
      transition: all 0.2s ease;
      position: relative;
    }
    
    #summary-tab:hover, #transcript-tab:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }
    
    button {
      cursor: pointer;
    }
    
    .knugget-extension button:hover {
      opacity: 0.9;
    }
    
    /* Summary styling */
    #summary-content h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      padding: 0 12px;
    }
    
    #summary-content h4 {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
      padding: 0 12px;
      color: #00b894;
    }
    
    #summary-content ul {
      margin-left: 12px;
      margin-right: 12px;
      margin-bottom: 16px;
    }
    
    #summary-content p {
      padding: 0 12px;
      line-height: 1.5;
      margin-bottom: 12px;
    }
    
    /* Button styling */
    #knugget-login-btn, #save-summary-btn, #retry-btn {
      background-color: #00b894;
      transition: background-color 0.2s ease;
    }
    
    #knugget-login-btn:hover, #save-summary-btn:hover, #retry-btn:hover {
      background-color: #00a884;
    }
    
    /* Diamond icon pulsing animation */
    @keyframes pulse {
      0% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
      100% {
        transform: scale(1);
      }
    }
    
    .knugget-box svg path[fill="${UI_ELEMENTS.DIAMOND_ICON_COLOR}"] {
      animation: pulse 2s infinite ease-in-out;
    }
  `;
  document.head.appendChild(style);
}