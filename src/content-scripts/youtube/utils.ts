// Waits for a DOM element to appear
export const waitForElement = (
    selector: string,
    timeout = 10000
  ): Promise<Element> => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start >= timeout) return reject(`Timeout: ${selector}`);
        requestAnimationFrame(check);
      };
      check();
    });
  };
  
  // Clicks an element programmatically (invisible click)
  export const invisibleClick = (element: Element) => {
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
  };
  
  // Helper to decode and inspect JWT payload
  export function decodeJWT(token: string): any {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        console.error("Invalid JWT format");
        return null;
      }
  
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
  
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("Error decoding JWT:", e);
      return null;
    }
  }
  
  // Function to debug auth storage
  export function debugAuthStorage() {
    chrome.storage.local.get(["knuggetUserInfo"], (result) => {
      console.log("Current knuggetUserInfo in storage:", result.knuggetUserInfo);
  
      if (result.knuggetUserInfo) {
        // Check token expiration
        const expiresAt = result.knuggetUserInfo.expiresAt;
        const now = Date.now();
        console.log("Token expires at:", new Date(expiresAt).toLocaleString());
        console.log("Current time:", new Date(now).toLocaleString());
        console.log("Token expired:", expiresAt < now);
  
        // Check token validity
        const token = result.knuggetUserInfo.token;
        console.log("Token exists:", !!token);
      } else {
        console.log("No user info found in storage");
      }
    });
  }