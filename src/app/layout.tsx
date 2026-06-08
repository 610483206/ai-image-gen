"use client";

import { ThemeProvider } from "next-themes";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";

const geist = localFont({
  src: [
    { path: "./fonts/GeistVF.woff", weight: "100 900", style: "normal" },
    { path: "./fonts/GeistMonoVF.woff", weight: "100 900", style: "normal" },
  ],
  variable: "--font-geist",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", geist.variable)}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
