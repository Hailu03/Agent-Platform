"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Sparkles,
  RotateCcw,
  Loader2,
  X,
  User as UserIcon,
  ArrowUp,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/api";
import { useNotifications } from "@/hooks/use-notifications";
import { AuditModal } from "@/components/chat/AuditModal";
import { AgentArtifact, ArtifactRenderer } from "@/components/shared/ArtifactRenderer";

interface Message {
  role: "user" | "assistant";
  content?: string;
  thinking?: string;
  status?: string;
  done?: boolean;
  interrupt?: { message?: string } | null;
  audit?: Record<string, unknown>[];
  metrics?: Record<string, unknown>;
  artifacts?: AgentArtifact[];
}

function formatGuardrailsViolations(violations: { type: string; limit?: number; terms?: string[]; missing?: string[] }[] | undefined): string {
  if (!violations || violations.length === 0) {
    return "Output vi phạm Guardrails.";
  }

  return violations.map((violation) => {
    if (violation.type === "max_output_chars") {
      return `Vượt giới hạn ký tự (tối đa ${violation.limit}).`;
    }
    if (violation.type === "prohibited_terms") {
      const terms = (violation.terms || []).join(", ");
      return `Chứa từ/chuỗi bị cấm: ${terms}.`;
    }
    if (violation.type === "required_phrases") {
      const missing = (violation.missing || []).join(", ");
      return `Thiếu cụm bắt buộc: ${missing}.`;
    }
    if (violation.type === "max_input_chars") {
      return `Vượt giới hạn ký tự đầu vào (tối đa ${violation.limit}).`;
    }
    if (violation.type === "input_prohibited_terms") {
      const terms = (violation.terms || []).join(", ");
      return `Đầu vào chứa từ/chuỗi bị cấm: ${terms}.`;
    }
    if (violation.type === "input_required_phrases") {
      const missing = (violation.missing || []).join(", ");
      return `Đầu vào thiếu cụm bắt buộc: ${missing}.`;
    }
    return "Output vi phạm Guardrails.";
  }).join(" ");
}

interface ChatInterfaceProps {
  agentId: string | null;
  agentName?: string;
  threadId?: string | null;
  onThreadCreated?: (threadId: string, title: string) => void;
  isEmbed?: boolean;
  onClose?: () => void;
  showAudit?: boolean;
}

