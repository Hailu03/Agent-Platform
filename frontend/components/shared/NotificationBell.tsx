"use client";

import { motion, AnimatePresence } from "framer-motion";
import React, { useRef } from "react";
import { Bell, Check, Trash2, CheckCircle, AlertCircle, Info, AlertTriangle, Clock, Loader2, Filter } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useNotifications, Notification } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

export function NotificationBell() {
  const { 
    notifications, 
    unreadCount, 
    markAllAsRead, 
    markAsRead,
    deleteNotification,
    loadMore, 
    hasMore, 
    isLoading,
    activeFilter,
    setActiveFilter
  } = useNotifications();
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success": return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case "error": return <AlertCircle className="w-4 h-4 text-destructive" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
      if (hasMore && !isLoading) {
        loadMore();
      }
    }
  };

  const filters = [
    { id: "all", label: "Tất cả" },
    { id: "unread", label: "Chưa đọc" },
    { id: "info", label: "Hệ thống" },
    { id: "warning", label: "Cảnh báo" }
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full relative hover:bg-primary/5 transition-all h-10 w-10 group">
          <motion.div
            animate={unreadCount > 0 ? {
              rotate: [0, -10, 10, -10, 10, 0],
            } : {}}
            transition={{
              duration: 0.5,
              repeat: unreadCount > 0 ? Infinity : 0,
              repeatDelay: 2
            }}
          >
            <Bell className={cn("w-5 h-5 transition-all", unreadCount > 0 ? "text-primary fill-primary/10" : "text-muted-foreground")} />
          </motion.div>
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-950 shadow-sm animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 p-0 rounded-2xl shadow-2xl overflow-hidden border-muted-foreground/10 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
        {/* Header */}
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm">Thông báo</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
                className="text-[10px] font-bold text-primary hover:text-primary/70 flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" /> Đọc tất cả
              </button>
            )}
          </div>
          
          {/* Tabs/Filters */}
          <div className="flex items-center gap-1 p-0.5 bg-muted/50 rounded-lg overflow-x-auto no-scrollbar">
            {filters.map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] font-bold transition-all whitespace-nowrap flex-1",
                  activeFilter === filter.id 
                    ? "bg-white dark:bg-zinc-800 text-primary shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Notifications List */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="max-h-[400px] overflow-y-auto custom-scrollbar min-h-[200px]"
        >
          {notifications.length === 0 && !isLoading ? (
            <div className="py-12 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Bell className="w-6 h-6 text-muted-foreground/30" />
              </div>
              <p className="text-xs text-muted-foreground font-medium">Chưa có thông báo nào</p>
            </div>
          ) : (
            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {notifications.map((notif) => (
                  <motion.div 
                    key={notif.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => {
                      if (!notif.read) {
                        markAsRead(notif.id);
                      }
                      if (notif.link) {
                        window.location.href = notif.link;
                      }
                    }}
                    className={cn(
                      "p-4 border-b last:border-b-0 hover:bg-muted/30 transition-all cursor-pointer relative group",
                      !notif.read && "bg-primary/[0.02]"
                    )}
                  >
                    {!notif.read && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}
                    
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <p className={cn("text-xs leading-none mb-1.5", !notif.read ? "font-bold text-foreground" : "font-semibold text-muted-foreground/80")}>
                          {notif.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                          {notif.message}
                        </p>
                        <div className="flex items-center gap-1 mt-2.5 text-[9px] text-muted-foreground/50 font-bold uppercase tracking-wider">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDistanceToNow(notif.timestamp, { addSuffix: true, locale: vi })}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons (Delete) */}
                    <div className="absolute right-2 top-4 opacity-0 group-hover:opacity-100 transition-all">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isLoading && (
                <div className="p-6 text-center flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Đang tải...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
