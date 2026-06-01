"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAppStore } from "@/store/use-app-store";
import { ConversationList } from "@/components/conversation-list";
import { RightPanel } from "@/components/right-panel";
import { InputArea } from "@/components/input-area";
import { SettingsDialog } from "@/components/settings-dialog";
import { migrateV1ToV2 } from "@/lib/migration";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Menu, Sparkles, PanelLeftClose, PanelLeft, Sun, Moon } from "lucide-react";

export default function Home() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { loadConversations } = useAppStore();

  useEffect(() => setMounted(true), []);

  useKeyboardShortcuts();

  useEffect(() => {
    const init = async () => {
      await migrateV1ToV2();
      await loadConversations();
    };
    init();
  }, [loadConversations]);

  return (
    <main className="app-canvas flex min-h-dvh bg-background text-foreground">
      {/* 桌面端左侧会话列表 */}
      <div className="hidden lg:block relative">
        <ConversationList collapsed={sidebarCollapsed} />
        {/* 收起/展开按钮 */}
        <button
          aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-4 top-24 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground shadow-lg shadow-black/10 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:text-foreground hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* 移动端抽屉 */}
      <div className="fixed left-0 right-0 top-0 z-40 border-b border-border/60 bg-card/86 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between px-3 py-3">
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="打开会话列表" className="h-10 w-10">
                <Menu className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="h-[88vh] border-border/70 bg-card">
              <div className="h-full overflow-y-auto premium-scroll">
                <ConversationList collapsed={false} />
              </div>
            </DrawerContent>
          </Drawer>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-normal">AI 绘画工作台</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            aria-label="切换主题"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted && (theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />)}
          </Button>
        </div>
      </div>

      {/* 主内容区：对话流 + 底部输入 */}
      <div className="mt-[65px] flex h-[calc(100dvh-65px)] flex-1 flex-col overflow-hidden lg:mt-0 lg:h-dvh lg:pl-0">
        <RightPanel />
        <InputArea />
      </div>

      <SettingsDialog />
    </main>
  );
}
