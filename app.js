'use strict';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kb = n => n >= 1e6 ? (n / 1e6).toFixed(1) + ' GB' : (n / 1e3).toFixed(0) + ' MB';

const state = { view: 'repos', q: '', chip: '' };
let DB = {};

/* ---------------- 数据 ---------------- */
async function load() {
  const [repos, plays, gaps, docs, projects] = await Promise.all(
    ['repos', 'plays', 'gaps', 'docs', 'projects'].map(n => fetch(`data/${n}.json`).then(r => r.json()))
  );
  DB = { repos, plays, gaps, docs, projects };
  DB.byName = Object.fromEntries(projects.map(p => [p.name, p]));
  renderStats();
  ['repos', 'plays', 'gaps', 'docs'].forEach(k => { $('#n-' + k).textContent = DB[k].length; });
  route();
}

function renderStats() {
  const repos = DB.repos;
  const files = repos.reduce((a, r) => a + r.files, 0);
  const mb = repos.reduce((a, r) => a + r.mb, 0);
  const days = DB.gaps.reduce((a, g) => a + g.days, 0);
  $('#stats').innerHTML = [
    [repos.length, '个仓库'],
    [files.toLocaleString(), '个文件'],
    [kb(mb * 1e6), '总体积'],
    [DB.plays.length, '条玩法记录'],
    [DB.gaps.length, '个待做缺口'],
    [days.toFixed(1), '人天估算'],
  ].map(([v, k]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
}

function match(obj, keys) {
  if (!state.q) return true;
  const q = state.q.toLowerCase();
  return keys.some(k => String(obj[k] ?? '').toLowerCase().includes(q));
}

const empty = () => '<div class="empty">没有匹配的条目</div>';
// 反引号包起来的转成 <code>，其余做 HTML 转义
const md = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const list = arr => `<ul class="ul">${arr.map(x => `<li>${md(x)}</li>`).join('')}</ul>`;

/* ---------------- 仓库卡片 ---------------- */
function renderRepos() {
  const rows = DB.repos.filter(r => match(r, ['name', 'desc', 'lang', 'paths']));
  if (!rows.length) return empty();
  const groups = {};
  rows.forEach(r => (groups[r.group] = groups[r.group] || []).push(r));
  const order = ['本体 01', '星聚互动', '蜀乐互动', '游戏合集', '导入游戏', '备份与逆向', '外围件', '零散复刻'];
  return order.filter(g => groups[g]).map(g => `
    <div class="group">
      <h2>${esc(g)} <span class="dim" style="font-weight:400">${groups[g].length}</span></h2>
      <div class="cards">
        ${groups[g].map(r => `
          <a class="card" href="#/p/${esc(r.name)}">
            <div class="name">${esc(r.name)}</div>
            <div class="cname">${esc((DB.byName[r.name] || {}).cn || '')}</div>
            <div class="desc">${esc(r.desc)}</div>
            <div class="meta">
              <span class="lang">${esc(r.lang)}</span>
              <span>${r.files.toLocaleString()} 文件</span>
              <span>${r.mb >= 1024 ? (r.mb / 1024).toFixed(2) + ' GB' : r.mb + ' MB'}</span>
              <span class="go">详情 →</span>
            </div>
          </a>`).join('')}
      </div>
    </div>`).join('');
}

/* ---------------- 项目详情 ---------------- */
function renderProject(name) {
  const p = DB.byName[name];
  const r = DB.repos.find(x => x.name === name);
  if (!p) return `<div class="empty">没有这个项目：${esc(name)}<br><br><a href="#/">返回</a></div>`;
  const rel = (p.related || []).filter(n => DB.byName[n]);
  return `
  <a class="back" href="#/">← 全部 ${DB.repos.length} 个库</a>
  <div class="phead">
    <div class="ptag">${esc(p.tag)}</div>
    <h1>${esc(p.cn)}</h1>
    <div class="prepo">${esc(name)}</div>
    <p class="pwhat">${md(p.what)}</p>
    <div class="pmeta">
      <a href="${esc(p.url)}" target="_blank" rel="noopener">GitHub ↗</a>
      <span>${(r ? r.files : p.files).toLocaleString()} 文件</span>
      <span>${p.mb >= 1024 ? (p.mb / 1024).toFixed(2) + ' GB' : p.mb + ' MB'}</span>
      <span>${esc(r ? r.lang : '')}</span>
    </div>
    <div class="ppath">本地：<code>${esc(p.local)}</code></div>
    <div class="ppath">归档源：${(p.paths || []).map(x => `<code>${esc(x)}</code>`).join(' ')}</div>
  </div>

  <div class="pgrid">
    <section class="pbox"><h3>里面有什么</h3>${list(p.inside)}</section>
    <section class="pbox"><h3>技术栈</h3>${list(p.stack)}</section>
    <section class="pbox"><h3>关键文件</h3>${list(p.entry)}</section>
    <section class="pbox"><h3>怎么看 / 怎么跑</h3><p>${md(p.run)}</p></section>
    <section class="pbox wide"><h3>值得看什么</h3>${list(p.worth)}</section>
    <section class="pbox wide"><h3>坑与注意</h3><ul class="ul bad">${p.pitfall.map(x => `<li>${md(x)}</li>`).join('')}</ul></section>
    ${rel.length ? `<section class="pbox wide"><h3>相关库</h3><div class="chips">
      ${rel.map(n => `<a class="chip" href="#/p/${esc(n)}">${esc(DB.byName[n].cn)} · ${esc(n)}</a>`).join('')}
    </div></section>` : ''}
  </div>`;
}

/* ---------------- 玩法 ---------------- */
const BLOOD = ['本体 01', '思讯互动', '蜀乐互动', '星聚自研', '复刻', '演示素材', '插件化 05'];

function renderPlays() {
  const rows = DB.plays.filter(p =>
    match(p, ['name', 'code', 'path', 'form', 'src']) &&
    (!state.chip || p.blood === state.chip));
  if (!rows.length) return empty();
  return `<table>
    <thead><tr><th>血脉</th><th>玩法</th><th>代码</th><th>形态</th><th>来源</th><th>路径</th></tr></thead>
    <tbody>${rows.map(p => `<tr>
      <td><span class="tag">${esc(p.blood)}</span></td>
      <td>${esc(p.name) || '<span class="dim">—</span>'}</td>
      <td class="mono">${esc(p.code)}</td>
      <td>${esc(p.form)}</td>
      <td class="mono dim">${esc(p.src)}</td>
      <td><div class="p">${esc(p.path)}</div></td>
    </tr>`).join('')}</tbody></table>`;
}

/* ---------------- 缺口 ---------------- */
function renderGaps() {
  const rows = DB.gaps.filter(g => match(g, ['name', 'code', 'where', 'reuse', 'todo'])
    && (!state.chip || g.tier === state.chip));
  const sum = ['A', 'B', 'C', 'D'].map(t => {
    const s = DB.gaps.filter(g => g.tier === t);
    return `<div class="sum"><b class="tag ${t.toLowerCase()}" style="font-size:22px">${t}</b>
      <span>${s.length} 个 · ${s.reduce((a, g) => a + g.days, 0).toFixed(1)} 人天</span></div>`;
  }).join('');
  if (!rows.length) return `<div class="summary">${sum}</div>` + empty();
  const groups = {};
  rows.forEach(g => (groups[g.tier] = groups[g.tier] || []).push(g));
  return `<div class="summary">${sum}</div>` +
    ['A', 'B', 'C', 'D'].filter(t => groups[t]).map(t => `
    <div class="group">
      <h2>${t} 档 <span class="dim" style="font-weight:400">${groups[t].length} 个 · ${groups[t].reduce((a, g) => a + g.days, 0).toFixed(1)} 人天</span></h2>
      <table><thead><tr><th>名称</th><th>代码</th><th>位置</th><th>可复用</th><th>还差什么</th><th>人天</th></tr></thead>
      <tbody>${groups[t].map(g => `<tr>
        <td>${esc(g.name)}</td><td class="mono">${esc(g.code)}</td>
        <td class="dim">${esc(g.where)}</td><td class="mono">${esc(g.reuse)}</td>
        <td>${esc(g.todo)}</td><td class="mono">${g.days}</td></tr>`).join('')}</tbody></table>
    </div>`).join('');
}

/* ---------------- 文档 ---------------- */
function renderDocs() {
  const rows = DB.docs.filter(d => match(d, ['title', 'summary', 'rel']));
  if (!rows.length) return empty();
  const groups = {};
  rows.forEach(d => (groups[d.top] = groups[d.top] || []).push(d));
  return Object.keys(groups).sort().map(t => `
    <div class="group">
      <h2>${esc(t)} <span class="dim" style="font-weight:400">${groups[t].length}</span></h2>
      ${groups[t].map(d => `<div class="doc">
        <div class="t">${esc(d.title)}</div>
        ${d.summary ? `<div class="s">${esc(d.summary)}</div>` : ''}
        <div class="m">${esc(d.rel)} · ${d.lines} 行 · ${d.kb} KB</div>
      </div>`).join('')}
    </div>`).join('');
}

/* ---------------- 路由 ---------------- */
const VIEWS = { repos: renderRepos, plays: renderPlays, gaps: renderGaps, docs: renderDocs };

function show(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const el = $('#view-' + view);
  if (el) el.classList.remove('hidden');
}

function route() {
  const h = location.hash || '#/';
  const m = h.match(/^#\/p\/(.+)$/);
  if (m) {
    show('project');
    $('#view-project').innerHTML = renderProject(decodeURIComponent(m[1]));
    $('#count').textContent = '';
    $('#chips').innerHTML = '';
    $('.searchbar').style.display = 'none';
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    window.scrollTo(0, 0);
    return;
  }
  $('.searchbar').style.display = '';
  const v = (h.replace('#/', '') || 'repos');
  state.view = VIEWS[v] ? v : 'repos';
  show(state.view);
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.view === state.view));
  render();
}

function render() {
  const el = $('#view-' + state.view);
  el.innerHTML = VIEWS[state.view]();
  const n = (el.querySelectorAll('tr').length - el.querySelectorAll('thead tr').length)
    + el.querySelectorAll('.card').length + el.querySelectorAll('.doc').length;
  $('#count').textContent = state.q || state.chip ? `匹配 ${n} 条` : '';
  renderChips();
}

function renderChips() {
  const box = $('#chips');
  let items = [];
  if (state.view === 'plays') items = ['', ...BLOOD];
  else if (state.view === 'gaps') items = ['', 'A', 'B', 'C', 'D'];
  if (!items.length) { box.innerHTML = ''; return; }
  box.innerHTML = items.map(v => {
    const label = v === '' ? '全部' : (state.view === 'gaps' ? v + ' 档' : v);
    return `<span class="chip ${state.chip === v ? 'on' : ''}" data-v="${esc(v)}">${esc(label)}</span>`;
  }).join('');
  box.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    state.chip = state.chip === c.dataset.v ? '' : c.dataset.v;
    render();
  });
}

/* ---------------- 事件 ---------------- */
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  location.hash = '#/' + t.dataset.view;
});
window.addEventListener('hashchange', route);

let timer;
$('#q').oninput = e => {
  clearTimeout(timer);
  const v = e.target.value.trim();
  timer = setTimeout(() => { state.q = v; render(); }, 120);
};

load();
