"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Search, 
  Wrench, 
  Activity, 
  FolderTree, 
  Bot, 
  ChevronDown, 
  ChevronUp, 
  Users, 
  CheckCircle2,
  ShieldCheck,
  Cpu,
  Loader2
} from "lucide-react";

type AvailableTool = {
  name: string;
  label: string;
  description: string;
  category: string;
};

type Agent = {
  id: string;
  name: string;
  tools?: Array<string | { name?: string }>;
};

type GroupedTool = AvailableTool & {
  usedBy: { id: string; name: string }[];
};

export default function ToolsPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tools, setTools] = useState<AvailableTool[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [toolsRes, agentsRes] = await Promise.all([
          fetchWithAuth("/agents/tools/available"),
          fetchWithAuth("/agents/"),
        ]);
        const toolsData = toolsRes.ok ? await toolsRes.json() : [];
        const agentsData = agentsRes.ok ? await agentsRes.json() : [];
        setTools(Array.isArray(toolsData) ? toolsData : []);
        setAgents(Array.isArray(agentsData) ? agentsData : []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const grouped = useMemo(() => {
    const normalized = tools.map((tool) => {
      const usedBy = agents
        .filter((agent) => (agent.tools || []).some((t) => (typeof t === "string" ? t : t?.name) === tool.name))
        .map((a) => ({ id: a.id, name: a.name }));
      return { ...tool, usedBy } as GroupedTool;
    });

    const keyword = search.trim().toLowerCase();
    const filtered = normalized.filter((t) => {
      if (!keyword) return true;
      return [t.name, t.label, t.description, t.category]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(keyword));
    });

    const groups: Record<string, GroupedTool[]> = {};
    for (const tool of filtered) {
      const cat = tool.category || "Khác";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tool);
    }
    return groups;
  }, [tools, agents, search]);

  const stats = useMemo(() => {
    const allTools = Object.values(grouped).flat();
    return {
      categories: Object.keys(grouped).length,
      totalTools: allTools.length,
      activeTools: allTools.filter((t) => t.usedBy.length > 0).length,
    };
  }, [grouped]);

  const toggleGroup = (name: string) => setOpenGroups((p) => ({ ...p, [name]: !p[name] }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Sleek Asymmetrical Header with Active Sandbox Indicator */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-card border border-purple-500/10 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[20%] h-[150%] bg-purple-500/5 -skew-x-12 translate-x-12 -translate-y-6 pointer-events-none rounded-full blur-2xl" />
        
        <div className="space-y-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground/90 flex items-center gap-2.5">
            <Wrench className="w-8 h-8 text-purple-500" /> Đăng ký công cụ (Tools & Functions)
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            Danh mục các công cụ hệ thống, API tích hợp và kỹ năng mở rộng được kết hợp trực tiếp vào khả năng tư duy của các AI Agent.
          </p>
        </div>

        {/* Secure Sandbox Badge */}
        <div className="flex items-center gap-3.5 bg-emerald-500/10 border border-emerald-500/15 p-4 rounded-xl max-w-xs shrink-0 shadow-inner">
          <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider">Secure Execution</h4>
            <p className="text-[10px] text-muted-foreground font-medium">Môi trường Sandbox an toàn, cô lập cuộc gọi API hệ thống.</p>
          </div>
        </div>
      </div>

      {/* Asymmetric Statistics Matrix (60% / 40% split) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Dominant Utilization Coverage Panel (60% width) */}
        <div className="lg:col-span-3 bg-card border rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-[40%] h-[150%] bg-emerald-500/5 -skew-x-12 translate-x-24 -translate-y-12 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-500" />
          
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Active Utilization</span>
              </div>
              <div className="bg-emerald-500/10 p-2.5 rounded-xl">
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            
            <div className="mt-4 flex items-baseline gap-3">
              <h3 className="text-4xl font-extrabold tracking-tight">
                {stats.activeTools} <span className="text-xl font-normal text-muted-foreground">/ {stats.totalTools} Tools</span>
              </h3>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold text-xs">
                {stats.totalTools > 0 ? Math.round((stats.activeTools / stats.totalTools) * 100) : 0}% Active Coverage
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Tỉ lệ công cụ được liên kết trực tiếp vào tác tử đang chạy</p>
          </div>

          <div className="mt-6 space-y-2">
            <div className="w-full bg-muted dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-1000" 
                style={{ width: `${stats.totalTools > 0 ? (stats.activeTools / stats.totalTools) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stacked Rails (40% width) */}
        <div className="lg:col-span-2 flex flex-col justify-between gap-4">
          
          {/* Service Domain Domains Rail */}
          <div className="bg-card border rounded-2xl p-4.5 shadow-sm hover:border-purple-500/20 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-4.5">
              <div className="bg-purple-500/10 p-3 rounded-xl group-hover:bg-purple-500/20 transition-colors">
                <FolderTree className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Lĩnh vực dịch vụ</p>
                <h4 className="text-xl font-extrabold mt-0.5">{stats.categories} Danh mục</h4>
                <p className="text-[11px] text-purple-600 font-semibold mt-0.5">Phân tách theo ngữ cảnh</p>
              </div>
            </div>
            <Badge variant="outline" className="rounded-md border-purple-500/20 bg-purple-500/5 text-purple-500 font-bold text-[10px]">
              System Domain
            </Badge>
          </div>

          {/* Secure sandbox status Rail */}
          <div className="bg-card border rounded-2xl p-4.5 shadow-sm hover:border-indigo-500/20 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-4.5">
              <div className="bg-indigo-500/10 p-3 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
                <Cpu className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Sandbox Security</p>
                <h4 className="text-xl font-extrabold mt-0.5">100% Encrypted</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Môi trường Sandbox an toàn</p>
              </div>
            </div>
            <div className="bg-indigo-500/10 text-indigo-600 p-1.5 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

        </div>
      </div>

      {/* High-density Filters Row */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-card border p-4 rounded-xl shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Tìm kiếm công cụ theo tên, nhãn hoặc mô tả..." 
            className="pl-10 rounded-xl h-11 border-muted-foreground/20 bg-secondary/20 hover:bg-secondary/40 focus:bg-background transition-colors" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category Boards Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-sm font-bold text-muted-foreground">Đang tải danh sách công cụ...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, list]) => {
            const open = openGroups[category] ?? true;
            const activeCount = list.filter((t) => t.usedBy.length > 0).length;
            
            return (
              <Card key={category} className="overflow-hidden border border-purple-500/10 shadow-sm rounded-2xl bg-card">
                
                {/* Board Header Category Trigger */}
                <div 
                  className="p-4.5 border-b flex items-center justify-between cursor-pointer hover:bg-secondary/30 transition-colors select-none" 
                  onClick={() => toggleGroup(category)}
                >
                  <div className="flex items-center gap-3">
                    <div className="font-extrabold text-base text-foreground/90">{category}</div>
                    <Badge variant="secondary" className="rounded-full font-bold bg-purple-500/10 text-purple-600 border border-purple-500/10 text-[10px] px-2 py-0.5">
                      {list.length} tools
                    </Badge>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 rounded-full font-bold text-[10px] px-2 py-0.5 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> {activeCount} đang dùng
                    </Badge>
                  </div>
                  {open ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>

                {/* List items block */}
                {open && (
                  <div className="divide-y divide-purple-500/5">
                    {list.map((tool) => (
                      <div 
                        key={tool.name} 
                        className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6 items-center hover:bg-secondary/10 transition-colors"
                      >
                        {/* Left Side: Tool information and connected bots */}
                        <div className="space-y-3.5">
                          <div>
                            <div className="font-extrabold text-base text-foreground/90 flex items-center gap-2">
                              {tool.label || tool.name}
                              <span className="font-mono text-[9px] font-semibold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded uppercase tracking-wider">
                                {tool.name}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                              {tool.description || "Chưa có mô tả kỹ thuật chi tiết dành cho công cụ này."}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 pt-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Agent sử dụng:</span>
                            {tool.usedBy.length > 0 ? (
                              tool.usedBy.map((a) => (
                                <Badge key={a.id} className="bg-purple-500/5 text-purple-600 border border-purple-500/10 text-[9px] py-0.5 px-2 rounded-md flex items-center gap-1 font-bold">
                                  <Bot className="w-3 h-3 text-purple-500 animate-pulse" />
                                  {a.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[11px] italic text-muted-foreground">Không có Agent nào kết nối</span>
                            )}
                          </div>
                        </div>

                        {/* Right Side: Security sandbox state widget */}
                        <div className="bg-secondary/40 border p-4 rounded-xl flex lg:flex-col justify-between gap-3.5 shadow-inner shrink-0">
                          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-purple-500" /> Tác tử liên kết:</span>
                            <span className="font-bold text-foreground/80">{tool.usedBy.length} agent</span>
                          </div>
                          
                          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground border-t lg:border-t-0 lg:pt-0 pt-2">
                            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-purple-500" /> Trạng thái hoạt động:</span>
                            <span className={cn(
                              "font-bold text-xs uppercase tracking-wider flex items-center gap-1",
                              tool.usedBy.length > 0 ? "text-emerald-600" : "text-muted-foreground"
                            )}>
                              {tool.usedBy.length > 0 ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Đang chạy
                                </>
                              ) : (
                                "Nhàn rỗi"
                              )}
                            </span>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
