# 性能与内存审查

这是优化前的审查记录。已实施的改动和当前验证结果见[优化修改清单](PERFORMANCE_CHANGES-cmn_CN.md)。

审查日期：2026-10-20。基于当前仓库源码、已生成的生产构建，以及本地隔离探针。

本次没有修改业务代码，也没有在登录后的 Bilibili 页面采集 Performance 录制或堆快照。下面的优先级依据代码路径、可复现行为和影响范围，收益为预期方向，不代表已测得的优化幅度。

## 当前基线

| 项目 | 检查结果 |
| --- | --- |
| 内容脚本 JavaScript | `extension/dist/contentScripts/index.global.js`：1,008,953 字节，约 985 KiB |
| 内容脚本 CSS | `extension/dist/contentScripts/style.css`：596,855 字节，约 583 KiB |
| 脚本注入 | 两个 content script 配置均为 `all_frames: true`，匹配多个 Bilibili 子域 |
| 顶栏轮询 | 每 5 分钟更新一次；每个登录状态下的轮询实例会请求私信、消息和动态计数 |
| 现有测试 | 2 个文件、3 个用例，其中 1 个为 demo；没有覆盖本次发现的生命周期、分页和存储问题 |

构建体积是磁盘文件大小，不能当作 JavaScript 堆、图片解码内存或浏览器进程内存。以上数据来自现有产物，本次没有重新构建。

## 优先处理项

P1：优先修复，存在失控请求或资源累积路径。P2：随后优化，改善正常使用下的性能和维护效率。

| 编号 | 优先级 | 已发现的问题 | 建议处理 | 预期收益 |
| --- | --- | --- | --- | --- |
| 1 | P1 | 新旧顶栏的 `setInterval` 没有保存句柄；卸载时只清理滚动事件。切换顶栏样式后，旧轮询仍可保留组件闭包 | 保存并清理定时器；处理 `getUserInfo()` 尚未完成就卸载的情况；隐藏页面暂停，恢复时按过期时间刷新 | 避免旧组件和重复轮询累积，降低多标签页下的请求与唤醒 |
| 2 | P1 | 推荐加载在 `finally` 内递归补数据，没有等待递归结束，也没有检查无更多内容、失活状态或重试上限 | 改为可等待的有界循环；空响应、错误、过滤后无进展分别终止或退避；刷新使用请求代次，失活/卸载时停止补页 | 防止持续请求、错误加载状态和旧请求覆盖新结果 |
| 3 | P1 | 设置窗口每次 resize 都重新调用 `createTransformer()`，该函数创建多个 watch 和可见性观察器 | 在 setup 中只创建一次；把位置更新拆成可重复调用的方法；需要时使用独立 effect scope 并显式停止 | 避免使用期间观察器与响应式任务按 resize 次数增长 |
| 4 | P1 | 推荐、历史等列表持续追加数据并用完整 `v-for` 渲染；推荐页还被 KeepAlive 保留 | 优先对推荐/历史实现虚拟列表；另外为原始数据设分页窗口或上限，保留游标和滚动位置；按需评估 shallowRef | 控制长时间滚动后的 DOM、组件与数据占用 |
| 5 | P2 | 视频封面统一 `loading="eager"`；预览只检查 URL 是否已有，没有请求中的去重、超时或过期响应校验 | 首屏封面优先加载，其余懒加载；预览按视频 ID 合并进行中请求，离开后忽略过期响应；卸载时清理延迟任务 | 减少非首屏图片请求和无用预览工作 |
| 6 | P2 | 全局组件使用 eager glob；内容脚本为单一 IIFE，CSS 关闭拆分；页面/frame 检查前已静态导入 App 和样式 | 先区分主页面 UI、iframe 播放器适配和轻量样式入口；移除全量全局注册，按页面显式导入；重构构建后验证真实分包 | 降低非首页及 iframe 的脚本解析、初始化和样式处理成本 |
| 7 | P2 | 本地壁纸 Base64 同时放进壁纸字段和 `locallyUploadedWallpaper.url`；所有设置作为一个对象持久化，没有写入防抖 | 大图片迁到独立存储或 IndexedDB Blob，设置仅保存引用；小设置按领域拆键并合并写入；建立明确的设置就绪状态 | 减少 JSON 重复字段、频繁大对象序列化、启动竞争和存储写入 |
| 8 | P2 | `useDark()` 同时提供状态和执行全局副作用；多个组件乃至每张番剧卡片都会调用，包含 cookie/DOM 写入与重复主题事件 | 主题监听和副作用在每个文档中初始化一次；组件只消费共享只读状态；统一取消 idle 任务和定时器 | 减少随卡片数量增长的监听、初始化写入和短期定时器 |
| 9 | P2 | 任意受支持 iframe 都会查找播放器全屏按钮；找不到时每 500 ms 查询一次，没有总截止时间 | 仅在视频/番剧等播放器上下文启用；增加立即查询、总超时和取消；必要时观察限定容器并及时断开 | 消除非视频 iframe 上无意义的持续轮询 |
| 10 | P2 | 后台通用 fetch 没有超时/取消协议；各标签页独立请求计数；搜索建议没有过期响应检查，`Object.assign` 也不会截断旧数组尾部 | 增加超时和请求 ID；相同只读请求合并进行中任务，按账号/Firefox cookieStoreId 隔离；搜索校验关键词/代次并替换整个结果数组 | 减少重复请求、过期渲染和请求长时间悬挂；避免不同账号串用缓存 |
| 11 | P2 | 过滤关键字和正则在 composable 初始化时编译一次，设置变化时未重建；每条规则重复做大小写转换、关注检查和数组查找 | 用 computed 重建校验后的规则集；用户名精确匹配使用 Set；每条数据只规范化一次、先检查关注豁免；捕获无效正则 | 降低过滤开销，并修复修改过滤设置后规则仍旧的问题 |
| 12 | P2 | TopBar/OldTopBar 的通知、用户信息、弹层和滚动逻辑大段重复；分页逻辑也散落于多个页面，现有测试未覆盖资源生命周期 | 先抽共享数据与生命周期 composable，保留两套视图；逐步统一分页状态机；用关键行为测试替换 demo 测试 | 减少重复修复，防止定时器和分页问题在多个入口回归 |

