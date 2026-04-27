"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchWithAuth } from "@/lib/api";
import { useNotifications } from "./use-notifications";

export interface Agent {
  id: string;
  name: string;
  description: string;
  model_provider: string;
  model_name: string;
  is_active: boolean;
  knowledge_files?: any[];
  skills?: any[];
  tools?: any[];
}

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addNotification } = useNotifications();

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/agents/");
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : []);
        setError(null);
      } else {
        setError("Không thể tải danh sách Agent");
      }
    } catch (err) {
      console.error("Fetch agents error:", err);
      setError("Lỗi kết nối hệ thống");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const toggleAgentStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetchWithAuth(`/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      
      if (res.ok) {
        setAgents(prev => 
          prev.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a)
        );
        addNotification("success", "Cập nhật thành công", `Agent đã được ${!currentStatus ? "kích hoạt" : "tạm dừng"}`);
        return true;
      }
    } catch (err) {
      addNotification("error", "Lỗi", "Không thể cập nhật trạng thái Agent");
    }
    return false;
  };

  const deleteAgent = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa Agent này?")) return false;
    
    try {
      const res = await fetchWithAuth(`/agents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAgents(prev => prev.filter(a => a.id !== id));
        addNotification("success", "Đã xóa", "Agent đã được loại bỏ khỏi hệ thống");
        return true;
      }
    } catch (err) {
      addNotification("error", "Lỗi", "Không thể xóa Agent");
    }
    return false;
  };

  return {
    agents,
    loading,
    error,
    refreshAgents: fetchAgents,
    toggleAgentStatus,
    deleteAgent
  };
}
