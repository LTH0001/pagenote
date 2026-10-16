> Current policy / 当前准则：以 [发起人确认的分级发布基准](RELEASE-POLICY.md) 为准。本文的历史验收条目不自动阻塞 Windows v1.0；未完成的非阻断工作记入 [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)。

# Pagenote 2.0 RC 测试完备性审查

日期：2026-10-16。结论：自动化基础较好，但当前发布门槛没有全部通过，尚不足以认定 RC 验收完成，更不能直接判为正式版可发布。

## 1. 版本与证据边界

- GitHub 上游：`laihong06/pagenote`。
- 本地源码已经 fetch 到最新 main：`62d3a51f59dbb383a0ff536ce94e98685f6c0595`，版本 `2.0.0-beta.5`；审计分支 `audit/rc-readiness`。测试前后均核对该提交；没有用旧开发分支的结果替代本轮结果。
- GitHub Releases 列表核对：最新公开安装版仍为 `v2.0.0-beta.4`，尚无公开 beta.5/RC 安装包。本机运行目录 `D:\pagenote` 的 `resources/app.asar/package.json` 也是 `2.0.0-beta.4`，因此本机已是最新公开发行版。EXE 文件属性 `2.0.0.0` 不包含完整预发布标识，不能用来区分 beta。
- 本轮测试使用从最新 main 新构建的 beta.5 程序，未覆盖安装用户正在使用的 beta.4，也没有把源码构建伪称为 GitHub 已发布的包。
- 测试包与安装版关键源文件 SHA256 不同，记录在 `output/rc-audit-2026-10-16/installed-comparison.json`。
- 全部动态测试在当前同一台开发电脑完成，使用测试 profile。不是无 Node/Python 的独立终端、不是干净 VM，也不是另一名测试者的真实客户端验收。
- 未修改产品功能或测试断言来制造通过；没有创建 RC tag、发布 Release 或实际冻结上游功能。

## 2. 本轮执行结果

|项目|结果|证据|
|---|---|---|
|干净重装 node_modules|通过 `npm ci --ignore-scripts`，测试入口另准备 Electron|依赖安装成功；不是干净 Windows 环境|
|源码构建|通过|`output/rc-audit-2026-10-16/build.log`|
|格式检查|通过|`output/rc-audit-2026-10-16/format.log`|
|生产依赖公告|0 条|`audit-production.json`；不等价于杀毒/安全审计|
|完整依赖公告|8 条 moderate|`audit-all.json`；应评估和记录，不执行未经评估的强制升级|
|标准 `npm run test:release`|失败，在 menus 中止|`source-release.log`|
|源码逐项补跑与已完成前置测试|20 个不同脚本：18 通过，2 失败|前置 7 项结果在 `source-release.log`；后续 12 项在 `source-results.json`；另有 menus 失败|
|安装包与 ZIP 构建|成功生成，但仅为本地审计包|`package.log`|
|打包程序逐项测试|首轮 13 项：11 通过、2 失败；其中一项重试通过|`packaged-results.json` 与 `packaged-ai-workspace-retry.log`|
|ZIP 完整性|7-Zip 检查通过，169 文件、25 文件夹|`zip-integrity.log`|
|程序与安装包签名|均为 NotSigned|`signature.json`、`installer-signatures.json`|
|真正运行安装向导、覆盖升级、卸载重装|未测试|本轮没有改变实际安装和文件关联|
|厂商报毒复核/最终包杀毒结果|未完成|依赖公告和签名检查不能替代厂商结论|

这里的数量是测试脚本数，不是语句/分支覆盖率，也不是用户流程完成率。重试通过没有删除首轮失败。

源码已通过脚本：`project-launch`、`project-open`、`file-ops`、`external-project`、`external-documents`、`migration`、`ai-settings`、`box-tag`、`projects`、`i18n`、`math-input`、`formula-rendering`、`code-rendering`、`rich-editor`、`page-breaks`、`mcp`、`prepared`、`ai-workspace`。

源码失败脚本：`menus`、`continuous`。打包程序首轮失败脚本：`menus`、`ai-workspace`。

## 3. 已确认的问题

### R01：标准发布测试被失效文案断言阻断

