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
  Send
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";

interface AvailableTool {
  name: string;
  label: string;
  description: string;
  category: string;
}

interface ToolItem {
  id: string;
  name: string;
  label?: string;
  description?: string;
  category?: string;
  agentId: string;
  agentName: string;
}

export default function ToolsPage() {
  const router = useRouter();
  const { addNotification } = useNotifications();
  const [items, setItems] = useState<ToolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);

  // State cho việc gỡ bỏ và khám phá
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);

  useEffect(() => {
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

                allTools.push({
                  id: `${agent.id}-${toolName}`,
                  name: toolName,
                  label: meta?.label || toolName,
                  description: meta?.description || "Công cụ đã được cấu hình",
                  category: meta?.category || "Cơ bản",
                  agentId: agent.id,
                  agentName: agent.name
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

  const handleSettings = (agentId: string) => {
    router.push(`/agents/create?id=${agentId}`);
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
                          onClick={() => handleSettings(item.agentId)}
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

            <div className="space-y-10">
              {(() => {
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
                            <span className="text-[9px] font-bold text-muted-foreground/50 font-mono tracking-wider">ID: {tool.name}</span>
                            <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-none text-[8px] font-bold uppercase tracking-widest px-2 py-0.5">Sẵn sàng</Badge>
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
    </div>
  );
}
