"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { 
  Link2, 
  Loader2, 
  Mail, 
  MessageCircle, 
  Power, 
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Clock,
  ExternalLink,
  AlertTriangle,
  Network
} from "lucide-react";

type OauthConnectorItem = {
  key: "facebook" | "gmail";
  label: string;
  description: string;
  connected: boolean;
  enabled: boolean;
  status: string;
  account?: string | null;
};

export default function ConnectionPage() {
  const [items, setItems] = useState<OauthConnectorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const { addNotification } = useNotifications();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/auth/connectors");
      const data = await res.json();
      setItems((data.items || []) as OauthConnectorItem[]);
    } catch {
      addNotification("error", "Lỗi", "Không tải được connectors.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async (provider: "facebook" | "gmail") => {
    setBusyKey(provider);
    try {
      const route = provider === "facebook" ? "/auth/facebook/connect" : "/auth/google/connect";
      const res = await fetchWithAuth(route);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setBusyKey("");
    }
  };

  const toggle = async (provider: "facebook" | "gmail", enabled: boolean) => {
    setBusyKey(`${provider}-toggle`);
    try {
      await fetchWithAuth(`/auth/connectors/${provider}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await load();
    } finally {
      setBusyKey("");
    }
  };

  const reset = async (provider: "facebook" | "gmail") => {
    if (!confirm("Reset sẽ xóa token OAuth hiện tại. Tiếp tục?")) return;
    setBusyKey(`${provider}-reset`);
    try {
      await fetchWithAuth(`/auth/connectors/${provider}/reset`, { method: "POST" });
      await load();
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Premium Integration Hub Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-card border border-purple-500/10 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[20%] h-[150%] bg-purple-500/5 -skew-x-12 translate-x-12 -translate-y-6 pointer-events-none rounded-full blur-2xl" />
        
        <div className="space-y-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground/90 flex items-center gap-2.5">
            Kết nối ứng dụng
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            Ủy quyền truy cập thông qua giao thức OAuth 2.0 bảo mật để các Agent của bạn tương tác trực tiếp với các kênh liên lạc.
          </p>
        </div>

        {/* Secure Credentials Banner */}
        <div className="flex items-center gap-3.5 bg-emerald-500/10 border border-emerald-500/15 p-4 rounded-xl max-w-xs shrink-0 shadow-inner">
          <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider">OAuth 2.0 Secure</h4>
            <p className="text-[10px] text-muted-foreground font-medium">Thông tin xác thực được mã hóa AES-256 đầu cuối.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-sm font-bold text-muted-foreground">Đang tải cấu hình kết nối...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item) => {
            const isFB = item.key === "facebook";
            
            return (
              <Card 
                key={item.key} 
                className={cn(
                  "rounded-2xl border transition-all overflow-hidden bg-card group flex flex-col justify-between relative shadow-sm",
                  item.connected 
                    ? isFB 
                      ? "border-blue-500/25 hover:border-blue-500/40" 
                      : "border-red-500/25 hover:border-red-500/40"
                    : "border-muted-foreground/10 hover:border-purple-500/20"
                )}
              >
                {/* Brand color accent corner line */}
                <div 
                  className={cn(
                    "absolute top-0 left-0 w-full h-[3px]",
                    isFB ? "bg-blue-600" : "bg-red-500"
                  )} 
                />

                <CardContent className="p-6 space-y-6 relative z-10 flex-1 flex flex-col justify-between">
                  
                  {/* Node Branding Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div 
                        className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center border shadow-sm shrink-0 transition-transform duration-300 group-hover:scale-105",
                          isFB 
                            ? "bg-blue-500/10 border-blue-500/20" 
                            : "bg-red-500/10 border-red-500/20"
                        )}
                      >
                        {isFB ? (
                          <MessageCircle className="w-7 h-7 text-blue-600" />
                        ) : (
                          <Mail className="w-7 h-7 text-red-500" />
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="font-extrabold text-lg text-foreground/90">{item.label}</div>
                        <div className="text-xs text-muted-foreground leading-relaxed pr-2">{item.description}</div>
                      </div>
                    </div>

                    {/* High-contrast Sync health chip */}
                    <div className="shrink-0">
                      {item.connected ? (
                        item.enabled ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 rounded-full text-[9px] font-bold px-2.5 py-0.5 uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Active Sync
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/15 rounded-full text-[9px] font-bold px-2.5 py-0.5 uppercase tracking-wider flex items-center gap-1">
                            Paused
                          </Badge>
                        )
                      ) : (
                        <Badge className="bg-secondary text-muted-foreground border rounded-full text-[9px] font-bold px-2.5 py-0.5 uppercase tracking-wider">
                          Not Linked
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Connected details metadata */}
                  {item.connected && (
                    <div className="bg-secondary/40 border p-4.5 rounded-xl text-xs font-medium space-y-2.5 shadow-inner">
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-purple-500" /> Tần suất đồng bộ:</span>
                        <span className="font-bold text-foreground/80">Thời gian thực (Realtime push)</span>
                      </div>
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-purple-500" /> Tài khoản liên kết:</span>
                        <span className="font-bold text-foreground/90 select-all truncate max-w-[200px]" title={item.account || "contact@wao.ai"}>
                          {item.account || "contact@wao.ai"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action row controls */}
                  <div className="flex items-center justify-between gap-3 pt-4 border-t mt-auto">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      {item.connected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Token Refresh OK
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Setup Required
                        </>
                      )}
                    </span>

                    <div className="flex items-center gap-2">
                      {!item.connected ? (
                        <Button 
                          onClick={() => connect(item.key)} 
                          disabled={busyKey === item.key}
                          className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/10 h-10 px-5 gap-1.5 transition-all"
                        >
                          {busyKey === item.key ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ExternalLink className="w-4 h-4" />
                          )}
                          Kết nối ngay
                        </Button>
                      ) : (
                        <>
                          <Button 
                            variant={item.enabled ? "secondary" : "default"} 
                            onClick={() => toggle(item.key, !item.enabled)}
                            disabled={busyKey === `${item.key}-toggle`}
                            className={cn(
                              "rounded-xl font-bold h-10 px-4 gap-1.5 border transition-all",
                              item.enabled 
                                ? "bg-secondary text-muted-foreground hover:bg-secondary/80 border-muted-foreground/10" 
                                : "bg-purple-600 hover:bg-purple-700 text-white"
                            )}
                          >
                            {busyKey === `${item.key}-toggle` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                            {item.enabled ? "Tắt kết nối" : "Bật kết nối"}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => reset(item.key)}
                            disabled={busyKey === `${item.key}-reset`}
                            className="rounded-xl font-bold h-10 px-3.5 border-muted-foreground/20 hover:bg-red-500/5 hover:border-red-500/30 hover:text-red-500 text-muted-foreground transition-all"
                            title="Xóa token và hủy ủy quyền"
                          >
                            {busyKey === `${item.key}-reset` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                </CardContent>
              </Card>
            );
          })}
          
          {/* MCP Servers Card */}
          <Card 
            className="rounded-2xl border border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/[0.02] transition-all overflow-hidden bg-card group flex flex-col justify-between relative shadow-sm"
          >
            {/* Emerald line accent */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-600" />

            <CardContent className="p-6 space-y-6 relative z-10 flex-1 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 shadow-sm shrink-0 transition-transform duration-300 group-hover:scale-105">
                    <Network className="w-7 h-7 text-emerald-600" />
                  </div>
                  
                  <div className="space-y-1">
                    <div className="font-extrabold text-lg text-foreground/90">Model Context Protocol (MCP)</div>
                    <div className="text-xs text-muted-foreground leading-relaxed pr-2">
                      Kết nối các máy chủ công cụ (Tool Servers) bên ngoài để mở rộng toolkit cho Trợ lý.
                    </div>
                  </div>
                </div>

                <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 rounded-full text-[9px] font-bold px-2.5 py-0.5 uppercase tracking-wider flex items-center gap-1 shrink-0">
                  JSON-RPC SSE
                </Badge>
              </div>

              <div className="bg-secondary/40 border p-4.5 rounded-xl text-xs font-medium space-y-2.5 shadow-inner">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Trạng thái kết nối:</span>
                  <span className="font-bold text-emerald-600">Động (Dynamic tools)</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Kiểu truyền nhận:</span>
                  <span className="font-bold text-foreground/80 font-mono text-[10px]">SSE Handshake hoặc HTTP POST</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-4 border-t mt-auto">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> MCP Standard V1
                </span>

                <Link href="/connection/mcp">
                  <Button 
                    className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/10 h-10 px-5 gap-1.5 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Quản lý máy chủ
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

