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
import { Trash2, Edit2, Play, Pause, Settings, MoreVertical, Search, Plus, Bot, ArrowUpRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api";
import { useAgents, Agent } from "@/hooks/use-agents";

export default function AgentsPage() {
  const { agents, loading, toggleAgentStatus, deleteAgent } = useAgents();
  const [filter, setFilter] = useState<"all" | "running" | "paused">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    await toggleAgentStatus(id, currentStatus);
  };

  const handleDelete = async (id: string) => {
    await deleteAgent(id);
  };

  const filteredAgents = agents.filter(agent => {
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
