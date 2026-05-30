"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useScroll } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  BrainCircuit,
  Building2,
  CheckCircle2,
  CircleDot,
  DatabaseZap,
  FileSearch,
  GitBranch,
  Globe2,
  Layers3,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Play,
  PlugZap,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import {
  AnimatedSection,
  SpotlightCard,
  MagneticButton,
  RevealText,
  MetricCounter,
  TiltCard,
} from "@/components/ui/Animated";

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Use Cases", href: "#use-cases" },
  { label: "Workflow", href: "#workflow" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
];

const metrics = [
  { value: "5 min", label: "để tạo agent đầu tiên" },
  { value: "24/7", label: "tự động hóa tác vụ lặp lại" },
  { value: "20+", label: "connector và công cụ sẵn sàng" },
];

const connectorMarquee = [
  "Gmail",
  "Google Drive",
  "Text-to-SQL",
  "Web Search",
  "CRM",
  "Slack",
  "Notion",
  "Power BI",
];

const agentSignals = [
  { label: "Research", value: "Reading docs", left: "9%", top: "23%", delay: 0 },
  { label: "Memory", value: "Context synced", left: "58%", top: "16%", delay: 0.45 },
  { label: "Guardrail", value: "Approval ready", left: "58%", top: "67%", delay: 0.9 },
  { label: "Deploy", value: "Live in chat", left: "8%", top: "66%", delay: 1.25 },
];

const revealViewport = { once: true, margin: "-90px" };

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.08,
    },
  },
};

const cardReveal = {
  hidden: { opacity: 0, y: 34, scale: 0.96, filter: "blur(10px)" },
  visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
};

const useCases = [
  {
    icon: MessageSquareText,
    title: "Customer operations",
    desc: "Agent đọc ticket, trả lời theo knowledge base và chuyển giao đúng người phụ trách.",
  },
  {
    icon: FileSearch,
    title: "Research assistant",
    desc: "Tổng hợp tài liệu, đọc PDF, tìm web và tạo bản tóm tắt có nguồn để ra quyết định nhanh.",
  },
  {
    icon: BarChart3,
    title: "Business intelligence",
    desc: "Kết nối dữ liệu nội bộ, hỏi đáp bằng ngôn ngữ tự nhiên và xuất insight cho từng team.",
  },
  {
    icon: Building2,
    title: "Internal workflow",
    desc: "Tự động hóa phê duyệt, nhắc việc, cập nhật CRM và đồng bộ tri thức giữa các phòng ban.",
  },
];

const workflowSteps = [
  {
    title: "Describe",
    desc: "Nói cho WAO agent cần làm gì, giới hạn ra sao và kết quả mong muốn là gì.",
    icon: Sparkles,
  },
  {
    title: "Connect",
    desc: "Gắn Gmail, Drive, database, API hoặc knowledge base nội bộ bằng connector có sẵn.",
    icon: PlugZap,
  },
  {
    title: "Orchestrate",
    desc: "Kiểm soát tool, memory, guardrail và luồng hành động trong một canvas rõ ràng.",
    icon: Workflow,
  },
  {
    title: "Deploy",
    desc: "Chạy agent cho cá nhân, team hoặc quy trình doanh nghiệp với audit trail đầy đủ.",
    icon: BadgeCheck,
  },
];

