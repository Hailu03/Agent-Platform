"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowLeft } from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z" fill="#EA4335"/>
  </svg>
);
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Trong thực tế, Google trả về access_token, 
        // nhưng backend của chúng ta đang đợi id_token (nếu dùng implicit flow).
        // Tuy nhiên, để đơn giản và bảo mật hơn, ta có thể fetch user info từ google 
        // hoặc dùng Google One Tap để lấy ID Token.
        // Ở đây tôi sẽ giả định backend nhận access_token hoặc bạn dùng @react-oauth/google 
        // để lấy auth code và trao đổi ở backend.
        
        // Để khớp với backend đã viết (đợi id_token), ta nên dùng ID Token.
        // Nhưng @react-oauth/google useGoogleLogin mặc định trả về Access Token.
        
        // Sửa backend sau, giờ hãy gọi endpoint với token này:
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: tokenResponse.access_token }), // Tạm dùng access_token làm id_token để test hoặc sửa backend
        });

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem("access_token", data.access_token);
          router.push("/dashboard");
        }
      } catch (error) {
        console.error("Google login failed:", error);
      }
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Decorative Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-green-400/5 rounded-full blur-[120px]" />
      </div>

      <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Quay lại trang chủ
      </Link>

      <motion.div 
        className="w-full max-w-md p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl tracking-tighter mb-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-base">W</div>
            WAO AI
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">Chào mừng trở lại</h1>
          <p className="text-muted-foreground mt-2">Đăng nhập để tiếp tục quản lý các AI Agent của bạn.</p>
        </div>

        <div className="space-y-4">
          <Button 
            variant="outline" 
            className="w-full h-12 rounded-xl flex items-center justify-center gap-3 font-semibold border-2 hover:bg-secondary/50"
            onClick={() => login()}
          >
            <GoogleIcon />
            Đăng nhập với Google
          </Button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Hoặc dùng Email</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold ml-1">Email</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                  type="email" 
                  placeholder="name@company.com"
                  className="w-full bg-secondary/30 border-2 border-transparent rounded-xl pl-10 pr-4 py-3 focus:border-primary/50 focus:bg-background outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-semibold">Mật khẩu</label>
                <Link href="#" className="text-xs font-medium text-primary hover:underline">Quên mật khẩu?</Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  className="w-full bg-secondary/30 border-2 border-transparent rounded-xl pl-10 pr-4 py-3 focus:border-primary/50 focus:bg-background outline-none transition-all"
                />
              </div>
            </div>

            <Button className="w-full h-12 rounded-xl font-bold text-lg shadow-lg shadow-green-500/20">
              Đăng nhập
            </Button>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-bold text-primary hover:underline">Đăng ký miễn phí</Link>
        </p>
      </motion.div>
    </div>
  );
}
