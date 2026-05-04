"use client";

import { useState, useEffect } from "react";
import { 
  Plug2, 
  Search, 
  MoreVertical, 
  Trash2, 
  Bot,
  Link2,
  Settings,
  Database,
  Cloud,
  Globe
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

interface ConnectorItem {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
}

export default function ConnectorsPage() {
  const [items, setItems] = useState<ConnectorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // For now, connectors can be mocked or linked to model providers/tools
    const mockConnectors = [
      { id: "1", name: "Google Search API", agentId: "A1", agentName: "WAO Marketing Agent" },
      { id: "2", name: "PostgreSQL Database", agentId: "A2", agentName: "Data Analyst Bot" },
      { id: "3", name: "Shopify Store API", agentId: "A3", agentName: "E-commerce Assistant" },
    ];
    setItems(mockConnectors);
    setLoading(false);
  }, []);

  const filteredItems = items.filter(item => {
    const nameMatch = (item.name || "").toString().toLowerCase().includes(searchQuery.toLowerCase());
    const agentMatch = (item.agentName || "").toString().toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || agentMatch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kết nối (Connectors)</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium opacity-80">Kết nối AI Agent với các hệ thống dữ liệu và ứng dụng bên ngoài.</p>
        </div>
        <Button className="rounded-[0.5rem] h-10 gap-2 shadow-lg shadow-primary/20 font-bold px-6">
          <Plug2 className="w-4 h-4" />
          Thêm kết nối mới
        </Button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-48 rounded-[0.5rem] bg-muted/20 animate-pulse border" />
          ))
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <Card key={item.id} className="rounded-[0.5rem] border shadow-sm hover:border-blue-500/30 transition-all group bg-white/70 dark:bg-white/5 backdrop-blur-xl overflow-hidden flex flex-col">
              <CardContent className="p-6 flex-1">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 rounded-[0.5rem] bg-blue-500/10 flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform">
                    { (item.name || "").toString().includes("Google") ? <Globe className="w-6 h-6 text-blue-600" /> : 
                      (item.name || "").toString().includes("Database") ? <Database className="w-6 h-6 text-blue-600" /> : 
                      <Cloud className="w-6 h-6 text-blue-600" />}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-[0.4rem] hover:bg-white hover:border shadow-sm">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-[0.5rem] border-muted-foreground/20 shadow-xl">
                      <DropdownMenuItem className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer">
                        <Settings className="w-3.5 h-3.5 mr-2" /> Kiểm tra kết nối
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer text-destructive focus:text-destructive">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Ngắt kết nối
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <h3 className="font-bold text-lg text-foreground/90">{item.name}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[11px] font-bold text-green-600 uppercase tracking-wider">Đang kết nối</span>
                </div>
              </CardContent>
              <div className="px-6 py-4 bg-muted/20 border-t mt-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-bold text-muted-foreground">@{item.agentName}</span>
                  </div>
                  <Link2 className="w-4 h-4 text-muted-foreground/40" />
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white/40 rounded-[0.5rem] border border-dashed">
             <Plug2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
             <p className="font-bold text-muted-foreground">Không tìm thấy kết nối nào</p>
          </div>
        )}
      </div>
    </div>
  );
}
