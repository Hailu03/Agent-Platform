"use client";

import { useState, useEffect } from "react";
import { 
  Bot, 
  Zap, 
  Database, 
  ArrowUpRight, 
  Activity,
  Plus,
  CheckCircle2,
  Clock,
  Server,
  Sparkles,
  Cpu,
  Layers,
  Globe,
  RefreshCw,
  MessageSquare,
  Mail,
  ChevronRight,
  Terminal,
  Sliders
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const [user, setUser] = useState<{ full_name: string } | null>(null);
  const [activeSegment, setActiveSegment] = useState(7);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      try {
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          setUser(data);
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };

    fetchUser();
    
    // Simple load simulation effect for premium realistic feel
    const interval = setInterval(() => {
      setActiveSegment(prev => {
        const change = Math.random() > 0.5 ? 1 : -1;
        const next = prev + change;
        return next >= 5 && next <= 9 ? next : prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Sleek Asymmetrical Welcome Banner */}
      <div className="relative overflow-hidden bg-card border border-purple-500/10 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 group">
        <div className="absolute top-0 left-0 w-1 bg-purple-500 h-full" />
        <div className="absolute -right-24 -top-24 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl group-hover:bg-purple-500/10 transition-all duration-700" />
        <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-700" />
        
        <div className="relative z-10 space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-600 border border-purple-500/10 mb-1">
            <Sparkles className="w-3 h-3 text-purple-500" /> AI Platform Command Center
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground/90">
            Chào buổi sáng, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400">{user?.full_name || "Admin"}</span>! 👋
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Hệ thống đang hoạt động ở mức tối ưu. 12 tác tử nhân tạo (AI Agents) của bạn sẵn sàng xử lý yêu cầu.
          </p>
        </div>
        
        <div className="relative z-10 shrink-0 flex flex-wrap items-center gap-3">
          <Button variant="outline" className="rounded-xl border-muted-foreground/20 font-bold hover:bg-secondary/50 shadow-sm transition-all h-11 px-5">
            Xem báo cáo
          </Button>
          <Link href="/agents/create">
            <Button className="rounded-xl gap-2 shadow-lg shadow-purple-500/20 font-bold hover:shadow-purple-500/30 transition-all bg-purple-600 hover:bg-purple-700 text-white h-11 px-6">
              <Plus className="w-4 h-4" />
              Tạo Agent mới
            </Button>
          </Link>
        </div>
      </div>

      {/* Asymmetric Metrics Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Dominant Throughput Panel (60% equivalent span) */}
        <div className="lg:col-span-3 bg-card border rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-[40%] h-[150%] bg-emerald-500/5 -skew-x-12 translate-x-24 -translate-y-12 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-500" />
          
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Active Throughput</span>
              </div>
              <div className="bg-emerald-500/10 p-2.5 rounded-xl">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            
            <div className="mt-4 flex items-baseline gap-3">
              <h3 className="text-4xl font-extrabold tracking-tight">1,284</h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" /> +15.2%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Yêu cầu xử lý so với tuần trước</p>
          </div>

          {/* Active Server Load Indicator Bar */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" /> Tải lượng máy chủ
              </span>
              <span className="text-foreground/80">{activeSegment * 10}% (Tối ưu)</span>
            </div>
            <div className="flex gap-1 h-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex-1 rounded-sm transition-all duration-500",
                    i < activeSegment 
                      ? i < 7 ? "bg-emerald-500" : "bg-amber-500" 
                      : "bg-muted dark:bg-neutral-800"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Sub Stats Row */}
          <div className="grid grid-cols-3 gap-4 border-t pt-5 mt-6">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Thành công</p>
              <p className="text-base font-extrabold mt-0.5 text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> 98.5%
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Độ trễ trung bình</p>
              <p className="text-base font-extrabold mt-0.5 text-foreground/80 flex items-center gap-1">
                <Clock className="w-4 h-4 text-purple-500" /> 240ms
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Đỉnh tải</p>
              <p className="text-base font-extrabold mt-0.5 text-foreground/80 flex items-center gap-1">
                <Cpu className="w-4 h-4 text-purple-500" /> 4.2k/phút
              </p>
            </div>
          </div>
        </div>

        {/* Stacked Metric Rails (40% equivalent span) */}
        <div className="lg:col-span-2 flex flex-col justify-between gap-4">
          
          {/* Agent Census Rail */}
          <div className="bg-card border rounded-2xl p-4.5 shadow-sm hover:border-purple-500/20 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-4.5">
              <div className="bg-purple-500/10 p-3 rounded-xl group-hover:bg-purple-500/20 transition-colors">
                <Bot className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Tác tử nhân tạo</p>
                <h4 className="text-xl font-extrabold mt-0.5">12 Deployed</h4>
                <p className="text-[11px] text-purple-600 font-semibold mt-0.5">+2 mới trong tháng này</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            </div>
          </div>

          {/* Knowledge Storage Rail */}
          <div className="bg-card border rounded-2xl p-4.5 shadow-sm hover:border-indigo-500/20 transition-all flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4.5">
                <div className="bg-indigo-500/10 p-3 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
                  <Database className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Knowledge base</p>
                  <h4 className="text-xl font-extrabold mt-0.5">450 MB</h4>
                </div>
              </div>
              <Badge variant="outline" className="rounded-md border-indigo-500/20 bg-indigo-500/5 text-indigo-500 font-bold text-[10px]">
                84 Tài liệu
              </Badge>
            </div>
            <div className="mt-3.5 space-y-1">
              <div className="w-full bg-muted dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: "45%" }} />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground font-semibold">
                <span>Dung lượng đã dùng: 45%</span>
                <span>Max: 1 GB</span>
              </div>
            </div>
          </div>

          {/* Operational Health Rail */}
          <div className="bg-card border rounded-2xl p-4.5 shadow-sm hover:border-emerald-500/20 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-4.5">
              <div className="bg-emerald-500/10 p-3 rounded-xl group-hover:bg-emerald-500/20 transition-colors relative">
                <Activity className="w-5 h-5 text-emerald-600" />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card animate-ping" />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Operational Health</p>
                <h4 className="text-xl font-extrabold mt-0.5">98.5% Uptime</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Đã giải quyết 32,840 tickets</p>
              </div>
            </div>
            <div className="bg-emerald-500/10 text-emerald-600 p-1.5 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

        </div>
      </div>

      {/* Asymmetric Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Columns (2/3 width) - Agent Catalog */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground/90">Hạm đội Agent (Agent Fleet)</h2>
              <p className="text-xs text-muted-foreground">Điều khiển, cấu hình và theo dõi phản hồi trực tiếp.</p>
            </div>
            <Link href="/agents">
              <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-700 font-bold gap-1 text-xs">
                Xem tất cả <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {/* Featured Agent Card & Secondary Row Layout */}
          <div className="space-y-6">
            {/* Dominant Featured Agent Card - CSKH Bot */}
            <div className="bg-card border border-purple-500/20 rounded-2xl p-6 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-[30%] h-[120%] bg-purple-500/5 -skew-x-12 translate-x-16 -translate-y-8 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/10 transition-all duration-500" />
              <div className="absolute top-0 left-0 w-1 bg-purple-500 h-full" />
              
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shadow-inner group-hover:scale-105 transition-transform duration-300">
                      <Bot className="w-8 h-8 text-purple-600 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-xl leading-none">CSKH Bot</h3>
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Đang chạy
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 max-w-md">
                        Tác tử trả lời tự động câu hỏi khách hàng về tính năng sản phẩm và giá cả dịch vụ.
                      </p>
                    </div>
                  </div>

                  {/* Connected Channels & Integration Chips */}
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Integrations:</span>
                      <div className="flex -space-x-1.5">
                        <div className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center" title="Facebook Messenger">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div className="w-6 h-6 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center" title="Gmail API">
                          <Mail className="w-3.5 h-3.5 text-red-500" />
                        </div>
                        <div className="w-6 h-6 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center" title="Custom Hook">
                          <Plus className="w-2.5 h-2.5 text-purple-600" />
                        </div>
                      </div>
                    </div>

                    <div className="h-4 w-[1px] bg-border hidden sm:block" />

                    <div className="flex items-center gap-3 text-xs font-semibold">
                      <span className="text-muted-foreground">Confidence: <strong className="text-purple-600">94.2%</strong></span>
                      <span className="w-1 h-1 rounded-full bg-muted" />
                      <span className="text-muted-foreground">Avg Response: <strong className="text-foreground/80">1.2s</strong></span>
                    </div>
                  </div>
                </div>

                {/* Quick actions for Featured Agent */}
                <div className="shrink-0 flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl border-muted-foreground/20 font-bold h-9 bg-secondary/30">
                    <Sliders className="w-3.5 h-3.5 mr-1.5" /> Cấu hình
                  </Button>
                  <Link href="/chat">
                    <Button size="sm" className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white h-9 shadow-sm">
                      Mở Chat <ArrowUpRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Simulated Live Logging Feed */}
              <div className="mt-5 bg-zinc-950 dark:bg-black/60 rounded-xl p-3.5 border border-purple-500/10 font-mono text-[11px] leading-relaxed text-purple-300/80 shadow-inner">
                <div className="flex items-center justify-between border-b border-purple-950 pb-2 mb-2 text-[10px] font-bold text-muted-foreground tracking-wider">
                  <span className="flex items-center gap-1.5 text-purple-400">
                    <Terminal className="w-3 h-3 text-purple-500" /> RUNTIME MONITOR
                  </span>
                  <span className="animate-pulse flex items-center gap-1 text-emerald-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> LIVE CONNECT
                  </span>
                </div>
                <div className="space-y-1 select-none">
                  <div className="flex gap-2">
                    <span className="text-purple-500/50">12:15:02</span>
                    <span>[System] CSKH Bot successfully mounted onto Facebook channel.</span>
                  </div>
                  <div className="flex gap-2 text-indigo-400">
                    <span className="text-purple-500/50">12:15:05</span>
                    <span>[Message] Facebook API -&gt; Raw Request &quot;Báo giá gói Enterprise&quot; received.</span>
                  </div>
                  <div className="flex gap-2 text-emerald-400">
                    <span className="text-purple-500/50">12:15:06</span>
                    <span>[RAG-Engine] Query vectors retrieved. Intent (Pricing/Sales) confidence 97.4%.</span>
                  </div>
                  <div className="flex gap-2 text-amber-300">
                    <span className="text-purple-500/50">12:15:06</span>
                    <span>[Agent] Synthesized response in 1.2s. Status: Success. Sent.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Secondary Agent Grid (3 Columns or Stacked) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Secondary Agent 1: Data Analyst */}
              <div className="bg-card border rounded-2xl p-4.5 shadow-sm hover:border-amber-500/30 transition-all flex flex-col justify-between group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/10 group-hover:scale-105 transition-transform duration-300">
                    <Database className="w-5 h-5 text-amber-600" />
                  </div>
                  <Badge className="bg-amber-100 dark:bg-amber-500/10 text-amber-600 border-none font-bold text-[9px] py-0.5 px-2 rounded-md uppercase tracking-wider">
                    Chờ xử lý
                  </Badge>
                </div>
                <div>
                  <h4 className="font-extrabold text-base leading-none text-foreground/90">Data Analyst</h4>
                  <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
                    Phân tích số liệu và tự động vẽ biểu đồ doanh thu từ excel.
                  </p>
                </div>
                <div className="mt-4 pt-3.5 border-t flex items-center justify-between text-[11px] font-semibold">
                  <span className="px-2 py-0.5 bg-secondary rounded-md text-muted-foreground">Research</span>
                  <Link href="/agents" className="text-muted-foreground group-hover:text-amber-600 transition-colors flex items-center">
                    Cấu hình <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                  </Link>
                </div>
              </div>

              {/* Secondary Agent 2: Social Poster (Error State) */}
              <div className="bg-card border rounded-2xl p-4.5 shadow-sm hover:border-red-500/30 transition-all flex flex-col justify-between group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-red-500" />
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/10 group-hover:scale-105 transition-transform duration-300">
                    <Bot className="w-5 h-5 text-red-500" />
                  </div>
                  <Badge className="bg-red-100 dark:bg-red-500/10 text-red-500 border-none font-bold text-[9px] py-0.5 px-2 rounded-md uppercase tracking-wider">
                    Lỗi kết nối
                  </Badge>
                </div>
                <div>
                  <h4 className="font-extrabold text-base leading-none text-foreground/90">Social Poster</h4>
                  <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
                    Tự động tạo nội dung và lên lịch đăng bài lên Fanpage Facebook.
                  </p>
                </div>
                <div className="mt-4 pt-3.5 border-t flex items-center justify-between text-[11px] font-semibold">
                  <span className="px-2 py-0.5 bg-secondary rounded-md text-muted-foreground">Marketing</span>
                  <button className="text-red-500 hover:underline flex items-center gap-0.5 font-bold">
                    <RefreshCw className="w-3 h-3 animate-spin mr-0.5" /> Thử lại
                  </button>
                </div>
              </div>

              {/* Secondary Agent 3: Legal Advisor */}
              <div className="bg-card border rounded-2xl p-4.5 shadow-sm hover:border-indigo-500/30 transition-all flex flex-col justify-between group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10 group-hover:scale-105 transition-transform duration-300">
                    <Layers className="w-5 h-5 text-indigo-500" />
                  </div>
                  <Badge className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 border-none font-bold text-[9px] py-0.5 px-2 rounded-md uppercase tracking-wider">
                    Đang chạy
                  </Badge>
                </div>
                <div>
                  <h4 className="font-extrabold text-base leading-none text-foreground/90">Legal Advisor</h4>
                  <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
                    Soát lỗi và đối chiếu tính pháp lý của điều khoản hợp đồng.
                  </p>
                </div>
                <div className="mt-4 pt-3.5 border-t flex items-center justify-between text-[11px] font-semibold">
                  <span className="px-2 py-0.5 bg-secondary rounded-md text-muted-foreground">Legal Tech</span>
                  <Link href="/agents" className="text-muted-foreground group-hover:text-indigo-500 transition-colors flex items-center">
                    Cấu hình <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column (1/3 width) - Threaded Activity Feed */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground/90">Nhật ký hoạt động</h2>
              <p className="text-xs text-muted-foreground">Luồng sự kiện thời gian thực.</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-0.5 bg-secondary rounded-md">Realtime</span>
          </div>

          <div className="bg-card border rounded-2xl p-6 space-y-6 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-full h-[150%] bg-purple-500/5 -skew-y-12 translate-y-36 pointer-events-none rounded-full blur-3xl" />
            
            {/* Custom Vertical Connecting Thread Line */}
            <div className="relative space-y-6">
              <div className="absolute left-[17px] top-2.5 w-[2px] h-[calc(100%-24px)] bg-muted dark:bg-neutral-800" />
              
              <ActivityItem 
                time="2 phút trước" 
                user="CSKH Bot" 
                action="đã hoàn thành xử lý ticket #482 thành công."
                icon={CheckCircle2}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
                borderColor="border-emerald-500/20"
              />
              <ActivityItem 
                time="15 phút trước" 
                user="Hệ thống RAG" 
                action="đã cập nhật và đồng bộ 12 tài liệu từ Google Drive."
                icon={Database}
                iconColor="text-indigo-500"
                bgColor="bg-indigo-500/10"
                borderColor="border-indigo-500/20"
              />
              <ActivityItem 
                time="1 giờ trước" 
                user="Quản trị viên" 
                action="đã cập nhật sơ đồ RAG cho Data Analyst."
                icon={Sliders}
                iconColor="text-purple-500"
                bgColor="bg-purple-500/10"
                borderColor="border-purple-500/20"
              />
              <ActivityItem 
                time="3 giờ trước" 
                user="Social Poster" 
                action="đã gửi tự động báo cáo hiệu quả tuần qua Slack."
                icon={Globe}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
                borderColor="border-blue-500/20"
              />
            </div>
            
            <Button variant="secondary" className="w-full rounded-xl font-bold h-10 border border-muted-foreground/10 hover:bg-secondary/80 mt-2 transition-all">
              Xem toàn bộ logs hệ thống
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}

interface ActivityItemProps {
  time: string;
  user: string;
  action: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
  borderColor: string;
}

function ActivityItem({ time, user, action, icon: Icon, iconColor, bgColor, borderColor }: ActivityItemProps) {
  return (
    <div className="flex gap-4 relative z-10">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-sm", bgColor, borderColor)}>
        <Icon className={cn("w-4 h-4", iconColor)} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xs text-foreground/80 leading-none">{user}</span>
          <span className="text-[9px] font-semibold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded leading-none flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> {time}
          </span>
        </div>
        <p className="text-[12px] leading-relaxed text-muted-foreground font-medium">
          {action}
        </p>
      </div>
    </div>
  );
}

