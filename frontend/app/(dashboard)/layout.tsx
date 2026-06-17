"use client";

import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";
import { NotificationProvider } from "@/components/shared/NotificationSystem";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isFullPage = pathname === "/chat" || (pathname && pathname.startsWith("/workflows/"));

  return (
    <NotificationProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className={cn(
            "flex-1 relative overflow-hidden",
            !isFullPage && "p-8 overflow-y-auto"
          )}>
            {children}
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}
