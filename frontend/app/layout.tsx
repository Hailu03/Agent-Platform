import type { Metadata } from "next";
import { Inter, Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { NotificationProvider } from "@/components/shared/NotificationSystem";
import "./globals.css";

// Cấu hình Inter chuyên nghiệp cho Heading
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-heading",
  weight: ["500", "600", "700"], // 600 là đẹp nhất cho Title
});

// Be Vietnam Pro cho nội dung cực mượt
const beVietnam = Be_Vietnam_Pro({
  subsets: ["vietnamese"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WAO AI - CMS Agent Platform",
  description: "Nền tảng xây dựng và quản lý AI Agent cho người dùng Việt",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <body 
        className={`${beVietnam.variable} ${inter.variable} ${jetbrainsMono.variable} font-sans min-h-full flex flex-col`}
        suppressHydrationWarning
      >
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
