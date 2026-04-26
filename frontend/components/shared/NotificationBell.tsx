"use client";

import React from "react";
import { Bell, Trash2, CheckCircle, AlertCircle, Info, AlertTriangle, Clock } from "lucide-react";
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
  const { notifications, markAsRead, clearAll } = useNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success": return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case "error": return <AlertCircle className="w-4 h-4 text-destructive" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full relative hover:bg-primary/5 transition-all h-10 w-10">
          <Bell className={cn("w-6 h-6 transition-all", unreadCount > 0 ? "text-primary fill-primary/10" : "text-muted-foreground")} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-950 animate-in zoom-in duration-300 shadow-sm">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 rounded-2xl shadow-2xl overflow-hidden border-muted-foreground/10 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="font-bold text-sm">Thông báo</h3>
          {notifications.length > 0 && (
            <button 
              onClick={clearAll}
              className="text-[10px] font-bold text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Xóa tất cả
            </button>
          )}
        </div>
        
        <div className="max-h-96 overflow-y-auto custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Bell className="w-6 h-6 text-muted-foreground/30" />
              </div>
              <p className="text-xs text-muted-foreground font-medium">Chưa có thông báo mới nào</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id}
                onMouseEnter={() => !notif.read && markAsRead(notif.id)}
                className={cn(
                  "p-4 border-b last:border-b-0 hover:bg-muted/30 transition-all cursor-pointer relative group",
                  !notif.read && "bg-primary/5"
                )}
              >
                {!notif.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs leading-none mb-1", !notif.read ? "font-bold text-foreground" : "font-semibold text-muted-foreground")}>
                      {notif.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDistanceToNow(notif.timestamp, { addSuffix: true, locale: vi })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {notifications.length > 0 && (
          <div className="p-3 bg-muted/20 text-center border-t">
            <button className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">
              Xem tất cả thông báo
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
