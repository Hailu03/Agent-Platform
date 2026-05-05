"use client";

import { useState, useEffect } from "react";
import { 
  GitBranch, 
  Search, 
  MoreVertical, 
  Trash2, 
  Bot,
  ArrowRight,
  Play,
  Settings,
  Share2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAgents } from "@/hooks/use-agents";
import { useNotifications } from "@/hooks/use-notifications";
import { fetchWithAuth } from "@/lib/api";

interface WorkflowItem {
  id: string;
  name: string;
  agents: { id: string, name: string }[];
}

export default function WorkflowsPage() {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { agents, refreshAgents } = useAgents();
  const { addNotification } = useNotifications();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [newWorkflow, setNewWorkflow] = useState({ name: "", description: "" });

  const handleDeleteWorkflow = async (item: WorkflowItem, agentId: string) => {
    const agentName = item.agents.find(a => a.id === agentId)?.name;
    if (!window.confirm(`Bạn có chắc muốn xóa quy trình "${item.name}" khỏi Agent "${agentName}"?`)) return;

    try {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      const updatedTools = (agent.tools || []).filter((t: any) => {
        const tName = typeof t === "string" ? t : (t.name || t.label);
        return tName !== item.name;
      });
      
      const res = await fetchWithAuth(`/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools: updatedTools })
      });

      if (res.ok) {
        addNotification("success", "Thành công", `Đã gỡ quy trình khỏi Agent ${agent.name}.`);
        refreshAgents();
        fetchWorkflows();
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Không thể gỡ quy trình.");
    }
  };

  const handleInheritFromAgent = (agentId: string | null) => {
    if (!agentId) return;
    setSelectedAgentId(agentId);
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setNewWorkflow({
        name: `Quy trình cho ${agent.name}`,
        description: `Luồng xử lý tự động cho Agent ${agent.name}`
      });
    }
  };

  const fetchWorkflows = async () => {
    try {
      const res = await fetchWithAuth("/agents/");
      const data = await res.json();
      
      if (Array.isArray(data)) {
        const workflowMap: Record<string, WorkflowItem> = {};
        data.forEach(agent => {
          if (agent.tools) {
            agent.tools.forEach((tool: any) => {
              const toolName = typeof tool === "string" ? tool : (tool.name || "Unknown Workflow");
              if (!workflowMap[toolName]) {
                workflowMap[toolName] = {
                  id: toolName,
                  name: toolName,
                  agents: []
                };
              }
              workflowMap[toolName].agents.push({
                id: agent.id,
                name: agent.name
              });
            });
          }
        });
        setItems(Object.values(workflowMap));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const filteredItems = items.filter(item => {
    const nameMatch = (item.name || "").toString().toLowerCase().includes(searchQuery.toLowerCase());
    const agentMatch = item.agents.some(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return nameMatch || agentMatch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quy trình (Workflows)</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium opacity-80">Điều phối các công việc phức tạp thông qua sơ đồ luồng.</p>
        </div>
        <Button 
          onClick={() => setIsAddOpen(true)}
          className="rounded-[0.5rem] h-10 gap-2 shadow-lg shadow-primary/20 font-bold px-6"
        >
          <GitBranch className="w-4 h-4" />
          Tạo Workflow
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white/40 dark:bg-white/5 backdrop-blur-xl p-4 rounded-[0.5rem] border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Tìm quy trình ..." 
            className="pl-10 rounded-[0.5rem] h-11 border-muted-foreground/20 bg-background/50" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1 bg-purple-500/10 text-purple-600 border-none">
            {items.length} Luồng đang chạy
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-24 rounded-[0.5rem] bg-muted/20 animate-pulse border" />
          ))
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <Card key={item.id} className="rounded-[0.5rem] border shadow-sm hover:border-purple-500/30 transition-all group bg-white/70 dark:bg-white/5 backdrop-blur-xl overflow-hidden">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[0.5rem] bg-purple-500/10 flex items-center justify-center border shadow-sm">
                    <Share2 className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground/90">{item.name}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {item.agents.map(agent => (
                        <Badge key={agent.id} variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[9px] py-0.5 px-2 rounded-md flex items-center gap-1">
                          <Bot className="w-2.5 h-2.5" />
                          {agent.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden md:flex flex-col items-end mr-4">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Trạng thái</span>
                    <Badge className="bg-green-500/10 text-green-600 border-none rounded-full text-[9px] font-bold px-2 py-0.5 mt-1">
                      Active
                    </Badge>
                  </div>
                  
                  <Button variant="outline" size="sm" className="rounded-[0.4rem] h-9 gap-2 border-muted-foreground/20 font-bold bg-white/50">
                    <Play className="w-3.5 h-3.5 fill-purple-600 text-purple-600" />
                    Chạy thử
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-[0.4rem] hover:bg-white hover:border shadow-sm">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-muted-foreground/20 shadow-2xl p-1.5 w-48">
                      <DropdownMenuItem className="rounded-lg text-[11px] font-bold py-2.5 cursor-pointer">
                        <Settings className="w-3.5 h-3.5 mr-2" /> Mở trình thiết kế
                      </DropdownMenuItem>
                      {item.agents.map(agent => (
                        <DropdownMenuItem 
                          key={agent.id}
                          className="rounded-lg text-[11px] font-bold py-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                          onClick={() => handleDeleteWorkflow(item, agent.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Gỡ khỏi {agent.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 text-center bg-white/40 rounded-[0.5rem] border border-dashed">
             <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-20" />
             <p className="font-bold text-muted-foreground">Không tìm thấy workflow nào</p>
          </div>
        )}
      </div>

      {/* Create Workflow Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[1.5rem] overflow-hidden p-0 border-none shadow-2xl">
          <DialogHeader className="p-6 bg-gradient-to-br from-purple-500/10 to-transparent border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/20 shadow-sm">
                <GitBranch className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Tạo Workflow mới</DialogTitle>
                <DialogDescription className="text-xs font-medium">Thiết kế quy trình tự động hóa cho Agent của bạn.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* Kế thừa từ Agent */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Bot className="w-3 h-3 text-purple-600" /> Chọn Agent
              </label>
              <Select value={selectedAgentId || ""} onValueChange={handleInheritFromAgent}>
                <SelectTrigger className="rounded-xl h-11 border-muted-foreground/20 bg-purple-500/5 border-purple-500/20 font-medium w-full overflow-hidden">
                  <span className="truncate text-left">
                    {selectedAgentId ? (agents.find(a => a.id === selectedAgentId)?.name || "Đang tải...") : "Chọn một Agent để kích hoạt..."}
                  </span>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-muted-foreground/20 shadow-xl">
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id} className="font-medium focus:bg-purple-50 cursor-pointer">
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground italic">Lưu ý: Thao tác này sẽ tự động đề xuất tên và mô tả dựa trên đặc thù của Agent.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tên quy trình</label>
              <Input 
                placeholder="Ví dụ: Quy trình Phân loại Email tự động" 
                value={newWorkflow.name}
                onChange={(e) => setNewWorkflow({...newWorkflow, name: e.target.value})}
                className="rounded-xl h-11 border-muted-foreground/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Mô tả luồng</label>
              <Input 
                placeholder="Mô tả ngắn gọn về các bước xử lý..." 
                value={newWorkflow.description}
                onChange={(e) => setNewWorkflow({...newWorkflow, description: e.target.value})}
                className="rounded-xl h-11 border-muted-foreground/20"
              />
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t flex gap-2">
            <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="rounded-xl font-bold">Hủy</Button>
            <Button 
              className="rounded-xl px-8 font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20"
              onClick={() => {
                addNotification("success", "Thành công", "Đã khởi tạo Workflow. Chuyển đến trình thiết kế...");
                setIsAddOpen(false);
              }}
            >
              Tiếp tục
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
