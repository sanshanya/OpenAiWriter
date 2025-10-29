// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

// ✅ 引入副作用组件（Client）
import { SyncBootstrap } from "@/app/_bootstrap/SyncBootstrap";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Writer UI",
  description: "面向 AI 写作场景的 Plate 编辑器骨架",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-neutral-50 text-neutral-900 antialiased`}
      >
        {/* ✅ 仅在浏览器且开关开启时初始化 Leader + 同步循环 */}
        <SyncBootstrap />
        {children}
      </body>
    </html>
  );
}
