// src/popup/popup.ts
/**
 * Knugget AI Popup Script
 * Manages the extension popup UI and interactions
 */

// Define user info interface
interface UserInfo {
  id: string;
  email: string;
  name: string;
  token: string;
  expiresAt: number;
  plan: string;
  credits: number;
}

document.addEventListener("DOMContentLoaded", function () {
  // Get elements
  const loginPrompt = document.getElementById("login-prompt");
  const userInfo = document.getElementById("user-info");
  const userName = document.getElementById("user-name");
  const userPlan = document.getElementById("user-plan");
  const userCredits = document.getElementById("user-credits");
  const statusMessage = document.getElementById("status-message");
  const statusIcon = document.getElementById("status-icon");

  // Get buttons
  const loginBtn = document.getElementById("login-btn");
  const signupBtn = document.getElementById("signup-btn");
  const accountBtn = document.getElementById("account-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const savedBtn = document.getElementById("saved-btn");
  const settingsBtn = document.getElementById("settings-btn");
  const feedbackBtn = document.getElementById("feedback-btn");
  const helpBtn = document.getElementById("help-btn");

  // Add debug button to the footer
  const footerElement = document.querySelector("footer");
  if (footerElement) {
    const debugButton = document.createElement("button");
    debugButton.className = "debug-btn";
    debugButton.textContent = "Debug Auth";
    debugButton.style.fontSize = "10px";
    debugButton.style.padding = "2px 5px";
    debugButton.style.marginLeft = "10px";
    debugButton.style.backgroundColor = "#333";
    debugButton.style.color = "#eee";
    debugButton.style.border = "none";
    debugButton.style.borderRadius = "3px";
    footerElement.appendChild(debugButton);

    debugButton.addEventListener("click", debugAuthStorage);
  }

  // Base URL for web app
  const WEB_APP_URL = "http://localhost:8000";

  // Update manifest version
  const versionElement = document.querySelector(".version");
  if (versionElement) {
    versionElement.textContent = `v${chrome.runtime.getManifest().version}`;
  }

  // Check if we're on a YouTube page
  checkCurrentTab();

  // Check authentication status
  checkAuthStatus();

  // Add button event listeners
  loginBtn?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_LOGIN_PAGE" });
  });

  signupBtn?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_SIGNUP_PAGE" });
  });

  accountBtn?.addEventListener("click", () => {
    openUrl(`${WEB_APP_URL}/account?source=extension`);
  });

  logoutBtn?.addEventListener("click", () => {
    logout();
  });

  savedBtn?.addEventListener("click", () => {
    openUrl(`${WEB_APP_URL}/summaries?source=extension`);
  });

  settingsBtn?.addEventListener("click", () => {
    openUrl(`${WEB_APP_URL}/settings?source=extension`);
  });

  feedbackBtn?.addEventListener("click", () => {
    openUrl(`${WEB_APP_URL}/feedback?source=extension`);
  });

  helpBtn?.addEventListener("click", () => {
    openUrl(`${WEB_APP_URL}/help?source=extension`);
  });

  /**
   * Check if we're on a YouTube page
   */
  function checkCurrentTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];

      if (currentTab && currentTab.url) {
        const url = new URL(currentTab.url);

        if (url.hostname.includes("youtube.com")) {
          if (url.pathname.includes("/watch")) {
            if (statusMessage)
              statusMessage.textContent = "Active on this YouTube video";
            if (statusIcon) statusIcon.className = "status-active";
          } else {
            if (statusMessage)
              statusMessage.textContent = "Navigate to a YouTube video";
            if (statusIcon) statusIcon.className = "status-inactive";
          }
        } else {
          if (statusMessage)
            statusMessage.textContent = "Only works on YouTube videos";
          if (statusIcon) statusIcon.className = "status-inactive";
        }
      }
    });
  }

  /**
   * Check user authentication status
   */
  function checkAuthStatus() {
    // First check local storage
    chrome.storage.local.get(["knuggetUserInfo"], (result) => {
      if (result.knuggetUserInfo) {
        const userInfo = result.knuggetUserInfo as UserInfo;

        // Check if token is expired
        if (userInfo.expiresAt < Date.now()) {
          console.log("Token expired, checking with background script");
          // Token is expired, ask background to refresh
          checkWithBackgroundScript();
          return;
        }

        // Show user info
        showUserInfo(userInfo);
      } else {
        // No user info in storage, check with background script
        checkWithBackgroundScript();
      }
    });
  }

  /**
   * Check auth status with background script
   */
  function checkWithBackgroundScript() {
    chrome.runtime.sendMessage({ type: "CHECK_AUTH_STATUS" }, (response) => {
      if (response && response.isLoggedIn && response.user) {
        console.log("Background script says user is logged in", response.user);
        showUserInfo(response.user);
      } else {
        console.log("Background script says user is not logged in");
        // Force background script to check website cookies
        chrome.runtime.sendMessage({ type: "FORCE_CHECK_WEBSITE_LOGIN" });
        showLoginPrompt();
      }
    });
  }

  /**
   * Show login prompt
   */
  function showLoginPrompt() {
    if (loginPrompt && userInfo) {
      loginPrompt.classList.remove("hidden");
      userInfo.classList.add("hidden");
    }
  }

  /**
   * Show user info
   * @param {UserInfo} user User info object
   */
  function showUserInfo(user: UserInfo) {
    // Update user name
    if (userName) userName.textContent = user.name || user.email || "User";

    // Update user plan
    if (userPlan) {
      userPlan.textContent = user.plan || "Free";
      if (user.plan && user.plan.toLowerCase() === "premium") {
        userPlan.style.backgroundColor = "#8950fc";
      } else {
        userPlan.style.backgroundColor = "#00b894";
      }
    }

    // Update user credits if element exists
    if (userCredits) {
      userCredits.textContent = `${user.credits || 0} credits`;
    }

    // Show user info section
    if (loginPrompt && userInfo) {
      loginPrompt.classList.add("hidden");
      userInfo.classList.remove("hidden");
    }
  }

  /**
   * Open URL in new tab
   * @param {string} url URL to open
   */
  function openUrl(url: string) {
    chrome.tabs.create({ url });
  }

  /**
   * Log out user
   */
  function logout() {
    chrome.storage.local.remove(["knuggetUserInfo"], () => {
      // Notify content scripts and background
      chrome.runtime.sendMessage({
        type: "AUTH_STATE_CHANGED",
        payload: { isLoggedIn: false },
      });

      // Update UI
      showLoginPrompt();
    });
  }

  /**
   * Debug function to check storage content
   */
  function debugAuthStorage() {
    chrome.storage.local.get(null, (result) => {
      console.log("All storage data:", result);

      // Create a modal to display the data
      const modal = document.createElement("div");
      modal.style.position = "fixed";
      modal.style.top = "0";
      modal.style.left = "0";
      modal.style.width = "100%";
      modal.style.height = "100%";
      modal.style.backgroundColor = "rgba(0,0,0,0.8)";
      modal.style.zIndex = "1000";
      modal.style.padding = "20px";
      modal.style.boxSizing = "border-box";
      modal.style.overflowY = "auto";
      modal.style.color = "white";
      modal.style.fontFamily = "monospace";

      // Add close button
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Close";
      closeBtn.style.position = "absolute";
      closeBtn.style.top = "10px";
      closeBtn.style.right = "10px";
      closeBtn.style.padding = "5px 10px";
      closeBtn.style.backgroundColor = "#333";
      closeBtn.style.border = "none";
      closeBtn.style.borderRadius = "3px";
      closeBtn.style.color = "white";
      closeBtn.addEventListener("click", () => {
        document.body.removeChild(modal);
      });
      modal.appendChild(closeBtn);

      // Add content
      const content = document.createElement("pre");
      content.textContent = JSON.stringify(result, null, 2);
      content.style.marginTop = "30px";
      modal.appendChild(content);

      // Add to body
      document.body.appendChild(modal);

      // If we have user info, check token validity
      if (result.knuggetUserInfo) {
        const userInfo = result.knuggetUserInfo;
        const now = Date.now();
        const expiry = new Date(userInfo.expiresAt);
        const isValid = userInfo.expiresAt > now;

        const tokenInfo = document.createElement("div");
        tokenInfo.style.marginTop = "15px";
        tokenInfo.style.padding = "10px";
        tokenInfo.style.backgroundColor = isValid
          ? "rgba(0,128,0,0.3)"
          : "rgba(255,0,0,0.3)";
        tokenInfo.style.borderRadius = "5px";
        tokenInfo.innerHTML = `
          <strong>Token Status:</strong> ${isValid ? "Valid" : "Expired"}<br>
          <strong>Current Time:</strong> ${new Date().toLocaleString()}<br>
          <strong>Expires At:</strong> ${expiry.toLocaleString()}<br>
          <strong>Time Left:</strong> ${
            isValid
              ? Math.floor((userInfo.expiresAt - now) / 1000 / 60) + " minutes"
              : "Expired"
          }
        `;
        modal.insertBefore(tokenInfo, content);
      }
    });
  }
});
