"use client";

import { useState, useEffect } from "react";
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
import { cn } from "@/lib/utils";
import { useAgents } from "@/hooks/use-agents";

interface KnowledgeItem {
  id: string;
  fileName: string;
  objectName: string;
  agentId: string;
  agentName: string;
  fileType: string;
}

export default function KnowledgePage() {
  const { agents, loading } = useAgents();
  const [searchQuery, setSearchQuery] = useState("");

  const items: KnowledgeItem[] = [];
  agents.forEach(agent => {
    if (agent.knowledge_files) {
      agent.knowledge_files.forEach((file: any) => {
        const isString = typeof file === "string";
        const fileName = isString ? (file.split("/").pop() || file) : (file.filename || file.object_name);
        const objectName = isString ? file : (file.object_name || file.filename);
        const fileType = fileName.split(".").pop()?.toUpperCase() || "FILE";

        items.push({
          id: `${agent.id}-${objectName}`,
          fileName: fileName,
          objectName: objectName,
          agentId: agent.id,
          agentName: agent.name,
          fileType: fileType
        });
      });
    }
  });

  const filteredItems = items.filter(item => 
    item.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.agentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kho Tri Thức</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium opacity-80">Quản lý toàn bộ tài liệu đã tải lên hệ thống.</p>
        </div>
        <Button className="rounded-[0.5rem] h-10 gap-2 shadow-lg shadow-primary/20 font-bold px-6">
          <Database className="w-4 h-4" />
          Quản lý Bucket
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white/40 dark:bg-white/5 backdrop-blur-xl p-4 rounded-[0.5rem] border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Tìm tài liệu hoặc agent..." 
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
                        <div className="flex items-center gap-2">
                          <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-[13px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">{item.agentName}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="rounded-[0.4rem] text-[10px] font-bold border-muted-foreground/20 px-2 py-0.5">
                          {item.fileType}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[0.4rem] hover:bg-white hover:border shadow-sm">
                            <Download className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[0.4rem] hover:bg-white hover:border shadow-sm">
                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-[0.5rem] border-muted-foreground/20 shadow-xl">
                              <DropdownMenuItem className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer">
                                <ExternalLink className="w-3.5 h-3.5 mr-2" /> Xem chi tiết
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer text-destructive focus:text-destructive">
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Xóa khỏi Agent
                              </DropdownMenuItem>
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
    </div>
  );
}
