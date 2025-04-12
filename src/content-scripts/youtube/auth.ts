import { createClient } from "@supabase/supabase-js";
import { decodeJWT } from "./utils";

// Create and export the Supabase client
// CHANGE: Make sure URL and key are correctly separated
const supabaseUrl = "https://uvtielapvtvoawwhvdmu.supabase.co"; 
const supabaseKey ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2dGllbGFwdnR2b2F3d2h2ZG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0Njg0NDksImV4cCI6MjA2MDA0NDQ0OX0.eHCDbrK5vQ49zomohchnv0ObqCmN5keJIVS2xNI7I7Q"; 

// CHANGE: Added better error handling for Supabase client creation
let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log("Supabase client initialized successfully");
} catch (error) {
  console.error("Failed to initialize Supabase client:", error);
  // Create a minimal client that will show proper errors
  supabase = {
    auth: {
      getUser: () => Promise.reject(new Error("Supabase client initialization failed")),
      signInWithPassword: () => Promise.reject(new Error("Supabase client initialization failed")),
      signUp: () => Promise.reject(new Error("Supabase client initialization failed")),
    }
  };
}

export { supabase };

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
          expiresAt: userInfo.expiresAt ? new Date(userInfo.expiresAt).toISOString() : "none",
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