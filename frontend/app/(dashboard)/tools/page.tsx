"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";
import {
  Hammer,
  Search,
  MoreVertical,
  Trash2,
  Bot,
  Settings,
  Cpu,
  Globe,
  Mail,
  Sparkles,
  Reply,
  Tag,
  Inbox,
  Eye,
  Edit2,
  Network,
  Send,
  Plus,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";
import { useAgents } from "@/hooks/use-agents";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface AvailableTool {
  name: string;
  label: string;
  description: string;
  category: string;
  supported_params?: {
    key: string;
    label: string;
    type: string;
    default: any;
    desc?: string;
    options?: { label: string; value: any }[];
  }[];
}

interface ToolItem {
  id: string;
  name: string;
  label?: string;
  description?: string;
  category?: string;
  agentId: string;
  agentName: string;
  params?: Record<string, any>;
  supported_params?: {
    key: string;
    label: string;
    type: string;
    default: any;
    desc?: string;
    options?: { label: string; value: any }[];
  }[];
}

export default function ToolsPage() {
  const router = useRouter();
  const { addNotification } = useNotifications();
  const { agents, refreshAgents } = useAgents();
  const [items, setItems] = useState<ToolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);

  // State cho việc gỡ bỏ và khám phá
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [targetAgentId, setTargetAgentId] = useState<string | null>(null);

  // Config Tool Modal
  const [showToolConfig, setShowToolConfig] = useState(false);
  const [editingItem, setEditingItem] = useState<ToolItem | null>(null);
  const [toolOverrideData, setToolOverrideData] = useState({ label: "", description: "" });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const handleAddToolToAgent = async (tool: AvailableTool) => {
    if (!targetAgentId) {
      addNotification("warning", "Thiếu thông tin", "Vui lòng chọn một Agent để gán công cụ này.");
      return;
    }

    const agent = agents.find(a => a.id === targetAgentId);
    if (!agent) return;

    // Kiểm tra nếu tool đã có trong agent
    const existingTools = Array.isArray(agent.tools) ? agent.tools : [];
    const toolName = tool.name;
    
    if (existingTools.some((t: any) => (typeof t === 'string' ? t === toolName : t.name === toolName))) {
      addNotification("info", "Đã tồn tại", `Agent ${agent.name} đã có công cụ ${tool.label || tool.name}.`);
      return;
    }

    try {
      const updatedTools = [...existingTools, toolName];
      const res = await fetchWithAuth(`/agents/${targetAgentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools: updatedTools })
      });

      if (res.ok) {
        addNotification("success", "Thành công", `Đã thêm ${tool.label || tool.name} vào Agent ${agent.name}.`);
        refreshAgents(); // Refresh data
        // Refresh local tools list
        fetchData();
      } else {
        throw new Error("Failed to update agent tools");
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Không thể thêm công cụ vào Agent.");
    }
  };

  const fetchData = async () => {
    const token = localStorage.getItem("access_token");
    try {
      // 1. Fetch available tools metadata
      const toolRes = await fetch("http://localhost:8000/api/v1/agents/tools/available", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const metaTools: AvailableTool[] = await toolRes.json();
      setAvailableTools(metaTools);

      // 2. Fetch agents and their active tools
      const res = await fetch("http://localhost:8000/api/v1/agents/", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();

      if (Array.isArray(data)) {
        const allTools: ToolItem[] = [];
        const toolMap = new Map<string, AvailableTool>(metaTools.map((t: AvailableTool) => [t.name, t]));

        data.forEach(agent => {
          if (agent.tools) {
            agent.tools.forEach((tool: any) => {
              const toolName = typeof tool === "string" ? tool : (tool.name || "Unknown Tool");
              const meta = toolMap.get(toolName);
              const toolConfig = typeof tool === "string" ? {} : tool;

              allTools.push({
                id: `${agent.id}-${toolName}`,
                name: toolName,
                label: toolConfig.label || meta?.label || toolName,
                description: toolConfig.description || meta?.description || "Công cụ đã được cấu hình",
                category: meta?.category || "Cơ bản",
                agentId: agent.id,
                agentName: agent.name,
                params: toolConfig.params || {},
                supported_params: meta?.supported_params || []
              });
            });
          }
        });
        setItems(allTools);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteTool = async (item: ToolItem) => {
    if (!window.confirm(`Bạn có chắc muốn gỡ bỏ công cụ "${item.label || item.name}" khỏi Agent @${item.agentName}?`)) return;

    setIsDeleting(true);
    const token = localStorage.getItem("access_token");
    try {
      // 1. Lấy thông tin Agent hiện tại
      const agentRes = await fetch(`http://localhost:8000/api/v1/agents/${item.agentId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const agent = await agentRes.json();

      // 2. Lọc bỏ công cụ cần xóa
      const updatedTools = agent.tools.filter((t: any) => {
        const tName = typeof t === "string" ? t : t.name;
        return tName !== item.name;
      });

      // 3. Cập nhật Agent
      const updateRes = await fetch(`http://localhost:8000/api/v1/agents/${item.agentId}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tools: updatedTools })
      });

      if (updateRes.ok) {
        addNotification("success", "Thành công", `Đã gỡ bỏ công cụ khỏi Agent ${item.agentName}`);
        // Cập nhật state local
        setItems(prev => prev.filter(i => i.id !== item.id));
      } else {
        addNotification("error", "Lỗi", "Không thể cập nhật Agent.");
      }
    } catch (error) {
      console.error(error);
      addNotification("error", "Lỗi", "Đã có lỗi xảy ra.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSettings = (item: ToolItem) => {
    setEditingItem(item);
    setToolOverrideData({
      label: item.label || item.name,
      description: item.description || ""
    });
    setShowToolConfig(true);
  };

  const handleSaveToolConfig = async () => {
    if (!editingItem) return;
    setIsSavingConfig(true);
    const token = localStorage.getItem("access_token");
    
    try {
      // 1. Lấy thông tin Agent hiện tại
      const agentRes = await fetch(`http://localhost:8000/api/v1/agents/${editingItem.agentId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const agent = await agentRes.json();

      // 2. Cập nhật label/desc cho tool trong danh sách tools của agent
      const updatedTools = agent.tools.map((t: any) => {
        const tName = typeof t === "string" ? t : t.name;
        if (tName === editingItem.name) {
          return {
            ...(typeof t === "string" ? { name: t } : t),
            label: toolOverrideData.label,
            description: toolOverrideData.description,
            params: editingItem.params,
            is_active: true
          };
        }
        return t;
      });

      // 3. Gửi cập nhật
      const res = await fetchWithAuth(`/agents/${editingItem.agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools: updatedTools })
      });

      if (res.ok) {
        addNotification("success", "Thành công", `Đã cập nhật cấu hình cho ${editingItem.name}`);
        setShowToolConfig(false);
        fetchData(); // Tải lại danh sách
      } else {
        throw new Error("Failed to update tool config");
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Không thể lưu cấu hình công cụ.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const filteredItems = items.filter(item => {
    const nameMatch = (item.name || "").toString().toLowerCase().includes(searchQuery.toLowerCase());
    const agentMatch = (item.agentName || "").toString().toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || agentMatch;
  });

  const getIcon = (name: string, category?: string) => {
    const n = name.toLowerCase();
    if (category === "Gmail" || n.includes("gmail")) {
      if (n.includes("tìm kiếm") || n.includes("search")) return <Search className="w-4 h-4 text-red-500" />;
      if (n.includes("danh sách") || n.includes("list")) return <Inbox className="w-4 h-4 text-red-500" />;
      if (n.includes("xem") || n.includes("đọc") || n.includes("read")) return <Eye className="w-4 h-4 text-red-500" />;
      if (n.includes("gửi") || n.includes("send")) return <Send className="w-4 h-4 text-red-500" />;
      if (n.includes("nháp") || n.includes("draft")) return <Edit2 className="w-4 h-4 text-red-500" />;
      if (n.includes("nhãn") || n.includes("modify")) return <Tag className="w-4 h-4 text-red-500" />;
      if (n.includes("trả lời") || n.includes("reply")) return <Reply className="w-4 h-4 text-red-500" />;
      return <Mail className="w-4 h-4 text-red-500" />;
    }
    if (n.includes("tìm kiếm web") || n.includes("web_search")) return <Globe className="w-4 h-4 text-blue-500" />;
    if (n.includes("search")) return <Search className="w-4 h-4 text-blue-500" />;
    if (n.includes("interpreter") || n.includes("sql")) return <Cpu className="w-4 h-4 text-purple-500" />;
    if (n.includes("dall-e") || n.includes("content")) return <Sparkles className="w-4 h-4 text-amber-500" />;
    if (n.includes("email")) return <Mail className="w-4 h-4 text-red-500" />;
    return <Network className="w-4 h-4 text-emerald-500" />;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thư Viện Công Cụ</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium opacity-80">Quản lý các công cụ cơ bản được tích hợp sẵn cho AI Agent.</p>
        </div>
        <Button 
          className="rounded-[0.5rem] h-10 gap-2 shadow-lg shadow-primary/20 font-bold px-6"
          onClick={() => setIsExploreOpen(true)}
        >
          <Hammer className="w-4 h-4" />
          Khám phá Tool mới
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white/40 dark:bg-white/5 backdrop-blur-xl p-4 rounded-[0.5rem] border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm công cụ ..."
            className="pl-10 rounded-[0.5rem] h-11 border-muted-foreground/20 bg-background/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1 bg-green-500/10 text-green-600 border-none">
            {items.length} Công cụ đang dùng
          </Badge>
        </div>
      </div>

      {/* Content Table */}
      <Card className="rounded-[0.8rem] border shadow-md bg-white/70 dark:bg-white/5 backdrop-blur-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-b-muted/20">
              <TableHead className="w-[300px] font-black text-[10px] uppercase tracking-widest text-muted-foreground/60 py-4 px-6">Công cụ</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground/60 py-4">Mô tả</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground/60 py-4">Nhóm</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground/60 py-4">Agent sử dụng</TableHead>
              <TableHead className="w-[80px] text-right py-4 px-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i} className="animate-pulse">
                  <TableCell colSpan={5} className="py-8 px-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-muted/20" />
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-muted/20 rounded" />
                        <div className="h-3 w-48 bg-muted/20 rounded" />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <TableRow key={item.id} className="group hover:bg-muted/10 transition-all border-b-muted/20 last:border-0">
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center border shadow-sm group-hover:scale-105 transition-transform">
                        {getIcon(item.label || item.name, item.category)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[13px] text-foreground/90">{item.label || item.name}</span>
                        <span className="text-[10px] text-muted-foreground font-medium opacity-60">ID: {item.name}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <p className="text-[12px] text-muted-foreground line-clamp-1 max-w-[300px] leading-relaxed">
                      {item.description}
                    </p>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge variant="outline" className={cn(
                      "text-[9px] font-black tracking-widest px-2 py-0.5 border-none bg-muted uppercase",
                      item.category === "Gmail" && "bg-red-500/10 text-red-600",
                      item.category === "Cơ bản" && "bg-blue-500/10 text-blue-600"
                    )}>
                      {item.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                        <Bot className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-[11px] font-bold text-foreground/70">@{item.agentName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-6 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white dark:hover:bg-white/10 hover:border shadow-sm">
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl border-muted-foreground/20 shadow-2xl p-1.5 w-40">
                        <DropdownMenuItem
                          className="rounded-lg text-[11px] font-bold py-2.5 cursor-pointer"
                          onClick={() => handleSettings(item)}
                        >
                          <Settings className="w-3.5 h-3.5 mr-2" /> Thiết lập
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="rounded-lg text-[11px] font-bold py-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                          onClick={() => handleDeleteTool(item)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Gỡ bỏ
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-32 text-center">
                  <div className="space-y-3 opacity-30">
                    <Hammer className="w-12 h-12 mx-auto" />
                    <p className="font-bold text-muted-foreground">Chưa có công cụ nào phù hợp</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Modal Khám phá Tool mới */}
      <Dialog open={isExploreOpen} onOpenChange={setIsExploreOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl border-muted/20 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl p-0 shadow-2xl">
          <div className="p-8 space-y-8">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight">Thư viện Công cụ Hệ thống</DialogTitle>
              </div>
              <DialogDescription className="text-sm text-muted-foreground font-medium leading-relaxed">
                Khám phá toàn bộ danh sách các công cụ chuyên biệt mà nền tảng WAO Agent hỗ trợ. Kết nối thêm các Ecosystem để mở khóa các công cụ Pro.
              </DialogDescription>
            </DialogHeader>

            {/* Bộ chọn Agent */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Gán công cụ vào Agent</h4>
                  <p className="text-[10px] text-muted-foreground font-medium">Chọn Agent bạn muốn thêm các công cụ bên dưới vào.</p>
                </div>
              </div>
              <div className="w-full md:w-64">
                <Select value={targetAgentId || ""} onValueChange={setTargetAgentId}>
                  <SelectTrigger className="rounded-xl h-11 bg-white dark:bg-white/5 border-muted-foreground/20 font-bold w-full overflow-hidden">
                    <span className="truncate">
                      {targetAgentId ? (agents.find(a => a.id === targetAgentId)?.name || "Đang tải...") : "Chọn một Agent..."}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-muted-foreground/20 shadow-2xl">
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id} className="font-medium cursor-pointer">
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-10">
              {(() => {
                const isToolInAgent = (toolName: string) => {
                  if (!targetAgentId) return false;
                  const agent = agents.find(a => a.id === targetAgentId);
                  if (!agent) return false;
                  const tools = Array.isArray(agent.tools) ? agent.tools : [];
                  return tools.some((t: any) => (typeof t === 'string' ? t === toolName : t.name === toolName));
                };

                // Nhóm availableTools theo category
                const groups = availableTools.reduce((acc, tool) => {
                  const cat = tool.category || "Cơ bản";
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(tool);
                  return acc;
                }, {} as Record<string, AvailableTool[]>);

                return Object.entries(groups).map(([category, tools]) => (
                  <div key={category} className="space-y-5">
                    <div className="flex items-center gap-3">
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{category}</h3>
                      <div className="h-[1px] flex-1 bg-muted/20" />
                      <Badge variant="outline" className="text-[8px] h-4 px-2 opacity-40">{tools.length} Tools</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tools.map((tool) => (
                        <div 
                          key={tool.name}
                          className="group p-5 rounded-2xl border bg-white/50 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.05] hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform duration-500">
                              {getIcon(tool.label || tool.name, tool.category)}
                            </div>
                            <div className="flex-1 space-y-1.5">
                              <h4 className="font-bold text-[14px] text-foreground/90">{tool.label || tool.name}</h4>
                              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                                {tool.description}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-muted/10 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-bold text-muted-foreground/50 font-mono tracking-wider uppercase">ID: {tool.name}</span>
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[7px] font-black uppercase tracking-widest px-1.5 py-0 mt-1 w-fit">Sẵn sàng</Badge>
                            </div>
                            <Button 
                              size="sm" 
                              className={cn(
                                "h-8 rounded-xl gap-2 font-bold text-[11px] px-4 shadow-lg transition-all",
                                isToolInAgent(tool.name) 
                                  ? "bg-muted text-muted-foreground shadow-none cursor-default hover:bg-muted" 
                                  : "shadow-primary/10"
                              )}
                              onClick={() => !isToolInAgent(tool.name) && handleAddToolToAgent(tool)}
                              disabled={!targetAgentId}
                            >
                              {isToolInAgent(tool.name) ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Đã chọn
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  Thêm vào Agent
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Cấu hình Công cụ nhanh */}
      <Dialog open={showToolConfig} onOpenChange={setShowToolConfig}>
        <DialogContent className="sm:max-w-[550px] rounded-[1.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary/5 p-8 border-b border-primary/10">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm border border-primary/10">
                {editingItem && getIcon(editingItem.name, editingItem.category)}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Thiết lập công cụ</DialogTitle>
                <DialogDescription className="font-medium text-xs opacity-70 italic">
                  Đang chỉnh sửa cho Agent: <span className="text-primary font-black">@{editingItem?.agentName}</span>
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Tên hiển thị (Label)</label>
              <Input
                placeholder="VD: Tìm kiếm dữ liệu nâng cao"
                value={toolOverrideData.label}
                onChange={(e) => setToolOverrideData({ ...toolOverrideData, label: e.target.value })}
                className="rounded-xl h-12 border-muted-foreground/20 focus:ring-primary/20 bg-muted/5 font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Mô tả (Description)</label>
              <textarea
                placeholder="Mô tả cụ thể nhiệm vụ của công cụ này..."
                value={toolOverrideData.description}
                onChange={(e) => setToolOverrideData({ ...toolOverrideData, description: e.target.value })}
                className="w-full rounded-xl min-h-[100px] p-4 border border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 outline-none bg-muted/5 font-medium text-sm resize-none transition-all"
              />
            </div>

            {/* Dynamic Parameter Form */}
            {editingItem?.supported_params && editingItem.supported_params.length > 0 && (
              <div className="space-y-5 pt-2">
                <div className="flex items-center gap-2 ml-1">
                  <Settings className="w-3.5 h-3.5 text-primary" />
                  <label className="text-[11px] font-bold uppercase tracking-widest text-foreground">Cấu hình tham số</label>
                </div>
                
                <div className="grid grid-cols-1 gap-5 p-5 bg-muted/20 rounded-2xl border border-muted-foreground/10">
                  {editingItem.supported_params.map((param: any) => (
                    <div key={param.key} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-foreground/80 ml-1">{param.label}</label>
                        <span className="text-[10px] font-mono text-muted-foreground opacity-50 uppercase">{param.key}</span>
                      </div>
                      
                      {param.type === "select" ? (
                        <Select 
                          value={editingItem.params?.[param.key] || param.default} 
                          onValueChange={(val) => {
                            if (!editingItem) return;
                            const currentParams = editingItem.params || {};
                            setEditingItem({ ...editingItem, params: { ...currentParams, [param.key]: val } });
                          }}
                        >
                          <SelectTrigger className="rounded-xl h-10 bg-background border-muted-foreground/20">
                            <SelectValue placeholder={`Chọn ${param.label.toLowerCase()}...`} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-muted-foreground/20">
                            {param.options?.map((opt: any) => (
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
                          value={editingItem.params?.[param.key] ?? param.default}
                          onChange={(e) => {
                            if (!editingItem) return;
                            const val = param.type === "number" ? parseInt(e.target.value) : e.target.value;
                            const currentParams = editingItem.params || {};
                            setEditingItem({ ...editingItem, params: { ...currentParams, [param.key]: val } });
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
                      editingItem?.params?.human_in_loop ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                    onClick={() => {
                      if (!editingItem) return;
                      const currentParams = editingItem.params || {};
                      setEditingItem({ ...editingItem, params: { ...currentParams, human_in_loop: !currentParams.human_in_loop } });
                    }}
                  >
                    <div className={cn(
                      "w-3 h-3 bg-white rounded-full transition-transform duration-300",
                      editingItem?.params?.human_in_loop ? "translate-x-5" : "translate-x-0"
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
                    value={editingItem?.params?.rate_limit || ""}
                    onChange={(e) => {
                      if (!editingItem) return;
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      const currentParams = editingItem.params || {};
                      setEditingItem({ ...editingItem, params: { ...currentParams, rate_limit: val } });
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
                    value={editingItem?.params?.run_limit || ""}
                    onChange={(e) => {
                      if (!editingItem) return;
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      const currentParams = editingItem.params || {};
                      setEditingItem({ ...editingItem, params: { ...currentParams, run_limit: val } });
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
                    value={editingItem?.params?.thread_limit || ""}
                    onChange={(e) => {
                      if (!editingItem) return;
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      const currentParams = editingItem.params || {};
                      setEditingItem({ ...editingItem, params: { ...currentParams, thread_limit: val } });
                    }}
                    className="rounded-xl h-10 bg-background border-muted-foreground/20 text-xs font-medium"
                  />
                </div>
              </div>
            </div>

            </div>
            
            <p className="text-[10px] text-muted-foreground italic ml-1 opacity-70">
              * Lưu ý: Thay đổi này sẽ ảnh hưởng trực tiếp đến cách Agent nhận diện công cụ trong luồng suy nghĩ (Thinking).
            </p>

          <DialogFooter className="p-6 bg-muted/20 gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowToolConfig(false)}
              className="rounded-xl h-11 px-6 font-bold"
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={async () => {
                if (!editingItem) return;
                setIsSavingConfig(true);
                const token = localStorage.getItem("access_token");
                
                try {
                  const agentRes = await fetch(`http://localhost:8000/api/v1/agents/${editingItem.agentId}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                  });
                  const agent = await agentRes.json();

                  const updatedTools = agent.tools.map((t: any) => {
                    const tName = typeof t === "string" ? t : t.name;
                    if (tName === editingItem.name) {
                      return {
                        ...(typeof t === "string" ? { name: t } : t),
                        label: toolOverrideData.label,
                        description: toolOverrideData.description,
                        params: editingItem.params,
                        is_active: true
                      };
                    }
                    return t;
                  });

                  const res = await fetchWithAuth(`/agents/${editingItem.agentId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tools: updatedTools })
                  });

                  if (res.ok) {
                    addNotification("success", "Thành công", `Đã cập nhật cấu hình cho ${editingItem.name}`);
                    setShowToolConfig(false);
                    fetchData();
                  } else {
                    throw new Error("Failed to update tool config");
                  }
                } catch (error) {
                  addNotification("error", "Lỗi", "Không thể lưu cấu hình công cụ.");
                } finally {
                  setIsSavingConfig(false);
                }
              }}
              disabled={isSavingConfig}
              className="rounded-xl h-11 px-8 font-bold bg-primary text-white shadow-lg shadow-primary/20"
            >
              {isSavingConfig ? "Đang lưu..." : "Cập nhật ngay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
