"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Database, 
  FileText, 
  Search, 
  MoreVertical, 
  ExternalLink, 
  Trash2, 
  Download,
  Bot
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
import { Plus, Upload, X } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { useAgents } from "@/hooks/use-agents";
import { fetchWithAuth } from "@/lib/api";

interface KnowledgeItem {
  id: string;
  fileName: string;
  objectName: string;
  agents: { id: string, name: string }[];
  fileType: string;
}

export default function KnowledgePage() {
  const router = useRouter();
  const { agents, loading, refreshAgents } = useAgents();
  const { addNotification } = useNotifications();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewingFile, setPreviewingFile] = useState<KnowledgeItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const handleDeleteFile = async (item: KnowledgeItem, agentId: string) => {
    const agentName = item.agents.find(a => a.id === agentId)?.name;
    if (!window.confirm(`Bạn có chắc muốn xóa tài liệu "${item.fileName}" khỏi Agent "${agentName}"?`)) return;

    try {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      const updatedFiles = (agent.knowledge_files || []).filter((f: any) => {
        const fName = typeof f === "string" ? f : (f.object_name || f.filename);
        return fName !== item.objectName;
      });
      
      const res = await fetchWithAuth(`/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledge_files: updatedFiles })
      });

      if (res.ok) {
        addNotification("success", "Thành công", `Đã xóa tài liệu khỏi Agent ${agent.name}.`);
        refreshAgents();
      } else {
        throw new Error("Failed to update agent knowledge");
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Không thể xóa tài liệu.");
    }
  };

  const handlePreviewFile = async (item: KnowledgeItem) => {
    setPreviewingFile(item);
    setIsPreviewOpen(true);
    setIsPreviewLoading(true);
    setPreviewUrl(null);
    setTextContent(null);

    try {
      const res = await fetchWithAuth(`/agents/knowledge/presigned-url?object_name=${encodeURIComponent(item.objectName)}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url);

        // Nếu là file text, fetch thêm nội dung để hiển thị đẹp hơn
        if (['TXT', 'MD', 'CSV', 'JSON'].includes(item.fileType)) {
          const contentRes = await fetch(data.url);
          if (contentRes.ok) {
            const text = await contentRes.text();
            setTextContent(text);
          }
        }
      } else {
        addNotification("error", "Lỗi", "Không thể lấy link xem trước.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDownloadFile = async (item: KnowledgeItem) => {
    try {
      const res = await fetchWithAuth(`/agents/knowledge/presigned-url?object_name=${encodeURIComponent(item.objectName)}&disposition=attachment`);
      if (res.ok) {
        const data = await res.json();
        // Create a temporary link to trigger download
        const link = document.createElement('a');
        link.href = data.url;
        // link.download = item.fileName; // The header now handles this
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addNotification("success", "Đang tải", `Bắt đầu tải tệp ${item.fileName}`);
      } else {
        addNotification("error", "Lỗi", "Không thể lấy link tải tệp.");
      }
    } catch (e) {
      console.error(e);
      addNotification("error", "Lỗi", "Lỗi khi tải tệp.");
    }
  };

  const handleInheritFromAgent = (agentId: string | null) => {
    if (!agentId) return;
    setSelectedAgentId(agentId);
  };

  const knowledgeMap: Record<string, KnowledgeItem> = {};
  agents.forEach(agent => {
    if (agent.knowledge_files) {
      agent.knowledge_files.forEach((file: any) => {
        const isString = typeof file === "string";
        const fileName = isString ? (file.split("/").pop() || file) : (file.filename || file.object_name);
        const objectName = isString ? file : (file.object_name || file.filename);
        const fileType = fileName.split(".").pop()?.toUpperCase() || "FILE";

        if (!knowledgeMap[objectName]) {
          knowledgeMap[objectName] = {
            id: objectName,
            fileName: fileName,
            objectName: objectName,
            agents: [],
            fileType: fileType
          };
        }
        knowledgeMap[objectName].agents.push({
          id: agent.id,
          name: agent.name
        });
      });
    }
  });

  const items = Object.values(knowledgeMap);

  const filteredItems = items.filter(item => {
    const fileMatch = (item.fileName || "").toString().toLowerCase().includes(searchQuery.toLowerCase());
    const agentMatch = item.agents.some(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return fileMatch || agentMatch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kho Tri Thức</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium opacity-80">Quản lý toàn bộ tài liệu đã tải lên hệ thống.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            className="rounded-[0.5rem] h-10 gap-2 shadow-lg shadow-primary/20 font-bold px-6"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Thêm tài liệu
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white/40 dark:bg-white/5 backdrop-blur-xl p-4 rounded-[0.5rem] border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Tìm tài liệu ..." 
            className="pl-10 rounded-[0.5rem] h-11 border-muted-foreground/20 bg-background/50" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1 bg-primary/10 text-primary border-none">
            {items.length} Tài liệu
          </Badge>
        </div>
      </div>

      {/* Content */}
      <Card className="rounded-[0.5rem] border shadow-sm bg-white/70 dark:bg-white/5 backdrop-blur-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tên tài liệu</th>
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sử dụng bởi Agent</th>
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Định dạng</th>
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="p-4"><div className="h-6 bg-muted/20 rounded-[0.3rem]" /></td>
                    </tr>
                  ))
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-[0.5rem] bg-primary/5 flex items-center justify-center border shadow-sm group-hover:scale-105 transition-transform">
                            <FileText className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-bold text-[13px] text-foreground/90">{item.fileName}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.agents.map(agent => (
                            <Badge key={agent.id} variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[10px] py-0.5 rounded-md flex items-center gap-1">
                              <Bot className="w-3 h-3" />
                              {agent.name}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="rounded-[0.4rem] text-[10px] font-bold border-muted-foreground/20 px-2 py-0.5">
                          {item.fileType}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-[0.4rem] hover:bg-white hover:border shadow-sm"
                            onClick={() => handleDownloadFile(item)}
                          >
                            <Download className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[0.4rem] hover:bg-white hover:border shadow-sm">
                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-[0.5rem] border-muted-foreground/20 shadow-xl">
                              <DropdownMenuItem 
                                className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer"
                                onClick={() => handlePreviewFile(item)}
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-2" /> Xem chi tiết
                              </DropdownMenuItem>
                              {item.agents.map(agent => (
                                <DropdownMenuItem 
                                  key={agent.id}
                                  className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                                  onClick={() => handleDeleteFile(item, agent.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Gỡ khỏi {agent.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-40">
                        <Database className="w-12 h-12" />
                        <p className="font-bold text-sm">Chưa có tài liệu nào được thêm</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Knowledge Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[1.5rem] overflow-hidden p-0 border-none shadow-2xl">
          <DialogHeader className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/20 shadow-sm">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Thêm tài liệu mới</DialogTitle>
                <DialogDescription className="text-xs font-medium">Tải tài liệu lên để làm giàu tri thức cho Agent.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* Kế thừa từ Agent */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Bot className="w-3 h-3 text-primary" /> Áp dụng cho Agent
              </label>
              <Select value={selectedAgentId || ""} onValueChange={handleInheritFromAgent}>
                <SelectTrigger className="rounded-xl h-11 border-muted-foreground/20 bg-primary/5 border-primary/20 font-medium w-full overflow-hidden">
                  <span className="truncate text-left">
                    {selectedAgentId ? (agents.find(a => a.id === selectedAgentId)?.name || "Đang tải...") : "Chọn một Agent để gán tài liệu..."}
                  </span>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-muted-foreground/20 shadow-xl">
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id} className="font-medium focus:bg-primary/5 cursor-pointer">
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground italic">Lưu ý: Tài liệu sẽ được tải lên thư mục riêng biệt của Agent này.</p>
            </div>

            <div className="space-y-4">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tải tệp tin</label>
              <div className="border-2 border-dashed border-muted-foreground/20 rounded-[1.5rem] p-10 flex flex-col items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-bold text-foreground/80">Nhấp để chọn hoặc kéo thả tệp</p>
                <p className="text-[10px] text-muted-foreground mt-1">PDF, DOCX, TXT (Max 10MB)</p>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t flex gap-2">
            <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="rounded-xl font-bold">Hủy</Button>
            <Button 
              className="rounded-xl px-8 font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
              disabled={!selectedAgentId}
              onClick={() => {
                addNotification("info", "Tính năng đang phát triển", "Hệ thống đang chuẩn bị môi trường tải lên...");
                setIsAddOpen(false);
              }}
            >
              Bắt đầu tải lên
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="fixed inset-0 max-w-none w-screen h-screen m-0 rounded-none p-0 border-none shadow-none flex flex-col bg-white dark:bg-zinc-950 z-[9999] [&>button]:hidden">
          <DialogHeader className="p-3 md:p-4 bg-white dark:bg-zinc-900 border-b shrink-0 flex flex-row items-center justify-between space-y-0 px-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-sm md:text-base font-bold truncate max-w-[200px] md:max-w-md">
                  {previewingFile?.fileName}
                </DialogTitle>
                <p className="text-[10px] text-muted-foreground font-medium hidden md:block">
                  Sử dụng bởi: {previewingFile?.agents.map(a => a.name).join(", ")} • {previewingFile?.fileType}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 rounded-lg font-bold gap-2 text-xs border-muted-foreground/20 hover:bg-muted/10"
                onClick={() => window.open(previewUrl || '', '_blank')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mở tab mới</span>
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-8 rounded-lg font-bold gap-2 text-xs shadow-lg shadow-destructive/20"
                onClick={() => setIsPreviewOpen(false)}
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đóng</span>
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 bg-zinc-100 dark:bg-zinc-950 overflow-hidden relative">
            {isPreviewLoading ? (
              <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <p className="text-xs font-bold text-muted-foreground animate-pulse">Đang tải tài liệu...</p>
              </div>
            ) : textContent ? (
              <div className="w-full h-full overflow-y-auto p-6 md:px-32 lg:px-64 bg-white dark:bg-zinc-900 font-mono text-[14px] leading-relaxed whitespace-pre-wrap select-text selection:bg-primary/20">
                {textContent}
              </div>
            ) : previewUrl ? (
              <div className="w-full h-full relative">
                {(previewingFile?.fileType === 'PDF' || previewingFile?.fileType === 'DOCX' || previewingFile?.fileType === 'TXT') ? (
                  <iframe 
                    src={previewUrl} 
                    className="w-full h-full border-none bg-white"
                    title="File Preview"
                  />
                ) : ['PNG', 'JPG', 'JPEG', 'GIF', 'SVG'].includes(previewingFile?.fileType || '') ? (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-full shadow-2xl rounded-sm object-contain" />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-6 p-12 text-center bg-white">
                    <div className="w-20 h-20 rounded-3xl bg-amber-500/10 flex items-center justify-center border-2 border-amber-500/20">
                      <FileText className="w-10 h-10 text-amber-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-bold text-lg">Định dạng này không hỗ trợ xem trực tiếp</h3>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">Vui lòng tải xuống hoặc mở trong tab mới để xem nội dung.</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center space-y-4 opacity-50 p-12 text-center bg-white">
                <X className="w-12 h-12 text-destructive" />
                <p className="text-sm font-bold">Lỗi tải tài liệu</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
