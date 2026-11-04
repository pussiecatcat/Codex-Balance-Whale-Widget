# 对话框优化迁移：验证报告

> 2026-10-17 复核发现异步设置读取、编辑器参数和旧快照覆盖等缺陷，现已修复。以 [复核修复记录](DIALOG-PORT-FIXES.md) 的最新结果为准：完整检查通过，设置窗口 100 项、气泡 48 场景通过。下文保留迁移阶段历史结果。

日期：2026-10-17。平台：macOS（darwin，arm64，Electron 44.3.0（隔离运行时），Node v24.14.0，Python 3.13.9）。
分支：`port/dialog-optimization-20261016`，工作树：`Codex-Balance-Whale-Widget-dialog-port-20261016`。

本报告只记录本机实际执行过的验证；没有跑过的项目写在「限制」里。

## 0. T00：远端核实与基线

- 2026-10-16 执行 `git fetch origin` + `git ls-remote origin`：**联网成功**，远端默认分支 main = `2de43f37b8f5f41f23630f63905901342de0f3b6`（提交日期 2026-10-11，与任务书缓存一致，本次为实时核实，非缓存基线试作）。
- 新分支 `port/dialog-optimization-20261016` 从该 SHA 建立；新工作树为本目录。原 main（e6abcb5）、online-latest（2de43f3 + 7 处未提交修改）、喂米饭互动（d0e635c + 11 处）、设置优化实施、源工作树（37f3b57 + README 修改 + 未跟踪 docs/BUGS.md 等）**均未触碰**，迁移前已逐目录登记。
- 依赖：新工作树 `npm ci`（仅 eslint/globals devDependency）；Electron 用 electron 缓存 zip 解压到独立 QA 目录 `/Users/dapaohuiemm/forclaude/临时/大肥鱼/qa-dialog-port-20261016/electron-runtime`，测试经 `WHALE_HOME` 指向它，不读写用户实时 `~/.codex/whale-widget`。

### 基线检查（未改业务代码的 2de43f3）

| 检查 | 结果 |
| --- | --- |
| `npm run lint` | 通过（退出码 0） |
| `npm run test:unit` | **483 项：475 过 / 3 失败**。失败全部是 `transport.test.mjs` 的 `listen EINVAL`（macOS socket 路径超 `sun_path` 104 字节预算，本环境 `/var/folders/...` 路径过长触发；即来源分支缺陷 ⑤，未修复） |
| `npm run check:package` | 通过 |
| `npm run check:architecture` | 通过 |
| `python3 scripts/build-release.py` | 通过 |

注：`npm run verify` 因单测失败在 test:unit 步中断，其余检查分别单独运行取得基线。

## 1. 批次一结果（T02/T03，提交 95c6430）

| 检查 | 结果 |
| --- | --- |
| `npm run test:unit` | **491 项 0 失败**（基线 3 项 transport 失败修复；新增 8 项：quota-diy 参数协商 3 项、quota-reliability 客户端协商 2 项、render-state setKeys 1 项、usage-settings-reliability 2 项） |
| `tests/transport.test.mjs` | 9/9（长数据目录可启动、实例隔离、认证不变） |
| `tests/quota-diy.test.mjs` | 9/9：新写法成功、旧版本回退（2 次内有界）、参数缓存命中、缓存被拒重新协商、非参数失败不换写法 |
| `tests/quota-reliability.test.mjs` | 12/12：连接复用、一次性重连、超时/取消清理、客户端两写法协商、缓存命中与升级重协商 |

## 2. 批次二结果（T04，提交 0b39427）

| 检查 | 结果 |
| --- | --- |
| `npm run test:unit` | 502 项 0 失败（新增 `tests/bubble-fit.test.mjs` 11 项：两形状声明、椭圆内接盒逐角校验、圆角更宽、弧心距、双卡同行、旧默认迁移、无 560u 硬编码、frame 缩放位置、html 无 var(--dshw-u) 间接引用） |
| **真实 Electron 气泡视觉与几何检查** | `node tests/bubble-visual.mjs`（`WHALE_HOME` 指向隔离运行时）：**10/10 场景全部 `contained=true`** —— 椭圆/圆角 × 订阅额度（双卡并排）/本轮用量/余额预警（彩虹渐变+链接）/长文本/每日预算。每场景输出 fit 缩放、内容盒与路径尺寸，截图 10 张 |
| 截图目录 | `/Users/dapaohuiemm/forclaude/临时/大肥鱼/qa-dialog-port-20261016/bubble-visual/`（合成数据：未登录态、合成余额，无私密配置） |

