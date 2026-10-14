export function createAIWorkbench({
  getRecords,
  edit,
  add,
  select,
  region,
  savePosition,
  toast,
}) {
  const boards = {};
  let currentSide = 'note';
  for (const side of ['document', 'note']) {
    const pane = document.querySelector(
      side === 'document' ? '.document-pane' : '.note-pane',
    );
    const board = document.createElement('section');
    board.className = 'ai-workbench';
    board.dataset.side = side;
    board.innerHTML = `<button class="board-handle" aria-expanded="false">⌃ ${side === 'document' ? '原文' : '笔记'} · AI 改进工作台 <span class="board-count">0</span></button><div class="board-body"><header><strong>改进点</strong><button class="board-add">＋ 新增改进点</button><button class="board-close" aria-label="收起工作台">⌄</button></header><div class="board-viewport"><div class="board-canvas"></div></div></div>`;
    pane.append(board);
    boards[side] = board;
    let dragged = false;
    const handle = board.querySelector('.board-handle');
    handle.onclick = () => {
      if (dragged) {
        dragged = false;
        return;
      }
      open(side, !board.classList.contains('open'));
    };
    handle.onpointerdown = (e) => {
      dragged = false;
      const y = e.clientY;
      handle.setPointerCapture(e.pointerId);
      handle.onpointermove = (m) => {
        if (y - m.clientY > 12) {
          dragged = true;
          open(side, true);
          board.style.setProperty(
            '--board-height',
            Math.min(
              pane.clientHeight - 90,
              Math.max(150, pane.getBoundingClientRect().bottom - m.clientY),
            ) + 'px',
          );
        }
      };
      handle.onpointerup = () => {
        handle.onpointermove = null;
      };
    };
    board.querySelector('.board-close').onclick = () => open(side, false);
    board.querySelector('.board-add').onclick = () => add(side);
    const viewport = board.querySelector('.board-viewport');
    viewport.onpointerdown = (e) => {
      if (e.target.closest('.improvement-card')) return;
      const x = e.clientX,
        y = e.clientY,
        left = viewport.scrollLeft,
        top = viewport.scrollTop;
      viewport.setPointerCapture(e.pointerId);
      viewport.onpointermove = (m) => {
        viewport.scrollLeft = left + x - m.clientX;
        viewport.scrollTop = top + y - m.clientY;
      };
      viewport.onpointerup = () => (viewport.onpointermove = null);
    };
  }
  function open(side, value = true) {
    currentSide = side;
    const board = boards[side];
    board.classList.toggle('open', value);
    board.classList.toggle('revealed', value);
    board
      .querySelector('.board-handle')
      .setAttribute('aria-expanded', String(value));
  }
  function render() {
    for (const [side, board] of Object.entries(boards)) {
      const records = getRecords().filter(
          (r) => r.side === side && r.status !== 'dismissed',
        ),
        canvas = board.querySelector('.board-canvas');
      board.querySelector('.board-count').textContent = records.length;
      canvas.replaceChildren();
      let width = 1000,
        height = 700;
      records.forEach((record, index) => {
        const position = record.boardPosition || {
          x: 32 + (index % 3) * 290,
          y: 24 + Math.floor(index / 3) * 240,
        };
        const card = document.createElement('article');
        card.className = 'improvement-card';
        card.dataset.recordId = record.id;
        card.oncontextmenu = (e) => {
          e.preventDefault();
          document.dispatchEvent(
            new CustomEvent('review-context', {
              detail: { record, x: e.clientX, y: e.clientY },
            }),
          );
        };
        card.style.left = position.x + 'px';
        card.style.top = position.y + 'px';
        const title = document.createElement('header');
        title.textContent = `${record.number} 号 · ${record.kind === 'overall' ? '整体要求' : '第 ' + record.page + ' 页'}`;
        const quote = document.createElement('blockquote');
        quote.textContent = record.quote || '整体风格与内容';
        const text = document.createElement('p');
        text.textContent = record.instruction;
        const status = document.createElement('small');
        status.textContent =
          record.status === 'applied' ? 'AI 已处理' : '待 AI 处理';
        const editButton = document.createElement('button');
        editButton.textContent = '查看 / 修改';
        editButton.onclick = () => edit(record);
        card.append(title, quote, text, status, editButton);
        canvas.append(card);
        width = Math.max(width, position.x + 330);
        height = Math.max(height, position.y + 300);
        title.onpointerdown = (e) => {
          e.preventDefault();
          title.setPointerCapture(e.pointerId);
          const origin = {
            x: e.clientX,
            y: e.clientY,
            left: parseFloat(card.style.left),
            top: parseFloat(card.style.top),
          };
          title.onpointermove = (m) => {
            card.style.left =
              Math.max(0, origin.left + m.clientX - origin.x) + 'px';
            card.style.top =
              Math.max(0, origin.top + m.clientY - origin.y) + 'px';
            canvas.style.width =
              Math.max(width, parseFloat(card.style.left) + 330) + 'px';
            canvas.style.height =
              Math.max(height, parseFloat(card.style.top) + 300) + 'px';
          };
          title.onpointerup = () => {
            title.onpointermove = null;
            savePosition(record, {
              x: parseFloat(card.style.left),
              y: parseFloat(card.style.top),
            }).catch((e) => toast(e.message));
          };
        };
      });
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    }
  }
  const popup = document.createElement('button');
  popup.id = 'selectionTag';
  popup.textContent = '打 Tag';
  popup.hidden = true;
  document.body.append(popup);
  let selectedRange = null,
    selectedRegion = null;
  document.addEventListener('ai-box-tag', (e) => {
    selectedRange = null;
    selectedRegion = e.detail;
    const host =
        e.detail.side === 'document'
          ? document.querySelector(
              '.document-sheet[data-page="' + e.detail.page + '"]',
            )
          : document.querySelector('#noteBody'),
      r = host.getBoundingClientRect(),
      pts = e.detail.shape.points;
    popup.style.left =
      Math.min(
        innerWidth - 100,
        r.left + (Math.max(...pts.map((p) => p[0])) * r.width) / 1000,
      ) + 'px';
    popup.style.top =
      Math.max(
        8,
        r.top + (Math.min(...pts.map((p) => p[1])) * r.width) / 1000 - 34,
      ) + 'px';
    popup.hidden = false;
  });
  document.addEventListener('pointerup', (e) => {
    if (
      e.target.closest('#selectionTag,dialog,.ai-workbench,.review-marker') ||
      document.body.dataset.aiPointer === 'rect'
    )
      return;
    setTimeout(() => {
      const selection = getSelection(),
        range = selection?.rangeCount ? selection.getRangeAt(0) : null,
        element = selection?.anchorNode?.parentElement,
        pane = element?.closest('.document-pane,.note-pane');
      if (
        !pane ||
        !selection.toString().trim() ||
        document.querySelector('#noteBody').classList.contains('mode-edit') ||
        document.body.dataset.aiPointer === 'pen' ||
        document.body.dataset.aiPointer === 'hand'
      ) {
        popup.hidden = true;
        return;
      }
      selectedRegion = null;
      selectedRange = range.cloneRange();
      const rect = range.getBoundingClientRect();
      currentSide = pane.classList.contains('document-pane')
        ? 'document'
        : 'note';
      popup.style.left =
        Math.max(8, Math.min(innerWidth - 100, rect.right + 8)) + 'px';
      popup.style.top =
        Math.max(8, Math.min(innerHeight - 45, rect.top - 34)) + 'px';
      popup.hidden = false;
    }, 0);
  });
  popup.onpointerdown = (e) => e.preventDefault();
  popup.onclick = () => {
    popup.hidden = true;
    if (selectedRegion) {
      region(selectedRegion);
      selectedRegion = null;
      return;
    }
    if (selectedRange) {
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(selectedRange);
      select(selectedRange, currentSide);
    }
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') popup.hidden = true;
  });
  return {
    render,
    open,
    hide: () => {
      Object.keys(boards).forEach((side) => open(side, false));
    },
    get openSide() {
      return currentSide;
    },
    get isOpen() {
      return Object.values(boards).some((b) => b.classList.contains('open'));
    },
  };
}
