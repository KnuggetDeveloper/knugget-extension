// Main entry point for the extension
import "./main";

// Export types from types.ts
export * from "./types";

// Export utility functions
export * from "./utils";

// Export auth functions - don't export the ones from api.ts
export * from "./auth";

// Export API functions - explicitly export only what's not in auth.ts
export {
  apiRequest,
  generateSummary,
  saveSummary,
  deleteSummary,
  getSavedSummaries,
  getSummaryById,
  getUserFriendlyError,
} from "./api";

// Export UI components
export * from "./ui";

// Export transcript functionality
export * from "./transcript";

// Export content handlers
export * from "./contentHandler";

// Export DOM-related functionality
export * from "./domHandler";
export * from "./domObserver";

// Export main functionality
export * from "./main";
