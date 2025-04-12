/**
 * Knugget AI API Service
 * Handles all API communication with the backend server
 */

// src/utils/api.ts - Config section
// Base URL for the Knugget API - Update this to point to your backend

import { supabase } from "./auth"; // Ensure this exports the initialized Supabase client

const API_BASE_URL = "http://localhost:3000/api"; // Update this with your actual server URL

// API endpoints - Make sure these match your backend routes
const ENDPOINTS = {
  LOGIN: "/auth/signin", // Changed from /auth/login
  REGISTER: "/auth/signup", // Changed from /auth/register
  REFRESH_TOKEN: "/auth/refresh",
  USER_PROFILE: "/auth/me",
  SUMMARIZE: "/summary/generate",
  SAVED_SUMMARIES: "/summary",
  SAVE_SUMMARY: "/summary/save",
};

/**
 * Delete a saved summary
 * @param summaryId ID of the summary to delete
 * @returns Promise resolving to API response indicating success
 */
export async function deleteSummary(
  summaryId: string
): Promise<ApiResponse<{ success: boolean }>> {
  return apiRequest<{ success: boolean }>(
    `${ENDPOINTS.SAVED_SUMMARIES}/${summaryId}`,
    "DELETE"
  );
}

/**
 * Get a specific summary by ID
 * @param summaryId ID of the summary to retrieve
 * @returns Promise resolving to API response with summary
 */
export async function getSummaryById(
  summaryId: string
): Promise<ApiResponse<Summary>> {
  return apiRequest<Summary>(`${ENDPOINTS.SAVED_SUMMARIES}/${summaryId}`);
}

/**
 * Convert API response errors to user-friendly messages
 * @param error Error message from API
 * @returns User-friendly error message
 */
export function getUserFriendlyError(error: string): string {
  // Map of API error messages to user-friendly messages
  const errorMap: Record<string, string> = {
    "Authentication required": "Please log in to continue",
    "Invalid credentials": "Incorrect email or password",
    "Email already exists": "An account with this email already exists",
    "Invalid token": "Your session has expired. Please log in again",
    "Rate limit exceeded":
      "You've reached the request limit. Please try again later",
    "Failed to generate summary":
      "Unable to generate summary. The video might be too long or content unclear",
  };

  return errorMap[error] || error || "An unknown error occurred";
}
// User information type
export interface UserInfo {
  id: string;
  email: string;
  name: string;
  token: string;
  expiresAt: number;
  plan: string;
  createdAt: string;
}

// Summary type
export interface Summary {
  id?: string;
  title: string;
  keyPoints: string[];
  fullSummary: string;
  source?: string;
  sourceUrl?: string;
  videoId?: string;
  createdAt?: string;
}

// Generic API response type
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// Transcript segment type
export interface TranscriptSegment {
  timestamp: string;
  text: string;
}

/**
 * Get stored authentication token from Chrome storage
 * @returns Promise resolving to the token or null if not found/expired
 */
