"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, Wrench, CheckCircle2, ArrowRight, Database,
  Cpu, Zap, Coins, Clock, Globe, ShieldCheck, Info, Bot
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics?: any;
  auditData?: any[];
  isDone?: boolean;
}

export function AuditModal({ isOpen, onClose, metrics, auditData = [], isDone = false }: AuditModalProps) {
  // Helper to format metric values
  const formatMetric = (val: any) => val !== undefined && val !== null ? val : "—";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-zinc-950">
        <DialogHeader className="p-6 pb-4 border-b bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tight">Chi tiết thực thi (Audit Log)</DialogTitle>
              <DialogDescription className="text-xs font-medium text-muted-foreground/60">
                Phân tích metrics và các bước xử lý nội bộ của Agent.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar h-[calc(90vh-100px)]">
            <div className="p-6 space-y-8">
              
              {/* --- METRICS GRID --- */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                  <Zap className="w-3 h-3" /> Tài nguyên & Hiệu năng
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Cột 1: Thông tin Model */}
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 group transition-all hover:border-primary/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">AI Model</span>
                        <Cpu className="w-3.5 h-3.5 text-primary/50 group-hover:text-primary transition-colors" />
                      </div>
                      <p className="text-sm font-black text-zinc-700 dark:text-zinc-200 truncate">
                        {formatMetric(metrics?.model)}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-medium text-emerald-600/80">{formatMetric(metrics?.provider)}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 group transition-all hover:border-primary/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Tổng Token</span>
                        <Coins className="w-3.5 h-3.5 text-primary/50 group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-primary tracking-tighter">
                          {formatMetric(metrics?.total_tokens)}
                        </p>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Tokens</span>
                      </div>
                    </div>
                  </div>

                  {/* Cột 2: Chi tiết Token */}
                  <div className="p-4 rounded-2xl bg-zinc-900 dark:bg-black border border-zinc-800 shadow-inner flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">Token Đầu vào</span>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] px-2 py-0">
                          {formatMetric(metrics?.input_tokens)}
                        </Badge>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-1000" 
                          style={{ width: metrics?.total_tokens ? `${(metrics.input_tokens / metrics.total_tokens) * 100}%` : '0%' }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">Token Đầu ra</span>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] px-2 py-0">
                          {formatMetric(metrics?.output_tokens)}
                        </Badge>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-1000" 
                          style={{ width: metrics?.total_tokens ? `${((metrics?.output_tokens || 0) / metrics.total_tokens) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">Trạng thái</span>
                      </div>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        isDone ? "text-emerald-500" : "text-orange-500 animate-pulse"
                      )}>
                        {isDone ? "COMPLETED" : "PROCESSING..."}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- AUDIT EVENTS TIMELINE --- */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                  <Database className="w-3 h-3" /> Nhật ký xử lý (Process Log)
                </div>

                <div className="space-y-4 relative">
                  {/* Vertical line indicator */}
                  <div className="absolute left-[17px] top-4 bottom-4 w-[1px] bg-zinc-200 dark:bg-zinc-800" />

                  {(!auditData || auditData.length === 0) ? (
                    <div className="py-12 text-center border-2 border-dashed rounded-3xl border-zinc-100 dark:border-zinc-900">
                      <Info className="w-8 h-8 text-zinc-200 dark:text-zinc-800 mx-auto mb-3" />
                      <p className="text-xs font-bold text-zinc-300 dark:text-zinc-700 uppercase tracking-widest">Đang thu thập dữ liệu...</p>
                    </div>
                  ) : (
                    auditData.map((event, idx) => (
                      <div key={idx} className="relative pl-10">
                        {/* Event Icon */}
                        <div className={cn(
                          "absolute left-0 top-0 w-9 h-9 rounded-xl flex items-center justify-center z-10 border shadow-sm transition-transform hover:scale-110",
                          event.event === "on_tool_start" ? "bg-orange-500 text-white border-orange-400" :
                          event.event === "on_tool_end" ? "bg-emerald-500 text-white border-emerald-400" :
                          event.event === "on_chat_model_start" ? "bg-primary text-white border-primary/50" :
                          event.event === "on_chat_model_end" ? "bg-zinc-900 text-white border-zinc-800" :
                          "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700"
                        )}>
                          {event.event?.includes("tool") ? <Wrench className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-black text-zinc-800 dark:text-zinc-100 uppercase tracking-tight">
                              {event.node || "Hệ thống"}
                            </span>
                            <Badge variant="outline" className="text-[8px] font-bold text-zinc-400 border-zinc-200 dark:border-zinc-800 px-1.5 h-4 uppercase">
                               {event.event?.replace("on_", "").replace(/_/g, " ") || "EVENT"}
                            </Badge>
                          </div>

                          <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/30 dark:bg-zinc-900/20 overflow-hidden transition-all hover:bg-white dark:hover:bg-zinc-900/40 hover:border-zinc-200 dark:hover:border-zinc-800">
                            {/* Input Data */}
                            {event.data?.input && (
                              <div className="space-y-1.5 mb-3 last:mb-0">
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-1 rounded-full bg-zinc-400" />
                                  <div className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter">Dữ liệu đầu vào</div>
                                </div>
                                <pre className="text-[10px] font-medium font-mono p-3 bg-white dark:bg-black rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 text-zinc-600 dark:text-zinc-400 overflow-auto max-h-[300px] custom-scrollbar leading-relaxed">
                                  {typeof event.data.input === 'string' ? event.data.input : JSON.stringify(event.data.input, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Output Data */}
                            {event.data?.output && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-1 rounded-full bg-primary" />
                                  <div className="text-[9px] font-black text-primary uppercase tracking-tighter">Kết quả xử lý</div>
                                </div>
                                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 overflow-auto max-h-[400px] custom-scrollbar">
                                  {typeof event.data.output === 'string' ? (
                                    <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                      {event.data.output}
                                    </div>
                                  ) : (
                                    <pre className="text-[10px] font-mono text-primary/80">
                                      {JSON.stringify(event.data.output, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
