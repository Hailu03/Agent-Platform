/**
 * Centralized API client with automatic token refresh
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export async function fetchWithAuth(endpoint: string, options: FetchOptions = {}) {
  let token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  
  let response = await fetch(url, { ...options, headers });

  // Handle 401 Unauthorized - Attempt Token Refresh
  if (response.status === 401 && typeof window !== "undefined") {
    console.log("Token expired, attempting refresh...");
    
    try {
      // Call the refresh endpoint (which uses the HttpOnly refresh_token cookie)
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        const newToken = data.access_token;
        
        localStorage.setItem("access_token", newToken);
        
        // Retry the original request with the new token
        const newHeaders = {
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
        };
        
        return await fetch(url, { ...options, headers: newHeaders });
      } else {
        // Refresh failed, clear token and redirect
        console.error("Refresh failed, logging out...");
        localStorage.removeItem("access_token");
        // We don't necessarily want to force a reload here, 
        // the caller can handle the 401
      }
    } catch (error) {
      console.error("Error during token refresh:", error);
    }
  }

  return response;
}
