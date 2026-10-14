# Security

Do not post private documents, MCP connection files, tokens or signing credentials in public issues. Security reports should include a minimal redacted reproduction and affected version. Use [GitHub private vulnerability reporting](https://github.com/laihong06/pagenote/security/advisories/new) for security-sensitive reports.

The desktop renderer uses context isolation, sandboxing and disabled Node integration. Its HTTP service binds to 127.0.0.1 and restricts origins; AI calls require a local token. Markdown is sanitized, Mermaid uses strict rendering, and Office automation disables macros. These controls are a baseline, not a substitute for an independent security assessment.

Project files and AI context can contain sensitive information. Grant MCP access only to a trusted client. pagenote does not host an AI model; data passed to an external client is subject to its own handling.

If antivirus reports a build, retain the detection details and stop using it pending review. Do not disable protection, restore quarantined files without verification, or add an exclusion.

中文：请勿公开上传个人项目、MCP 密钥或签名凭据。安全问题通过上述私密报告入口提交。正式发布前应完成独立安全评估。报毒不应直接视为误报；保留日志、停止使用并由厂商复核。
