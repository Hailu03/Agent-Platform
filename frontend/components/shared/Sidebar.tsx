"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Bot, 
  Database, 
  GitBranch, 
  Plug2, 
  Wrench,
  Hammer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, FileText, Zap, Link2, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

const menuItems = [
  { name: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { name: "AI Agents", href: "/agents", icon: Bot },
  { name: "Knowledge", href: "/knowledge", icon: Database },
  { name: "Workflows", href: "/workflows", icon: GitBranch },
  { name: "Skills", href: "/skills", icon: Wrench },
  { name: "Connectors", href: "/connectors", icon: Plug2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    fetch("http://localhost:8000/api/v1/agents/", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAgents(data);
      })
      .catch(console.error);
  }, []);

  const toggleExpand = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const getSubItems = (type: "knowledge" | "skills" | "workflows" | "connectors"): SubItem[] => {
    const items: SubItem[] = [];
    agents.forEach(agent => {
      if (type === "knowledge" && agent.knowledge_files) {
        agent.knowledge_files.forEach((file: string) => {
          items.push({ 
            id: `${agent.id}-${file}`, 
            name: file.split("/").pop() || file, 
            agentName: agent.name,
            href: `/knowledge/${agent.id}`
          });
        });
      } else if (type === "skills" && agent.skills) {
        agent.skills.forEach((skill: string) => {
          items.push({ 
            id: `${agent.id}-${skill}`, 
            name: skill, 
            agentName: agent.name,
            href: `/skills/${agent.id}`
          });
        });
      } else if (type === "workflows" && agent.tools) {
        agent.tools.forEach((tool: string) => {
          items.push({ 
            id: `${agent.id}-${tool}`, 
            name: tool, 
            agentName: agent.name,
            href: `/workflows/${agent.id}`
          });
        });
      }
    });
    return items;
  };

  const menuItems: MenuItem[] = [
    { name: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
    { name: "AI Agents", href: "/agents", icon: Bot },
    { name: "Knowledge", href: "/knowledge", icon: Database, subItems: getSubItems("knowledge") },
    { name: "Workflows", href: "/workflows", icon: GitBranch },
    { name: "Skills", href: "/skills", icon: Wrench },
    { name: "Tools", href: "/tools", icon: Hammer },
    { name: "Connectors", href: "/connectors", icon: Plug2 },
  ];

  return (
    <aside className="w-64 border-r bg-card flex flex-col h-full sticky top-0 overflow-y-auto custom-scrollbar">
      {/* Brand Logo */}
      <div className="p-6">
        <Link href="/" className="flex items-center gap-3 font-bold text-2xl tracking-tighter group">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform duration-300">
            <span className="font-black text-xl leading-none pt-0.5">W</span>
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">WAO AI</span>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 space-y-1 pb-10">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const isExpanded = expanded[item.name];
          const hasSubItems = item.subItems && item.subItems.length > 0;

          return (
            <div key={item.name} className="space-y-1">
              <div 
                className={cn(
                  "flex items-center justify-between rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                )}
              >
                <Link href={item.href} className="flex items-center gap-3 flex-1 px-3 py-2.5">
                  <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "group-hover:text-primary")} />
                  <span className="font-bold text-[13px]">{item.name}</span>
                </Link>
                
                {hasSubItems && (
                  <button 
                    onClick={() => toggleExpand(item.name)}
                    className={cn(
                      "p-2 mr-1 rounded-lg transition-colors",
                      isActive ? "hover:bg-white/10" : "hover:bg-black/5"
                    )}
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                )}
              </div>

              <AnimatePresence>
                {isExpanded && hasSubItems && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden ml-4 pl-4 border-l border-muted-foreground/10 space-y-1 mt-1"
                  >
                    {item.subItems?.map((sub) => (
                      <Link
                        key={sub.id}
                        href={sub.href}
                        className="flex flex-col py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors group/sub"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-3 h-3 text-muted-foreground/50 group-hover/sub:text-primary transition-colors" />
                          <span className="text-[11px] font-bold text-muted-foreground group-hover/sub:text-foreground truncate max-w-[140px]">
                            {sub.name}
                          </span>
                        </div>
                        <span className="text-[9px] text-muted-foreground/50 font-medium ml-5 italic">
                          @{sub.agentName}
                        </span>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
