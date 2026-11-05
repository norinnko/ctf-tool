'use strict';

const API_ENDPOINT = 'api/explain.php';

const state = {
  tools: [],
  categories: [],
  catMap: {},
  activeCat: 'all',
  query: '',
};

const els = {
  grid: document.getElementById('tool-grid'),
  tabs: document.getElementById('category-tabs'),
  search: document.getElementById('search'),
  count: document.getElementById('result-count'),
  empty: document.getElementById('empty-state'),
  reset: document.getElementById('reset-btn'),
  template: document.getElementById('card-template'),
};

const DIFF = {
  1: { label: '入門', color: 'var(--d1)' },
  2: { label: '中級', color: 'var(--d2)' },
  3: { label: '上級', color: 'var(--d3)' },
};

init();

async function init() {
  showSkeletons();
  try {
    const res = await fetch('data/tools.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.tools = data.tools || [];
    state.categories = data.categories || [];
    state.catMap = Object.fromEntries(state.categories.map(c => [c.id, c]));
  } catch (err) {
    els.grid.innerHTML =
      `<p class="empty-state">データの読み込みに失敗しました（${escapeHtml(err.message)}）。<br>data/tools.json を確認してください。</p>`;
    return;
  }
  renderTabs();
  bindEvents();
  render();
}

function bindEvents() {
  els.search.addEventListener('input', debounce(e => {
    state.query = e.target.value.trim().toLowerCase();
    render();
  }, 120));

  els.reset?.addEventListener('click', () => {
    state.query = '';
    state.activeCat = 'all';
    els.search.value = '';
    document.querySelectorAll('.tab').forEach(t =>
      t.classList.toggle('active', t.dataset.cat === 'all'));
    render();
  });
}

function renderTabs() {
  const counts = state.tools.reduce((m, t) => (m[t.category] = (m[t.category] || 0) + 1, m), {});
  const tabs = [{ id: 'all', label: 'すべて', color: 'var(--accent)' }, ...state.categories];

  els.tabs.innerHTML = '';
  tabs.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (cat.id === state.activeCat ? ' active' : '');
    btn.dataset.cat = cat.id;
    btn.setAttribute('role', 'tab');
    btn.style.setProperty('--tab-color', cat.color);
    const n = cat.id === 'all' ? state.tools.length : (counts[cat.id] || 0);
    btn.innerHTML =
      `<span class="dot"></span>${escapeHtml(cat.label)}<span class="count">${n}</span>`;
    btn.addEventListener('click', () => {
      state.activeCat = cat.id;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
    els.tabs.appendChild(btn);
  });
}

function getFiltered() {
  const q = state.query;
  return state.tools.filter(t => {
    if (state.activeCat !== 'all' && t.category !== state.activeCat) return false;
    if (!q) return true;
    const hay = [
      t.name, t.tagline, t.when_to_use,
      (t.use_cases || []).join(' '),
      (t.tags || []).join(' '),
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function render() {
  const list = getFiltered();
  els.grid.innerHTML = '';

  if (list.length === 0) {
    els.empty.hidden = false;
    els.count.innerHTML = '';
    return;
  }
  els.empty.hidden = true;
  els.count.innerHTML = `<b>${list.length}</b> 件のツール`;

  const frag = document.createDocumentFragment();
  list.forEach(t => frag.appendChild(buildCard(t)));
  els.grid.appendChild(frag);
}

function buildCard(tool) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  const cat = state.catMap[tool.category] || { label: tool.category, color: 'var(--accent)' };
  const diff = DIFF[tool.difficulty] || DIFF[1];

  node.style.setProperty('--card-accent', cat.color);

  node.querySelector('.tool-name').textContent = tool.name;

  const badge = node.querySelector('.cat-badge');
  badge.textContent = cat.label;

  const dEl = node.querySelector('.difficulty');
  dEl.style.setProperty('--diff-color', diff.color);
  dEl.title = `難易度: ${diff.label}`;
  for (let i = 1; i <= 3; i++) {
    const pip = document.createElement('span');
    pip.className = 'pip' + (i <= tool.difficulty ? ' on' : '');
    dEl.appendChild(pip);
  }
  const dLabel = document.createElement('span');
  dLabel.className = 'label';
  dLabel.textContent = diff.label;
  dEl.appendChild(dLabel);

  node.querySelector('.tagline').textContent = tool.tagline || '';
  node.querySelector('.when-text').textContent = tool.when_to_use || '';

  const ul = node.querySelector('.use-cases');
  (tool.use_cases || []).forEach(uc => {
    const li = document.createElement('li');
    li.textContent = uc;
    ul.appendChild(li);
  });

  const cmd = node.querySelector('.command');
  cmd.textContent = tool.command || '';
  const copyBtn = node.querySelector('.copy-btn');
  copyBtn.addEventListener('click', () => copyText(tool.command || '', copyBtn));

  const srcWrap = node.querySelector('.sources');
  (tool.sources || []).forEach(s => {
    const a = document.createElement('a');
    a.className = 'source-link';
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = s.label;
    srcWrap.appendChild(a);
  });

  const aiBtn = node.querySelector('.ai-btn');
  const aiOut = node.querySelector('.ai-output');
  aiBtn.addEventListener('click', () => handleAi(tool, aiBtn, aiOut));

  return node;
}

async function handleAi(tool, btn, out) {
  if (tool._ai) {
    toggleAi(out, tool._ai);
    return;
  }
  btn.disabled = true;
  const original = btn.innerHTML;
  btn.innerHTML = '<span class="ai-icon">✦</span> 解説を生成中…';
  out.hidden = false;
  out.classList.remove('error');
  out.innerHTML = '<span class="ai-tag">AI解説</span><span class="typing"></span>';
  const typingEl = out.querySelector('.typing');

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: tool.id,
        name: tool.name,
        category: (state.catMap[tool.category] || {}).label || tool.category,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.error || !data.text) {
      throw new Error(data.error || '解説の生成に失敗しました。');
    }
    tool._ai = data.text;
    btn.innerHTML = '<span class="ai-icon">✦</span> AI解説を表示/非表示';
    typeText(typingEl, data.text);
  } catch (err) {
    out.classList.add('error');
    out.innerHTML =
      `<span class="ai-tag">エラー</span>${escapeHtml(err.message)}<br><small>config.php のAPIキー設定を確認してください。</small>`;
    btn.innerHTML = original;
  } finally {
    btn.disabled = false;
  }
}

function toggleAi(out, text) {
  if (out.hidden) {
    out.hidden = false;
    out.innerHTML = `<span class="ai-tag">AI解説</span>${escapeHtml(text)}`;
  } else {
    out.hidden = true;
  }
}

function typeText(el, text) {
  el.classList.remove('typing');
  let i = 0;
  const speed = Math.max(6, Math.min(20, 1200 / text.length));
  (function step() {
    if (i >= text.length) return;
    const chunk = text.slice(i, i + 2);
    el.textContent += chunk;
    i += 2;
    setTimeout(step, speed);
  })();
}

function copyText(text, btn) {
  navigator.clipboard?.writeText(text).then(() => {
    btn.classList.add('copied');
    btn.textContent = '✓';
    setTimeout(() => { btn.classList.remove('copied'); btn.textContent = '⧉'; }, 1400);
  }).catch(() => {});
}

function showSkeletons() {
  els.grid.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton';
    els.grid.appendChild(sk);
  }
}

function debounce(fn, ms) {
  let id;
  return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); };
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
