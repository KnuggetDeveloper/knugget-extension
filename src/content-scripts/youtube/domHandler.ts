import { loadAndDisplayTranscript, loadAndDisplaySummary } from './contentHandler';

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

      // Load summary data if needed
      loadAndDisplaySummary();
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
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "AUTH_STATE_CHANGED") {
      // If user logged in or out, refresh the summary tab if it's visible
      const summaryContent = document.getElementById("summary-content");
      const summaryTab = document.getElementById("summary-tab");

      if (summaryContent && !summaryContent.classList.contains("hidden")) {
        loadAndDisplaySummary();
      }
    }
  });
}