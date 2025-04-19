/**
 * Knugget AI Background Script
 * Handles events from content scripts and manages authentication state
 */

// Base URL for the Knugget website/app
// CHANGE: Updated to point to the correct server running on port 8000
const WEBSITE_BASE_URL = "http://localhost:8000";
const API_BASE_URL = "http://localhost:3000/api"; // Added separate API URL

// Record of open tabs that have the Knugget extension active
const activeTabsMap: Record<number, boolean> = {};

/**
 * Handle extension installation or update
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open onboarding page on install
    chrome.tabs.create({ url: `${WEBSITE_BASE_URL}/welcome?source=extension` });

    // Set default settings
    chrome.storage.local.set({
      knuggetSettings: {
        autoShowTranscript: true,
        darkMode: true,
        analyticsEnabled: true,
        version: chrome.runtime.getManifest().version,
      },
    });
  } else if (details.reason === "update") {
    // Check if it's a major update that needs attention
    const currentVersion = chrome.runtime.getManifest().version;
    const previousVersion = details.previousVersion || "";

    if (shouldShowUpdateNotice(currentVersion, previousVersion)) {
      // Show update notification
      chrome.notifications.create("update-notification", {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Knugget AI Updated",
        message: `Updated to version ${currentVersion} with new features and improvements!`,
        buttons: [{ title: "See What's New" }],
        priority: 2,
      });
    }

    // Update version in settings
    chrome.storage.local.get(["knuggetSettings"], (result) => {
      if (result.knuggetSettings) {
        chrome.storage.local.set({
          knuggetSettings: {
            ...result.knuggetSettings,
            version: currentVersion,
          },
        });
      }
    });
  }

  // Always check login status on install or update
  checkLoginFromWebsite();
});

/**
 * Handle notification clicks
 */
