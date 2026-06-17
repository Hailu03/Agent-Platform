"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  GitBranch, 
  Search, 
  MoreVertical, 
  Trash2, 
  Bot,
  Play,
  Settings,
  Share2,
  Zap,
  CheckCircle2,
  Plus
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
  const router = useRouter();
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
      const res = await fetchWithAuth(`/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_id: null })
      });

      if (res.ok) {
        addNotification("success", "Thành công", `Đã gỡ quy trình khỏi Agent ${agentName}.`);
        refreshAgents();
        fetchWorkflows();
      }
    } catch {
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
      // 1. Fetch real workflows from database
      const wfRes = await fetchWithAuth("/workflows/");
      const wfData = await wfRes.json();
      
      // 2. Fetch agents to map relations
      const agentRes = await fetchWithAuth("/agents/");
      const agentData = await agentRes.json();
      
      if (Array.isArray(wfData) && Array.isArray(agentData)) {
        const mappedWorkflows: WorkflowItem[] = wfData.map(wf => {
          // Find agents that have this workflow_id
          const linkedAgents = agentData
            .filter(agent => agent.workflow_id === wf.id)
            .map(agent => ({
              id: agent.id,
              name: agent.name
            }));
            
          return {
            id: wf.id,
            name: wf.name,
            agents: linkedAgents
          };
        });
        setItems(mappedWorkflows);
      }
    } catch (error) {
      console.error("Error fetching workflows:", error);
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Asymmetric Header with Focal Active Pipeline Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-card border border-purple-500/10 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[20%] h-[150%] bg-purple-500/5 -skew-x-12 translate-x-12 -translate-y-6 pointer-events-none rounded-full blur-2xl" />
        
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground/90 flex items-center gap-2">
            Workflows
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Tự động hóa các tác vụ phức tạp bằng cách kết hợp nhiều Agent và nguồn dữ liệu vào các luồng xử lý tuần tự hoặc song song.
          </p>
        </div>

        {/* Visual Pipeline Stats Capsules */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4 bg-secondary/40 border border-muted-foreground/10 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-inner">
            <div className="space-y-0.5 border-r pr-4">
              <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Tổng Luồng</p>
              <p className="text-sm font-extrabold text-foreground/80">{items.length}</p>
            </div>
            <div className="space-y-0.5 border-r pr-4">
              <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Đang hoạt động</p>
              <p className="text-sm font-extrabold text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {items.length} Active
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Hiệu suất</p>
              <p className="text-sm font-extrabold text-purple-600">99.4%</p>
            </div>
          </div>

          <Button 
            onClick={() => setIsAddOpen(true)}
            className="rounded-xl h-11 gap-2 shadow-lg shadow-purple-500/20 font-bold px-6 bg-purple-600 hover:bg-purple-700 text-white hover:shadow-purple-500/30 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            Tạo Workflow
          </Button>
        </div>
      </div>

      {/* High-density Filters Row */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-card border p-4 rounded-xl shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Tìm kiếm theo tên quy trình hoặc Agent..." 
            className="pl-10 rounded-xl h-11 border-muted-foreground/20 bg-secondary/20 hover:bg-secondary/40 focus:bg-background transition-colors" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1 bg-purple-500/10 text-purple-600 border border-purple-500/10 font-bold text-xs">
            {filteredItems.length} Quy trình phù hợp
          </Badge>
        </div>
      </div>

      {/* Operational Workflow Catalog List */}
      <div className="space-y-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-muted/20 animate-pulse border border-muted-foreground/10" />
          ))
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <Card key={item.id} className="rounded-2xl border border-purple-500/10 shadow-sm hover:border-purple-500/30 hover:shadow-md transition-all group overflow-hidden bg-card relative">
              {/* Left Accent Signature purple bar */}
              <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500" />
              
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 pl-6">
                
                {/* Left Side: Workflow branding, metadata, and connected agents */}
                <div className="flex items-start md:items-center gap-4.5">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shadow-sm shrink-0 group-hover:scale-105 transition-transform duration-300">
                    <Share2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-extrabold text-base text-foreground/90 group-hover:text-purple-600 transition-colors">
                      {item.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Agents liên kết:</span>
                      {item.agents.map(agent => (
                        <Badge key={agent.id} variant="secondary" className="bg-purple-500/5 text-purple-600 border border-purple-500/10 text-[9px] py-0.5 px-2 rounded-md flex items-center gap-1 font-bold">
                          <Bot className="w-3 h-3" />
                          {agent.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Center Column: Trigger details (Asymmetric metadata) */}
                <div className="hidden lg:flex items-center gap-8 shrink-0 text-left border-l pl-8">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Trigger kích hoạt</span>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                      <Zap className="w-3.5 h-3.5 text-amber-500" /> Event-Driven
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Độ tin cậy</span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 99.8% OK
                    </div>
                  </div>
                </div>

                {/* Right Side: Quick Action controls */}
                <div className="flex items-center justify-end gap-3.5 border-t pt-4 md:border-t-0 md:pt-0 shrink-0">
                  <div className="hidden md:flex flex-col items-end mr-2 text-right">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Trạng thái</span>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 rounded-full text-[9px] font-bold px-2 py-0.5 mt-1 flex items-center gap-1 uppercase tracking-wider">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Active
                    </Badge>
                  </div>
                  
                  <Button variant="outline" size="sm" className="rounded-xl h-9.5 gap-1.5 border-muted-foreground/20 font-bold hover:bg-purple-500/5 hover:border-purple-500/30 hover:text-purple-600 transition-all bg-card shadow-sm px-4">
                    <Play className="w-3.5 h-3.5 fill-purple-600 text-purple-600 animate-pulse" />
                    Chạy thử
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9.5 w-9.5 rounded-xl border border-muted-foreground/10 hover:bg-secondary shadow-sm transition-all shrink-0">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-muted-foreground/20 shadow-2xl p-1.5 w-48">
                      <Link href={`/workflows/${item.id}`} className="w-full">
                        <DropdownMenuItem className="rounded-lg text-[11px] font-bold py-2.5 cursor-pointer">
                          <Settings className="w-3.5 h-3.5 mr-2 text-purple-500" /> Mở trình thiết kế
                        </DropdownMenuItem>
                      </Link>
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
          /* Redesigned Premium Empty State with guidance */
          <div className="py-16 px-6 text-center bg-card border border-dashed rounded-2xl max-w-xl mx-auto space-y-5">
             <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center justify-center mx-auto shadow-inner">
               <GitBranch className="w-8 h-8 text-purple-600 opacity-80" />
             </div>
             <div className="space-y-1.5">
               <h3 className="font-extrabold text-lg text-foreground/80">Chưa có quy trình (Workflow) nào</h3>
               <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                 Kết nối các Agent của bạn với luồng công việc tự động. Bắt đầu bằng cách bấm nút <strong>Tạo Workflow</strong> hoặc chọn một tác tử mẫu có sẵn.
               </p>
             </div>
             <Button 
               onClick={() => setIsAddOpen(true)}
               className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md px-6"
             >
               Bắt đầu thiết kế ngay
             </Button>
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
              onClick={async () => {
                if (!newWorkflow.name) {
                  addNotification("error", "Lỗi", "Vui lòng nhập tên quy trình");
                  return;
                }
                try {
                  // 1. Create a real workflow in DB
                  const res = await fetchWithAuth("/workflows/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: newWorkflow.name,
                      description: newWorkflow.description || "",
                      graph: {
                        nodes: [
                          { id: "node_start", type: "start", data: {} },
                          { id: "node_llm", type: "llm", data: { prompt: "Bạn là một AI assistant hữu ích. Hãy trả lời câu hỏi của người dùng: {{node_start.user_query}}" } },
                          { id: "node_answer", type: "answer", data: { answer: "{{node_llm.text}}" } }
                        ],
                        edges: [
                          { source: "node_start", target: "node_llm" },
                          { source: "node_llm", target: "node_answer" }
                        ]
                      }
                    })
                  });
                  
                  if (res.ok) {
                    const createdWorkflow = await res.json();
                    
                    // 2. Link this workflow to the selected agent if specified
                    if (selectedAgentId) {
                      await fetchWithAuth(`/agents/${selectedAgentId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ workflow_id: createdWorkflow.id })
                      });
                    }
                    
                    addNotification("success", "Thành công", "Đã khởi tạo quy trình Workflow thành công! Đang chuyển hướng...");
                    setIsAddOpen(false);
                    refreshAgents();
                    fetchWorkflows();
                    router.push(`/workflows/${createdWorkflow.id}`);
                  } else {
                    addNotification("error", "Lỗi", "Không thể tạo quy trình.");
                  }
                } catch (e) {
                  addNotification("error", "Lỗi", "Có lỗi xảy ra khi tạo quy trình.");
                }
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
