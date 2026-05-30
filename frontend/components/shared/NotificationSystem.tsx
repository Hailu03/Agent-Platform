"use client";

import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from "react";
import { X, Info, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/api";
import { Notification, NotificationType } from "@/hooks/use-notifications";

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (type: NotificationType, title: string, message: string) => void;
  markAllAsRead: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all"); // all, unread, success, error, info
  const sseConnectedRef = useRef(false);

  // 1. Fetch notifications with filter
  const fetchNotifications = useCallback(async (isLoadMore = false) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      setCursor(null);
      setHasMore(false);
      return;
    }

    setIsLoading(true);
    try {
      let url = `/notifications/?limit=20`;
      if (isLoadMore && cursor) url += `&cursor=${cursor}`;
      if (activeFilter === "unread") url += `&unread_only=true`;
      else if (activeFilter !== "all") url += `&type=${activeFilter}`;

      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        const items = data.items.map((n: any) => ({ 
          ...n, 
          timestamp: new Date(n.created_at), 
          read: n.is_read 
        }));
        
        if (isLoadMore) {
          setNotifications(prev => [...prev, ...items]);
        } else {
          setNotifications(items);
        }
        
        setUnreadCount(data.unread_count);
        setCursor(data.next_cursor);
        setHasMore(!!data.next_cursor);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, cursor]);

  // Initial fetch and fetch on filter change
  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    fetchNotifications(false);
  }, [activeFilter]);

  // 2. Load more
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || !cursor) return;
    await fetchNotifications(true);
  }, [fetchNotifications, hasMore, isLoading, cursor]);

  // 3. Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/notifications/mark-all-read", { method: "POST" });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, []);

  // 4. Mark single as read
  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    try {
      await fetchWithAuth(`/notifications/${id}/read`, { method: "PATCH" });
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  }, []);

  // 5. Delete notification
  const deleteNotification = useCallback(async (id: string) => {
    try {
      const res = await fetchWithAuth(`/notifications/${id}`, { method: "DELETE" });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  }, []);

  // 6. Setup SSE
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token || sseConnectedRef.current) return;

    let API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
    if (typeof window !== "undefined" && API_URL.includes("localhost")) {
      API_URL = API_URL.replace("localhost", "127.0.0.1");
    }
    const eventSource = new EventSource(`${API_URL}/notifications/stream?token=${token}`);
    sseConnectedRef.current = true;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const newNotif: Notification = {
          ...data,
          timestamp: new Date(data.created_at),
          read: false
        };
        
        // Cập nhật danh sách nếu phù hợp với bộ lọc hiện tại
        if (activeFilter === "all" || activeFilter === "unread" || activeFilter === newNotif.type) {
          setNotifications(prev => [newNotif, ...prev]);
        }
        setUnreadCount(prev => prev + 1);
        
        // Show Toast
        setToasts(prev => [...prev, newNotif]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== newNotif.id));
        }, 4000);

      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE Error:", error);
      eventSource.close();
      sseConnectedRef.current = false;
    };

    return () => {
      eventSource.close();
      sseConnectedRef.current = false;
    };
  }, [activeFilter]);

  const addNotification = useCallback((type: NotificationType, title: string, message: string) => {
    const newNotif: Notification = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
    };
    setToasts((prev) => [...prev, newNotif]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newNotif.id));
    }, 4000);
  }, []);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      addNotification, 
      markAllAsRead, 
      markAsRead,
      deleteNotification,
      loadMore, 
      hasMore, 
      isLoading,
      activeFilter,
      setActiveFilter
    }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-72 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.95, transition: { duration: 0.2 } }}
              layout
              className={cn(
                "pointer-events-auto p-3 rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl flex gap-3 items-center relative overflow-hidden group",
                toast.type === "success" && "bg-white/80 dark:bg-emerald-950/20 border-emerald-500/20",
                toast.type === "error" && "bg-white/80 dark:bg-red-950/20 border-red-500/20",
                toast.type === "warning" && "bg-white/80 dark:bg-amber-950/20 border-amber-500/20",
                toast.type === "info" && "bg-white/80 dark:bg-blue-950/20 border-blue-500/20"
              )}
            >
              <div className={cn(
                "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center",
                toast.type === "success" && "bg-emerald-500/10 text-emerald-600",
                toast.type === "error" && "bg-red-500/10 text-red-600",
                toast.type === "warning" && "bg-amber-500/10 text-amber-600",
                toast.type === "info" && "bg-blue-500/10 text-blue-600"
              )}>
                {toast.type === "success" && <CheckCircle className="w-4 h-4" />}
                {toast.type === "error" && <AlertCircle className="w-4 h-4" />}
                {toast.type === "warning" && <AlertTriangle className="w-4 h-4" />}
                {toast.type === "info" && <Info className="w-4 h-4" />}
              </div>
              
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-[12px] font-bold text-foreground/90 leading-tight">{toast.title}</p>
                <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">{toast.message}</p>
              </div>

              <button 
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="absolute right-2 top-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted/50 transition-all"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}