const features = [
  {
    icon: BrainCircuit,
    title: "Natural language builder",
    desc: "Biến yêu cầu bằng tiếng Việt thành agent có role, tool, memory và workflow có thể kiểm thử.",
  },
  {
    icon: DatabaseZap,
    title: "Data-aware agents",
    desc: "Kết nối file, bảng dữ liệu, semantic layer và nguồn tri thức để agent trả lời theo ngữ cảnh.",
  },
  {
    icon: LockKeyhole,
    title: "Enterprise control",
    desc: "Quản lý quyền, audit log, cấu hình model và chính sách bảo mật cho từng workspace.",
  },
  {
    icon: Layers3,
    title: "Reusable skills",
    desc: "Đóng gói quy trình thành skill để nhân bản cho nhiều agent mà vẫn giữ chất lượng đầu ra.",
  },
  {
    icon: Globe2,
    title: "Multi-channel delivery",
    desc: "Triển khai agent vào dashboard, chat, email, workflow nội bộ hoặc các kênh khách hàng.",
  },
  {
    icon: ShieldCheck,
    title: "Human-in-the-loop",
    desc: "Cho phê duyệt trước hành động nhạy cảm, theo dõi lý do agent quyết định và rollback dễ dàng.",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "0",
    desc: "Cho cá nhân và team nhỏ thử nghiệm agent đầu tiên.",
    features: ["3 AI agents", "100 requests mỗi tháng", "Google Drive connector", "Community support"],
  },
  {
    name: "Growth",
    price: "490.000",
    desc: "Cho team vận hành cần agent làm việc hằng ngày.",
    features: ["Unlimited agents", "5.000 requests mỗi tháng", "Tất cả connectors", "Priority queue", "Email support"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Liên hệ",
    desc: "Cho tổ chức cần bảo mật, tích hợp và quy trình riêng.",
    features: ["Custom limits", "On-premise option", "Private model routing", "Advanced permissions", "Dedicated success manager"],
  },
];

export default function LandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050807]" />}>
      <LandingPageContent />
    </Suspense>
  );
}

function LandingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addNotification } = useNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (token && !searchParams?.get("session_expired")) {
      router.push("/dashboard");
    }

    if (searchParams?.get("session_expired")) {
      addNotification("warning", "Phiên làm việc hết hạn", "Vui lòng đăng nhập lại để tiếp tục.");
      router.replace("/");
    }
  }, [router, searchParams, addNotification]);

  return (
    <div className="min-h-screen overflow-hidden bg-[#050807] text-white">
      <div className="pointer-events-none fixed inset-0 z-0">
        {/* Subtle noise grain texture overlay */}
        <div className="absolute inset-0 noise-overlay" />
        
        {/* Floating gradient mesh glows */}
        <div className="absolute left-[-15vw] top-[-10vh] size-[60vw] rounded-full bg-emerald-500/10 blur-[130px] animate-orb-1" />
        <div className="absolute right-[-10vw] top-[25vh] size-[50vw] rounded-full bg-teal-500/8 blur-[120px] animate-orb-2" />
        <div className="absolute left-[15vw] bottom-[-15vh] size-[55vw] rounded-full bg-lime-500/6 blur-[140px] animate-orb-3" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(16,185,129,0.24),transparent_32%),linear-gradient(135deg,rgba(20,184,166,0.12),transparent_28%),linear-gradient(225deg,rgba(132,204,22,0.1),transparent_26%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(5,8,7,0.72)_55%,#050807)]" />
      </div>
      <ScrollProgress />

      <SiteNav mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <main className="relative z-10">
        <HeroSection />
        <ProductSection />
        <UseCasesSection />
        <WorkflowSection />
        <FeaturesSection />
        <PricingSection />
        <FinalCta />
      </main>

      <Footer />
    </div>
  );
}

