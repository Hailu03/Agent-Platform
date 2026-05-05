"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Database, 
  Table as TableIcon, 
  Columns, 
  RefreshCcw, 
  ArrowLeft, 
  ChevronRight,
  Info,
  Save,
  Loader2,
  CheckCircle2,
  Link as LinkIcon,
  Search,
  LayoutGrid,
  List,
  Key
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchWithAuth } from "@/lib/api";
import { useNotifications } from "@/hooks/use-notifications";

interface Column {
  id: string;
  name: string;
  data_type: string;
  description: string;
  is_primary_key: boolean;
  is_nullable: boolean;
}

interface Table {
  id: string;
  name: string;
  description: string;
  columns: Column[];
}

interface Relationship {
  id: string;
  from_table_id: string;
  from_column: string;
  to_table_id: string;
  to_column: string;
  relation_type: string;
  description: string;
}

export default function SemanticLayerPage() {
  const params = useParams();
  const router = useRouter();
  const dsId = params.id as string;
  const { addNotification } = useNotifications();

  const [schema, setSchema] = useState<{ tables: Table[], relationships: Relationship[] }>({ tables: [], relationships: [] });
  const [loading, setLoading] = useState(true);
  const [introspecting, setIntrospecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTable, setActiveTable] = useState<Table | null>(null);

  const fetchSchema = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/semantic/${dsId}`);
      if (res.ok) {
        const data = await res.json();
        setSchema(data);
        if (data.tables.length > 0 && !activeTable) {
          setActiveTable(data.tables[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching schema:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchema();
  }, [dsId]);

  const handleIntrospect = async () => {
    setIntrospecting(true);
    try {
      const res = await fetchWithAuth(`/connections/${dsId}/introspect`, { 
        method: "POST"
      });
      if (res.ok) {
        addNotification("success", "Thành công", "Đã gửi yêu cầu đồng bộ. Vui lòng đợi trong giây lát và F5/Refresh lại trang.");
        // We can still call fetchSchema but it might not show new data instantly
        fetchSchema();
      }
    } catch (error) {
      addNotification("error", "Lỗi", "Không thể phân tích database.");
    } finally {
      setIntrospecting(false);
    }
  };

  const updateTableDescription = async (tableId: string, desc: string) => {
    try {
      await fetchWithAuth(`/semantic/tables/${tableId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc })
      });
    } catch (error) {
      console.error("Error updating table desc:", error);
    }
  };

  const updateColumnDescription = async (columnId: string, desc: string) => {
    try {
      await fetchWithAuth(`/semantic/columns/${columnId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc })
      });
    } catch (error) {
      console.error("Error updating column desc:", error);
    }
  };

  const filteredTables = schema.tables.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Breadcrumbs & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full" 
            onClick={() => router.push("/connectors")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Tầng Ngữ Nghĩa (Semantic Layer)</h1>
              <Badge variant="outline" className="rounded-full px-3 py-0.5 text-[10px] uppercase font-bold bg-primary/5">Beta</Badge>
            </div>
            <p className="text-muted-foreground text-xs font-medium opacity-70">Định nghĩa mô tả dữ liệu để AI hiểu và truy vấn chính xác hơn.</p>
          </div>
        </div>

        <Button 
          onClick={handleIntrospect}
          disabled={introspecting}
          className="rounded-[0.5rem] font-bold gap-2 shadow-lg shadow-primary/20"
        >
          {introspecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Làm mới (Refresh)
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar: Table List */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-50" />
            <Input 
              placeholder="Tìm bảng..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-[0.5rem] h-10 border-muted-foreground/20 font-medium text-sm"
            />
          </div>

          <div className="space-y-1 max-h-[calc(100vh-450px)] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-10 rounded-[0.4rem] bg-muted/20 animate-pulse" />
              ))
            ) : filteredTables.length > 0 ? (
              filteredTables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => setActiveTable(table)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[0.4rem] transition-all text-sm font-bold ${
                    activeTable?.id === table.id 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <TableIcon className={`w-4 h-4 ${activeTable?.id === table.id ? "opacity-100" : "opacity-40"}`} />
                    <span className="truncate">{table.name}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeTable?.id === table.id ? "translate-x-1" : "opacity-0"}`} />
                </button>
              ))
            ) : (
              <p className="text-center py-10 text-xs font-bold text-muted-foreground opacity-50 italic">Không có bảng nào</p>
            )}
          </div>
        </div>

        {/* Main: Table Details & Columns */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          {activeTable ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              {/* Table Info Card */}
              <Card className="rounded-[0.8rem] border-none shadow-xl bg-gradient-to-br from-white to-slate-50 dark:from-white/5 dark:to-white/[0.02] overflow-hidden">
                <CardContent className="p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Database className="w-7 h-7 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black tracking-tight">{activeTable.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="rounded-full px-2 py-0 text-[9px] uppercase font-bold tracking-widest">{activeTable.columns.length} Cột</Badge>
                          <span className="text-[10px] text-muted-foreground font-bold opacity-50 tracking-tighter uppercase">ID: {activeTable.id}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/60">Mô tả bảng (quan trọng cho Agent)</label>
                    <textarea 
                      className="w-full bg-white/50 dark:bg-black/20 border border-muted-foreground/10 rounded-[0.6rem] p-4 text-sm font-medium focus:ring-2 focus:ring-primary outline-none min-h-[100px] transition-all hover:border-primary/30"
                      placeholder="Giải thích bảng này dùng để làm gì, chứa dữ liệu về đối tượng nào..."
                      defaultValue={activeTable.description}
                      onBlur={(e) => updateTableDescription(activeTable.id, e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Columns List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Columns className="w-4 h-4 text-primary" />
                    Cấu trúc Cột
                  </h3>
                </div>

                <div className="grid gap-3">
                  {activeTable.columns.map((col) => (
                    <div 
                      key={col.id} 
                      className="group flex flex-col md:flex-row items-start md:items-center gap-4 p-4 rounded-[0.8rem] bg-white dark:bg-white/5 border shadow-sm hover:border-primary/30 transition-all"
                    >
                      <div className="flex-shrink-0 w-full md:w-48">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold tracking-tight text-foreground/90 truncate">{col.name}</span>
                          {col.is_primary_key && <Key className="w-3 h-3 text-yellow-500" />}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="rounded-full px-2 py-0 text-[9px] font-bold bg-muted/30">{col.data_type}</Badge>
                          {!col.is_nullable && <Badge variant="outline" className="rounded-full px-2 py-0 text-[9px] font-bold text-orange-500 border-orange-500/20">NOT NULL</Badge>}
                        </div>
                      </div>

                      <div className="flex-1 w-full relative group/input">
                        <Input 
                          placeholder="Mô tả cột này (Ví dụ: 'Mã định danh duy nhất của khách hàng')"
                          className="w-full h-10 rounded-[0.5rem] bg-muted/10 border-transparent group-hover/input:border-muted-foreground/20 focus:border-primary/50 text-sm font-medium pr-10"
                          defaultValue={col.description}
                          onBlur={(e) => updateColumnDescription(col.id, e.target.value)}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/input:opacity-100 transition-opacity">
                          <Info className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Relationships Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-blue-500" />
                    Mối quan hệ (Foreign Keys)
                  </h3>
                </div>

                <div className="grid gap-3">
                  {schema.relationships
                    .filter(rel => rel.from_table_id === activeTable.id || rel.to_table_id === activeTable.id)
                    .map((rel) => {
                      const isFrom = rel.from_table_id === activeTable.id;
                      const otherTableId = isFrom ? rel.to_table_id : rel.from_table_id;
                      const otherTable = schema.tables.find(t => t.id === otherTableId);
                      
                      return (
                        <div key={rel.id} className="flex items-center gap-4 p-4 rounded-[0.8rem] bg-blue-500/5 border border-blue-500/10 shadow-sm transition-all hover:bg-blue-500/10">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase opacity-50">{isFrom ? "Từ cột" : "Tới cột"}</span>
                              <span className="text-sm font-bold text-blue-600">{isFrom ? rel.from_column : rel.to_column}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-30 mt-3" />
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase opacity-50">{isFrom ? "Tới bảng" : "Từ bảng"}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-foreground">{otherTable?.name || "Unknown"}</span>
                                <Badge variant="outline" className="text-[9px] py-0">{isFrom ? rel.to_column : rel.from_column}</Badge>
                              </div>
                            </div>
                          </div>
                          <Badge className="bg-blue-500/10 text-blue-600 border-none text-[9px] uppercase font-bold tracking-widest px-3">
                            {rel.relation_type}
                          </Badge>
                        </div>
                      );
                    })}
                  
                  {schema.relationships.filter(rel => rel.from_table_id === activeTable.id || rel.to_table_id === activeTable.id).length === 0 && (
                    <div className="p-10 text-center rounded-[0.8rem] border border-dashed bg-muted/5">
                      <p className="text-xs font-bold text-muted-foreground opacity-40 italic">Không tìm thấy mối quan hệ nào cho bảng này.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[500px] flex flex-col items-center justify-center bg-muted/5 rounded-[1rem] border border-dashed border-muted-foreground/20">
               <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                  <Database className="w-8 h-8 text-muted-foreground opacity-30" />
               </div>
               <p className="font-bold text-muted-foreground italic">Chọn một bảng để cấu hình Semantic</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
