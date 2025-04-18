/**
 * Knugget AI API Service
 * Handles all API communication with the backend server
 */

import { getAuthToken } from "./auth";

const API_BASE_URL = "http://localhost:3000/api";

const ENDPOINTS = {
  LOGIN: "/auth/signin",
  REGISTER: "/auth/signup",
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
    "DELETE",
    null,
    true // CHANGE: Added true to ensure auth token is sent
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
  return apiRequest<Summary>(
    `${ENDPOINTS.SAVED_SUMMARIES}/${summaryId}`,
    "GET",
    null,
    true
  );
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
    "Database error finding user":
      "Server error. Please try again later or contact support.",
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
  transcript?: string;
  alreadySaved?: boolean;
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
  requiresAuth: boolean = true, // Default to true for safer requests
  retryCount: number = 1
): Promise<ApiResponse<T>> {
  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Set default request options
    const requestInit: RequestInit = {
      method,
      headers,
      credentials: "include", // Always include credentials (cookies)
    };

    // Add auth token if available
    if (requiresAuth) {
      const token = await getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      } else if (requiresAuth) {
        // ✅ IMPROVED: More aggressive checking for website login
        console.log(
          "No token found but authentication required. Asking background script to check website login..."
        );

        // Wait for background script to check website login with timeout
        const loginCheckResult = await Promise.race([
          new Promise<boolean>((resolve) => {
            chrome.runtime.sendMessage(
              { type: "FORCE_CHECK_WEBSITE_LOGIN" },
              () => {
                console.log("Forced website login check completed");
                // Check if we got a token after the check
                chrome.storage.local.get(["knuggetUserInfo"], (result) => {
                  if (result.knuggetUserInfo && result.knuggetUserInfo.token) {
                    console.log("Token found after background check");
                    resolve(true);
                  } else {
                    console.log("No token found after background check");
                    resolve(false);
                  }
                });
              }
            );
          }),
          // Add a timeout to ensure we don't wait forever
          new Promise<boolean>((resolve) => {
            setTimeout(() => {
              console.log("Login check timeout reached");
              resolve(false);
            }, 3000);
          }),
        ]);

        if (loginCheckResult) {
          // We successfully found a token, get it and proceed
          const tokenAfterCheck = await getAuthToken();
          if (tokenAfterCheck) {
            console.log("Using token found after background check");
            headers["Authorization"] = `Bearer ${tokenAfterCheck}`;
          } else {
            console.warn("Token promised but not delivered");
            return {
              success: false,
              error: "Authentication required. Please log in.",
              status: 401,
            };
          }
        } else {
          // Still no token found
          console.warn(
            "Auth token required but not available for request:",
            endpoint
          );
          return {
            success: false,
            error: "Authentication required. Please log in.",
            status: 401,
          };
        }
      }
    }

    // Add request body if data provided
    if (data) {
      requestInit.body = JSON.stringify(data);
    }

    // Log request details for debugging
    console.log(`Making API request to: ${API_BASE_URL}${endpoint}`, {
      method,
      requiresAuth,
      hasAuthHeader: !!headers["Authorization"],
      includeCredentials: true,
    });

    // Make the request
    const response = await fetch(`${API_BASE_URL}${endpoint}`, requestInit);

    // Handle network errors
    if (!response.ok) {
      // Check for token expiration (401)
      if (response.status === 401 && requiresAuth && retryCount > 0) {
        console.log("Token expired, attempting refresh...");
        // ✅ IMPROVED: Try to refresh token and retry
        const refreshedToken = await refreshAndGetToken();

        if (refreshedToken) {
          console.log("Token refreshed successfully, retrying request");
          // Retry with new token
          return apiRequest<T>(
            endpoint,
            method,
            data,
            requiresAuth,
            retryCount - 1
          );
        } else {
          console.log("Token refresh failed, checking website login...");

          // Force background to check website cookies
          await new Promise<void>((resolve) => {
            chrome.runtime.sendMessage(
              { type: "FORCE_CHECK_WEBSITE_LOGIN" },
              () => {
                console.log("Forced website login check after refresh failure");
                resolve();
              }
            );
          });

          // Wait a bit for check to complete
          await new Promise((resolve) => setTimeout(resolve, 1500));

          // Get token after website check
          const tokenAfterWebsiteCheck = await getAuthToken();
          if (tokenAfterWebsiteCheck) {
            console.log(
              "Found token after website login check, retrying request"
            );
            return apiRequest<T>(
              endpoint,
              method,
              data,
              requiresAuth,
              retryCount - 1
            );
          } else {
            // All authentication attempts failed
            return {
              success: false,
              error: "Your session has expired. Please log in again.",
              status: 401,
            };
          }
        }
      }

      // Get error from response if possible
      let errorMessage: string;
      try {
        const errorResponse = await response.json();
        errorMessage =
          errorResponse.error ||
          `Request failed with status ${response.status}`;
        console.error("API request failed:", errorMessage, errorResponse);
      } catch (jsonError) {
        errorMessage = `Request failed with status ${response.status}`;
        console.error(
          "API request failed with no json response:",
          response.status
        );
      }

      return {
        success: false,
        error: errorMessage,
        status: response.status,
      };
    }

    // Parse the JSON response
    const result = await response.json();
    console.log("API request succeeded:", endpoint, result);

    return {
      success: true,
      data: result,
      status: response.status,
    };
  } catch (error) {
    console.error("API request error:", error);
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
export async function refreshToken(
  currentToken: string
): Promise<ApiResponse<UserInfo>> {
  try {
    const response = await fetch(`${API_BASE_URL}${ENDPOINTS.REFRESH_TOKEN}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ refreshToken: null }),
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
  try {
    console.log(`Attempting login for: ${email}`);

    const response = await apiRequest<UserInfo>(
      ENDPOINTS.LOGIN,
      "POST",
      { email, password },
      false // Authentication not required for login
    );

    console.log("Login response:", {
      success: response.success,
      hasData: !!response.data,
      error: response.error,
    });

    if (response.success && response.data) {
      // Store user info including token in Chrome storage
      chrome.storage.local.set({ knuggetUserInfo: response.data }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error storing user data:", chrome.runtime.lastError);
        } else {
          console.log("User data stored successfully");
        }
      });

      // Notify background script about login
      chrome.runtime.sendMessage({
        type: "AUTH_STATE_CHANGED",
        payload: { isLoggedIn: true },
      });
    }

    return response;
  } catch (err) {
    console.error("Login function error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown login error",
      status: 0,
    };
  }
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
  try {
    console.log(`Attempting registration for: ${email}`);

    const response = await apiRequest<UserInfo>(
      ENDPOINTS.REGISTER,
      "POST",
      { email, password, name },
      false // Authentication not required for registration
    );

    console.log("Registration response:", {
      success: response.success,
      hasData: !!response.data,
      error: response.error,
    });

    if (response.success && response.data) {
      // Store user info in Chrome storage
      chrome.storage.local.set({ knuggetUserInfo: response.data }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error storing user data:", chrome.runtime.lastError);
        } else {
          console.log("User data stored successfully");
        }
      });

      // Notify background script about registration
      chrome.runtime.sendMessage({
        type: "AUTH_STATE_CHANGED",
        payload: { isLoggedIn: true },
      });
    }

    return response;
  } catch (err) {
    console.error("Registration function error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown registration error",
      status: 0,
    };
  }
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
  return apiRequest<UserInfo>(ENDPOINTS.USER_PROFILE, "GET", null, true);
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

    const response = await apiRequest<any>(
      ENDPOINTS.SUMMARIZE,
      "POST",
      {
        content,
        metadata: {
          ...metadata,
          source: "youtube",
        },
      },
      true
    );

    console.log("API: Summary response", response);

    // If successful, ensure the response data has the expected structure
    if (response.success && response.data) {
      // Check if response.data contains the summary directly or needs to be extracted
      const summaryData = response.data.data || response.data;

      // Normalize the structure
      const normalizedSummary: Summary = {
        title: summaryData.title || metadata.title || "Video Summary",
        keyPoints: Array.isArray(summaryData.keyPoints)
          ? summaryData.keyPoints
          : [],
        fullSummary: summaryData.fullSummary || "No summary available.",
        alreadySaved: summaryData.alreadySaved || false, // Track save status
        id: summaryData.id, // Include ID if it exists (for already saved summaries)
        sourceUrl: summaryData.sourceUrl || metadata.url,
      };

      return {
        success: true,
        data: normalizedSummary,
        status: response.status,
      };
    }

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
): Promise<ApiResponse<{ id: string; alreadySaved: boolean }>> {
  console.log("API: Saving summary", {
    title: summary.title,
    videoId: summary.videoId,
    sourceUrl: summary.sourceUrl,
    hasTranscript: !!summary.transcript,
  });

  return apiRequest<{ id: string; alreadySaved: boolean }>(
    ENDPOINTS.SAVE_SUMMARY,
    "POST",
    summary,
    true
  );
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
  }>(
    `${ENDPOINTS.SAVED_SUMMARIES}?page=${page}&limit=${limit}`,
    "GET",
    null,
    true
  );
}
