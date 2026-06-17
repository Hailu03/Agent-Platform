"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Trash2, Edit2, Play, Pause, Settings, MoreVertical, Search, Plus, Bot, ArrowUpRight, Sparkles, Cpu, Network, MessageSquare, Layers, Zap, Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { useAgents, Agent } from "@/hooks/use-agents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROUTER_PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  google: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
  ollama: [
    { value: "llama3:8b", label: "Llama 3 8B" },
    { value: "qwen2:7b", label: "Qwen2 7B" },
  ],
};

export default function AgentsPage() {
  const { agents, loading, toggleAgentStatus, deleteAgent } = useAgents();
  const [filter, setFilter] = useState<"all" | "running" | "paused">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [routerAgent, setRouterAgent] = useState<{
    id: string;
    name: string;
    description: string;
    instructions: string;
    model_provider?: string;
    model_name?: string;
    api_key?: string;
  } | null>(null);

  const [editState, setEditState] = useState<{
    field: "name" | "description" | "instructions" | null;
    value: string;
  }>({ field: null, value: "" });

  const [isSavingRouter, setIsSavingRouter] = useState(false);
  const [showRouterApiKey, setShowRouterApiKey] = useState(false);

  // Fetch router agent on mount
  useEffect(() => {
    const fetchRouter = async () => {
      try {
        const res = await fetchWithAuth("/agents/router");
        if (res.ok) {
          const data = await res.json();
          const provider = data.model_provider || "openai";
          const models = ROUTER_PROVIDER_MODELS[provider] || [];
          setRouterAgent({
            ...data,
            model_provider: provider,
            model_name: data.model_name || models[0]?.value || "",
          });
        }
      } catch (err) {
        console.error("Failed to fetch router agent:", err);
      }
    };
    fetchRouter();
  }, []);

  const handleStartEdit = (field: "name" | "description" | "instructions", currentValue: string) => {
    setEditState({ field, value: currentValue });
  };

  const handleCancelEdit = () => {
    setEditState({ field: null, value: "" });
  };

  const handleSaveRouter = async () => {
    if (!editState.field || !routerAgent) return;
    setIsSavingRouter(true);
    try {
      const updatedFields = { [editState.field]: editState.value };
      const res = await fetchWithAuth("/agents/router", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
      });
      if (res.ok) {
        const data = await res.json();
        setRouterAgent(prev => prev ? { ...prev, ...data } : data);
        setEditState({ field: null, value: "" });
      }
    } catch (err) {
      console.error("Failed to save router agent:", err);
    } finally {
      setIsSavingRouter(false);
    }
  };

  const handleSaveRouterModel = async () => {
    if (!routerAgent) return;
    setIsSavingRouter(true);
    try {
      const res = await fetchWithAuth("/agents/router", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_provider: routerAgent.model_provider,
          model_name: routerAgent.model_name,
          api_key: routerAgent.api_key,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRouterAgent(prev => prev ? { ...prev, ...data } : data);
      }
    } catch (err) {
      console.error("Failed to save router model:", err);
    } finally {
      setIsSavingRouter(false);
    }
  };

  const routerName = routerAgent?.name || "WAO Assistant";
  const routerDesc = routerAgent?.description || "Trợ lý trung tâm — Tự động phân loại ý định và định tuyến yêu cầu đến Agent chuyên biệt phù hợp.";
  const routerInst = routerAgent?.instructions || "Bạn là WAO Assistant - Trợ lý AI cá nhân thông minh của hệ thống.\nNhiệm vụ của bạn là hỗ trợ và trò chuyện thân thiện, xã giao với người dùng (như chào hỏi, hỏi thăm, giải thích chức năng). Bạn có khả năng điều phối và chuyển tiếp các câu hỏi chuyên môn của họ sang các Trợ lý con chuyên biệt khi cần thiết (như Trợ lý Chăm sóc Fanpage, Trợ lý Gmail, Phân tích dữ liệu SQL, v.v.).\nHãy chào hỏi thân thiện, giới thiệu bản thân là WAO Assistant và khéo léo giới thiệu các Trợ lý con chuyên nghiệp mà hệ thống đang có để người dùng biết cách sử dụng.";


  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    await toggleAgentStatus(id, currentStatus);
  };

  const handleDelete = async (id: string) => {
    await deleteAgent(id);
  };

  const filteredAgents = agents.filter(agent => {
    if (agent.id === "router") return false;
    
    const matchesFilter = 
      filter === "all" || 
      (filter === "running" && agent.is_active) || 
      (filter === "paused" && !agent.is_active);
    
    const matchesSearch = (agent.name || "").toString().toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Danh sách AI Agents</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium opacity-80">Quản lý và theo dõi hiệu suất của các Agent của bạn.</p>
        </div>
        <Link href="/agents/create">
          <Button className="rounded-[0.5rem] h-10 gap-2 shadow-lg shadow-primary/20 font-bold px-6">
            <Plus className="w-4 h-4" />
            Tạo Agent mới
          </Button>
        </Link>
      </div>

      {/* WAO Assistant Router Card */}
      <div className="rounded-[0.5rem] border bg-card p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{routerName}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  Core Agent
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Trợ lý trung tâm — Tự động phân loại và định tuyến yêu cầu</p>
            </div>
          </div>
          <Link href="/chat?agent=router">
            <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1.5 rounded-[0.4rem]">
              Trò chuyện
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left column: Identity */}
          <div className="space-y-4">
            {/* Name */}
            <div className="group/name space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tên</label>
                {editState.field !== "name" && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/name:opacity-100 transition-opacity"
                    onClick={() => handleStartEdit("name", routerName)}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
              {editState.field === "name" ? (
                <div className="flex gap-2">
                  <Input value={editState.value} onChange={(e) => setEditState(p => ({ ...p, value: e.target.value }))}
                    className="h-8 text-sm" autoFocus />
                  <Button size="sm" className="h-8 px-3 text-xs shrink-0" onClick={handleSaveRouter} disabled={isSavingRouter}>
                    {isSavingRouter ? <Loader2 className="w-3 h-3 animate-spin" /> : "Lưu"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-3 text-xs shrink-0" onClick={handleCancelEdit}>Hủy</Button>
                </div>
              ) : (
                <p className="text-sm font-medium">{routerName}</p>
              )}
            </div>

            {/* Description */}
            <div className="group/desc space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mô tả</label>
                {editState.field !== "description" && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/desc:opacity-100 transition-opacity"
                    onClick={() => handleStartEdit("description", routerDesc)}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
              {editState.field === "description" ? (
                <div className="space-y-2">
                  <Textarea value={editState.value} onChange={(e) => setEditState(p => ({ ...p, value: e.target.value }))}
                    className="text-sm min-h-[80px]" autoFocus />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" className="h-8 px-3 text-xs" onClick={handleSaveRouter} disabled={isSavingRouter}>
                      {isSavingRouter ? <Loader2 className="w-3 h-3 animate-spin" /> : "Lưu"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={handleCancelEdit}>Hủy</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">{routerDesc}</p>
              )}
            </div>

            {/* Model Config */}
            <div className="space-y-2 pt-1 border-t">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mô hình AI</label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={routerAgent?.model_provider || "openai"}
                  onValueChange={(v) => setRouterAgent(p => p ? {
                    ...p,
                    model_provider: v || undefined,
                    model_name: ROUTER_PROVIDER_MODELS[v as keyof typeof ROUTER_PROVIDER_MODELS]?.[0]?.value || ""
                  } : p)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="ollama">Ollama</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={routerAgent?.model_name || ""}
                  onValueChange={(v) => setRouterAgent(p => p ? { ...p, model_name: v || undefined } : p)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {(ROUTER_PROVIDER_MODELS[routerAgent?.model_provider || "openai"] || []).map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showRouterApiKey ? "text" : "password"}
                    value={routerAgent?.api_key || ""}
                    onChange={(e) => setRouterAgent(p => p ? { ...p, api_key: e.target.value } : p)}
                    placeholder="API Key..."
                    className="h-9 text-xs pr-9"
                  />
                  <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-9"
                    onClick={() => setShowRouterApiKey(p => !p)}>
                    {showRouterApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <Button size="sm" className="h-9 px-4 text-xs font-bold shrink-0"
                  onClick={handleSaveRouterModel} disabled={isSavingRouter}>
                  {isSavingRouter ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Lưu"}
                </Button>
              </div>
            </div>
          </div>

          {/* Right column: System Prompt */}
          <div className="group/inst space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">System Prompt</label>
              {editState.field !== "instructions" && (
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/inst:opacity-100 transition-opacity"
                  onClick={() => handleStartEdit("instructions", routerInst)}>
                  <Edit2 className="w-3 h-3" />
                </Button>
              )}
            </div>
            {editState.field === "instructions" ? (
              <div className="space-y-2">
                <Textarea value={editState.value} onChange={(e) => setEditState(p => ({ ...p, value: e.target.value }))}
                  className="font-mono text-xs min-h-[220px] leading-relaxed" autoFocus />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" className="h-8 px-3 text-xs" onClick={handleSaveRouter} disabled={isSavingRouter}>
                    {isSavingRouter ? <Loader2 className="w-3 h-3 animate-spin" /> : "Lưu"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={handleCancelEdit}>Hủy</Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground font-mono whitespace-pre-line leading-relaxed max-h-[260px] overflow-y-auto custom-scrollbar bg-muted/30 p-3 rounded-[0.4rem] border">
                {routerInst}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white/40 dark:bg-white/5 backdrop-blur-xl p-4 rounded-[0.5rem] border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Tìm kiếm Agent..." 
            className="pl-10 rounded-[0.5rem] h-11 border-muted-foreground/20 bg-background/50" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button 
            variant={filter === "all" ? "outline" : "ghost"}
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-[0.5rem] h-11 px-6 font-bold transition-all",
              filter === "all" ? "bg-white/50 border shadow-sm" : "text-muted-foreground hover:bg-white/80"
            )}
          >
            Tất cả
          </Button>
          <Button 
            variant={filter === "running" ? "outline" : "ghost"}
            onClick={() => setFilter("running")}
            className={cn(
              "rounded-[0.5rem] h-11 px-6 font-bold transition-all",
              filter === "running" ? "bg-white/50 border shadow-sm" : "text-muted-foreground hover:bg-white/80"
            )}
          >
            Đang chạy
          </Button>
          <Button 
            variant={filter === "paused" ? "outline" : "ghost"}
            onClick={() => setFilter("paused")}
            className={cn(
              "rounded-[0.5rem] h-11 px-6 font-bold transition-all",
              filter === "paused" ? "bg-white/50 border shadow-sm" : "text-muted-foreground hover:bg-white/80"
            )}
          >
            Tạm dừng
          </Button>
        </div>
      </div>

      {/* Agents List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-64 rounded-[0.5rem] bg-muted/20 animate-pulse border border-dashed" />
          ))
        ) : filteredAgents.length > 0 ? (
          filteredAgents.map((agent) => (
            <AgentListItem 
              key={agent.id}
              id={agent.id}
              name={agent.name} 
              desc={agent.description || "Chưa có mô tả"} 
              status={agent.is_active ? "running" : "paused"} 
              model={agent.model_name}
              usage="Sẵn sàng"
              onToggle={() => handleToggleStatus(agent.id, agent.is_active)}
              onDelete={() => handleDelete(agent.id)}
            />
          ))
        ) : (
          <div className="col-span-full py-20 text-center space-y-4 bg-white/30 rounded-[0.5rem] border border-dashed">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto opacity-40">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <p className="text-lg font-bold text-muted-foreground">Chưa có Agent nào</p>
              <p className="text-sm text-muted-foreground/60">Bắt đầu bằng cách tạo một Agent đầu tiên của bạn.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface AgentListItemProps {
  id: string;
  name: string;
  desc: string;
  status: "running" | "paused" | "error";
  model: string;
  usage: string;
  onToggle: () => void;
  onDelete: () => void;
}

function AgentListItem({ id, name, desc, status, model, usage, onToggle, onDelete }: AgentListItemProps) {
  return (
    <Card className="rounded-[0.5rem] border shadow-sm hover:border-primary/30 transition-all group overflow-hidden bg-white/70 dark:bg-white/5 backdrop-blur-xl">
      <CardContent className="p-0">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-[0.5rem] bg-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform border shadow-sm">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                status === "running" ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"
              )} />
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {status === "running" ? "Đang chạy" : "Tạm dừng"}
              </span>
              
              <DropdownMenu>
                <DropdownMenuTrigger 
                  render={
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[0.4rem] ml-2 hover:bg-white hover:border shadow-sm">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="rounded-[0.5rem] border-muted-foreground/20 shadow-xl">
                  <Link href={`/agents/create?id=${id}`}>
                    <DropdownMenuItem className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer">
                      <Edit2 className="w-3.5 h-3.5 mr-2" /> Chỉnh sửa
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer">
                    <Sparkles className="w-3.5 h-3.5 mr-2" /> Xem báo cáo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={onDelete}
                    className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Xóa Agent
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <h3 className="text-xl font-bold text-foreground/90">{name}</h3>
          <p className="text-[13px] text-muted-foreground mt-2 line-clamp-2 h-10 font-medium leading-relaxed opacity-80">{desc}</p>
          
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-muted/30 p-3 rounded-[0.5rem] border border-muted-foreground/5">
              <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Model</p>
              <p className="text-xs font-bold mt-1 text-foreground/80">{model}</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-[0.5rem] border border-muted-foreground/5">
              <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Trạng thái</p>
              <p className="text-xs font-bold mt-1 text-foreground/80">{usage}</p>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-muted/20 border-t flex items-center justify-between">
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={onToggle}
              className="rounded-[0.5rem] h-8 gap-1.5 text-[11px] font-bold bg-white border shadow-sm"
            >
              {status === "running" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {status === "running" ? "Dừng" : "Chạy"}
            </Button>
            <Link href={`/agents/create?id=${id}`}>
              <Button size="sm" variant="ghost" className="rounded-[0.5rem] h-8 gap-1.5 text-[11px] font-bold text-muted-foreground hover:bg-white hover:border shadow-sm">
                <Settings className="w-3 h-3" /> Cấu hình
              </Button>
            </Link>
          </div>
          <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>
      </CardContent>
    </Card>
  );
}
