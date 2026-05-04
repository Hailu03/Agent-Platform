"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { 
  Bot, 
  Zap, 
  Shield, 
  Globe, 
  ArrowRight, 
  CheckCircle2,
  MessageCircle,
  ExternalLink,
  LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useNotifications } from "@/hooks/use-notifications";

export default function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addNotification } = useNotifications();

  useEffect(() => {
    // Kiểm tra session cũ
    const token = localStorage.getItem("access_token");
    if (token && !searchParams?.get("session_expired")) {
      router.push("/dashboard");
    }

    if (searchParams?.get("session_expired")) {
      addNotification("warning", "Phiên làm việc hết hạn", "Vui lòng đăng nhập lại để tiếp tục.");
      // Clear the param from URL
      window.history.replaceState({}, document.title, "/");
    }
  }, [router, searchParams, addNotification]);

  return (
    <div className="flex flex-col min-h-screen bg-background overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b glass">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 font-bold text-2xl tracking-tighter group">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform duration-300">
              <span className="font-black text-base leading-none">W</span>
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">WAO AI</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-muted-foreground">
            <Link href="#features" className="text-sm font-medium hover:text-primary transition-colors">Tính năng</Link>
            <Link href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">Gói cước</Link>
            <Link href="#about" className="text-sm font-medium hover:text-primary transition-colors">Về chúng tôi</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-sm font-bold h-10 px-5 rounded-xl">Đăng nhập</Button>
            </Link>
            <Link href="/register">
              <Button className="text-sm font-bold h-10 px-6 rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">Khởi đầu miễn phí</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative py-20 lg:py-32 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-400/10 rounded-full blur-[120px]" />
          </div>

          <div className="container mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-6">
                <Zap className="w-3 h-3" />
                DẪN ĐẦU KỶ NGUYÊN AI AGENT TẠI VIỆT NAM
              </div>
              <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
                Xây dựng AI Agent <br />
                <span className="text-gradient">Không cần Code</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                Tự động hóa quy trình kinh doanh, chăm sóc khách hàng và phân tích dữ liệu 
                với các AI Agent thông minh được thiết kế riêng cho doanh nghiệp Việt.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <Button size="lg" className="rounded-full px-8 h-14 text-lg font-bold shadow-xl shadow-green-500/30">
                    Bắt đầu ngay
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-lg font-bold border-2">
                  Xem bản Demo
                </Button>
              </div>
            </motion.div>

            {/* Dashboard Preview Animation */}
            <motion.div 
              className="mt-20 relative mx-auto max-w-5xl group"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              {/* Window Frame Decoration */}
              <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden relative">
                <div className="h-10 bg-secondary/50 border-b flex items-center px-4 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400/50" />
                    <div className="w-3 h-3 rounded-full bg-amber-400/50" />
                    <div className="w-3 h-3 rounded-full bg-green-400/50" />
                  </div>
                  <div className="mx-auto bg-background/50 rounded-md px-3 py-0.5 text-[10px] text-muted-foreground border">
                    dashboard.wao-ai.vn
                  </div>
                </div>
                <div className="relative aspect-video">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent z-10 pointer-events-none" />
                  <Image 
                    src="/dashboard-preview.png" 
                    alt="WAO AI Dashboard Mockup" 
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1024px"
                    className="object-cover group-hover:scale-[1.01] transition-transform duration-700"
                  />
                </div>
              </div>
              
              {/* Decorative elements around dashboard */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl -z-10 animate-pulse" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-green-400/10 rounded-full blur-3xl -z-10" />
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-32 bg-secondary/30 relative">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-20">
              <h2 className="text-4xl font-bold mb-4 tracking-tight">Mọi thứ bạn cần để triển khai AI</h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-lg">Tận dụng sức mạnh của các mô hình ngôn ngữ hàng đầu để tạo ra giá trị thực tế cho doanh nghiệp.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <FeatureCard 
                icon={Bot} 
                title="Tạo Agent Dễ dàng" 
                desc="Giao diện kéo thả trực quan giúp bạn tạo Agent phức tạp trong vài phút mà không cần lập trình." 
              />
              <FeatureCard 
                icon={Globe} 
                title="Kết nối Đa kênh" 
                desc="Hỗ trợ tích hợp sẵn với Slack, Gmail, Google Drive, Notion và nhiều dịch vụ phổ biến khác." 
              />
              <FeatureCard 
                icon={Shield} 
                title="Bảo mật Doanh nghiệp" 
                desc="Dữ liệu của bạn được mã hóa và lưu trữ an toàn. Hỗ trợ triển khai On-premise cho doanh nghiệp." 
              />
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-extrabold mb-4">Gói cước linh hoạt</h2>
              <p className="text-muted-foreground">Phù hợp từ cá nhân khởi nghiệp đến doanh nghiệp lớn.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <PricingCard 
                name="Cơ bản" 
                price="0" 
                desc="Dành cho người mới bắt đầu khám phá AI." 
                features={["3 AI Agents", "100 yêu cầu / tháng", "Kết nối Google Drive", "Hỗ trợ cộng đồng"]}
              />
              <PricingCard 
                name="Chuyên nghiệp" 
                price="490.000" 
                desc="Cho cá nhân và nhóm nhỏ cần sức mạnh tối ưu." 
                features={["Không giới hạn Agent", "5.000 yêu cầu / tháng", "Tất cả Connectors", "Ưu tiên xử lý", "Hỗ trợ 24/7"]}
                highlighted
              />
              <PricingCard 
                name="Doanh nghiệp" 
                price="Liên hệ" 
                desc="Tùy chỉnh riêng theo nhu cầu đặc thù của tổ chức." 
                features={["Yêu cầu không giới hạn", "Triển khai On-premise", "Tùy chỉnh Model riêng", "Quản lý quyền nâng cao", "Account Manager riêng"]}
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="container mx-auto px-6 text-center relative z-10">
            <div className="max-w-3xl mx-auto bg-primary rounded-[3rem] p-12 lg:p-20 shadow-2xl shadow-primary/40 text-white">
              <h2 className="text-4xl font-bold mb-6">Sẵn sàng đưa AI vào công việc?</h2>
              <p className="text-green-100 text-xl mb-10">Gia nhập cùng hàng ngàn người dùng đang tối ưu hóa năng suất mỗi ngày với WAO AI.</p>
              <Link href="/register">
                <Button size="lg" variant="secondary" className="rounded-full px-10 h-14 text-lg font-bold text-primary">
                  Bắt đầu Miễn phí
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 bg-card">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-1">
              <Link href="/" className="flex items-center gap-3 font-bold text-2xl mb-6 tracking-tighter group">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform duration-300">
                  <span className="font-black text-base leading-none">W</span>
                </div>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">WAO AI</span>
              </Link>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Nền tảng CMS AI Agent số 1 tại Việt Nam. Giúp bạn làm chủ công nghệ AI một cách đơn giản nhất.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-6 text-sm uppercase tracking-widest text-foreground">Sản phẩm</h4>
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-primary transition-colors">Tính năng</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Connectors</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Mẫu Agent</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-6 text-sm uppercase tracking-widest text-foreground">Hỗ trợ</h4>
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-primary transition-colors">Tài liệu hướng dẫn</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">API Reference</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Cộng đồng</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-6 text-sm uppercase tracking-widest text-foreground">Theo dõi</h4>
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors"><MessageCircle className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors"><ExternalLink className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors"><Globe className="w-5 h-5" /></Button>
              </div>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© 2026 WAO AI Team. Mọi quyền được bảo lưu.</p>
            <div className="flex items-center gap-6">
              <Link href="#" className="hover:text-primary transition-colors">Chính sách bảo mật</Link>
              <Link href="#" className="hover:text-primary transition-colors">Điều khoản dịch vụ</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  desc: string;
}

function FeatureCard({ icon: Icon, title, desc }: FeatureCardProps) {
  return (
    <motion.div 
      className="p-8 rounded-2xl bg-card border hover:border-primary/50 transition-all hover:shadow-lg group"
      whileHover={{ y: -5 }}
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
    </motion.div>
  );
}

interface PricingCardProps {
  name: string;
  price: string;
  desc: string;
  features: string[];
  highlighted?: boolean;
}

function PricingCard({ name, price, desc, features, highlighted }: PricingCardProps) {
  return (
    <div className={cn(
      "p-8 rounded-[2rem] border transition-all flex flex-col relative",
      highlighted 
        ? "bg-card border-primary shadow-2xl scale-105 z-10" 
        : "bg-card hover:border-muted-foreground/30 shadow-sm"
    )}>
      {highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
          Phổ biến nhất
        </div>
      )}
      <div className="mb-8">
        <h3 className="font-bold text-lg mb-2">{name}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-extrabold">{price === "Liên hệ" ? "" : "đ"}</span>
          <span className="text-5xl font-extrabold tracking-tight">{price}</span>
          {price !== "Liên hệ" && <span className="text-muted-foreground font-medium">/tháng</span>}
        </div>
        <p className="text-sm text-muted-foreground mt-4">{desc}</p>
      </div>
      <div className="space-y-4 mb-8 flex-1">
        {features.map((f: string) => (
          <div key={f} className="flex items-center gap-3 text-sm">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
            <span>{f}</span>
          </div>
        ))}
      </div>
      <Button 
        variant={highlighted ? "default" : "outline"} 
        className={cn("w-full rounded-xl h-12 font-bold", highlighted ? "shadow-lg shadow-green-500/20" : "")}
      >
        Chọn gói này
      </Button>
    </div>
  );
}
