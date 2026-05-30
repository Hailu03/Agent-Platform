"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatInterface } from "@/components/shared/ChatInterface";
import { fetchWithAuth } from "@/lib/api";
import { 
  Search, 
  Bot, 
  Sparkles, 
  ChevronRight,
  ChevronLeft,
  Plus,
  RotateCcw,
  Zap,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  message?: string;
  role?: "user" | "assistant";
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
  
  // States for delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);

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
    setConversations(prev => {
      const exists = prev.find(c => c.thread_id === threadId);
      if (exists) {
        return prev.map(c => c.thread_id === threadId ? { ...c, title: title } : c);
      }

      const newConv: Conversation = {
        id: Math.random().toString(),
        thread_id: threadId,
        title: title,
        updated_at: new Date().toISOString()
      };
      return [newConv, ...prev];
    });
    // fetchThreads(); // Có thể gọi lại để đồng bộ hoàn toàn
  };

  const handleDeleteClick = (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    setThreadToDelete(threadId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!threadToDelete) return;
    
    try {
      const res = await fetchWithAuth(`/chat/conversations/${threadToDelete}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (activeThreadId === threadToDelete) {
          setActiveThreadId(null);
        }
        fetchThreads();
      }
    } catch (error) {
      console.error("Failed to delete thread:", error);
    } finally {
      setDeleteDialogOpen(false);
      setThreadToDelete(null);
    }
  };

  const handleUpdateTitle = async (threadId: string, newTitle: string) => {
    try {
      const res = await fetchWithAuth(`/chat/conversations/${threadId}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        fetchThreads();
      }
    } catch (error) {
      console.error("Failed to update title:", error);
    }
  };

  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [tempTitleValue, setTempTitleValue] = useState("");

  const filteredThreads = conversations.filter(t => 
    (t.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-full w-full overflow-hidden bg-white dark:bg-black">
      {/* Sidebar: Conversation History */}
      <AnimatePresence mode="popLayout">
        {isSidebarOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="border-r bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col shrink-0 overflow-hidden"
          >
            <div className="p-5 border-b bg-white/50 dark:bg-black/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black tracking-tight">Hội thoại</h2>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-xl h-8 w-8 bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
                  onClick={() => setIsSidebarOpen(false)}
                  title="Thu gọn sidebar"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
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
              <motion.div
                key={thread.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveThreadId(thread.thread_id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setActiveThreadId(thread.thread_id);
                  }
                }}
                className={cn(
                  "w-full text-left p-3 rounded-2xl transition-all duration-300 group relative border cursor-pointer select-none overflow-hidden",
                  activeThreadId === thread.thread_id 
                    ? "bg-white dark:bg-zinc-900/80 border-primary/20 shadow-md shadow-primary/5 ring-1 ring-primary/10" 
                    : "bg-transparent border-transparent hover:bg-white/60 dark:hover:bg-zinc-900/40"
                )}
              >
                {activeThreadId === thread.thread_id && (
                  <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-primary to-emerald-600 rounded-r animate-in fade-in slide-in-from-left duration-300" />
                )}
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                    activeThreadId === thread.thread_id ? "bg-primary/5 border-primary/20 text-primary" : "bg-muted/50 border-border text-muted-foreground/60"
                  )}>
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <p className={cn(
                      "text-xs font-bold truncate tracking-tight mb-0.5",
                      activeThreadId === thread.thread_id ? "text-foreground" : "text-foreground/70"
                    )}>
                      {thread.title || "Hội thoại mới"}
                    </p>
                    
                    {thread.message && (
                      <p className="text-[10px] text-muted-foreground/60 truncate mb-1.5 font-medium">
                        <span className="font-black text-primary/40 uppercase mr-1">
                          {thread.role === "assistant" ? "AI:" : "Bạn:"}
                        </span>
                        {thread.message}
                      </p>
                    )}
 
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
                
                {/* Delete Button - Visible on hover */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-all",
                    "hover:bg-destructive/10 hover:text-destructive text-muted-foreground/40"
                  )}
                  onClick={(e) => handleDeleteClick(e, thread.thread_id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            ))
          )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative bg-white dark:bg-black overflow-hidden">
        {/* Top Header: Actions & Agent Selection */}
        <div className="h-16 px-8 border-b flex items-center justify-between bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl z-20">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl h-9 w-9 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all mr-2"
                onClick={() => setIsSidebarOpen(true)}
                title="Mở sidebar"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            )}
            <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
              <Zap className="w-4 h-4 text-primary fill-primary/20" />
            </div>
            <div>
              {activeThreadId ? (
                <div className="flex flex-col">
                  {editingTitle === activeThreadId ? (
                    <Input
                      value={tempTitleValue}
                      onChange={(e) => setTempTitleValue(e.target.value)}
                      onBlur={() => {
                        if (tempTitleValue.trim() && tempTitleValue !== (conversations.find(c => c.thread_id === activeThreadId)?.title)) {
                          handleUpdateTitle(activeThreadId, tempTitleValue);
                        }
                        setEditingTitle(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (tempTitleValue.trim() && tempTitleValue !== (conversations.find(c => c.thread_id === activeThreadId)?.title)) {
                            handleUpdateTitle(activeThreadId, tempTitleValue);
                          }
                          setEditingTitle(null);
                        }
                        if (e.key === "Escape") setEditingTitle(null);
                      }}
                      autoFocus
                      className="h-8 text-base font-black p-0 border-none bg-transparent focus-visible:ring-0 min-w-[200px]"
                    />
                  ) : (
                    <h3 
                      className="text-base font-black tracking-tight cursor-pointer hover:text-primary transition-colors truncate max-w-[300px]"
                      onClick={() => {
                        setEditingTitle(activeThreadId);
                        setTempTitleValue(conversations.find(c => c.thread_id === activeThreadId)?.title || "");
                      }}
                    >
                      {conversations.find(c => c.thread_id === activeThreadId)?.title || "Hội thoại mới"}
                    </h3>
                  )}
                </div>
              ) : (
                <h3 className="text-base font-black tracking-tight">WAO Chat</h3>
              )}
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
              variant="default" 
              size="sm"
              className="rounded-xl h-9 px-4 font-black text-xs gap-2 bg-gradient-to-r from-primary to-emerald-600 dark:from-primary dark:to-emerald-500 hover:shadow-lg hover:shadow-primary/20 text-white hover:scale-105 active:scale-95 transition-all border-none" 
              onClick={() => setActiveThreadId(null)}
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
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
                  showAudit={false}
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
      
      {/* Delete Confirmation Modal */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-zinc-900">
          <div className="relative p-8">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-destructive/0 via-destructive/50 to-destructive/0" />
            
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-[2.5rem] bg-destructive/5 flex items-center justify-center border-2 border-dashed border-destructive/20">
                <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-destructive animate-pulse" />
                </div>
              </div>
              
              <div className="space-y-3">
                <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
                  Xác nhận xóa sạch?
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground/70 font-bold leading-relaxed px-4">
                  Hội thoại này sẽ bị xóa vĩnh viễn khỏi hệ thống, bạn không thể hoàn tác hành động này.
                </DialogDescription>
              </div>
            </div>
            
            <DialogFooter className="mt-10 flex gap-3 sm:gap-3 sm:justify-center">
              <Button
                variant="ghost"
                onClick={() => setDeleteDialogOpen(false)}
                className="flex-1 rounded-2xl h-12 font-bold text-sm hover:bg-muted transition-all active:scale-95"
              >
                Hủy bỏ
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                className="flex-1 rounded-2xl h-12 font-bold text-sm shadow-lg shadow-destructive/20 hover:scale-105 active:scale-95 transition-all bg-destructive text-white border-none"
              >
                Xác nhận xóa
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
