const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { moveFile } = require('./file-ops.cjs');
const modules = [
  {
    id: 'tag-edit',
    folder: 'pagenote-tag-edit',
    title: 'AI Tag 修改',
    when: '按AI Tag、批注或圈选要求修改已有内容',
  },
  {
    id: 'learning',
    folder: 'pagenote-learning',
    title: '学习讲解',
    when: '解释、教学或重讲文档知识',
  },
  {
    id: 'page-tutor',
    folder: 'pagenote-page-tutor',
    title: '逐页精讲',
    when: '按页讲解；含并行调度与相邻源页上下文',
  },
  {
    id: 'output',
    folder: 'pagenote-output',
    title: '输出格式',
    when: '生成或修改含公式、代码、图表、图片的笔记',
  },
  {
    id: 'learner',
    folder: 'pagenote-learner',
    title: '学习背景',
    when: '需要采用用户明确提供的基础、目标和偏好',
  },
];
const entry = `先读取本索引，根据本次任务选择模块，不一次加载所有提示词。记住已读取模块的id和revision；索引版本未变且正文仍在上下文中时直接复用。版本变化、尚未读取或上下文已丢失时，用page_notes_read_prompt按id读取，可传knownRevision跳过未变化正文。只有版本号而没有正文记忆时，不传knownRevision。用户当前要求优先；摘要、翻译等其他任务按用户要求执行，不强套逐页教学。逐页任务读取learning、page-tutor、output；已有学习背景需要处理时再读learner。`;
const routes = [
  {
    task: '初始生成或补充指定页讲解',
    modules: ['learning', 'page-tutor', 'output'],
    first: '读取用户范围与当前/相邻源页；不要先读取全部历史讲稿',
  },
  {
    task: '按AI Tag或批注修改',
    modules: ['tag-edit', 'output'],
    first: '读取待处理AI批注及目标页已有笔记；需要重讲时再读learning',
  },
  {
    task: '普通文稿修改或格式修复',
    modules: ['output'],
    first: '定位用户指定段落并读取现有内容；不自动重生成整章',
  },
  {
    task: '摘要、翻译、查阅或其他任务',
    modules: [],
    first: '直接依照本次用户要求，按需使用文档工具',
  },
];
function createPromptStore(skillsRoot, data) {
  const file = path.join(data, 'ai-prompts.json');
  const overrides = () => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return {};
      throw e;
    }
  };
  function read(id, knownRevision) {
    const item = modules.find((m) => m.id === id);
    if (!item) {
      const e = Error('Unknown prompt module');
      e.status = 404;
      throw e;
    }
    const defaultText = fs.readFileSync(
      path.join(skillsRoot, item.folder, 'SKILL.md'),
      'utf8',
    );
    const text = overrides()[id] ?? defaultText;
    const revision = createHash('sha256').update(text).digest('hex');
    return {
      ...item,
      revision,
      unchanged: knownRevision === revision,
      ...(knownRevision === revision ? {} : { text }),
      defaultText,
    };
  }
  function index() {
    const items = modules.map((m) => {
      const v = read(m.id);
      return { ...m, revision: v.revision };
    });
    return {
      entry,
      routes,
      revision: createHash('sha256')
        .update(entry + JSON.stringify(routes) + JSON.stringify(items))
        .digest('hex'),
      modules: items,
    };
  }
  async function save(id, text) {
    read(id);
    if (text !== null && (typeof text !== 'string' || text.length > 32768)) {
      const e = Error('Prompt must be text of at most 32768 characters');
      e.status = 400;
      throw e;
    }
    const saved = overrides();
    if (text === null) delete saved[id];
    else saved[id] = text;
    await fs.promises.mkdir(data, { recursive: true });
    const temp = file + '.' + require('node:crypto').randomUUID() + '.tmp';
    await fs.promises.writeFile(temp, JSON.stringify(saved, null, 2));
    await moveFile(temp, file);
    return read(id);
  }
  return { read, index, save };
}
module.exports = { createPromptStore, modules, entry };
