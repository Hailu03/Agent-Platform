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

interface WorkflowItem {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
}

export default function WorkflowsPage() {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchAgents = async () => {
      const token = localStorage.getItem("access_token");
      try {
        const res = await fetch("http://localhost:8000/api/v1/agents/", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (Array.isArray(data)) {
          const allTools: WorkflowItem[] = [];
          data.forEach(agent => {
            if (agent.tools) {
              agent.tools.forEach((tool: string) => {
                allTools.push({
                  id: `${agent.id}-${tool}`,
                  name: tool,
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

    fetchAgents();
  }, []);

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.agentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quy trình (Workflows)</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium opacity-80">Điều phối các công việc phức tạp thông qua sơ đồ luồng.</p>
        </div>
        <Button className="rounded-[0.5rem] h-10 gap-2 shadow-lg shadow-primary/20 font-bold px-6">
          <GitBranch className="w-4 h-4" />
          Tạo Workflow
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white/40 dark:bg-white/5 backdrop-blur-xl p-4 rounded-[0.5rem] border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Tìm quy trình hoặc agent..." 
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
                    <div className="flex items-center gap-2 mt-1">
                      <Bot className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] font-medium text-muted-foreground">Kích hoạt bởi: {item.agentName}</span>
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
                    <DropdownMenuContent align="end" className="rounded-[0.5rem] border-muted-foreground/20 shadow-xl">
                      <DropdownMenuItem className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer">
                        <Settings className="w-3.5 h-3.5 mr-2" /> Mở trình thiết kế
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer text-destructive focus:text-destructive">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Gỡ bỏ khỏi luồng
                      </DropdownMenuItem>
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
    </div>
  );
}
