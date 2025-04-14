// Interface definitions for transcript data
export interface TranscriptSegment {
  timestamp: string;
  text: string;
}

export interface TranscriptResponse {
  success: boolean;
  data?: TranscriptSegment[];
  error?: string;
}

export interface Summary {
  id?: string;
  title: string;
  keyPoints: string[];
  fullSummary: string;
  source?: string;
  sourceUrl?: string;
  videoId?: string;
  createdAt?: string;
  alreadySaved?: boolean; // Flag to indicate if summary is already saved
}

// Define our UI elements' class and ID names
export const UI_ELEMENTS = {
  SECONDARY_COLUMN: "secondary",
  CONTAINER_ID: "knugget-container",
  CONTAINER_CLASS: "knugget-extension knugget-summary-widget",
  DIAMOND_ICON_COLOR: "#00b894",
};

// API endpoints and base URL
export const API_BASE_URL = "http://localhost:3000/api"; // Backend API URL

export const ENDPOINTS = {
  LOGIN: "/auth/signin",
  REGISTER: "/auth/signup",
  USER_PROFILE: "/auth/me",
  SUMMARIZE: "/summary/generate",
  SAVED_SUMMARIES: "/summary",
  SAVE_SUMMARY: "/summary/save",
};
