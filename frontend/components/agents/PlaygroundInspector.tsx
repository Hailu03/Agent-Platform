"use client";

import { useState, useEffect } from "react";
import { 
  Activity, Wrench, Database, Cpu, Zap, 
  Coins, Clock, ShieldCheck, Info, Bot, 
  Search, ArrowRight, Play, CheckCircle2, AlertCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/api";
import { useNotifications } from "@/hooks/use-notifications";

interface PlaygroundInspectorProps {
  agentId: string | null;
  activeMessageIndex: number | null;
  metrics: any;
  auditData: any[];
  isDone: boolean;
  activeTools: string[];
  activeTab?: "trace" | "rag" | "tool";
  setActiveTab?: (tab: "trace" | "rag" | "tool") => void;
}

export function PlaygroundInspector({
  agentId,
  activeMessageIndex,
  metrics,
  auditData = [],
  isDone = false,
  activeTools = [],
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab
}: PlaygroundInspectorProps) {
  const [localActiveTab, setLocalActiveTab] = useState<"trace" | "rag" | "tool">("trace");
  const activeTab = propActiveTab !== undefined ? propActiveTab : localActiveTab;
  const setActiveTab = propSetActiveTab !== undefined ? propSetActiveTab : setLocalActiveTab;

  const { addNotification } = useNotifications();

  // RAG Tab States
  const [ragQuery, setRagQuery] = useState("");
  const [isSearchingRag, setIsSearchingRag] = useState(false);
  const [ragResults, setRagResults] = useState<any[]>([]);

  // Tool Tab States
  const [selectedTool, setSelectedTool] = useState(activeTools[0] || "");
  const [toolArgs, setToolArgs] = useState('{\n  "query": "churn rate"\n}');
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [toolResult, setToolResult] = useState<any>(null);

  // Sync selected tool if tools list changes
  useEffect(() => {
    if (activeTools.length > 0 && !activeTools.includes(selectedTool)) {
      setSelectedTool(activeTools[0]);
    }
  }, [activeTools]);

  const handleSearchRag = async () => {
    if (!agentId) return;
    if (!ragQuery.trim()) {
      addNotification("warning", "Thiếu truy vấn", "Vui lòng nhập từ khóa tìm kiếm tri thức.");
      return;
    }

    setIsSearchingRag(true);
    try {
      const res = await fetchWithAuth(`/agents/${agentId}/rag/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ragQuery })
      });
      if (res.ok) {
        const data = await res.json();
        setRagResults(data.chunks || []);
        addNotification("success", "Đã truy vấn tri thức", `Tìm thấy ${data.chunks?.length || 0} đoạn văn bản phù hợp.`);
      } else {
        addNotification("error", "Lỗi RAG search", "Không thể hoàn thành truy vấn tri thức.");
      }
    } catch (err) {
      addNotification("error", "Lỗi kết nối", "Không thể kết nối tới server.");
    } finally {
      setIsSearchingRag(false);
    }
  };

  const handleExecuteTool = async () => {
    if (!agentId) return;
    if (!selectedTool) {
      addNotification("warning", "Thiếu công cụ", "Vui lòng chọn một công cụ kết nối hoạt động.");
      return;
    }

    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(toolArgs);
    } catch (e) {
      addNotification("error", "Sai định dạng JSON", "Tham số truyền vào phải là cấu trúc JSON hợp lệ.");
      return;
    }

    setIsExecutingTool(true);
    setToolResult(null);
    try {
      const res = await fetchWithAuth(`/agents/${agentId}/tools/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_name: selectedTool,
          arguments: parsedArgs
        })
      });
      if (res.ok) {
        const data = await res.json();
        setToolResult(data);
        if (data.success) {
          addNotification("success", "Chạy thử Tool thành công", `Đã nhận kết quả trả về từ '${selectedTool}'.`);
        } else {
          addNotification("error", "Tool chạy thất bại", data.error || "Có lỗi xảy ra khi chạy tool.");
        }
      } else {
        addNotification("error", "Lỗi kết nối", "Không thể gửi yêu cầu chạy thử tool.");
      }
    } catch (err) {
      addNotification("error", "Lỗi kết nối", "Lỗi kết nối đến máy chủ.");
    } finally {
      setIsExecutingTool(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.05] rounded-[1.5rem] overflow-hidden shadow-2xl relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-5">
        <div className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary blur-[80px]" />
      </div>

      {/* Tabs Header */}
      <div className="px-5 py-4 border-b bg-white dark:bg-zinc-900/60 backdrop-blur-md flex items-center justify-between z-10 shrink-0 border-zinc-200/50 dark:border-white/[0.04]">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Playground</h3>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 z-10">
        <AnimatePresence mode="wait">
          {activeTab === "trace" && (
            <motion.div
              key="trace"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Metrics Header Dashboard */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-white/60 dark:bg-zinc-900/10 border-zinc-200/50 dark:border-white/[0.04] backdrop-blur-xl">
                  <CardContent className="p-3 flex flex-col justify-between h-full">
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">AI Engine</span>
                    <p className="text-xs font-black text-foreground/80 truncate mt-1">{metrics?.model || "Standard"}</p>
                    <span className="text-[7px] font-black uppercase text-emerald-500 mt-0.5">{metrics?.provider || "API Connection"}</span>
                  </CardContent>
                </Card>
                <Card className="bg-white/60 dark:bg-zinc-900/10 border-zinc-200/50 dark:border-white/[0.04] backdrop-blur-xl">
                  <CardContent className="p-3 flex flex-col justify-between h-full">
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Tokens Used</span>
                    <p className="text-sm font-black text-primary mt-1">{metrics?.total_tokens || "—"}</p>
                    <span className="text-[7px] text-muted-foreground/60 mt-0.5">Input: {metrics?.input_tokens || 0} | Output: {metrics?.output_tokens || 0}</span>
                  </CardContent>
                </Card>
                <Card className="bg-white/60 dark:bg-zinc-900/10 border-zinc-200/50 dark:border-white/[0.04] backdrop-blur-xl">
                  <CardContent className="p-3 flex flex-col justify-between h-full">
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Execution State</span>
                    <p className={cn(
                      "text-[9px] font-black uppercase mt-1.5 tracking-wider",
                      isDone ? "text-emerald-500" : "text-orange-500 animate-pulse"
                    )}>
                      {isDone ? "COMPLETED" : activeMessageIndex !== null ? "PROCESSING..." : "STANDBY"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Vertical Process Log Timeline */}
              <div className="space-y-4 relative pl-3 mt-4">
                <div className="absolute left-[7px] top-3 bottom-3 w-[1px] bg-zinc-200 dark:bg-zinc-800" />

                {auditData.length === 0 ? (
                  <div className="py-16 text-center border border-dashed rounded-2xl border-zinc-200 dark:border-zinc-800 bg-white/20 dark:bg-zinc-900/5">
                    <Info className="w-6 h-6 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                    <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest leading-relaxed">
                      Chưa có nhật ký chẩn đoán nào.<br/>Hãy gửi tin nhắn thử để theo dõi Trace Log.
                    </p>
                  </div>
                ) : (
                  auditData.map((event, idx) => (
                    <div key={idx} className="relative pl-6 space-y-1.5">
                      {/* Glow Bullet Indicator */}
                      <div className={cn(
                        "absolute left-0 top-1 w-3.5 h-3.5 rounded-full border-2 bg-white dark:bg-zinc-950 flex items-center justify-center z-10 shadow-sm",
                        event.event === "on_tool_start" ? "border-orange-500 shadow-orange-500/20" :
                        event.event === "on_tool_end" ? "border-emerald-500 shadow-emerald-500/20" :
                        event.event === "on_chat_model_start" ? "border-primary shadow-primary/20" :
                        "border-zinc-300 dark:border-zinc-700"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          event.event === "on_tool_start" ? "bg-orange-500" :
                          event.event === "on_tool_end" ? "bg-emerald-500" :
                          event.event === "on_chat_model_start" ? "bg-primary" :
                          "bg-zinc-300 dark:bg-zinc-700"
                        )} />
                      </div>

                      {/* Header */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-foreground uppercase tracking-tight">
                          {event.node || "System Process"}
                        </span>
                        <span className="text-[7px] font-black text-muted-foreground/60 border rounded px-1 uppercase scale-90 origin-left">
                          {event.event?.replace("on_", "").replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Data Panel Box */}
                      <div className="p-3.5 rounded-xl border border-zinc-200/50 dark:border-white/[0.04] bg-white/50 dark:bg-zinc-900/10 shadow-sm text-xs leading-relaxed space-y-2">
                        {event.data?.input && (
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest block">Input Payload</span>
                            <pre className="p-2.5 bg-white dark:bg-black rounded-lg border text-[9px] font-mono text-zinc-600 dark:text-zinc-400 overflow-x-auto">
                              {typeof event.data.input === 'string' ? event.data.input : JSON.stringify(event.data.input, null, 2)}
                            </pre>
                          </div>
                        )}
                        {event.data?.output && (
                          <div className="space-y-1 pt-1.5 border-t border-dashed">
                            <span className="text-[8px] font-black text-primary uppercase tracking-widest block">Output Returned</span>
                            <pre className="p-2.5 bg-primary/5 rounded-lg border border-primary/10 text-[9px] font-mono text-primary/80 overflow-x-auto">
                              {typeof event.data.output === 'string' ? event.data.output : JSON.stringify(event.data.output, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "rag" && (
            <motion.div
              key="rag"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              {/* Search Bar */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input
                    placeholder="Nhập câu truy vấn thử nghiệm RAG..."
                    className="pl-9 h-10 rounded-xl border-muted-foreground/20 bg-white dark:bg-zinc-900"
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchRag()}
                  />
                </div>
                <Button
                  onClick={handleSearchRag}
                  disabled={isSearchingRag || !ragQuery.trim()}
                  className="rounded-xl h-10 px-5 font-bold uppercase tracking-wider text-[10px] bg-primary text-white shadow-lg shadow-primary/20 gap-1.5 shrink-0"
                >
                  {isSearchingRag ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-white" />
                      Tìm Kiếm
                    </>
                  )}
                </Button>
              </div>

              {/* Chunks Results List */}
              <div className="space-y-4">
                {isSearchingRag ? (
                  <div className="py-20 text-center flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest animate-pulse">Đang truy vấn GraphRAG...</p>
                  </div>
                ) : ragResults.length === 0 ? (
                  <div className="py-16 text-center border border-dashed rounded-2xl border-zinc-200 dark:border-zinc-800 bg-white/20 dark:bg-zinc-900/5">
                    <Database className="w-6 h-6 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                    <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest leading-relaxed">
                      Chưa thực hiện tìm kiếm tri thức.<br/>Hãy thử nhập từ khóa để chẩn đoán độ khớp vector.
                    </p>
                  </div>
                ) : (
                  ragResults.map((chunk, idx) => (
                    <Card key={chunk.id} className="rounded-2xl border-zinc-200/50 dark:border-white/[0.04] bg-white/50 dark:bg-zinc-900/10 backdrop-blur-xl overflow-hidden shadow-sm">
                      <div className="px-4 py-2 bg-muted/40 border-b flex items-center justify-between">
                        <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-wider">Matched Slice #{idx + 1}</span>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[9px] px-2 py-0 font-bold rounded-lg">
                          Similarity Score: {chunk.score}
                        </Badge>
                      </div>
                      <CardContent className="p-4 space-y-3">
                        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-medium">{chunk.text}</p>
                        <div className="flex items-center gap-1.5 pt-2 border-t border-dashed">
                          <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest">Nguồn:</span>
                          <span className="text-[9px] font-bold text-foreground/75 bg-muted px-2 py-0.5 rounded-lg border">{chunk.source}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "tool" && (
            <motion.div
              key="tool"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {activeTools.length === 0 ? (
                <div className="py-20 text-center border border-dashed rounded-2xl border-zinc-200 dark:border-zinc-800 bg-white/20 dark:bg-zinc-900/5">
                  <Wrench className="w-6 h-6 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                  <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest leading-relaxed">
                    Trợ lý này chưa kích hoạt công cụ kết nối nào.<br/>Vui lòng kích hoạt trong Advanced Settings.
                  </p>
                </div>
              ) : (
                <>
                  {/* Select Tool and Execute Button */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest block ml-0.5">Chọn Công Cụ</span>
                      <select
                        value={selectedTool}
                        onChange={(e) => setSelectedTool(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border border-zinc-200/50 dark:border-white/[0.05] bg-white dark:bg-zinc-900 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {activeTools.map((tool) => (
                          <option key={tool} value={tool}>{tool}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={handleExecuteTool}
                        disabled={isExecutingTool || !selectedTool}
                        className="w-full rounded-xl h-10 text-[10px] font-black bg-primary hover:bg-primary-dark text-white uppercase tracking-wider shadow-lg shadow-primary/20 gap-1.5"
                      >
                        {isExecutingTool ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-white" />
                            Chạy Thử Công Cụ
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Arguments JSON Input */}
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest block ml-0.5">Tham Số (Arguments JSON)</span>
                    <Textarea
                      rows={5}
                      className="rounded-xl border-muted-foreground/20 font-mono text-[10px] p-3 bg-white dark:bg-black placeholder:text-muted-foreground/30 focus:ring-primary/20"
                      value={toolArgs}
                      onChange={(e) => setToolArgs(e.target.value)}
                    />
                  </div>

                  {/* Execution Results Display */}
                  <div className="space-y-2 mt-2">
                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest block ml-0.5">Kết Quả Chạy Thử</span>
                    {isExecutingTool ? (
                      <div className="p-8 text-center flex flex-col items-center gap-2 border border-dashed rounded-xl">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest animate-pulse">Đang gọi API & Sandbox thực thi...</p>
                      </div>
                    ) : toolResult ? (
                      <Card className="rounded-xl overflow-hidden border-zinc-200/50 dark:border-white/[0.04]">
                        <div className="px-4 py-2 bg-muted/40 border-b flex items-center justify-between">
                          <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest">JSON Response</span>
                          <div className="flex items-center gap-1.5">
                            {toolResult.success ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                            )}
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-wider",
                              toolResult.success ? "text-emerald-500" : "text-destructive"
                            )}>
                              {toolResult.success ? "SUCCESS" : "FAILED"}
                            </span>
                          </div>
                        </div>
                        <CardContent className="p-0">
                          <pre className="p-4 bg-zinc-950 text-zinc-300 font-mono text-[9px] leading-relaxed overflow-x-auto max-h-[300px] custom-scrollbar border-none">
                            {JSON.stringify(toolResult.output || toolResult.error, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="py-12 text-center border border-dashed rounded-xl border-zinc-200 dark:border-zinc-800 bg-white/20 dark:bg-zinc-900/5">
                        <Info className="w-5 h-5 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                        <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">
                          Nhập tham số JSON và nhấn chạy để kiểm thử API.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Loader2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
