"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatInterface } from "@/components/shared/ChatInterface";
import { fetchWithAuth } from "@/lib/api";
import { 
  Search, 
  Bot, 
  Sparkles, 
  Plus,
  RotateCcw,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Agent {
  id: string;
  name: string;
  description?: string;
  model_provider?: string;
}

interface Conversation {
  id: string;
  thread_id: string;
  title: string;
  last_message?: string;
  updated_at: string;
}

export default function ChatPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch agents on mount
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetchWithAuth("/agents/");
        if (res.ok) {
          const data = await res.json();
          setAgents(data);
          if (data.length > 0) {
            setSelectedAgent(data[0]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch agents:", error);
      } finally {
        setIsLoadingAgents(false);
      }
    };
    fetchAgents();
  }, []);

  // Fetch threads for selected agent
  const fetchThreads = useCallback(async () => {
    if (!selectedAgent) return;
    setIsLoadingThreads(true);
    try {
      const res = await fetchWithAuth(`/chat/conversations?agent_id=${selectedAgent.id}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (error) {
      console.error("Failed to fetch threads:", error);
    } finally {
      setIsLoadingThreads(false);
    }
  }, [selectedAgent]);

  useEffect(() => {
    fetchThreads();
    setActiveThreadId(null); // Reset thread when changing agent
  }, [selectedAgent, fetchThreads]);

  const handleThreadCreated = (threadId: string, title: string) => {
    setActiveThreadId(threadId);
    fetchThreads(); // Refresh list
  };

  const filteredThreads = conversations.filter(t => 
    (t.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-white dark:bg-black">
      {/* Sidebar: Conversation History */}
      <div className="w-72 border-r bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col shrink-0 overflow-hidden">
        <div className="p-5 border-b bg-white/50 dark:bg-black/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black tracking-tight">Hội thoại</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-xl h-8 w-8 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
              onClick={() => setActiveThreadId(null)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Tìm kiếm..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-white/50 dark:bg-zinc-900/50 border-border/50 rounded-xl focus:ring-4 focus:ring-primary/5 transition-all text-xs font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {isLoadingThreads ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-14 rounded-2xl bg-muted/20 animate-pulse" />
            ))
          ) : filteredThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center opacity-30 px-4">
              <RotateCcw className="w-6 h-6 mb-3 text-muted-foreground" />
              <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">Không có lịch sử</p>
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <motion.button
                key={thread.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveThreadId(thread.thread_id)}
                className={cn(
                  "w-full text-left p-3 rounded-2xl transition-all duration-200 group relative border",
                  activeThreadId === thread.thread_id 
                    ? "bg-white dark:bg-zinc-900 border-border shadow-sm ring-1 ring-primary/5" 
                    : "bg-transparent border-transparent hover:bg-white/60 dark:hover:bg-zinc-900/60"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                    activeThreadId === thread.thread_id ? "bg-primary/5 border-primary/20 text-primary" : "bg-muted/50 border-border text-muted-foreground/60"
                  )}>
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-xs font-bold truncate tracking-tight mb-0.5",
                      activeThreadId === thread.thread_id ? "text-foreground" : "text-foreground/70"
                    )}>
                      {thread.title || "Hội thoại mới"}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-muted-foreground/50 uppercase">
                        {new Date(thread.updated_at).toLocaleDateString('vi-VN')}
                      </span>
                      <span className="text-[8px] font-medium text-muted-foreground/30 tabular-nums">
                        {new Date(thread.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.button>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative bg-white dark:bg-black overflow-hidden">
        {/* Top Header: Actions & Agent Selection */}
        <div className="h-16 px-8 border-b flex items-center justify-between bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl z-20">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
              <Zap className="w-4 h-4 text-primary fill-primary/20" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">WAO Chat</h3>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-muted/30 border border-border/20">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none">Agent:</span>
              <Select 
                value={selectedAgent?.id || ""} 
                onValueChange={(val) => setSelectedAgent(agents.find(a => a.id === val) || null)}
              >
                <SelectTrigger className="h-5 p-0 border-none bg-transparent shadow-none focus:ring-0 text-xs font-bold tracking-tight hover:text-primary transition-colors gap-2">
                  <span>{selectedAgent?.name || "Chọn Agent..."}</span>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/40 shadow-xl p-1">
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id} className="rounded-lg font-bold text-xs py-2 px-3 focus:bg-primary focus:text-white transition-all cursor-pointer mb-0.5">
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              variant="outline" 
              size="sm"
              className="rounded-xl h-9 px-4 font-bold text-xs gap-2 bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:scale-105 active:scale-95 transition-all shadow-md border-none" 
              onClick={() => setActiveThreadId(null)}
            >
              <Plus className="w-3.5 h-3.5" />
              Phiên mới
            </Button>
          </div>
        </div>

        {/* Chat Interface Container */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {selectedAgent ? (
              <motion.div 
                key={selectedAgent.id}
                initial={{ opacity: 0, scale: 0.99, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.01, y: -10 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="absolute inset-0"
              >
                <ChatInterface 
                  agentId={selectedAgent.id} 
                  agentName={selectedAgent.name}
                  threadId={activeThreadId}
                  onThreadCreated={handleThreadCreated}
                />
              </motion.div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center space-y-8 bg-zinc-50/20 dark:bg-zinc-900/20">
                <div className="w-24 h-24 rounded-[3rem] bg-primary/5 flex items-center justify-center border-2 border-dashed border-primary/20 animate-pulse">
                  <Sparkles className="w-10 h-10 text-primary opacity-30" />
                </div>
                <div className="space-y-3">
                  <h4 className="text-xl font-black tracking-tight">Sẵn sàng để bắt đầu?</h4>
                  <p className="text-sm text-muted-foreground/60 font-bold max-w-xs mx-auto">Vui lòng chọn hoặc tạo một Agent để bắt đầu phiên làm việc thông minh.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
