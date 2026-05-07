"use client";

import { useEffect, useState } from "react";
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
import { Menu, Sparkles } from "lucide-react";

export default function Home() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { loadConversations } = useAppStore();

  // 注册全局键盘快捷键
  useKeyboardShortcuts();

  // 应用启动时：执行迁移 + 加载会话
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
      <div className="hidden lg:block">
        <ConversationList />
      </div>

      {/* 移动端抽屉 */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b">
        <div className="flex items-center justify-between p-3">
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="h-[85vh]">
              <div className="overflow-y-auto h-full">
                <ConversationList />
              </div>
            </DrawerContent>
          </Drawer>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold">AI 绘画</span>
          </div>

          <div className="w-10" />
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
