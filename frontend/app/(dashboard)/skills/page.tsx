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
import { fetchWithAuth } from "@/lib/api";
import { useNotifications } from "@/hooks/use-notifications";
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
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSkill, setNewSkill] = useState({
    name: "",
    description: "",
    content: ""
  });

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
        setShowCreateModal(false);
        setNewSkill({ name: "", description: "", content: "" });
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-48 rounded-[0.5rem] bg-muted/20 animate-pulse border" />
          ))
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <Card key={item.id} className="rounded-[0.5rem] border shadow-sm hover:border-amber-500/30 transition-all group bg-white/70 dark:bg-white/5 backdrop-blur-xl overflow-hidden flex flex-col">
              <CardContent className="p-6 flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-[0.5rem] bg-amber-500/10 flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform">
                    <Zap className="w-5 h-5 text-amber-600" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[0.4rem] hover:bg-white hover:border shadow-sm">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-[0.5rem] border-muted-foreground/20 shadow-xl">
                      <DropdownMenuItem className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer">
                        <Settings className="w-3.5 h-3.5 mr-2" /> Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteSkill(item.id)}
                        className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Xóa kỹ năng
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <h3 className="font-bold text-lg text-foreground/90 mb-2">{item.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {item.description || "Không có mô tả."}
                </p>
              </CardContent>
              <div className="px-6 py-4 bg-muted/10 border-t flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">Custom Skill</span>
                <Badge className="bg-amber-500/10 text-amber-600 border-none rounded-full text-[9px] font-bold px-2 py-0.5">
                  ID: {item.id.slice(0, 8)}
                </Badge>
              </div>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white/40 rounded-[0.5rem] border border-dashed flex flex-col items-center">
             <BrainCircuit className="w-12 h-12 mb-4 opacity-20 text-primary" />
             <p className="font-bold text-muted-foreground">Bạn chưa thiết kế kỹ năng nào</p>
             <Button 
                variant="link" 
                className="mt-2 text-primary font-bold"
                onClick={() => setShowCreateModal(true)}
             >
               Bắt đầu thiết kế ngay
             </Button>
          </div>
        )}
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
                <label className="text-xs font-bold text-foreground/70 uppercase">Tên kỹ năng</label>
                <Input 
                  placeholder="Ví dụ: Chuyên gia Phân tích Tài chính" 
                  value={newSkill.name}
                  onChange={(e) => setNewSkill({...newSkill, name: e.target.value})}
                  className="rounded-xl border-muted-foreground/20 h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase">Mô tả ngắn</label>
                <Input 
                  placeholder="Kỹ năng giúp Agent đọc hiểu báo cáo tài chính..." 
                  value={newSkill.description}
                  onChange={(e) => setNewSkill({...newSkill, description: e.target.value})}
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
                  onChange={(e) => setNewSkill({...newSkill, content: e.target.value})}
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
    </div>
  );
}

