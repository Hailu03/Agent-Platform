"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Settings,
  Wrench,
  Cpu,
  Network,
  Clock,
  Save,
  Loader2,
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
  Database,
  Edit2,
  Zap,
  Power,
  Mail,
  Search,
  Inbox,
  Tag,
  Reply,
  Globe,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Terminal,
  Copy,
  FileCode,
  Activity,
  GitBranch,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ChatInterface } from "@/components/shared/ChatInterface";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotifications } from "@/hooks/use-notifications";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const getToolIcon = (name?: string, category?: string, size: string = "w-4 h-4") => {
  const safeName = name || "";
  const n = safeName.toLowerCase();
  const cn = size;
  if (category === "Gmail" || n.includes("gmail")) {
    const gmailRed = '#EA4335';
    if (n.includes("tìm kiếm") || n.includes("search")) return <Search className={cn} style={{ color: gmailRed }} />;
    if (n.includes("danh sách") || n.includes("list")) return <Inbox className={cn} style={{ color: gmailRed }} />;
    if (n.includes("xem") || n.includes("đọc") || n.includes("read")) return <Eye className={cn} style={{ color: gmailRed }} />;
    if (n.includes("gửi") || n.includes("send")) return <Send className={cn} style={{ color: gmailRed }} />;
    if (n.includes("nháp") || n.includes("draft")) return <Edit2 className={cn} style={{ color: gmailRed }} />;
    if (n.includes("nhãn") || n.includes("modify")) return <Tag className={cn} style={{ color: gmailRed }} />;
    if (n.includes("trả lời") || n.includes("reply")) return <Reply className={cn} style={{ color: gmailRed }} />;
    return <Mail className={cn} style={{ color: gmailRed }} />;
  }
  if (n.includes("tìm kiếm web") || n.includes("web_search")) return <Globe className={`${cn} text-blue-600`} />;
  if (n.includes("search")) return <Search className={`${cn} text-blue-600`} />;
  if (n.includes("interpreter") || n.includes("sql")) return <Cpu className={`${cn} text-indigo-600`} />;
  if (n.includes("dall-e") || n.includes("content")) return <Sparkles className={`${cn} text-amber-600`} />;
  if (n.includes("email")) return <Mail className={`${cn} text-red-600`} />;
  if (category === "Social Media" || n.includes("facebook")) {
    const fbBlue = '#1877F2';
    if (n.includes("đăng") || n.includes("post")) return <Send className={cn} style={{ color: fbBlue }} />;
    if (n.includes("bình luận") || n.includes("comment")) return <MessageSquare className={cn} style={{ color: fbBlue }} />;
    if (n.includes("tin nhắn") || n.includes("message")) return <Mail className={cn} style={{ color: fbBlue }} />;
    if (n.includes("insights") || n.includes("thống kê")) return <Activity className={cn} style={{ color: fbBlue }} />;
    return <Globe className={cn} style={{ color: fbBlue }} />;
  }
  return <Network className={`${cn} text-slate-600`} />;
};

