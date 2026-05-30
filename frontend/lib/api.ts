/**
 * Centralized API client with automatic token refresh
 */

let API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
if (typeof window !== "undefined" && API_URL.includes("localhost")) {
  API_URL = API_URL.replace("localhost", "127.0.0.1");
}

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRrefreshed(token: string) {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
}

export async function fetchWithAuth(endpoint: string, options: FetchOptions = {}): Promise<Response> {
  let token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  
  let response = await fetch(url, { ...options, headers, credentials: "include" });

  // Handle 401 Unauthorized - Attempt Token Refresh
  if (response.status === 401 && typeof window !== "undefined") {
    // If we're already refreshing, wait for it to complete
    if (isRefreshing) {
      return new Promise<Response>((resolve) => {
        subscribeTokenRefresh((newToken) => {
          const newHeaders = {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          };
          resolve(fetch(url, { ...options, headers: newHeaders, credentials: "include" }));
        });
      });
    }

    isRefreshing = true;
    console.log("Token expired, attempting refresh...");
    
    try {
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include"
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        const newToken = data.access_token;
        
        localStorage.setItem("access_token", newToken);
        isRefreshing = false;
        onRrefreshed(newToken);
        
        const newHeaders = {
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
        };
        
        return await fetch(url, { ...options, headers: newHeaders, credentials: "include" });
      } else {
        isRefreshing = false;
        console.error("Refresh failed, logging out...");
        localStorage.removeItem("access_token");
        
        // If we're on a page that requires auth, redirect to login
        if (window.location.pathname !== "/" && window.location.pathname !== "/login") {
          window.location.href = "/?session_expired=true";
        }
      }
    } catch (error) {
      isRefreshing = false;
      console.error("Error during token refresh:", error);
    }
  }

  return response;
}
