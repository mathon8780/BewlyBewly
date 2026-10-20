# 本机开发环境记录

配置日期：2026-10-20。适用环境：Windows PowerShell，Chrome / Edge 扩展开发。

## 工具与依赖

| 项目 | 配置结果 | 变更位置 |
| --- | --- | --- |
| Node.js | 复用已有的 `24.16.0` | 本机已有安装 |
| npm | 复用已有的 `11.13.0` | 本机已有安装 |
| pnpm | 安装 `9.5.0`，与 `package.json` 一致 | `%APPDATA%/npm` |
| 项目依赖 | 使用 `pnpm install --frozen-lockfile` 安装 1292 个包 | `node_modules/`，Git 已忽略 |
| Vue 编辑器支持 | 安装 `Vue.volar`，版本 `3.3.13` | 当前用户的 VS Code 扩展 |
| ESLint 编辑器支持 | 安装 `dbaeumer.vscode-eslint`，版本 `3.0.34` | 当前用户的 VS Code 扩展 |
| UnoCSS 编辑器支持 | 安装 `antfu.unocss`，版本 `66.11.0` | 当前用户的 VS Code 扩展 |
| 图标预览支持 | 安装 `antfu.iconify`，版本 `1.0.0` | 当前用户的 VS Code 扩展 |
| 浏览器调试资料目录 | 创建 `web-ext-profile/` | Git 已忽略；供自动启动浏览器时保存调试状态 |
| Git 提交检查 | 依赖安装脚本配置 `pre-commit`，执行 `pnpm lint-staged` | 本地 Git hooks |
| 安装与验证日志 | 保存任务记录及命令验证日志 | `.planning/2026-10-20-local-development-setup/`，通过本地 `.git/info/exclude` 忽略 |

复用已有的 Git、VS Code、Chrome 和 Edge。扩展使用 Bilibili 网站服务，本地开发无需单独部署后端。

## 日常开发

在仓库目录执行：

```powershell
pnpm run dev
```

保持该终端运行。默认 Vite 地址为 `http://localhost:3303`；扩展仍需加载到浏览器，并在 Bilibili 页面中查看效果。

1. Chrome 打开 `chrome://extensions/`，或 Edge 打开 `edge://extensions/`。
2. 启用“开发者模式”，点击“加载已解压的扩展程序”。
3. 选择仓库根目录下生成的 `extension/` 文件夹。
4. 访问 `https://www.bilibili.com/` 查看界面；修改后可刷新页面，必要时在扩展管理页面重新加载扩展。

也可以在另一个终端执行 `pnpm run start:chromium`，使用项目配置启动独立的 Chromium 调试浏览器。首次运行时需要等待 `pnpm run dev` 完成初次编译。

使用 `Ctrl+C` 停止开发服务。生产构建也会写入 `extension/`，应先停止开发服务，再执行：

```powershell
pnpm run build
```

构建出的扩展可以在开发服务关闭后加载使用。再次开发时重新执行 `pnpm run dev`。

## 检查命令

```powershell
pnpm run lint
pnpm run typecheck
pnpm run test --run
pnpm run knip
pnpm run build
pnpm run build-firefox
```

Firefox 输出目录为 `extension-firefox/`。本机未补装 Firefox，日常调试可使用现有的 Chrome / Edge。

本次验证结果：

| 检查 | 结果 |
| --- | --- |
| ESLint | 通过 |
| TypeScript / Vue 类型检查 | 通过 |
| Vitest | 2 个测试文件、3 个测试全部通过 |
| Knip | 通过 |
| Chrome / Edge 生产构建 | 通过，清单引用的文件全部存在 |
| Firefox 生产构建 | 通过 |
| 开发服务 | 已启动验证，Vite 客户端与 options 页面均返回 HTTP 200 |
| 开发产物 | 开发清单及 6 项必要产物已验证 |

验证完成后已停止开发进程，并重新生成 Chrome / Edge 生产产物。因此当前 `extension/` 可以在开发服务关闭时加载；开始修改代码前运行 `pnpm run dev`。

## 在其他机器上恢复依赖

安装 Node.js 后，在 PowerShell 执行：

```powershell
npm install --global pnpm@9.5.0
pnpm install --frozen-lockfile
New-Item -ItemType Directory -Path web-ext-profile -Force
pnpm run dev
```

仓库未指定 Node.js 的固定版本；本次实际验证使用 `24.16.0`。依赖版本以现有 `pnpm-lock.yaml` 为准。

## 已知安装和构建提示

- 可选的 `dtrace-provider` 原生跟踪模块在安装时未找到其支持的 Visual Studio C++ 工具链，随后执行包内回退脚本，依赖安装成功。其提示未阻止测试与 Chrome / Edge 生产构建。
- 原有工具链会输出 Node.js / Vite 弃用提示、npm 对 pnpm 配置项的提示，以及 UnoCSS 和资源解析提示。具体检查结论与日志见任务记录。
- 未进行登录 Bilibili 后的页面交互验收。