export function ChatInterface({ 
  agentId, 
  agentName, 
  threadId, 
  onThreadCreated, 
  isEmbed = false, 
  onClose,
  showAudit = true 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(threadId || null);
  const { addNotification } = useNotifications();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const skipNextHistoryFetch = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [activeMessageIndex, setActiveMessageIndex] = useState<number | null>(null);
  const [agentConfig, setAgentConfig] = useState<any>(null);

  useEffect(() => {
    const fetchAgentConfig = async () => {
      if (!agentId || !isEmbed) return;
      try {
        const res = await fetchWithAuth(`/agents/${agentId}`);
        if (res.ok) {
          const data = await res.json();
          setAgentConfig(data);
        }
      } catch (err) {
        console.error("Lỗi fetch agent config:", err);
      }
    };
    fetchAgentConfig();
  }, [agentId, isEmbed]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 192)}px`; // 192px = 12rem = max-h-48
    }
  }, [inputValue]);

  useEffect(() => {
    if (threadId !== currentThreadId) {
      const timeout = setTimeout(() => {
        setCurrentThreadId(threadId || null);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [threadId, currentThreadId]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (skipNextHistoryFetch.current) {
        skipNextHistoryFetch.current = false;
        return;
      }

      if (!currentThreadId) {
        setMessages([{ role: "assistant", content: `Chào bạn! Tôi là **${agentName || "AI Assistant"}**. Hãy đặt câu hỏi để chúng ta bắt đầu.`, done: true }]);
        return;
      }

      setIsLoadingHistory(true);
      try {
        const res = await fetchWithAuth(`/chat/history/${currentThreadId}`);
        if (res.ok) {
          const history = await res.json();
          setMessages(history.length > 0 ? history : [
            { role: "assistant", content: `Chào bạn! Tôi là **${agentName || "AI Assistant"}**. Hãy đặt câu hỏi để chúng ta bắt đầu.`, done: true }
          ]);
        }
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [currentThreadId, agentName]);

  const scrollToBottom = useCallback(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [shouldAutoScroll]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldAutoScroll(isAtBottom);
  };

  const handleChat = async (content: string, command: { approved: boolean } | null = null) => {
    if (!agentId) return;

    if (!command) {
      setMessages(prev => [...prev, { role: "user", content }]);
      setMessages(prev => [...prev, { role: "assistant", content: "", done: false, status: "" }]);
    } else {
      setMessages(prev => {
        const newMsgs = [...prev];
        const lastIdx = newMsgs.length - 1;
        if (lastIdx >= 0) {
          newMsgs[lastIdx] = { ...newMsgs[lastIdx], done: false, interrupt: null, status: "Đang phân tích..." };
        }
        return newMsgs;
      });
    }

    try {
      const response = await fetchWithAuth("/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          message: content,
          thread_id: currentThreadId,
          command: command
        })
      });

      if (!response.ok) throw new Error("Stream failed");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Giữ lại phần dở dang ở cuối

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

            const dataStr = trimmedLine.replace("data: ", "").trim();
            if (dataStr === "[DONE]") continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.thread_id && data.thread_id !== currentThreadId) {
                skipNextHistoryFetch.current = true;
                setCurrentThreadId(data.thread_id);
                if (onThreadCreated) {
                  onThreadCreated(data.thread_id, data.title || content);
                }
              }

              if (data.guardrails) {
                const guardrails = data.guardrails;
                const details = formatGuardrailsViolations(guardrails.violations);
                const isBlocked = guardrails.action === "block";
                const scopeLabel = guardrails.scope === "input" ? "đầu vào" : "đầu ra";

                addNotification(
                  isBlocked ? "error" : "warning",
                  isBlocked
                    ? `Guardrails chặn ${scopeLabel}`
                    : `Guardrails cảnh báo ${scopeLabel}`,
                  guardrails.message || details
                );

                setMessages(prev => {
                  const newMsgs = [...prev];
                  const lastIdx = newMsgs.length - 1;
                  if (lastIdx >= 0) {
                    const last = newMsgs[lastIdx];
                    newMsgs[lastIdx] = {
                      ...last,
                      ...(isBlocked ? { content: guardrails.message || "", done: true, status: "" } : {})
                    };
                  }
                  return newMsgs;
                });
                continue;
              }

              setMessages(prev => {
                const newMsgs = [...prev];
                const lastIdx = newMsgs.length - 1;
                if (lastIdx >= 0) {
                  const last = newMsgs[lastIdx];
                  newMsgs[lastIdx] = {
                    ...last,
                    ...(data.thinking !== undefined ? { thinking: (last.thinking || "") + data.thinking } : {}),
                    ...(data.content !== undefined ? { content: (last.content || "") + data.content } : {}),
                    ...(data.status !== undefined ? { status: data.status } : {}),
                    ...(data.interrupt ? { interrupt: data.interrupt, done: true } : {}),
                    ...(data.audit ? { audit: [...(last.audit || []), data.audit] } : {}),
                    ...(data.metrics ? { metrics: data.metrics } : {}),
                    ...(data.artifact ? { artifacts: [...(last.artifacts || []), data.artifact] } : {})
                  };
                }
                return newMsgs;
              });
            } catch (e) {
              console.error("Lỗi parse SSE data:", e, dataStr);
            }
          }
        }
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastIdx = newMsgs.length - 1;
          if (lastIdx >= 0 && !newMsgs[lastIdx].interrupt) {
            newMsgs[lastIdx] = { ...newMsgs[lastIdx], done: true, status: "" };
          }
          return newMsgs;
        });
      }
    } catch (error) {
      console.error(error);
      addNotification("error", "Lỗi kết nối", "Hệ thống gặp sự cố khi kết nối với Agent.");
    }
  };

  const handleResume = (approved: boolean) => {
    handleChat("", { approved });
  };

  return (
    <div className={cn(
      "flex flex-col overflow-hidden bg-[#fafafa] dark:bg-[#030303] relative",
      isEmbed
        ? "absolute inset-2 rounded-[1.5rem] border border-zinc-200/50 dark:border-white/[0.05] shadow-2xl"
        : "absolute inset-0"
    )}>
      {/* Dynamic Background Ambient Glows */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.12] dark:opacity-[0.25]">
        <div className="absolute -top-[30%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-primary/30 to-emerald-500/10 blur-[100px] animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute -bottom-[30%] -right-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-emerald-500/30 to-teal-500/10 blur-[100px] animate-pulse" style={{ animationDuration: "12s" }} />
      </div>

      {/* Premium Header Bar - Only show when embedded (e.g. in agent creation preview) */}
      {isEmbed && (
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white/70 dark:bg-zinc-950/70 backdrop-blur-2xl z-30 shrink-0 h-16 shadow-sm border-zinc-200/30 dark:border-white/[0.05]">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/10 to-emerald-500/5 flex items-center justify-center border border-primary/15 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-teal-500/10 opacity-30 group-hover:opacity-60 transition-opacity" />
                <Bot className="w-5 h-5 text-primary relative z-10" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-white dark:border-zinc-950 shadow-md shadow-primary/20" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-xs font-bold text-foreground/90 leading-tight truncate max-w-[200px] tracking-tight">
                {agentName || "AI Assistant"}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(22,163,74,0.5)]" />
                <span className="text-[8px] font-black text-primary uppercase tracking-widest leading-none">
                  Thử nghiệm
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-30">
            {messages.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl h-8 w-8 text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all"
                onClick={() => {
                  setMessages([{ role: "assistant", content: `Chào bạn! Tôi là **${agentName || "AI Assistant"}**. Hãy đặt câu hỏi để chúng ta bắt đầu.`, done: true }]);
                  setCurrentThreadId(null);
                }}
                title="Làm mới cuộc trò chuyện"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            )}

            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl h-8 w-8 bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200/40 dark:border-white/[0.05] backdrop-blur-md shadow-sm hover:bg-destructive hover:text-white transition-all"
                onClick={onClose}
                title="Đóng bản xem trước"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className={cn(
          "flex-1 overflow-y-auto custom-scrollbar transition-all duration-500 z-10",
          messages.length <= 1 ? "opacity-0 invisible" : "opacity-100 visible py-10 px-6 space-y-8",
          isEmbed && "mr-1"
        )}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className={cn(
                "flex gap-4 max-w-3xl mx-auto items-start",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* Avatar Core with subtle glows */}
              <div className="shrink-0 pt-0.5">
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shadow-md relative overflow-hidden border transition-all duration-300 hover:scale-105",
                  msg.role === "user"
                    ? "bg-gradient-to-br from-zinc-800 to-zinc-950 dark:from-zinc-100 dark:to-zinc-200 text-white dark:text-zinc-950 border-zinc-700/20 dark:border-zinc-300/20 shadow-md"
                    : "bg-white/70 dark:bg-zinc-900/70 border-primary/20 dark:border-primary/10 shadow-inner"
                )}>
                  {msg.role === "user" ? (
                    <UserIcon className="w-4 h-4" />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-teal-500/10 opacity-70 animate-pulse" />
                      <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-emerald-500/30 rounded-full blur-[4px] animate-spin" style={{ animationDuration: "12s" }} />
                      <Bot className="w-4 h-4 text-primary relative z-10" />
                    </>
                  )}
                </div>
              </div>

              {/* Message Bubble Column */}
              <div className={cn(
                "flex flex-col space-y-2 max-w-[85%]",
                msg.role === "user" ? "items-end text-right" : "items-start text-left"
              )}>
                {msg.status && !msg.done && (
                  <div className="flex items-center gap-2 text-[9px] text-primary font-black tracking-widest uppercase opacity-80 mb-1 ml-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(22,163,74,0.5)]" />
                    {msg.status}
                  </div>
                )}

                {msg.thinking && (
                  <ThinkingBlock content={msg.thinking} isDone={msg.done} />
                )}

                {msg.content && (
                  <div className={cn(
                    "p-4 rounded-[1.25rem] text-[13px] leading-relaxed shadow-[0_4px_12px_rgba(0,0,0,0.01)] dark:shadow-none relative",
                    msg.role === "user"
                      ? "bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 rounded-tr-none border border-zinc-800 dark:border-zinc-200 shadow-md"
                      : "bg-white/60 dark:bg-zinc-900/20 border border-zinc-200/50 dark:border-white/[0.04] backdrop-blur-xl rounded-tl-none relative overflow-hidden group"
                  )}>
                    {msg.role === "assistant" && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-primary to-emerald-600 opacity-60 rounded-l" />
                    )}

                    <div className="prose dark:prose-invert max-w-none prose-sm prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-white/5">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content || ""}
                      </ReactMarkdown>
                    </div>
                    
                    {msg.role === "assistant" && msg.done && idx > 0 && (
                      <div className="mt-4 pt-3 border-t border-zinc-200/30 dark:border-white/[0.04] flex items-center justify-between gap-4">
                        {/* Feedbacks Group */}
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                            title="Hữu ích"
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-zinc-400 hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all"
                            title="Không hữu ích"
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                            title="Thử lại"
                            onClick={() => handleChat(messages[idx-1].content || "")}
                          >
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                            title="Sao chép"
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content || "");
                              addNotification("success", "Đã sao chép", "Đã lưu vào bộ nhớ tạm.");
                            }}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>

                        {/* Audit Log Trigger */}
                        {showAudit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[9px] font-black uppercase tracking-wider text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all gap-1.5"
                            onClick={() => {
                              setActiveMessageIndex(idx);
                              setIsAuditOpen(true);
                            }}
                          >
                            <Activity className="w-3 h-3 text-primary" />
                            Console log
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {msg.artifacts && msg.artifacts.length > 0 && (
                  <div className="w-full space-y-3 mt-1 animate-in fade-in duration-300">
                    {msg.artifacts.map((artifact) => (
                      <ArtifactRenderer key={artifact.id} artifact={artifact} />
                    ))}
                  </div>
                )}

                {msg.interrupt && (
                  <div className="mt-4 p-5 rounded-2xl border border-primary/10 bg-primary/5 space-y-4 shadow-sm max-w-xs animate-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-4 h-4 text-primary animate-spin" style={{ animationDuration: "3s" }} />
                      <p className="text-[11px] font-extrabold text-foreground/80">{msg.interrupt.message || "Cần phê duyệt hành động"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleResume(true)} className="flex-1 rounded-xl h-8 text-[11px] font-extrabold bg-primary text-white shadow-lg shadow-primary/20 border-none">Đồng ý</Button>
                      <Button size="sm" variant="outline" onClick={() => handleResume(false)} className="flex-1 rounded-xl h-8 text-[11px] font-extrabold border-muted-foreground/20 hover:bg-secondary">Từ chối</Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </AnimatePresence>
      </div>

      {/* Dynamic Input Deck Area */}
      <div className={cn(
        "transition-all duration-700 px-6 z-10 shrink-0",
        messages.length <= 1
          ? "absolute inset-0 flex flex-col items-center justify-center bg-transparent"
          : "py-6 border-t bg-white/70 dark:bg-zinc-950/70 backdrop-blur-2xl border-zinc-200/40 dark:border-white/[0.04]"
      )}>
        {messages.length <= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className="text-center mb-6 space-y-4 px-4 w-full"
          >
            {isEmbed ? (
              // --- DEVELOPER SANDBOX PREVIEW WELCOME SCREEN ---
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-emerald-500/5 flex items-center justify-center border border-primary/20 shadow-xl mx-auto relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-teal-500/10 opacity-30 animate-pulse" />
                  <Activity className="w-6 h-6 text-primary animate-pulse" />
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-2xl font-black tracking-tight text-foreground/90 uppercase bg-gradient-to-r from-primary to-emerald-600 dark:from-primary dark:to-emerald-500 bg-clip-text text-transparent">
                    Agent Sandbox Playground
                  </h1>
                  <p className="text-muted-foreground/60 text-[9px] font-black leading-relaxed uppercase tracking-widest max-w-md mx-auto">
                    Khu vực thử nghiệm cấu hình. Kiểm thử ngay lập tức các thiết lập Prompt, RAG File và API Tools của bạn.
                  </p>
                </div>

                {/* Glassmorphic Diagnostics Active Config Card HUD */}
                <div className="p-4 rounded-2xl border border-zinc-200/50 dark:border-white/[0.04] bg-white/40 dark:bg-zinc-900/10 backdrop-blur-xl grid grid-cols-3 gap-4 text-left shadow-sm">
                  <div className="space-y-1">
                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest block">Mô hình</span>
                    <p className="text-xs font-bold text-foreground/80 truncate leading-snug">
                      {agentConfig?.model_name ? (
                        <span className="text-primary font-black uppercase text-[10px]">{agentConfig.model_name}</span>
                      ) : (
                        <span className="text-muted-foreground/40 font-medium">Sẵn sàng</span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1 border-l border-zinc-200/40 dark:border-white/[0.04] pl-4">
                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest block">Chỉ dẫn Prompt</span>
                    <p className="text-xs font-bold text-foreground/80 truncate leading-snug">
                      {agentConfig?.system_prompt ? (
                        <span>{agentConfig.system_prompt.length} ký tự</span>
                      ) : (
                        <span className="text-muted-foreground/40 font-medium">Hoạt động</span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1 border-l border-zinc-200/40 dark:border-white/[0.04] pl-4">
                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest block">Công cụ kết nối</span>
                    <p className="text-xs font-bold text-foreground/80 truncate leading-snug">
                      {agentConfig?.tools ? (
                        <span className="text-primary">{agentConfig.tools.length} active</span>
                      ) : (
                        <span className="text-muted-foreground/40 font-medium">Tích hợp</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Setup Testing Prompts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full mt-4">
                  {[
                    { text: "Hãy giới thiệu ngắn về vai trò và các chỉ dẫn nhiệm vụ mà bạn nhận được.", label: "Test Prompt", icon: Sparkles, desc: "Kiểm tra Persona chỉ dẫn" },
                    { text: "Kiểm tra hệ thống tri thức RAG: Tóm tắt thông tin từ các tệp tài liệu đã tải lên.", label: "Test RAG", icon: Activity, desc: "Kiểm tra dữ liệu huấn luyện" },
                    { text: "Kích hoạt thử nghiệm các công cụ đã tích hợp trong Agent để kiểm tra tham số.", label: "Test Tool", icon: Bot, desc: "Thử nghiệm API & Tooling" }
                  ].map((s, i) => (
                    <button
                      key={i}
                      disabled={!agentId}
                      onClick={() => {
                        if (agentId) {
                          setInputValue(s.text);
                          handleChat(s.text);
                          setInputValue("");
                        }
                      }}
                      className="group text-left p-4 rounded-2xl border border-zinc-200/50 dark:border-white/[0.04] bg-white/40 dark:bg-zinc-900/10 hover:bg-white/80 dark:hover:bg-zinc-900/40 hover:border-primary/30 dark:hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 backdrop-blur-xl relative overflow-hidden active:scale-[0.98] disabled:opacity-50"
                    >
                      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary transition-transform duration-300 group-hover:scale-110">
                          <s.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary leading-none">{s.label}</span>
                      </div>
                      <p className="text-xs font-bold text-foreground/80 group-hover:text-primary transition-colors line-clamp-1 mb-1 leading-snug">{s.text}</p>
                      <p className="text-[10px] text-muted-foreground/60 leading-normal font-medium">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // --- END-USER STANDARD CHAT WELCOME SCREEN ---
              <>
                {/* Pulsating Holographic AI Orb Core */}
                <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-primary/10 to-emerald-500/5 dark:from-primary/5 dark:to-emerald-500/0 flex items-center justify-center border border-primary/20 shadow-2xl mx-auto mb-4 relative overflow-hidden group hover:scale-105 transition-transform duration-300">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-teal-500/10 opacity-30 animate-pulse" />
                  <div className="absolute -inset-2 bg-gradient-to-tr from-primary/10 to-teal-500/10 rounded-full blur-[8px] animate-spin" style={{ animationDuration: "15s" }} />
                  <Bot className="w-8 h-8 text-primary relative z-10" />
                </div>
                <h1 className="text-3xl font-black tracking-tight text-foreground/90 uppercase bg-gradient-to-r from-primary to-emerald-600 dark:from-primary dark:to-emerald-500 bg-clip-text text-transparent">
                  {agentName || "AI Assistant"}
                </h1>
                <p className="text-muted-foreground/60 text-[10px] font-black max-w-sm mx-auto leading-relaxed uppercase tracking-widest">
                  Hệ thống trợ lý ảo chuyên dụng. Hãy chọn hành động hoặc nhập yêu cầu.
                </p>

                {/* Quick Action Prompt Starters Chips Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-2xl mx-auto mt-8 px-4">
                  {[
                    { text: "Tóm tắt & phân tích dữ liệu tệp này", label: "Phân Tích", icon: Sparkles, desc: "Trích xuất thông tin trọng tâm" },
                    { text: "Viết kịch bản tự động hóa quy trình", label: "Quy Trình", icon: Activity, desc: "Tạo các webhook trigger" },
                    { text: "Cấu hình tham số và kiểm tra công cụ", label: "Thiết Lập", icon: Bot, desc: "Tích hợp và kiểm thử API" }
                  ].map((s, i) => (
                    <button
                      key={i}
                      disabled={!agentId}
                      onClick={() => {
                        if (agentId) {
                          setInputValue(s.text);
                          handleChat(s.text);
                          setInputValue("");
                        }
                      }}
                      className="group text-left p-4 rounded-2xl border border-zinc-200/50 dark:border-white/[0.04] bg-white/40 dark:bg-zinc-900/10 hover:bg-white/80 dark:hover:bg-zinc-900/40 hover:border-primary/30 dark:hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 backdrop-blur-xl relative overflow-hidden active:scale-[0.98] disabled:opacity-50"
                    >
                      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary transition-transform duration-300 group-hover:scale-110">
                          <s.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary leading-none">{s.label}</span>
                      </div>
                      <p className="text-xs font-bold text-foreground/80 group-hover:text-primary transition-colors line-clamp-1 mb-1 leading-snug">{s.text}</p>
                      <p className="text-[10px] text-muted-foreground/60 leading-normal font-medium">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}

        <div className={cn(
          "relative w-full transition-all duration-500",
          messages.length <= 1 ? "max-w-xl" : "max-w-3xl mx-auto"
        )}>
          <div className={cn(
            "relative flex flex-col w-full bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl border border-zinc-200/50 dark:border-white/[0.05] rounded-[1.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.05)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.3)] transition-all focus-within:ring-4 focus-within:ring-primary/5 focus-within:border-primary/40 p-1.5",
            !agentId && "opacity-50 grayscale cursor-not-allowed"
          )}>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (inputValue.trim() && agentId) {
                    handleChat(inputValue);
                    setInputValue("");
                  }
                }
              }}
              placeholder="Gửi tin nhắn..."
              disabled={!agentId}
              className="w-full bg-transparent border-none focus:ring-0 py-3 px-4 pr-12 min-h-[50px] max-h-48 resize-none text-sm font-semibold custom-scrollbar text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
            
            <div className="absolute right-3.5 bottom-3.5 flex items-center gap-2">
              {isLoadingHistory && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
              <button
                disabled={!inputValue.trim() || !agentId}
                onClick={() => {
                  if (inputValue.trim() && agentId) {
                    handleChat(inputValue);
                    setInputValue("");
                  }
                }}
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-95 border-none outline-none",
                  inputValue.trim() && agentId
                    ? "bg-gradient-to-r from-primary to-emerald-600 dark:from-primary dark:to-emerald-500 text-white shadow-lg shadow-primary/25 cursor-pointer"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                )}
              >
                <ArrowUp className="w-4.5 h-4.5 stroke-[3] text-white dark:text-white" />
              </button>
            </div>
          </div>
        </div>

        {messages.length > 1 && (
          <p className="text-[9px] text-center mt-2.5 text-muted-foreground/30 font-bold uppercase tracking-widest animate-pulse">
            AI có thể phản hồi không chính xác. Hãy kiểm tra lại các thông tin quan trọng.
          </p>
        )}
      </div>

      {/* Audit Modal */}
      <AuditModal 
        isOpen={isAuditOpen} 
        onClose={() => {
          setIsAuditOpen(false);
          setActiveMessageIndex(null);
        }} 
        metrics={activeMessageIndex !== null ? messages[activeMessageIndex]?.metrics : null}
        auditData={activeMessageIndex !== null ? messages[activeMessageIndex]?.audit : []}
        isDone={activeMessageIndex !== null ? messages[activeMessageIndex]?.done : false}
      />
    </div>
  );
}

function ThinkingBlock({ content, isDone }: { content: string, isDone?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(!isDone);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsExpanded(!isDone);
    }, 0);
    return () => clearTimeout(timeout);
  }, [isDone]);

  return (
    <div className="mb-4 overflow-hidden animate-in fade-in duration-300">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/10 hover:border-primary/20 transition-all group shadow-sm active:scale-95 cursor-pointer"
      >
        <div className="relative flex h-2 w-2">
          {!isDone && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          )}
          <span className={cn("relative inline-flex rounded-full h-2 w-2", isDone ? "bg-primary/40" : "bg-primary")}></span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-primary">
          {isExpanded ? "Thu gọn phân tích suy nghĩ" : "Xem luồng suy nghĩ (RAG Chain)"}
        </span>
        {isDone && !isExpanded && (
          <span className="text-[9px] text-muted-foreground font-medium truncate max-w-[180px] opacity-40 italic">
            — {content.slice(0, 45)}...
          </span>
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="mt-2 text-[11px] font-mono p-4 bg-zinc-950 dark:bg-black/90 rounded-2xl border border-primary/15 text-emerald-400/90 whitespace-pre-wrap leading-relaxed shadow-2xl relative overflow-hidden">
              {/* Cybernetic Grid scanline overlay */}
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-30" />
              <div className="absolute top-2 right-3 flex gap-1.5 opacity-40 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500/85"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/85"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500/85"></span>
              </div>
              <div className="text-[9px] text-muted-foreground/60 border-b border-white/5 pb-1.5 mb-2 font-sans tracking-wide uppercase font-black flex items-center justify-between">
                <span>THINKING_ENGINE_CONSOLE</span>
                {!isDone && <span className="text-primary animate-pulse text-[8px]">ONLINE_STREAMING</span>}
              </div>
              {content}
              {!isDone && <span className="inline-block w-1.5 h-3 bg-emerald-400 ml-1 animate-pulse" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
