// Updated src/content-scripts/youtube/contentHandler.ts

import { Summary, TranscriptSegment } from "./types";
import { extractTranscript, createTranscriptSegmentHTML } from "./transcript";
import {
  showLoading,
  showError,
  showLoginRequired,
  displaySummary,
} from "./ui";
import { generateSummary, isUserLoggedIn } from "./api";
import { getAuthToken } from "./auth";

// Global variables for tracking data
let transcriptData: TranscriptSegment[] | null = null;
let summaryData: Summary | null = null;
let currentVideoId: string | null = null;

// Function to load and display transcript
export async function loadAndDisplayTranscript(): Promise<void> {
  console.log("Knugget AI: Loading and displaying transcript");

  const transcriptContentElement =
    document.getElementById("transcript-content");
  if (!transcriptContentElement) return;

  // Show loading state
  showLoading(transcriptContentElement, "Loading Transcript");

  try {
    // Add a small delay to ensure YouTube has fully loaded
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get current video ID to track which video we're processing
    const videoId = new URLSearchParams(window.location.search).get("v") || "";

    // Update our tracking of the current video ID
    if (currentVideoId !== videoId) {
      console.log(`Video ID changed from ${currentVideoId} to ${videoId}`);
      currentVideoId = videoId;
      resetContentData(); // Reset data when video changes
    }

    // Extract transcript data
    const transcriptResponse = await extractTranscript();

    if (!transcriptResponse.success || !transcriptResponse.data) {
      throw new Error(
        transcriptResponse.error || "Failed to extract transcript"
      );
    }

    // Store transcript data for summary generation
    transcriptData = transcriptResponse.data;

    // Create transcript segments HTML and inject into content
    const segmentsHTML = createTranscriptSegmentHTML(transcriptResponse.data);
    transcriptContentElement.innerHTML = `
      <div class="space-y-2 p-2">
        ${segmentsHTML}
      </div>
    `;

    console.log(`Transcript loaded successfully for video ID: ${videoId}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Transcript extraction error:", errorMessage);
    showError(transcriptContentElement, errorMessage, loadAndDisplayTranscript);
  }
}

// Function to load and display summary
export async function loadAndDisplaySummary(): Promise<void> {
  console.log("Knugget AI: Loading and displaying summary");

  const summaryContentElement = document.getElementById("summary-content");
  if (!summaryContentElement) return;

  // Show loading state
  showLoading(summaryContentElement, "Generating Summary");

  try {
    // Get current video ID
    const videoId = new URLSearchParams(window.location.search).get("v") || "";

    // Check if video changed since last summary
    if (currentVideoId !== videoId) {
      console.log(
        `Video ID changed from ${currentVideoId} to ${videoId} during summary generation`
      );
      currentVideoId = videoId;
      resetContentData(); // Reset data for new video
    }

    console.log("Checking authentication status before generating summary...");

    // Improved auth check with proper awaiting
    let isLoggedIn = false;
    
    // First check if we already have an auth token in storage
    const initialToken = await getAuthToken();
    if (initialToken) {
      console.log("Found valid token in storage");
      isLoggedIn = true;
    } else {
      console.log("No token in storage, forcing website cookie check...");
      
      // Force a check with the background script and properly wait for it
      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: "FORCE_CHECK_WEBSITE_LOGIN" }, () => {
          console.log("Website cookie check completed");
          // Give background script time to process and update storage
          setTimeout(resolve, 1500);
        });
      });
      
      // Check again after the background script has checked
      const tokenAfterCheck = await getAuthToken();
      if (tokenAfterCheck) {
        console.log("Found token after website cookie check");
        isLoggedIn = true;
      } else {
        console.log("Still no token after website cookie check");
        
        // Final attempt - try direct API call with credentials
        try {
          console.log("Making direct API call with credentials to check auth...");
          const response = await fetch("http://localhost:3000/api/auth/me", {
            method: "GET",
            credentials: "include", // Include cookies in request
          });

          if (response.ok) {
            const userData = await response.json();
            console.log("User authenticated via direct API call with credentials!");
            
            // Manually create auth entry in extension storage
            const userInfo = {
              id: userData.id,
              email: userData.email,
              name: userData.name || "",
              token: "session_token_via_direct_api", // Dummy token for cookie auth
              refreshToken: null,
              expiresAt: Date.now() + 24 * 60 * 60 * 1000,
              credits: userData.credits || 0,
              plan: userData.plan || "free",
            };
            
            // Store in extension storage
            await new Promise<void>((resolve) => {
              chrome.storage.local.set({ knuggetUserInfo: userInfo }, () => {
                console.log("Stored auth info from direct API call");
                resolve();
              });
            });
            
            isLoggedIn = true;
          } else {
            console.warn("Direct API auth check failed:", response.status);
          }
        } catch (error) {
          console.error("Error during direct API auth check:", error);
        }
      }
    }

    if (!isLoggedIn) {
      console.warn("User not authenticated — login required");
      showLoginRequired(summaryContentElement); // Shows login UI or prompt
      return;
    }

    console.log("User is authenticated! Proceeding with summary generation...");

    // Load transcript if needed
    if (!transcriptData) {
      console.log("No transcript data - fetching transcript first...");
      const transcriptResponse = await extractTranscript();

      if (!transcriptResponse.success || !transcriptResponse.data) {
        throw new Error(
          transcriptResponse.error || "Could not extract video transcript"
        );
      }

      transcriptData = transcriptResponse.data;
      console.log(
        "Transcript extraction successful, entries:",
        transcriptData.length
      );
    }

    // Get video metadata
    const videoUrl = window.location.href;
    const videoTitle =
      document.querySelector("h1.title")?.textContent?.trim() ||
      document.querySelector("h1.ytd-watch-metadata")?.textContent?.trim() ||
      "YouTube Video";
    const channelElement = document.querySelector(
      "#top-row .ytd-channel-name a, #channel-name a"
    );
    const channelName = channelElement?.textContent?.trim() || "";

    console.log("Generating summary for:", {
      videoId,
      videoUrl,
      videoTitle,
      channelName,
    });

    // Combine all transcript segments into one text string
    const transcriptText = transcriptData.map((s) => s.text).join(" ");

    const summaryResponse = await generateSummary(transcriptText, {
      videoId,
      title: videoTitle,
      url: videoUrl,
      channelName,
    });

    if (!summaryResponse.success || !summaryResponse.data) {
      throw new Error(summaryResponse.error || "Failed to generate summary");
    }

    // Ensure the data structure is valid
    const summaryResult = {
      title: summaryResponse.data.title || videoTitle,
      keyPoints: Array.isArray(summaryResponse.data.keyPoints)
        ? summaryResponse.data.keyPoints
        : [],
      fullSummary: summaryResponse.data.fullSummary || "No summary available.",
    };

    // Store summary data
    summaryData = summaryResult;

    // Display the summary
    displaySummary(summaryContentElement, summaryResult);

    console.log(`Summary loaded successfully for video ID: ${videoId}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Summary generation error:", errorMessage);
    showError(summaryContentElement, errorMessage, loadAndDisplaySummary);
  }
}
// Reset data (when video changes)
export function resetContentData() {
  console.log("Resetting content data for new video");
  transcriptData = null;
  summaryData = null;
}

// Getters for data
export function getTranscriptData(): TranscriptSegment[] | null {
  return transcriptData;
}

export function getSummaryData(): Summary | null {
  return summaryData;
}

// Getter for current video ID
export function getCurrentVideoId(): string | null {
  return currentVideoId;
}