function SiteNav({
  mobileOpen,
  setMobileOpen,
}: {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#050807]/72 backdrop-blur-2xl"
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="WAO AI Agent Platform">
          <span className="grid size-9 place-items-center rounded-lg border border-emerald-300/30 bg-emerald-400/15 text-sm font-black text-emerald-200 shadow-[0_0_28px_rgba(16,185,129,0.28)]">
            W
          </span>
          <span className="text-sm font-semibold tracking-wide text-white sm:text-base">WAO AI Agent Platform</span>
        </Link>

        <div
          className="hidden items-center gap-1 md:flex"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {navItems.map((item, idx) => (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => setHoveredIdx(idx)}
              className="relative rounded-lg px-3 py-2 text-sm font-medium text-white/64 transition hover:text-white"
            >
              {hoveredIdx === idx && (
                <motion.span
                  layoutId="nav-hover-bg"
                  className="absolute inset-0 rounded-lg bg-white/8"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10">{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login">
            <Button variant="ghost" className="h-10 rounded-lg px-4 text-white/74 hover:bg-white/8 hover:text-white">
              Log in
            </Button>
          </Link>
          <Link href="/register">
            <Button className="h-10 rounded-lg bg-emerald-400 px-5 font-semibold text-[#04120d] shadow-[0_0_32px_rgba(16,185,129,0.28)] hover:bg-emerald-300">
              Start Building
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#050807]/95 px-4 py-4 backdrop-blur-2xl md:hidden">
          <div className="grid gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium text-white/76 hover:bg-white/8 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href="/login">
              <Button variant="outline" className="h-11 w-full border-white/14 bg-white/5 text-white hover:bg-white/10">
                Log in
              </Button>
            </Link>
            <Link href="/register">
              <Button className="h-11 w-full bg-emerald-400 font-semibold text-[#04120d] hover:bg-emerald-300">
                Start
              </Button>
            </Link>
          </div>
        </div>
      )}
    </motion.header>
  );
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      aria-hidden
      className="fixed left-0 top-0 z-[70] h-0.5 origin-left bg-gradient-to-r from-emerald-300 via-lime-200 to-cyan-200 shadow-[0_0_18px_rgba(16,185,129,0.75)]"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <motion.div
        aria-hidden
        className="absolute left-[6%] top-28 hidden h-24 w-24 rounded-full border border-emerald-300/20 bg-emerald-300/8 blur-[1px] lg:block"
        animate={{ y: [0, 22, 0], x: [0, 10, 0], opacity: [0.36, 0.62, 0.36] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute right-[8%] top-24 hidden h-16 w-16 rounded-lg border border-lime-300/20 bg-lime-300/8 lg:block"
        animate={{ rotate: [0, 8, -6, 0], y: [0, -18, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="mx-auto grid max-w-7xl min-w-0 items-center gap-12 lg:min-h-[calc(100vh-8rem)] lg:grid-cols-[0.92fr_1.08fr]">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="min-w-0 max-w-3xl"
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/18 bg-white/6 px-3 py-1.5 text-xs font-semibold text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          >
            <Zap className="size-3.5 text-emerald-300" />
            AI agent builder for modern Vietnamese teams
          </motion.div>

          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.12] text-white sm:text-6xl lg:text-7.5xl tracking-tight">
            <RevealText
              text="Build Custom AI Agents With Natural Language"
              highlightWords={["AI", "Natural"]}
              highlightClassName="bg-gradient-to-r from-emerald-200 via-white to-lime-200 bg-clip-text text-transparent font-black"
              delay={0.15}
            />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48, duration: 0.65 }}
            className="mt-6 max-w-2xl text-base leading-8 text-white/66 sm:text-lg"
          >
            WAO giúp bạn mô tả agent bằng ngôn ngữ tự nhiên, kết nối công cụ và triển khai workflow AI
            cho sales, support, research, vận hành và phân tích dữ liệu mà không cần code.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.55 }}
            className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center"
          >
            <MagneticButton>
              <Link href="/register" className="block">
                <Button className="h-12 w-full rounded-lg bg-emerald-400 px-6 text-base font-semibold text-[#04120d] shadow-[0_18px_60px_rgba(16,185,129,0.28)] hover:bg-emerald-300 sm:w-auto">
                  Start Building
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </MagneticButton>
            <MagneticButton>
              <Link href="#product" className="block">
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-lg border-white/14 bg-white/6 px-6 text-base font-semibold text-white hover:bg-white/10 sm:w-auto"
                >
                  <Play className="size-4 fill-white/80" />
                  View Demo
                </Button>
              </Link>
            </MagneticButton>
          </motion.div>

          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                className="border-l border-emerald-300/20 pl-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.72 + index * 0.1, duration: 0.45 }}
              >
                <div className="text-xl font-semibold text-white sm:text-2xl">
                  <MetricCounter value={metric.value} delay={0.8 + index * 0.12} />
                </div>
                <div className="mt-1 text-xs leading-5 text-white/48">{metric.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.82, ease: "easeOut" }}
          className="relative min-w-0"
        >
          <TiltCard maxRotate={6}>
            <AgentAnimationStage />
          </TiltCard>
        </motion.div>
      </div>
    </section>
  );
}