- 位置：`tests/menus.mjs:54`。
- 现象：`assert.ok(copiedSkill.includes('不用“为什么”'))` 失败。最新提示词内容已经变化，测试仍依赖旧的固定短语。
- 源码与打包程序均出现相同失败。该失败本身不能证明菜单复制功能损坏；说明断言与当前契约不一致。
- 发布影响：package.json 的 `test:release` 使用 `&&`，遇到此失败就停止，后面测试不会自动继续。CI 中测试在打包前执行，所以当前门槛无法正常生成最终发布产物。
- 建议：按当前实际模板与约定验证复制结果，检查模板身份、模块引用和必要语义；不要仅删除断言。修正后完整跑通标准入口。

### R02：连续阅读测试尚未跟随新界面更新

- 位置：`tests/continuous.mjs:31`。
- 现象：等待 `[data-mode="edit"]` 点击超过 30 秒；该旧模式选择器已不在当前界面中。`tests/portable.mjs`、`tests/markdown.mjs` 等历史脚本也可见同类旧选择器；本轮不声称它们全部已经动态复测。
- 发布影响：无法依靠该脚本证明连续翻页、中线切页、未保存内容保持、缩放锚定等行为仍然正确；且该脚本未接入现有发布工作流。
- 建议：改为当前选择编辑区域的流程，保留原有行为断言，更新 ZIP/便携版旧文件名，再纳入有效的发布测试集合。

### R03：打包版 AI 工作台测试出现间歇失败

- 位置：`tests/ai-workspace.mjs:123`。
- 源码一次通过；打包程序首次期望 2 张 improvement-card，实际 1 张，退出码 1；独立测试 profile 的第二次运行通过。
- 暂不能断定数据丢失。脚本在对话框隐藏后立即数卡片，可能存在异步更新等待不足，也可能是产品层竞态；根因未确认。
- 建议：失败时保存工作台截图、DOM、后端记录与页面错误；明确等待持久化和界面刷新后再断言，并增加重开检查。针对触发路径重复执行，保留所有失败率，不能用简单重试隐藏问题。

### R04：批注/笔迹定位用例未纳入发布门槛

- `tests/ai-workspace.mjs` 有文字批注、笔迹、字号和分栏变化、Ctrl+滚轮与重开后的定位检查；本轮源码通过，但发现 R03。
- `package.json` 的 `test:release` 与 `.github/workflows/release.yml` 未运行这一脚本，也没有修复后的连续阅读用例。
- 建议：解决 R02/R03 后将这些核心阅读可靠性检查纳入源码及打包程序门槛。

### R05：安装包构建不等于安装流程验收

- `.github/workflows/release.yml` 对 `release/win-unpacked/pagenote.exe` 设置 `DESKTOP_EXE`，并未执行生成的 NSIS 安装包。
- 没有从旧公开安装版覆盖升级、文件关联注册、普通账户权限、卸载后重装的数据保持证据。
- `deleteAppDataOnUninstall: false` 是配置，不是用户数据保留的动态证据。
- 本轮成功生成并检查了包，但没有在用户正在使用的安装目录执行安装/卸载。需在快照 VM 和独立实体机执行完整生命周期测试。

### R06：签名与安全复核门槛仍未满足

- `package.json` 明确 `signExecutable: false`；本轮构建日志显示跳过签名，Authenticode 检查确认为 NotSigned。
- 没有同一 SHA256 安装包的火绒复核/厂商报告；生产依赖零公告、ZIP 无损或 EXE 能启动，都不能代替报毒复核。
- 正式发布前应验证最终分发文件的有效签名及时间戳，保存扫描与厂商结论。继续标为测试版，直到这些门槛完成。

### R07：独立验收记录和候选包身份尚未闭环

- 发布脚本会生成 SHA256SUMS，但没有包含设备矩阵、逐项状态、缺陷关闭、候选包复测、审批结论的强制记录。
- 构建脚本会把当前本机 Node 运行时复制到 MCP 包；CI 使用 Node 22，本轮为 Node 24.15.0。不能仅凭相同 Git 提交认定两个安装包相同。
- 本轮未比较两次独立构建的字节一致性，也不声称安装包已实现可复现构建。要区分“按说明可重复成功构建”与“产物字节级可复现”。
- 上游当前仅有 main 分支，未看到 `release/2.0`；没有 RC 范围冻结的分支与固定候选 tag。
- 已提供独立终端填写模板：`docs/RC-INDEPENDENT-ACCEPTANCE.md`。