## 代码位置与判断依据

1. 顶栏：`src/components/TopBar/TopBar.vue:340`、`:345`；`src/components/TopBar/OldTopBar.vue:312`、`:317`；周期定义在 `src/components/TopBar/notify.ts:6`。App 通过 `useOldTopBar` 切换实例，属于可触发的卸载路径。轮询频率为五分钟，不能描述成高频轮询。
2. 推荐补页：`src/contentScripts/views/Home/components/ForYou.vue:120`、`:224`、`:303`。web 分支已经把 `noMoreContent` 设为 true 后，仍会进入 finally 补页；两个分支的递归调用都没有 await。`initData()` 还应重置分页、结束和登录状态。
3. resize：`src/components/Settings/Settings.vue:28`、`src/utils/transformer.ts:22`、`:105`。工厂内部创建三处 watch 和一个可见性观察器；在事件回调中创建的这些任务没有绑定到原先 setup 的作用域进行统一回收。
4. 长列表：`src/contentScripts/views/Home/components/ForYou.vue:56`、`:339`；`src/contentScripts/views/Home/Home.vue:264`；`src/contentScripts/views/History/History.vue:72`、`:245`。卡片的 `content-visibility` 可减少离屏渲染工作，但保留组件及数据；虚拟列表本身也不能解决原始数组无限增长，需要单独设置数据保留策略。
5. 媒体：`src/components/VideoCard/VideoCard.vue:82`、`:147`、`:277`。预览视频已有 `v-if="previewVideoUrl && isHover"`，离开时节点会移除；这里没有证据证明它一直后台播放，优化重点是请求去重、过期结果和生命周期。
6. 加载：`src/components/index.ts:3`、`src/contentScripts/index.ts:16`、`src/manifest.ts:68`、`:85`、`vite.config.content.ts:15`、`:21`。产物目录只有一个 JS 文件；CSS 中同时包含消息、空间、视频、创作中心页面样式。源码中有 `defineAsyncComponent` 并不意味着当前 IIFE 已实现网络分包。抽屉和原生页面嵌入依赖 iframe 支持，不能直接禁用所有 iframe 注入。
7. 存储：`src/components/Settings/components/ChangeWallpaper.vue:70`、`src/logic/storage.ts:218`、`src/composables/useStorageLocal.ts:26`。当前安装的 VueUse `useStorageAsync` 默认深度监听并序列化整个值。相同字符串在内存中可能共享，不能简单断言 Base64 字段重复会使堆内存翻倍；可确定的是序列化 JSON 存在重复内容。推荐页 `ForYou.vue:104` 另用固定 200 ms 等待设置，应改为确定的就绪信号。
8. 主题：`src/composables/useDark.ts:8`、`:32`；调用示例 `src/components/BangumiCard/BangumiCard.vue:34`，以及内容脚本、App、Dock、TopBar。单次兼容性重发有次数上限，问题是每个调用方都初始化同一全局副作用。
9. DOM 查询：`src/contentScripts/views/App.vue:291`、`:307`、`src/utils/main.ts:295`。App 已在清理时 abort/disconnect；问题是非视频 iframe 存活期间永远无法找到目标的轮询。
10. 请求：`src/background/utils.ts:93`、`src/components/SearchBar/SearchBar.vue:64`。搜索已有 200 ms 防抖，仍不能避免之前发出的请求晚返回；缓存只能有界、短期且按账号隔离，不能随意缓存写操作或长期保存敏感数据。
11. 过滤：`src/composables/useFilter.ts:63`、`:90`、`:159`。先修复规则更新与无效正则处理，再根据数据量评估 Set 和批次规范化的收益。
12. 整理：两个顶栏组件；`src/tests/demo.spec.ts:4`；`src/tests/uriParse.spec.ts`。仅凭依赖数量或文件大小，不应直接删除依赖；当前检查没有证明某个特定依赖可以安全移除。