代表性观察（详见目录内 `bubble-visual.json`）：
- 订阅额度：椭圆 fit=1，圆角 fit=0.664。此前关于圆角 fit 不小于椭圆的说明不成立，静态内接矩形检查不能证明实际缩放大小；最新检查已只测动画结束后的活动帧。
- 长文本：椭圆 fit=0.578，换行后整体仍在白色区域内，无「5 小/时」式断字（标签 nowrap）。
- 观察到的渲染尺寸偏小（路径 ~167px）：`setBounds` 在不可调窗上的缩放使然，不影响包含性断言；真实观感以设置冒烟截图与用户实机为准。

## 3. 批次三结果（T05/T06，见提交记录）

| 检查 | 结果 |
| --- | --- |
| `npm run verify`（完整链：lint + 单测 + 包检查 + 架构检查 + 发布包构建） | **全部通过**：lint 0 错误；单测 **536 项 0 失败**；包检查含设置窗口 6 文件 + 54 目录字段；架构边界通过（新增 2 处渲染 fetch 已用 `requestJson`，预算 31 未升）；发布包构建成功（产物只在本地 `dist/`，已 gitignore，不发布） |
| **真实 Electron 设置窗口检查** | `node tests/settings-window-smoke.mjs`：**82 项全部通过**，9 张截图。覆盖：窗口行为（960×720 钳制、单实例、无第二只鲸鱼、关闭设置不退挂件）、六分类、`!` 说明四要素与焦点往返、保存闭环（改 scale → 落盘 → 其余 10 字段逐一回读原值）、草稿（切页保留、导航计数、撤销回已保存值）、权限隔离（设置 preload 不暴露 shape/interactive/keyboardFocus/ready/通用 command）、私密字段不回显、窄窗 760×560、气泡形状保存 → 挂件立即切圆角 + localStorage/ui-state.json 双落盘、一级菜单七项 + 底部入口 + 下沉清单、无渲染器报错 |
| 截图目录 | `/Users/dapaohuiemm/forclaude/临时/大肥鱼/qa-dialog-port-20261016/settings-shots/`（01-appearance、02-help、03-dirty、04-saved、05-api、06-narrow-760x560、08-bubble-shape-round 等，合成数据） |
| 桌面审计（quota-only 与完整） | quota-only/完整两种范围均在第 11–12 项附近以不同随机点失败（alpha 命中测试超时、"link must be the hit target" 等）。**已在纯净基线（主线 + 仅 socket 修复）复现同类失败**，与本次迁移无关；详见下节限制 |

## 4. 与基线的对照

- 基线 483 项 3 失败 → 现在 536 项 0 失败；所有新增测试针对本次行为。
- 原有各工作树 SHA 与未提交修改在迁移后重新核对：`git -C <各工作树> status` 与 T00 登记一致，未发生 checkout/reset/覆盖。

## 5. 限制与未完成项

1. **Windows 全链路未验证**：本机 macOS。原生裁切/穿透路径（usesWindowShape）、`supervisor.ps1`、Windows 启动器未触碰也未验证；相关夹具改动（平台定位、恒等坐标转换、原生裁切段守卫）均为增量适配，Windows 行为路径未改。
2. **桌面审计的环境不稳定（既有问题）**：`tests/desktop-audit-smoke.mjs` 在本环境的 alpha 命中/链接点击检查上随运行轮次随机失败；纯净基线同样失败，非本次引入。audit 中的形状包含断言已移植但未能稳定跑完，其几何验收由 bubble-visual 的 10 场景断言承担。
3. **多显示器、真实账户、长期运行**：均未验证。额度查询测试用合成 spawn 夹具；真实 codex CLI 的实际参数协商（codex 0.120+）未在本机实测（本机无该 CLI 环境）。
4. **挂件未安装/未替换**：所有 Electron 检查用 `--whale-data` 指向 mkdtemp 隔离目录 + 独立 WHALE_HOME；用户现用挂件服务未切换，`dist/` 构建产物未发布未推送。
5. **气泡/素材/API 编辑器仍在挂件内**：设置窗口复用挂件编辑器（复核修复后为具体的「打开…编辑器」按钮），未做原生迁移（来源同样未做，单独立项）。
6. **目录逐字段契约**：54 条目的 storage/route 已对齐主线（size/usage → /api/sound-settings），但气泡模块子字段仍是 ID 模式登记，与来源一致，未逐项展开。
