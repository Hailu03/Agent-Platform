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
  Globe,
  Loader2,
  Plus,
  Server,
  Key,
  DatabaseZap,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { useAgents } from "@/hooks/use-agents";
import Link from "next/link";

interface DataSource {
  id: string;
  name: string;
  engine: string;
  host: string;
  port: number;
  database: string;
  status: string;
  created_at: string;
}

export default function ConnectorsPage() {
  const [items, setItems] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addNotification } = useNotifications();
  const { agents, refreshAgents } = useAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [indexingTask, setIndexingTask] = useState<{ id: string; status: string } | null>(null);

  const startPollingIndexing = (taskId: string) => {
    setIndexingTask({ id: taskId, status: "processing" });
    const interval = setInterval(async () => {
      try {
        const res = await fetchWithAuth(`/agents/tasks/${taskId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "SUCCESS") {
            clearInterval(interval);
            setIndexingTask({ id: taskId, status: "completed" });
            addNotification("success", "Hoàn tất", "Đã lập chỉ mục nguồn dữ liệu thành công.");
            fetchConnections();
            // Tự động đóng modal sau 1.5s để user thấy status completed
            setTimeout(() => {
              setIsAddOpen(false);
              setIndexingTask(null);
            }, 1500);
          } else if (data.status === "FAILURE") {
            clearInterval(interval);
            setIndexingTask({ id: taskId, status: "error" });
            addNotification("error", "Lỗi Indexing", "Không thể trích xuất kiến thức từ nguồn dữ liệu.");
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
        clearInterval(interval);
      }
    }, 2000);
  };

  const handleInheritFromAgent = (agentId: string | null) => {
    if (!agentId) return;
    setSelectedAgentId(agentId);
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setFormData(prev => ({
        ...prev,
        name: `Kết nối cho ${agent.name}`
      }));
    }
  };

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    engine: string;
    host: string;
    port: number;
    database: string;
    username: string;
    plain_password: string;
    schema_name: string;
    ssl: boolean;
  }>({
    name: "",
    engine: "postgres",
    host: "localhost",
    port: 5432,
    database: "",
    username: "",
    plain_password: "",
    schema_name: "public",
    ssl: false
  });

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/connections");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error("Error fetching connections:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetchWithAuth("/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        addNotification("success", "Kết nối thành công!", `Độ trễ: ${data.latency_ms}ms`);
      } else {
        addNotification("error", "Kết nối thất bại", data.error);
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Không thể kết nối tới server thử nghiệm.");
    } finally {
      setTesting(false);
    }
  };

  const handleTestExisting = async (id: string) => {
    setTesting(true);
    try {
      const res = await fetchWithAuth(`/connections/${id}/test`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success) {
        addNotification("success", "Kết nối thành công!", `Độ trễ: ${data.latency_ms}ms`);
        fetchConnections(); // Refresh status
      } else {
        addNotification("error", "Kết nối thất bại", data.error);
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Không thể thực hiện kiểm tra kết nối.");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth("/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const data = await res.json();
        addNotification("success", "Thành công", "Đã khởi tạo nguồn dữ liệu. Đang lập chỉ mục...");
        if (data.task_id) {
          startPollingIndexing(data.task_id);
        } else {
          setIsAddOpen(false);
          fetchConnections();
        }
      } else {
        const err = await res.json();
        addNotification("error", "Lỗi", err.detail || "Không thể lưu kết nối.");
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Lỗi mạng hoặc server.");
    } finally {
      setSaving(false);
    }
  };

  const getAgentsUsingConnector = (connectorId: string) => {
    return agents.filter(agent => {
      return (agent.tools || []).some((tool: any) => {
        const config = typeof tool === "string" ? null : tool.config;
        return config?.datasource_id === connectorId;
      });
    });
  };

  const handleRemoveFromAgent = async (connectorId: string, agentId: string) => {
    if (!window.confirm("Bạn có chắc muốn gỡ kết nối này khỏi Agent?")) return;
    try {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      const updatedTools = (agent.tools || []).map((tool: any) => {
        if (typeof tool !== "string" && tool.config?.datasource_id === connectorId) {
          const { datasource_id, ...restConfig } = tool.config;
          return { ...tool, config: restConfig };
        }
        return tool;
      });

      const res = await fetchWithAuth(`/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools: updatedTools })
      });

      if (res.ok) {
        addNotification("success", "Thành công", "Đã gỡ kết nối khỏi Agent.");
        refreshAgents();
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Không thể gỡ kết nối.");
    }
  };

  const filteredItems = items.filter(item => {
    const agentsUsing = getAgentsUsingConnector(item.id);
    if (agentsUsing.length === 0) return false;

    return (
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.engine.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kết nối (Connectors)</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium opacity-80">Kết nối AI Agent với các hệ thống dữ liệu và ứng dụng bên ngoài.</p>
        </div>
        <Button
          onClick={() => setIsAddOpen(true)}
          className="rounded-[0.5rem] h-10 gap-2 shadow-lg shadow-primary/20 font-bold px-6"
        >
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
                    {item.engine === "postgres" ? <Database className="w-6 h-6 text-blue-600" /> :
                      item.engine === "mysql" ? <Server className="w-6 h-6 text-orange-600" /> :
                        item.engine === "powerbi" ? <Cloud className="w-6 h-6 text-yellow-600" /> :
                          <DatabaseZap className="w-6 h-6 text-blue-600" />}
                  </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-[0.4rem] hover:bg-white hover:border shadow-sm">
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64 rounded-[0.5rem] border-muted-foreground/20 shadow-xl p-1.5">
                        <DropdownMenuItem 
                          className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer"
                          onClick={() => handleTestExisting(item.id)}
                          disabled={testing}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-green-600" /> Kiểm tra kết nối
                        </DropdownMenuItem>
                        <Link href={`/connectors/${item.id}/semantic`}>
                          <DropdownMenuItem className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer">
                            <Settings className="w-3.5 h-3.5 mr-2" /> Quản lý Semantic
                          </DropdownMenuItem>
                        </Link>
                        {getAgentsUsingConnector(item.id).map(agent => (
                          <DropdownMenuItem
                            key={agent.id}
                            onClick={() => handleRemoveFromAgent(item.id, agent.id)}
                            className="rounded-md text-[11px] font-bold py-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Gỡ khỏi {agent.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
  
                  <h3 className="font-bold text-lg text-foreground/90">{item.name}</h3>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-1">{item.engine} • {item.host}</p>
  
                  <div className="mt-4 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${item.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${item.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                      {item.status === 'connected' ? 'Đang hoạt động' : 'Mất kết nối'}
                    </span>
                  </div>
                </CardContent>
                <div className="px-6 py-4 bg-muted/20 border-t mt-auto">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {getAgentsUsingConnector(item.id).map(agent => (
                      <Badge key={agent.id} variant="secondary" className="bg-primary/10 text-primary border-none text-[9px] py-0.5 px-2 rounded-lg flex items-center gap-1">
                        <Bot className="w-3 h-3" />
                        {agent.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between opacity-40">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">ID: {item.id.slice(0, 8)}...</span>
                    <DatabaseZap className="w-3.5 h-3.5 text-muted-foreground" />
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

      {/* Add Connection Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[1rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Plus className="w-6 h-6 text-primary" />
              Thêm kết nối mới
            </DialogTitle>
            <DialogDescription className="font-medium">
              Cung cấp thông tin đăng nhập để AI có thể truy cập dữ liệu của bạn.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Kế thừa từ Agent */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Bot className="w-3 h-3" /> Chọn Agent
              </label>
              <Select value={selectedAgentId || ""} onValueChange={handleInheritFromAgent}>
                <SelectTrigger className="rounded-[0.5rem] font-medium bg-primary/5 border-primary/20 w-full overflow-hidden">
                  <span className="truncate text-left">
                    {selectedAgentId ? (agents.find(a => a.id === selectedAgentId)?.name || "Đang tải...") : "Chọn một Agent để kích hoạt..."}
                  </span>
                </SelectTrigger>
                <SelectContent className="rounded-[0.5rem]">
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id} className="font-medium cursor-pointer">
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Tên & Engine */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tên kết nối</label>
                <Input
                  placeholder="VD: PostgreSQL Production"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Engine</label>
                <select
                  className="w-full h-10 px-3 py-2 rounded-[0.5rem] border bg-background text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                  value={formData.engine}
                  onChange={(e) => setFormData({ ...formData, engine: e.target.value })}
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="snowflake">Snowflake</option>
                  <option value="bigquery">Google BigQuery</option>
                  <option value="powerbi">Power BI Dataset</option>
                </select>
              </div>
            </div>

            {/* Host & Port */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Host / Endpoint</label>
                <Input
                  placeholder="localhost or IP"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Port</label>
                <Input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
            </div>

            {/* Database & Schema */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Database Name</label>
                <Input
                  placeholder="my_database"
                  value={formData.database}
                  onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Schema (Optional)</label>
                <Input
                  placeholder="public"
                  value={formData.schema_name}
                  onChange={(e) => setFormData({ ...formData, schema_name: e.target.value })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
            </div>

            {/* User & Password */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Username</label>
                <Input
                  placeholder="admin"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={formData.plain_password}
                  onChange={(e) => setFormData({ ...formData, plain_password: e.target.value })}
                  className="rounded-[0.5rem] font-medium"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 flex flex-col gap-4">
            {indexingTask ? (
              <div className="w-full p-4 rounded-xl bg-muted/30 border border-primary/20 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {indexingTask.status === "processing" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : indexingTask.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/80">
                      {indexingTask.status === "processing" ? "Đang trích xuất schema..." : 
                       indexingTask.status === "completed" ? "Đã lập chỉ mục xong!" : "Lỗi lập chỉ mục"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{indexingTask.id.slice(0, 8)}</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className={cn(
                    "h-full transition-all duration-500",
                    indexingTask.status === "processing" ? "w-2/3 bg-primary animate-pulse" :
                    indexingTask.status === "completed" ? "w-full bg-emerald-500" : "w-full bg-destructive"
                  )} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 leading-tight">
                  {indexingTask.status === "processing" ? "Vui lòng đợi trong giây lát, chúng tôi đang lưu cấu trúc bảng vào Vector DB." : 
                   indexingTask.status === "completed" ? "Nguồn dữ liệu đã sẵn sàng để Agent sử dụng." : "Đã có lỗi xảy ra trong quá trình xử lý."}
                </p>
              </div>
            ) : (
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  className="flex-1 rounded-[0.5rem] font-bold gap-2"
                  onClick={handleTest}
                  disabled={testing || saving}
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Test Connection
                </Button>
                <Button
                  className="flex-1 rounded-[0.5rem] font-bold gap-2 shadow-lg shadow-primary/20"
                  onClick={handleSave}
                  disabled={saving || testing}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Save Connector
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
