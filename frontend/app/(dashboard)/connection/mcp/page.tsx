"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Network, 
  Plus, 
  Loader2, 
  Trash2, 
  Edit2, 
  Wrench, 
  CheckCircle2, 
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Cpu,
  Key,
  Terminal,
  Activity,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

type MCPServerItem = {
  id: string;
  name: string;
  url: string;
  auth_type: string;
  auth_config: any;
  is_active: boolean;
  created_at: string;
};

type ToolDef = {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
};

export default function MCPServersPage() {
  const [servers, setServers] = useState<MCPServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editServer, setEditServer] = useState<MCPServerItem | null>(null);
  const [busyServerId, setBusyServerId] = useState("");
  const { addNotification } = useNotifications();

  // Expanded server details to view dynamic tools
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);
  const [serverTools, setServerTools] = useState<Record<string, ToolDef[]>>({});
  const [loadingToolsId, setLoadingToolsId] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [authType, setAuthType] = useState("none");
  const [authKey, setAuthKey] = useState(""); // Stores api key or token
  const [authHeader, setAuthHeader] = useState("X-API-Key"); // Optional for API Key header name
  const [customHeadersJson, setCustomHeadersJson] = useState("{}"); // Optional for custom
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadServers = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/mcp/");
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      }
    } catch {
      addNotification("error", "Lỗi", "Không tải được danh sách MCP Servers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setName("");
    setUrl("");
    setAuthType("none");
    setAuthKey("");
    setAuthHeader("X-API-Key");
    setCustomHeadersJson("{}");
    setTestResult(null);
    setEditServer(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleOpenEdit = (server: MCPServerItem) => {
    setEditServer(server);
    setName(server.name);
    setUrl(server.url);
    setAuthType(server.auth_type);
    
    // Parse auth_config values
    const config = server.auth_config || {};
    if (server.auth_type === "api_key") {
      setAuthKey(config.api_key || config.value || "");
      setAuthHeader(config.header_name || "X-API-Key");
    } else if (server.auth_type === "bearer_token") {
      setAuthKey(config.token || config.value || "");
    } else if (server.auth_type === "custom") {
      setCustomHeadersJson(JSON.stringify(config.headers || config, null, 2));
    }
    
    setTestResult(null);
    setShowAddDialog(true);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    // Build auth config
    let auth_config: any = {};
    if (authType === "api_key") {
      auth_config = { header_name: authHeader, api_key: authKey };
    } else if (authType === "bearer_token") {
      auth_config = { token: authKey };
    } else if (authType === "custom") {
      try {
        auth_config = JSON.parse(customHeadersJson);
      } catch {
        addNotification("error", "Lỗi", "JSON Headers tùy biến không hợp lệ.");
        setIsTesting(false);
        return;
      }
    }

    try {
      const res = await fetchWithAuth("/mcp/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, auth_type: authType, auth_config }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult(data.connected);
        if (data.connected) {
          addNotification("success", "Thành công", "Kết nối MCP Server hoạt động tốt!");
        } else {
          addNotification("error", "Thất bại", "Không kết nối được tới MCP Server.");
        }
      }
    } catch {
      setTestResult(false);
      addNotification("error", "Lỗi", "Gặp lỗi khi thử kết nối.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) {
      addNotification("error", "Lỗi", "Vui lòng nhập đầy đủ Tên và URL.");
      return;
    }

    setIsSaving(true);
    
    let auth_config: any = {};
    if (authType === "api_key") {
      auth_config = { header_name: authHeader, api_key: authKey };
    } else if (authType === "bearer_token") {
      auth_config = { token: authKey };
    } else if (authType === "custom") {
      try {
        auth_config = JSON.parse(customHeadersJson);
      } catch {
        addNotification("error", "Lỗi", "JSON Headers tùy biến không hợp lệ.");
        setIsSaving(false);
        return;
      }
    }

    const payload = {
      name,
      url,
      auth_type: authType,
      auth_config
    };

    try {
      let res;
      if (editServer) {
        res = await fetchWithAuth(`/mcp/${editServer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetchWithAuth("/mcp/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        addNotification("success", "Thành công", editServer ? "Cập nhật MCP Server thành công!" : "Tạo kết nối MCP Server thành công!");
        setShowAddDialog(false);
        resetForm();
        loadServers();
      } else {
        const err = await res.json();
        addNotification("error", "Lỗi", err.detail || "Không thể lưu cấu hình.");
      }
    } catch {
      addNotification("error", "Lỗi", "Lỗi kết nối tới hệ thống.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa kết nối MCP Server này? Mọi Agent đang dùng sẽ mất quyền truy cập các tools từ server này.")) return;
    setBusyServerId(id);
    try {
      const res = await fetchWithAuth(`/mcp/${id}`, { method: "DELETE" });
      if (res.ok) {
        addNotification("success", "Thành công", "Đã xóa máy chủ MCP.");
        loadServers();
      }
    } catch {
      addNotification("error", "Lỗi", "Lỗi khi thực hiện xóa.");
    } finally {
      setBusyServerId("");
    }
  };

  const handleToggleActive = async (server: MCPServerItem) => {
    setBusyServerId(server.id);
    try {
      const res = await fetchWithAuth(`/mcp/${server.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !server.is_active }),
      });
      if (res.ok) {
        loadServers();
      }
    } catch {
      addNotification("error", "Lỗi", "Không cập nhật được trạng thái.");
    } finally {
      setBusyServerId("");
    }
  };

  const fetchServerTools = async (serverId: string) => {
    if (expandedServerId === serverId) {
      setExpandedServerId(null);
      return;
    }

    setExpandedServerId(serverId);
    if (serverTools[serverId]) return; // Already loaded

    setLoadingToolsId(serverId);
    try {
      const res = await fetchWithAuth(`/mcp/${serverId}/tools`);
      if (res.ok) {
        const data = await res.json();
        setServerTools(prev => ({ ...prev, [serverId]: data.tools || [] }));
      } else {
        const err = await res.json();
        addNotification("error", "Lỗi tải tools", err.detail || "Không tải được danh sách tool.");
      }
    } catch {
      addNotification("error", "Lỗi", "Lỗi kết nối khi tải danh sách tool.");
    } finally {
      setLoadingToolsId("");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-zinc-150 dark:border-zinc-800 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Link 
              href="/connection" 
              className="w-9 h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 transition-all bg-white dark:bg-zinc-900 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
              <span className="p-2 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-inner">
                <Network className="w-7 h-7" />
              </span> 
              Model Context Protocol (MCP) Hub
            </h1>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-3xl pl-12">
            Kết nối an toàn đến các máy chủ MCP ngoài (Tool Servers). Sau khi kết nối, các Agent của bạn có thể kế thừa và thực thi các công cụ đó tự động qua giao thức chuẩn hóa JSON-RPC.
          </p>
        </div>

        <Button 
          onClick={handleOpenAdd}
          className="rounded-xl h-11 gap-2 shadow-lg shadow-emerald-500/15 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white pl-4 pr-5 self-start lg:self-center shrink-0 border-0 transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Thêm MCP Server
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-500/25 border-t-emerald-600 animate-spin" />
            <Network className="w-5 h-5 text-emerald-600 absolute animate-pulse" />
          </div>
          <p className="text-sm font-black text-zinc-500 dark:text-zinc-400">Đang quét máy chủ MCP...</p>
        </div>
      ) : servers.length === 0 ? (
        <Card className="border-dashed border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10 rounded-3xl py-20 text-center max-w-xl mx-auto shadow-sm">
          <CardContent className="space-y-5">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 dark:from-emerald-500/20 dark:to-teal-500/10 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-inner">
              <Network className="w-10 h-10 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-lg text-zinc-800 dark:text-zinc-200">Chưa có kết nối MCP Server nào</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
                Kết nối máy chủ công cụ bên ngoài đầu tiên của bạn để mở rộng trí tuệ và khả năng thực thi tác vụ cho Agent.
              </p>
            </div>
            <Button 
              onClick={handleOpenAdd}
              className="rounded-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 border-0 shadow-md shadow-emerald-500/10 active:scale-95 transition-all"
            >
              Thêm Server ngay
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {servers.map((server) => {
            const isExpanded = expandedServerId === server.id;
            const tools = serverTools[server.id] || [];
            
            return (
              <Card 
                key={server.id}
                className={cn(
                  "rounded-3xl border transition-all overflow-hidden bg-white dark:bg-zinc-900/60 shadow-sm relative group hover:shadow-md",
                  server.is_active 
                    ? "border-emerald-500/20 dark:border-emerald-500/10 hover:border-emerald-500/40 dark:hover:border-emerald-500/30" 
                    : "border-zinc-205 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                )}
              >
                {/* Brand Accent top line */}
                <div 
                  className={cn(
                    "absolute top-0 left-0 w-full h-[4px] transition-all",
                    server.is_active ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-zinc-300 dark:bg-zinc-700"
                  )} 
                />

                <CardContent className="p-6 md:p-8 space-y-6 relative z-10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    {/* Basic Info */}
                    <div className="flex items-center gap-4">
                      <div 
                        className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center border shadow-sm shrink-0 transition-all duration-300 group-hover:scale-105",
                          server.is_active 
                            ? "bg-emerald-50 dark:bg-emerald-500/20 border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400" 
                            : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500"
                        )}
                      >
                        <Cpu className="w-7 h-7" />
                      </div>
                      
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-extrabold text-lg text-zinc-805 dark:text-zinc-100 leading-none truncate max-w-[200px] sm:max-w-xs">{server.name}</h3>
                          <Badge variant="outline" className={cn(
                            "text-[9px] h-5 font-black uppercase tracking-wider rounded-full border shadow-sm px-2",
                            server.is_active
                              ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                              : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                          )}>
                            {server.auth_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono truncate max-w-[280px] sm:max-w-md md:max-w-lg lg:max-w-xl" title={server.url}>
                          {server.url}
                        </p>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-3 self-end md:self-center">
                      {/* View Tools Toggle Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchServerTools(server.id)}
                        className={cn(
                          "h-10 px-4 rounded-xl border font-bold text-xs gap-2 transition-all shadow-sm active:scale-95",
                          isExpanded
                            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100/50"
                            : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900"
                        )}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        {isExpanded ? "Đóng danh sách Tool" : `Xem Tools (${tools.length || "Động"})`}
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>

                      {/* Active switch */}
                      <Button
                        size="sm"
                        disabled={busyServerId === server.id}
                        onClick={() => handleToggleActive(server)}
                        className={cn(
                          "h-10 px-4 rounded-xl font-bold text-xs gap-2 transition-all border-0 shadow-sm active:scale-95",
                          server.is_active 
                            ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200/60 dark:hover:bg-emerald-950/85" 
                            : "bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950"
                        )}
                      >
                        {busyServerId === server.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        {server.is_active ? "Kích hoạt" : "Tạm dừng"}
                      </Button>

                      {/* Edit */}
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={busyServerId === server.id}
                        onClick={() => handleOpenEdit(server)}
                        className="h-10 w-10 rounded-xl border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0 shadow-sm active:scale-95 bg-white dark:bg-zinc-900"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={busyServerId === server.id}
                        onClick={() => handleDelete(server.id)}
                        className="h-10 w-10 rounded-xl border-zinc-200 dark:border-zinc-800 hover:bg-red-500/5 hover:border-red-500/20 hover:text-red-500 text-zinc-400 dark:text-zinc-500 shrink-0 shadow-sm active:scale-95 bg-white dark:bg-zinc-900"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded tools display */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="border-t border-zinc-100 dark:border-zinc-800 pt-6 mt-4 overflow-hidden"
                      >
                        {loadingToolsId === server.id ? (
                          <div className="flex items-center gap-3 py-6 justify-center bg-zinc-50/50 dark:bg-zinc-950/20 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                            <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">Đang quét danh sách công cụ từ Server...</span>
                          </div>
                        ) : tools.length === 0 ? (
                          <div className="text-center py-8 text-xs text-zinc-400 dark:text-zinc-500 italic border border-dashed rounded-2xl bg-zinc-50/30 dark:bg-zinc-950/10 border-zinc-200 dark:border-zinc-850">
                            Không tìm thấy công cụ nào phơi bày trên máy chủ MCP này hoặc server đang phản hồi lỗi.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                              <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Danh sách các Công cụ động ({tools.length})</h4>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {tools.map((tool, idx) => (
                                <div key={idx} className="bg-zinc-50/80 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-850 p-4 rounded-2xl text-xs space-y-3 flex flex-col justify-between hover:border-emerald-500/20 dark:hover:border-emerald-500/15 hover:bg-white dark:hover:bg-zinc-950/80 transition-all shadow-sm">
                                  <div className="space-y-1.5">
                                    <div className="font-extrabold text-zinc-800 dark:text-zinc-200 select-all font-mono tracking-tight flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                      {tool.name}
                                    </div>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed pr-2 font-medium">
                                      {tool.description || "Không có mô tả công cụ."}
                                    </p>
                                  </div>
                                  
                                  {tool.inputSchema && tool.inputSchema.properties && (
                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-3 rounded-xl font-mono text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal">
                                      <div className="font-black text-zinc-400 dark:text-zinc-500 mb-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-1 uppercase text-[8px] tracking-wider">Params Schema:</div>
                                      <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                        {Object.entries(tool.inputSchema.properties).map(([pName, pProp]: [string, any]) => {
                                          const isReq = tool.inputSchema?.required?.includes(pName);
                                          return (
                                            <div key={pName} className="flex justify-between items-start gap-2 border-b border-zinc-50 dark:border-zinc-800/30 last:border-0 py-0.5">
                                              <span>
                                                <span className="font-extrabold text-zinc-700 dark:text-zinc-300">{pName}</span>
                                                {isReq && <span className="text-red-500 font-bold ml-0.5">*</span>}
                                              </span>
                                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400/80 uppercase">({pProp.type || "string"})</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog for Add/Edit */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg rounded-[24px] border border-zinc-200 dark:border-zinc-850 p-0 overflow-hidden bg-white dark:bg-zinc-900 shadow-2xl backdrop-blur-xl">
          <DialogHeader className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/50 flex flex-row items-center gap-3 bg-zinc-50/50 dark:bg-zinc-950/20">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-inner">
              <Network className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                {editServer ? "Chỉnh sửa MCP Server" : "Thêm MCP Server"}
              </DialogTitle>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-semibold">Đăng ký và cấu hình máy chủ công cụ ngoài</p>
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="p-6 pt-5 space-y-5">
            {/* Server Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Tên máy chủ MCP</label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Ví dụ: Product Data SQL Server" 
                className="h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:bg-white dark:focus:bg-zinc-950 transition-all outline-none text-sm w-full"
                required
              />
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">URL Endpoint (SSE / HTTP)</label>
              <Input 
                value={url} 
                onChange={(e) => setUrl(e.target.value)} 
                placeholder="http://localhost:8000/sse hoặc https://mcp.company.com/rpc" 
                className="h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:bg-white dark:focus:bg-zinc-950 transition-all outline-none text-xs font-mono w-full"
                required
              />
            </div>

            {/* Auth Type */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Phương thức Xác thực</label>
              <Select value={authType} onValueChange={(val) => setAuthType(val || "none")}>
                <SelectTrigger className="h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-800 dark:text-zinc-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-none text-sm px-4 flex items-center justify-between">
                  <SelectValue placeholder="Chọn phương thức..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
                  <SelectItem value="none" className="text-sm py-2 px-3 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">Không xác thực (None)</SelectItem>
                  <SelectItem value="api_key" className="text-sm py-2 px-3 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">API Key (Header / Query Parameter)</SelectItem>
                  <SelectItem value="bearer_token" className="text-sm py-2 px-3 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">Bearer Token (Authorization Header)</SelectItem>
                  <SelectItem value="custom" className="text-sm py-2 px-3 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">Tùy biến JSON Headers (Custom)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic Auth fields */}
            {authType === "bearer_token" && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Token bảo mật</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                  <Input 
                    type="password"
                    value={authKey} 
                    onChange={(e) => setAuthKey(e.target.value)} 
                    placeholder="eyJhbGciOiJIUzI1NiIsIn..." 
                    className="h-11 pl-10 pr-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:bg-white dark:focus:bg-zinc-950 transition-all outline-none text-sm w-full"
                  />
                </div>
              </div>
            )}

            {authType === "api_key" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Tên Header</label>
                  <Input 
                    value={authHeader} 
                    onChange={(e) => setAuthHeader(e.target.value)} 
                    placeholder="X-API-Key" 
                    className="h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:bg-white dark:focus:bg-zinc-950 transition-all outline-none text-xs font-mono w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">API Key Value</label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                    <Input 
                      type="password"
                      value={authKey} 
                      onChange={(e) => setAuthKey(e.target.value)} 
                      placeholder="mcp_key_..." 
                      className="h-11 pl-10 pr-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:bg-white dark:focus:bg-zinc-950 transition-all outline-none text-sm w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {authType === "custom" && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Headers JSON</label>
                <textarea 
                  value={customHeadersJson} 
                  onChange={(e) => setCustomHeadersJson(e.target.value)} 
                  rows={4}
                  className="w-full p-3 font-mono text-xs rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all focus:bg-white dark:focus:bg-zinc-950"
                  placeholder='{&#10;  "X-Custom-Client": "WAO-Agent-Platform",&#10;  "Authorization": "Basic bXl1c2VyOm15cGFzc3dvcmQ="&#10;}'
                />
              </div>
            )}

            {/* Test connection results */}
            {testResult !== null && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                {testResult ? (
                  <div className="flex items-center gap-3 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/30 p-4 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 animate-bounce" />
                    <span>Kết nối kiểm tra thành công! MCP Server đã phản hồi hợp lệ.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 dark:border-red-500/30 p-4 rounded-xl text-xs font-semibold text-red-500 dark:text-red-400">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 animate-pulse" />
                    <span>Kết nối kiểm tra thất bại. Vui lòng kiểm tra lại URL hoặc thông tin xác thực.</span>
                  </div>
                )}
              </div>
            )}

            {/* Footer buttons */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-6">
              <Button 
                type="button"
                variant="outline"
                disabled={isTesting}
                onClick={handleTestConnection}
                className="h-11 px-5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-xs gap-2 transition-all shadow-sm active:scale-95 bg-white dark:bg-zinc-900"
              >
                {isTesting ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />}
                Kiểm tra kết nối
              </Button>

              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  disabled={isSaving}
                  onClick={() => setShowAddDialog(false)}
                  className="h-11 px-5 rounded-xl text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
                >
                  Hủy
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSaving || isTesting}
                  className="rounded-xl h-11 gap-2 bg-gradient-to-r from-emerald-650 to-teal-650 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-6 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.02] transition-all active:scale-95 border-0"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <ArrowRight className="w-4 h-4" />}
                  {editServer ? "Lưu thay đổi" : "Lưu máy chủ"}
                </Button>
              </div>
            </div>

          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
