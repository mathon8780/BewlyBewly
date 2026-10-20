# 性能优化修改清单

日期：2026-10-20。使用 3 个 `gpt-6.1-sol / high` 子代理协作，完成后统一集成检查。

## 修改内容

| 范围 | 实际修改 | 主要文件 |
| --- | --- | --- |
| 顶栏轮询 | 新旧顶栏共用可回收的轮询逻辑；隐藏页面暂停，恢复时按过期时间更新；防止卸载后回写和请求重叠 | `components/TopBar/useTopBarPolling.ts`、`TopBar.vue`、`OldTopBar.vue` |
| 推荐补页 | 移除 finally 递归；补页有次数上限；空响应、过滤后无进展和错误停止自动补页，提供重试；刷新/失活使旧结果失效 | `contentScripts/views/Home/components/ForYou.vue`、`utils/boundedPagination.ts` |
| 其他分页 | 关注、热门、直播、订阅剧集和收藏共用有界分页；历史分页也处理刷新、终页和缓冲数据；删除后先补入缓冲，避免缓冲累积 | `composables/useWindowedFeed.ts`、对应页面组件 |
| 列表渲染 | 虚拟化上述列表、历史及稍后再看；按行测量高度，布局变化时重测；卡片操作状态随数据键保留和释放 | `components/VirtualFeed.vue`、`VirtualFeedItem.vue`、`composables/useVideoCardState.ts` |
| 数据保留 | 分页列表每个浏览窗口最多保留 600 项，加当前响应溢出的缓冲；通过“继续浏览”释放上一窗口并保留 API 游标 | 推荐、关注、热门、直播、订阅剧集、历史、收藏页面 |
| 媒体 | 首批封面优先，其余懒加载；预览合并进行中请求，10 秒超时，忽略失活/更换视频后的结果；清理悬停延迟 | `components/VideoCard/VideoCard.vue`、`preview.ts`、`utils/inflightRequest.ts` |
| 设置窗口 | 定位工厂只创建一次；resize 调用更新方法，观察器随组件作用域释放 | `components/Settings/Settings.vue`、`utils/transformer.ts` |
| 播放器 iframe | 只在播放页查找全屏按钮；立即查询、10 秒总截止时间以及 abort 清理 | `contentScripts/views/App.vue`、`utils/main.ts` |
| 加载和样式 | 轻量经典引导脚本先判断页面/frame；支持的文档再加载 ES 模块；组件、页面样式实际拆分，并将本扩展样式同步到自身 Shadow DOM | `contentScripts/index.ts`、`runtime.ts`、`extensionStyles.ts`、`pageScope.ts`、`components/index.ts`、`vite.config.content.ts`、`manifest.ts` |
| 设置存储 | 明确等待设置、布局、侧栏及登录键就绪；设置写入合并 200 ms，登录键立即保存；普通启动不重复写设置 | `composables/useStorageLocal.ts`、`logic/storage.ts` |
| 本地壁纸 | 图片写入独立扩展存储键，设置只序列化引用；兼容旧设置迁移，运行时和导出备份仍使用完整图片 URL | `logic/wallpaperStorage.ts`、`components/Settings/components/ChangeWallpaper.vue` |
| 主题 | 全局副作用每个文档只初始化一次；卡片等组件消费共享状态；释放定时器、idle 和系统主题监听 | `composables/useDark.ts`、`contentScripts/runtime.ts` |
| 后台请求 | 15 秒超时；Firefox 只合并同账号和容器的进行中 GET；Chromium 不访问未授权的 cookies API；消息处理器在 worker 启动时注册并忽略无关消息 | `background/utils.ts`、`background/messageListeners/api/index.ts`、`tabs.ts` |
| 搜索和过滤 | 搜索建议忽略旧响应并替换整个数组；历史消息校验来源并超时；过滤规则响应设置变化、容忍无效正则、使用 Set 精确匹配用户 | `components/SearchBar/*`、`composables/useFilter.ts`、`utils/filterRules.ts` |
| 依赖和整理 | 移除只用于上下文识别的 webext-bridge 及 5 个间接包，避免无用端口连接；清理过期类型、定时器工具和旧注释；更新入口分析配置 | `logic/common-setup.ts`、`package.json`、`pnpm-lock.yaml`、`shim.d.ts`、`knip.json` |
| 后台打包 | 显式打包 md5，避免在经典 worker 中残留无法解析的 npm 导入 | `tsup.config.ts` |

表内源码路径均相对于 `src/`，根目录配置文件除外。保留现有扩展权限和抽屉 iframe 支持。

## 需要注意的行为

- 达到 600 项窗口上限后，点击“继续浏览”进入下一窗口并回到列表顶部；上一窗口内容释放。刷新会从头加载。
- 稍后再看接口一次返回完整列表，因此保留一份浅响应数据，取消重复列表和 JSON 克隆；虚拟化限制 DOM 数量，原始数据仍由服务器返回数量决定。
- 壁纸仍以 Base64 存在独立扩展存储中，运行时仍需加载当前图片。为保留跨标签页和导入引用，未自动删除旧图片键；没有承诺磁盘图片缓存总量下降。
- 不对 Chromium 的账号请求进行跨标签页缓存；Firefox 的合并结果仅存活于请求进行期间。
- 保留有限的主题兼容重发；BFCache 返回时保留已挂载界面。

## 构建体积与验证

优化前内容脚本是 1,008,953 字节的单个 JS 和 596,855 字节的整份 CSS。当前经典引导脚本为 1,508 字节，核心共享模块约 475 KB，基础 CSS 约 312 KB，其余功能和页面样式按需加载。引导脚本之后仍会加载核心和当前页面所需模块，这些数字不能作为总下载量或内存降幅。

按照简化测试的要求，最终仅保留原有 URI 测试和一份性能回归测试：**2 个文件、5 个用例**。移除了其余新增专项测试、额外构建检查命令和 CI 阶段；临时浏览器配置及一次性验证脚本也已清理。

| 基础检查 | 结果 |
| --- | --- |
| TypeScript 类型检查 | 通过 |
| ESLint | 通过 |
| 2 个文件、5 个简单测试 | 通过 |
| Chrome/Edge 生产构建 | 通过 |
| Firefox 生产构建 | 通过；本机未安装 Firefox，未做 Firefox 实际运行检查 |
| 未使用代码/依赖检查 | 通过 |

精简前的隔离浏览器检查已观察到：加载 600 条夹具推荐数据后仅保留 36 张卡片、9 行 DOM，“继续浏览”出现，分包样式成功加载。该次检查的其他模拟 API 返回了不完整数据，产生一条模拟响应相关错误；不能将其描述为完整浏览器回归通过。后续复杂浏览器验证已按要求停止。没有进行真实账号全流程或优化前后的堆快照对比，因此不提供内存减少百分比。