function ToolItem({
  name,
  desc,
  active = false,
  category,
  onToggle,
  onDelete,
  onSettings,
  children
}: {
  name: string,
  desc: string,
  active?: boolean,
  category?: string,
  onToggle?: () => void,
  onDelete?: () => void,
  onSettings?: () => void,
  children?: React.ReactNode
}) {
  return (
    <div className={cn(
      "border-b last:border-b-0 transition-all duration-300 group hover:bg-muted/30",
      !active && "opacity-60"
    )}>
      <div className="px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className={cn(
            "w-8 h-8 rounded-[0.5rem] flex items-center justify-center shrink-0 shadow-sm border",
            active ? "bg-white dark:bg-white/10 border-primary/20" : "bg-muted border-transparent"
          )}>
            {getToolIcon(name, category)}
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

          {active && onSettings && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onSettings();
              }}
              title="Cấu hình công cụ"
            >
              <Settings className="w-4 h-4" />
            </Button>
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

      {active && children && (
        <div className="px-5 pb-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="p-4 rounded-xl bg-muted/30 border border-muted-foreground/10 space-y-3">
            {children}
          </div>
        </div>
      )}
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
  const { user, refreshUser } = useAuth();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showEmbeddingApiKey, setShowEmbeddingApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [mode, setMode] = useState<"simple" | "advanced">(agentId ? "advanced" : "simple");
  const [simpleQuery, setSimpleQuery] = useState("");
  const [simpleAccess, setSimpleAccess] = useState<string[]>([]);
  const [simpleAutonomy, setSimpleAutonomy] = useState("semi-auto");
  const [simpleSchedule, setSimpleSchedule] = useState("event");
  const [isBuildingWithAI, setIsBuildingWithAI] = useState(false);
  const [showBlueprintDiff, setShowBlueprintDiff] = useState(false);
  const [blueprintData, setBlueprintData] = useState<{
    name: string;
    description: string;
    skills: string[];
    tools: string[];
    permissions: string[];
    automation: string;
    system_instructions: string;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [isOtherSpecialty, setIsOtherSpecialty] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    specialty: "",
    model_provider: "openai",
    model_name: "gpt-4o",
    api_key: "",
    instructions: "",
    tools: [] as { name: string, is_active: boolean, config?: Record<string, unknown> }[],
    skills: [] as { name: string, is_active: boolean }[],
    knowledge_files: [] as { filename: string, url: string, object_name: string, status?: "pending" | "indexing" | "completed" | "error", task_id?: string }[],
    workflow_id: "",

    // Embedding Configuration
    embedding_provider: "google",
    embedding_model: "text-embedding-004",
    embedding_api_key: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const handleBuildWithAI = async () => {
    if (!simpleQuery.trim()) {
      addNotification("warning", "Yêu cầu mô tả", "Vui lòng nhập mô tả hoạt động của trợ lý.");
      return;
    }

    setIsBuildingWithAI(true);
    try {
      const activeTools = formData.tools.filter(t => t.is_active).map(t => t.name);
      const activeSkills = formData.skills.filter(s => s.is_active).map(s => s.name);

      const res = await fetchWithAuth("/agents/blueprint/compile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: simpleQuery,
          current_tools: activeTools,
          current_skills: activeSkills,
          current_instructions: formData.instructions,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBlueprintData(data.blueprint);
        setShowBlueprintDiff(true);
        addNotification("success", "Biên dịch Blueprint thành công", "AI đã tự động tối ưu hóa sơ đồ cấu hình trợ lý.");
      } else {
        const err = await res.json().catch(() => ({ detail: "Lỗi biên dịch" }));
        addNotification("error", "Lỗi thiết lập AI", err.detail || "Không thể tự động cấu hình.");
      }
    } catch (err) {
      addNotification("error", "Lỗi kết nối", "Không thể kết nối đến máy chủ.");
    } finally {
      setIsBuildingWithAI(false);
    }
  };

  const handleApplyBlueprint = () => {
    if (!blueprintData) return;

    setFormData((prev) => {
      const newTools = prev.tools.map((t) => ({
        ...t,
        is_active: blueprintData.tools.includes(t.name),
      }));
      blueprintData.tools.forEach((toolName) => {
        if (!newTools.some((t) => t.name === toolName)) {
          newTools.push({ name: toolName, is_active: true });
        }
      });

      const newSkills = prev.skills.map((s) => ({
        ...s,
        is_active: blueprintData.skills.includes(s.name),
      }));
      blueprintData.skills.forEach((skillName) => {
        if (!newSkills.some((s) => s.name === skillName)) {
          newSkills.push({ name: skillName, is_active: true });
        }
      });

      return {
        ...prev,
        name: prev.name.trim() ? prev.name : blueprintData.name,
        description: prev.description.trim() ? prev.description : blueprintData.description,
        instructions: blueprintData.system_instructions,
        tools: newTools,
        skills: newSkills,
      };
    });

    setShowBlueprintDiff(false);
    setMode("advanced");
    addNotification("success", "Đã áp dụng Blueprint", "Các cài đặt đã được điền tự động. Bạn đang ở chế độ Cấu hình nâng cao.");
  };

  const [showAddTool, setShowAddTool] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);
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

  const isDataLoadedRef = useRef(false);

  useEffect(() => {
    if (!isLoadingData && isDataLoadedRef.current) {
      setIsDirty(true);
    }
  }, [formData, isLoadingData]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    const handleInternalNavigation = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (isDirty && link) {
        const href = link.getAttribute("href");
        // Bỏ qua các link nội bộ không làm mất trang hoặc link logout
        if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
          e.preventDefault();
          setConfirmConfig({
            open: true,
            title: "Thay đổi chưa được lưu",
            description: "Bạn có các thay đổi chưa lưu. Bạn có chắc muốn rời khỏi trang này không?",
            onConfirm: () => {
              setIsDirty(false); // Tắt dirty để có thể thoát
              setTimeout(() => {
                router.push(href);
              }, 100);
            }
          });
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleInternalNavigation, true);
    };
  }, [isDirty, router]);

  const [availableTools, setAvailableTools] = useState<{ name: string, label?: string, description: string, icon: string, category?: string }[]>([]);
  const [availableSkills, setAvailableSkills] = useState<{ id: string, name: string, description: string, content: string, is_template: boolean, required_tools?: string[] }[]>([]);
  const [previewSkill, setPreviewSkill] = useState<typeof availableSkills[0] | null>(null);
  const [isCreateSkillOpen, setIsCreateSkillOpen] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: "", description: "", content: "" });
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [isCreatingSkill, setIsCreatingSkill] = useState(false);
  const [skillTab, setSkillTab] = useState<"edit" | "preview">("edit");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ "Gmail": true, "Cơ bản": true, "Database": true });
  const [availableConnections, setAvailableConnections] = useState<{ id: string, name: string, engine: string }[]>([]);
  const [availableWorkflows, setAvailableWorkflows] = useState<any[]>([]);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [availableToolSearch, setAvailableToolSearch] = useState("");
  const [facebookPages, setFacebookPages] = useState<{ id: string; name: string; category?: string; tasks?: string[] }[]>([]);
  const [selectedFacebookPageId, setSelectedFacebookPageId] = useState<string | null>(null);
  const [selectedFacebookPageName, setSelectedFacebookPageName] = useState<string | null>(null);
  const [showFacebookPagePicker, setShowFacebookPagePicker] = useState(false);
  const [isLoadingFacebookPages, setIsLoadingFacebookPages] = useState(false);
  const [isCreatingConnection, setIsCreatingConnection] = useState(false);
  const [newConnectionData, setNewConnectionData] = useState({
    name: "",
    engine: "postgres",
    host: "localhost",
    port: 5432,
    database: "",
    username: "",
    plain_password: "",
    schema_name: "public",
    extra_params: {} as Record<string, unknown>,
    ssl: false,
    instructions: "",
    sql_samples: ""
  });
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [isDataSourceSelectOpen, setIsDataSourceSelectOpen] = useState(false);
  const [showToolConfig, setShowToolConfig] = useState(false);
  const [editingTool, setEditingTool] = useState<{
    name: string;
    is_active: boolean;
    config?: Record<string, unknown>;
    info?: {
      name: string;
      label?: string;
      description: string;
      icon: string;
      category?: string;
      supported_params?: {
        key: string;
        label: string;
        type: string;
        default?: string | number;
        desc?: string;
        options?: { value: string; label: string }[];
      }[];
    };
    params?: Record<string, unknown>;
  } | null>(null);
  const [toolOverrideData, setToolOverrideData] = useState({ label: "", description: "" });
  const [previewWidth, setPreviewWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 320 && newWidth < 800) {
        setPreviewWidth(newWidth);
      }
    };

    const stopResizing = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", stopResizing);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing]);

  const handleToolConfigChange = (toolName: string, config: Record<string, unknown>) => {
    setFormData(prev => ({
      ...prev,
      tools: prev.tools.map(t => t.name === toolName ? { ...t, config: { ...t.config, ...config } } : t)
    }));
    setIsDirty(true);
  };

  const filteredAvailableToolGroups = Object.entries(
    availableTools
      .filter((tool) => {
        const keyword = availableToolSearch.trim().toLowerCase();
        if (!keyword) return true;

        return [tool.name, tool.label, tool.description, tool.category]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(keyword));
      })
      .reduce((acc, tool) => {
        const cat = tool.category || "Khác";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(tool);
        return acc;
      }, {} as Record<string, typeof availableTools>)
  );

  const fetchFacebookPages = async (openPicker: boolean = false) => {
    setIsLoadingFacebookPages(true);
    try {
      const res = await fetchWithAuth("/auth/facebook/pages");
      if (!res.ok) {
        if (openPicker) {
          addNotification("warning", "Chưa kết nối", "Bạn cần kết nối Facebook trước khi chọn Page.");
        }
        return;
      }

      const data = await res.json();
      setFacebookPages(data.pages || []);
      setSelectedFacebookPageId(data.selected_page_id || null);
      setSelectedFacebookPageName(data.selected_page_name || null);
      if (openPicker) {
        setShowFacebookPagePicker(true);
      }
    } catch (error) {
      console.error("Failed to fetch Facebook pages", error);
      addNotification("error", "Lỗi", "Không thể tải danh sách Facebook Pages.");
    } finally {
      setIsLoadingFacebookPages(false);
    }
  };

  const handleConnectFacebook = async () => {
    try {
      const connectUrl = agentId ? `/auth/facebook/connect?agent_id=${agentId}` : "/auth/facebook/connect";
      const res = await fetchWithAuth(connectUrl);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addNotification("error", "Lỗi kết nối", data.detail || "Không thể khởi tạo đăng nhập Facebook.");
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Facebook connect failed", error);
      addNotification("error", "Lỗi", "Không thể chuyển tới Facebook Login.");
    }
  };

  const handleSelectFacebookPage = async (pageId: string) => {
    try {
      const res = await fetchWithAuth("/auth/facebook/select-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addNotification("error", "Lỗi", data.detail || "Không thể lưu Facebook Page.");
        return;
      }

      const data = await res.json();
      setSelectedFacebookPageId(data.selected_page_id);
      setSelectedFacebookPageName(data.selected_page_name);
      setShowFacebookPagePicker(false);
      addNotification("success", "Đã chọn Fanpage", `Page mặc định hiện tại là ${data.selected_page_name}.`);
      await refreshUser();
    } catch (error) {
      console.error("Facebook page select failed", error);
      addNotification("error", "Lỗi", "Không thể chọn Facebook Page.");
    }
  };


  useEffect(() => {
    if (availableTools.length > 0 && formData.tools.some(t => t.name === "Gmail")) {
      const gmailTools = availableTools.filter(t => t.category === "Gmail");
      if (gmailTools.length > 0) {
        const timeout = setTimeout(() => {
          setFormData(prev => {
            const otherTools = prev.tools.filter(t => t.name !== "Gmail");
            const newGmailTools = gmailTools
              .filter(gt => !otherTools.find(ot => ot.name === gt.name))
              .map(gt => ({ name: gt.name, is_active: true }));

            return {
              ...prev,
              tools: [...otherTools, ...newGmailTools]
            };
          });
        }, 0);
        return () => clearTimeout(timeout);
      }
    }
  }, [availableTools, formData.tools]);

  useEffect(() => {
    if (user?.is_facebook_connected) {
      const timeout = setTimeout(() => {
        fetchFacebookPages(false);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [user?.is_facebook_connected]);

  useEffect(() => {
    if (searchParams.get("google_tool_connected") === "success") {
      addNotification("success", "Đã kết nối Google", "Gmail tools đã sẵn sàng cho agent này.");
      refreshUser();
    }
  }, [searchParams, refreshUser, addNotification]);

  useEffect(() => {
    if (searchParams.get("facebook_connected") === "success") {
      addNotification("success", "Đã kết nối Facebook", "Bây giờ bạn có thể chọn Fanpage để Agent quản lý.");
      refreshUser().then(() => {
        fetchFacebookPages(true);
      });
    }
  }, [searchParams, refreshUser, fetchFacebookPages, addNotification]);

  const handleCreateSkill = async () => {
    if (!newSkill.name || !newSkill.content) {
      addNotification("error", "Lỗi dữ liệu", "Vui lòng nhập tên và nội dung kỹ năng");
      return;
    }
    setIsCreatingSkill(true);
    try {
      const response = await fetchWithAuth(editingSkillId ? `/skills/${editingSkillId}` : "/skills/", {
        method: editingSkillId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...newSkill,
          is_template: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error("Failed to create skill");
      }

      const created = await response.json();
      addNotification("success", "Thành công", `${editingSkillId ? "Cập nhật" : "Tạo"} kỹ năng mới thành công`);

      if (editingSkillId) {
        setAvailableSkills(prev => prev.map(s => s.id === editingSkillId ? created : s));
      } else {
        setAvailableSkills(prev => [...prev, created]);
        setFormData(prev => ({ ...prev, skills: [...prev.skills, { name: created.name, is_active: true }] }));
      }

      setPreviewSkill(created);
      setIsCreateSkillOpen(false);
      setEditingSkillId(null);
      setNewSkill({ name: "", description: "", content: "" });
    } catch (err) {
      addNotification("error", "Lỗi hệ thống", "Không thể tạo kỹ năng");
    } finally {
      setIsCreatingSkill(false);
    }
  };

  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        const [toolsRes, skillsRes, workflowsRes] = await Promise.all([
          fetchWithAuth("/agents/tools/available"),
          fetchWithAuth("/skills/"),
          fetchWithAuth("/workflows/")
        ]);
        if (toolsRes.ok) {
          const tools = await toolsRes.json();
          setAvailableTools(tools);
        }
        if (skillsRes.ok) {
          const skills = await skillsRes.json();
          setAvailableSkills(skills);
        }
        if (workflowsRes.ok) {
          const workflows = await workflowsRes.json();
          setAvailableWorkflows(workflows);
        }
      } catch (error) {
        console.error("Failed to fetch dependencies:", error);
      }
    };
    fetchDependencies();
  }, []);

  useEffect(() => {
    const draft = localStorage.getItem("agent_form_draft");
    if (draft) {
      try {
        const draftData = JSON.parse(draft);
        const timeout = setTimeout(() => {
          setFormData(prev => ({ ...prev, ...draftData }));
          localStorage.removeItem("agent_form_draft");
          addNotification("success", "Khôi phục", "Đã khôi phục dữ liệu bạn đang nhập dở.");
        }, 0);
        return () => clearTimeout(timeout);
      } catch (e) {
        console.error("Failed to parse draft:", e);
      }
    }
  }, [addNotification]);

  const [initialKeys, setInitialKeys] = useState({ api_key: "", embedding_api_key: "" });

  useEffect(() => {
    if (agentId) {
      const fetchAgent = async () => {
        setIsLoadingData(true);
        const token = localStorage.getItem("access_token");
        if (!token) {
          addNotification("error", "Lỗi xác thực", "Không tìm thấy Token đăng nhập.");
          setIsLoadingData(false);
          return;
        }

        try {
          const res = await fetchWithAuth(`/agents/${agentId}`);

          if (res.ok) {
            const data = await res.json();
            setFormData({
              name: data.name || "",
              description: data.description || "",
              specialty: data.specialty || "",
              model_provider: data.model_provider || "openai",
              model_name: data.model_name || "gpt-4o",
              api_key: data.api_key || "",
              instructions: data.instructions || "",
              tools: data.tools || [],
              skills: data.skills || [],
              knowledge_files: data.knowledge_files || [],
              workflow_id: data.workflow_id || "",
              embedding_provider: data.embedding_provider || "google",
              embedding_model: data.embedding_model || "text-embedding-004",
              embedding_api_key: data.embedding_api_key || "",
            });

            setInitialKeys({
              api_key: data.api_key || "",
              embedding_api_key: data.embedding_api_key || ""
            });

            const defaults = [
              "Chăm sóc khách hàng", "Tư vấn Bán hàng", "Phân tích & Nghiên cứu", "Sáng tạo Nội dung",
              "Lập trình & Kỹ thuật", "Pháp lý & Luật", "Tài chính & Kế toán", "Nhân sự & Tuyển dụng",
              "Giáo dục & Đào tạo", "Dịch thuật & Ngôn ngữ"
            ];
            if (data.specialty && !defaults.includes(data.specialty)) {
              setIsOtherSpecialty(true);
            }
          } else {
            const errorData = await res.json().catch(() => ({ detail: "Lỗi không xác định" }));
            addNotification("error", "Lỗi tải dữ liệu", errorData.detail || "Không thể tải dữ liệu");
          }
        } catch (error) {
          addNotification("error", "Lỗi kết nối", "Lỗi kết nối tới Server.");
        } finally {
          setIsLoadingData(false);
          setTimeout(() => {
            isDataLoadedRef.current = true;
          }, 1000);
        }
      };
      fetchAgent();
    }

    const fetchAvailableTools = async () => {
      try {
        const [toolsRes, connRes] = await Promise.all([
          fetchWithAuth("/agents/tools/available"),
          fetchWithAuth("/connections")
        ]);
        if (toolsRes.ok) {
          const data = await toolsRes.json();
          setAvailableTools(data);
        }
        if (connRes.ok) {
          const data = await connRes.json();
          setAvailableConnections(data);
        }
      } catch (error) {
        console.error("Lỗi fetch tools/connections:", error);
      }
    };
    fetchAvailableTools();
  }, [agentId, addNotification]);

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const res = await fetchWithAuth("/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConnectionData)
      });
      const data = await res.json();
      if (data.success) {
        addNotification("success", "Kết nối thành công!", `Độ trễ: ${data.latency_ms}ms`);
      } else {
        addNotification("error", "Kết nối thất bại", data.error);
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Không thể kết nối tới server thử nghiệm.");
    } finally {
      setIsTestingConnection(false);
    }
  };

  const [indexingTask, setIndexingTask] = useState<{ id: string; status: string } | null>(null);

  const startPollingIndexing = (taskId: string) => {
    setIndexingTask({ id: taskId, status: "processing" });
    const interval = setInterval(async () => {
      try {
        const res = await fetchWithAuth(`/agents/tasks/${taskId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "SUCCESS") {
            clearInterval(interval);
            setIndexingTask({ id: taskId, status: "completed" });
            addNotification("success", "Hoàn tất", "Đã lập chỉ mục nguồn dữ liệu thành công.");
            const connRes = await fetchWithAuth("/connections");
            if (connRes.ok) {
              const data = await connRes.json();
              setAvailableConnections(data);
            }
            setTimeout(() => {
              setShowAddConnection(false);
              setIndexingTask(null);
            }, 1500);
          } else if (data.status === "FAILURE") {
            clearInterval(interval);
            setIndexingTask({ id: taskId, status: "error" });
            addNotification("error", "Lỗi Indexing", "Không thể trích xuất kiến thức.");
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
        clearInterval(interval);
      }
    }, 2000);
  };

  const handleCreateConnection = async () => {
    setIsCreatingConnection(true);
    const url = editingConnectionId ? `/connections/${editingConnectionId}` : "/connections";
    const method = editingConnectionId ? "PATCH" : "POST";

    try {
      const res = await fetchWithAuth(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newConnectionData,
          extra_params: {
            ...newConnectionData.extra_params,
            agent_id: agentId || "temp",
            embedding_provider: formData.embedding_provider,
            embedding_model: formData.embedding_model,
            embedding_api_key: formData.embedding_api_key,
            chat_api_key: formData.api_key,
            chat_provider: formData.model_provider,
            model_name: formData.model_name
          }
        })
      });
      if (res.ok) {
        const result = await res.json();
        addNotification("success", "Thành công", editingConnectionId ? "Đã cập nhật kết nối." : "Đã khởi tạo kết nối. Đang lập chỉ mục...");

        setFormData(prev => ({
          ...prev,
          tools: prev.tools.map(t => t.name === "text2sql" ? { ...t, config: { ...t.config, datasource_id: result.id } } : t)
        }));

        if (result.task_id) {
          startPollingIndexing(result.task_id);
        } else {
          setShowAddConnection(false);
          setEditingConnectionId(null);
        }
      } else {
        const err = await res.json();
        addNotification("error", "Lỗi", err.detail || "Không thể lưu kết nối.");
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Lỗi mạng hoặc server.");
    } finally {
      setIsCreatingConnection(false);
    }
  };

  const handleDeleteConnection = async (dsId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa kết nối này?")) return;

    try {
      const res = await fetchWithAuth(`/connections/${dsId}`, { method: "DELETE" });
      if (res.ok) {
        addNotification("success", "Đã xóa", "Đã xóa kết nối thành công.");
        const connRes = await fetchWithAuth("/connections");
        if (connRes.ok) {
          const data = await connRes.json();
          setAvailableConnections(data);
        }
        if (formData.tools.find(t => t.name === "text2sql")?.config?.datasource_id === dsId) {
          handleToolConfigChange("text2sql", { datasource_id: null });
        }
      } else {
        addNotification("error", "Lỗi", "Không thể xóa kết nối.");
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Lỗi kết nối server.");
    }
  };

  const handleEditConnection = (ds: any) => {
    setNewConnectionData({
      name: ds.name,
      engine: ds.engine,
      host: ds.host,
      port: ds.port,
      database: ds.database,
      schema_name: ds.schema_name,
      username: ds.username,
      plain_password: "",
      extra_params: ds.extra_params || {},
      ssl: ds.ssl || false,
      instructions: ds.instructions || "",
      sql_samples: ds.sql_samples || ""
    });
    setEditingConnectionId(ds.id);
    setShowAddConnection(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const data = new FormData();
    data.append("file", file);

    try {
      const res = await fetchWithAuth("/agents/upload", {
        method: "POST",
        body: data,
      });

      if (!res.ok) throw new Error("Upload failed");

      const result = await res.json();

      const newFile = { ...result, status: "indexing" as const };
      setFormData(prev => ({
        ...prev,
        knowledge_files: [...prev.knowledge_files, newFile]
      }));

      const indexRes = await fetchWithAuth("/agents/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_url: result.url,
          filename: result.filename,
          provider: formData.model_provider,
          model_name: formData.model_name,
          api_key: formData.api_key,
          embedding_provider: formData.embedding_provider,
          embedding_model: formData.embedding_model,
          embedding_api_key: formData.embedding_api_key,
          agent_id: agentId || "temp"
        })
      });

      if (indexRes.ok) {
        const { task_id } = await indexRes.json();
        setFormData(prev => ({
          ...prev,
          knowledge_files: prev.knowledge_files.map(f =>
            f.object_name === result.object_name ? { ...f, task_id } : f
          )
        }));
        startPollingStatus(task_id, result.object_name);
      } else {
        throw new Error("Indexing trigger failed");
      }

    } catch (error) {
      addNotification("error", "Lỗi tải file", "Không thể tải hoặc xử lý tài liệu.");
    } finally {
      setIsUploading(false);
    }
  };

  const startPollingStatus = (taskId: string, objectName: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetchWithAuth(`/agents/tasks/${taskId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "SUCCESS") {
            clearInterval(interval);
            setFormData(prev => {
              const newFiles = prev.knowledge_files.map(f =>
                f.object_name === objectName ? { ...f, status: "completed" as const } : f
              );
              if (agentId) {
                setTimeout(() => {
                  handleSave({ ...prev, knowledge_files: newFiles });
                }, 0);
              }
              return { ...prev, knowledge_files: newFiles };
            });
            addNotification("success", "Indexing hoàn tất", `Tài liệu ${objectName.split('/').pop()} đã sẵn sàng.`);
          } else if (data.status === "FAILURE") {
            clearInterval(interval);
            setFormData(prev => ({
              ...prev,
              knowledge_files: prev.knowledge_files.map(f =>
                f.object_name === objectName ? { ...f, status: "error" } : f
              )
            }));
            addNotification("error", "Lỗi Indexing", "Không thể trích xuất kiến thức từ tài liệu này.");
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
        clearInterval(interval);
      }
    }, 3000);
  };

  const handleSave = async (customPayload?: any) => {
    if (!formData.name && !customPayload?.name) {
      addNotification("warning", "Thiếu thông tin", "Vui lòng nhập tên Agent trước khi lưu.");
      return;
    }

    setIsSaving(true);
    const baseData = customPayload || formData;
    const payload = {
      ...baseData,
      tools: (baseData.tools || []).filter((t: any) => t.name),
      skills: (baseData.skills || []).filter((s: any) => s.name)
    };

    try {
      const res = await fetchWithAuth(agentId ? `/agents/${agentId}` : "/agents/", {
        method: agentId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Save failed");
      setIsDirty(false);
      if (!agentId) {
        const data = await res.json();
        if (data.id) router.push(`/agents/create?id=${data.id}`);
      }
    } catch (error) {
      addNotification("error", "Lỗi hệ thống", "Không thể lưu thông tin Agent.");
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
      <div className={cn(
        "flex-1 overflow-y-auto transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] custom-scrollbar",
        showPreview ? "pl-8 pr-6 pt-0 pb-12" : "pl-10 pr-10 pt-0 pb-20"
      )}>
        <div className={cn("space-y-3 pt-5 transition-all duration-500 mx-auto w-full", showPreview ? "max-w-5xl" : "max-w-[980px]")}>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <Link href="/agents" className="inline-flex items-center text-[10px] font-bold text-muted-foreground/40 hover:text-primary transition-all group">
                <ArrowLeft className="w-2.5 h-2.5 mr-1 group-hover:-translate-x-0.5 transition-transform" />
                QUAY LẠI
              </Link>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-foreground/90 uppercase">Xây dựng Trợ lý AI</h1>
                  <p className="text-[12px] text-muted-foreground font-medium opacity-70 leading-tight">Thiết kế tư duy và quy trình vận hành của các AI Agent.</p>
                </div>
                <div className="flex items-center gap-1 p-0.5 bg-muted/60 dark:bg-zinc-900/40 rounded-lg border shadow-sm self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => setMode("simple")}
                    className={cn(
                      "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-200",
                      mode === "simple"
                        ? "bg-primary text-white shadow-sm animate-in fade-in"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Dễ dùng
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("advanced")}
                    className={cn(
                      "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-200",
                      mode === "advanced"
                        ? "bg-primary text-white shadow-sm animate-in fade-in"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Nâng cao
                  </button>
                </div>
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
              {!showPreview && <div className="w-[1px] h-3 bg-border mx-0.5" />}
              <Button
                onClick={() => handleSave()}
                disabled={isSaving || formData.knowledge_files.some(f => f.status === "indexing")}
                className="rounded-[0.5rem] h-8 px-5 text-[10px] font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-wide disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 mr-2" />
                {isSaving ? "ĐANG LƯU..." : formData.knowledge_files.some(f => f.status === "indexing") ? "ĐANG INDEXING..." : "Lưu"}
              </Button>
            </div>
          </div>

          {mode === "simple" ? (
            <div className="space-y-8 pt-10 max-w-3xl mx-auto w-full animate-in fade-in duration-500 flex flex-col items-center justify-center min-h-[50vh]">
              <div className="text-center space-y-2 mb-4">
                <div className="w-16 h-16 bg-gradient-to-tr from-primary to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/20 mx-auto animate-bounce duration-[3s]">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-foreground/90 uppercase pt-2">Bạn cần Trợ lý AI giúp việc gì?</h2>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-normal">
                  Chỉ cần nhập yêu cầu của bạn dưới dạng ngôn ngữ tự nhiên. AI sẽ tự động biên dịch, đề xuất model, gắn skills, mở tools kết nối và lập sơ đồ tự động hóa phù hợp nhất.
                </p>
              </div>

              <Card className="w-full rounded-2xl border border-white/20 dark:border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.06)] bg-white/70 dark:bg-zinc-950/20 backdrop-blur-xl p-6 overflow-hidden">
                <div className="space-y-4">
                  <div className="relative">
                    <Textarea
                      placeholder="Mô tả chi tiết công việc bạn muốn trợ lý thực hiện... (Ví dụ: Tạo trợ lý giúp tôi tự động đọc Gmail, phân loại email quan trọng, soạn nháp thư trả lời lịch sự và gửi thông báo kiểm duyệt cho tôi trước khi gửi)"
                      className="rounded-xl min-h-[120px] pb-14 pr-4 border-muted-foreground/20 focus:ring-primary/20 bg-background/50 placeholder:text-muted-foreground/40 transition-all text-sm leading-relaxed"
                      value={simpleQuery}
                      onChange={(e) => setSimpleQuery(e.target.value)}
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      <Button
                        onClick={handleBuildWithAI}
                        disabled={isBuildingWithAI || !simpleQuery.trim()}
                        className="rounded-xl h-10 px-6 text-xs font-bold bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-primary/35 hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-wider gap-1.5"
                      >
                        {isBuildingWithAI ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Đang phân tích...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                            Thiết lập bằng AI
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Suggestions list */}
                  <div className="space-y-2 pt-2">
                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest ml-1">Đề xuất gợi ý mẫu</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "Trợ lý Gmail", text: "Tự động đọc Gmail, phân loại email tuyển dụng và thư quan trọng, tự động soạn nháp thư trả lời lịch sự và hỏi lại tôi duyệt trước khi gửi." },
                        { label: "Chăm sóc Fanpage", text: "Trợ lý quản trị Facebook Fanpage, tự động phản hồi tin nhắn của khách hàng và đăng bài cập nhật mới định kỳ." },
                        { label: "Phân tích SQL", text: "Trợ lý kết nối database SQL, tự động phân tích dữ liệu, tự sinh câu truy vấn SQL và tạo báo cáo doanh thu mỗi sáng lúc 8 giờ." },
                        { label: "Trợ lý nghiên cứu PDF", text: "Trợ lý hỗ trợ đọc hiểu tài liệu nghiên cứu PDF, tìm kiếm web chuyên sâu để giải đáp câu hỏi và trích dẫn nguồn." },
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSimpleQuery(item.text)}
                          className="px-3 py-1.5 rounded-lg border border-muted-foreground/15 bg-background/30 hover:border-primary/30 hover:bg-primary/5 text-[10px] font-extrabold text-foreground/80 hover:text-primary transition-all shadow-sm"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[160px_1fr] gap-6 pt-4">
            <div className="hidden lg:block">
              <div className="sticky top-6 space-y-0.5 bg-white/40 dark:bg-zinc-950/20 p-2.5 rounded-2xl border backdrop-blur-xl ring-1 ring-white/10 shadow-sm">
                <div className="px-3 py-1.5 text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest border-b mb-1">Mục lục</div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("general");
                    document.getElementById("sec-general")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-extrabold transition-all duration-200 relative overflow-hidden z-10",
                    activeTab === "general" ? "text-primary font-black" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {activeTab === "general" && (
                    <motion.div
                      layoutId="active-toc-bg"
                      className="absolute inset-0 bg-primary/10 dark:bg-primary/15 rounded-xl -z-10 border border-primary/10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  {activeTab === "general" && (
                    <motion.div 
                      layoutId="active-toc-line" 
                      className="absolute left-0 top-[25%] bottom-[25%] w-[3px] bg-primary rounded-r-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Settings className="w-4 h-4 shrink-0" />
                  Cấu hình
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("intelligence");
                    document.getElementById("sec-intelligence")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-extrabold transition-all duration-200 relative overflow-hidden z-10",
                    activeTab === "intelligence" ? "text-primary font-black" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {activeTab === "intelligence" && (
                    <motion.div
                      layoutId="active-toc-bg"
                      className="absolute inset-0 bg-primary/10 dark:bg-primary/15 rounded-xl -z-10 border border-primary/10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  {activeTab === "intelligence" && (
                    <motion.div 
                      layoutId="active-toc-line" 
                      className="absolute left-0 top-[25%] bottom-[25%] w-[3px] bg-primary rounded-r-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Bot className="w-4 h-4 shrink-0" />
                  Huấn luyện
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("capabilities");
                    document.getElementById("sec-capabilities")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-extrabold transition-all duration-200 relative overflow-hidden z-10",
                    activeTab === "capabilities" ? "text-primary font-black" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {activeTab === "capabilities" && (
                    <motion.div
                      layoutId="active-toc-bg"
                      className="absolute inset-0 bg-primary/10 dark:bg-primary/15 rounded-xl -z-10 border border-primary/10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  {activeTab === "capabilities" && (
                    <motion.div 
                      layoutId="active-toc-line" 
                      className="absolute left-0 top-[25%] bottom-[25%] w-[3px] bg-primary rounded-r-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Wrench className="w-4 h-4 shrink-0" />
                  Công cụ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("automation");
                    document.getElementById("sec-automation")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-extrabold transition-all duration-200 relative overflow-hidden z-10",
                    activeTab === "automation" ? "text-primary font-black" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {activeTab === "automation" && (
                    <motion.div
                      layoutId="active-toc-bg"
                      className="absolute inset-0 bg-primary/10 dark:bg-primary/15 rounded-xl -z-10 border border-primary/10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  {activeTab === "automation" && (
                    <motion.div 
                      layoutId="active-toc-line" 
                      className="absolute left-0 top-[25%] bottom-[25%] w-[3px] bg-primary rounded-r-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Clock className="w-4 h-4 shrink-0" />
                  Quy trình
                </button>
              </div>
            </div>

            <div className="space-y-12 max-w-[800px] w-full">
              <div id="sec-general" className="space-y-6 animate-in fade-in duration-200">
                <section className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
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
                              setFormData({
                                ...formData,
                                model_provider: val,
                                model_name: defaultModel,
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
                            onChange={(e) => {
                              const val = e.target.value;
                              if (formData.api_key?.includes("****") && val.length < formData.api_key.length) {
                                setFormData({ ...formData, api_key: "" });
                              } else {
                                setFormData({ ...formData, api_key: val });
                              }
                            }}
                            placeholder="Nhập API Key của bạn..."
                            className="rounded-[0.5rem] h-12 border-muted-foreground/20 focus:ring-primary/20 transition-all bg-background/50 pr-24 font-mono text-xs shadow-none"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {formData.api_key !== initialKeys.api_key && initialKeys.api_key.includes("****") && (
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, api_key: initialKeys.api_key })}
                                className="text-blue-500 hover:text-blue-600 transition-colors"
                                title="Khôi phục Key cũ"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="text-muted-foreground/40 hover:text-primary/60 transition-colors"
                            >
                              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>

                <section className="space-y-2 pt-4">
                  <div className="flex items-center gap-2 px-1">
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
                            onChange={(e) => {
                              const val = e.target.value;
                              if (formData.embedding_api_key?.includes("****") && val.length < formData.embedding_api_key.length) {
                                setFormData({ ...formData, embedding_api_key: "" });
                              } else {
                                setFormData({ ...formData, embedding_api_key: val });
                              }
                            }}
                            placeholder="Nhập Embedding API Key..."
                            className="rounded-[0.5rem] h-12 border-muted-foreground/20 focus:ring-primary/20 transition-all bg-background/50 pr-24 font-mono text-xs shadow-none"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {formData.embedding_api_key !== initialKeys.embedding_api_key && initialKeys.embedding_api_key.includes("****") && (
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, embedding_api_key: initialKeys.embedding_api_key })}
                                className="text-blue-500 hover:text-blue-600 transition-colors"
                                title="Khôi phục Key cũ"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowEmbeddingApiKey(!showEmbeddingApiKey)}
                              className="text-muted-foreground/40 hover:text-primary/60 transition-colors"
                            >
                              {showEmbeddingApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              </div>

              <div id="sec-intelligence" className="space-y-6 animate-in fade-in duration-300 flex flex-col border-t pt-8 scroll-mt-6">
                <div className="flex items-center justify-between px-1 shrink-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">Kỹ Năng Chuyên Biệt</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="rounded-full bg-blue-500/5 text-blue-600 border-blue-500/20 px-3 py-1 font-bold text-[9px] uppercase tracking-wider">
                      {formData.skills.length} KỸ NĂNG ĐÃ CHỌN
                    </Badge>
                  </div>
                </div>

                <div className={cn(
                  "flex-1 grid gap-6 min-h-0 transition-all duration-300",
                  (showPreview && previewWidth > 400) ? "grid-cols-1 overflow-y-auto custom-scrollbar pr-2" : "grid-cols-1 lg:grid-cols-[380px_1fr]"
                )}>
                  <div className={cn(
                    "flex flex-col min-h-0 transition-all duration-300",
                    (showPreview && previewWidth > 400) && "min-h-[400px] h-[400px]"
                  )}>
                    <Card className="rounded-[1rem] border shadow-xl bg-white/40 dark:bg-white/[0.02] backdrop-blur-2xl flex-1 flex flex-col overflow-hidden ring-1 ring-white/50 dark:ring-white/5">
                      <CardHeader className="px-5 py-4 border-b bg-muted/20">
                        <CardTitle className="text-[11px] font-bold text-foreground/60 uppercase tracking-widest">Thư viện Kỹ năng</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
                        <div className="p-2 space-y-1">
                          <div className="flex items-center justify-between px-3 py-2">
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Kỹ Năng Mẫu</p>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-5 h-5 rounded-md hover:bg-primary/10 hover:text-primary transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-2xl border-primary/10">
                                <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-tight">Thư viện mẫu có sẵn</div>
                                <DropdownMenuSeparator />
                                {availableSkills.filter(s => s.is_template && !formData.skills.some(fs => fs.name === s.name)).length > 0 ? (
                                  availableSkills.filter(s => s.is_template && !formData.skills.some(fs => fs.name === s.name)).map(skill => (
                                    <DropdownMenuItem
                                      key={skill.id}
                                      className="flex flex-col items-start gap-1 p-3 cursor-pointer group"
                                      onClick={() => {
                                        const newTools = [...formData.tools];
                                        if (skill.required_tools && Array.isArray(skill.required_tools)) {
                                          skill.required_tools.forEach((toolName: string) => {
                                            if (!newTools.some(t => t.name === toolName)) {
                                              newTools.push({ name: toolName, is_active: true });
                                            }
                                          });
                                        }
                                        setFormData(prev => ({
                                          ...prev,
                                          skills: [...prev.skills, { name: skill.name, is_active: true }],
                                          tools: newTools
                                        }));
                                        addNotification("success", "Đã thêm", `Đã thêm kỹ năng ${skill.name}`);
                                        if (!previewSkill) setPreviewSkill(skill);
                                      }}
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary">
                                          <Zap className="w-3 h-3" />
                                        </div>
                                        <span className="font-bold text-[12px] group-hover:text-primary transition-colors">{skill.name}</span>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground line-clamp-1 pl-8 italic">{skill.description}</p>
                                    </DropdownMenuItem>
                                  ))
                                ) : (
                                  <div className="p-4 text-center text-[11px] text-muted-foreground italic">Đã thêm tất cả các mẫu</div>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {availableSkills.filter(s => s.is_template && formData.skills.some(fs => fs.name === s.name)).map(skill => {
                            const isActive = formData.skills.some(s => s.name === skill.name);
                            return (
                              <div
                                key={skill.id}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-300 group relative overflow-hidden",
                                  previewSkill?.id === skill.id ? "bg-primary/[0.08] dark:bg-primary/[0.04] border-primary/30 border shadow-md scale-[1.01] ring-1 ring-primary/10" : "hover:bg-muted/40 hover:-translate-y-0.5 hover:shadow border border-transparent"
                                )}
                                onClick={() => setPreviewSkill(skill)}
                              >
                                <div className="flex items-center gap-3 min-w-0 z-10">
                                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-300", isActive ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105" : "bg-muted text-muted-foreground")}>
                                    <Zap className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-bold truncate group-hover:text-primary transition-colors">{skill.name}</p>
                                    <div className="flex items-center gap-1">
                                      <Badge className="bg-primary/5 text-primary border-none text-[8px] h-3 px-1 uppercase font-black">Hệ thống</Badge>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 z-10">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                                    title="Gỡ bỏ khỏi Agent"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFormData(prev => ({ ...prev, skills: prev.skills.filter(s => s.name !== skill.name) }));
                                      addNotification("info", "Đã gỡ", `Đã gỡ kỹ năng ${skill.name}`);
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(22,163,74,0.6)]" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="p-2 space-y-1 border-t">
                          <div className="flex items-center justify-between px-3 py-2">
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Tùy chỉnh</p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-5 h-5 rounded-md hover:bg-primary/10 hover:text-primary transition-colors"
                              onClick={() => setIsCreateSkillOpen(true)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          {availableSkills.filter(s => !s.is_template).length > 0 ? (
                            availableSkills.filter(s => !s.is_template).map((skill, index) => {
                              const isActive = formData.skills.some(s => s.name === skill.name);
                              return (
                                <div
                                  key={skill.id || `custom-skill-${index}`}
                                  className={cn(
                                    "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-300 group relative overflow-hidden",
                                    previewSkill?.id === skill.id ? "bg-amber-500/[0.08] dark:bg-amber-500/[0.04] border-amber-500/30 border shadow-md scale-[1.01] ring-1 ring-amber-500/10" : "hover:bg-muted/40 hover:-translate-y-0.5 hover:shadow border border-transparent"
                                  )}
                                  onClick={() => setPreviewSkill(skill)}
                                >
                                  <div className="flex items-center gap-3 min-w-0 z-10">
                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-300", isActive ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20 scale-105" : "bg-muted text-muted-foreground")}>
                                      <Sparkles className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[13px] font-bold truncate group-hover:text-amber-600 transition-colors">{skill.name}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 z-10">
                                    <div className="flex items-center gap-1 transition-all duration-250 opacity-0 group-hover:opacity-100">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="w-7 h-7 rounded-md hover:bg-amber-500/10 text-muted-foreground/40 hover:text-amber-600 transition-all"
                                        title="Chỉnh sửa kỹ năng"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingSkillId(skill.id);
                                          setNewSkill({ name: skill.name, description: skill.description || "", content: skill.content });
                                          setIsCreateSkillOpen(true);
                                        }}
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="w-7 h-7 rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-all"
                                        title="Xóa kỹ năng"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (confirm(`Bạn có chắc chắn muốn xóa kỹ năng "${skill.name}"?`)) {
                                            try {
                                              const res = await fetchWithAuth(`/skills/${skill.id}`, { method: "DELETE" });
                                              if (res.ok) {
                                                addNotification("success", "Thành công", "Đã xóa kỹ năng");
                                                setAvailableSkills(prev => prev.filter(s => s.id !== skill.id));
                                                if (previewSkill?.id === skill.id) setPreviewSkill(null);
                                                setFormData(prev => ({ ...prev, skills: prev.skills.filter(s => s.name !== skill.name) }));
                                              }
                                            } catch (err) {
                                              addNotification("error", "Lỗi", "Không thể xóa kỹ năng");
                                            }
                                          }
                                        }}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={isActive}
                                      className="w-4 h-4 rounded border-muted-foreground/30 text-amber-500 focus:ring-amber-500/20"
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        if (e.target.checked) {
                                          setFormData(prev => ({ ...prev, skills: [...prev.skills, { name: skill.name, is_active: true }] }));
                                        } else {
                                          setFormData(prev => ({ ...prev, skills: prev.skills.filter(s => s.name !== skill.name) }));
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="px-3 py-8 text-center text-[11px] text-muted-foreground italic">Chưa có kỹ năng tùy chỉnh</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className={cn(
                    "flex-1 flex flex-col min-w-0 transition-all duration-300",
                    (showPreview && previewWidth > 400) && "min-h-[600px] mt-2"
                  )}>
                    <Card className="rounded-[1.5rem] flex-1 border border-primary/15 shadow-xl bg-white/60 dark:bg-zinc-950/40 backdrop-blur-2xl flex flex-col overflow-hidden relative ring-1 ring-white/10 dark:ring-white/5">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(22,163,74,0.012)_1px,transparent_1px),linear-gradient(to_bottom,rgba(22,163,74,0.012)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none -z-10 dark:bg-[linear-gradient(to_right,rgba(22,163,74,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(22,163,74,0.02)_1px,transparent_1px)]" />
                      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px] pointer-events-none -z-10 dark:bg-primary/10" />

                      {previewSkill ? (
                        <>
                          <div className="flex items-center justify-between px-6 py-2 border-b border-muted-foreground/10 bg-black/[0.02] dark:bg-white/[0.01] text-[9px] font-mono tracking-widest text-muted-foreground/70 shrink-0 select-none">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(22,163,74,0.8)]" />
                              <span>SYSTEM_DIRECTIVE_COMPILER: ACTIVE</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span>LINES: <span className="text-foreground font-black">{(previewSkill.content as string).split('\n').length}</span></span>
                              <span>BYTES: <span className="text-foreground font-black">{(previewSkill.content as string).length}</span></span>
                            </div>
                          </div>

                          <CardHeader className="px-8 py-5 border-b bg-muted/5 shrink-0 relative">
                            <div className="absolute right-4 top-4 flex items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-200"
                                title="Sao chép chỉ dẫn"
                                onClick={() => {
                                  navigator.clipboard.writeText(previewSkill.content as string);
                                  addNotification("success", "Sao chép thành công", "Đã sao chép nội dung kỹ năng vào clipboard");
                                }}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-full hover:bg-destructive/10 text-muted-foreground/70 hover:text-destructive transition-all duration-200"
                                onClick={() => setPreviewSkill(null)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="space-y-2 flex-1 min-w-0 pr-16">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                                  <Terminal className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="text-xl font-black tracking-tight truncate text-foreground">{previewSkill.name as string}</h3>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {(previewSkill.is_template as boolean) ? (
                                      <Badge className="bg-primary/10 text-primary border-none font-extrabold text-[8px] h-4 px-1.5">HỆ THỐNG</Badge>
                                    ) : (
                                      <Badge className="bg-amber-500/10 text-amber-600 border-none font-extrabold text-[8px] h-4 px-1.5">TÙY CHỈNH</Badge>
                                    )}
                                    <span className="text-[10px] text-muted-foreground/60 font-mono">ID: {previewSkill.id}</span>
                                  </div>
                                </div>
                              </div>
                              <p className="text-[13px] text-muted-foreground leading-relaxed font-medium mt-2">{(previewSkill.description as string) || "Nội dung chỉ dẫn thực thi kỹ năng."}</p>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="p-8 flex-1 overflow-y-auto custom-scrollbar bg-background/20 dark:bg-black/10 min-h-0 relative">
                            <div className="absolute top-2 left-2 right-2 text-[9px] font-mono text-muted-foreground/20 pointer-events-none select-none flex justify-between">
                              <span>[COMPILER_OUTPUT]</span>
                              <span>[EOF]</span>
                            </div>
                            <div className="markdown-preview max-w-none pt-4 pb-8 font-medium">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {previewSkill.content as string}
                              </ReactMarkdown>
                            </div>
                          </CardContent>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                          <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center text-muted-foreground/30 relative">
                            <Eye className="w-8 h-8" />
                            <div className="absolute inset-0 rounded-2xl border border-dashed border-muted-foreground/30 animate-[spin_20s_linear_infinite]" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-foreground/60 text-sm tracking-wide uppercase">Xem trước Kỹ năng</h3>
                            <p className="text-[12px] text-muted-foreground max-w-xs mt-1 leading-relaxed">Chọn một kỹ năng từ danh sách bên trái để biên dịch và xem nội dung chỉ dẫn Markdown chi tiết của Directive.</p>
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>
                </div>

                <section className="space-y-4 pt-4">
                  <div className="flex items-center gap-2 px-1">
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
                          <div key={idx} className={cn(
                            "p-4 border rounded-[0.5rem] bg-background/50 flex items-center justify-between group transition-all hover:shadow-md",
                            file.status === "indexing" ? "border-primary/30 bg-primary/5 animate-pulse" :
                              file.status === "error" ? "border-destructive/30 bg-destructive/5" : "hover:border-primary/30"
                          )}>
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className={cn(
                                "w-10 h-10 rounded-[0.5rem] flex items-center justify-center shrink-0 border",
                                file.status === "indexing" ? "bg-primary/20 text-primary border-primary/20" :
                                  file.status === "error" ? "bg-destructive/20 text-destructive border-destructive/20" :
                                    "bg-red-500/10 text-red-500 border-red-500/10"
                              )}>
                                {file.status === "indexing" ? (
                                  <Sparkles className="w-5 h-5 animate-spin" />
                                ) : (
                                  <span className="text-[10px] font-bold uppercase">{file.filename.split('.').pop()}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 pr-2">
                                <p className="text-xs font-bold truncate text-foreground/90">{file.filename}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {file.status === "indexing" ? (
                                    <>
                                      <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                                      <p className="text-[9px] text-primary font-bold uppercase tracking-tight">Đang trích xuất tri thức...</p>
                                    </>
                                  ) : file.status === "error" ? (
                                    <>
                                      <div className="w-1 h-1 rounded-full bg-destructive" />
                                      <p className="text-[9px] text-destructive font-bold uppercase tracking-tight">Lỗi Indexing</p>
                                    </>
                                  ) : (
                                    <>
                                      <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                      <p className="text-[9px] text-muted-foreground font-medium">Sẵn sàng huấn luyện</p>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-[0.5rem] shrink-0 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                              onClick={() => setFormData({
                                ...formData,
                                knowledge_files: formData.knowledge_files.filter((_, i) => i !== idx)
                              })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </section>
              </div>

              <div id="sec-capabilities" className="space-y-10 animate-in fade-in duration-200 border-t pt-8 scroll-mt-6">
                <section className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-foreground/90">Công cụ hỗ trợ</h2>
                    </div>
                    <Button
                      variant="ghost"
                      className="rounded-lg h-8 px-3 text-[11px] font-bold text-primary hover:bg-primary/5 transition-all"
                      onClick={() => setShowAddTool(true)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Quản lý công cụ
                    </Button>
                  </div>
                  <div className="space-y-6">
                    {(() => {
                      const toolMap = new Map(availableTools.map(t => [t.name, t]));
                      const groupedTools = formData.tools.reduce((acc, toolObj) => {
                        const toolInfo = toolMap.get(toolObj.name);
                        const cat = toolInfo?.category || "Cơ bản";
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push({ ...toolObj, info: toolInfo });
                        return acc;
                      }, {} as Record<string, any[]>);

                      if (formData.tools.length === 0) {
                        return (
                          <div className="flex flex-col border rounded-xl bg-white/50 dark:bg-white/[0.02] shadow-sm">
                            <div className="px-8 py-12 text-center space-y-3">
                              <div className="w-12 h-12 rounded-xl bg-muted/20 flex items-center justify-center mx-auto text-muted-foreground/30">
                                <Wrench className="w-6 h-6" />
                              </div>
                              <p className="text-[13px] text-muted-foreground italic">Chưa có công cụ nào được kích hoạt.</p>
                            </div>
                          </div>
                        );
                      }

                      return Object.entries(groupedTools).map(([category, tools]) => (
                        <div key={category} className="space-y-3">
                          <div className="flex items-center justify-between w-full px-2 group/cat">
                            <div className="flex items-center gap-2">
                              <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 group-hover/cat:text-blue-500 transition-colors">{category}</h3>
                              <Badge variant="outline" className="text-[8px] h-3.5 px-1.5 opacity-50">{tools.length}</Badge>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setExpandedCategories(prev => ({ ...prev, [`main-${category}`]: !prev[`main-${category}`] }))}
                              className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/50"
                            >
                              <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-300", (expandedCategories[`main-${category}`] ?? true) && "rotate-90")} />
                            </Button>
                          </div>
                          {(expandedCategories[`main-${category}`] ?? true) && (
                            <div className="border rounded-xl bg-white/50 dark:bg-white/[0.02] shadow-sm overflow-hidden">
                              {tools.map((toolObj, toolIndex) => {
                                const toolName = toolObj.name;
                                return (
                                  <ToolItem
                                    key={`${category}-${toolName}-${toolIndex}`}
                                    name={toolObj.label || toolObj.info?.label || toolObj.info?.name || toolName}
                                    desc={toolObj.description || toolObj.info?.description || ""}
                                    active={toolObj.is_active}
                                    category={category}
                                    onToggle={() => {
                                      const newTools = formData.tools.map(t =>
                                        t.name === toolName ? { ...t, is_active: !t.is_active } : t
                                      );
                                      setFormData(prev => ({ ...prev, tools: newTools }));
                                      if (agentId) handleSave({ ...formData, tools: newTools });
                                    }}
                                    onDelete={() => {
                                      setConfirmConfig({
                                        open: true,
                                        title: "Xác nhận xóa",
                                        description: `Bạn có chắc muốn gỡ bỏ công cụ ${toolObj.label || toolName}?`,
                                        onConfirm: () => {
                                          const newTools = formData.tools.filter(t => t.name !== toolName);
                                          setFormData(prev => ({ ...prev, tools: newTools }));
                                          if (agentId) handleSave({ ...formData, tools: newTools });
                                          addNotification("info", "Đã gỡ", `Đã gỡ công cụ ${toolObj.label || toolName}`);
                                        }
                                      });
                                    }}
                                    onSettings={() => {
                                      setEditingTool(toolObj);
                                      setToolOverrideData({
                                        label: toolObj.label || toolObj.info?.label || toolName,
                                        description: toolObj.description || toolObj.info?.description || ""
                                      });
                                      setShowToolConfig(true);
                                    }}
                                  >
                                    {toolName === "text2sql" && (
                                      <div className="space-y-4">
                                        <div className="flex items-center justify-between px-1">
                                          <div className="flex items-center gap-2">
                                            <Network className="w-3.5 h-3.5 text-primary" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/70">Kết nối cơ sở dữ liệu</p>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 rounded-lg text-[9px] font-bold text-primary hover:bg-primary/5 transition-all group"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setIsDataSourceSelectOpen(false);
                                              setShowAddConnection(true);
                                              setEditingConnectionId(null);
                                            }}
                                          >
                                            <Plus className="w-3 h-3 mr-1" />
                                            THÊM MỚI
                                          </Button>
                                        </div>
                                        <div className="space-y-1.5">
                                          <label className="text-[10px] font-bold uppercase opacity-50 ml-1">Thêm nguồn dữ liệu</label>
                                          <Select
                                            open={isDataSourceSelectOpen}
                                            onOpenChange={setIsDataSourceSelectOpen}
                                            value=""
                                            onValueChange={(val) => {
                                              if (!val) return;
                                              const config = toolObj.config || {};
                                              const currentIds = (config.datasource_ids as string[]) || (config.datasource_id ? [config.datasource_id as string] : []);
                                              if (currentIds.includes(val)) return;
                                              const nextIds = [...currentIds, val];
                                              const newTools = formData.tools.map(t => t.name === "text2sql" ? {
                                                ...t,
                                                config: { ...config, datasource_ids: nextIds, datasource_id: nextIds[0] }
                                              } : t);
                                              setFormData(prev => ({ ...prev, tools: newTools }));
                                              if (agentId) handleSave({ ...formData, tools: newTools });
                                            }}
                                          >
                                            <SelectTrigger className="h-10 rounded-xl bg-background/50 border-muted-foreground/20 text-xs font-bold shadow-sm">
                                              <SelectValue placeholder="Chọn kết nối để thêm vào Agent..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-muted-foreground/20 shadow-2xl">
                                              {availableConnections.length > 0 ? (
                                                availableConnections.map((conn) => (
                                                  <SelectItem key={conn.id} value={conn.id} className="text-xs font-medium rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                      <Database className="w-3.5 h-3.5 text-muted-foreground/50" />
                                                      {conn.name} ({conn.engine})
                                                    </div>
                                                  </SelectItem>
                                                ))
                                              ) : (
                                                <div className="p-4 text-center">
                                                  <p className="text-[10px] text-muted-foreground mb-2">Chưa có kết nối nào.</p>
                                                </div>
                                              )}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-2">
                                          {((toolObj.config?.datasource_ids as string[]) || (toolObj.config?.datasource_id ? [toolObj.config.datasource_id as string] : [])).map((dsId: string) => {
                                            const selectedDs = availableConnections.find((c) => c.id === dsId);
                                            if (!selectedDs) return null;
                                            return (
                                              <div key={dsId} className="p-3 bg-primary/[0.02] border border-primary/10 rounded-xl flex items-center justify-between shadow-sm">
                                                <div className="flex items-center gap-3">
                                                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center border border-primary/10 shadow-sm">
                                                    <Database className="w-5 h-5 text-primary" />
                                                  </div>
                                                  <div>
                                                    <p className="text-xs font-bold text-foreground/80">{selectedDs.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                      <Badge variant="outline" className="text-[8px] h-3.5 px-1.5 font-bold uppercase bg-primary/5 text-primary border-none">
                                                        {selectedDs.engine}
                                                      </Badge>
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="w-7 h-7 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                                                    onClick={() => {
                                                      const currentIds = (toolObj.config?.datasource_ids as string[]) || (toolObj.config?.datasource_id ? [toolObj.config.datasource_id as string] : []);
                                                      const nextIds = currentIds.filter(id => id !== dsId);
                                                      const newTools = formData.tools.map(t => t.name === "text2sql" ? {
                                                        ...t,
                                                        config: {
                                                          ...t.config,
                                                          datasource_ids: nextIds,
                                                          datasource_id: nextIds[0] || null
                                                        }
                                                      } : t);
                                                      setFormData(prev => ({ ...prev, tools: newTools }));
                                                    }}
                                                    title="Gỡ bỏ khỏi danh sách"
                                                  >
                                                    <X className="w-3.5 h-3.5" />
                                                  </Button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <p className="text-[9px] text-muted-foreground italic ml-1 opacity-60 leading-tight">Lưu ý: Agent sẽ dùng Embedding Model & API Key đã thiết lập ở tab &quot;Cấu hình&quot; để truy cập nguồn này.</p>
                                      </div>
                                    )}
                                </ToolItem>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </section>
              </div>

              {/* --- Section 4: Automation & Workflows --- */}
              <div id="sec-automation" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 border-t pt-8 scroll-mt-6">
              <section className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <h2 className="text-xl font-bold">Liên kết Quy trình tự động (Workflow Binding)</h2>
                </div>
                <Card className="rounded-2xl border shadow-sm bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl">
                  <CardContent className="p-8 space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-600 shrink-0 shadow-inner">
                        <GitBranch className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-bold">Chạy tác tử theo Quy trình đồ thị</h3>
                        <p className="text-xs text-muted-foreground leading-normal max-w-lg">
                          Gán một quy trình tự động hóa dạng đồ thị (LangGraph) để định cấu hình các bước suy nghĩ, gọi công cụ, kiểm duyệt HITL hoặc chạy mã script Python tùy chỉnh cho tác tử này.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Chọn Quy trình liên kết (Workflow)</label>
                      <div className="flex gap-3">
                        <select
                          value={formData.workflow_id || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({ ...prev, workflow_id: val || "" }));
                            setIsDirty(true);
                          }}
                          className="flex-1 h-11 rounded-xl border border-muted-foreground/20 bg-background px-3.5 text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                        >
                          <option value="">Không sử dụng quy trình (Chạy độc lập mặc định)</option>
                          {availableWorkflows.map((wf) => (
                            <option key={wf.id} value={wf.id}>
                              {wf.name} ({wf.description || "Không có mô tả"})
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => router.push("/workflows")}
                          className="h-11 px-5 rounded-xl text-xs font-bold border-purple-500/20 hover:bg-purple-500/5 text-purple-600 gap-1.5 transition-all shadow-sm cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Thiết kế mới
                        </Button>
                      </div>
                    </div>

                    {formData.workflow_id && (
                      <div className="p-4 bg-purple-500/[0.02] border border-purple-500/10 rounded-xl flex items-center justify-between shadow-inner animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center border shadow-sm">
                            <Zap className="w-4 h-4 text-purple-600 animate-pulse" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground/80">
                              Đang liên kết: {availableWorkflows.find(w => w.id === formData.workflow_id)?.name || "Quy trình đã chọn"}
                            </p>
                            <p className="text-[9px] text-muted-foreground font-semibold">Tác tử sẽ tự động bỏ qua luồng chat thông thường và thực thi LangGraph đồ thị.</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/workflows/${formData.workflow_id}`)}
                          className="h-8 px-3 rounded-lg text-[10px] font-bold text-purple-600 hover:bg-purple-500/10 transition-all shrink-0 cursor-pointer"
                        >
                          Mở thiết kế
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* --- Right Side: Preview Chat --- */}
      {showPreview && (
        <div
          style={{ width: `${previewWidth}px` }}
          className={cn(
            "p-4 h-full relative transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] shrink-0",
            isResizing && "transition-none" // Tắt animation khi đang kéo để mượt
          )}
        >
          {/* Resize Handle - Edge Left */}
          <div
            onMouseDown={startResizing}
            className={cn(
              "absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-[100] group",
              isResizing ? "bg-primary/20" : "hover:bg-primary/10"
            )}
          >
            <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-muted-foreground/20 group-hover:bg-primary/40 transition-colors" />
          </div>

          <ChatInterface
            agentId={agentId}
            agentName={formData.name}
            isEmbed={true}
            onClose={() => setShowPreview(false)}
            showAudit={true}
          />
        </div>
      )}

      {/* Build with AI Agent Blueprint Diff Modal */}
      <Dialog open={showBlueprintDiff} onOpenChange={setShowBlueprintDiff}>
        <DialogContent className="max-w-2xl rounded-2xl border bg-white/90 dark:bg-zinc-950/80 backdrop-blur-2xl shadow-2xl p-6">
          <DialogHeader className="border-b pb-4 mb-4">
            <DialogTitle className="text-lg font-black tracking-tight text-primary flex items-center gap-2">
              <Sparkles className="w-5 h-5 animate-bounce" />
              SƠ ĐỒ CẤU HÌNH TRỢ LÝ AI (BLUEPRINT)
            </DialogTitle>
            <DialogDescription className="text-xs">
              AI đã tự động lập lịch trình và thiết lập các quyền vận hành tối ưu dựa trên mô tả của bạn.
            </DialogDescription>
          </DialogHeader>

          {blueprintData && (
            <div className="space-y-6 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 p-3 bg-muted/40 rounded-xl border">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Tên trợ lý đề xuất</p>
                  <p className="text-sm font-bold text-foreground/90">{blueprintData.name}</p>
                </div>
                <div className="space-y-1 p-3 bg-muted/40 rounded-xl border">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Tự động hóa (Trigger)</p>
                  <p className="text-sm font-bold text-foreground/90">{blueprintData.automation}</p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1 p-3 bg-muted/40 rounded-xl border">
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Nhiệm vụ & Chức năng</p>
                <p className="text-xs text-foreground/80 leading-relaxed font-medium">{blueprintData.description}</p>
              </div>

              {/* Skills and Tools Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 p-3 bg-muted/40 rounded-xl border">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Kỹ năng được gán (Skills)</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {blueprintData.skills.map((s, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-lg py-0.5 px-2 font-bold">{s}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 p-3 bg-muted/40 rounded-xl border">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Công cụ kích hoạt (Tools)</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {blueprintData.tools.map((t, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] rounded-lg py-0.5 px-2 border-muted-foreground/30 font-semibold">{t}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Permissions & Security contract */}
              <div className="space-y-2.5 p-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-black tracking-wider">Cam kết quyền & An toàn (Permissions Contract)</p>
                <ul className="space-y-1.5 text-xs text-foreground/80 font-medium">
                  {blueprintData.permissions.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-500 shrink-0 select-none">✦</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Prompt Preview */}
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider ml-1">Bản xem trước System Prompt tự sinh</p>
                <pre className="p-3 bg-zinc-950 text-zinc-300 rounded-xl text-[10px] font-mono whitespace-pre-wrap leading-relaxed border max-h-[150px] overflow-y-auto custom-scrollbar">
                  {blueprintData.system_instructions}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-4 mt-4 flex sm:justify-between items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowBlueprintDiff(false)}
              className="rounded-xl h-10 px-5 text-xs font-bold border-muted-foreground/30 text-muted-foreground uppercase tracking-wider"
            >
              Hủy
            </Button>
            <Button
              onClick={handleApplyBlueprint}
              className="rounded-xl h-10 px-6 text-xs font-bold bg-primary text-white shadow-xl shadow-primary/20 hover:shadow-primary/30 uppercase tracking-wider animate-in fade-in duration-300"
            >
              Áp dụng & Thiết lập
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <div className="space-y-8">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={availableToolSearch}
                    onChange={(e) => setAvailableToolSearch(e.target.value)}
                    placeholder="Tìm theo tên tool, ID hoặc mô tả..."
                    className="h-12 rounded-2xl pl-11 border-muted-foreground/20 bg-white dark:bg-zinc-900/70"
                  />
                </div>

                {filteredAvailableToolGroups.length > 0 ? filteredAvailableToolGroups.map(([category, tools]) => (
                  <div key={category} className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">{category}</h3>
                      <Badge variant="outline" className="text-[8px] h-4 px-1.5 opacity-60">{tools.length}</Badge>
                      {category === "Facebook Fanpage" && !user?.is_facebook_connected && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[8px] font-black border-blue-500/50 text-blue-600 bg-blue-500/5 hover:bg-blue-500/10 rounded-md"
                          onClick={handleConnectFacebook}
                        >
                          KẾT NỐI META
                        </Button>
                      )}
                      {category === "Facebook Fanpage" && user?.is_facebook_connected && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[8px] font-black border-blue-500/30 text-blue-600 bg-blue-500/5 hover:bg-blue-500/10 rounded-md"
                          onClick={() => fetchFacebookPages(true)}
                        >
                          {selectedFacebookPageName ? `PAGE: ${selectedFacebookPageName}` : "CHỌN PAGE"}
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      {tools.map((tool) => {
                        const existingTool = formData.tools.find(t => t.name === tool.name);
                        const isActive = !!existingTool;
                        return (
                          <div
                            key={tool.name}
                            className={cn(
                              "p-4 border rounded-2xl transition-all duration-300 flex items-start gap-4 group relative overflow-hidden",
                              isActive
                                ? "bg-primary/[0.03] border-primary/30 shadow-sm"
                                : "bg-white dark:bg-zinc-900/50 hover:border-primary/50 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
                            )}
                            onClick={() => {
                              if (!isActive) {
                                setFormData(prev => ({
                                  ...prev,
                                  tools: [...prev.tools, { name: tool.name, is_active: true }]
                                }));
                                addNotification("success", "Đã thêm công cụ", `Đã thêm ${tool.label || tool.name} thành công.`);
                              }
                            }}
                          >
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-500 shadow-sm",
                              isActive ? "bg-white dark:bg-zinc-800 border-primary/20 shadow-primary/10" : "bg-muted/30 group-hover:bg-primary/5 group-hover:border-primary/20 group-hover:scale-110"
                            )}>
                              {getToolIcon(tool.name, category, "w-6 h-6")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-sm font-bold leading-tight group-hover:text-primary transition-colors">{tool.label || tool.name}</p>
                                {isActive && (
                                  <Badge className="shrink-0 text-[8px] h-4 bg-primary/10 text-primary border-none font-black px-1.5 uppercase tracking-tighter">ĐÃ THÊM</Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 font-medium">
                                {tool.description}
                              </p>
                            </div>

                            {!isActive && (
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                  <Plus className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-muted-foreground/20 p-10 text-center">
                    <p className="text-sm font-semibold text-muted-foreground">Không tìm thấy tool nào khớp.</p>
                  </div>
                )}
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

      {/* Skill Selection Modal Overlay */}
      {showAddSkill && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500">
          <div
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-md"
            onClick={() => setShowAddSkill(false)}
          />
          <Card className="w-full max-w-2xl relative z-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border-white/20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl animate-in zoom-in-95 duration-300 overflow-hidden rounded-[2rem]">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
              <div>
                <CardTitle className="text-lg font-bold">Thư viện Kỹ năng</CardTitle>
                <CardDescription className="text-xs">Chọn các kỹ năng chuyên sâu để định hình tư duy cho Agent.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowAddSkill(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableSkills.map((skill) => {
                  const existingSkill = formData.skills.find(s => s.name === skill.name);
                  const isActive = !!existingSkill;
                  return (
                    <div
                      key={skill.name}
                      className={cn(
                        "p-4 border rounded-xl transition-all duration-300 flex items-start gap-4 group relative overflow-hidden",
                        isActive
                          ? "bg-amber-500/5 border-amber-500/30"
                          : "bg-white hover:border-amber-500/50 hover:shadow-md cursor-pointer"
                      )}
                      onClick={() => {
                        if (!isActive) {
                          // Logic Tự động nạp Tool nếu Skill yêu cầu Gmail
                          let updatedTools = [...formData.tools];
                          // Phân rã "Gmail" nếu còn sót lại
                          updatedTools = updatedTools.filter(t => t.name !== "Gmail");

                          if (skill.required_tools?.includes("Gmail") || skill.name.toLowerCase().includes("gmail")) {
                            const gmailTools = availableTools.filter(t => t.category === "Gmail");
                            gmailTools.forEach(gt => {
                              if (!updatedTools.find(t => t.name === gt.name)) {
                                updatedTools.push({ name: gt.name, is_active: true });
                              }
                            });
                            addNotification("info", "Tự động kích hoạt", "Đã tự động nạp các công cụ Gmail chuyên nghiệp.");
                          }

                          setFormData(prev => ({
                            ...prev,
                            skills: [...prev.skills, { name: skill.name, is_active: true }],
                            tools: updatedTools
                          }));
                          addNotification("success", "Đã thêm kỹ năng", `Đã thêm ${skill.name} thành công.`);
                        }
                      }}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                        isActive ? "bg-amber-500 text-white" : "bg-muted group-hover:bg-amber-500/10 group-hover:text-amber-500"
                      )}>
                        <Zap className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-bold truncate">{skill.name}</p>
                          {isActive && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">ĐÃ THÊM</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                          {skill.description}
                        </p>
                      </div>

                      {!isActive && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="w-4 h-4 text-amber-500" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <div className="p-4 border-t bg-muted/10 flex justify-end">
              <Button
                onClick={() => setShowAddSkill(false)}
                className="rounded-lg h-10 px-8 text-xs font-bold bg-amber-500 text-white shadow-lg shadow-amber-500/20"
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

      <Dialog open={showFacebookPagePicker} onOpenChange={setShowFacebookPagePicker}>
        <DialogContent className="sm:max-w-[620px] rounded-[1.5rem] p-0 overflow-hidden">
          <div className="p-6 border-b bg-blue-500/[0.03]">
            <DialogTitle className="text-xl font-bold">Chọn Fanpage mặc định</DialogTitle>
            <DialogDescription className="text-xs font-medium mt-1">
              Agent sẽ ưu tiên dùng Fanpage này cho các Facebook tools nếu bạn không override `page_id`.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {isLoadingFacebookPages ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Đang tải danh sách Fanpage...</div>
            ) : facebookPages.length > 0 ? (
              facebookPages.map((page) => {
                const isSelected = selectedFacebookPageId === page.id;
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => handleSelectFacebookPage(page.id)}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl border transition-all",
                      isSelected
                        ? "border-blue-500/40 bg-blue-500/[0.04] shadow-sm"
                        : "border-muted-foreground/15 hover:border-blue-500/30 hover:bg-blue-500/[0.02]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground/90 truncate">{page.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Page ID: {page.id}</p>
                        {page.tasks?.length ? (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Quyền: {page.tasks.join(", ")}
                          </p>
                        ) : null}
                      </div>
                      {isSelected ? (
                        <Badge className="bg-blue-500/10 text-blue-600 border-none">Đang dùng</Badge>
                      ) : (
                        <Badge variant="outline">Chọn</Badge>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-10 text-center space-y-3">
                <p className="text-sm font-semibold text-muted-foreground">Tài khoản này chưa có Fanpage nào khả dụng.</p>
                <Button variant="outline" className="rounded-xl" onClick={handleConnectFacebook}>
                  Kết nối lại Meta
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tool Configuration Modal */}
      <Dialog open={showToolConfig} onOpenChange={setShowToolConfig}>
        <DialogContent className="sm:max-w-[550px] rounded-[1.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary/5 p-8 border-b border-primary/10">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm border border-primary/10">
                {editingTool && getToolIcon(editingTool.name, undefined, "w-6 h-6")}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Cấu hình công cụ</DialogTitle>
                <DialogDescription className="font-medium text-xs opacity-70">
                  Tùy chỉnh cách Agent hiểu và sử dụng công cụ này.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Tên hiển thị (Label)</label>
              <Input
                placeholder="VD: Tìm kiếm email khách hàng"
                value={toolOverrideData.label}
                onChange={(e) => setToolOverrideData({ ...toolOverrideData, label: e.target.value })}
                className="rounded-xl h-12 border-muted-foreground/20 focus:ring-primary/20 bg-muted/5 font-medium"
              />
              <p className="text-[10px] text-muted-foreground italic ml-1">Mẹo: Tên rõ ràng giúp LLM quyết định gọi công cụ chính xác hơn.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Mô tả chi tiết (Description)</label>
              <Textarea
                placeholder="Mô tả khi nào Agent nên dùng công cụ này và nó trả về kết quả gì..."
                value={toolOverrideData.description}
                onChange={(e) => setToolOverrideData({ ...toolOverrideData, description: e.target.value })}
                className="rounded-xl min-h-[120px] border-muted-foreground/20 focus:ring-primary/20 bg-muted/5 font-medium resize-none"
              />
            </div>

            {/* Dynamic Parameter Form */}
            {editingTool?.info?.supported_params && editingTool.info.supported_params.length > 0 && (
              <div className="space-y-5 pt-2">
                <div className="flex items-center gap-2 ml-1">
                  <Settings className="w-3.5 h-3.5 text-primary" />
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground">Cấu hình tham số</label>
                </div>

                <div className="grid grid-cols-1 gap-5 p-5 bg-muted/20 rounded-2xl border border-muted-foreground/10">
                  {editingTool.info.supported_params.map((param: { key: string; label: string; type: string; default?: string | number; desc?: string; options?: { value: string; label: string }[] }) => (
                    <div key={param.key} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-foreground/80 ml-1">{param.label}</label>
                        <span className="text-[10px] font-mono text-muted-foreground opacity-50 uppercase">{param.key}</span>
                      </div>

                      {param.type === "select" ? (
                        <Select
                          value={editingTool.params?.[param.key] || param.default}
                          onValueChange={(val) => {
                            const currentParams = editingTool.params || {};
                            setEditingTool({ ...editingTool, params: { ...currentParams, [param.key]: val } });
                          }}
                        >
                          <SelectTrigger className="rounded-xl h-10 bg-background border-muted-foreground/20">
                            <SelectValue placeholder={`Chọn ${param.label.toLowerCase()}...`} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-muted-foreground/20">
                            {param.options?.map((opt: { value: string; label: string }) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs font-medium">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={param.type === "number" ? "number" : "text"}
                          placeholder={param.desc || `Nhập ${param.label.toLowerCase()}...`}
                          value={(editingTool.params?.[param.key] as string | number) ?? (param.default as string | number) ?? ""}
                          onChange={(e) => {
                            const val = param.type === "number" ? parseInt(e.target.value) : e.target.value;
                            const currentParams = editingTool.params || {};
                            setEditingTool({ ...editingTool, params: { ...currentParams, [param.key]: val } });
                          }}
                          className="rounded-xl h-10 bg-background border-muted-foreground/20 text-xs font-medium"
                        />
                      )}
                      {param.desc && <p className="text-[10px] text-muted-foreground italic ml-1">{param.desc}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Operational Settings */}
            <div className="space-y-5 pt-4 border-t border-dashed border-muted-foreground/10">
              <div className="flex items-center gap-2 ml-1">
                <Bot className="w-3.5 h-3.5 text-primary" />
                <label className="text-[11px] font-bold uppercase tracking-widest text-foreground">Cài đặt vận hành</label>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 bg-primary/[0.02] rounded-2xl border border-primary/10">
                {/* Human in the loop */}
                <div className="flex items-center justify-between p-1">
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-foreground/80">Cần phê duyệt (Human-in-the-loop)</label>
                    <p className="text-[10px] text-muted-foreground italic leading-none">Dừng lại và chờ bạn xác nhận trước khi thực thi công cụ.</p>
                  </div>
                  <div
                    className={cn(
                      "w-10 h-5 rounded-full p-1 cursor-pointer transition-colors duration-300",
                      editingTool?.params?.human_in_loop ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                    onClick={() => {
                      if (!editingTool) return;
                      const currentParams = editingTool.params || {};
                      setEditingTool({ ...editingTool, params: { ...currentParams, human_in_loop: !currentParams.human_in_loop } });
                    }}
                  >
                    <div className={cn(
                      "w-3 h-3 bg-white rounded-full transition-transform duration-300",
                      editingTool?.params?.human_in_loop ? "translate-x-5" : "translate-x-0"
                    )} />
                  </div>
                </div>

                {/* Rate Limit */}
                <div className="space-y-2 pt-2 border-t border-primary/5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-foreground/80">Giới hạn lượt gọi (Rate Limit)</label>
                    <span className="text-[10px] font-medium text-muted-foreground opacity-70">lần/phút</span>
                  </div>
                  <Input
                    type="number"
                    placeholder="Không giới hạn"
                    value={(editingTool?.params?.rate_limit as string | number) || ""}
                    onChange={(e) => {
                      if (!editingTool) return;
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      const currentParams = editingTool.params || {};
                      setEditingTool({ ...editingTool, params: { ...currentParams, rate_limit: val } });
                    }}
                    className="rounded-xl h-10 bg-background border-muted-foreground/20 text-xs font-medium"
                  />
                  <p className="text-[10px] text-muted-foreground italic ml-1 leading-relaxed">
                    Tránh việc Agent lặp lại tool quá nhiều lần hoặc vượt quá hạn ngạch API.
                  </p>
                </div>

                {/* Run Limit */}
                <div className="space-y-2 pt-2 border-t border-primary/5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-foreground/80">Giới hạn mỗi lượt (Run Limit)</label>
                    <span className="text-[10px] font-medium text-muted-foreground opacity-70">lần/tin nhắn</span>
                  </div>
                  <Input
                    type="number"
                    placeholder="Không giới hạn"
                    value={(editingTool?.params?.run_limit as string | number) || ""}
                    onChange={(e) => {
                      if (!editingTool) return;
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      const currentParams = editingTool.params || {};
                      setEditingTool({ ...editingTool, params: { ...currentParams, run_limit: val } });
                    }}
                    className="rounded-xl h-10 bg-background border-muted-foreground/20 text-xs font-medium"
                  />
                </div>

                {/* Thread Limit */}
                <div className="space-y-2 pt-2 border-t border-primary/5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-foreground/80">Tổng giới hạn (Thread Limit)</label>
                    <span className="text-[10px] font-medium text-muted-foreground opacity-70">lần/phiên</span>
                  </div>
                  <Input
                    type="number"
                    placeholder="Không giới hạn"
                    value={(editingTool?.params?.thread_limit as string | number) || ""}
                    onChange={(e) => {
                      if (!editingTool) return;
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      const currentParams = editingTool.params || {};
                      setEditingTool({ ...editingTool, params: { ...currentParams, thread_limit: val } });
                    }}
                    className="rounded-xl h-10 bg-background border-muted-foreground/20 text-xs font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/20 gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowToolConfig(false)}
              className="rounded-xl h-11 px-6 font-bold"
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={() => {
                if (!editingTool) return;
                const newTools = formData.tools.map(t =>
                  t.name === editingTool.name ? {
                    ...t,
                    label: toolOverrideData.label,
                    description: toolOverrideData.description,
                    params: editingTool.params
                  } : t
                );
                setFormData({ ...formData, tools: newTools });
                setShowToolConfig(false);
                addNotification("success", "Đã cập nhật", `Đã lưu cấu hình cho công cụ ${editingTool.name}`);
                if (agentId) {
                  handleSave({ ...formData, tools: newTools });
                }
              }}
              className="rounded-xl h-11 px-8 font-bold bg-primary text-white shadow-lg shadow-primary/20"
            >
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Create New Connection */}
      <Dialog open={showAddConnection} onOpenChange={setShowAddConnection}>
        <DialogContent className="sm:max-w-[500px] rounded-[1rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Plus className="w-6 h-6 text-primary" />
              Tạo kết nối mới
            </DialogTitle>
            <DialogDescription className="font-medium">
              Kết nối trực tiếp nguồn dữ liệu cho Agent này.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tên kết nối</label>
                <Input
                  placeholder="VD: PostgreSQL Production"
                  value={newConnectionData.name}
                  onChange={(e) => setNewConnectionData({ ...newConnectionData, name: e.target.value })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Engine</label>
                <select
                  className="w-full h-10 px-3 py-2 rounded-[0.5rem] border bg-background text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                  value={newConnectionData.engine}
                  onChange={(e) => setNewConnectionData({ ...newConnectionData, engine: e.target.value })}
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="snowflake">Snowflake</option>
                  <option value="bigquery">Google BigQuery</option>
                  <option value="powerbi">Power BI Dataset</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Host / Endpoint</label>
                <Input
                  placeholder="localhost or IP"
                  value={newConnectionData.host}
                  onChange={(e) => setNewConnectionData({ ...newConnectionData, host: e.target.value })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Port</label>
                <Input
                  type="number"
                  value={newConnectionData.port}
                  onChange={(e) => setNewConnectionData({ ...newConnectionData, port: parseInt(e.target.value) })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Database Name</label>
                <Input
                  placeholder="my_database"
                  value={newConnectionData.database}
                  onChange={(e) => setNewConnectionData({ ...newConnectionData, database: e.target.value })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Schema (Optional)</label>
                <Input
                  placeholder="public"
                  value={newConnectionData.schema_name}
                  onChange={(e) => setNewConnectionData({ ...newConnectionData, schema_name: e.target.value })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Username</label>
                <Input
                  placeholder="admin"
                  value={newConnectionData.username}
                  onChange={(e) => setNewConnectionData({ ...newConnectionData, username: e.target.value })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={newConnectionData.plain_password}
                  onChange={(e) => setNewConnectionData({ ...newConnectionData, plain_password: e.target.value })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 flex flex-col gap-4">
            {indexingTask ? (
              <div className="w-full p-4 rounded-xl bg-muted/30 border border-primary/20 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {indexingTask.status === "processing" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : indexingTask.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/80">
                      {indexingTask.status === "processing" ? "Đang trích xuất schema..." :
                        indexingTask.status === "completed" ? "Đã lập chỉ mục xong!" : "Lỗi lập chỉ mục"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{indexingTask.id.slice(0, 8)}</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className={cn(
                    "h-full transition-all duration-500",
                    indexingTask.status === "processing" ? "w-2/3 bg-primary animate-pulse" :
                      indexingTask.status === "completed" ? "w-full bg-emerald-500" : "w-full bg-destructive"
                  )} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 leading-tight">
                  {indexingTask.status === "processing" ? "Vui lòng đợi, hệ thống đang lưu cấu trúc database vào Vector DB." :
                    indexingTask.status === "completed" ? "Đã gán và sẵn sàng sử dụng." : "Đã có lỗi xảy ra."}
                </p>
              </div>
            ) : (
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  className="flex-1 rounded-[0.5rem] font-bold gap-2"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection || isCreatingConnection}
                >
                  {isTestingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Test Connection
                </Button>
                <Button
                  className="flex-1 rounded-[0.5rem] font-bold gap-2 shadow-lg shadow-primary/20"
                  onClick={handleCreateConnection}
                  disabled={isCreatingConnection || isTestingConnection}
                >
                  {isCreatingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Tạo và Gán kết nối
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Modal: Create New Skill --- */}
      <AnimatePresence>
        {isCreateSkillOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-background border shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Tạo Kỹ năng Tùy chỉnh</h2>
                    <p className="text-xs text-muted-foreground">Thiết kế module tư duy chuyên sâu cho Agent của bạn.</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsCreateSkillOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-foreground/60 uppercase ml-1">Tên kỹ năng</label>
                  <Input
                    placeholder="Ví dụ: Phân tích báo cáo tài chính..."
                    value={newSkill.name}
                    onChange={e => setNewSkill(prev => ({ ...prev, name: e.target.value }))}
                    className="rounded-xl border-muted-foreground/20 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[11px] font-bold text-foreground/60 uppercase">Mô tả ngắn (Dùng để nhận diện - Match)</label>
                    <span className={cn("text-[10px] font-medium", newSkill.description.length > 1024 ? "text-destructive" : "text-muted-foreground")}>
                      {newSkill.description.length}/1024
                    </span>
                  </div>
                  <Input
                    placeholder="Ví dụ: Sử dụng kỹ năng này khi người dùng yêu cầu phân tích dữ liệu tài chính..."
                    value={newSkill.description}
                    onChange={e => setNewSkill(prev => ({ ...prev, description: e.target.value.slice(0, 1024) }))}
                    className="rounded-xl border-muted-foreground/20 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  <p className="text-[10px] text-muted-foreground ml-1">Agent sẽ quyết định sử dụng kỹ năng dựa trên mô tả này. Hãy viết thật rõ ràng.</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[11px] font-bold text-foreground/60 uppercase">Nội dung chi tiết (SKILL.md)</label>
                    <div className="flex bg-muted p-0.5 rounded-lg border">
                      <button
                        className={cn("px-3 py-1 text-[10px] font-bold rounded-md transition-all", skillTab === "edit" ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}
                        onClick={() => setSkillTab("edit")}
                      >
                        Soạn thảo
                      </button>
                      <button
                        className={cn("px-3 py-1 text-[10px] font-bold rounded-md transition-all", skillTab === "preview" ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}
                        onClick={() => setSkillTab("preview")}
                      >
                        Xem trước
                      </button>
                    </div>
                  </div>

                  {skillTab === "edit" ? (
                    <Textarea
                      placeholder="# TỔNG QUAN\n...\n# HƯỚNG DẪN\n1. Bước một...\n2. Bước hai..."
                      className="min-h-[300px] rounded-xl border-muted-foreground/20 focus:ring-amber-500/20 focus:border-amber-500 font-mono text-[13px] leading-relaxed resize-none shadow-inner"
                      value={newSkill.content}
                      onChange={e => setNewSkill(prev => ({ ...prev, content: e.target.value }))}
                    />
                  ) : (
                    <div className="min-h-[300px] max-h-[500px] overflow-y-auto p-6 rounded-xl border bg-muted/5 custom-scrollbar">
                      <div className="markdown-preview max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {newSkill.content || "_Chưa có nội dung để xem trước..._"}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground ml-1 italic opacity-70">Sử dụng định dạng Markdown để viết các chỉ dẫn chi tiết cho Agent.</p>
                </div>
              </div>

              <div className="p-4 border-t bg-muted/5 flex items-center justify-end gap-3">
                <Button variant="ghost" className="rounded-lg font-bold text-xs" onClick={() => setIsCreateSkillOpen(false)}>Hủy</Button>
                <Button
                  className="rounded-lg font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
                  disabled={isCreatingSkill}
                  onClick={handleCreateSkill}
                >
                  {isCreatingSkill ? (editingSkillId ? "Đang lưu..." : "Đang tạo...") : (editingSkillId ? "Cập nhật Kỹ năng" : "Lưu và Áp dụng")}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