chrome.notifications.onButtonClicked.addListener(
  (notificationId, buttonIndex) => {
    if (notificationId === "update-notification" && buttonIndex === 0) {
      // Open changelog/what's new page
      chrome.tabs.create({
        url: `${WEBSITE_BASE_URL}/whats-new?version=${
          chrome.runtime.getManifest().version
        }`,
      });
    }
  }
);

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender.tab) {
    // Messages from extension popups or other extension pages
    if (message.type === "CHECK_AUTH_STATUS") {
      // Check both storage and cookies
      chrome.storage.local.get(["knuggetUserInfo"], (result) => {
        if (result.knuggetUserInfo) {
          // Check if token is expired
          const userInfo = result.knuggetUserInfo;
          const now = Date.now();

          if (userInfo.expiresAt && userInfo.expiresAt < now) {
            console.log("Token expired in storage, checking website");
            // Don't respond yet, check website first
            checkLoginFromWebsite().then(() => {
              // After website check, get the latest user info
              chrome.storage.local.get(["knuggetUserInfo"], (result) => {
                if (result.knuggetUserInfo) {
                  sendResponse({
                    isLoggedIn: true,
                    user: result.knuggetUserInfo,
                  });
                } else {
                  sendResponse({ isLoggedIn: false });
                }
              });
            });
          } else {
            // Token not expired, send it back
            sendResponse({ isLoggedIn: true, user: result.knuggetUserInfo });
          }
        } else {
          // Try to check website login
          checkLoginFromWebsite().then(() => {
            // After website check, get the latest user info
            chrome.storage.local.get(["knuggetUserInfo"], (result) => {
              if (result.knuggetUserInfo) {
                sendResponse({
                  isLoggedIn: true,
                  user: result.knuggetUserInfo,
                });
              } else {
                sendResponse({ isLoggedIn: false });
              }
            });
          });
        }
      });
      return true; // Keep message channel open for async response
    } else if (
      message.type === "AUTH_LOGIN_SUCCESS" ||
      message.type === "AUTH_SIGNUP_SUCCESS"
    ) {
      // Handle auth success message from login/signup pages
      if (message.payload) {
        chrome.storage.local.set({ knuggetUserInfo: message.payload }, () => {
          console.log("Auth data stored from direct message");
          broadcastAuthStateChange(true);
          sendResponse({ success: true });
        });
      }
      return true;
    } else if (message.type === "FORCE_CHECK_WEBSITE_LOGIN") {
      // Force check of website login status
      console.log("Forced check of website login requested");
      checkLoginFromWebsite().then(() => {
        // Check if we found a token
        chrome.storage.local.get(["knuggetUserInfo"], (result) => {
          const isLoggedIn = !!(
            result.knuggetUserInfo && result.knuggetUserInfo.token
          );
          console.log(
            "Forced website login check completed, isLoggedIn:",
            isLoggedIn
          );
          sendResponse({ success: true, isLoggedIn });
        });
      });
      return true;
    }

    // For other messages from non-tab contexts, return early
    return true;
  }

  // At this point we know sender.tab exists
  const tabId = sender.tab.id;

  // Make sure tabId is defined before using it
  if (typeof tabId !== "number") {
    console.error("Tab ID is undefined");
    return true;
  }

  switch (message.type) {
    case "PAGE_LOADED":
      activeTabsMap[tabId] = true;
      break;

    case "OPEN_LOGIN_PAGE":
      // Open login page in a new tab (include extension ID)
      chrome.tabs.create({
        url: `${WEBSITE_BASE_URL}/auth/login?source=extension&extensionId=${chrome.runtime.id}`,
      });
      break;

    case "OPEN_SIGNUP_PAGE":
      // Open signup page in a new tab (include extension ID)
      chrome.tabs.create({
        url: `${WEBSITE_BASE_URL}/auth/signup?source=extension&extensionId=${
          chrome.runtime.id
        }&referrer=${encodeURIComponent(message.payload?.url || "")}`,
      });
      break;

    case "OPEN_SAVED_SUMMARIES_PAGE":
      // Open saved summaries page in a new tab
      chrome.tabs.create({
        url: `${WEBSITE_BASE_URL}/summaries?source=extension`,
      });
      break;

    case "OPEN_SETTINGS":
      // Open settings page in a new tab
      chrome.tabs.create({
        url: `${WEBSITE_BASE_URL}/settings?source=extension`,
      });
      break;

    case "OPEN_FEEDBACK":
      // Open feedback page in a new tab
      chrome.tabs.create({
        url: `${WEBSITE_BASE_URL}/feedback?source=extension&url=${encodeURIComponent(
          message.payload?.url || ""
        )}`,
      });
      break;

    case "AUTH_STATE_CHANGED":
      // Broadcast auth state change to all active tabs
      Object.keys(activeTabsMap).forEach((id) => {
        const numId = parseInt(id, 10);
        if (activeTabsMap[numId]) {
          chrome.tabs
            .sendMessage(numId, {
              type: "AUTH_STATE_CHANGED",
              payload: message.payload,
            })
            .catch(() => {
              // Tab might be closed or not available anymore
              delete activeTabsMap[numId];
            });
        }
      });
      break;
    case "OPEN_SAVED_SUMMARIES_PAGE":
      // Open saved summaries page in a new tab
      chrome.tabs.create({
        url: `${WEBSITE_BASE_URL}/summaries?source=extension`,
      });
      break;

    case "OPEN_DASHBOARD":
      // Open dashboard page in a new tab
      chrome.tabs.create({
        url: `${WEBSITE_BASE_URL}/dashboard?source=extension`,
      });
      break;
  }

  return true;
});

/**
 * Handle tab close to clean up active tabs map
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeTabsMap[tabId]) {
    delete activeTabsMap[tabId];
  }
});

/**
 * Check if we should show an update notice
 * @param currentVersion Current extension version
 * @param previousVersion Previous extension version
 * @returns Boolean indicating if update notice should be shown
 */
function shouldShowUpdateNotice(
  currentVersion: string,
  previousVersion: string
): boolean {
  if (!previousVersion) return false;

  // Parse versions
  const current = parseVersion(currentVersion);
  const previous = parseVersion(previousVersion);

  // Show notice for major or minor version changes
  return (
    current.major > previous.major ||
    (current.major === previous.major && current.minor > previous.minor)
  );
}

/**
 * Parse version string into components
 * @param version Version string (e.g., "1.2.3")
 * @returns Object with major, minor, and patch components
 */
function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const parts = version.split(".").map((part) => parseInt(part, 10));

  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

/**
 * Check for token refresh on startup
 */
chrome.runtime.onStartup.addListener(() => {
  // First check if we already have login info in extension storage
  refreshTokenIfNeeded();

  // Then also check website cookies as a backup
  checkLoginFromWebsite();
});

// Also refresh token on extension load
refreshTokenIfNeeded();

/**
 * Refresh token if needed
 */