## 4. 核心承诺到证据的映射

|核心流程|现有自动证据|仍需补齐|
|---|---|---|
|保存、重开、项目迁移、图片恢复|projects、external-project、migration、file-ops 通过|跨版本安装升级；全部附件/批注字节清单；保存中断、磁盘满和文件占用的端到端恢复|
|冷启动与运行中打开项目|project-launch/open 源码和打包版通过|操作系统真实双击关联；独立账户首次安装和跨版本注册|
|页码与逐页笔记对应|page-breaks 覆盖 52 空页、部分生成、CRLF；MCP 静默写入通过|连续阅读脚本失效；实际大课件、快速交错翻页、真实长期生成|
|缩放后批注、笔迹定位|ai-workspace 源码通过|打包首轮失败未定位；系统 DPI 125/150/200%、双屏、重排后不同锚点|
|公式、代码、Mermaid、表格和图片|formula/code/rich-editor 源码和打包通过，含离线和编辑保存|复杂真实课件、极长公式、大图和大文件；非法语法恢复|
|AI 修改不覆盖新编辑|MCP 验证错误 revision 拒绝、编辑锁、静默更新、客户端重连|真实外部客户端；未持久化编辑、多个客户端、取消与中途崩溃竞态；遗漏可选 expectedRevision 的风险|
|AI Tag 修改与 applied 状态|Tag 创建/定位/删除和 MCP 工具基础覆盖|从创建 Tag 到局部修改、持久化核对再标 applied 的完整闭环；重复文字、失效 anchor、失败时不误标成功|
|离线阅读与本地准备|字体/代码离线渲染；prepared 中英文 OCR、缓存与迁移通过|物理断网后全新进程打开真实项目；无 VC++ 环境下 OCR 明确提示|
|Word/PPT|external-documents 验证调用路由与转换 mock|不是实际 Office 多版本测试；有/无 Office 两组实机；复杂表格/图片/PPT 字体|
|外部 AI 不可用/额度不足|文档说明外部客户端依赖；MCP 重连测试|真实客户端断网/限额及面向用户的恢复路径；已有项目继续使用|
|安装升级卸载|成功生成 NSIS 与 ZIP，ZIP 完整性通过|安装、旧版覆盖升级、卸载重装、权限/文件占用、开始菜单与文件关联|
|安全发布|依赖公告、NotSigned 结果、已有安全限制说明|最终包签名、杀毒扫描及既往报毒厂商复核；不能把旧报告自动套用到新包|

## 5. 本轮审计包身份

仅供测试，非已发布 RC.1。目录 `release/`：

|文件|字节数|SHA256|
|---|---:|---|
|pagenote-2.0.0-beta.5-windows-x64-setup.exe|198109332|7961dd60e0e07687ad7459f57d0ce79535325eddf6772c449c082135f2cb7812|
|pagenote-2.0.0-beta.5-windows-x64.zip|266309984|af0c10184159f35986c80783d7d3aa65c7e72112a119243d831ce16285dd82e2|

文件夹程序测试不等于这个 NSIS 包实际安装后的验证。ZIP 的完整性通过也不代表防护软件不会拦截。

## 6. 进入 RC 的最短闭环

1. 明确首版范围，固定提交和 release 分支；把新增功能留在开发分支。
2. 修复 R01/R02 的失效测试，定位 R03 的间歇失败，补接 R04 核心检查；标准发布入口与打包入口均必须得到可重复的通过结果。
3. 以 `2.0.0-rc.1` 建立唯一候选包，记录 Git SHA、锁文件、Node/Electron 版本、构建任务和包 SHA256。
4. 用同一安装包完成独立电脑/干净 VM 的安装、升级、卸载、文件关联及真实课件验收；新增 OCR 的运行库依赖也纳入矩阵。
5. 完成一至两周稳定观察、最终签名与报毒复核。每个修复包建立新身份并复测受影响流程，保留首次失败和后续通过。
6. 维护者根据完整证据决定正式发布。版本号改成 2.0.0 或签名导致包变化时，至少重做最终包安装、启动、打开项目、保存重开和安全核验。

本报告只评估当前已检查范围，不能保证无 Bug。没有独立终端、真实升级和厂商结论的部分保持“未验证”，不填写为通过。
