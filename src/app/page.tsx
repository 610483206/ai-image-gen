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
    <main className="flex min-h-screen bg-background">
      {/* 桌面端左侧会话列表 */}
      <div className="hidden lg:block relative">
        <ConversationList collapsed={sidebarCollapsed} />
        {/* 收起/展开按钮 */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-20 z-10 w-6 h-6 rounded-full bg-card border border-border/50 shadow-md flex items-center justify-center hover:bg-accent transition-colors"
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-3 w-3 text-muted-foreground" />
          ) : (
            <PanelLeftClose className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* 移动端抽屉 */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border/50">
        <div className="flex items-center justify-between p-3">
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="h-[85vh]">
              <div className="overflow-y-auto h-full">
                <ConversationList collapsed={false} />
              </div>
            </DrawerContent>
          </Drawer>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold">AI 绘画</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted && (theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />)}
          </Button>
        </div>
      </div>

      {/* 主内容区：对话流 + 底部输入 */}
      <div className="flex-1 flex flex-col lg:ml-0 mt-[57px] lg:mt-0 h-screen overflow-hidden">
        <RightPanel />
        <InputArea />
      </div>

      <SettingsDialog />
    </main>
  );
}
