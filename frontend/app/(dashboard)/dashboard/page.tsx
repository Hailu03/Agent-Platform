"use client";

import { useState, useEffect } from "react";
import { 
  Bot, 
  Zap, 
  Database, 
  ArrowUpRight, 
  Activity,
  Plus,
  LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const [user, setUser] = useState<{ full_name: string } | null>(null);

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
  }, []);
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chào buổi sáng, {user?.full_name || "Admin"}! 👋</h1>
          <p className="text-muted-foreground mt-1">Dưới đây là tóm tắt hoạt động của các AI Agent trong hệ thống.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-xl border-dashed">
            Xem báo cáo
          </Button>
          <Link href="/agents/create">
            <Button className="rounded-xl gap-2 shadow-lg shadow-green-500/20">
              <Plus className="w-4 h-4" />
              Tạo Agent mới
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Tổng số Agent" 
          value="12" 
          change="+2 tháng này" 
          icon={Bot} 
          trend="up"
        />
        <StatCard 
          title="Yêu cầu xử lý" 
          value="1,284" 
          change="+15.2% so với tuần trước" 
          icon={Zap} 
          trend="up"
        />
        <StatCard 
          title="Knowledge base" 
          value="450 MB" 
          change="84 file tài liệu" 
          icon={Database} 
        />
        <StatCard 
          title="Tỷ lệ thành công" 
          value="98.5%" 
          change="-0.2% so với hôm qua" 
          icon={Activity} 
          trend="down"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Agents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Các Agent gần đây</h2>
            <Button variant="link" className="text-primary p-0">Xem tất cả</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AgentCard 
              name="CSKH Bot" 
              desc="Hỗ trợ trả lời câu hỏi khách hàng về sản phẩm." 
              status="Đang chạy" 
              type="Support"
            />
            <AgentCard 
              name="Data Analyst" 
              desc="Phân tích dữ liệu doanh thu từ file Excel." 
              status="Chờ xử lý" 
              type="Research"
            />
            <AgentCard 
              name="Social Poster" 
              desc="Tự động tạo và đăng bài lên Facebook/LinkedIn." 
              status="Lỗi kết nối" 
              type="Marketing"
              isError
            />
            <AgentCard 
              name="Legal Advisor" 
              desc="Kiểm tra tính pháp lý của hợp đồng lao động." 
              status="Đang chạy" 
              type="Legal"
            />
          </div>
        </div>

        {/* System Activity */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Hoạt động hệ thống</h2>
          <div className="bg-card border rounded-2xl p-6 space-y-6 shadow-sm">
            <ActivityItem 
              time="2 phút trước" 
              user="CSKH Bot" 
              action="đã hoàn thành xử lý ticket #482" 
            />
            <ActivityItem 
              time="15 phút trước" 
              user="Hệ thống" 
              action="đã đồng bộ 12 tài liệu mới từ Google Drive" 
            />
            <ActivityItem 
              time="1 giờ trước" 
              user="Admin" 
              action="đã cập nhật cấu hình cho Data Analyst" 
            />
            <ActivityItem 
              time="3 giờ trước" 
              user="Social Poster" 
              action="đã gửi báo cáo tuần qua Slack" 
            />
            <Button variant="secondary" className="w-full rounded-xl">Xem toàn bộ log</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
  trend?: "up" | "down";
}

function StatCard({ title, value, change, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="bg-card border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
          <p className={cn(
            "text-xs mt-2 font-medium flex items-center gap-1",
            trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-muted-foreground"
          )}>
            {change}
            {trend === "up" && <ArrowUpRight className="w-3 h-3" />}
          </p>
        </div>
        <div className="bg-primary/10 p-3 rounded-xl group-hover:bg-primary/20 transition-colors">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
    </div>
  );
}

interface AgentCardProps {
  name: string;
  desc: string;
  status: string;
  type: string;
  isError?: boolean;
}

function AgentCard({ name, desc, status, type, isError }: AgentCardProps) {
  return (
    <div className="bg-card border rounded-2xl p-5 hover:border-primary/50 transition-all cursor-pointer group shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
          <Bot className={cn("w-6 h-6", isError ? "text-red-500" : "text-primary")} />
        </div>
        <div className={cn(
          "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
          isError ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary"
        )}>
          {status}
        </div>
      </div>
      <h3 className="font-bold text-lg leading-snug">{name}</h3>
      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{desc}</p>
      <div className="mt-4 flex items-center justify-between border-t pt-4">
        <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-secondary rounded-md">{type}</span>
        <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </div>
  );
}

interface ActivityItemProps {
  time: string;
  user: string;
  action: string;
}

function ActivityItem({ time, user, action }: ActivityItemProps) {
  return (
    <div className="flex gap-4 relative">
      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 z-10 shrink-0" />
      <div className="absolute left-[3.5px] top-4 w-[1px] h-[calc(100%+16px)] bg-border last:hidden" />
      <div>
        <p className="text-xs text-muted-foreground mb-1">{time}</p>
        <p className="text-sm leading-snug">
          <span className="font-bold">{user}</span> {action}
        </p>
      </div>
    </div>
  );
}
