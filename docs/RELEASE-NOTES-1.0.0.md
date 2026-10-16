# pagenote v1.0 — Windows 正式版 / Windows stable

Windows v1.0 按项目发起人确认的分级质量门槛正式冻结。发起人已在一台 Windows 真机完成全量测试并批准发布。正式版不表示零 Bug，也不表示所有环境均已验证。macOS 适配保留为测试版，其构建版本为 1.0.0-beta.1。

本版包含双栏逐页阅读、Markdown 公式与 Mermaid、本地图片、AI Tag 与 MCP 按需读取、提示词管理、OCR 和项目迁移。集成 Mac 适配与验收贡献，恢复文件菜单中的版本历史入口，保留公式跨行输入兼容及回归测试。

## 下载与升级

Windows 下载 setup.exe 安装，或将 ZIP 完整解压后运行 pagenote.exe。源代码 ZIP 用于自行修改和构建，不是免安装软件包。升级前完全退出旧程序并备份项目，不要仅替换 EXE。

此前 2.0 beta/RC 属于开发阶段编号；本次按发起人决定以 1.0.0 作为首个正式版，需手动安装。旧包继续保留，不更换原有文件内容。项目与用户数据仍使用现有 pagenote 目录。

当前包未签名；历史安装包曾被火绒检测，厂商复核尚无结论。完整风险列表见 KNOWN_ISSUES.md，当前放行依据见 docs/RELEASE-POLICY.md。Mac 未作为正式平台放行，不承诺本次 Release 包含 Mac 二进制。

## English

Windows v1.0 is stable under the founder-approved early-stage release baseline, based on their reported full test on a physical Windows computer. macOS remains experimental (1.0.0-beta.1 builds). Stable is not a zero-bug or all-environments claim.

Includes page-linked reading and Markdown notes, math/Mermaid/images, AI Tags/MCP, prompt management, local OCR, portable projects, the restored version-history menu, and contributor acceptance improvements. Exit the old app and back up projects before installing or extracting the entire ZIP. The earlier 2.0 beta numbering is intentionally replaced by the first stable 1.0 release; upgrade manually.

Packages are unsigned. A historical installer was flagged by Huorong without a completed vendor review. See KNOWN_ISSUES.md for pending work and docs/RELEASE-POLICY.md for the release decision. Mac binaries are not promised in this Windows release.
