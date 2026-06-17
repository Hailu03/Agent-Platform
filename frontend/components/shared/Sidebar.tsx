"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Database, 
  GitBranch, 
  Plug2,
  DatabaseZap,
  ShieldCheck,
  ChevronDown, 
  ChevronRight, 
  FileText,
  Menu,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

interface SubItem {
  id: string;
  name: string;
  agentName: string;
  href: string;
}

interface MenuItem {
  name: string;
  href: string;
  icon: any;
  subItems?: SubItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (name: string) => {
    if (isCollapsed) return;
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState));
  };

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-collapsed");
    if (savedState !== null) {
      setIsCollapsed(JSON.parse(savedState));
    }
  }, []);

  const menuItems: MenuItem[] = [
    { name: "Hội thoại", href: "/chat", icon: MessageSquare },
    { name: "AI Agents", href: "/agents", icon: Bot },
    { name: "Knowledge", href: "/knowledge", icon: Database },
    { name: "Workflows", href: "/workflows", icon: GitBranch },
    { name: "Guardrails", href: "/guardrails", icon: ShieldCheck },
    { name: "Connection", href: "/connection", icon: Plug2 },
    { name: "Data Sources", href: "/data-sources", icon: DatabaseZap },
  ];

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isCollapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative h-screen bg-card border-r flex flex-col z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)]",
        "transition-colors duration-300"
      )}
    >
      {/* Header Section */}
      <div className={cn(
        "h-20 flex items-center mb-2 overflow-hidden shrink-0",
        isCollapsed ? "justify-center" : "justify-between pl-6 pr-2"
      )}>
        <Link href="/" className={cn("flex items-center gap-3 shrink-0", isCollapsed && "hidden")}>
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/25">
            <span className="font-black text-xl pt-0.5">W</span>
          </div>
          
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span 
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/60 whitespace-nowrap overflow-hidden"
              >
                WAO AI
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* Minimal Menu Toggle - Flush to right edge */}
        <button 
          onClick={toggleSidebar}
          className={cn(
            "p-2 text-muted-foreground hover:text-primary transition-colors shrink-0",
            isCollapsed && "mx-auto"
          )}
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 space-y-0.5 overflow-y-auto custom-scrollbar pt-2",
        isCollapsed ? "px-2" : "px-3"
      )}>
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const isItemExpanded = expanded[item.name];
          const hasSubItems = item.subItems && item.subItems.length > 0;

          return (
            <div key={item.name} className="relative">
              <Link
                href={item.href}
                className={cn(
                  "flex items-center rounded-xl transition-all duration-200 group overflow-hidden relative z-10",
                  isActive 
                    ? "text-primary font-black" 
                    : "text-muted-foreground hover:text-foreground",
                  isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2"
                )}
                title={isCollapsed ? item.name : ""}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-sidebar-bg"
                    className="absolute inset-0 bg-primary/10 dark:bg-primary/15 rounded-xl -z-10 border border-primary/10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                
                {isActive && !isCollapsed && (
                  <motion.div 
                    layoutId="active-sidebar-line" 
                    className="absolute left-0 top-[25%] bottom-[25%] w-[3px] bg-primary rounded-r-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}

                <div className="flex items-center justify-center shrink-0">
                  <item.icon className={cn(
                    "w-5 h-5 transition-transform duration-200 group-hover:scale-105",
                    isActive ? "text-primary" : "group-hover:text-primary/80"
                  )} />
                </div>

                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.span 
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="font-bold text-[13px] truncate whitespace-nowrap overflow-hidden flex-1"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>

                {hasSubItems && !isCollapsed && (
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      toggleExpand(item.name);
                    }}
                    className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md shrink-0"
                  >
                    {isItemExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                )}
              </Link>
            </div>
          );
        })}
      </nav>
    </motion.aside>
  );
}
