"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import { useNotifications } from "./use-notifications";

interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  is_google_connected: boolean;
  is_google_tool_connected: boolean;
  is_facebook_connected: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { addNotification } = useNotifications();

  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setLoading(false);
        return null;
      }

      const res = await fetchWithAuth("/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        return data;
      } else {
        // If 401 and refresh failed (handled in fetchWithAuth), clear user
        setUser(null);
        localStorage.removeItem("access_token");
        return null;
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/auth/logout`, { 
        method: "POST" 
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      localStorage.removeItem("access_token");
      setUser(null);
      addNotification("info", "Đã đăng xuất", "Hẹn gặp lại bạn sớm!");
      router.push("/");
    }
  };

  return {
    user,
    loading,
    logout,
    refreshUser: fetchUser,
    isAuthenticated: !!user || (typeof window !== "undefined" && !!localStorage.getItem("access_token")),
  };
}
