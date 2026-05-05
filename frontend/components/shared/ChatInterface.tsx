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
  Cpu
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/api";
import { useNotifications } from "@/hooks/use-notifications";

interface Message {
  role: "user" | "assistant";
  content?: string;
  thinking?: string;
  status?: string;
  done?: boolean;
  interrupt?: any;
}

interface ChatInterfaceProps {
  agentId: string | null;
  agentName?: string;
  threadId?: string | null;
  onThreadCreated?: (threadId: string, title: string) => void;
  isEmbed?: boolean;
  onClose?: () => void;
}

export function ChatInterface({ agentId, agentName, threadId, onThreadCreated, isEmbed = false, onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(threadId || null);
  const { addNotification } = useNotifications();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const skipNextHistoryFetch = useRef(false);

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
                    ...(data.interrupt ? { interrupt: data.interrupt, done: true } : {})
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
          {messages.map((msg, i) => (
            <motion.div
              key={i}
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
            <p className="text-muted-foreground text-sm font-medium max-w-md mx-auto leading-relaxed">
              Hệ thống trợ lý ảo chuyên dụng. Hãy cho tôi biết yêu cầu của bạn.
            </p>
          </motion.div>
        )}

        <div className={cn(
          "relative w-full transition-all duration-500",
          messages.length <= 1 ? "max-w-2xl" : "max-w-4xl mx-auto"
        )}>
          <textarea
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
            className={cn(
              "w-full bg-white dark:bg-zinc-900 border border-border/60 focus:border-primary/50 rounded-2xl py-3 px-4 pr-16 min-h-[48px] max-h-48 resize-none shadow-sm transition-all focus:ring-4 focus:ring-primary/5 text-sm font-medium",
              !agentId && "opacity-50 grayscale cursor-not-allowed"
            )}
          />

          <div className="absolute right-2 bottom-2 flex items-center gap-2">
            {isLoadingHistory && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
            <button
              disabled={!inputValue.trim() || !agentId}
              onClick={() => {
                handleChat(inputValue);
                setInputValue("");
              }}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 active:scale-95",
                inputValue.trim() && agentId
                  ? "bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 shadow-lg"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
              )}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>

        {messages.length > 1 && (
          <p className="text-[10px] text-center mt-2 text-muted-foreground/50 font-bold uppercase tracking-widest">
            AI có thể mắc sai sót. Vui lòng kiểm tra lại thông tin.
          </p>
        )}
      </div>

      {/* Floating Controls */}
      <div className="absolute top-6 right-6 flex items-center gap-2 z-30">
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl h-9 w-9 bg-white/50 dark:bg-black/50 border border-border/30 backdrop-blur-md shadow-sm hover:bg-destructive hover:text-white"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
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
        <div className="w-4 h-4 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
          <Cpu className={cn("w-2.5 h-2.5 text-zinc-500 transition-transform duration-300", isExpanded ? "rotate-180" : "")} />
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
