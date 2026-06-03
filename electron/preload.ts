import { contextBridge } from "electron";

// 暴露安全的 API 到渲染进程（按需扩展）
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
});
