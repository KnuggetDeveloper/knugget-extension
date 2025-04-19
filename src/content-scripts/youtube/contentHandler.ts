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

  try {
    // First check auth status BEFORE showing loading
    console.log("Checking authentication status before starting...");
    const isUserAuthenticated = await isUserLoggedIn();
    
    // IMPORTANT: If not logged in, immediately show login UI and return
    if (!isUserAuthenticated) {
      console.log("User not authenticated - showing login required UI");
      showLoginRequired(summaryContentElement);
      return;
    }
    
    // Only show loading if user is authenticated
    showLoading(summaryContentElement, "Generating Summary");

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

    // Check for authentication errors in response
    if (!summaryResponse.success) {
      if (
        summaryResponse.error?.includes("Authentication required") ||
        summaryResponse.error?.includes("Unauthorized") ||
        summaryResponse.error?.includes("not authenticated") ||
        summaryResponse.error?.includes("Please log in") ||
        summaryResponse.status === 401
      ) {
        console.warn("Authentication error from API:", summaryResponse.error);
        showLoginRequired(summaryContentElement);
        return;
      }
      
      throw new Error(summaryResponse.error || "Failed to generate summary");
    }

    if (!summaryResponse.data) {
      throw new Error("No summary data received");
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
    
    // Check for authentication errors in the caught error
    if (
      errorMessage.includes("Authentication required") ||
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("not authenticated") ||
      errorMessage.includes("Please log in") ||
      errorMessage.includes("401")
    ) {
      console.warn("Authentication error caught:", errorMessage);
      showLoginRequired(summaryContentElement);
      return;
    }
    
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
