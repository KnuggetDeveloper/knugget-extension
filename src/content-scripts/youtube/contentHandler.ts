import { Summary, TranscriptSegment } from "./types";
import { extractTranscript, createTranscriptSegmentHTML } from "./transcript";
import {
  showLoading,
  showError,
  showLoginRequired,
  displaySummary,
} from "./ui";
import { isUserLoggedIn } from "./auth";
import { generateSummary } from "./api";

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
    // Check if we have transcript data
    if (!transcriptData) {
      // Try to load transcript first
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

    // Get channel name if available
    const channelElement = document.querySelector(
      "#top-row .ytd-channel-name a, #channel-name a"
    );
    const channelName = channelElement?.textContent?.trim() || "";

    console.log("Generating summary for:", {
      videoId,
      videoTitle,
      channelName,
    });

    // Convert transcript segments to plain text for the API
    const transcriptText = transcriptData
      .map((segment) => segment.text)
      .join(" ");

    // Call the API with proper metadata
    const summaryResponse = await generateSummary(transcriptData, {
      videoId,
      title: videoTitle,
      url: videoUrl,
      channelName,
    });

    if (!summaryResponse.success || !summaryResponse.data) {
      console.error("Summary generation failed:", summaryResponse.error);
      throw new Error(summaryResponse.error || "Failed to generate summary");
    }

    // Store summary data
    summaryData = summaryResponse.data;

    // Display the summary
    displaySummary(summaryContentElement, summaryData);

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
