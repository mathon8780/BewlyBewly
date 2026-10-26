# 本机开发与构建

需要 Node.js 24 或更高版本、pnpm 9.5.0。项目使用 Bilibili 网站服务，不需要本地后端。依赖以 `pnpm-lock.yaml` 为准。

## 开发

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

默认 Vite 地址为 `http://localhost:3303`。Chrome 打开 `chrome://extensions/`，Edge 打开 `edge://extensions/`，启用开发者模式后加载仓库的 `extension/` 目录，再访问 Bilibili。

Firefox 使用 `pnpm dev-firefox` 和生成的 `extension-firefox/` 目录。开发服务持续运行时可刷新页面，修改清单后根据浏览器提示重新加载扩展。未启用的 popup/options 演示源码不进入生产构建。

使用 `Ctrl+C` 停止开发服务后再生产构建，避免开发和生产任务同时写同一输出目录。

## 验证与生产构建

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm knip
pnpm build
pnpm build-firefox
```

`pnpm test` 执行一次必要回归测试。

## 多平台打包

先执行对应平台构建，再打包；生成目录与压缩包均不纳入 Git。

| 平台 | 构建 | 打包 | 产物 |
| --- | --- | --- | --- |
| Chrome/Edge | `pnpm build` | `pnpm pack:zip` | `extension/`、`extension.zip` |
| Firefox | `pnpm build-firefox` | `pnpm pack:zip-firefox`、`pnpm pack:xpi` | `extension-firefox/`、`extension-firefox.zip`、`extension.xpi` |
| Safari 资源 | `pnpm build-safari` | `pnpm pack:zip-safari` | `extension-safari/`、`extension-safari.zip` |

Firefox XPI 为本地未签名构建，打包不包含商店签名或发布。Safari ZIP 是待转换的 Web Extension 资源；需在配有 Xcode 工具的 macOS 上执行 `pnpm convert-safari` 并完成应用构建、签名，不能将资源 ZIP 当作可安装的 Safari 应用。Safari 功能尚未经过浏览器回归。

源码包使用 `pnpm pack:zip-firefox-sources`，要求工作区已提交，以保证 `extension-firefox-sources.zip` 与当前 `HEAD` 一致。本地反馈图片放在已忽略的 `feedback/`，不会进入提交或源码归档。

优化内容、体积数据和验证限制统一记录在[仓库优化记录](OPTIMIZATION-cmn_CN.md)。
