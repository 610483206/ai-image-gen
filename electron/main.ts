import { app, BrowserWindow, shell } from "electron";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import http from "http";
import net from "net";

// 生产模式下启动内嵌 Next.js standalone 服务器
let serverProcess: ChildProcess | null = null;
let SERVER_PORT = 13579;
let SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

/** 查找可用端口 */
async function findFreePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    const available = await new Promise<boolean>((resolve) => {
      const tester = net.createServer()
        .once("listening", () => { tester.close(); resolve(true); })
        .once("error", () => resolve(false))
        .listen(port, "127.0.0.1");
    });
    if (available) return port;
  }
  throw new Error("No free port found");
}

function getStandalonePath(): string {
  // 打包后，standalone 目录在 resources/standalone
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone");
  }
  // 开发模式：项目根目录下的 .next/standalone
  return path.join(__dirname, "..", ".next", "standalone");
}

function getStaticPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "static");
  }
  return path.join(__dirname, "..", ".next", "static");
}

/** 启动 Next.js standalone 服务器 */
function startServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const standalonePath = getStandalonePath();
    const serverScript = path.join(standalonePath, "server.js");

    console.log("[Electron] Starting Next.js server from:", standalonePath);
    console.log("[Electron] Static assets at:", getStaticPath());

    // 设置环境变量
    const env = {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    };

    serverProcess = spawn("node", [serverScript], {
      env,
      cwd: standalonePath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let started = false;

    serverProcess.stdout?.on("data", (data: Buffer) => {
      const msg = data.toString();
      console.log("[Server]", msg);
      if (!started && (msg.includes("Ready") || msg.includes("listening") || msg.includes("started"))) {
        started = true;
        resolve();
      }
    });

    serverProcess.stderr?.on("data", (data: Buffer) => {
      console.error("[Server Error]", data.toString());
    });

    serverProcess.on("error", (err) => {
      console.error("[Electron] Failed to start server:", err);
      if (!started) reject(err);
    });

    serverProcess.on("exit", (code) => {
      console.log("[Electron] Server exited with code:", code);
      serverProcess = null;
    });

    // 超时兜底：15 秒后如果还没 ready，尝试健康检查
    setTimeout(() => {
      if (!started) {
        checkServerHealth()
          .then(() => {
            if (!started) {
              started = true;
              resolve();
            }
          })
          .catch(() => {
            if (!started) {
              reject(new Error("Server start timeout"));
            }
          });
      }
    }, 15000);
  });
}

/** 健康检查：尝试连接服务器 */
function checkServerHealth(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const req = http.get(SERVER_URL, (res) => {
      if (res.statusCode && res.statusCode < 500) {
        resolve(true);
      } else {
        reject(new Error(`Server returned ${res.statusCode}`));
      }
    });
    req.on("error", reject);
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error("Health check timeout"));
    });
  });
}

/** 等待服务器就绪（轮询） */
async function waitForServer(maxRetries = 30, interval = 1000): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await checkServerHealth();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, interval));
    }
  }
  throw new Error("Server did not become ready in time");
}

/** 创建主窗口 */
function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "AI Image Gen",
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // 在生产模式下隐藏菜单栏
  if (app.isPackaged) {
    win.setMenuBarVisibility(false);
  }

  // 外部链接用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http") && !url.startsWith(SERVER_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  return win;
}

function getIconPath(): string | undefined {
  const iconName = "icon.png";
  if (app.isPackaged) {
    return path.join(process.resourcesPath, iconName);
  }
  const iconPath = path.join(__dirname, "..", "build", iconName);
  try {
    require("fs").accessSync(iconPath);
    return iconPath;
  } catch {
    return undefined;
  }
}

/** 应用主逻辑 */
async function main() {
  // 单实例锁
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  await app.whenReady();

  const isDev = !app.isPackaged;

  let mainWindow = createWindow();

  if (isDev) {
    // 开发模式：加载本地 dev 服务器
    const devUrl = process.env.ELECTRON_DEV_URL || "http://localhost:3000";
    console.log("[Electron] Dev mode, loading:", devUrl);
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：启动内嵌服务器
    try {
      SERVER_PORT = await findFreePort(13579);
      SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
      console.log("[Electron] Using port:", SERVER_PORT);
      await startServer(SERVER_PORT);
      await waitForServer();
      console.log("[Electron] Server ready, loading:", SERVER_URL);
      mainWindow.loadURL(SERVER_URL);
    } catch (err) {
      console.error("[Electron] Failed to start:", err);
      // 显示错误页面
      mainWindow.loadURL(
        `data:text/html,<html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h1>启动失败</h1><p>无法启动内部服务器，请检查日志。</p>
        <pre style="text-align:left;background:#f5f5f5;padding:20px">${String(err)}</pre>
        </body></html>`
      );
    }
  }

  mainWindow.on("closed", () => {
    mainWindow = null as any;
  });

  // 所有窗口关闭时退出（桌面应用行为）
  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      const url = isDev ? (process.env.ELECTRON_DEV_URL || "http://localhost:3000") : SERVER_URL;
      mainWindow.loadURL(url);
    }
  });

  // 退出时清理服务器进程
  app.on("before-quit", () => {
    if (serverProcess) {
      console.log("[Electron] Killing server process...");
      serverProcess.kill();
      serverProcess = null;
    }
  });
}

main().catch((err) => {
  console.error("[Electron] Fatal error:", err);
  app.quit();
});
