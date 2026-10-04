/* Phigros 第九章资料 · 在线查看器
 * 纯静态：只用 marked（已本地化）+ 原生 JS，可直接丢到 GitHub Pages。
 * 资料查找顺序（自动探测，成功即缓存）：资料/ → ../项目/phigros总结/ → 项目/phigros总结/ → ./
 */
'use strict';

const DOCS = [
  { id: 'README', file: 'README.md',              title: 'README · 总入口',      lv: '索引'   },
  { id: '01',     file: '01_世界观与设定.md',      title: '01 世界观与设定',       lv: '官方层' },
  { id: '02',     file: '02_人物.md',             title: '02 人物与关系',         lv: '官方+语料' },
  { id: '03',     file: '03_剧情.md',             title: '03 剧情',              lv: '游戏内' },
  { id: '04',     file: '04_第九章与ARG.md',       title: '04 第九章与 ARG',       lv: 'ARG'   },
  { id: '05',     file: '05_第二部分.md',          title: '05 第二部分（实测）',    lv: '实测'  },
  { id: '06',     file: '06_收集品.md',            title: '06 收集品（43 条原文）', lv: '原文'  },
  { id: '07',     file: '07_语料与考据.md',         title: '07 语料与考据',         lv: '方法'  },
  { id: '99',     file: '99_未解之谜.md',          title: '99 未解之谜',           lv: '待验证' },
];
const BASES = ['资料/', '../项目/phigros总结/', '项目/phigros总结/', './'];
const $ = (s) => document.querySelector(s);
const el = { side: $('#side'), main: $('#main'), content: $('#content'), status: $('#status'),
  doclist: $('#doclist'), toc: $('#toc'), toclist: $('#toclist'), tocFilter: $('#tocFilter'),
  q: $('#q'), results: $('#results'), resultsList: $('#resultsList'), resultsTitle: $('#resultsTitle'),
  baseInfo: $('#baseInfo'), raw: $('#btnRaw') };

let base = localStorage.getItem('phi.base') || null;
let cur = null;          // 当前文档 id
let curHeadings = [];    // [{id,text,level}]
let index = null;        // 全文索引
let terms = [];          // 当前高亮词

/* ── 工具 ─────────────────────────────────────────── */
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const slug = (s) => s.trim().toLowerCase()
  .replace(/[`*_~\[\]()（）【】「」《》""''，。、：；！？·\s]+/g, '-')
  .replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'h';
const doc = (id) => DOCS.find(d => d.id === id) || DOCS[0];

function setStatus(msg, isErr) {
  el.status.innerHTML = msg;
  el.status.className = 'status' + (isErr ? ' err' : '');
  el.status.hidden = false; el.content.hidden = true;
}
async function probe() {
  if (base) { const ok = await fetch(base + 'README.md', { method: 'HEAD' }).then(r => r.ok).catch(() => false); if (ok) return base; }
  for (const b of BASES) {
    const ok = await fetch(b + 'README.md', { method: 'HEAD' }).then(r => r.ok).catch(() => false);
    if (ok) { base = b; localStorage.setItem('phi.base', b); return b; }
  }
  return null;
}

/* ── 侧边栏 / 大纲 ─────────────────────────────────── */
function buildDoclist() {
  el.doclist.innerHTML = DOCS.map(d =>
    `<a href="#/${d.id}" data-doc="${d.id}">${esc(d.title)}<span class="lv">${esc(d.lv)}</span></a>`).join('');
}
function setActive(id) {
  el.doclist.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.doc === id));
}
function buildToc(headings) {
  el.toclist.innerHTML = headings.map(h =>
    `<a href="#/${cur}/${h.id}" data-head="${h.id}" class="${h.level === 3 ? 'h3' : ''}">${esc(h.text)}</a>`).join('');
}
function filterToc() {
  const q = el.tocFilter.value.trim().toLowerCase();
  el.toclist.querySelectorAll('a').forEach(a => {
    a.style.display = (!q || a.textContent.toLowerCase().includes(q)) ? '' : 'none';
  });
}
function spy() {
  if (!curHeadings.length) return;
  const top = 70; let best = curHeadings[0].id;
  for (const h of curHeadings) {
    const n = document.getElementById(h.id);
    if (n && n.getBoundingClientRect().top <= top + 8) best = h.id; else break;
  }
  el.toclist.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.head === best));
  const a = el.toclist.querySelector('a.on'); if (a) a.scrollIntoView({ block: 'nearest' });
}

/* ── 渲染 ─────────────────────────────────────────── */
function renderMarkdown(md, id) {
  marked.setOptions({ gfm: true, breaks: false });
  el.content.innerHTML = marked.parse(md);

  // 1) 标题 id + 锚点
  const seen = {}; curHeadings = [];
  el.content.querySelectorAll('h1,h2,h3,h4').forEach(h => {
    let s = slug(h.textContent); const n = (seen[s] = (seen[s] || 0) + 1);
    const hid = n > 1 ? `${s}-${n}` : s; h.id = hid;
    if (h.tagName === 'H2' || h.tagName === 'H3') {
      curHeadings.push({ id: hid, text: h.textContent.replace(/¶$/, '').trim(), level: +h.tagName[1] });
      const a = document.createElement('a');
      a.className = 'anchor'; a.href = `#/${id}/${hid}`; a.textContent = '¶'; a.title = '复制该节链接';
      h.appendChild(a);
    }
  });

  // 2) 链接处理：.md → 站内跳转；外链 → 新窗口
  el.content.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (/\.md($|#)/i.test(href)) {
      const bn = href.split('#')[0].split('/').pop();
      const t = DOCS.find(d => d.file === bn);
      if (t) { a.href = `#/${t.id}` + (href.includes('#') ? '/' + href.split('#')[1] : ''); a.dataset.doc = t.id; }
      else { a.removeAttribute('href'); a.title = '该文件不在本站（' + bn + '）'; }
    } else if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
  });

  // 3) 上下篇
  const i = DOCS.findIndex(d => d.id === id), p = DOCS[i - 1], nx = DOCS[i + 1];
  const nav = document.createElement('div'); nav.className = 'docnav';
  nav.innerHTML = (p ? `<a href="#/${p.id}">← ${esc(p.title)}</a>` : '<span></span>')
                + (nx ? `<a href="#/${nx.id}">${esc(nx.title)} →</a>` : '<span></span>');
  el.content.appendChild(nav);

  el.status.hidden = true; el.content.hidden = false;
  el.raw.href = base + doc(id).file;
}