function refreshTokenIfNeeded() {
  // Check if token needs refresh
  chrome.storage.local.get(["knuggetUserInfo"], (result) => {
    if (result.knuggetUserInfo) {
      const userInfo = result.knuggetUserInfo;

      // Check if token is expired or about to expire
      if (userInfo.expiresAt < Date.now() + 300000) {
        // 5 minutes buffer
        refreshToken(userInfo.token, userInfo.refreshToken);
      } else {
        console.log("Token is still valid, no refresh needed");
        // Broadcast auth state change to all active tabs
        broadcastAuthStateChange(true);
      }
    } else {
      // No user info found, user is not logged in
      console.log("No user info found, user is not logged in");
      broadcastAuthStateChange(false);
    }
  });
}

/**
 * Refresh token
 */
function refreshToken(token: string, refreshToken: string) {
  console.log("Attempting to refresh token");

  if (!refreshToken) {
    console.error("No refresh token available");
    broadcastAuthStateChange(false);
    return;
  }

  // Use the website's API endpoint for token refresh
  fetch(`${WEBSITE_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  })
    .then((response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error(`Token refresh failed: ${response.status}`);
    })
    .then((data) => {
      console.log("Token refresh successful", data);

      // Update stored user info with new tokens
      chrome.storage.local.set({
        knuggetUserInfo: {
          ...data.user,
          token: data.token,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt || Date.now() + 24 * 60 * 60 * 1000,
        },
      });

      // Broadcast auth state change to all active tabs
      broadcastAuthStateChange(true);
    })
    .catch((error) => {
      console.error("Error refreshing token:", error);

      // Handle token refresh error - clear user info and broadcast logout
      chrome.storage.local.remove(["knuggetUserInfo"]);
      broadcastAuthStateChange(false);
    });
}

/**
 * Broadcast auth state change to all tabs
 */
function broadcastAuthStateChange(isLoggedIn: boolean) {
  // Broadcast auth state change to all active tabs
  Object.keys(activeTabsMap).forEach((id) => {
    const numId = parseInt(id, 10);
    if (activeTabsMap[numId]) {
      chrome.tabs
        .sendMessage(numId, {
          type: "AUTH_STATE_CHANGED",
          payload: { isLoggedIn },
        })
        .catch(() => {
          // Tab might be closed or not available anymore
          delete activeTabsMap[numId];
        });
    }
  });

  // Also refresh all YouTube tabs even if they're not in the activeTabsMap
  // This ensures that if a user logs in on the website, all YouTube tabs get refreshed
  if (isLoggedIn) {
    sendRefreshAuthToAllYouTubeTabs();
  }
}

// Listen for messages from web pages
chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    console.log("External message received:", message, "from:", sender.url);

    if (message.type === "KNUGGET_AUTH_SUCCESS") {
      // Validate payload
      if (!message.payload) {
        console.error("Empty payload received");
        sendResponse({ success: false, error: "Empty payload" });
        return true;
      }

      if (!message.payload.token) {
        console.error("No token in payload:", message.payload);
        sendResponse({ success: false, error: "No token provided" });
        return true;
      }

      if (
        !message.payload.id &&
        (!message.payload.user || !message.payload.user.id)
      ) {
        console.error("No user ID in payload:", message.payload);
        sendResponse({ success: false, error: "No user ID provided" });
        return true;
      }

      // Create a consistent user info object
      const userInfo = {
        id: message.payload.id || message.payload.user?.id,
        email: message.payload.email || message.payload.user?.email,
        name: message.payload.name || message.payload.user?.name || "",
        token: message.payload.token,
        refreshToken: message.payload.refreshToken || null,
        expiresAt:
          message.payload.expiresAt || Date.now() + 24 * 60 * 60 * 1000,
        credits: message.payload.credits || message.payload.user?.credits || 0,
        plan: message.payload.plan || message.payload.user?.plan || "free",
      };

      console.log("Storing user info from external message:", {
        id: userInfo.id,
        email: userInfo.email,
        tokenPresent: !!userInfo.token,
        tokenLength: userInfo.token ? userInfo.token.length : 0,
        expiresAt: new Date(userInfo.expiresAt).toISOString(),
      });

      // Store Supabase token and user info
      chrome.storage.local.set(
        {
          knuggetUserInfo: userInfo,
        },
        () => {
          if (chrome.runtime.lastError) {
            console.error("Error storing auth data:", chrome.runtime.lastError);
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }

          // Check if data was stored properly
          chrome.storage.local.get(["knuggetUserInfo"], (result) => {
            const success = !!result.knuggetUserInfo;
            console.log("Auth data stored:", success ? "Success" : "Failed");

            if (success) {
              // Broadcast auth change to all tabs
              broadcastAuthStateChange(true);

              // IMPROVED: Send a message to all YouTube tabs to refresh their auth state
              sendRefreshAuthToAllYouTubeTabs();

              // Send success response
              sendResponse({ success: true });
            } else {
              sendResponse({
                success: false,
                error: "Failed to store user data",
              });
            }
          });
        }
      );

      return true; // Keep the message channel open for async response
    } else if (message.type === "KNUGGET_CHECK_AUTH") {
      // Check if the user is authenticated and return status
      chrome.storage.local.get(["knuggetUserInfo"], (result) => {
        if (result.knuggetUserInfo) {
          sendResponse({
            isLoggedIn: true,
            userId: result.knuggetUserInfo.id,
            email: result.knuggetUserInfo.email,
          });
        } else {
          sendResponse({ isLoggedIn: false });
        }
      });
      return true;
    } else if (message.type === "KNUGGET_LOGOUT") {
      // Handle logout request from website
      chrome.storage.local.remove(["knuggetUserInfo"], () => {
        broadcastAuthStateChange(false);
        sendResponse({ success: true });
      });
      return true;
    } else if (message.type === "REFRESH_ALL_YOUTUBE_TABS") {
      console.log("Received request to refresh all YouTube tabs");
      sendRefreshAuthToAllYouTubeTabs();
      sendResponse({ success: true });
      return true;
    }

    // Default response for unhandled message types
    sendResponse({ success: false, error: "Unhandled message type" });
    return true;
  }
);

/**
 * Send refresh auth message to all YouTube tabs
 * This helps synchronize authentication state across tabs
 */
function sendRefreshAuthToAllYouTubeTabs() {
  chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        console.log(`Sending refresh auth message to YouTube tab: ${tab.id}`);
        chrome.tabs
          .sendMessage(tab.id, {
            type: "REFRESH_AUTH_STATE",
            payload: { forceCheck: true },
          })
          .catch((error) => {
            console.log(`Error sending message to tab ${tab.id}:`, error);
          });
      }
    }
  });
}

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Messages from tabs (content scripts)
  if (sender.tab) {
    const tabId = sender.tab.id;

    // Make sure tabId is defined before using it
    if (typeof tabId !== "number") {
      console.error("Tab ID is undefined");
      return true;
    }

    switch (message.type) {
      case "PAGE_LOADED":
        activeTabsMap[tabId] = true;
        break;

      case "OPEN_LOGIN_PAGE":
        // Open login page in a new tab (include extension ID)
        chrome.tabs.create({
          url: `${WEBSITE_BASE_URL}/auth/login?source=extension&extensionId=${
            chrome.runtime.id
          }${
            message.payload?.url
              ? `&referrer=${encodeURIComponent(message.payload.url)}`
              : ""
          }`,
        });
        break;

      case "OPEN_SIGNUP_PAGE":
        // Open signup page in a new tab (include extension ID)
        chrome.tabs.create({
          url: `${WEBSITE_BASE_URL}/auth/signup?source=extension&extensionId=${
            chrome.runtime.id
          }&referrer=${encodeURIComponent(message.payload?.url || "")}`,
        });
        break;

      case "OPEN_SAVED_SUMMARIES_PAGE":
        // Open saved summaries page in a new tab
        chrome.tabs.create({
          url: `${WEBSITE_BASE_URL}/summaries?source=extension`,
        });
        break;

      case "OPEN_SETTINGS":
        // Open settings page in a new tab
        chrome.tabs.create({
          url: `${WEBSITE_BASE_URL}/settings?source=extension`,
        });
        break;

      case "OPEN_FEEDBACK":
        // Open feedback page in a new tab
        chrome.tabs.create({
          url: `${WEBSITE_BASE_URL}/feedback?source=extension&url=${encodeURIComponent(
            message.payload?.url || ""
          )}`,
        });
        break;

      case "AUTH_STATE_CHANGED":
        // Broadcast auth state change to all active tabs
        broadcastAuthStateChange(message.payload?.isLoggedIn || false);
        break;

      case "OPEN_DASHBOARD":
        // Open dashboard page in a new tab
        chrome.tabs.create({
          url: `${WEBSITE_BASE_URL}/dashboard?source=extension`,
        });
        break;
    }
  }
  // Messages from extension pages (popup, etc.)
  else {
    if (message.type === "CHECK_AUTH_STATUS") {
      // Check both storage and cookies
      chrome.storage.local.get(["knuggetUserInfo"], (result) => {
        if (result.knuggetUserInfo) {
          // Check if token is expired
          const userInfo = result.knuggetUserInfo;
          if (userInfo.expiresAt && userInfo.expiresAt < Date.now()) {
            // Token is expired, try to refresh
            refreshToken(
              userInfo.token,
              userInfo.refreshToken || userInfo.token
            );
            // Still return what we have for now (refresh will update if needed)
            sendResponse({ isLoggedIn: true, user: userInfo });
          } else {
            // Token is valid
            sendResponse({ isLoggedIn: true, user: userInfo });
          }
        } else {
          // Try to check website login
          checkLoginFromWebsite();
          // We don't have auth info yet, so return false
          sendResponse({ isLoggedIn: false });
        }
      });
      return true; // Keep message channel open for async response
    } else if (
      message.type === "AUTH_LOGIN_SUCCESS" ||
      message.type === "AUTH_SIGNUP_SUCCESS"
    ) {
      // Handle auth success message from login/signup pages
      if (message.payload) {
        chrome.storage.local.set({ knuggetUserInfo: message.payload }, () => {
          console.log("Auth data stored from direct message");
          broadcastAuthStateChange(true);
          sendResponse({ success: true });
        });
      }
      return true;
    } else if (message.type === "FORCE_CHECK_WEBSITE_LOGIN") {
      // Force check of website login status
      console.log("Forced check of website login requested");
      checkLoginFromWebsite();
      sendResponse({ success: true });
      return true;
    }
  }

  return true;
});

// Add this function to check if the user is already logged in via website cookies
async function checkLoginFromWebsite() {
  try {
    console.log("Checking if user is already logged in via website");

    // First check all possible cookies from our domains
    console.log("Retrieving cookies from all possible domains");

    const urlsToCheck = [
      "http://localhost:8000",
      "http://localhost:3000",
      "http://localhost",
    ];

    let foundAuthToken = null;
    let foundRefreshToken = null;
    let allCookies: chrome.cookies.Cookie[] = [];

    // Check each URL domain for cookies
    for (const url of urlsToCheck) {
      console.log(`Checking cookies for domain: ${url}`);

      try {
        const cookies = await new Promise<chrome.cookies.Cookie[]>(
          (resolve) => {
            chrome.cookies.getAll({ url }, (cookies) => {
              resolve(cookies);
            });
          }
        );

        allCookies = [...allCookies, ...cookies];
        console.log(
          `Found ${cookies.length} cookies for ${url}:`,
          cookies.map((c) => c.name)
        );

        // Look for auth token with various possible names
        const possibleAuthNames = [
          "authToken",
          "auth_token",
          "access_token",
          "token",
          "sb-auth-token",
          "next-auth.session-token",
          "next-auth-token",
          "auth-token",
        ];
        const possibleRefreshNames = [
          "refreshToken",
          "refresh_token",
          "sb-refresh-token",
          "refresh-token",
        ];

        for (const cookie of cookies) {
          console.log(
            `Found cookie: ${cookie.name} = ${cookie.value.substring(0, 10)}...`
          );

          // If cookie name contains any auth-related words
          if (
            possibleAuthNames.includes(cookie.name) ||
            cookie.name.toLowerCase().includes("auth") ||
            cookie.name.toLowerCase().includes("token") ||
            cookie.name.toLowerCase().includes("session")
          ) {
            console.log(`Potential auth token found in cookie: ${cookie.name}`);
            foundAuthToken = cookie.value;
          }

          // If cookie name contains any refresh-related words
          if (
            possibleRefreshNames.includes(cookie.name) ||
            cookie.name.toLowerCase().includes("refresh")
          ) {
            console.log(
              `Potential refresh token found in cookie: ${cookie.name}`
            );
            foundRefreshToken = cookie.value;
          }
        }

        if (foundAuthToken) {
          console.log("Found auth token, breaking out of domain loop");
          break;
        }
      } catch (cookieError) {
        console.error(`Error getting cookies for ${url}:`, cookieError);
      }
    }

    // Debug all cookies found
    console.log(
      "All cookies found across domains:",
      allCookies.map((c) => c.name)
    );

    // If no auth token found in cookies, try a direct API call without a token
    if (!foundAuthToken) {
      console.log(
        "No auth token cookie found, trying direct API call with credentials"
      );

      try {
        // IMPROVED: Try using credentials in the request to use HTTP-only cookies
        const response = await fetch(`${WEBSITE_BASE_URL}/api/auth/me`, {
          method: "GET",
          credentials: "include", // Important to include cookies
        });

        if (response.ok) {
          const userData = await response.json();
          console.log("User is logged in via credentials/cookies:", userData);

          // Create a dummy token for extension (we'll use cookie auth)
          foundAuthToken = "session_token_via_cookies";

          // Store the user info in extension storage
          const userInfo = {
            id: userData.id,
            email: userData.email,
            name: userData.name || "",
            token: foundAuthToken,
            refreshToken: foundRefreshToken || null,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            credits: userData.credits || 0,
            plan: userData.plan || "free",
          };

          // Save to extension storage
          chrome.storage.local.set({ knuggetUserInfo: userInfo }, () => {
            console.log(
              "User login confirmed via credentials and saved to extension storage"
            );
            broadcastAuthStateChange(true);
          });

          return;
        } else {
          console.log("Not logged in via credentials:", response.status);

          // IMPROVED: Check status code to handle specific errors
          if (response.status === 401 || response.status === 403) {
            console.log("User is not authenticated on the website");
          } else {
            console.log(`Unexpected status code: ${response.status}`);
          }
        }
      } catch (credentialsError) {
        console.error("Error checking credentials login:", credentialsError);
      }

      // IMPROVED: Try API endpoint without credentials as a fallback
      try {
        console.log("Trying API endpoint without credentials as fallback");
        const response = await fetch(`${API_BASE_URL}/auth/me`);

        if (response.ok) {
          const userData = await response.json();
          console.log(
            "User appears to be logged in via API endpoint:",
            userData
          );

          // Create dummy token
          foundAuthToken = "api_token_without_credentials";

          // Store user info
          const userInfo = {
            id: userData.id,
            email: userData.email,
            name: userData.name || "",
            token: foundAuthToken,
            refreshToken: foundRefreshToken || null,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            credits: userData.credits || 0,
            plan: userData.plan || "free",
          };

          chrome.storage.local.set({ knuggetUserInfo: userInfo }, () => {
            console.log("User login confirmed via API endpoint");
            broadcastAuthStateChange(true);
          });

          return;
        } else {
          console.log("Not logged in via API endpoint:", response.status);
        }
      } catch (apiError) {
        console.error("Error checking API endpoint login:", apiError);
      }

      console.log(
        "No auth token cookie found in any domain and credentials check failed"
      );
      broadcastAuthStateChange(false);
      return;
    }

    console.log("Found auth token in cookies, checking validity");

    // Fetch the auth/me endpoint from the website to check login status
    try {
      const response = await fetch(`${WEBSITE_BASE_URL}/api/auth/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${foundAuthToken}`,
        },
      });

      if (response.ok) {
        // User is logged in on the website
        const userData = await response.json();
        console.log("User is confirmed logged in:", userData);

        // Store the user info in extension storage
        const userInfo = {
          id: userData.id,
          email: userData.email,
          name: userData.name || "",
          token: foundAuthToken,
          refreshToken: foundRefreshToken || null,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // Assume 24h validity if not specified
          credits: userData.credits || 0,
          plan: userData.plan || "free",
        };

        // Save to extension storage
        chrome.storage.local.set({ knuggetUserInfo: userInfo }, () => {
          console.log("User login confirmed and saved to extension storage");
          broadcastAuthStateChange(true);
        });
      } else {
        console.log(
          "Auth token invalid or expired, response:",
          response.status
        );
        chrome.storage.local.remove(["knuggetUserInfo"]);
        broadcastAuthStateChange(false);
      }
    } catch (fetchError) {
      console.error("Network error checking auth:", fetchError);
      broadcastAuthStateChange(false);
    }
  } catch (error) {
    console.error("Error checking website login:", error);
    broadcastAuthStateChange(false);
  }
}

// Run this check on initial extension load as well
setTimeout(checkLoginFromWebsite, 1000);

// Add a periodic check to ensure sync between website and extension
setInterval(checkLoginFromWebsite, 60000); // Check every minute
