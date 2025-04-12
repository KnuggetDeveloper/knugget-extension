import { createClient } from "@supabase/supabase-js";
import { decodeJWT } from "./utils";

// Create and export the Supabase client
const supabaseUrl = "https://jljdlmxwynhnqaecyetm.supabase.co"; // Replace with your actual Supabase URL
const supabaseKey ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsamRsbXh3eW5obnFhZWN5ZXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwMzgwOTIsImV4cCI6MjA1OTYxNDA5Mn0.MgV3TN6xN4-7WqpQ7d6gFzbtLfx2pnMrwoasRxwbJB0"; // Replace with your actual Supabase key
export const supabase = createClient(supabaseUrl, supabaseKey);

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
