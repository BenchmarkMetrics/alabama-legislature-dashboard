/* ── API Client & Shared Utilities ── */

const API = {
  async get(url, params = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    ).toString();
    const resp = await fetch(qs ? `${url}?${qs}` : url);
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return resp.json();
  }
};

/* ── Session Loader ── */
let sessionsCache = null;

async function loadSessions() {
  if (sessionsCache) return sessionsCache;
  sessionsCache = await API.get('/api/sessions');
  return sessionsCache;
}

function populateSessionSelect(selectEl, selectedValue) {
  loadSessions().then(sessions => {
    selectEl.innerHTML = '<option value="">All Sessions</option>';
    sessions.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.source_session;
      opt.textContent = `${s.display_name} (${s.bill_count} bills)`;
      if (s.source_session === selectedValue) opt.selected = true;
      selectEl.appendChild(opt);
    });
  });
}

function getLatestSession() {
  return loadSessions().then(sessions => sessions.length ? sessions[0].source_session : '');
}

/* ── URL State ── */
function getParams() {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

function setParams(params) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null)
  );
  const qs = new URLSearchParams(clean).toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

/* ── Pagination Renderer ── */
function renderPagination(container, data, onChange) {
  const { page, pages, total } = data;
  if (pages <= 1) { container.innerHTML = ''; return; }

  const start = (page - 1) * data.per_page + 1;
  const end = Math.min(page * data.per_page, total);

  container.innerHTML = `
    <span>${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}</span>
    <div class="pagination-buttons">
      <button ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">Prev</button>
      <button ${page >= pages ? 'disabled' : ''} data-page="${page + 1}">Next</button>
    </div>
  `;
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.disabled) onChange(parseInt(btn.dataset.page));
    });
  });
}

/* ── Formatters ── */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function partyBadge(party) {
  const cls = party === 'R' ? 'badge-r' : party === 'D' ? 'badge-d' : 'badge-i';
  const label = party === 'R' ? 'Republican' : party === 'D' ? 'Democrat' : party || 'Other';
  return `<span class="badge ${cls}">${label}</span>`;
}

function statusBadge(statusDesc) {
  if (!statusDesc) return '';
  const s = statusDesc.toLowerCase();
  let cls = 'badge-default';
  if (s.includes('pass') || s.includes('enacted') || s.includes('signed')) cls = 'badge-passed';
  else if (s.includes('fail') || s.includes('dead')) cls = 'badge-failed';
  else if (s.includes('introduced') || s.includes('prefiled')) cls = 'badge-introduced';
  else if (s.includes('engross')) cls = 'badge-engrossed';
  else if (s.includes('enroll')) cls = 'badge-enrolled';
  else if (s.includes('veto')) cls = 'badge-vetoed';
  return `<span class="badge ${cls}">${escHtml(statusDesc)}</span>`;
}

function chamberBadge(chamber) {
  if (!chamber) return '';
  const isS = chamber.toLowerCase().startsWith('s');
  return `<span class="badge ${isS ? 'badge-senate' : 'badge-house'}">${isS ? 'Senate' : 'House'}</span>`;
}

function voteBadge(voteDesc) {
  if (!voteDesc) return '';
  const v = voteDesc.toLowerCase();
  let cls = 'badge-nv';
  if (v === 'yea') cls = 'badge-yea';
  else if (v === 'nay') cls = 'badge-nay';
  else if (v === 'absent') cls = 'badge-absent';
  return `<span class="badge ${cls}">${escHtml(voteDesc)}</span>`;
}

function voteBar(yea, nay, nv, absent) {
  const total = (yea || 0) + (nay || 0) + (nv || 0) + (absent || 0);
  if (!total) return '';
  const pct = v => ((v / total) * 100).toFixed(1);
  const label = (v, t) => v > 0 ? `<span>${v}</span>` : '';

  return `
    <div class="vote-bar">
      ${yea ? `<span class="vb-yea" style="width:${pct(yea)}%">${yea}</span>` : ''}
      ${nay ? `<span class="vb-nay" style="width:${pct(nay)}%">${nay}</span>` : ''}
      ${nv ? `<span class="vb-nv" style="width:${pct(nv)}%">${nv > 2 ? nv : ''}</span>` : ''}
      ${absent ? `<span class="vb-absent" style="width:${pct(absent)}%">${absent > 2 ? absent : ''}</span>` : ''}
    </div>
    <div class="vote-bar-label">
      <span class="vbl-yea">Yea ${yea}</span>
      <span class="vbl-nay">Nay ${nay}</span>
      ${nv ? `<span class="vbl-nv">NV ${nv}</span>` : ''}
      ${absent ? `<span class="vbl-absent">Absent ${absent}</span>` : ''}
    </div>
  `;
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, len = 100) {
  if (!str || str.length <= len) return str || '';
  return str.slice(0, len) + '…';
}

/* ── Debounce ── */
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ── Loading/Empty helpers ── */
function showLoading(el) { el.innerHTML = '<div class="loading">Loading…</div>'; }
function showEmpty(el, msg = 'No results found.') { el.innerHTML = `<div class="empty-state">${msg}</div>`; }

/* ── Active nav link ── */
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === '/' && path === '/') a.classList.add('active');
    else if (href !== '/' && path.startsWith(href) || path.startsWith('/alabama-legislature-dashboard' + href)) a.classList.add('active');
  });

  // Global nav search
  const searchInput = document.getElementById('nav-search-input');
  const searchResults = document.getElementById('nav-search-results');
  if (!searchInput || !searchResults) return;

  const doSearch = debounce(async (q) => {
    if (!q || q.length < 2) { searchResults.classList.remove('open'); return; }
    try {
      const data = await API.get('/api/search/quick', { q });
      let html = '';

      if (data.legislators.length) {
        html += '<div class="nav-search-group-label">Legislators</div>';
        data.legislators.forEach(l => {
          html += `<a class="nav-search-item" href="/alabama-legislature-dashboard/legislators/${l.people_id}">
            <div class="search-title">${escHtml(l.name)} ${partyBadge(l.party)}</div>
            <div class="search-meta">${l.role === 'Sen' ? 'Senate' : 'House'} District ${l.district} · ${l.sessions} session${l.sessions > 1 ? 's' : ''}</div>
          </a>`;
        });
      }

      if (data.bills.length) {
        html += '<div class="nav-search-group-label">Bills</div>';
        data.bills.forEach(b => {
          html += `<a class="nav-search-item" href="/alabama-legislature-dashboard/bills/${encodeURIComponent(b.source_session)}/${b.bill_id}">
            <div class="search-title">${escHtml(b.bill_number)} — ${escHtml(truncate(b.title, 60))}</div>
            <div class="search-meta">${escHtml(b.display_name)} · ${escHtml(b.status_desc || '')}</div>
          </a>`;
        });
      }

      if (!html) {
        html = '<div class="nav-search-empty">No results found</div>';
      }

      searchResults.innerHTML = html;
      searchResults.classList.add('open');
    } catch (e) {
      searchResults.classList.remove('open');
    }
  }, 250);

  searchInput.addEventListener('input', () => doSearch(searchInput.value.trim()));
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2) doSearch(searchInput.value.trim());
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#nav-search')) searchResults.classList.remove('open');
  });

  // Close on Escape
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { searchResults.classList.remove('open'); searchInput.blur(); }
  });
});
