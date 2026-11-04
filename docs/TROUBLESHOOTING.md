# 故障排查

先看状态文案，再按「下一步」处理。所有状态都来自 `desktop/ui/features/widget/status-tones.js`，界面不应只用颜色表达状态。

| 状态 | 含义 | 用户能做什么 |
|---|---|---|
| 已同步 | 额度读取成功 | 无 |
| 正在同步… | 正在请求 app-server | 等待；连续失败会退避重试 |
| 数据已过期 | 上次成功数据超过有效期 | 点刷新，或等自动重试 |
| 请登录 Codex | `auth.json` 没有 ChatGPT 登录态，或 token 已失效 | 在 Codex 中登录订阅账号 |
| 暂无额度窗口 | 登录正常，但服务端没有返回 5 小时 / 每周窗口 | 完成一次 Codex 请求后刷新 |
| 查询暂不可用 | app-server 不可用或 Codex 未安装 | 稍后重试；检查 Codex 是否已安装，或设置 `CODEX_CLI_PATH` |
| 未找到 Codex 可执行文件 | 常见安装位置与 `PATH` 都没有 `codex` | 设置 `CODEX_CLI_PATH`，或重新安装 Codex 桌面应用 |
| 账本文件损坏，已从上一份备份恢复 | 正式账本不可读，已回退到 `.bak` | 无需操作；若反复出现，检查磁盘与杀毒软件 |

## 运行日志

设置菜单 →「运行日志 → 打开」会打开数据目录下的 `logs/`：

- `runtime.log`：服务进程的缺陷与堆栈，2 MB 上限并轮转；
- `supervisor-stderr.log`：跟随组件的 stderr，超过 2 MB 后丢弃。

反馈问题时附上最近一段即可。日志写入前会脱敏 Authorization、Bearer、`api_key`、`token`、`secret`、`password`、`sk-*` 和 URL 内嵌凭据。

## MCP 工具不可用

1. 新开一个 Codex 会话，让模型调用 `whale_status`。
2. 仍不可用：确认 `.mcp.json` 使用相对路径 `./runtime/mcp.mjs` 和 `"cwd": "."`，不是 `${CLAUDE_PLUGIN_ROOT}`。
3. 重启 Codex，让它重新读取插件清单。

## API 配置坏了但订阅额度还要看

配置解析失败不应影响订阅额度、`/api/status` 或 token 记账。`/api/status` 的 `provider.apiError` 会给出具体原因；余额与 API 模型面板会继续报配置错误，这是预期行为。

## 设置环境变量后仍提示「未设置密钥」

Windows 的 `setx`、系统属性或 IDE 里新加的环境变量，只对之后启动的进程生效；已经在运行的挂件继承的是旧环境。

1. 保存配置后，点设置里的「重新启动小龙娘」；
2. 或退出挂件后重新打开；
3. 仍不行时，确认变量名拼写一致、没有多余空格，并在同一个 Windows 用户下设置。

挂件不会把密钥写进配置或日志，只读取变量名对应的值。

## 服务商配置损坏或回退版本

`providers.json` 是 Codex 当前 API 设置与 DIY 模型注册表共用的唯一存储。文件损坏时：

1. 启动时会尝试从 `providers.json.bak` 自动恢复，`/api/status` 的 `provider.configWarning` 会给出提示；
2. 主文件和备份都损坏时，订阅额度与 token 记账仍可用，但 API 设置会显示具体的配置错误；
3. 需要手动恢复时，在仓库或安装目录运行：

```bash
npm run restore-providers
```

它会从 `providers.json.bak`（或首次迁移留下的 `providers.legacy-backup.json`）恢复**两部分**配置。旧版 `api-settings.json` / `api-models.json` 不会被删除，回退到旧版本时仍可读取。

账本从备份恢复后，用量面板和消费记录窗口会显示一次「账本文件损坏，已从上一份备份恢复」，点「知道了」后不再提示。

## 测试数量与已知失败

当前结果见 [验证基线](BASELINE.md)。非 UTC+8 主机上会有 3 条时区相关测试失败，属于已知环境差异，不代表产品回归。
