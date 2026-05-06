"use client";

import { useState } from "react";
import { LeftPanel } from "@/components/left-panel";
import { RightPanel } from "@/components/right-panel";
import { SettingsDialog } from "@/components/settings-dialog";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Menu, Sparkles } from "lucide-react";

export default function Home() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <main className="flex min-h-screen bg-background">
      {/* 桌面端左侧面板 */}
      <div className="hidden xl:block">
        <LeftPanel />
      </div>

      {/* 移动端抽屉 */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b">
        <div className="flex items-center justify-between p-3">
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="h-[85vh]">
              <div className="overflow-y-auto h-full">
                <LeftPanel />
              </div>
            </DrawerContent>
          </Drawer>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold">AI 绘画</span>
          </div>

          <div className="w-10" /> {/* 占位，保持标题居中 */}
        </div>
      </div>

      {/* 右侧工作台 */}
      <div className="flex-1 xl:ml-0 mt-[57px] xl:mt-0">
        <RightPanel />
      </div>

      <SettingsDialog />
    </main>
  );
}
