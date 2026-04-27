"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  Settings,
  Wrench,
  Cpu,
  Network,
  Clock,
  Save,
  ArrowLeft,
  ChevronRight,
  Plus,
  Trash2,
  Send,
  RotateCcw,
  Sparkles,
  Eye,
  EyeOff,
  X,
  Terminal,
  Layers,
  Users,
  MoreHorizontal,
  Edit2,
  Power
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";
import { fetchWithAuth } from "@/lib/api";

const PROVIDER_MODELS: Record<string, { value: string, label: string }[]> = {
  openai: [
    // ===== GPT-5 (CORE) =====
    { value: "gpt-5.5", label: "GPT-5.5 (mạnh nhất)" },
    { value: "gpt-5.4", label: "GPT-5.4 (ổn định)" },

    // ===== MODEL NHẸ (RẤT QUAN TRỌNG) =====
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini (rẻ, nhanh)" },
    { value: "gpt-5.4-nano", label: "GPT-5.4 Nano (siêu rẻ)" },

    // ===== GPT-4.1 (TƯƠNG THÍCH) =====
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },

    // ===== GPT-4o (MULTIMODAL) =====
    { value: "gpt-4o", label: "GPT-4o (đa phương thức)" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini (rẻ, nhanh, có vision)" }
  ],
  anthropic: [
    { value: "claude-opus-4.6", label: "Claude Opus 4.6 (mạnh nhất)" },
    { value: "claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
    { value: "claude-haiku-4.5", label: "Claude Haiku 4.5 (nhanh)" }
  ],
  google: [
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Preview)" },
    { value: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash (Lite)" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    { value: "gemma-4-26b-a4b-it", label: "Gemma 4 26B" },
  ],
  ollama: [
    { value: "llama3:8b", label: "Llama 3 8B" },
    { value: "llama3:70b", label: "Llama 3 70B" },

    { value: "qwen2:7b", label: "Qwen2 7B" },
    { value: "qwen2:72b", label: "Qwen2 72B" },

    { value: "mistral:7b", label: "Mistral 7B" },
    { value: "phi3:mini", label: "Phi-3 Mini" }
  ],
};

const EMBEDDING_MODELS: Record<string, { value: string, label: string }[]> = {
  openai: [
    { value: "text-embedding-3-small", label: "text-embedding-3-small (rẻ, nhanh)" },
    { value: "text-embedding-3-large", label: "text-embedding-3-large (chính xác cao)" },
    { value: "text-embedding-ada-002", label: "text-embedding-ada-002 (legacy)" },
  ],
  google: [
    { value: "gemini-embedding-2-preview", label: "Gemini Embedding 2 (Preview - Đa phương thức)" },
    { value: "text-embedding-004", label: "Gemini Text Embedding 004 (Tiêu chuẩn)" },
    { value: "models/gemini-embedding-001", label: "Gemini Embedding 001 (Ổn định)" },
  ],
  ollama: [
    { value: "llama3", label: "Llama 3 (Ollama)" },
    { value: "mxbai-embed-large", label: "mxbai-embed-large" },
    { value: "nomic-embed-text", label: "nomic-embed-text" },
  ],
};

function ToolItem({
  name,
  desc,
  active = false,
  onToggle,
  onDelete
}: {
  name: string,
  desc: string,
  active?: boolean,
  onToggle?: () => void,
  onDelete?: () => void
}) {
  const getIcon = (name: string) => {
    if (name.includes("Search")) return <Terminal className="w-4 h-4 text-blue-500" />;
    if (name.includes("Interpreter") || name.includes("SQL")) return <Cpu className="w-4 h-4 text-purple-500" />;
    if (name.includes("DALL-E") || name.includes("Content")) return <Sparkles className="w-4 h-4 text-amber-500" />;
    return <Network className="w-4 h-4 text-emerald-500" />;
  };

  return (
    <div className={cn(
      "px-5 py-3 border-b last:border-b-0 flex items-center justify-between transition-all duration-300 group hover:bg-muted/30",
      !active && "opacity-60"
    )}>
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={cn(
          "w-8 h-8 rounded-[0.5rem] flex items-center justify-center shrink-0 shadow-sm border",
          active ? "bg-white dark:bg-white/10 border-primary/20" : "bg-muted border-transparent"
        )}>
          {getIcon(name)}
        </div>
        <div className="flex-1 min-w-0 py-1">
          <p className="text-[13px] font-bold truncate text-foreground/90">{name}</p>
          <p className="text-[10px] text-muted-foreground font-medium leading-relaxed line-clamp-2 break-words mt-0.5">
            {desc}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {active && (
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] mr-2" />
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          title={active ? "Tạm tắt" : "Kích hoạt"}
        >
          <Power className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          title="Xóa"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description
}: {
  open: boolean,
  onClose: () => void,
  onConfirm: () => void,
  title: string,
  description: string
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-[1.5rem] p-8 max-w-sm w-full shadow-2xl border border-white/20 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
          <Trash2 className="w-7 h-7 text-destructive" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">{description}</p>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="flex-1 rounded-xl h-12 font-bold hover:bg-muted"
            onClick={onClose}
          >
            Hủy bỏ
          </Button>
          <Button
            className="flex-1 rounded-xl h-12 font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Đồng ý xóa
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateAgentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = searchParams.get("id");
  const { addNotification } = useNotifications();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showEmbeddingApiKey, setShowEmbeddingApiKey] = useState(false);

  const [activeTab, setActiveTab] = useState("general");
  const [showPreview, setShowPreview] = useState(true);
  const [isOtherSpecialty, setIsOtherSpecialty] = useState(false);
  const [messages, setMessages] = useState<{ role: string, content: string, thinking?: string, done?: boolean }[]>([
    { role: "assistant", content: "Chào bạn! Tôi là AI Agent của bạn. Hãy thiết lập cấu hình bên trái rồibắt đầu hội thoại nhé.", done: true }
  ]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    specialty: "",
    model_provider: "openai",
    model_name: "gpt-4o",
    api_key: "",
    instructions: "",
    tools: [] as { name: string, is_active: boolean }[],
    skills: [] as { name: string, is_active: boolean }[],
    knowledge_files: [] as { filename: string, url: string, object_name: string }[],

    // Embedding Configuration
    embedding_provider: "google",
    embedding_model: "text-embedding-004",
    embedding_api_key: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [availableTools, setAvailableTools] = useState<{ name: string, description: string, icon: string }[]>([]);
  const [showAddTool, setShowAddTool] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => { },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Nếu khoảng cách tới đáy < 100px thì coi như đang ở đáy và bật auto-scroll
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldAutoScroll(isAtBottom);
  };

  const scrollToBottom = () => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    console.log("DEBUG: AgentId detected:", agentId);
    if (agentId) {
      const fetchAgent = async () => {
        setIsLoadingData(true);
        const token = localStorage.getItem("access_token");
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

        if (!token) {
          addNotification("error", "Lỗi xác thực", "Không tìm thấy Token đăng nhập. Vui lòng đăng nhập lại.");
          setIsLoadingData(false);
          return;
        }

        try {
          console.log(`DEBUG: Calling API: /agents/${agentId}`);
          const res = await fetchWithAuth(`/agents/${agentId}`);

          if (res.ok) {
            const data = await res.json();
            console.log("DEBUG: Data received from Backend:", data);

            // Cập nhật state với dữ liệu thực tế
            const normalizeList = (list: any[]) => {
              return (list || []).map(item => {
                if (typeof item === 'string') return { name: item, is_active: true };
                return item;
              });
            };

            setFormData({
              name: data.name || "",
              description: data.description || "",
              specialty: data.specialty || "",
              model_provider: data.model_provider || "openai",
              model_name: data.model_name || "gpt-4o",
              api_key: data.api_key || "",
              instructions: data.instructions || "",
              tools: normalizeList(data.tools),
              skills: normalizeList(data.skills),
              knowledge_files: (data.knowledge_files || []).map((file: any) => {
                if (typeof file === 'string') {
                  return {
                    filename: file.split('/').pop() || file,
                    url: "",
                    object_name: file
                  };
                }
                return file;
              }),
              embedding_provider: data.embedding_provider || "google",
              embedding_model: data.embedding_model || "models/embedding-001",
              embedding_api_key: data.embedding_api_key || ""
            });

            // Kiểm tra xem chuyên môn có nằm trong danh sách mặc định không
            const defaults = [
              "Chăm sóc khách hàng",
              "Tư vấn Bán hàng",
              "Phân tích & Nghiên cứu",
              "Sáng tạo Nội dung",
              "Lập trình & Kỹ thuật",
              "Pháp lý & Luật",
              "Tài chính & Kế toán",
              "Nhân sự & Tuyển dụng",
              "Giáo dục & Đào tạo",
              "Dịch thuật & Ngôn ngữ"
            ];
            if (data.specialty && !defaults.includes(data.specialty)) {
              setIsOtherSpecialty(true);
            }
          } else {
            const errorData = await res.json().catch(() => ({ detail: "Lỗi không xác định" }));
            const msg = `Không thể tải dữ liệu (Mã lỗi: ${res.status}). Chi tiết: ${errorData.detail || res.statusText}`;
            console.error(msg);
            addNotification("error", "Lỗi tải dữ liệu", msg);
          }
        } catch (error) {
          console.error("DEBUG: Fetch error:", error);
          addNotification("error", "Lỗi kết nối", "Lỗi kết nối tới Server. Vui lòng kiểm tra Backend đang chạy.");
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchAgent();
    }

    // Luôn fetch danh sách tool hỗ trợ từ server
    const fetchAvailableTools = async () => {
      try {
        const res = await fetchWithAuth("/agents/tools/available");
        if (res.ok) {
          const data = await res.json();
          setAvailableTools(data);
        }
      } catch (error) {
        console.error("Lỗi fetch tools:", error);
      }
    };
    fetchAvailableTools();
  }, [agentId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const data = new FormData();
    data.append("file", file);

    const token = localStorage.getItem("access_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    try {
      const res = await fetchWithAuth("/agents/upload", {
        method: "POST",
        body: data,
      });

      if (!res.ok) throw new Error("Upload failed");

      const result = await res.json();
      setFormData(prev => ({
        ...prev,
        knowledge_files: [...prev.knowledge_files, result]
      }));
    } catch (error) {
      console.error(error);
      addNotification("error", "Lỗi tải file", "Không thể tải tài liệu lên hệ thống.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      addNotification("warning", "Thiếu thông tin", "Vui lòng nhập tên Agent trước khi lưu.");
      return;
    }

    const token = localStorage.getItem("access_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    setIsSaving(true);
    const method = agentId ? "PATCH" : "POST";
    const url = agentId ? `/agents/${agentId}` : "/agents/";

    try {
      const res = await fetchWithAuth(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          knowledge_files: formData.knowledge_files
        }),
      });

      if (!res.ok) throw new Error("Save failed");

      addNotification("success", "Thành công", `Đã ${agentId ? "cập nhật" : "tạo mới"} Agent thành công!`);

      // Nếu là tạo mới lần đầu, chúng ta mới chuyển hướng hoặc cập nhật URL
      if (!agentId) {
        const data = await res.json();
        if (data.id) {
          router.push(`/agents/create?id=${data.id}`);
        }
      }
    } catch (error) {
      console.error(error);
      addNotification("error", "Lỗi hệ thống", "Không thể lưu thông tin Agent. Vui lòng thử lại sau.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn(
      "flex -m-8 h-[calc(100vh-64px)] overflow-hidden bg-[#fbfbfd] dark:bg-black animate-in fade-in duration-700 relative",
      isLoadingData && "opacity-50 pointer-events-none"
    )}>
      {isLoadingData && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Bot className="w-10 h-10 animate-bounce text-primary" />
            <p className="text-sm font-bold text-primary animate-pulse">Đang tải dữ liệu Agent...</p>
          </div>
        </div>
      )}
      {/* --- Left Side: Configuration --- */}
      <div className={cn(
        "flex-1 overflow-y-auto transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] custom-scrollbar",
        showPreview ? "px-6 pt-0 pb-12" : "max-w-5xl mx-auto px-10 pt-0 pb-20"
      )}>
        <div className="max-w-4xl mx-auto space-y-3 pt-5">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <Link href="/agents" className="inline-flex items-center text-[10px] font-bold text-muted-foreground/40 hover:text-primary transition-all group">
                <ArrowLeft className="w-2.5 h-2.5 mr-1 group-hover:-translate-x-0.5 transition-transform" />
                QUAY LẠI
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-foreground/90">Xây dựng Trợ lý AI</h1>
                <p className="text-[13px] text-muted-foreground font-medium opacity-80 mt-1.5 leading-relaxed">Thiết kế tư duy và quy trình vận hành của các AI Agent trong hệ thống.</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-white/40 dark:bg-white/5 backdrop-blur-xl p-1 rounded-[0.5rem] self-end">
              {!showPreview && (
                <Button
                  variant="ghost"
                  onClick={() => setShowPreview(true)}
                  className="rounded-[0.5rem] h-8 px-4 text-[10px] font-bold text-primary bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-all uppercase tracking-widest shadow-sm shadow-primary/5"
                >
                  Thử nghiệm
                </Button>
              )}
              {/* Divider only if Test button is shown */}
              {!showPreview && <div className="w-[1px] h-3 bg-border mx-0.5" />}
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-[0.5rem] h-8 px-5 text-[10px] font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-wide disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 mr-2" />
                {isSaving ? "ĐANG LƯU..." : "Lưu"}
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
            <TabsList className="flex h-12 w-full max-w-full mx-auto rounded-[1.0rem] bg-muted/10 p-1 text-muted-foreground border shadow-sm overflow-hidden">
              <TabsTrigger value="general" className="flex-1 h-full rounded-lg px-1 gap-1.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all text-[11px] font-bold min-w-0">
                <Settings className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Cấu hình</span>
              </TabsTrigger>
              <TabsTrigger value="intelligence" className="flex-1 h-full rounded-lg px-1 gap-1.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all text-[11px] font-bold min-w-0">
                <Bot className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Huấn luyện</span>
              </TabsTrigger>
              <TabsTrigger value="capabilities" className="flex-1 h-full rounded-lg px-1 gap-1.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all text-[11px] font-bold min-w-0">
                <Wrench className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Công cụ</span>
              </TabsTrigger>
              <TabsTrigger value="automation" className="flex-1 h-full rounded-lg px-1 gap-1.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all text-[11px] font-bold min-w-0">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Quy trình</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-2 animate-in fade-in duration-200 min-h-[500px]">
              <section className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-6 bg-primary rounded-full" />
                  <h2 className="text-xl font-bold">Chi tiết trợ lý</h2>
                </div>

                <Card className="rounded-[0.5rem] border shadow-sm bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl">
                  <CardContent className="px-8 py-2 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-sm font-bold text-foreground/70 ml-1 block mb-2">Tên Agent</label>
                        <Input
                          placeholder="Nhập tên cho Agent..."
                          className="rounded-[0.5rem] h-12 border-muted-foreground/20 focus:ring-primary/20 transition-all bg-background/50"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-sm font-bold text-foreground/70 ml-1 block mb-2">Chuyên môn nghiệp vụ</label>
                        <div className="flex gap-2 items-center">
                          <div className={cn("transition-all duration-500", isOtherSpecialty ? "w-[160px]" : "w-full")}>
                            <Select
                              value={isOtherSpecialty ? "other" : formData.specialty}
                              onValueChange={(val) => {
                                if (val === "other") {
                                  setIsOtherSpecialty(true);
                                  setFormData({ ...formData, specialty: "" });
                                } else {
                                  setIsOtherSpecialty(false);
                                  setFormData({ ...formData, specialty: val || "" });
                                }
                              }}
                            >
                              <SelectTrigger className="rounded-[0.5rem] h-12 border-muted-foreground/20 bg-background/50 focus:ring-primary/20">
                                <SelectValue placeholder="Chọn lĩnh vực">
                                  {isOtherSpecialty ? "Khác..." : undefined}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="rounded-[0.5rem] border-muted-foreground/20 shadow-2xl">
                                <SelectItem value="Chăm sóc khách hàng" className="rounded-xl">Chăm sóc khách hàng</SelectItem>
                                <SelectItem value="Tư vấn Bán hàng" className="rounded-xl">Tư vấn Bán hàng</SelectItem>
                                <SelectItem value="Phân tích & Nghiên cứu" className="rounded-xl">Phân tích & Nghiên cứu</SelectItem>
                                <SelectItem value="Sáng tạo Nội dung" className="rounded-xl">Sáng tạo Nội dung</SelectItem>
                                <SelectItem value="Lập trình & Kỹ thuật" className="rounded-xl">Lập trình & Kỹ thuật</SelectItem>
                                <SelectItem value="Pháp lý & Luật" className="rounded-xl">Pháp lý & Luật</SelectItem>
                                <SelectItem value="Tài chính & Kế toán" className="rounded-xl">Tài chính & Kế toán</SelectItem>
                                <SelectItem value="Nhân sự & Tuyển dụng" className="rounded-xl">Nhân sự & Tuyển dụng</SelectItem>
                                <SelectItem value="Giáo dục & Đào tạo" className="rounded-xl">Giáo dục & Đào tạo</SelectItem>
                                <SelectItem value="Dịch thuật & Ngôn ngữ" className="rounded-xl">Dịch thuật & Ngôn ngữ</SelectItem>
                                <SelectItem value="other" className="rounded-xl font-bold text-primary">Khác...</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {isOtherSpecialty && (
                            <div className="flex-1 animate-in fade-in zoom-in-95 slide-in-from-left-4 duration-500">
                              <Input
                                placeholder="Mô tả chuyên môn cụ thể..."
                                className="rounded-[0.5rem] h-12 border-primary/20 bg-primary/[0.02] focus:ring-primary/20 border-dashed"
                                value={formData.specialty}
                                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-sm font-bold text-foreground/70 ml-1 block mb-2">Mô tả nhiệm vụ & Vai trò</label>
                      <Textarea
                        placeholder="Mô tả cụ thể trách nhiệm mà Agent này sẽ đảm nhận trong quy trình của bạn..."
                        className="rounded-[0.5rem] min-h-[100px] resize-none border-muted-foreground/20 bg-background/50"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="space-y-2 pt-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                  <h2 className="text-xl font-bold">Chọn Model LLM</h2>
                </div>

                <Card className="rounded-[0.5rem] border shadow-sm bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl">
                  <CardContent className="px-8 py-2 grid grid-cols-1 md:grid-cols-2 gap-1">
                    <div className="space-y-4">
                      <label className="text-sm font-bold text-foreground/70 ml-1 block mb-2">Bên cung cấp</label>
                      <Select
                        value={formData.model_provider}
                        onValueChange={(val) => {
                          if (val) {
                            const defaultModel = PROVIDER_MODELS[val]?.[0]?.value || "";
                            const defaultEmbModel = EMBEDDING_MODELS[val]?.[0]?.value || "";
                            setFormData({
                              ...formData,
                              model_provider: val,
                              model_name: defaultModel,
                              embedding_provider: val,
                              embedding_model: defaultEmbModel
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="rounded-[0.5rem] h-12 border-muted-foreground/20 bg-background/50">
                          <SelectValue placeholder="Chọn nền tảng gốc" />
                        </SelectTrigger>
                        <SelectContent className="rounded-[0.5rem] border-muted-foreground/20 shadow-2xl z-[100]">
                          <SelectItem value="openai" className="rounded-xl">OpenAI (GPT-4o, GPT-3.5)</SelectItem>
                          <SelectItem value="anthropic" className="rounded-xl">Anthropic (Claude 3.5)</SelectItem>
                          <SelectItem value="ollama" className="rounded-xl">Ollama (Llama 3, Qwen)</SelectItem>
                          <SelectItem value="google" className="rounded-xl">Google (Gemini Pro)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-bold text-foreground/70 ml-1 block mb-2">Phiên bản Mô hình</label>
                      <Select
                        value={formData.model_name}
                        onValueChange={(val) => setFormData({ ...formData, model_name: val || "" })}
                      >
                        <SelectTrigger className="rounded-[0.5rem] h-12 border-muted-foreground/20 bg-background/50">
                          <SelectValue placeholder="Lựa chọn Model" />
                        </SelectTrigger>
                        <SelectContent className="rounded-[0.5rem] border-muted-foreground/20 shadow-2xl">
                          {(PROVIDER_MODELS[formData.model_provider] || []).map((m) => (
                            <SelectItem key={m.value} value={m.value} className="rounded-xl">
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-4 md:col-span-2">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-sm font-bold text-foreground/70">API Key</label>
                      </div>
                      <div className="relative group">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value={formData.api_key}
                          onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                          placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          className="rounded-[0.5rem] h-12 border-muted-foreground/20 focus:ring-primary/20 transition-all bg-background/50 pr-12 font-mono text-xs shadow-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary/60 transition-colors"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="space-y-2 pt-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                  <h2 className="text-xl font-bold">Chọn Embedding Model</h2>
                </div>

                <Card className="rounded-[0.5rem] border shadow-sm bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl">
                  <CardContent className="px-8 py-2 grid grid-cols-1 md:grid-cols-2 gap-1">
                    <div className="space-y-4">
                      <label className="text-sm font-bold text-foreground/70 ml-1 block mb-2">Bên cung cấp</label>
                      <Select
                        value={formData.embedding_provider}
                        onValueChange={(val) => {
                          if (val) {
                            const defaultModel = EMBEDDING_MODELS[val]?.[0]?.value || "";
                            setFormData({
                              ...formData,
                              embedding_provider: val,
                              embedding_model: defaultModel
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="rounded-[0.5rem] h-12 border-muted-foreground/20 bg-background/50">
                          <SelectValue placeholder="Chọn nền tảng gốc" />
                        </SelectTrigger>
                        <SelectContent className="rounded-[0.5rem] border-muted-foreground/20 shadow-2xl z-[100]">
                          <SelectItem value="openai" className="rounded-xl">OpenAI Embeddings</SelectItem>
                          <SelectItem value="google" className="rounded-xl">Google Gemini Embeddings</SelectItem>
                          <SelectItem value="ollama" className="rounded-xl">Ollama Embeddings (Local)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-bold text-foreground/70 ml-1 block mb-2">Phiên bản Mô hình Embedding</label>
                      <Select
                        value={formData.embedding_model}
                        onValueChange={(val) => setFormData({ ...formData, embedding_model: val || "" })}
                      >
                        <SelectTrigger className="rounded-[0.5rem] h-12 border-muted-foreground/20 bg-background/50">
                          <SelectValue placeholder="Lựa chọn Model" />
                        </SelectTrigger>
                        <SelectContent className="rounded-[0.5rem] border-muted-foreground/20 shadow-2xl">
                          {(EMBEDDING_MODELS[formData.embedding_provider] || []).map((m) => (
                            <SelectItem key={m.value} value={m.value} className="rounded-xl">
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-4 md:col-span-2 pb-4">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-sm font-bold text-foreground/70">Embedding API Key</label>
                      </div>
                      <div className="relative group">
                        <Input
                          type={showEmbeddingApiKey ? "text" : "password"}
                          value={formData.embedding_api_key}
                          onChange={(e) => setFormData({ ...formData, embedding_api_key: e.target.value })}
                          placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          className="rounded-[0.5rem] h-12 border-muted-foreground/20 focus:ring-primary/20 transition-all bg-background/50 pr-12 font-mono text-xs shadow-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEmbeddingApiKey(!showEmbeddingApiKey)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary/60 transition-colors"
                        >
                          {showEmbeddingApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </TabsContent>

            {/* --- Tab 2: Intelligence --- */}
            <TabsContent value="intelligence" className="space-y-8 animate-in fade-in duration-200 min-h-[500px]">
              <section className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                  <h2 className="text-xl font-bold">Chỉ dẫn Hệ thống</h2>
                </div>
                <Card className="rounded-[0.5rem] border shadow-sm bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl">
                  <CardHeader className="px-8 py-4 pb-2">
                    <CardTitle className="text-sm font-bold text-foreground/60 uppercase tracking-wide">Logic vận hành</CardTitle>
                    <CardDescription className="text-xs">Thiết lập tính cách, giọng văn và quy tắc hành xử cốt lõi của Agent.</CardDescription>
                  </CardHeader>
                  <CardContent className="px-8 py-4 pt-2">
                    <div className="relative group">
                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Button variant="secondary" size="sm" className="rounded-[0.5rem] h-8 text-[11px] font-bold bg-white/80 backdrop-blur border shadow-sm">Thư viện chỉ dẫn mẫu</Button>
                      </div>
                      <Textarea
                        placeholder="Nhập chỉ dẫn chi tiết cho Agent tại đây..."
                        className="rounded-[0.5rem] min-h-[300px] p-6 border-muted-foreground/20 bg-background/50 focus:ring-primary/10 transition-all resize-none leading-relaxed text-sm font-medium"
                        value={formData.instructions}
                        onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="space-y-4 pt-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                  <h2 className="text-xl font-bold">Cơ sở Tri thức</h2>
                </div>
                <Card className="rounded-[0.5rem] border shadow-sm bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl">
                  <CardContent className="px-8 py-6 space-y-6">
                    <div className="relative border-2 border-dashed border-muted-foreground/20 rounded-[0.5rem] p-10 flex flex-col items-center justify-center bg-muted/5 hover:bg-primary/5 hover:border-primary/30 transition-all cursor-pointer group overflow-hidden">
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer z-20"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="w-14 h-14 rounded-[0.5rem] bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
                        <Plus className={cn("w-7 h-7 text-primary", isUploading && "animate-spin")} />
                      </div>
                      <h3 className="text-base font-bold relative z-10">{isUploading ? "Đang tải lên..." : "Tải lên tài liệu huấn luyện"}</h3>
                      <p className="text-xs text-muted-foreground text-center mt-2 max-w-sm relative z-10 leading-relaxed">Nhấn hoặc kéo thả tệp tài liệu chuyên sâu tại đây.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {formData.knowledge_files.map((file, idx) => (
                        <div key={idx} className="p-4 border rounded-[0.5rem] bg-background/50 flex items-center justify-between group hover:border-primary/30 transition-all hover:shadow-md">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-[0.5rem] bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                              <span className="text-[10px] font-bold uppercase">{file.filename.split('.').pop()}</span>
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold truncate">{file.filename}</p>
                              <p className="text-[9px] text-muted-foreground font-medium">Sẵn sàng huấn luyện</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-[0.5rem] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={() => setFormData({
                              ...formData,
                              knowledge_files: formData.knowledge_files.filter((_, i) => i !== idx)
                            })}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}

                      {formData.knowledge_files.length === 0 && (
                        <p className="col-span-2 text-center text-[10px] text-muted-foreground/50 italic py-4">Chưa có tài liệu nào được tải lên</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </section>
            </TabsContent>

            {/* --- Tab 3: Capabilities --- */}
            <TabsContent value="capabilities" className="space-y-10 animate-in fade-in duration-200 min-h-[500px]">
              {/* Section 1: Tools */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-blue-500 rounded-full" />
                    <h2 className="text-lg font-bold text-foreground/90">Công cụ hỗ trợ (Tools)</h2>
                  </div>
                  <Button
                    variant="ghost"
                    className="rounded-lg h-8 px-3 text-[11px] font-bold text-primary hover:bg-primary/5 transition-all"
                    onClick={() => setShowAddTool(true)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Quản lý công cụ
                  </Button>
                </div>
                <div className="flex flex-col border rounded-xl bg-white/50 dark:bg-white/[0.02] shadow-sm">
                  {formData.tools.length > 0 ? (
                    (() => {
                      // Tạo lookup map để tối ưu hiệu năng
                      const toolMap = new Map(availableTools.map(t => [t.name, t]));

                      return formData.tools.map((toolObj) => {
                        const toolName = toolObj.name;
                        const toolInfo = toolMap.get(toolName) || {
                          name: toolName,
                          description: "Công cụ đã được cấu hình",
                          icon: "Terminal"
                        };
                        return (
                          <ToolItem
                            key={toolName}
                            name={toolInfo.name}
                            desc={toolInfo.description}
                            active={toolObj.is_active}
                            onToggle={() => {
                              setFormData(prev => ({
                                ...prev,
                                tools: prev.tools.map(t =>
                                  t.name === toolName ? { ...t, is_active: !t.is_active } : t
                                )
                              }));
                            }}
                            onDelete={() => {
                              setConfirmConfig({
                                open: true,
                                title: `Xóa công cụ ${toolName}?`,
                                description: "Công cụ này sẽ bị gỡ bỏ khỏi Agent. Bạn có thể thêm lại bất cứ lúc nào từ thư viện.",
                                onConfirm: () => {
                                  setFormData(prev => ({
                                    ...prev,
                                    tools: prev.tools.filter(t => t.name !== toolName)
                                  }));
                                  addNotification("info", "Đã gỡ bỏ", `Đã gỡ bỏ công cụ ${toolName}.`);
                                }
                              });
                            }}
                          />
                        );
                      });
                    })()
                  ) : (
                    <div className="p-10 text-center space-y-3">
                      <Wrench className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                      <p className="text-xs text-muted-foreground font-medium">Chưa có công cụ nào được kích hoạt</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Section 2: Skills */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-purple-500 rounded-full" />
                    <h2 className="text-lg font-bold text-foreground/90">Kỹ năng chuyên sâu (Skills)</h2>
                  </div>
                  <Button variant="ghost" className="rounded-lg h-8 px-3 text-[11px] font-bold text-primary hover:bg-primary/5 transition-all">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Thêm kỹ năng
                  </Button>
                </div>

                <div className="flex flex-col border rounded-xl bg-white/50 dark:bg-white/[0.02] shadow-sm">
                  {formData.skills.length > 0 ? (
                    formData.skills.map((skillObj) => (
                      <ToolItem
                        key={skillObj.name}
                        name={skillObj.name}
                        desc="Kỹ năng nghiệp vụ chuyên sâu"
                        active={skillObj.is_active}
                        onToggle={() => {
                          setFormData(prev => ({
                            ...prev,
                            skills: prev.skills.map(s =>
                              s.name === skillObj.name ? { ...s, is_active: !s.is_active } : s
                            )
                          }));
                        }}
                        onDelete={() => {
                          setConfirmConfig({
                            open: true,
                            title: `Xóa kỹ năng ${skillObj.name}?`,
                            description: "Toàn bộ kỹ năng chuyên sâu sẽ bị gỡ bỏ. Bạn có thể thêm lại chúng sau này.",
                            onConfirm: () => {
                              setFormData(prev => ({
                                ...prev,
                                skills: prev.skills.filter(s => s.name !== skillObj.name)
                              }));
                              addNotification("info", "Đã gỡ bỏ", `Đã gỡ bỏ kỹ năng ${skillObj.name}.`);
                            }
                          });
                        }}
                      />
                    ))
                  ) : (
                    <div className="p-10 text-center space-y-3">
                      <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                      <p className="text-xs text-muted-foreground font-medium">Chưa có kỹ năng nào được thiết lập</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Section 3: Ecosystem */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
                    <h2 className="text-lg font-bold text-foreground/90">Hệ sinh thái Agent</h2>
                  </div>
                  <Button variant="ghost" className="rounded-lg h-8 px-3 text-[11px] font-bold text-primary hover:bg-primary/5 transition-all">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Kết nối Agent
                  </Button>
                </div>

                <div className="flex flex-col border rounded-xl bg-white/50 dark:bg-white/[0.02] shadow-sm">
                  <div className="p-10 text-center space-y-3">
                    <Network className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                    <p className="text-xs text-muted-foreground font-medium">Chưa có kết nối hệ sinh thái nào</p>
                  </div>
                </div>
              </section>
            </TabsContent>

            {/* --- Tab 4: Automation --- */}
            <TabsContent value="automation" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <section className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-6 bg-primary rounded-full" />
                  <h2 className="text-xl font-bold">Quy trình tự động</h2>
                </div>
                <Card className="rounded-[0.5rem] border shadow-sm bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl p-16 text-center space-y-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-[0.5rem] flex items-center justify-center mx-auto">
                    <Clock className="w-8 h-8 text-primary" />
                  </div>
                  <div className="max-w-md mx-auto space-y-2">
                    <h3 className="text-2xl font-bold">Tự động hóa thông minh</h3>
                    <p className="text-sm text-muted-foreground">Thiết lập các lịch trình hoặc sự kiện kích hoạt (triggers) để Agent tự động thực hiện công việc.</p>
                  </div>
                  <Button className="rounded-[0.5rem] h-12 px-8 font-bold bg-primary text-white shadow-xl shadow-primary/20">Thiết lập Automation</Button>
                </Card>
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* --- Right Side: Preview Chat --- */}
      {showPreview && (
        <div className="w-[480px] p-4 h-full animate-in slide-in-from-right duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">
          <div className="w-full h-full flex flex-col bg-white dark:bg-zinc-950 border rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden relative">
            {/* Chat Header */}
            <div className="h-16 px-6 border-b flex items-center justify-between bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-xs text-foreground/80">Thử nghiệm</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wide opacity-70">Môi trường mô phỏng</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-muted" onClick={() => setMessages([messages[0]])}>
                  <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setShowPreview(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fbfbfd]/50 dark:bg-black/20 custom-scrollbar"
            >
              {messages.map((msg, i) => (
                <div key={i} className={cn(
                  "flex gap-3 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}>
                  {/* Avatar */}
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm",
                    msg.role === "user"
                      ? "bg-primary/10 border-primary/20"
                      : "bg-purple-500/10 border-purple-500/20"
                  )}>
                    {msg.role === "user" ? (
                      <Users className="w-4 h-4 text-primary" />
                    ) : (
                      <Bot className="w-4 h-4 text-purple-600" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={cn(
                    "max-w-[85%] px-5 py-3 text-[13px] shadow-sm transition-all prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-white/10",
                    msg.role === "user"
                      ? "bg-primary text-white rounded-[1.2rem] rounded-tr-none font-medium prose-p:text-white prose-strong:text-white prose-headings:text-white"
                      : "bg-white dark:bg-zinc-900 border border-muted/30 rounded-[1.2rem] rounded-tl-none text-foreground/80 leading-relaxed"
                  )}>
                    {msg.thinking && (
                      <div className="mb-4 text-[11px] text-muted-foreground/80 border-l-2 border-primary/20 pl-3 py-1 bg-primary/5 rounded-r-lg not-prose">
                        <details className="group" open={!msg.done}>
                          <summary className="cursor-pointer list-none flex items-center gap-1.5 font-bold hover:text-primary transition-colors select-none">
                            <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                            {msg.done ? "Đã phân tích xong" : "Đang lập luận..."}
                          </summary>
                          <div className="mt-2 text-[10px] leading-relaxed italic opacity-80 whitespace-pre-wrap font-medium">
                            {msg.thinking}
                          </div>
                        </details>
                      </div>
                    )}
                    {msg.content ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      msg.role === "assistant" && i === messages.length - 1 ? (
                        <div className="flex gap-1 py-1">
                          <div className="w-1.5 h-1.5 bg-muted-foreground/30 rounded-full animate-bounce" />
                          <div className="w-1.5 h-1.5 bg-muted-foreground/30 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <div className="w-1.5 h-1.5 bg-muted-foreground/30 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-5 bg-white dark:bg-zinc-950 border-t">
              <div className="relative group">
                <Input
                  placeholder={agentId ? "Nhắn tin thử nghiệm..." : "Vui lòng lưu Agent để bắt đầu trò chuyện"}
                  disabled={!agentId}
                  className="rounded-2xl pr-12 h-12 border-2 border-muted-foreground/10 focus:border-primary/40 bg-muted/5 transition-all shadow-none disabled:opacity-50"
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && e.currentTarget.value && agentId) {
                      const content = e.currentTarget.value;
                      e.currentTarget.value = "";

                      // Thêm tin nhắn user
                      const userMsg = { role: "user", content };
                      setMessages(prev => [...prev, userMsg]);

                      // Thêm tin nhắn assistant trống để chuẩn bị stream
                      setMessages(prev => [...prev, { role: "assistant", content: "", done: false }]);

                      try {
                        const token = localStorage.getItem("access_token");
                        const response = await fetch("http://localhost:8000/api/v1/chat/stream", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            agent_id: agentId,
                            message: content
                          })
                        });

                        if (!response.ok) throw new Error("Stream failed");

                        const reader = response.body?.getReader();
                        const decoder = new TextDecoder();
                        if (reader) {
                          let accumulatedContent = "";
                          let accumulatedThinking = "";

                          while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value);
                            const lines = chunk.split("\n");

                            for (const line of lines) {
                              if (line.startsWith("data: ")) {
                                const dataStr = line.replace("data: ", "").trim();
                                if (dataStr === "[DONE]") continue;

                                try {
                                  const data = JSON.parse(dataStr);

                                  if (data.thinking) {
                                    accumulatedThinking += data.thinking;
                                    setMessages(prev => {
                                      const newMsgs = [...prev];
                                      if (newMsgs.length > 0) {
                                        newMsgs[newMsgs.length - 1].thinking = accumulatedThinking;
                                      }
                                      return newMsgs;
                                    });
                                  }

                                  if (data.content && typeof data.content === 'string') {
                                    accumulatedContent += data.content;
                                    setMessages(prev => {
                                      const newMsgs = [...prev];
                                      if (newMsgs.length > 0) {
                                        newMsgs[newMsgs.length - 1].content = accumulatedContent;
                                      }
                                      return newMsgs;
                                    });
                                  }
                                } catch (e) {
                                  console.error("Error parsing SSE data:", e);
                                }
                              }
                            }
                          }

                          // Đánh dấu hoàn thành khi thoát loop stream
                          setMessages(prev => {
                            const newMsgs = [...prev];
                            if (newMsgs.length > 0) {
                              newMsgs[newMsgs.length - 1].done = true;
                            }
                            return newMsgs;
                          });
                        }
                      } catch (error) {
                        console.error("Chat error:", error);
                        addNotification("error", "Lỗi hội thoại", "Không thể kết nối với Agent.");
                      }
                    }
                  }}
                />
                <Button size="icon" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-primary shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                  <Send className="w-3.5 h-3.5 text-white" />
                </Button>
              </div>
              <p className="text-[9px] text-center text-muted-foreground mt-4 font-bold opacity-40 uppercase tracking-wide">
                {agentId ? "Enter để bắt đầu hội thoại" : "Cần lưu Agent trước khi thử nghiệm"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tool Selection Modal Overlay */}
      {showAddTool && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500">
          <div
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-md"
            onClick={() => setShowAddTool(false)}
          />
          <Card className="w-full max-w-2xl relative z-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border-white/20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl animate-in zoom-in-95 duration-300 overflow-hidden rounded-[2rem]">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
              <div>
                <CardTitle className="text-lg font-bold">Thư viện Công cụ</CardTitle>
                <CardDescription className="text-xs">Chọn các công cụ để mở rộng khả năng cho Agent của bạn.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowAddTool(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableTools.map((tool) => {
                  const existingTool = formData.tools.find(t => t.name === tool.name);
                  const isActive = !!existingTool;
                  return (
                    <div
                      key={tool.name}
                      className={cn(
                        "p-4 border rounded-xl transition-all duration-300 flex items-start gap-4 group relative overflow-hidden",
                        isActive
                          ? "bg-primary/5 border-primary/30"
                          : "bg-white hover:border-primary/50 hover:shadow-md cursor-pointer"
                      )}
                      onClick={() => {
                        if (!isActive) {
                          setFormData(prev => ({
                            ...prev,
                            tools: [...prev.tools, { name: tool.name, is_active: true }]
                          }));
                          addNotification("success", "Đã thêm công cụ", `Đã thêm ${tool.name} thành công.`);
                        }
                      }}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                        isActive ? "bg-primary text-white" : "bg-muted group-hover:bg-primary/10 group-hover:text-primary"
                      )}>
                        {isActive ? <Bot className="w-6 h-6" /> : <Terminal className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-bold truncate">{tool.name}</p>
                          {isActive && (
                            <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">ĐÃ THÊM</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                          {tool.description}
                        </p>
                      </div>

                      {!isActive && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="w-4 h-4 text-primary" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <div className="p-4 border-t bg-muted/10 flex justify-end">
              <Button
                onClick={() => setShowAddTool(false)}
                className="rounded-lg h-10 px-8 text-xs font-bold bg-primary text-white"
              >
                Xong
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmConfig.open}
        onClose={() => setConfirmConfig({ ...confirmConfig, open: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        description={confirmConfig.description}
      />
    </div>
  );
}

export default function CreateAgentPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Bot className="w-8 h-8 animate-pulse text-primary" />
      </div>
    }>
      <SearchParamsWrapper />
    </Suspense>
  );
}

function SearchParamsWrapper() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("id");
  return <CreateAgentContent key={agentId} />;
}
