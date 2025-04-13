import { Summary, TranscriptSegment } from "./types";
import { extractTranscript, createTranscriptSegmentHTML } from "./transcript";
import {
  showLoading,
  showError,
  showLoginRequired,
  displaySummary,
} from "./ui";
import { generateSummary, isUserLoggedIn } from "./api";

// Global variables for tracking data
let transcriptData: TranscriptSegment[] | null = null;
let summaryData: Summary | null = null;

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

    console.log("Transcript loaded successfully");
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
    // ✅ CHECK IF USER IS LOGGED IN FIRST
    const isLoggedIn = await isUserLoggedIn();
    if (!isLoggedIn) {
      console.warn("User not authenticated — login required");
      showLoginRequired(summaryContentElement); // Shows login UI or prompt
      return;
    }

    // Load transcript if needed
    if (!transcriptData) {
      const transcriptResponse = await extractTranscript();

      if (!transcriptResponse.success || !transcriptResponse.data) {
        throw new Error(
          transcriptResponse.error || "Could not extract video transcript"
        );
      }

      transcriptData = transcriptResponse.data;
    }

    // Get video metadata
    const videoUrl = window.location.href;
    const videoId = new URLSearchParams(window.location.search).get("v") || "";
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

    console.log("Summary loaded successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Summary generation error:", errorMessage);
    showError(summaryContentElement, errorMessage, loadAndDisplaySummary);
  }
}

// Reset data (when video changes)
export function resetContentData() {
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
