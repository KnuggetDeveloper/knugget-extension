import { decodeJWT } from './utils';

// Get authentication token from storage
export async function getAuthToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["knuggetUserInfo"], (result) => {
      if (result.knuggetUserInfo && result.knuggetUserInfo.token) {
        const userInfo = result.knuggetUserInfo;
        const token = userInfo.token;

        // Debug token info
        console.log("Token debug:", {
          tokenLength: token.length,
          tokenStart: token.substring(0, 10) + "...",
          isSupabaseToken: token.startsWith("eyJ"),
        });

        // Decode and log JWT payload (without showing sensitive data)
        const payload = decodeJWT(token);
        if (payload) {
          console.log("Token payload:", {
            aud: payload.aud,
            exp: payload.exp
              ? new Date(payload.exp * 1000).toLocaleString()
              : "none",
            sub: payload.sub ? payload.sub.substring(0, 5) + "..." : "none",
            role: payload.role,
            iss: payload.iss,
          });
        }

        resolve(token);
      } else {
        console.warn("No token found in storage");
        resolve(null);
      }
    });
  });
}

// Check if user is logged in
export async function isUserLoggedIn(): Promise<boolean> {
  const token = await getAuthToken();
  return !!token;
}