# dsh-browser-studio

把 DeepSeek Harness 的内置浏览器变成一间「浏览器工作室」：**按设备尺寸预览**，**点选页面元素**，一键把元素上下文放进会话。

- 设备工具栏：预设机型 + 自定义宽高 + 横竖切换 + 适应缩放 + 设备外框 + 移动 UA
- 元素点选：hover 高亮、点击选中，自动带上选择器、DOM 路径、文本、尺寸、样式、React 组件名（桌面版）
- 拾取即入对话：自动唤起并聚焦输入框，元素以**标签（chip）**排在输入框上方，可逐条移除
- **不往输入框写任何文字**：元素详情由宿主在下一步作为隐藏上下文注入，输入框只留你自己写的话
- 完整保留 HMR、登录态、真实交互——它就是一个真浏览器，不是截图

> 接管行为：桌面版默认**接管内置浏览器**（`browser` tab 类型）。卸载插件或禁用后，官方浏览器原样恢复。

## 兼容性

| 环境 | 设备尺寸 | 元素点选 | 入对话 |
|---|---|---|---|
| DSH Desktop ≥ 0.2.1-rc.1 | ✅ | ✅ | ✅ |
| DSH Web | ✅（iframe） | ❌ 需要桌面版 | ✅ |

## 安装

```sh
dsh plugin --profile desktop add dsh-browser-studio
```

装完刷新窗口。从源码安装：

```sh
git clone https://github.com/curleaf/dsh-browser-studio
cd dsh-browser-studio && npm install && npm run build
dsh plugin --profile desktop add .
```

## 用法

1. 右侧栏打开「浏览器」（`Ctrl/Cmd+T`），输入 `localhost:5173` 这类地址。
2. 第二行工具栏选设备：`iPhone 15` / `Pixel 9` / `iPad Pro 13` / 桌面尺寸，或直接改宽高。
3. 点 `UA` 可切移动端 UA（会 reload 一次）；点 `▣` 显示设备外框；`适应` 会自动缩放到面板大小。
4. 点 `⊕` 进入点选：鼠标划过元素出现高亮和尺寸标签，点击后**元素被蓝框标出**，旁边浮出「批注」卡片（跟随元素，页面滚动也不会跑偏）。
5. 在卡片里写「圆角改小一点」，`Enter` 或点 → 确认；`Esc` 或 `×` 取消。确认后输入框自动聚焦，上方出现「元素 1 · button#submit · 圆角改小一点」标签，**输入框里不会多出任何文字**。
6. 补一句「把这个按钮改成主色」发送即可。宿主会在这一步把元素详情（选择器 / DOM 路径 / 尺寸 / 样式 / React 文件 / 你的批注）作为一条**隐藏上下文**注入给模型；聊天里只显示折叠的上下文行。
7. 消息发出后标签自动清空；点 `×` 可以单独移除某个引用（宿主那边同步删除）。

## 能力边界（有意为之）

- **不做 DPR / 触摸模拟**。DSH 没有给插件 CDP 通道，插件只能控制 webview 的视口尺寸和 UA；DPR 仅作展示。
- **跨域 iframe 内部读不到**。浏览器安全模型如此，Cursor 也一样。
- **页面内容一律不可信**。元素块由网页 DOM 生成，注入脚本运行在页面主世界；发送前请自己确认。
- **Web 版不点选**。没有租约就没有注入通道，只提供尺寸预览。
- **上下文走宿主注入**。客户端把元素详情 POST 到 `/browser-studio/api/refs`，宿主在下一个 `agent/pre-step` 追加一条 `source.kind` 非 `user` 的隐藏消息；因此元素信息不会出现在输入框或聊天气泡里。
- **未发送的引用会过期**：宿主侧条目 30 分钟后清理；移除标签会立刻同步删除。

## 实现

- 接管 `browser` kind：`ctx.sidebarRightTabs.register({ kind: 'browser' })`；正文注册在 `sidebar.right.pane.tab`。
- 桌面端租一个 guest：`window.dshDesktop.browser.acquire(workspace)` → `<webview src="about:blank#lease">`。
- 注入页内 agent（`<webview>.executeJavaScript`）：Shadow DOM 覆盖层 + 拾取 + 编号 pin；客户端每 170ms `drain` 一次。
- 设备：webview 的 CSS 尺寸就是 guest viewport（媒体查询真实生效），外层用 `transform: scale()` 适配。
- 入对话：`conversation.input.dock` 席位捕获 `inputActions.setDraft`；不可用时退回 `conversation.send()`。
- 设备数据来自 Chrome DevTools `EmulatedDevices.ts`（BSD-3），React 组件信息来自 [bippy](https://github.com/aidenybai/bippy)（MIT）。见 `NOTICE`。

## 开发

```sh
npm install
npm run build          # agent 字符串 + client bundle
npm run typecheck
npm test               # 纯函数单测
npm run test:bundle    # 在 Chrome 里加载构建产物并跑 apply()
npm run test:agent     # 页内 agent 的真实 Chrome E2E（含 React fixture）
npm run test:all
```

`src/client/presets.ts` 由 `scripts/gen-presets.mjs` 生成，不要手改。

### 已验证到什么程度

- `vitest`：URL 归一、缩放/旋转、元素块、草稿桥、apply 注册（13 项）。
- `test/bundle.e2e.mjs`：在 Chrome 里加载**构建产物**，用假 React + 假 Cordis 跑 `apply()`，确认注册了 `browser` 接管、tab 正文和 dock。
- `test/agent.e2e.mjs` / `test/react-agent.e2e.mjs`：真实 Chrome 里跑注入脚本，验证点选、payload、捕获期拦截、pin、Esc；React fixture 验证 bippy 能拿到组件名。
- `test/electron/spike.mjs`：**Electron 44.7（与 DSH Desktop 同大版本）**里验证三件事——`<webview>` 视口等于它的 CSS 盒子、CSS transform 缩放后渲染与点击都按缩放后的几何走、`setUserAgent` + reload 生效。

尚未在真实的 DSH Desktop 里跑过一次完整安装（需要重启桌面端）。

## 许可

MIT。第三方许可见 [NOTICE](./NOTICE)。
