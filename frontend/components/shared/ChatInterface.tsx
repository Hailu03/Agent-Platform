"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Bot,
  Sparkles,
  RotateCcw,
  Loader2,
  ChevronRight,
  CheckCircle2,
  X,
  User as UserIcon,
  Zap,
  ArrowUp,
  Cpu,
  ThumbsUp,
  ThumbsDown,
  Copy,
  MessageSquare,
  Check,
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
  interrupt?: any;
  audit?: any[];
  metrics?: any;
  artifacts?: AgentArtifact[];
}

function formatGuardrailsViolations(violations: any[] | undefined): string {
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
      setCurrentThreadId(threadId || null);
    }
  }, [threadId]);

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

  const handleChat = async (content: string, command: any = null) => {
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
      "flex flex-col overflow-hidden bg-[#fafafa] dark:bg-[#050505]",
      isEmbed
        ? "absolute inset-2 rounded-[1.0rem] border border-border/50 shadow-2xl"
        : "absolute inset-0"
    )}>
      {/* Premium Header Bar - Only show when embedded (e.g. in agent creation preview) */}
      {isEmbed && (
        <div className={cn(
          "flex items-center justify-between px-6 py-4 border-b bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl z-30 shrink-0",
          "h-16"
        )}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950 shadow-sm" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-foreground leading-tight truncate max-w-[200px]">
                {agentName || "AI Assistant"}
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Thử nghiệm
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 1 && (
              <>

                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl h-9 w-9 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                  onClick={() => {
                    setMessages([{ role: "assistant", content: `Chào bạn! Tôi là **${agentName || "AI Assistant"}**. Hãy đặt câu hỏi để chúng ta bắt đầu.`, done: true }]);
                    setCurrentThreadId(null);
                  }}
                  title="Làm mới cuộc trò chuyện"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </>
            )}

            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl h-9 w-9 bg-white/50 dark:bg-black/50 border border-border/30 backdrop-blur-md shadow-sm hover:bg-destructive hover:text-white transition-all"
                onClick={onClose}
                title="Đóng bản xem trước"
              >
                <X className="w-4 h-4" />
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
          "flex-1 overflow-y-auto custom-scrollbar transition-all duration-500",
          messages.length <= 1 ? "opacity-0 invisible" : "opacity-100 visible py-10 px-8 space-y-8",
          isEmbed && "mr-2" // Move the scrollbar away from the right edge
        )}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4 max-w-4xl mx-auto",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* Avatar */}
              <div className="shrink-0 pt-0.5">
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shadow-sm",
                  msg.role === "user" ? "bg-primary text-white" : "bg-white dark:bg-zinc-900 border border-border/50"
                )}>
                  {msg.role === "user" ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4 text-primary" />}
                </div>
              </div>

              {/* Content */}
              <div className={cn(
                "flex flex-col space-y-2 max-w-[85%]",
                msg.role === "user" ? "items-end text-right" : "items-start text-left"
              )}>
                {msg.status && !msg.done && (
                  <div className="flex items-center gap-2 text-[9px] text-primary font-bold tracking-widest uppercase opacity-70 mb-1">
                    <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                    {msg.status}
                  </div>
                )}

                {msg.thinking && (
                  <ThinkingBlock content={msg.thinking} isDone={msg.done} />
                )}

                {msg.content && (
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                    msg.role === "user"
                      ? "bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 rounded-tr-none"
                      : "bg-white dark:bg-zinc-900 border border-border/50 rounded-tl-none"
                  )}>
                    <div className="prose dark:prose-invert max-w-none prose-sm prose-p:leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content || ""}
                      </ReactMarkdown>
                    </div>
                    
                    {msg.role === "assistant" && msg.done && idx > 0 && (
                      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        {/* Nhóm nút bên trái: Tương tác */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                            title="Hữu ích"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all"
                            title="Không hữu ích"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                            title="Thử lại"
                            onClick={() => handleChat(messages[idx-1].content || "")}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                            title="Sao chép"
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content || "");
                              addNotification("success", "Đã sao chép", "Nội dung đã được lưu vào bộ nhớ tạm.");
                            }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                            title="Bình luận"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        {/* Nút bên phải: Chi tiết thực thi */}
                        {showAudit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px] font-bold text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all gap-1.5"
                            onClick={() => {
                              setActiveMessageIndex(idx);
                              setIsAuditOpen(true);
                            }}
                          >
                            <Activity className="w-3 h-3" />
                            Chi tiết thực thi
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {msg.artifacts && msg.artifacts.length > 0 && (
                  <div className="w-full space-y-3">
                    {msg.artifacts.map((artifact) => (
                      <ArtifactRenderer key={artifact.id} artifact={artifact} />
                    ))}
                  </div>
                )}

                {msg.interrupt && (
                  <div className="mt-4 p-5 rounded-2xl border bg-primary/5 space-y-4 shadow-sm max-w-sm">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <p className="text-xs font-bold">{msg.interrupt.message || "Cần phê duyệt"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleResume(true)} className="flex-1 rounded-xl h-9">Chấp nhận</Button>
                      <Button size="sm" variant="outline" onClick={() => handleResume(false)} className="flex-1 rounded-xl h-9">Hủy</Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </AnimatePresence>
      </div>

      {/* Dynamic Input Area */}
      <div className={cn(
        "transition-all duration-700 px-8 z-10",
        messages.length <= 1
          ? "absolute inset-0 flex flex-col items-center justify-center bg-transparent"
          : "py-6 border-t bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl"
      )}>
        {messages.length <= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10 space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center border border-primary/20 shadow-xl mx-auto mb-6">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-foreground">
              {agentName || "Assistant"}
            </h1>
            <p className="text-muted-foreground text-sm font-medium max-w-3xl mx-auto leading-relaxed">
              Hệ thống trợ lý ảo chuyên dụng, hãy cho tôi biết yêu cầu của bạn.
            </p>
          </motion.div>
        )}

        <div className={cn(
          "relative w-full transition-all duration-500",
          messages.length <= 1 ? "max-w-3xl" : "max-w-4xl mx-auto"
        )}>
          <div className={cn(
            "relative flex flex-col w-full bg-white dark:bg-zinc-900 border border-border/60 rounded-[1.2rem] shadow-sm transition-all focus-within:ring-4 focus-within:ring-primary/5 focus-within:border-primary/40",
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
              className="w-full bg-transparent border-none focus:ring-0 py-3.5 px-4 pr-12 min-h-[52px] max-h-48 resize-none text-sm font-medium custom-scrollbar"
            />
            
            <div className="absolute right-2 bottom-2 flex items-center gap-2">
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
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90",
                  inputValue.trim() && agentId
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                )}
              >
                <ArrowUp className="w-4.5 h-4.5 stroke-[3]" />
              </button>
            </div>
          </div>
        </div>

        {messages.length > 1 && (
          <p className="text-[10px] text-center mt-2 text-muted-foreground/50 font-bold uppercase tracking-widest">
            AI có thể mắc sai sót. Vui lòng kiểm tra lại thông tin.
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
    if (!isDone) {
      setIsExpanded(true);
    } else {
      // Khi đã trả lời xong, tự động thu gọn phần phân tích
      setIsExpanded(false);
    }
  }, [isDone]);

  return (
    <div className="mb-4 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100/50 dark:bg-zinc-900/50 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all border border-zinc-200/50 dark:border-zinc-800/50 group"
      >
        <div className="w-4 h-4 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 flex items-center justify-center">
          <ChevronRight className={cn("w-3 h-3 text-zinc-500 transition-transform duration-300", isExpanded ? "rotate-90" : "")} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500/80 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
          {isExpanded ? "Đang hiện phân tích" : "Xem phân tích"}
        </span>
        {isDone && !isExpanded && (
          <span className="text-[9px] text-zinc-400 font-medium truncate max-w-[150px] opacity-50">
            — {content.slice(0, 40)}...
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
            <div className="mt-2 text-[11px] font-mono p-4 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed shadow-inner">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