export async function getAuthToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["knuggetUserInfo"], (result) => {
      if (result.knuggetUserInfo) {
        const userInfo = result.knuggetUserInfo as UserInfo;

        // Check if token is expired (with 5-minute buffer)
        if (userInfo.expiresAt < Date.now() + 300000) {
          // Try to refresh token if it's expired or about to expire
          refreshToken(userInfo.token)
            .then((response) => {
              if (response.success && response.data) {
                resolve(response.data.token);
              } else {
                resolve(null);
              }
            })
            .catch(() => resolve(null));
        } else {
          resolve(userInfo.token);
        }
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Check if user is logged in
 * @returns Promise resolving to boolean indicating login status
 */
export async function isUserLoggedIn(): Promise<boolean> {
  const token = await getAuthToken();
  return token !== null;
}

/**
 * Generic API request function with improved error handling and retry logic
 * @param endpoint API endpoint
 * @param method HTTP method
 * @param data Request data (optional)
 * @param requiresAuth Whether request requires authentication
 * @param retryCount Number of retries on failure (default: 1)
 * @returns Promise resolving to API response
 */
export async function apiRequest<T>(
  endpoint: string,
  method: string = "GET",
  data?: any,
  requiresAuth: boolean = false,
  retryCount: number = 1
): Promise<ApiResponse<T>> {
  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Add auth token if required
    if (requiresAuth) {
      const token = await getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    // Make the request
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    // Handle network errors
    if (!response.ok) {
      // Check for token expiration (401)
      if (response.status === 401 && requiresAuth && retryCount > 0) {
        // Try to refresh token and retry
        const refreshedToken = await refreshAndGetToken();

        if (refreshedToken) {
          // Retry with new token
          return apiRequest<T>(
            endpoint,
            method,
            data,
            requiresAuth,
            retryCount - 1
          );
        }
      }

      // Get error from response if possible
      let errorMessage: string;
      try {
        const errorResponse = await response.json();
        errorMessage =
          errorResponse.error ||
          `Request failed with status ${response.status}`;
      } catch (jsonError) {
        errorMessage = `Request failed with status ${response.status}`;
      }

      return {
        success: false,
        error: errorMessage,
        status: response.status,
      };
    }

    // Parse the JSON response
    const result = await response.json();

    return {
      success: true,
      data: result,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      status: 0, // Network error or other client-side issue
    };
  }
}

/**
 * Refresh the authentication token
 * @param currentToken Current token to refresh
 * @returns Promise resolving to API response with new token
 */
async function refreshToken(
  currentToken: string
): Promise<ApiResponse<UserInfo>> {
  try {
    const response = await fetch(`${API_BASE_URL}${ENDPOINTS.REFRESH_TOKEN}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Token refresh failed with status ${response.status}`,
        status: response.status,
      };
    }

    const userData = await response.json();

    // Add expiresAt if it doesn't exist in the response
    if (!userData.expiresAt) {
      userData.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    }

    // Update stored user info
    chrome.storage.local.set({ knuggetUserInfo: userData });

    return {
      success: true,
      data: userData,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      status: 0,
    };
  }
}

/**
 * Refresh token and return the new token
 * @returns Promise resolving to new token or null if refresh failed
 */
async function refreshAndGetToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["knuggetUserInfo"], async (result) => {
      if (!result.knuggetUserInfo) {
        resolve(null);
        return;
      }

      const userInfo = result.knuggetUserInfo as UserInfo;
      const response = await refreshToken(userInfo.token);

      if (response.success && response.data) {
        resolve(response.data.token);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Login function
 * @param email User email
 * @param password User password
 * @returns Promise resolving to API response with user info
 */
export async function login(
  email: string,
  password: string
): Promise<ApiResponse<UserInfo>> {
  const response = await apiRequest<UserInfo>(
    ENDPOINTS.LOGIN,
    "POST",
    { email, password },
    false
  );

  if (response.success && response.data) {
    // Add expiresAt if it doesn't exist in the response
    if (!response.data.expiresAt) {
      response.data.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    }

    // Store user info in Chrome storage
    chrome.storage.local.set({ knuggetUserInfo: response.data });

    // Notify background script about login
    chrome.runtime.sendMessage({
      type: "AUTH_STATE_CHANGED",
      payload: { isLoggedIn: true },
    });
  }

  return response;
}

/**
 * Register function
 * @param email User email
 * @param password User password
 * @param name User name
 * @returns Promise resolving to API response with user info
 */
export async function register(
  email: string,
  password: string,
  name: string
): Promise<ApiResponse<UserInfo>> {
  const response = await apiRequest<UserInfo>(
    ENDPOINTS.REGISTER,
    "POST",
    { email, password, name },
    false
  );

  if (response.success && response.data) {
    // Add expiresAt if it doesn't exist in the response
    if (!response.data.expiresAt) {
      response.data.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    }

    // Store user info in Chrome storage
    chrome.storage.local.set({ knuggetUserInfo: response.data });

    // Notify background script about registration/login
    chrome.runtime.sendMessage({
      type: "AUTH_STATE_CHANGED",
      payload: { isLoggedIn: true },
    });
  }

  return response;
}

/**
 * Logout function
 * @returns Promise resolving to boolean indicating success
 */
export async function logout(): Promise<boolean> {
  try {
    // Remove user info from Chrome storage
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove(["knuggetUserInfo"], () => {
        resolve();
      });
    });

    // Notify background script about logout
    chrome.runtime.sendMessage({
      type: "AUTH_STATE_CHANGED",
      payload: { isLoggedIn: false },
    });

    return true;
  } catch (error) {
    console.error("Error during logout:", error);
    return false;
  }
}

/**
 * Get user profile
 * @returns Promise resolving to API response with user info
 */
export async function getUserProfile(): Promise<ApiResponse<UserInfo>> {
  return apiRequest<UserInfo>(ENDPOINTS.USER_PROFILE);
}

/**
 * Generate summary from transcript
 * @param content Transcript text
 * @param metadata Video metadata
 * @returns API response with summary
 */
export async function generateSummary(
  content: string,
  metadata: {
    videoId: string;
    title: string;
    url: string;
    channelName?: string;
  }
): Promise<ApiResponse<Summary>> {
  try {
    console.log("API: Generating summary", {
      metadata,
      contentLength: content.length,
    });

    const response = await apiRequest<Summary>(
      ENDPOINTS.SUMMARIZE,
      "POST",
      {
        content,
        metadata: {
          ...metadata,
          source: "youtube",
        },
      },
      true // ✅ This ensures token is attached via getAuthToken
    );

    console.log("API: Summary response", response);
    return response;
  } catch (error) {
    console.error("API: Error in generateSummary:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error generating summary",
      status: 500,
    };
  }
}

/**
 * Save a summary
 * @param summary Summary to save
 * @returns Promise resolving to API response with summary ID
 */
export async function saveSummary(
  summary: Summary
): Promise<ApiResponse<{ id: string }>> {
  return apiRequest<{ id: string }>(ENDPOINTS.SAVE_SUMMARY, "POST", summary);
}

/**
 * Get saved summaries
 * @param page Page number
 * @param limit Items per page
 * @returns Promise resolving to API response with summaries
 */
export async function getSavedSummaries(
  page: number = 1,
  limit: number = 10
): Promise<
  ApiResponse<{
    summaries: Summary[];
    total: number;
    page: number;
    limit: number;
  }>
> {
  return apiRequest<{
    summaries: Summary[];
    total: number;
    page: number;
    limit: number;
  }>(`${ENDPOINTS.SAVED_SUMMARIES}?page=${page}&limit=${limit}`);
}
