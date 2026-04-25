import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { NotificationProvider } from "@/components/shared/NotificationSystem";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
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
    <html lang="vi" className="h-full antialiased">
      <body className={`${plusJakarta.variable} ${outfit.variable} ${jetbrainsMono.variable} font-sans min-h-full flex flex-col`}>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
