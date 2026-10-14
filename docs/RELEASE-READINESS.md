# pagenote 2.0.0-beta.4 — 发布准备 / Release readiness

检查日期 / Checked: 2026-10-15. 本报告描述本机检查结果，不等于完整安全审计或商业验收。 / Local validation is not a full security audit or commercial acceptance test.

## 完成 / Completed

- 源码、公开仓库与软件名称统一为 pagenote；发行包只包含软件及合成测试样例，不包含个人论文与笔记。 / Source, repository and product use the pagenote name; distributions exclude private papers and notes.
- 统一 pagenote 品牌、图标、版本与中英文术语；语言切换持久保存，文档和用户笔记不翻译。 / Brand, icon, version and bilingual terminology standardized; UI language persists without translating user content.
- 统一源码格式、锁文件、发布测试、Windows 构建工作流、MIT 许可和第三方许可清单。 / Formatting, lockfile, release tests, Windows workflow and license notices prepared.
- 安装向导使用按用户安装，可选择目录；ZIP 必须整体解压。项目使用 `project.pagenote` 和 `src/` 相对链接，兼容旧项目格式。 / Per-user wizard installer and full ZIP distribution; portable project links and legacy project compatibility.
- PDF.js 更新至 6.4.299，KaTeX 为 0.18.7；PDF 阅读关闭脚本与 eval。 / PDF.js and KaTeX updated; PDF scripting/eval disabled.
- 生产依赖 npm audit 报告为 0 条已知漏洞；完整依赖报告仍有 8 项中危，均来自打包工具依赖链。 / Production npm audit reports zero known advisories; full dependency audit retains eight moderate findings in the build-tool chain. See [production audit](audit-production.json) and [full audit](audit-all.json). This is not a guarantee of safety.

参考 / References: [PDF.js advisory](https://github.com/advisories/GHSA-hq66-cqwq-w95j), [KaTeX advisory](https://github.com/advisories/GHSA-238p-pmpm-9mq7), [build-tool dependency advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).

## 验证范围 / Validation scope

发布测试覆盖：原生菜单、左右导入、选择编辑区域、工具展开/收起、框选与 Tag、Tag 定位/删除、项目保存/移动/重开、附件还原、非法相对链接拒绝、中英文切换和重启持久化、用户内容保持、代码实时高亮、公式、Mermaid、表格及保存后重开。 / Release tests cover native menus, imports, pane editing, annotation tools, tag placement/deletion, project round trips/assets/link validation, language persistence/content preservation, live code highlighting, math, Mermaid and tables.

打包后的原生程序已通过上述界面、项目与 Markdown 测试；MCP 验证通过 17 个工具发现、令牌校验、读写/冲突处理、布局持久化、隐藏截图、长笔记截图、多页拼图，以及软件重启后同一客户端重连。迁移测试确认已有新版文档不被覆盖、旧数据保持不变。 / The packaged native runtime passed the UI, project and Markdown tests. MCP validation passed tool discovery, token checks, read/write/revision conflict handling, layout persistence, hidden/long-note screenshots, contact sheets and reconnection across desktop restarts. Legacy migration preserves both existing new data and the old store.

## 公开发布前仍需完成 / Remaining before public release

- 有效发行者代码签名；当前 EXE 未签名。旧版火绒报毒尚未得到厂商误报确认，新版未取得厂商复核报告。 / Publisher signing and antivirus vendor review remain pending. The prior Huorong detection has not been confirmed as a false positive; this build has no vendor clearance.
- 独立 Windows 账户或干净虚拟机的安装、升级、卸载与验收；Windows ARM64、macOS、Linux 未验证。 / Independent account/clean-VM install, upgrade, uninstall and acceptance testing; other platforms unvalidated.
- 多版本 Office、复杂表格/图片/大文件、长时间编辑及断电恢复压力测试；Word/PPT 转换依赖本机已授权 Office。 / Multiple Office versions, complex documents, large files, long sessions and power-loss recovery require further validation; Office is required for Word/PPT conversion.
- 清理或隔离打包工具依赖链公告，独立安全审计、全部第三方字体/二进制许可核查。仓库已启用 GitHub 私密漏洞报告。 / Build-tool advisory remediation/isolation, independent security review and complete font/binary license review remain; GitHub private vulnerability reporting is enabled.
- 部分底层转换/系统错误保留原始诊断语言；双语界面不翻译用户文稿。 / Some low-level Office/system diagnostics retain their original language; user content is intentionally preserved.

因此本次交付为可安装和测试的 **beta 发布候选**，不应描述为已经完成全部商业化验收。 / This is an installable beta candidate, not a fully commercially validated product.


本轮 beta.2：双页知识拆解图标、多尺寸 ICO、Typora 菜单参照、系统默认应用编辑；本机 Word 实体 Delete/Undo/Save 与笔记保留已通过验证。本轮打包版本已重新通过全部发布测试及 MCP 17 工具、截图、拼图和重启重连检查。 / Beta.2 adds the paired-page icon and default-app source editing; physical Word Delete/Undo/Save were verified. The packaged beta.2 runtime passed the complete release suite and MCP checks for 17 tools, screenshots, collages and restart reconnection.

beta.3 增加 Windows EXDEV 迁移与文件替换回退、加密文件跨盘流式复制，以及空请求体项目同步修复。回退复制发生中断时保留恢复数据；它不提供与原子重命名完全相同的断电保证。 / Beta.3 adds EXDEV migration/replacement fallbacks, streamed encrypted-file copies and project sync with an empty request body. Copy fallback retains recovery data but does not provide atomic-rename power-loss guarantees.

beta.3 的打包程序已重新通过完整发布测试、MCP 17 工具及截图/拼图/重启重连测试；本机 Word 实体 Delete、Ctrl+Z、Ctrl+S、默认应用打开和保存后刷新验证通过。文件操作测试覆盖正常替换、EXDEV、失败恢复、流式复制和中断迁移继续；本机加密目录的项目读写另外验证通过。生产依赖公告为 0，全依赖仍为 8 项中危。 / The packaged beta.3 runtime passed the release suite, MCP checks and the local Word keyboard/default-app/save-refresh test. File tests cover replacements, EXDEV, recovery, streamed copies and migration resumption; encrypted-profile project reads/writes were additionally checked. Production advisories: zero; full dependency tree: eight moderate.
