> Current policy / 当前准则：以 [发起人确认的分级发布基准](RELEASE-POLICY.md) 为准。本文的历史验收条目不自动阻塞 Windows v1.0；未完成的非阻断工作记入 [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)。

# 2.0.0-rc.1 候选冻结范围

基线为已发布的 `v2.0.0-beta.5`，提交 `d5bc5f3144fdf1e417d28e174ca9149123469081`。

本 fork 的 `release/2.0` 只接受阻断验收的问题修复、测试同步和发布说明，不新增产品功能。功能开发继续使用开发分支；上游的分支保护和正式发布决定由维护者控制。

RC.1 修正英文 Windows 测试等待中文状态文字的超时，更新连续阅读用例，并等待批注卡片完成异步刷新。恢复隐藏旧工具栏后丢失的原生版本历史入口。这些是验收发现的问题修复，未增加产品功能。

候选包版本为 `2.0.0-rc.1`，与 beta.5 区分，不覆盖已发布的 beta.5 二进制。README 下载链接继续指向公开版 beta.5；本地候选包不冒充公开 Release。

签名、杀毒复核、独立无开发环境的 Windows 电脑、Office 有/无两组验收和最终正式包复测仍然是正式放行前置条件。尚未完成的项目标为未测试。

验收模板见 [独立终端验收](RC-INDEPENDENT-ACCEPTANCE.md)。历史的 beta.5 测试完备性审查保留为原始失败证据，候选版结果另行记录，不覆盖原始失败。

测试命令：

```powershell
npm run test:release
npm run test:english
npm run test:mcp
npm run test:prepared
npm run test:acceptance
npm run test:soak
```

`test:soak` 默认 60 分钟，使用合成 60 页 PDF、独立 profile，记录进程工作集和确认保存后的重开结果，不使用真实课件。它是自动化稳定性证据，不能代替独立用户真实阅读体验。

CI 的 `Soak harness restart smoke` 仅运行 0.2 分钟，用于检查测试脚本及 60 页重开断言；该步骤通过不代表一小时稳定性验收通过。本机长测中断仍需单独记录和诊断。
