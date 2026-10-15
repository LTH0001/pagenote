export const teachingPolicy = `逐页精讲要求 / Page-by-page teaching:
为整份文档生成详解时，每一页必须作为一次独立的模型讲解请求处理。不要在同一次长输出中生成整章再按页切开；每次请求只生成当前页，完成、校对、保存后再处理下一页。批量读取、批量写入是数据工具，不代表可以用一次模型生成代替多次逐页请求。
每页请求携带当前页完整原文与必要截图、学习者基础和目标、全章简短路线、上一页知识交接及当前相关定义；可读取相邻页辅助衔接。按页充分使用可用上下文，控制摘要长度，为当前页的符号解释、推导、例子和适用条件留足空间。避免只列摘要，使用陈述性讲解。
每页先自然承接已有知识，再逐层展开当前内容，最后简短过渡到下一页；记录已讲概念、符号约定、例子与待解问题，交给下一页请求。校对页码和原文，辨明课件内容、补充解释及原文错误。根据内容选择公式、可运行代码、Mermaid 或图片，不为凑形式堆砌。保存后用截图检查渲染；修改前读取 revision。
Use a separate model generation request for each source page. Never generate the entire chapter in one long answer and split it afterward. Supply the complete current page, relevant screenshots, learner level, a short chapter map and the preceding page's handoff. Explain the current page fully, connect it to prior knowledge and leave a concise handoff for the next request. Verify, save and inspect each page before continuing.
MCP itself cannot start model requests or control a client's context window. If the client cannot make independent requests, state that limitation and proceed one page per user turn; never claim independent requests were made when they were not.`;
