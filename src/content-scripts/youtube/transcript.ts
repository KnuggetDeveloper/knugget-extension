import { TranscriptResponse, TranscriptSegment } from './types';
import { invisibleClick, waitForElement } from './utils';

// Check if "No transcript" message is visible
function hasNoTranscriptMessage(): boolean {
  const noTranscriptSelectors = [
    "ytd-transcript-renderer yt-formatted-string",
    "ytd-transcript-body-renderer yt-formatted-string",
    "ytd-transcript-segment-list-renderer yt-formatted-string",
  ];

  for (const selector of noTranscriptSelectors) {
    const element = document.querySelector(selector);
    if (element?.textContent?.toLowerCase().includes("no transcript")) {
      return true;
    }
  }
  return false;
}

// Extracts the transcript from the engagement panel
export async function extractTranscript(): Promise<TranscriptResponse> {
  try {
    // First check for "No transcript" message
    if (hasNoTranscriptMessage()) {
      throw new Error("No transcript available for this video");
    }

    // Check if transcript is already open and has segments
    const existingTranscript = document.querySelector(
      "ytd-transcript-segment-renderer"
    );
    if (existingTranscript) {
      const segments = Array.from(
        document.querySelectorAll("ytd-transcript-segment-renderer")
      );

      if (segments.length > 0) {
        const transcript = segments.map((seg) => {
          const timestampElement = seg.querySelector(".segment-timestamp");
          const textElement = seg.querySelector(".segment-text");

          const timestamp = timestampElement?.textContent?.trim() ?? "";
          const text = textElement?.textContent?.trim() ?? "";

          return { timestamp, text };
        });

        if (transcript.length > 0) {
          return { success: true, data: transcript };
        }
      }
    }

    // If we get here, we need to try opening the transcript
    // 1. Click the "...more" (expand) button to reveal transcript
    const expandButton = document.querySelector("tp-yt-paper-button#expand");
    if (expandButton) {
      invisibleClick(expandButton);
      await new Promise((res) => setTimeout(res, 500));
    }

    // 2. Wait and find the "Show transcript" button
    const transcriptButton = await waitForElement(
      'ytd-button-renderer button[aria-label="Show transcript"]'
    );
    if (!transcriptButton) throw new Error("Transcript button not found");

    invisibleClick(transcriptButton);
    await new Promise((res) => setTimeout(res, 1000));

    // Check again for "No transcript" message after opening
    if (hasNoTranscriptMessage()) {
      throw new Error("No transcript available for this video");
    }

    // 3. Wait for transcript segments to load
    await waitForElement("ytd-transcript-segment-renderer");
    await new Promise((res) => setTimeout(res, 1000));

    // 4. Extract transcript
    const segments = Array.from(
      document.querySelectorAll("ytd-transcript-segment-renderer")
    );

    if (segments.length === 0) {
      throw new Error("No transcript segments found");
    }

    const transcript = segments.map((seg) => {
      const timestampElement = seg.querySelector(".segment-timestamp");
      const textElement = seg.querySelector(".segment-text");

      const timestamp = timestampElement?.textContent?.trim() ?? "";
      const text = textElement?.textContent?.trim() ?? "";

      return { timestamp, text };
    });

    return { success: true, data: transcript };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, error: errorMessage };
  }
}

// Function to create transcript segment HTML
export function createTranscriptSegmentHTML(segments: TranscriptSegment[]): string {
  if (!segments || segments.length === 0) {
    return `
      <div class="p-4 text-center">
        <p class="text-gray-400">No transcript segments found.</p>
      </div>
    `;
  }

  return segments
    .map(
      (segment) => `
      <div class="transcript-segment mb-3">
        <div class="flex">
          <span class="segment-timestamp text-teal-400 font-mono text-xs mr-2">${segment.timestamp}</span>
          <p class="segment-text text-gray-200 whitespace-pre-wrap">${segment.text}</p>
        </div>
      </div>
    `
    )
    .join("");
}