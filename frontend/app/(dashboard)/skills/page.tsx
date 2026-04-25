"use client";

import { useState, useEffect } from "react";
import { 
  Wrench, 
  Zap, 
  Search, 
  MoreVertical, 
  ExternalLink, 
  Trash2, 
  Bot,
  BrainCircuit,
  Settings
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

interface SkillItem {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
}

export default function SkillsPage() {
  const [items, setItems] = useState<SkillItem[]>([]);
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
          const allSkills: SkillItem[] = [];
          data.forEach(agent => {
            if (agent.skills) {
              agent.skills.forEach((skill: string) => {
                allSkills.push({
                  id: `${agent.id}-${skill}`,
                  name: skill,
                  agentId: agent.id,
                  agentName: agent.name
                });
              });
            }
          });
          setItems(allSkills);
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
          <h1 className="text-3xl font-bold tracking-tight">Thư viện Kỹ năng</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium opacity-80">Các kỹ năng nâng cao đã được trang bị cho AI Agent.</p>
        </div>
        <Button className="rounded-[0.5rem] h-10 gap-2 shadow-lg shadow-primary/20 font-bold px-6">
          <BrainCircuit className="w-4 h-4" />
          Kỹ năng mới
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white/40 dark:bg-white/5 backdrop-blur-xl p-4 rounded-[0.5rem] border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Tìm kỹ năng hoặc agent..." 
            className="pl-10 rounded-[0.5rem] h-11 border-muted-foreground/20 bg-background/50" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1 bg-yellow-500/10 text-yellow-600 border-none">
            {items.length} Kỹ năng kích hoạt
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-40 rounded-[0.5rem] bg-muted/20 animate-pulse border" />
          ))
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <Card key={item.id} className="rounded-[0.5rem] border shadow-sm hover:border-yellow-500/30 transition-all group bg-white/70 dark:bg-white/5 backdrop-blur-xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-[0.5rem] bg-yellow-500/10 flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform">
                    <Zap className="w-5 h-5 text-yellow-600" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[0.4rem] hover:bg-white hover:border shadow-sm">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-[0.5rem] border-muted-foreground/20 shadow-xl">
                      <DropdownMenuItem className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer">
                        <Settings className="w-3.5 h-3.5 mr-2" /> Cấu hình kỹ năng
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer text-destructive focus:text-destructive">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Hủy kích hoạt
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <h3 className="font-bold text-lg text-foreground/90">{item.name}</h3>
                
                <div className="mt-6 flex items-center justify-between border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-bold text-muted-foreground">@{item.agentName}</span>
                  </div>
                  <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-none rounded-full text-[9px] font-bold px-2 py-0.5">
                    Advanced
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white/40 rounded-[0.5rem] border border-dashed">
             <Wrench className="w-12 h-12 mx-auto mb-4 opacity-20" />
             <p className="font-bold text-muted-foreground">Không tìm thấy kỹ năng nào</p>
          </div>
        )}
      </div>
    </div>
  );
}