function AgentAnimationStage() {
  return (
    <div className="relative mx-auto w-full max-w-[780px] min-w-0" data-agent-stage>
      <div className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.28),transparent_46%)] blur-2xl" />
      <div className="relative w-full min-w-0 overflow-hidden rounded-xl border border-white/12 bg-[#06100d]/88 p-4 shadow-[0_38px_140px_rgba(0,0,0,0.52)] backdrop-blur-2xl sm:p-5">
        <motion.div
          className="absolute left-0 top-0 h-px w-1/2 bg-gradient-to-r from-transparent via-emerald-200 to-transparent"
          animate={{ x: ["-120%", "240%"] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-rose-400/80" />
            <span className="size-2.5 rounded-full bg-amber-300/80" />
            <span className="size-2.5 rounded-full bg-emerald-300/80" />
          </div>
          <div className="hidden rounded-lg border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-white/48 sm:block">
            wao.ai/orchestration
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
            <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />
            Live
          </div>
        </div>

        <div className="relative mt-5 min-h-[440px] min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))] p-4 sm:min-h-[560px] sm:p-6">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:44px_44px] opacity-25" />
          <motion.div
            aria-hidden
            className="absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-transparent via-emerald-200/10 to-transparent"
            animate={{ x: ["-30%", "760%"] }}
            transition={{ duration: 5.4, repeat: Infinity, ease: "linear" }}
          />

          <div className="relative z-10 flex min-w-0 flex-col gap-5">
            <div className="rounded-lg border border-emerald-300/18 bg-black/22 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/70">
                <TerminalSquare className="size-4" />
                Natural prompt
              </div>
              <div className="min-w-0 font-mono text-sm leading-7 text-white/82 sm:text-base">
                <span className="text-emerald-200">/build-agent</span>{" "}
                <span className="hidden max-w-full overflow-hidden whitespace-nowrap align-bottom text-white/78 [animation:landing-type_5.8s_steps(62,end)_infinite] sm:inline-block">
                  Theo dõi lead mới, đọc Drive, chấm điểm và gửi brief mỗi sáng
                </span>
                <span className="inline-block max-w-full overflow-hidden whitespace-nowrap align-bottom text-white/78 [animation:landing-type-mobile_4.8s_steps(32,end)_infinite] sm:hidden">
                  Tạo agent chăm sóc khách hàng
                </span>
                <span className="ml-1 inline-block h-5 w-2 translate-y-1 bg-emerald-300 [animation:landing-caret_1s_steps(1,end)_infinite]" />
              </div>
            </div>

            <div className="relative h-[250px] sm:h-[340px]">
              <svg className="absolute inset-0 size-full" viewBox="0 0 640 340" fill="none" aria-hidden="true">
                <motion.path
                  d="M320 170 C210 82 155 96 84 112"
                  stroke="url(#agentLine)"
                  strokeWidth="1.4"
                  strokeDasharray="7 10"
                  animate={{ strokeDashoffset: [0, -34] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                />
                <motion.path
                  d="M320 170 C438 64 492 70 558 92"
                  stroke="url(#agentLine)"
                  strokeWidth="1.4"
                  strokeDasharray="7 10"
                  animate={{ strokeDashoffset: [0, -34] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
                />
                <motion.path
                  d="M320 170 C202 245 154 240 86 254"
                  stroke="url(#agentLine)"
                  strokeWidth="1.4"
                  strokeDasharray="7 10"
                  animate={{ strokeDashoffset: [0, -34] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                />
                <motion.path
                  d="M320 170 C454 252 514 240 566 256"
                  stroke="url(#agentLine)"
                  strokeWidth="1.4"
                  strokeDasharray="7 10"
                  animate={{ strokeDashoffset: [0, -34] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
                />
                <defs>
                  <linearGradient id="agentLine" x1="64" y1="64" x2="590" y2="280" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#A7F3D0" stopOpacity="0.05" />
                    <stop offset="0.5" stopColor="#34D399" stopOpacity="0.84" />
                    <stop offset="1" stopColor="#84CC16" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
              </svg>

              <motion.div
                className="absolute left-1/2 top-1/2 z-20 grid size-32 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-emerald-200/25 bg-[#071812] shadow-[0_0_90px_rgba(16,185,129,0.28),inset_0_0_32px_rgba(16,185,129,0.12)] sm:size-40"
                animate={{ y: [-6, 8, -6], scale: [1, 1.025, 1] }}
                transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <motion.div
                  className="absolute inset-[-16px] rounded-full border border-emerald-300/12"
                  animate={{ scale: [0.86, 1.18, 0.86], opacity: [0.18, 0.62, 0.18] }}
                  transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="grid size-16 place-items-center rounded-2xl bg-emerald-300 text-[#04120d] shadow-[0_0_44px_rgba(16,185,129,0.44)] sm:size-20">
                  <Bot className="size-8 sm:size-10" />
                </div>
                <div className="mt-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/72">
                  WAO Core
                </div>
              </motion.div>

              {agentSignals.map((signal) => (
                <motion.div
                  key={signal.label}
                  className="absolute z-20 w-32 rounded-lg border border-white/10 bg-[#081411]/88 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur sm:w-36"
                  style={{ left: signal.left, top: signal.top }}
                  initial={{ opacity: 0, y: 18, scale: 0.92 }}
                  animate={{ opacity: 1, y: [0, -10, 0], scale: 1 }}
                  transition={{
                    opacity: { delay: 0.52 + signal.delay, duration: 0.35 },
                    scale: { delay: 0.52 + signal.delay, duration: 0.35 },
                    y: { delay: signal.delay, duration: 4.2, repeat: Infinity, ease: "easeInOut" },
                  }}
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white">
                    <CircleDot className="size-3.5 text-emerald-300" />
                    {signal.label}
                  </div>
                  <div className="text-xs text-white/48">{signal.value}</div>
                </motion.div>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] py-3">
              <div className="flex w-max gap-3 [animation:landing-marquee_18s_linear_infinite]">
                {[...connectorMarquee, ...connectorMarquee].map((item, index) => (
                  <span
                    key={`${item}-${index}`}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-300/14 bg-emerald-300/8 px-3 py-1.5 text-xs font-semibold text-emerald-50/78"
                  >
                    <PlugZap className="size-3.5 text-emerald-300" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductSection() {
  return (
    <AnimatedSection
      id="product"
      direction="up"
      bounce="bouncy"
      className="px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Product"
          title="Một platform để tạo, kiểm soát và mở rộng AI agent."
          desc="WAO gom builder, connector, memory, workflow và guardrail vào một trải nghiệm rõ ràng cho cả người kinh doanh lẫn team kỹ thuật."
        />

        <motion.div className="mt-12 grid gap-4 lg:grid-cols-3" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={revealViewport}>
          <SpotlightCard className="lg:col-span-2">
            <div className="pointer-events-none absolute inset-x-[-20%] top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/80 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 [animation:landing-shimmer_2.8s_linear_infinite]" />
            <div className="mb-6 flex items-center justify-between">
              <div className="text-sm font-semibold text-white/86">Agent command center</div>
              <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">Realtime</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Requests handled", "12,840", "+28%"],
                ["Hours saved", "1,920", "+41%"],
                ["Approval rate", "96.4%", "+7%"],
              ].map(([label, value, delta], index) => (
                <motion.div
                  key={label}
                  className="rounded-lg border border-white/10 bg-black/18 p-4 z-10"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={revealViewport}
                  transition={{ delay: index * 0.08, duration: 0.42 }}
                >
                  <div className="text-xs text-white/44">{label}</div>
                  <div className="mt-3 text-2xl font-semibold text-white">
                    <MetricCounter value={value} delay={index * 0.1} />
                  </div>
                  <div className="mt-2 text-xs font-semibold text-emerald-200">{delta} this month</div>
                </motion.div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-[#07100d] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="size-4 text-emerald-300" />
                Natural language instruction
              </div>
              <p className="text-sm leading-7 text-white/58">
                &ldquo;Tạo agent theo dõi lead từ Gmail, lấy thông tin công ty trên web, chấm điểm tỉ lệ chuyển đổi và
                tạo brief ngắn cho sales trước 8h mỗi sáng.&rdquo;
              </p>
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <motion.div
              aria-hidden
              className="absolute -right-12 -top-12 size-28 rounded-full bg-emerald-300/12 blur-2xl"
              animate={{ scale: [1, 1.25, 1], opacity: [0.28, 0.68, 0.28] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="text-sm font-semibold text-white/86">Trust layer</div>
            <div className="mt-6 space-y-4">
              {["Permission scope", "Action approval", "Audit timeline", "Model routing"].map((item, index) => (
                <motion.div
                  key={item}
                  className="flex items-center gap-3 z-10"
                  initial={{ opacity: 0, x: 18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={revealViewport}
                  transition={{ delay: 0.15 + index * 0.08, duration: 0.38 }}
                >
                  <div className="grid size-9 place-items-center rounded-lg bg-emerald-300/10 text-emerald-200">
                    <ShieldCheck className="size-4" />
                  </div>
                  <span className="text-sm text-white/66">{item}</span>
                </motion.div>
              ))}
            </div>
          </SpotlightCard>
        </motion.div>
      </div>
    </AnimatedSection>
  );
}

function UseCasesSection() {
  return (
    <AnimatedSection
      id="use-cases"
      direction="left"
      bounce="bouncy"
      className="border-y border-white/10 bg-white/[0.025] px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Use Cases"
          title="Agent cho những workflow tạo giá trị thật."
          desc="Từ CSKH đến nghiên cứu thị trường, mỗi agent đều có công cụ, tri thức và quy tắc hành động riêng."
        />
        <motion.div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={revealViewport}>
          {useCases.map((item) => (
            <InfoCard key={item.title} {...item} />
          ))}
        </motion.div>
      </div>
    </AnimatedSection>
  );
}

function WorkflowSection() {
  return (
    <AnimatedSection
      id="workflow"
      direction="right"
      bounce="bouncy"
      className="px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Workflow"
          title="Từ ý tưởng đến agent đang chạy trong một luồng làm việc mạch lạc."
          desc="Thiết kế agent theo từng bước để team có thể hiểu, test, phê duyệt và mở rộng không cần mở IDE."
        />
        <motion.div className="mt-12 grid gap-4 lg:grid-cols-4" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={revealViewport}>
          {workflowSteps.map((step, index) => (
            <SpotlightCard
              key={step.title}
              className="group"
            >
              <motion.div
                aria-hidden
                className="absolute left-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-emerald-200 to-transparent"
                animate={{ y: ["-120%", "120%"] }}
                transition={{ duration: 2.7 + index * 0.18, repeat: Infinity, ease: "easeInOut", delay: index * 0.2 }}
              />
              <div className="mb-8 flex items-center justify-between">
                <div className="grid size-11 place-items-center rounded-lg bg-emerald-300/12 text-emerald-200">
                  <step.icon className="size-5" />
                </div>
                <span className="text-sm font-semibold text-white/32">0{index + 1}</span>
              </div>
              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/54">{step.desc}</p>
            </SpotlightCard>
          ))}
        </motion.div>
      </div>
    </AnimatedSection>
  );
}

function FeaturesSection() {
  return (
    <AnimatedSection
      id="features"
      direction="left"
      bounce="bouncy"
      className="border-y border-white/10 bg-[#07100d] px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Features"
          title="Đủ sức mạnh cho kỹ thuật, đủ đơn giản cho vận hành."
          desc="Những thành phần cần thiết để đưa agent vào sản xuất: connector, memory, permission, monitoring và approval."
        />
        <motion.div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={revealViewport}>
          {features.map((feature) => (
            <InfoCard key={feature.title} {...feature} />
          ))}
        </motion.div>
      </div>
    </AnimatedSection>
  );
}

function PricingSection() {
  return (
    <AnimatedSection
      id="pricing"
      direction="up"
      bounce="bouncy"
      className="px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Pricing"
          title="Bắt đầu gọn, mở rộng khi agent tạo ra giá trị."
          desc="Các gói linh hoạt cho cá nhân, startup và doanh nghiệp cần quy trình AI riêng."
        />
        <motion.div className="mt-12 grid gap-4 lg:grid-cols-3" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={revealViewport}>
          {pricingPlans.map((plan) => (
            <PricingCard key={plan.name} {...plan} />
          ))}
        </motion.div>
      </div>
    </AnimatedSection>
  );
}

function FinalCta() {
  return (
    <AnimatedSection
      direction="scale"
      bounce="gentle"
      className="px-4 pb-20 pt-8 sm:px-6 lg:px-8"
    >
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-xl border border-emerald-300/18 bg-[linear-gradient(135deg,rgba(16,185,129,0.22),rgba(20,184,166,0.09),rgba(255,255,255,0.045))] p-8 sm:p-10 lg:p-12">
        <div className="pointer-events-none absolute inset-x-[-30%] top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent [animation:landing-shimmer_3.2s_linear_infinite]" />
        <motion.div
          aria-hidden
          className="absolute -right-20 -top-20 size-60 rounded-full bg-emerald-300/18 blur-3xl"
          animate={{ scale: [1, 1.22, 1], opacity: [0.36, 0.78, 0.36] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-emerald-100/70">Launch faster</div>
            <h2 className="max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Tạo agent đầu tiên cho team của bạn trong hôm nay.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62">
              Mô tả workflow, kết nối nguồn dữ liệu và để WAO biến tri thức của doanh nghiệp thành agent có thể hành động.
            </p>
          </div>
          <MagneticButton>
            <Link href="/register" className="block">
              <Button className="h-12 w-full rounded-lg bg-white px-6 font-semibold text-[#04120d] hover:bg-emerald-50 lg:w-auto shadow-lg">
                Start Building
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </MagneticButton>
        </div>
      </div>
    </AnimatedSection>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-black/22 px-4 py-10 text-white/54 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3 text-white">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-400/15 text-sm font-black text-emerald-100">W</span>
            <span className="font-semibold">WAO AI Agent Platform</span>
          </div>
          <p className="mt-3 max-w-md text-sm leading-6">Build personalized AI agents with plain language. No coding required.</p>
        </div>
        <div className="flex items-center gap-2">
          {[GitBranch, Globe2, MessageSquareText].map((Icon, index) => (
            <Button key={index} variant="ghost" size="icon" className="text-white/60 hover:bg-white/8 hover:text-white">
              <Icon className="size-4" />
            </Button>
          ))}
        </div>
      </div>
    </footer>
  );
}

function SectionIntro({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <motion.div className="max-w-3xl" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={revealViewport}>
      <motion.div variants={cardReveal} className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200/70">
        {eyebrow}
      </motion.div>
      <motion.h2 variants={cardReveal} className="text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
        {title}
      </motion.h2>
      <motion.p variants={cardReveal} className="mt-5 text-sm leading-7 text-white/58 sm:text-base">
        {desc}
      </motion.p>
    </motion.div>
  );
}

function InfoCard({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <SpotlightCard className="transition-all duration-300 flex flex-col h-full hover:scale-[1.015]">
      <motion.div
        className="mb-6 grid size-11 place-items-center rounded-lg bg-emerald-300/10 text-emerald-200"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon className="size-5" />
      </motion.div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/54">{desc}</p>
    </SpotlightCard>
  );
}

function PricingCard({
  name,
  price,
  desc,
  features: planFeatures,
  highlighted,
}: {
  name: string;
  price: string;
  desc: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <SpotlightCard
      className={cn(
        "flex w-full flex-col hover:scale-[1.015] z-10 transition-all duration-300",
        highlighted
          ? "border-emerald-300/34 bg-emerald-300/[0.095] shadow-[0_24px_80px_rgba(16,185,129,0.16)]"
          : "border-white/10 bg-white/[0.045]"
      )}
    >
      {highlighted && (
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.22),transparent_42%)] pointer-events-none"
          animate={{ opacity: [0.45, 0.8, 0.45] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {highlighted && (
        <div className="absolute right-5 top-5 rounded-full bg-emerald-300 px-3 py-1 text-xs font-bold text-[#04120d] z-20">
          Popular
        </div>
      )}
      <div className="flex w-full flex-col relative z-10">
        <h3 className="text-xl font-semibold text-white">{name}</h3>
        <p className="mt-3 min-h-12 text-sm leading-6 text-white/54">{desc}</p>
        <div className="mt-8 flex items-end gap-1">
          {price !== "Liên hệ" && <span className="mb-1 text-lg font-semibold text-white/50">đ</span>}
          <span className="text-4xl font-semibold tracking-tight text-white">{price}</span>
          {price !== "Liên hệ" && <span className="mb-1 text-sm text-white/46">/tháng</span>}
        </div>
        <div className="mt-8 space-y-3">
          {planFeatures.map((feature) => (
            <div key={feature} className="flex items-start gap-3 text-sm text-white/64">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
        <Link href="/register" className="mt-8 block w-full">
          <Button
            className={cn(
              "h-11 w-full rounded-lg font-semibold",
              highlighted
                ? "bg-emerald-300 text-[#04120d] hover:bg-emerald-200"
                : "border border-white/14 bg-white/6 text-white hover:bg-white/10"
            )}
          >
            Choose plan
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>
    </SpotlightCard>
  );
}
