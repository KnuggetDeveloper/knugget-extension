import {
  loadAndDisplayTranscript,
  loadAndDisplaySummary,
} from "./contentHandler";

// Track video state and data
let summaryData: any = null;
let currentVideoId: string = "";

// Function to set up panel event listeners
export function setupPanelEventListeners(): void {
  // Tab switching
  const transcriptTab = document.getElementById("transcript-tab");
  const summaryTab = document.getElementById("summary-tab");
  const transcriptContent = document.getElementById("transcript-content");
  const summaryContent = document.getElementById("summary-content");

  if (transcriptTab && summaryTab && transcriptContent && summaryContent) {
    transcriptTab.addEventListener("click", () => {
      // Update tab styling
      transcriptTab.classList.add(
        "bg-gray-900",
        "text-white",
        "border-teal-500"
      );
      transcriptTab.classList.remove(
        "bg-black",
        "text-gray-400",
        "border-transparent"
      );
      summaryTab.classList.remove(
        "bg-gray-900",
        "text-white",
        "border-teal-500"
      );
      summaryTab.classList.add(
        "bg-black",
        "text-gray-400",
        "border-transparent"
      );

      // Show transcript, hide summary
      transcriptContent.classList.remove("hidden");
      summaryContent.classList.add("hidden");
    });

    summaryTab.addEventListener("click", () => {
      // Update tab styling
      summaryTab.classList.add("bg-gray-900", "text-white", "border-teal-500");
      summaryTab.classList.remove(
        "bg-black",
        "text-gray-400",
        "border-transparent"
      );
      transcriptTab.classList.remove(
        "bg-gray-900",
        "text-white",
        "border-teal-500"
      );
      transcriptTab.classList.add(
        "bg-black",
        "text-gray-400",
        "border-transparent"
      );

      // Show summary, hide transcript
      summaryContent.classList.remove("hidden");
      transcriptContent.classList.add("hidden");

      // Only load summary data if needed (not already loaded for this video)
      const videoId =
        new URLSearchParams(window.location.search).get("v") || "";
      if (!summaryData || currentVideoId !== videoId) {
        loadAndDisplaySummary();
      }
    });
  }

  // Settings button listener
  const settingsButton = document.getElementById("knugget-settings-btn");
  if (settingsButton) {
    settingsButton.addEventListener("click", () => {
      // Open settings page or modal
      chrome.runtime.sendMessage({ type: "OPEN_SETTINGS" });
    });
  }

  // Feedback link listener
  const feedbackLink = document.getElementById("knugget-feedback");
  if (feedbackLink) {
    feedbackLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: "OPEN_FEEDBACK" });
    });
  }
}

// Set up URL change detection for SPA navigation (only call this once)
export function setupURLChangeDetection(handleURLChange: () => void): void {
  // Check if we've already set up the listeners
  if ((window as any)._knuggetURLChangeListenersSet) {
    return;
  }

  console.log("Knugget AI: Setting up URL change detection");

  // Mark that we've set up the listeners
  (window as any)._knuggetURLChangeListenersSet = true;

  // Use history.pushState and replaceState overrides to detect navigation
  const originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(this, arguments as any);
    setTimeout(handleURLChange, 100); // Small delay to ensure URL is updated
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function () {
    originalReplaceState.apply(this, arguments as any);
    setTimeout(handleURLChange, 100); // Small delay to ensure URL is updated
  };

  // Also listen for popstate events (back/forward navigation)
  window.addEventListener("popstate", () => {
    setTimeout(handleURLChange, 100); // Small delay to ensure URL is updated
  });

  // Listen for yt-navigate-finish which is YouTube's custom event for navigation completion
  document.addEventListener("yt-navigate-finish", () => {
    console.log("Knugget AI: yt-navigate-finish event detected");
    setTimeout(handleURLChange, 300); // Give YouTube a bit more time to finish rendering
  });
}

// Setup message listener for background script communication
export function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "AUTH_STATE_CHANGED") {
      // If user logged in or out, refresh the summary tab if it's visible
      const summaryContent = document.getElementById("summary-content");
      const summaryTab = document.getElementById("summary-tab");

      if (summaryContent && !summaryContent.classList.contains("hidden")) {
        loadAndDisplaySummary();
      }
    } else if (message.type === "REFRESH_AUTH_STATE") {
      console.log("Received auth refresh message:", message);

      // Force auth state refresh
      if (message.payload?.forceCheck) {
        chrome.runtime.sendMessage(
          { type: "FORCE_CHECK_WEBSITE_LOGIN" },
          (response) => {
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

              if (isLoggedIn) {
                // If user is logged in, update UI to show summary tab and reload content
                console.log("User is now logged in - showing summary tab");

                // Get tab elements
                const summaryTab = document.getElementById("summary-tab");
                const transcriptTab = document.getElementById("transcript-tab");
                const summaryContent =
                  document.getElementById("summary-content");
                const transcriptContent =
                  document.getElementById("transcript-content");

                if (
                  summaryTab &&
                  transcriptTab &&
                  summaryContent &&
                  transcriptContent
                ) {
                  // Update tab styling to show summary tab as active
                  summaryTab.classList.add(
                    "bg-gray-900",
                    "text-white",
                    "border-teal-500"
                  );
                  summaryTab.classList.remove(
                    "bg-black",
                    "text-gray-400",
                    "border-transparent"
                  );
                  transcriptTab.classList.remove(
                    "bg-gray-900",
                    "text-white",
                    "border-teal-500"
                  );
                  transcriptTab.classList.add(
                    "bg-black",
                    "text-gray-400",
                    "border-transparent"
                  );

                  // Show summary, hide transcript
                  summaryContent.classList.remove("hidden");
                  transcriptContent.classList.add("hidden");

                  // Always reload the summary when auth state changes to logged in
                  loadAndDisplaySummary();
                }
              }
            });
          }
        );
      }

      if (sendResponse) sendResponse({ received: true });
    }
  });
}

// Function to set up button event listeners
export function setupButtonEventListeners(): void {
  // Settings button listener
  const settingsButton = document.getElementById("knugget-settings-btn");
  if (settingsButton) {
    settingsButton.addEventListener("click", () => {
      // Open settings page or modal
      chrome.runtime.sendMessage({ type: "OPEN_SETTINGS" });
    });
  }

  // Feedback link listener
  const feedbackLink = document.getElementById("knugget-feedback");
  if (feedbackLink) {
    feedbackLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: "OPEN_FEEDBACK" });
    });
  }

  // Dashboard button listener
  const dashboardButton = document.getElementById("dashboard-btn");
  if (dashboardButton) {
    dashboardButton.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
    });
  }
}
