// src/content-scripts/youtube/auth.ts
import { refreshToken } from "./api";
import { decodeJWT } from "./utils";

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

        // Decode and log JWT payload
        const payload = decodeJWT(token);
        if (payload) {
          console.log("Token payload details:", {
            exp: payload.exp
              ? new Date(payload.exp * 1000).toLocaleString()
              : "none",
            userId: payload.userId || payload.sub,
            // other important fields without exposing sensitive data
          });
        }

        // Check if token is expired or about to expire (5-minute buffer)
        if (userInfo.expiresAt && userInfo.expiresAt < Date.now() + 300000) {
          console.log("Token expired or about to expire, attempting refresh");
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
              console.warn("Token refresh failed:", refreshResult.error);
              resolve(null);
            }
          } catch (error) {
            console.error("Error refreshing token:", error);
            resolve(null);
          }
        } else {
          // Token valid and not about to expire
          resolve(token);
        }
      } else {
        console.warn("No token found in storage");

        // Force background script to check website cookies
        console.log("Asking background script to check for website login...");
        chrome.runtime.sendMessage(
          { type: "FORCE_CHECK_WEBSITE_LOGIN" },
          () => {
            // After forcing website login check, try again once to get token
            setTimeout(() => {
              chrome.storage.local.get(["knuggetUserInfo"], (result) => {
                if (result.knuggetUserInfo && result.knuggetUserInfo.token) {
                  console.log("Found token after checking website login!");
                  resolve(result.knuggetUserInfo.token);
                } else {
                  console.log("Still no token after checking website login");
                  resolve(null);
                }
              });
            }, 1000); // Short delay to allow background to finish
          }
        );
      }
    });
  });
}

// Check if user is logged in
export async function isUserLoggedIn(): Promise<boolean> {
  const token = await getAuthToken();
  return !!token;
}
