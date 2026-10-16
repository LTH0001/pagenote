export function createAITools({ annotations, isReading, hasDocument, toast }) {
  const tools = document.createElement('div');
  tools.id = 'aiSharedTools';
  tools.innerHTML =
    '<button data-ai-pointer="mouse" class="selected" title="选中文字并打 Tag">鼠标</button><button data-ai-pointer="hand" title="拖动页面">抓手</button><details class="compact-menu"><summary data-ai-pointer="pen">笔</summary><div class="menu-popover"><button data-ai-pen="black">笔</button><button data-ai-pen="highlight">荧光笔</button><button data-ai-pen="erase">橡皮擦</button><label>颜色 <input id="aiPenColor" type="color" value="#222222"></label><label>粗细 <input id="aiPenWidth" type="range" min="1" max="12" value="3"></label></div></details>';
  document.body.append(tools);
  let pointer = 'mouse',
    pen = 'pen',
    color = '#222222',
    width = 3;
  function choose(next) {
    pointer = next;
    document.body.dataset.aiPointer = next;
    document.querySelector('#selectionTag').hidden = true;
    tools
      .querySelectorAll('[data-ai-pointer]')
      .forEach((b) =>
        b.classList.toggle('selected', b.dataset.aiPointer === next),
      );
    if (isReading() && hasDocument()) {
      annotations.activate(next === 'pen' ? 'both' : null);
      if (next === 'pen') annotations.setPen(pen, color, width);
    }
  }
  tools
    .querySelectorAll('[data-ai-pointer]')
    .forEach((b) =>
      b.addEventListener('click', () => choose(b.dataset.aiPointer)),
    );
  tools.querySelectorAll('[data-ai-pen]').forEach(
    (b) =>
      (b.onclick = () => {
        const kind = b.dataset.aiPen;
        pen = ['highlight', 'water'].includes(kind)
          ? 'highlight'
          : kind === 'erase'
            ? 'erase'
            : 'pen';
        color =
          kind === 'highlight'
            ? '#f2d34f'
            : kind === 'pencil'
              ? '#777777'
              : kind === 'water'
                ? '#2682bd'
                : '#222222';
        width =
          kind === 'highlight'
            ? 10
            : kind === 'pencil'
              ? 1.5
              : kind === 'fountain'
                ? 4
                : kind === 'water'
                  ? 6
                  : 3;
        tools.querySelector('#aiPenColor').value = color;
        tools.querySelector('#aiPenWidth').value = width;
        const output = tools.querySelector('#aiPenWidthValue');
        if (output) output.textContent = width;
        choose('pen');
        tools.querySelector('details').open = false;
      }),
  );
  tools.querySelector('#aiPenColor').oninput = (e) => {
    color = e.target.value;
    choose('pen');
  };
  tools.querySelector('#aiPenWidth').oninput = (e) => {
    width = Number(e.target.value);
    choose('pen');
  };
  for (const id of ['documentScroll', 'noteScroll']) {
    const scroller = document.getElementById(id);
    scroller.addEventListener(
      'pointerdown',
      (e) => {
        if (
          pointer !== 'hand' ||
          !isReading() ||
          e.button !== 0 ||
          e.target.closest('.ai-workbench')
        )
          return;
        e.preventDefault();
        scroller.setPointerCapture(e.pointerId);
        const x = e.clientX,
          y = e.clientY,
          left = scroller.scrollLeft,
          top = scroller.scrollTop;
        const move = (m) => {
          scroller.scrollLeft = left + x - m.clientX;
          scroller.scrollTop = top + y - m.clientY;
        };
        const end = () => {
          scroller.removeEventListener('pointermove', move);
          scroller.removeEventListener('pointerup', end);
          scroller.removeEventListener('pointercancel', end);
        };
        scroller.addEventListener('pointermove', move);
        scroller.addEventListener('pointerup', end);
        scroller.addEventListener('pointercancel', end);
      },
      true,
    );
  }
  function refresh() {
    tools.hidden = !isReading();
    if (isReading()) {
      const box = document.body.dataset.aiPointer === 'rect';
      choose(pointer);
      if (box) {
        annotations.activate('both');
        annotations.setPen('rect', '#f2d34f', 2);
        document.body.dataset.aiPointer = 'rect';
      }
    }
  }
  const mousePanel = document.createElement('div');
  mousePanel.className = 'mouse-options';
  mousePanel.hidden = true;
  mousePanel.innerHTML =
    '<button data-mouse-mode="text">文字选择</button><button data-mouse-mode="rect">框选</button>';
  tools.append(mousePanel);
  const mouseButton = tools.querySelector('[data-ai-pointer=mouse]');
  mouseButton.setAttribute('aria-haspopup', 'true');
  function showMousePanel(open) {
    mousePanel.hidden = !open;
    mouseButton.setAttribute('aria-expanded', String(open));
  }
  showMousePanel(false);
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!tools.contains(event.target)) showMousePanel(false);
    },
    true,
  );
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') showMousePanel(false);
  });
  mousePanel.querySelectorAll('button').forEach(
    (b) =>
      (b.onclick = () => {
        choose('mouse');
        if (b.dataset.mouseMode !== 'text') {
          annotations.activate('both');
          annotations.setPen(
            b.dataset.mouseMode,
            '#f2d34f',
            b.dataset.mouseMode === 'rect' ? 2 : 10,
          );
          document.body.dataset.aiPointer = 'rect';
        }
        showMousePanel(false);
      }),
  );
  tools
    .querySelector('[data-ai-pointer=mouse]')
    .addEventListener('click', () => showMousePanel(mousePanel.hidden));
  tools
    .querySelector('[data-ai-pointer=hand]')
    .addEventListener('click', () => showMousePanel(false));
  tools
    .querySelector('[data-ai-pointer=pen]')
    .addEventListener('click', () => showMousePanel(false));
  const icons = {
    mouse: 'M5 3l13 9-7 1-3 6z',
    hand: 'M7 11V5a2 2 0 014 0v6V4a2 2 0 014 0v8V6a2 2 0 014 0v9c0 5-3 7-7 7-3 0-6-2-8-6l-2-4a2 2 0 013-2l2 3',
    pen: 'M4 20l4-1L20 7l-4-4L4 15z M14 5l4 4',
  };
  tools
    .querySelectorAll('[data-ai-pointer]')
    .forEach(
      (b) =>
        (b.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' +
          icons[b.dataset.aiPointer] +
          '"/></svg><span>' +
          b.textContent +
          '</span>'),
    );
  const optionIcons = {
    black: 'M4 20l4-1L20 7l-4-4L4 15z M14 5l4 4',
    highlight: 'M4 18l3-5 9-9 4 4-9 9-5 3z M3 21h12',
    erase: 'M4 14l9-10 7 7-9 10H8z M8 11l7 7',
    text: 'M5 5h14 M12 5v14 M8 19h8',
    rect: 'M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5',
  };
  tools.querySelectorAll('[data-ai-pen],[data-mouse-mode]').forEach((b) => {
    const label = b.textContent;
    b.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' +
      optionIcons[b.dataset.aiPen || b.dataset.mouseMode] +
      '"/></svg><span>' +
      label +
      '</span>';
  });
  const value = document.createElement('output');
  value.id = 'aiPenWidthValue';
  value.textContent = width;
  tools.querySelector('#aiPenWidth').after(value);
  tools
    .querySelector('#aiPenWidth')
    .addEventListener(
      'input',
      () => (value.textContent = tools.querySelector('#aiPenWidth').value),
    );
  document.body.dataset.aiPointer = 'mouse';
  return { refresh };
}