## 已做的隔离验证

探针从仓库读取原始函数并进行 TypeScript 转译，使用本机已安装的依赖。没有向 Bilibili 发请求，没有改动应用实现。模拟结果用于确认控制流，不等同于完整浏览器测量。

| 验证 | 输入/操作 | 结果 |
| --- | --- | --- |
| 推荐空结果 | 模拟 API 返回 `data: null`，第 6 次请求故意保持 pending，限制探针运行 | 已发起 6 次请求；`noMoreContent=true` 仍继续；`isLoading=false` 时仍有请求未完成 |
| 推荐全部被过滤 | 模拟每批结果均被过滤，同样在第 6 次保持 pending | 已发起 6 次请求，仍未停止；外层 `isLoading` 提前变为 false |
| 设置定位工厂 | JSDOM 配合真实 Vue/VueUse，模拟 20 次 resize 回调；IntersectionObserver 使用计数替身 | 同时创建 20 个观察器；模板引用清空后全部断开。确认使用期间累积，未证明卸载后的永久观察器泄漏 |

上述一次性探针在审查阶段运行；随后依照精简测试的要求移除了探针脚本，仅保留检查记录。

## 建议实施顺序与验收

| 阶段 | 工作 | 验收方式 |
| --- | --- | --- |
| 第一阶段 | 修复顶栏定时器、推荐补页、resize 重复初始化及非视频 iframe 轮询 | 切换新旧顶栏 20 次，定时器不累积；空响应/错误/全部过滤后有明确终止；存在请求时 loading 不提前结束；resize 100 次观察器数稳定；非视频 iframe 不启动播放器查询 |
| 第二阶段 | 虚拟列表和数据窗口、封面懒加载、预览去重、主题共享 | 固定窗口尺寸加载 300/1,000 张卡片；比较 DOM 节点、JS heap、图片请求和滚动长任务；切换标签、关闭抽屉后采样回收情况 |
| 第三阶段 | 按页面/frame 拆入口、设置大字段迁移、共享顶栏与分页逻辑 | 对比首页、视频页、消息 iframe 的加载模块和初始化耗时；测量设置写入次数/字节数；校验旧设置迁移、两个浏览器构建和抽屉功能 |

浏览器测量应使用相同版本、账号、窗口、数据量和其他扩展配置，先预热，再重复操作与 GC 后比较 Heap Snapshot 的保留对象、Detached DOM、计时器和观察器。进程总内存还包括 Bilibili 原站、图片、播放器和 GPU 资源，应与 JS heap 分开记录。完成对应改动时再运行 lint、typecheck、相关行为测试，以及 Chrome/Edge 和 Firefox 构建与页面回归。

## 参考资料

- [Vue 性能指南](https://vuejs.org/guide/best-practices/performance.html)：分包、稳定 props、虚拟列表与大型不可变数据的响应式开销。
- [Vue KeepAlive](https://vuejs.org/guide/built-ins/keep-alive.html)：缓存实例和激活/失活生命周期。
- [Chrome 内容脚本](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)：注入范围与 frame 配置。
- [Chrome 堆快照](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots)：验证对象保留和内存回收。
- [MDN content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility)：离屏渲染跳过机制。
