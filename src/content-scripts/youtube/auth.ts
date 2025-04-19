// src/content-scripts/youtube/auth.ts - Improved authentication check
import { refreshToken } from "./api";
import { decodeJWT } from "./utils";

// More reliable authentication check
export async function isUserLoggedIn(): Promise<boolean> {
  console.log("Checking if user is logged in...");
  
  // First check local storage for token
  const storageCheckResult = await new Promise<boolean>((resolve) => {
    chrome.storage.local.get(["knuggetUserInfo"], (result) => {
      if (result.knuggetUserInfo && result.knuggetUserInfo.token) {
        const userInfo = result.knuggetUserInfo;
        // Check if token is expired
        if (userInfo.expiresAt && userInfo.expiresAt > Date.now()) {
          console.log("Found valid token in storage");
          resolve(true);
          return;
        }
        console.log("Token found in storage but expired");
      }
      resolve(false);
    });
  });

  if (storageCheckResult) {
    return true;
  }

  // If no valid token in storage, force background to check website cookies
  console.log("No valid token in storage, checking with website...");
  
  // Force background script to check website cookies
  const websiteCheckResult = await new Promise<boolean>((resolve) => {
    chrome.runtime.sendMessage({ type: "FORCE_CHECK_WEBSITE_LOGIN" }, (response) => {
      console.log("Website cookie check response:", response);
      
      // Short delay to allow time for storage to be updated
      setTimeout(() => {
        chrome.storage.local.get(["knuggetUserInfo"], (result) => {
          if (result.knuggetUserInfo && result.knuggetUserInfo.token) {
            console.log("Found token after checking website login");
            resolve(true);
          } else {
            console.log("No token found after checking website login");
            resolve(false);
          }
        });
      }, 1000);
    });
  });

  if (websiteCheckResult) {
    return true;
  }

  // As a final check, try a direct API call with credentials
  try {
    console.log("Making direct API call to check auth status...");
    const response = await fetch("http://localhost:3000/api/auth/me", {
      method: "GET",
      credentials: "include" // Important to include cookies
    });

    if (response.ok) {
      console.log("User is authenticated via direct API call");
      
      // Get user data
      const userData = await response.json();
      
      // Store in extension storage
      const userInfo = {
        id: userData.id,
        email: userData.email,
        name: userData.name || "",
        token: "direct_api_auth_token",
        refreshToken: null,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        credits: userData.credits || 0,
        plan: userData.plan || "free",
      };
      
      // Save to extension storage
      chrome.storage.local.set({ knuggetUserInfo: userInfo }, () => {
        console.log("User info saved to storage after direct API auth check");
      });
      
      return true;
    } else {
      console.log("User is not authenticated according to direct API call");
      return false;
    }
  } catch (error) {
    console.error("Error during direct API auth check:", error);
    return false;
  }
}

// Get authentication token from storage
export async function getAuthToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["knuggetUserInfo"], async (result) => {
      if (result.knuggetUserInfo && result.knuggetUserInfo.token) {
        const userInfo = result.knuggetUserInfo;
        const token = userInfo.token;

        // Log debug info
        console.log("Token info:", {
          tokenLength: token.length,
          tokenStart: token.substring(0, 10) + "...",
          isJWT: token.split(".").length === 3,
          expiresAt: userInfo.expiresAt
            ? new Date(userInfo.expiresAt).toISOString()
            : "none",
          expired: userInfo.expiresAt ? userInfo.expiresAt < Date.now() : false,
        });

        // Check if token is expired
        if (userInfo.expiresAt && userInfo.expiresAt < Date.now()) {
          console.log("Token expired, attempting refresh");
          try {
            const refreshResult = await refreshToken(token);
            if (
              refreshResult.success &&
              refreshResult.data &&
              refreshResult.data.token
            ) {
              console.log("Token refreshed successfully");
              resolve(refreshResult.data.token);
            } else {
              console.warn("Token refresh failed, checking website cookies");
              
              // Check website cookies after refresh failure
              chrome.runtime.sendMessage({ type: "FORCE_CHECK_WEBSITE_LOGIN" });
              
              // Check after a delay
              setTimeout(() => {
                chrome.storage.local.get(["knuggetUserInfo"], (result) => {
                  if (result.knuggetUserInfo && result.knuggetUserInfo.token) {
                    console.log("Found token after website check");
                    resolve(result.knuggetUserInfo.token);
                  } else {
                    console.log("No token found after website check");
                    resolve(null);
                  }
                });
              }, 1500);
            }
          } catch (error) {
            console.error("Error refreshing token:", error);
            resolve(null);
          }
        } else {
          // Token valid and not expired
          resolve(token);
        }
      } else {
        console.warn("No token found in storage");
        resolve(null);
      }
    });
  });
}