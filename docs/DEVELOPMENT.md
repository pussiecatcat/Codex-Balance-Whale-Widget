# 开发

## 环境

- Node.js 24+，先 `npm ci`（唯一的 devDependency 是 ESLint）。
- 发布包构建需要 Python 3。
- Windows 用 PowerShell 执行安装/回滚脚本；macOS 脚本保留但未实机验收。

## 运行

```bash
npm start          # = node scripts/control.mjs open，启动挂件与服务
npm run desktop    # 独立桌面模式
node scripts/control.mjs status | balance | usage | stop
```

日志与状态在 `%USERPROFILE%\.codex\whale-widget\`（macOS：`~/.codex/whale-widget/`）。

## 测试分层

| 命令 | 覆盖 |
|---|---|
| `npm test` | 单元 + 行为测试（纯 Node，不启动 Electron） |
| `npm run test:ui` | 渲染进程行为测试清单，CI 显式运行 |
| `node tests/desktop-audit.mjs` | Electron 桌面审计（窗口、穿透、形状、设置窗口） |
| `node tests/bubble-visual.mjs` | 气泡视觉回归截图 |
| `npm run verify` | lint + 单测 + 包依赖 + 架构边界 + 发布包构建 |
| `npm run check:architecture` | 依赖方向、全局名、样式预算、生命周期计数 |

测试约定：

- 不要用 `vm` 切源码做断言；确实无法在 Node 导入的（`preload.cjs` 依赖 electron、`alpha-worker.js` 是 classic worker）要在文件头写明原因。
- 新功能模块至少有一个「构造 → 操作 → dispose 后不再回调」的行为测试。
- 删除/新增根目录文件时同步 `scripts/check-package.mjs` 与 `scripts/build-release.py` 的清单，否则 CI 会红。

## 调试

- 托盘「查看运行状态」：平台、跟随模式、PID、窗口可见性、恢复次数。
- `node scripts/control.mjs status`：服务版本、provider 配置摘要、GPU/渲染信息。
- 测试模式下渲染进程暴露 `window.__whaleRenderTest`、`__whaleInputTest`、`__whaleShapeTest`、`__whaleAccount`、`__whaleApiModels`；设置窗口暴露 `window.__whaleSettingsTest`。
- 诊断文件：`visibility-status.json`、`render-status.json`、`startup-timings.json`、`desktop-shutdown.json`。

## 代码约定

- 组合根构造依赖，功能模块只接收参数；不新增业务全局名，不发跨功能 `window` 事件。
- 所有监听/定时器挂 `scope`；浮层走 `services/popover.js`；层级走 `services/layers.js`。
- 网络请求只走 `services/request.js`；`localStorage` 只走 `services/ui-state.js`。
- 静态样式写 class；只有测量得到的几何属性和 `--dshw-*` 变量允许内联。
- 隐私：密钥、提供商名称、账号、本机路径、会话日志不得进入公开仓库、UI 或日志。

更完整的依赖规则与状态归属见 [ARCHITECTURE.md](ARCHITECTURE.md)。
