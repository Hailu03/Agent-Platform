"use client";

import { useState, useEffect } from "react";
import {
  Wrench,
  Zap,
  Search,
  MoreVertical,
  Trash2,
  Bot,
  BrainCircuit,
  Settings,
  Plus,
  X,
  Sparkles,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { fetchWithAuth } from "@/lib/api";
import { useNotifications } from "@/hooks/use-notifications";
import { useAgents } from "@/hooks/use-agents";
import { cn } from "@/lib/utils";

interface SkillItem {
  id: string;
  name: string;
  description: string;
  content: string;
  is_template: boolean;
  created_at: string;
}

export default function SkillsPage() {
  const [items, setItems] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { addNotification } = useNotifications();
  const { agents, refreshAgents } = useAgents();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [editingSkill, setEditingSkill] = useState<SkillItem | null>(null);
  const [newSkill, setNewSkill] = useState({
    name: "",
    description: "",
    content: ""
  });

  const handleUpdateSkill = async () => {
    if (!editingSkill || !editingSkill.name || !editingSkill.content) return;
    setIsSubmitting(true);
    try {
      const res = await fetchWithAuth(`/skills/${editingSkill.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingSkill)
      });
      if (res.ok) {
        addNotification("success", "Thành công", "Đã cập nhật kỹ năng.");
        setIsEditOpen(false);
        fetchSkills();
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Không thể cập nhật kỹ năng.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSkillFromAgent = async (skillName: string, agentId: string) => {
    if (!window.confirm(`Bạn có chắc muốn gỡ kỹ năng này khỏi Agent?`)) return;
    try {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;
      
      const updatedTools = (agent.tools || []).filter((t: string) => t !== skillName);
      const updatedSkills = (agent.skills || []).filter((s: string) => s !== skillName);
      
      const res = await fetchWithAuth(`/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          tools: updatedTools,
          skills: updatedSkills
        })
      });

      if (res.ok) {
        addNotification("success", "Thành công", "Đã gỡ kỹ năng khỏi Agent.");
        refreshAgents();
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Không thể gỡ kỹ năng.");
    }
  };

  const getAgentsUsingSkill = (skill: any) => {
    return agents.filter(agent => {
      const allResources = [...(agent.tools || []), ...(agent.skills || [])];
      return allResources.some(resource => {
        const resourceStr = (typeof resource === "string" ? resource : (resource.name || resource.label || resource.id || "")).toLowerCase().trim();
        const skillName = (skill.name || "").toLowerCase().trim();
        const skillId = (skill.id || "").toLowerCase().trim();
        
        return resourceStr === skillName || resourceStr === skillId || resourceStr.includes(skillName);
      });
    });
  };

  const handleInheritFromAgent = (agentId: string | null) => {
    if (!agentId) return;
    setSelectedAgentId(agentId);
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setNewSkill({
        name: `Kỹ năng cho ${agent.name}`,
        description: `Dựa trên cấu hình của ${agent.name}.`,
        content: `Mục tiêu: Thực hiện nhiệm vụ cho ${agent.name}.\n\nHướng dẫn hệ thống hiện tại của Agent:\n${agent.instructions || "Không có"}`
      });
    }
  };

  const fetchSkills = async () => {
    try {
      const res = await fetchWithAuth("/skills/");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const handleCreateSkill = async () => {
    if (!newSkill.name || !newSkill.content) {
      addNotification("warning", "Thiếu thông tin", "Vui lòng nhập tên và nội dung Markdown cho kỹ năng.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetchWithAuth("/skills/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSkill)
      });

      if (res.ok) {
        addNotification("success", "Thành công", "Đã tạo kỹ năng mới.");
        
        // Nếu có chọn Agent, tự động gán skill vào agent đó
        if (selectedAgentId) {
          try {
            const agent = agents.find(a => a.id === selectedAgentId);
            if (agent) {
              const existingSkills = Array.isArray(agent.skills) ? agent.skills : [];
              if (!existingSkills.includes(newSkill.name)) {
                await fetchWithAuth(`/agents/${selectedAgentId}`, {
                   method: "PATCH",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify({ skills: [...existingSkills, newSkill.name] })
                });
                addNotification("success", "Liên kết thành công", `Đã gán kỹ năng vào Agent ${agent.name}`);
                refreshAgents();
              }
            }
          } catch (e) {
            console.error("Failed to link skill to agent:", e);
          }
        }

        setShowCreateModal(false);
        setNewSkill({ name: "", description: "", content: "" });
        setSelectedAgentId(null);
        fetchSkills();
      } else {
        throw new Error("Failed to create skill");
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Không thể tạo kỹ năng.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa kỹ năng này?")) return;

    try {
      const res = await fetchWithAuth(`/skills/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        addNotification("success", "Đã xóa", "Kỹ năng đã được gỡ bỏ.");
        fetchSkills();
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Không thể xóa kỹ năng.");
    }
  };

  const filteredItems = items.filter(item => {
    const agentsUsing = getAgentsUsingSkill(item);
    if (agentsUsing.length === 0) return false;

    const nameMatch = (item.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = (item.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || descMatch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thiết kế Kỹ năng</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium opacity-80">Tự định nghĩa các module tư duy và kỹ năng chuyên biệt cho AI Agent.</p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="rounded-[0.5rem] h-10 gap-2 shadow-lg shadow-primary/20 font-bold px-6"
        >
          <Plus className="w-4 h-4" />
          Thiết kế Kỹ năng
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white/40 dark:bg-white/5 backdrop-blur-xl p-4 rounded-[0.5rem] border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kỹ năng..."
            className="pl-10 rounded-[0.5rem] h-11 border-muted-foreground/20 bg-background/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1 bg-amber-500/10 text-amber-600 border-none">
            {items.length} Kỹ năng tùy chỉnh
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-8">
        {/* Main Content Column: Skills Horizontal List-Rows */}
        <div className="space-y-4">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted/20 animate-pulse border" />
            ))
          ) : filteredItems.length > 0 ? (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const agentsUsing = getAgentsUsingSkill(item);
                return (
                  <div
                    key={item.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border border-muted-foreground/10 bg-white/50 dark:bg-zinc-950/20 backdrop-blur-xl hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/[0.02] hover:-translate-y-0.5 transition-all duration-300 group gap-4 relative overflow-hidden"
                  >
                    {/* Ambient hover light glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/[0.01] rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/[0.03] transition-all duration-500" />
                    
                    {/* Column 1: Basic Info & Icon */}
                    <div className="flex items-center gap-4 min-w-0 md:w-[280px] shrink-0">
                      <div className="w-11 h-11 rounded-xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                        <Zap className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-foreground/90 truncate group-hover:text-amber-600 transition-colors" title={item.name}>
                          {item.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-mono text-muted-foreground/50">ID: {item.id.slice(0, 8)}</span>
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-none text-[8px] h-3.5 px-1.5 font-bold uppercase rounded">Custom</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Short Description */}
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed font-medium">
                        {item.description || "Không có mô tả chi tiết cho kỹ năng này."}
                      </p>
                    </div>

                    {/* Column 3: Linked Agents */}
                    <div className="flex items-center gap-1.5 flex-wrap md:w-[200px] shrink-0">
                      {agentsUsing.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {agentsUsing.map(agent => (
                            <Badge key={agent.id} variant="secondary" className="bg-primary/5 text-primary border-none text-[9px] font-bold py-0.5 px-2 rounded flex items-center gap-1">
                              <Bot className="w-2.5 h-2.5" />
                              <span className="max-w-[70px] truncate">{agent.name}</span>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 italic font-medium">Chưa gán cho Agent</span>
                      )}
                    </div>

                    {/* Column 4: Administrative Actions */}
                    <div className="flex items-center justify-end gap-1.5 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 rounded-lg text-xs font-bold hover:bg-amber-500/10 hover:text-amber-600 transition-all border border-transparent hover:border-amber-500/10"
                        onClick={() => {
                          setEditingSkill(item);
                          setIsEditOpen(true);
                        }}
                      >
                        <Settings className="w-3.5 h-3.5 mr-1" /> Chỉnh sửa
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted border border-transparent shadow-sm">
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl border-muted-foreground/15 shadow-xl w-48">
                          {agentsUsing.map(agent => (
                            <DropdownMenuItem
                              key={agent.id}
                              onClick={() => handleRemoveSkillFromAgent(item.name, agent.id)}
                              className="rounded-lg text-[11px] font-bold py-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Gỡ khỏi {agent.name}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem
                            onClick={() => handleDeleteSkill(item.id)}
                            className="rounded-lg text-[11px] font-bold py-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 border-t mt-1 pt-2"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Xóa hoàn toàn
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center bg-white/30 dark:bg-zinc-950/10 rounded-2xl border border-dashed flex flex-col items-center justify-center p-6">
              <BrainCircuit className="w-12 h-12 mb-4 opacity-20 text-primary" />
              <p className="font-bold text-muted-foreground text-sm">Không tìm thấy kỹ năng phù hợp</p>
            </div>
          )}
        </div>

        {/* Right Telemetry & Guidance Rail */}
        <div className="hidden xl:flex flex-col gap-6">
          {/* Tracker Metrics */}
          <Card className="rounded-2xl border border-muted-foreground/10 bg-white/40 dark:bg-zinc-950/20 backdrop-blur-xl shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
            <CardHeader className="p-5 border-b shrink-0 bg-muted/5">
              <CardTitle className="text-[10px] font-mono tracking-widest text-muted-foreground/70 uppercase">Trạng thái Phân phối</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-2xl font-black text-foreground">{items.length}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">TỔNG KỸ NĂNG</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 leading-normal font-medium">Kỹ năng được lưu dưới dạng Prompt Directive tùy biến để nhúng trực tiếp.</p>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase mb-1">
                    <span>Đã liên kết Agent</span>
                    <span>{Math.round((items.filter(item => getAgentsUsingSkill(item).length > 0).length / (items.length || 1)) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                      style={{ width: `${(items.filter(item => getAgentsUsingSkill(item).length > 0).length / (items.length || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Handbook Guide */}
          <Card className="rounded-2xl border border-muted-foreground/10 bg-white/40 dark:bg-zinc-950/20 backdrop-blur-xl shadow-sm overflow-hidden relative">
            <CardHeader className="p-5 border-b shrink-0 bg-muted/5">
              <CardTitle className="text-[10px] font-mono tracking-widest text-muted-foreground/70 uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Cẩm nang Directive
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-[11px] text-muted-foreground font-medium leading-relaxed">
              <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-amber-700 dark:text-amber-500">
                <strong className="block mb-1 text-xs">Cấu trúc tốt nhất:</strong>
                Sử dụng cú pháp Markdown phân cấp rõ ràng (dùng #, ##, 1. 2.) để LLM phân tách chỉ chỉ dễ dàng nhất.
              </div>
              <div className="space-y-2 pt-1 pl-1">
                <p>• Phân chia rõ ràng giữa **Mục tiêu chính** và **Các ràng buộc cấm kỵ**.</p>
                <p>• Viết kèm ví dụ Few-Shot mẫu để tăng độ chuẩn xác phản hồi của Agent.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Skill Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setShowCreateModal(false)} />
          <Card className="w-full max-w-xl relative z-10 shadow-2xl border-white/20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl animate-in zoom-in-95 duration-300 rounded-[1.5rem] overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">Thiết kế Kỹ năng mới</CardTitle>
                  <CardDescription className="text-xs">Xác định cách Agent sẽ tư duy khi sử dụng kỹ năng này.</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowCreateModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase flex items-center gap-2">
                  <Bot className="w-3 h-3" /> Chọn Agent
                </label>
                <Select value={selectedAgentId || ""} onValueChange={handleInheritFromAgent}>
                  <SelectTrigger className="rounded-xl border-muted-foreground/20 h-11 bg-primary/5 border-primary/20 w-full overflow-hidden">
                    <span className="truncate text-left">
                      {selectedAgentId ? (agents.find(a => a.id === selectedAgentId)?.name || "Đang tải...") : "Chọn một Agent để kích hoạt..."}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id} className="font-medium cursor-pointer">
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground italic">Lưu ý: Thao tác này sẽ tự động điền các thông tin cơ bản và hướng dẫn từ Agent được chọn.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase">Tên kỹ năng</label>
                <Input
                  placeholder="Ví dụ: Chuyên gia Phân tích Tài chính"
                  value={newSkill.name}
                  onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                  className="rounded-xl border-muted-foreground/20 h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase">Mô tả ngắn</label>
                <Input
                  placeholder="Kỹ năng giúp Agent đọc hiểu báo cáo tài chính..."
                  value={newSkill.description}
                  onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                  className="rounded-xl border-muted-foreground/20 h-11"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground/70 uppercase">Chỉ dẫn kỹ năng (Prompt Instruction)</label>
                  <Badge variant="outline" className="text-[9px] font-bold text-primary border-primary/20 bg-primary/5 px-2 py-0">QUAN TRỌNG</Badge>
                </div>
                <Textarea
                  placeholder="Khi sử dụng kỹ năng này, bạn cần phải: 1. Kiểm tra bảng cân đối kế toán... 2. Tính toán các chỉ số ROE, ROI..."
                  value={newSkill.content}
                  onChange={(e) => setNewSkill({ ...newSkill, content: e.target.value })}
                  className="rounded-xl border-muted-foreground/20 min-h-[200px] p-4 text-sm leading-relaxed"
                />
                <p className="text-[10px] text-muted-foreground italic">Phần này sẽ được tự động đưa vào System Instruction của Agent khi kỹ năng này được kích hoạt.</p>
              </div>
            </CardContent>
            <div className="p-4 border-t bg-muted/10 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)} className="rounded-xl font-bold">Hủy</Button>
              <Button
                onClick={handleCreateSkill}
                disabled={isSubmitting}
                className="rounded-xl px-8 font-bold bg-primary text-white shadow-lg shadow-primary/20"
              >
                {isSubmitting ? "Đang lưu..." : "Lưu Kỹ năng"}
              </Button>
            </div>
          </Card>
        </div>
      )}
      {/* Edit Skill Modal */}
      {isEditOpen && editingSkill && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setIsEditOpen(false)} />
          <Card className="w-full max-w-xl relative z-10 shadow-2xl border-white/20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl animate-in zoom-in-95 duration-300 rounded-[1.5rem] overflow-hidden">
            <CardHeader className="border-b bg-amber-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <Settings className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Chỉnh sửa Kỹ năng</CardTitle>
                    <CardDescription className="text-xs">Cập nhật tư duy và hướng dẫn cho kỹ năng này.</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsEditOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Tên kỹ năng</label>
                <Input
                  className="rounded-xl border-muted-foreground/20 focus:border-amber-500/50"
                  value={editingSkill.name}
                  onChange={(e) => setEditingSkill({...editingSkill, name: e.target.value})}
                  placeholder="Ví dụ: Phân tích báo cáo tài chính..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Mô tả ngắn</label>
                <Input
                  className="rounded-xl border-muted-foreground/20"
                  value={editingSkill.description}
                  onChange={(e) => setEditingSkill({...editingSkill, description: e.target.value})}
                  placeholder="Giúp Agent hiểu khi nào nên dùng kỹ năng này..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1 flex justify-between">
                  Nội dung Kỹ năng (Markdown)
                  <Badge variant="outline" className="text-[9px] font-bold py-0 h-4 border-amber-500/30 text-amber-600">Core Logic</Badge>
                </label>
                <Textarea
                  className="rounded-xl min-h-[350px] font-mono text-sm border-muted-foreground/20 focus:border-amber-500/50 leading-relaxed"
                  value={editingSkill.content}
                  onChange={(e) => setEditingSkill({...editingSkill, content: e.target.value})}
                  placeholder="### Hướng dẫn...\n\n1. Bước 1: ..."
                />
              </div>
            </CardContent>

            <div className="p-4 border-t bg-muted/10 flex gap-3">
              <Button 
                variant="ghost" 
                className="flex-1 rounded-xl font-bold h-11" 
                onClick={() => setIsEditOpen(false)}
              >
                Hủy
              </Button>
              <Button 
                className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold h-11 shadow-lg shadow-amber-600/20 gap-2"
                disabled={isSubmitting}
                onClick={handleUpdateSkill}
              >
                {isSubmitting ? <span className="animate-spin mr-2">◌</span> : <Save className="w-4 h-4" />}
                Lưu thay đổi
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