/* ── 高亮搜索词 ───────────────────────────────────── */
function highlight(list) {
  if (!list || !list.length) return 0;
  const nodes = [...el.content.querySelectorAll('p,li,td,th,blockquote,h2,h3,h4')]
    .filter(n => !n.querySelector('p,li,td,th,blockquote,h2,h3,h4'));
  let first = null, count = 0;
  for (const n of nodes) {
    let html = n.innerHTML, hit = false;
    for (const t of list) {
      const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      if (re.test(html)) { html = html.replace(re, m => `<mark class="hit">${m}</mark>`); hit = true; count++; }
    }
    if (hit) { n.innerHTML = html; if (!first) first = n; }
  }
  if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return count;
}

/* ── 打开文档 ─────────────────────────────────────── */
async function open(id, heading, qs) {
  const d = doc(id); cur = d.id; setActive(d.id);
  setStatus('正在加载 ' + esc(d.file) + ' …');
  try {
    const r = await fetch(base + d.file, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const md = await r.text();
    renderMarkdown(md, d.id);
    buildToc(curHeadings);
    terms = qs ? qs.split(/\s+/).filter(Boolean) : [];
    if (terms.length) highlight(terms);
    if (heading) { const n = document.getElementById(heading); if (n) n.scrollIntoView({ block: 'start' }); }
    else window.scrollTo({ top: 0 });
    document.title = d.title + ' · Phigros 第九章资料';
    document.body.classList.remove('side-open', 'toc-open');
  } catch (e) {
    setStatus(`<b>加载失败</b>：${esc(base + d.file)}（${esc(e.message)}）<br><br>
      说明：本站是纯静态页面，需要用 <b>HTTP 方式</b>打开（直接双击本地文件会被浏览器的 file:// 限制拦住），
      并且资料文件要放在下列任一位置：<br>
      <code>资料/</code>、<code>../项目/phigros总结/</code>、<code>项目/phigros总结/</code>、或与 index.html 同目录。<br>
      本地预览：在该目录执行 <code>python -m http.server 8000</code>，然后访问 <code>http://127.0.0.1:8000/</code>。`, true);
  }
}

/* ── 全文搜索 ─────────────────────────────────────── */
async function ensureIndex() {
  if (index) return index;
  const all = await Promise.all(DOCS.map(async d => {
    try { const r = await fetch(base + d.file); return { d, t: r.ok ? await r.text() : '' }; }
    catch { return { d, t: '' }; }
  }));
  index = [];
  for (const { d, t } of all) {
    t.split('\n').forEach((line, i) => {
      const s = line.replace(/^#{1,6}\s*/, '').trim();
      if (s.length > 1) index.push({ id: d.id, title: d.title, line: i + 1, text: s });
    });
  }
  return index;
}
function runSearch(qs) {
  const q = qs.trim().toLowerCase();
  if (!q) { el.results.hidden = true; return; }
  const ts = q.split(/\s+/).filter(Boolean);
  const hits = index.filter(e => { const l = e.text.toLowerCase(); return ts.every(t => l.includes(t)); }).slice(0, 80);
  el.resultsTitle.textContent = `「${qs}」命中 ${hits.length}${hits.length >= 80 ? '+' : ''} 条（点击跳转并高亮）`;
  el.resultsList.innerHTML = hits.map((e, i) => {
    let s = esc(e.text);
    for (const t of ts) s = s.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<b>${m}</b>`);
    return `<div class="r" data-id="${e.id}" data-i="${i}"><div class="rl">${esc(e.title)} · 第 ${e.line} 行</div><div class="rt">${s}</div></div>`;
  }).join('') || '<div class="r"><div class="rt">没有命中</div></div>';
  el.results.hidden = false;
}

/* ── 路由与事件 ───────────────────────────────────── */
function route() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [id, head] = h.split('/');
  open(DOCS.some(d => d.id === id) ? id : 'README', head || null, terms.join(' '));
}
function init() {
  buildDoclist();
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-doc]');
    if (a) {
      e.preventDefault();
      const h = a.getAttribute('href') || '';
      location.hash = /^#\//.test(h) ? h : '#/' + a.dataset.doc;   // 保留 #/文档/小节 这类锚点
      return;
    }
    const r = e.target.closest('.results-list .r');
    if (r) { el.results.hidden = true; terms = el.q.value.trim().split(/\s+/).filter(Boolean);
             location.hash = '#/' + r.dataset.id; setTimeout(() => highlight(terms), 350); }
  });
  el.q.addEventListener('input', () => {
    $('.search').classList.toggle('filled', !!el.q.value);
    clearTimeout(el.q._t); el.q._t = setTimeout(async () => { await ensureIndex(); runSearch(el.q.value); }, 160);
  });
  el.q.addEventListener('focus', async () => { await ensureIndex(); if (el.q.value) runSearch(el.q.value); });
  $('#qclear').onclick = () => { el.q.value = ''; el.results.hidden = true; $('.search').classList.remove('filled'); el.q.focus(); };
  $('#resultsClose').onclick = () => { el.results.hidden = true; };
  el.tocFilter.addEventListener('input', filterToc);
  $('#btnMenu').onclick = () => document.body.classList.toggle('side-open');
  $('#btnToc').onclick = () => document.body.classList.toggle('toc-open');
  $('#btnTheme').onclick = () => {
    const cur = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = cur; localStorage.setItem('phi.theme', cur);
  };
  window.addEventListener('hashchange', route);
  window.addEventListener('scroll', () => { requestAnimationFrame(spy); }, { passive: true });
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
    if (e.key === 'Escape') { el.results.hidden = true; document.body.classList.remove('side-open', 'toc-open'); el.q.blur(); }
    if (typing) return;
    if (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); el.q.focus(); el.q.select(); }
    else if (e.key === 'm' || e.key === 'M') document.body.classList.toggle('side-open');
    else if (e.key === 't' || e.key === 'T') document.body.classList.toggle('toc-open');
    else if (e.key === 'd' || e.key === 'D') $('#btnTheme').click();
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const i = DOCS.findIndex(d => d.id === cur);
      const n = DOCS[i + (e.key === 'ArrowRight' ? 1 : -1)];
      if (n) location.hash = '#/' + n.id;
    }
  });
  document.documentElement.dataset.theme = localStorage.getItem('phi.theme') || 'dark';
  (async () => {
    const b = await probe();
    el.baseInfo.textContent = b ? '资料路径：' + b : '⚠ 未找到资料文件';
    if (!b) { setStatus('未找到资料文件。请把 <code>资料/</code> 目录（或 <code>项目/phigros总结/</code>）与 index.html 一起上传。', true); return; }
    route();
    ensureIndex().catch(() => {});
  })();
}
document.addEventListener('DOMContentLoaded', init);
