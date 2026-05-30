"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  GitBranch, 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Settings2, 
  Zap, 
  Bot, 
  Code, 
  Database, 
  HelpCircle, 
  ChevronRight, 
  CheckCircle2, 
  X,
  Sliders,
  Sparkles,
  MousePointer,
  Link,
  Move
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/use-notifications";
import { fetchWithAuth } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

interface NodeItem {
  id: string;
  type: string; // start, llm, code, tool, knowledge, answer, condition
  x: number;
  y: number;
  data: Record<string, any>;
}

interface EdgeItem {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface WorkflowData {
  id: string;
  name: string;
  description: string;
  graph: {
    nodes: NodeItem[];
    edges: EdgeItem[];
  };
}

export default function WorkflowDesignerPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;
  
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addNotification } = useNotifications();
  
  // Dragging and canvas references
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"config" | "connection">("config");

  // Clicking handles state for interactive connections
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);

  // Autocomplete variables state
  const [autocomplete, setAutocomplete] = useState<{
    show: boolean;
    type: "nodes" | "attributes";
    query: string;
    nodeId?: string;
    startIndex: number;
    activeInputName: string;
    fieldSetter: (val: string) => void;
    currentValue: string;
  }>({
    show: false,
    type: "nodes",
    query: "",
    startIndex: -1,
    activeInputName: "",
    fieldSetter: () => {},
    currentValue: ""
  });

  const evaluateAutocomplete = (
    val: string, 
    caretPos: number, 
    fieldName: string, 
    setter: (v: string) => void
  ) => {
    if (!workflow) return;

    const textBeforeCursor = val.substring(0, caretPos);
    const openIndex = textBeforeCursor.lastIndexOf("{{");
    const closeIndex = textBeforeCursor.lastIndexOf("}}");

    if (openIndex > -1 && openIndex > closeIndex) {
      const query = textBeforeCursor.substring(openIndex + 2);
      
      if (query.includes(".")) {
        const parts = query.split(".");
        const nodePart = parts[0];
        const attrPart = parts[1] || "";
        
        const nodeExists = workflow.graph.nodes.some(n => n.id === nodePart);
        if (nodeExists) {
          setAutocomplete({
            show: true,
            type: "attributes",
            query: attrPart,
            nodeId: nodePart,
            startIndex: openIndex,
            activeInputName: fieldName,
            fieldSetter: setter,
            currentValue: val
          });
          return;
        }
      }
      
      setAutocomplete({
        show: true,
        type: "nodes",
        query: query,
        startIndex: openIndex,
        activeInputName: fieldName,
        fieldSetter: setter,
        currentValue: val
      });
    } else {
      setAutocomplete(prev => ({ ...prev, show: false }));
    }
  };

  const handleSelectAutocomplete = (item: string) => {
    const activeEl = document.getElementById(`workflow-input-${autocomplete.activeInputName}`) as HTMLInputElement | HTMLTextAreaElement;
    if (!activeEl) return;

    const selectionStart = activeEl.selectionStart || 0;
    const value = activeEl.value;
    const textBeforeCursor = value.substring(0, selectionStart);
    const openIndex = textBeforeCursor.lastIndexOf("{{");
    if (openIndex === -1) return;

    let newValue = "";
    let newCursorPos = 0;

    if (autocomplete.type === "nodes") {
      const prefix = value.substring(0, openIndex + 2);
      const suffix = value.substring(selectionStart);
      newValue = prefix + item + "." + suffix;
      newCursorPos = openIndex + 2 + item.length + 1;
    } else {
      const prefix = value.substring(0, openIndex + 2) + autocomplete.nodeId + ".";
      const suffix = value.substring(selectionStart);
      newValue = prefix + item + "}}" + suffix;
      newCursorPos = prefix.length + item.length + 2;
    }

    autocomplete.fieldSetter(newValue);
    
    setTimeout(() => {
      activeEl.focus();
      activeEl.setSelectionRange(newCursorPos, newCursorPos);
      evaluateAutocomplete(newValue, newCursorPos, autocomplete.activeInputName, autocomplete.fieldSetter);
    }, 10);
  };

  const getUpstreamNodeIds = (targetNodeId: string): Set<string> => {
    const ancestors = new Set<string>();
    if (!workflow) return ancestors;

    const queue: string[] = [targetNodeId];
    const visited = new Set<string>([targetNodeId]);

    while (queue.length > 0) {
      const currId = queue.shift()!;
      const parentEdges = workflow.graph.edges.filter(edge => edge.target === currId);
      
      for (const edge of parentEdges) {
        if (!visited.has(edge.source)) {
          visited.add(edge.source);
          ancestors.add(edge.source);
          queue.push(edge.source);
        }
      }
    }

    return ancestors;
  };

  const renderInlineAutocomplete = (fieldName: string) => {
    if (!autocomplete.show || autocomplete.activeInputName !== fieldName || !workflow || !selectedNodeId) return null;

    const upstreamNodeIds = getUpstreamNodeIds(selectedNodeId);
    let items: Array<{ id: string; name: string; type?: string; label?: string }> = [];

    if (autocomplete.type === "nodes") {
      items = workflow.graph.nodes
        .filter(n => n.id !== selectedNodeId)
        .filter(n => upstreamNodeIds.has(n.id))
        .filter(n => n.id.toLowerCase().includes(autocomplete.query.toLowerCase()) || (n.data.title && n.data.title.toLowerCase().includes(autocomplete.query.toLowerCase())))
        .map(n => ({
          id: n.id,
          name: n.data.title || n.id,
          type: n.type.toUpperCase(),
          label: n.id
        }));
    } else {
      const targetNode = workflow.graph.nodes.find(n => n.id === autocomplete.nodeId);
      let attrs = [{ name: "result", label: "Kết quả xử lý" }];
      if (targetNode?.type === "start") attrs = [{ name: "user_query", label: "Câu hỏi ban đầu" }];
      else if (targetNode?.type === "llm") attrs = [{ name: "text", label: "AI trả lời" }];
      else if (targetNode?.type === "code") attrs = [{ name: "result", label: "Kết quả Code" }];
      else if (targetNode?.type === "tool") attrs = [{ name: "result", label: "Kết quả Tool" }];
      else if (targetNode?.type === "knowledge") attrs = [{ name: "result", label: "Tri thức RAG" }];

      items = attrs
        .filter(a => a.name.toLowerCase().includes(autocomplete.query.toLowerCase()))
        .map(a => ({
          id: a.name,
          name: a.name,
          label: a.label
        }));
    }

    return (
      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-950 border-2 border-purple-500/30 shadow-2xl rounded-xl p-2.5 z-50 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150 select-none">
        <div className="flex items-center justify-between border-b pb-1.5 mb-1.5 text-[8.5px] font-extrabold uppercase tracking-widest text-purple-600">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-500 animate-pulse" /> 
            {autocomplete.type === "nodes" ? "Gợi ý Node nguồn ({{node_id)" : `Chọn thuộc tính từ ${autocomplete.nodeId}`}
          </span>
          <button 
            type="button"
            onClick={() => setAutocomplete(prev => ({ ...prev, show: false }))}
            className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer w-4 h-4 flex items-center justify-center rounded hover:bg-secondary"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        
        <div className="space-y-0.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectAutocomplete(item.id)}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-600 hover:text-white text-xs font-semibold flex items-center justify-between transition-colors group cursor-pointer border border-transparent"
            >
              <div className="flex items-center gap-1.5 truncate">
                {item.type && (
                  <span className="font-mono text-[8px] font-bold text-purple-500 group-hover:text-purple-200 bg-purple-500/5 group-hover:bg-purple-500/20 px-1 py-0.2 rounded border border-purple-500/10 shrink-0">
                    {item.type}
                  </span>
                )}
                <span className="font-bold truncate text-foreground/90 group-hover:text-white">{item.name}</span>
              </div>
              <span className="font-mono text-[9px] text-muted-foreground group-hover:text-purple-200 shrink-0">{item.label}</span>
            </button>
          ))}
          {items.length === 0 && (
            <div className="text-center py-4 text-xs text-muted-foreground italic font-semibold">
              {autocomplete.type === "nodes" && upstreamNodeIds.size === 0 ? (
                <span className="not-italic font-bold text-amber-600 block p-2 bg-amber-500/5 rounded-lg border border-amber-500/10 leading-normal text-[10px]">
                  ⚠️ Không có node nguồn phía trước.<br />
                  <span className="font-normal text-muted-foreground text-[9px] block mt-1">Hãy kết nối dây từ node khác tới node này trên canvas để tham chiếu dữ liệu.</span>
                </span>
              ) : (
                `Không tìm thấy gợi ý khớp cho "${autocomplete.query}"`
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    fetchWorkflowDetails();
  }, [workflowId]);

  const fetchWorkflowDetails = async () => {
    try {
      const res = await fetchWithAuth(`/workflows/${workflowId}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.graph) {
          data.graph = { nodes: [], edges: [] };
        }
        
        // Ensure nodes have coordinates (fallback if missing)
        const nodesWithCoords = data.graph.nodes.map((node: any, idx: number) => ({
          ...node,
          x: node.x !== undefined ? node.x : 80 + idx * 300,
          y: node.y !== undefined ? node.y : 150 + (idx % 2) * 120
        }));
        
        data.graph.nodes = nodesWithCoords;
        setWorkflow(data);
      } else {
        addNotification("error", "Lỗi", "Không thể tải chi tiết quy trình.");
      }
    } catch (e) {
      console.error(e);
      addNotification("error", "Lỗi", "Có lỗi xảy ra khi tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkflow = async () => {
    if (!workflow) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graph: workflow.graph
        })
      });
      if (res.ok) {
        addNotification("success", "Thành công", "Đã lưu thiết kế quy trình thành công!");
      } else {
        addNotification("error", "Lỗi", "Không thể lưu thiết kế.");
      }
    } catch (e) {
      console.error(e);
      addNotification("error", "Lỗi", "Có lỗi xảy ra khi lưu.");
    } finally {
      setSaving(false);
    }
  };

  // Real-time drag updating
  const handleNodeDrag = (nodeId: string, event: any, info: any) => {
    if (!workflow) return;
    setWorkflow(prev => {
      if (!prev) return null;
      return {
        ...prev,
        graph: {
          ...prev.graph,
          nodes: prev.graph.nodes.map(n => {
            if (n.id === nodeId) {
              return {
                ...n,
                x: n.x + info.delta.x,
                y: n.y + info.delta.y
              };
            }
            return n;
          })
        }
      };
    });
  };

  const handleAddNode = (type: string) => {
    if (!workflow) return;
    const typeNames: Record<string, string> = {
      start: "Điểm bắt đầu",
      llm: "Trí tuệ nhân tạo (LLM)",
      code: "Xử lý Code (Python)",
      tool: "Gọi công cụ",
      knowledge: "Truy vấn tri thức",
      answer: "Xuất phản hồi"
    };

    const defaultData: Record<string, any> = {
      start: {},
      llm: { prompt: "Bạn là một AI assistant hữu ích. Hãy trả lời câu hỏi: {{node_start.user_query}}" },
      code: { code: "outputs['upper'] = inputs['query'].upper()", inputs: { query: "node_start.user_query" } },
      tool: { tool_name: "web_search", parameters: { query: "{{node_start.user_query}}" } },
      knowledge: { query: "{{node_start.user_query}}" },
      answer: { answer: "Kết quả là: {{node_llm.text}}" }
    };

    // Calculate center coordinates
    const scrollX = canvasRef.current?.scrollLeft || 0;
    const scrollY = canvasRef.current?.scrollTop || 0;

    const newNode: NodeItem = {
      id: `node_${type}_${Math.random().toString(36).substring(2, 6)}`,
      type: type,
      x: 150 + scrollX + Math.random() * 80,
      y: 150 + scrollY + Math.random() * 80,
      data: {
        title: `${typeNames[type] || "Node"} mới`,
        ...defaultData[type]
      }
    };

    setWorkflow({
      ...workflow,
      graph: {
        ...workflow.graph,
        nodes: [...workflow.graph.nodes, newNode]
      }
    });
    setSelectedNodeId(newNode.id);
    addNotification("success", "Đã thêm node", `Đã thêm node ${typeNames[type]} thành công.`);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!workflow) return;
    if (nodeId === "node_start") {
      addNotification("error", "Lỗi", "Không thể xóa Start Node.");
      return;
    }
    
    const updatedNodes = workflow.graph.nodes.filter(n => n.id !== nodeId);
    const updatedEdges = workflow.graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);

    setWorkflow({
      ...workflow,
      graph: {
        nodes: updatedNodes,
        edges: updatedEdges
      }
    });

    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    if (connectingSourceId === nodeId) {
      setConnectingSourceId(null);
    }
    addNotification("success", "Đã xóa", "Đã xóa Node khỏi sơ đồ.");
  };

  const handleUpdateNodeData = (nodeId: string, updatedFields: Record<string, any>) => {
    if (!workflow) return;
    setWorkflow(prev => {
      if (!prev) return null;
      return {
        ...prev,
        graph: {
          ...prev.graph,
          nodes: prev.graph.nodes.map(n => {
            if (n.id === nodeId) {
              return {
                ...n,
                data: { ...n.data, ...updatedFields }
              };
            }
            return n;
          })
        }
      };
    });
  };

  // Click-to-Connect Handles Logic
  const handleHandleClick = (nodeId: string, handleType: "input" | "output") => {
    if (!workflow) return;

    if (handleType === "output") {
      setConnectingSourceId(nodeId);
      addNotification("info", "Đang kết nối", `Bấm vào cổng TRÁI (Input) của node đích để tạo liên kết.`);
    } else {
      // It is an input handle
      if (!connectingSourceId) {
        addNotification("warning", "Nhắc nhở", "Vui lòng bấm vào cổng PHẢI (Output) của node nguồn trước.");
        return;
      }
      if (connectingSourceId === nodeId) {
        addNotification("error", "Lỗi", "Không thể nối một node với chính nó.");
        setConnectingSourceId(null);
        return;
      }

      // Check if edge already exists
      const exists = workflow.graph.edges.some(
        e => e.source === connectingSourceId && e.target === nodeId
      );
      if (exists) {
        addNotification("warning", "Liên kết tồn tại", "Đường truyền này đã được kết nối trước đó.");
        setConnectingSourceId(null);
        return;
      }

      const newEdge: EdgeItem = {
        source: connectingSourceId,
        target: nodeId
      };

      setWorkflow({
        ...workflow,
        graph: {
          ...workflow.graph,
          edges: [...workflow.graph.edges, newEdge]
        }
      });
      setConnectingSourceId(null);
      addNotification("success", "Đã kết nối", "Tạo liên kết dữ liệu thành công!");
    }
  };

  const handleDeleteEdge = (index: number) => {
    if (!workflow) return;
    const updatedEdges = workflow.graph.edges.filter((_, i) => i !== index);
    setWorkflow({
      ...workflow,
      graph: {
        ...workflow.graph,
        edges: updatedEdges
      }
    });
    addNotification("success", "Đã xóa", "Đã gỡ cạnh định tuyến dữ liệu.");
  };

  const selectedNode = workflow?.graph.nodes.find(n => n.id === selectedNodeId);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case "start": return <Zap className="w-4.5 h-4.5 text-amber-500 animate-pulse" />;
      case "llm": return <Bot className="w-4.5 h-4.5 text-purple-500" />;
      case "code": return <Code className="w-4.5 h-4.5 text-blue-500" />;
      case "tool": return <Sliders className="w-4.5 h-4.5 text-emerald-500" />;
      case "knowledge": return <Database className="w-4.5 h-4.5 text-rose-500" />;
      case "answer": return <CheckCircle2 className="w-4.5 h-4.5 text-sky-500" />;
      default: return <HelpCircle className="w-4.5 h-4.5 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
        <p className="text-sm font-bold text-muted-foreground animate-pulse">Khởi tạo canvas đồ thị tương tác...</p>
      </div>
    );
  }

  return (
    <div className="h-[85vh] flex flex-col -m-6 relative overflow-hidden bg-[#f4f5f6] dark:bg-[#080809] select-none">
      {/* Top Designer bar */}
      <div className="h-16 border-b bg-card px-6 flex items-center justify-between shadow-sm relative z-20 shrink-0">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push("/workflows")}
            className="rounded-xl border hover:bg-secondary shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-base font-extrabold flex items-center gap-2 text-foreground/90">
              <GitBranch className="w-5 h-5 text-purple-600" /> {workflow?.name}
            </h1>
            <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed truncate max-w-xs md:max-w-md">
              {workflow?.description || "Interactive dynamic LangGraph workflow editor."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {connectingSourceId && (
            <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/10 border-amber-500/20 rounded-full font-bold px-3 py-1 animate-pulse flex items-center gap-1.5 text-xs mr-2">
              <Link className="w-3.5 h-3.5" /> Đang nối dây từ: {connectingSourceId.substring(0, 12)}
              <X className="w-3 h-3 cursor-pointer ml-1 text-amber-600 hover:scale-110" onClick={() => setConnectingSourceId(null)} />
            </Badge>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSaveWorkflow}
            disabled={saving}
            className="rounded-xl h-9.5 gap-2 border-purple-500/20 font-bold hover:bg-purple-500/5 text-purple-600 shadow-sm"
          >
            <Save className="w-4 h-4" />
            Lưu sơ đồ
          </Button>
        </div>
      </div>

      {/* Editor Main body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left canvas palette bar */}
        <div className="w-64 border-r bg-card p-5 flex flex-col justify-between shadow-inner shrink-0 overflow-y-auto relative z-10">
          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-purple-500" /> Hộp Công Cụ (Nodes)
              </h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
                Bấm để thêm node. Drag để di chuyển node. Click cổng (handles) để nối dây.
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-2.5">
              <Button 
                variant="outline" 
                onClick={() => handleAddNode("llm")}
                className="h-10 justify-start rounded-xl gap-3 font-semibold text-xs border-muted-foreground/10 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center border shadow-sm">
                  <Bot className="w-4.5 h-4.5 text-purple-600" />
                </div>
                Khối LLM (AI Model)
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleAddNode("code")}
                className="h-10 justify-start rounded-xl gap-3 font-semibold text-xs border-muted-foreground/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center border shadow-sm">
                  <Code className="w-4.5 h-4.5 text-blue-600" />
                </div>
                Chạy Script Python
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleAddNode("tool")}
                className="h-10 justify-start rounded-xl gap-3 font-semibold text-xs border-muted-foreground/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center border shadow-sm">
                  <Sliders className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                Gọi Công cụ (Tools)
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleAddNode("knowledge")}
                className="h-10 justify-start rounded-xl gap-3 font-semibold text-xs border-muted-foreground/10 hover:border-rose-500/30 hover:bg-rose-500/5 transition-all text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center border shadow-sm">
                  <Database className="w-4.5 h-4.5 text-rose-600" />
                </div>
                Tìm RAG Knowledge
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleAddNode("answer")}
                className="h-10 justify-start rounded-xl gap-3 font-semibold text-xs border-muted-foreground/10 hover:border-sky-500/30 hover:bg-sky-500/5 transition-all text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center border shadow-sm">
                  <CheckCircle2 className="w-4.5 h-4.5 text-sky-600" />
                </div>
                Khối Xuất Đáp Án
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <Badge className="bg-purple-500/10 text-purple-600 hover:bg-purple-500/10 border-purple-500/25 rounded-md font-bold py-1 flex items-center gap-1 mb-2">
              <Zap className="w-3 h-3 text-purple-600" /> LangGraph Core
            </Badge>
            <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed">
              Các liên kết sẽ tự động vẽ bằng đường cong Bezier và có bong bóng luồng dữ liệu chuyển động.
            </p>
          </div>
        </div>

        {/* Center Grid Work Area Draggable Canvas */}
        <div 
          ref={canvasRef}
          className="flex-1 overflow-auto relative"
        >
          {/* Large Inner Canvas Scroll Area */}
          <div className="w-[3000px] h-[3000px] bg-[radial-gradient(#d1d5db_1.2px,transparent_1.2px)] dark:bg-[radial-gradient(#1e293b_1.2px,transparent_1.2px)] [background-size:20px_20px] relative">
          {/* Dynamic SVG connection curves overlay */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full z-0">
            {workflow?.graph.edges.map((edge, i) => {
              const sourceNode = workflow.graph.nodes.find(n => n.id === edge.source);
              const targetNode = workflow.graph.nodes.find(n => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;
              
              // Coordinates for cubic bezier path
              // Width of card is 240px (w-60), height of header is around 40px
              const x1 = sourceNode.x + 240; 
              const y1 = sourceNode.y + 22; 
              const x2 = targetNode.x;       
              const y2 = targetNode.y + 22;  
              
              const controlDist = Math.max(80, Math.abs(x2 - x1) / 2);
              const pathD = `M ${x1} ${y1} C ${x1 + controlDist} ${y1}, ${x2 - controlDist} ${y2}, ${x2} ${y2}`;
              
              return (
                <g key={i} className="group">
                  {/* Thick background line for click to delete */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="rgba(147, 51, 234, 0.05)"
                    strokeWidth="12"
                    className="hover:stroke-destructive/20 transition-colors cursor-pointer pointer-events-auto"
                    onClick={() => {
                      if (window.confirm("Bạn có chắc muốn xóa liên kết định tuyến này?")) {
                        handleDeleteEdge(i);
                      }
                    }}
                  />
                  {/* Foreground main curve */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="rgb(147, 51, 234)"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                    className="opacity-75"
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke="rgb(147, 51, 234)"
                    strokeWidth="1.5"
                    className="opacity-40"
                  />
                  {/* Glowing pulse bubble traveling along the bezier flowline */}
                  <circle r="4.5" fill="#a855f7" className="shadow-lg filter drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]">
                    <animateMotion dur="5s" repeatCount="indefinite" path={pathD} />
                  </circle>
                </g>
              );
            })}
          </svg>

          {/* Render Nodes as absolutely positioned draggable items */}
          {workflow?.graph.nodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            const isConnectingSource = node.id === connectingSourceId;
            
            return (
              <motion.div
                key={node.id}
                drag
                dragMomentum={false}
                dragElastic={0}
                onDrag={(event, info) => handleNodeDrag(node.id, event, info)}
                onTap={() => setSelectedNodeId(node.id)}
                style={{ x: node.x, y: node.y }}
                className={`absolute w-60 rounded-xl border bg-card/85 shadow-md hover:shadow-xl backdrop-blur-md cursor-pointer select-none transition-shadow z-10 ${
                  isSelected 
                    ? "border-purple-500 ring-4 ring-purple-500/10" 
                    : "border-muted-foreground/10 hover:border-purple-500/25"
                }`}
              >
                {/* Node Handles Circles */}
                {/* Input Handle (Left Circle) */}
                {node.type !== "start" && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHandleClick(node.id, "input");
                    }}
                    className="absolute top-4 left-0 -translate-x-1.5 w-3.5 h-3.5 rounded-full bg-slate-400 border-2 border-white dark:border-zinc-900 shadow-md hover:scale-125 transition-transform flex items-center justify-center cursor-crosshair z-20 group"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                {/* Output Handle (Right Circle) */}
                {node.type !== "answer" && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHandleClick(node.id, "output");
                    }}
                    className={`absolute top-4 right-0 translate-x-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-zinc-900 shadow-md hover:scale-125 transition-transform flex items-center justify-center cursor-crosshair z-20 group ${
                      isConnectingSource ? "bg-amber-500 animate-ping" : "bg-purple-600"
                    }`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}

                {/* Node Inner Cards */}
                <div className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2 drag-handle">
                      <div className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center border shadow-inner">
                        {getNodeIcon(node.type)}
                      </div>
                      <span className="text-[11px] font-extrabold text-foreground/80 truncate max-w-[110px]">{node.data.title || node.id}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNodeId(node.id);
                        }}
                        className={`w-6 h-6 rounded-lg shrink-0 ${
                          isSelected ? "text-purple-600 bg-purple-500/10" : "text-muted-foreground/45 hover:text-purple-600 hover:bg-purple-500/10"
                        }`}
                        title="Cấu hình node"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </Button>
                      {node.type !== "start" && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNode(node.id);
                          }}
                          className="w-6 h-6 rounded-lg text-muted-foreground/45 hover:text-destructive hover:bg-destructive/10 shrink-0"
                          title="Xóa node"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[9px] text-muted-foreground leading-relaxed font-semibold">
                    <div className="flex justify-between text-muted-foreground/60 font-mono">
                      <span>ID: {node.id.substring(0, 10)}</span>
                      <Move className="w-3 h-3 cursor-grab" />
                    </div>
                    {node.type === "llm" && (
                      <div className="truncate font-semibold bg-secondary/35 p-1 rounded border text-[8px] text-foreground/75">
                        Prompt: {node.data.prompt || "Rỗng"}
                      </div>
                    )}
                    {node.type === "code" && (
                      <div className="font-mono bg-secondary/35 p-1 rounded border text-[7.5px] text-blue-600 truncate">
                        {node.data.code?.substring(0, 20)}...
                      </div>
                    )}
                    {node.type === "tool" && (
                      <div className="font-bold text-emerald-600 flex items-center gap-0.5">
                        <Sliders className="w-2.5 h-2.5" /> {node.data.tool_name}
                      </div>
                    )}
                    {node.type === "knowledge" && (
                      <div className="font-bold text-rose-600 flex items-center gap-0.5">
                        <Database className="w-2.5 h-2.5" /> GraphRAG Search
                      </div>
                    )}
                    {node.type === "answer" && (
                      <div className="truncate bg-secondary/35 p-1 rounded border text-[8px] text-foreground/75">
                        {node.data.answer || "Rỗng"}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          </div>
        </div>

        {/* Right Configuration Sidebar Editor */}
        <AnimatePresence>
          {selectedNodeId && (
            <motion.div
              initial={{ x: 350, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 350, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-96 border-l bg-card shadow-2xl relative z-10 flex flex-col overflow-hidden shrink-0"
            >
              {/* Sidebar Header */}
              <div className="h-14 border-b px-5 flex items-center justify-between shrink-0 bg-muted/10">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-extrabold uppercase tracking-widest text-foreground/90">Cấu hình Node</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedNodeId(null)}
                  className="rounded-xl border w-8 h-8 hover:bg-secondary shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Sidebar Tabs */}
              <div className="h-10 border-b flex px-2 shrink-0 bg-muted/20">
                <Button 
                  variant="ghost"
                  onClick={() => setActiveTab("config")}
                  className={`h-full rounded-none border-b-2 px-4 text-xs font-bold ${
                    activeTab === "config" ? "border-purple-600 text-purple-600 bg-card" : "border-transparent text-muted-foreground"
                  }`}
                >
                  Thông số
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => setActiveTab("connection")}
                  className={`h-full rounded-none border-b-2 px-4 text-xs font-bold ${
                    activeTab === "connection" ? "border-purple-600 text-purple-600 bg-card" : "border-transparent text-muted-foreground"
                  }`}
                >
                  Liên kết (Edges)
                </Button>
              </div>

              {/* Sidebar content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {selectedNode && activeTab === "config" && (
                  <div className="space-y-5">
                    {/* Node title */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tên Node hiển thị</label>
                      <Input 
                        value={selectedNode.data.title || ""} 
                        onChange={(e) => handleUpdateNodeData(selectedNode.id, { title: e.target.value })}
                        className="rounded-xl h-10 font-bold"
                      />
                    </div>

                    {/* LLM Specific inputs */}
                    {selectedNode.type === "llm" && (
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Prompt Template
                        </label>
                        <div className="relative">
                          <textarea 
                            id="workflow-input-prompt"
                            rows={6}
                            value={selectedNode.data.prompt || ""} 
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdateNodeData(selectedNode.id, { prompt: val });
                              evaluateAutocomplete(val, e.target.selectionStart || 0, "prompt", (v) => handleUpdateNodeData(selectedNode.id, { prompt: v }));
                            }}
                            onKeyUp={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              evaluateAutocomplete(target.value, target.selectionStart || 0, "prompt", (v) => handleUpdateNodeData(selectedNode.id, { prompt: v }));
                            }}
                            onFocus={(e) => {
                              evaluateAutocomplete(e.target.value, e.target.selectionStart || 0, "prompt", (v) => handleUpdateNodeData(selectedNode.id, { prompt: v }));
                            }}
                            className="w-full rounded-xl border border-muted-foreground/20 p-3 text-xs bg-background font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500 leading-relaxed shadow-inner"
                            placeholder="Nhập prompt và sử dụng {{ để chèn biến nhanh"
                          />
                          {renderInlineAutocomplete("prompt")}
                        </div>
                        {!(autocomplete.show && autocomplete.activeInputName === "prompt") && (
                          <p className="text-[10px] text-muted-foreground leading-normal italic mt-1">
                            Mẹo: Gõ <code>{"{{"}</code> để hiển thị danh sách biến từ các node phía trước (ví dụ: <code>{"{{node_start.user_query}}"}</code>).
                          </p>
                        )}
                      </div>
                    )}

                    {/* Python Code Specific inputs */}
                    {selectedNode.type === "code" && (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">inputs (Ánh xạ tham số vào code)</label>
                          <div className="bg-secondary/40 p-3 rounded-xl border space-y-2 text-xs">
                            <div className="flex items-center justify-between font-bold text-[10px] text-muted-foreground border-b pb-1.5">
                              <span>Tên biến trong Code</span>
                              <span>Đường dẫn Variable Selector</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[11px] font-bold">query</span>
                              <span className="text-foreground font-semibold">node_start.user_query</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mã nguồn Python</label>
                          <textarea 
                            rows={8}
                            value={selectedNode.data.code || ""} 
                            onChange={(e) => handleUpdateNodeData(selectedNode.id, { code: e.target.value })}
                            className="w-full rounded-xl border border-muted-foreground/20 p-3 text-xs bg-[#121214] text-emerald-400 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500 leading-relaxed shadow-inner"
                          />
                          <p className="text-[9px] text-muted-foreground leading-normal">
                            Lưu ý: Mã nguồn của bạn chạy trong sandbox an toàn. Hãy gán kết quả vào dictionary <code>outputs</code> để các node phía sau có thể sử dụng (ví dụ: <code>outputs['result'] = '...'</code>).
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tool Specific inputs */}
                    {selectedNode.type === "tool" && (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Chọn Công cụ (Tool)</label>
                          <select 
                            value={selectedNode.data.tool_name || "web_search"}
                            onChange={(e) => handleUpdateNodeData(selectedNode.id, { tool_name: e.target.value })}
                            className="w-full h-10 rounded-xl border border-muted-foreground/20 bg-background px-3 text-xs font-bold"
                          >
                            <option value="web_search">Tìm kiếm Internet (Web Search)</option>
                            <option value="gmail_manager">Gửi và Đọc Email (Gmail)</option>
                            <option value="graph_rag_search">Tìm tri thức (GraphRAG)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tham số (Query)</label>
                          <div className="relative">
                            <Input 
                              id="workflow-input-tool_query"
                              value={selectedNode.data.parameters?.query || ""} 
                              onChange={(e) => {
                                const val = e.target.value;
                                handleUpdateNodeData(selectedNode.id, { 
                                  parameters: { ...selectedNode.data.parameters, query: val } 
                                });
                                evaluateAutocomplete(val, e.target.selectionStart || 0, "tool_query", (v) => handleUpdateNodeData(selectedNode.id, { 
                                  parameters: { ...selectedNode.data.parameters, query: v } 
                                }));
                              }}
                              onKeyUp={(e) => {
                                const target = e.target as HTMLInputElement;
                                evaluateAutocomplete(target.value, target.selectionStart || 0, "tool_query", (v) => handleUpdateNodeData(selectedNode.id, { 
                                  parameters: { ...selectedNode.data.parameters, query: v } 
                                }));
                              }}
                              onFocus={(e) => {
                                evaluateAutocomplete(e.target.value, e.target.selectionStart || 0, "tool_query", (v) => handleUpdateNodeData(selectedNode.id, { 
                                  parameters: { ...selectedNode.data.parameters, query: v } 
                                }));
                              }}
                              className="rounded-xl h-10 text-xs font-semibold"
                              placeholder="Nhập tham số và sử dụng {{ để chèn biến nhanh"
                            />
                            {renderInlineAutocomplete("tool_query")}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Knowledge/RAG specific inputs */}
                    {selectedNode.type === "knowledge" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Database className="w-3.5 h-3.5 text-rose-500" /> Tri thức Hybrid Search
                          </label>
                          <p className="text-[10px] text-muted-foreground leading-normal">
                            Truy vấn chuyên sâu vào tệp tri thức đã nạp của Agent bằng thuật toán tích hợp lai GraphRAG & Vector Search.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nội dung tìm kiếm (Query)</label>
                          <div className="relative">
                            <Input 
                              id="workflow-input-knowledge_query"
                              value={selectedNode.data.query || ""} 
                              onChange={(e) => {
                                const val = e.target.value;
                                handleUpdateNodeData(selectedNode.id, { query: val });
                                evaluateAutocomplete(val, e.target.selectionStart || 0, "knowledge_query", (v) => handleUpdateNodeData(selectedNode.id, { query: v }));
                              }}
                              onKeyUp={(e) => {
                                const target = e.target as HTMLInputElement;
                                evaluateAutocomplete(target.value, target.selectionStart || 0, "knowledge_query", (v) => handleUpdateNodeData(selectedNode.id, { query: v }));
                              }}
                              onFocus={(e) => {
                                evaluateAutocomplete(e.target.value, e.target.selectionStart || 0, "knowledge_query", (v) => handleUpdateNodeData(selectedNode.id, { query: v }));
                              }}
                              className="rounded-xl h-10 text-xs font-semibold"
                              placeholder="Nhập từ khóa và sử dụng {{ để chèn biến nhanh"
                            />
                            {renderInlineAutocomplete("knowledge_query")}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Answer specific inputs */}
                    {selectedNode.type === "answer" && (
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Định dạng Đáp án Cuối cùng
                        </label>
                        <div className="relative">
                          <textarea 
                            id="workflow-input-answer"
                            rows={6}
                            value={selectedNode.data.answer || ""} 
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdateNodeData(selectedNode.id, { answer: val });
                              evaluateAutocomplete(val, e.target.selectionStart || 0, "answer", (v) => handleUpdateNodeData(selectedNode.id, { answer: v }));
                            }}
                            onKeyUp={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              evaluateAutocomplete(target.value, target.selectionStart || 0, "answer", (v) => handleUpdateNodeData(selectedNode.id, { answer: v }));
                            }}
                            onFocus={(e) => {
                              evaluateAutocomplete(e.target.value, e.target.selectionStart || 0, "answer", (v) => handleUpdateNodeData(selectedNode.id, { answer: v }));
                            }}
                            className="w-full rounded-xl border border-muted-foreground/20 p-3 text-xs bg-background font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500 leading-relaxed shadow-inner"
                            placeholder="Nhập định dạng đáp án và sử dụng {{ để chèn biến nhanh"
                          />
                          {renderInlineAutocomplete("answer")}
                        </div>
                        {!(autocomplete.show && autocomplete.activeInputName === "answer") && (
                          <p className="text-[10px] text-muted-foreground leading-normal mt-1">
                            Lưu ý: Kết quả định dạng ở đây sẽ trực tiếp trở thành phản hồi chính hiển thị trên giao diện chat.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Connection manager tab */}
                {selectedNode && activeTab === "connection" && (
                  <div className="space-y-6">
                    {/* Exisiting Edges list */}
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between border-b pb-2 mb-2">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Liên kết hiện tại</h4>
                        <Badge className="bg-purple-500/10 text-purple-600">{workflow?.graph.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length} Active</Badge>
                      </div>
                      
                      <div className="space-y-2">
                        {workflow?.graph.edges.map((edge, i) => {
                          const isRelated = edge.source === selectedNode.id || edge.target === selectedNode.id;
                          if (!isRelated) return null;

                          const srcName = workflow.graph.nodes.find(n => n.id === edge.source)?.data.title || edge.source;
                          const tgtName = workflow.graph.nodes.find(n => n.id === edge.target)?.data.title || edge.target;
                          return (
                            <div key={i} className="flex items-center justify-between bg-card p-3 rounded-xl border border-muted-foreground/5 shadow-sm text-xs font-semibold hover:border-purple-500/15 transition-all">
                              <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                                <span className="text-foreground/90 font-bold truncate">{srcName.substring(0, 15)}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                                <span className="text-purple-600 font-bold truncate">{tgtName.substring(0, 15)}</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDeleteEdge(i)}
                                className="w-7 h-7 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                        {workflow?.graph.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length === 0 && (
                          <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl bg-muted/10 font-semibold leading-relaxed">
                            Không có liên kết nối tới node này. Click vào cổng tròn cổng Input/Output trên canvas để liên kết trực quan.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
