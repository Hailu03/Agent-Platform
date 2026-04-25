"use client";

import { Bell, Search, User, Settings, LogOut, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "./NotificationBell";
import { useNotifications } from "./NotificationSystem";
import { fetchWithAuth } from "@/lib/api";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ full_name: string; email: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    setMounted(true);
    const fetchUser = async () => {
      try {
        const resp = await fetchWithAuth("/auth/me");
        
        if (resp.ok) {
          const data = await resp.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
        setUser(null);
      }
    };

    fetchUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, { method: "POST" });
      localStorage.removeItem("access_token");
      addNotification("info", "Đã đăng xuất", "Hẹn gặp lại bạn sớm!");
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
      localStorage.removeItem("access_token");
      addNotification("warning", "Đăng xuất", "Đã đăng xuất (có lỗi hệ thống nhẹ)");
      router.push("/");
    }
  };

  return (
    <header className="h-16 border-b bg-card/80 backdrop-blur-md sticky top-0 z-10 px-8 flex items-center justify-between">
      <div className="flex-1 flex items-center gap-2 text-sm">
        <Link href="/dashboard" className="text-muted-foreground font-medium hover:text-primary transition-colors">WAO AI</Link>
        <span className="text-muted-foreground/40">/</span>
        <div className="flex items-center gap-2">
          {pathname.split("/").filter(Boolean).map((segment, index, array) => {
            const map: Record<string, string> = {
              "dashboard": "Tổng quan",
              "agents": "AI Agents",
              "create": "Thiết kế Agent",
              "knowledge": "Tri thức",
              "workflows": "Quy trình",
              "skills": "Kỹ năng",
              "tools": "Công cụ",
              "connectors": "Kết nối"
            };
            
            const label = map[segment] || segment;
            const href = "/" + array.slice(0, index + 1).join("/");
            const isLast = index === array.length - 1;

            return (
              <div key={href} className="flex items-center gap-2">
                {index > 0 && <span className="text-muted-foreground/40">/</span>}
                {isLast ? (
                  <span className="font-bold text-foreground capitalize">{label}</span>
                ) : (
                  <Link 
                    href={href} 
                    className="text-muted-foreground hover:text-primary transition-colors font-medium"
                  >
                    {label}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell />

        <div className="h-8 w-[1px] bg-border mx-2" />

        {/* User Profile Dropdown at Top Right */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="flex items-center gap-3 pl-2 cursor-pointer group hover:opacity-80 transition-opacity">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold leading-tight">
                  {!mounted 
                    ? "Khách" 
                    : (user ? user.full_name : (typeof window !== "undefined" && localStorage.getItem("access_token") ? "Đang tải..." : "Khách"))
                  }
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">{user?.email || "Chưa đăng nhập"}</p>
              </div>
              <Avatar className="h-10 w-10 border border-primary/20 group-hover:border-primary/50 transition-all shadow-sm">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {user?.full_name ? user.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "WAO"}
                </AvatarFallback>
              </Avatar>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-xl shadow-2xl mt-2 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl border border-white/20 animate-in fade-in slide-in-from-top-2 duration-200">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold leading-none">{user?.full_name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2 py-2.5 rounded-lg">
              <UserCircle className="w-4 h-4" />
              Cập nhật hồ sơ
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2 py-2.5 rounded-lg">
              <Settings className="w-4 h-4" />
              Cài đặt
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer gap-2 py-2.5 rounded-lg text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
