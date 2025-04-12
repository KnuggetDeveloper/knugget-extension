import { UI_ELEMENTS } from './types';
import { injectKnuggetPanel } from './ui';

// Function to observe YouTube DOM changes and inject our panel
export function observeYouTubeDOM(): void {
  console.log("Knugget AI: Observing DOM for secondary column");

  // Try to find the secondary column immediately first
  const secondaryColumn = document.getElementById(UI_ELEMENTS.SECONDARY_COLUMN);
  if (secondaryColumn && !document.getElementById(UI_ELEMENTS.CONTAINER_ID)) {
    injectKnuggetPanel(secondaryColumn);
    return;
  }

  // If not found, set up an observer
  const observer = new MutationObserver((mutations: MutationRecord[]): void => {
    // Look for the secondary column where we'll inject our UI
    const secondaryColumn = document.getElementById(
      UI_ELEMENTS.SECONDARY_COLUMN
    );
    if (secondaryColumn && !document.getElementById(UI_ELEMENTS.CONTAINER_ID)) {
      injectKnuggetPanel(secondaryColumn);
      observer.disconnect();
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Set a timeout to stop observing after 10 seconds to prevent memory leaks
  setTimeout(() => {
    observer.disconnect();
  }, 10000);
}