/* ── Voting Analysis Page ── */
document.addEventListener('DOMContentLoaded', async () => {
  // ── Session selectors ──
  const kwSession = document.getElementById('kw-session');
  const analysisSession = document.getElementById('analysis-session');
  const otherTabSession = document.getElementById('other-tab-session');
  const kwLegislator = document.getElementById('kw-legislator');

  const sessions = await loadSessions();
  const latestSession = sessions.length ? sessions[0].source_session : '';

  // Populate keyword session as a multi-select dropdown
  kwSession.innerHTML = '<option value="">All Sessions</option>';
  sessions.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.source_session;
    opt.textContent = s.display_name;
    kwSession.appendChild(opt);
  });

  // Populate other-tab session (single select)
  populateSessionSelect(analysisSession, latestSession);

  // Restore URL state
  const urlParams = getParams();
  if (urlParams.q) document.getElementById('keyword-input').value = urlParams.q;
  if (urlParams.session) {
    const sessVals = urlParams.session.split(',');
    Array.from(kwSession.options).forEach(o => {
      if (sessVals.includes(o.value)) o.selected = true;
    });
  }
  if (urlParams.people_id) {
    // Will be set after legislators load
  }

  // Load legislators for the dropdown when session changes
  async function refreshLegislatorDropdown() {
    const selectedSessions = getSelectedSessions();
    const params = selectedSessions.length ? { session: selectedSessions } : {};
    try {
      // Build query string manually for multi-value
      let url = '/api/legislators/list';
      if (selectedSessions.length) {
        url += '?' + selectedSessions.map(s => `session=${encodeURIComponent(s)}`).join('&');
      }
      const resp = await fetch(url);
      const legislators = await resp.json();
      const currentVal = kwLegislator.value;
      kwLegislator.innerHTML = '<option value="">All Legislators</option>';
      legislators.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.people_id;
        const partyTag = l.party ? ` (${l.party})` : '';
        opt.textContent = `${l.name}${partyTag}`;
        if (String(l.people_id) === (urlParams.people_id || currentVal)) opt.selected = true;
        kwLegislator.appendChild(opt);
      });
    } catch (e) { /* keep existing options */ }
  }

  await refreshLegislatorDropdown();
  kwSession.addEventListener('change', refreshLegislatorDropdown);

  function getSelectedSessions() {
    return Array.from(kwSession.selectedOptions)
      .map(o => o.value)
      .filter(v => v !== '');
  }

  // ── Keyword search ──
  const keywordInput = document.getElementById('keyword-input');
  const keywordBtn = document.getElementById('keyword-search-btn');
  keywordBtn.addEventListener('click', () => runKeywordSearch());
  keywordInput.addEventListener('keydown', e => { if (e.key === 'Enter') runKeywordSearch(); });

  async function runKeywordSearch() {
    const keyword = keywordInput.value.trim();
    const el = document.getElementById('keyword-results');
    const selectedSessions = getSelectedSessions();
    const peopleId = kwLegislator.value;

    if (!keyword) { el.innerHTML = '<div class="empty-state">Enter a keyword to search.</div>'; return; }

    // Update URL
    setParams({
      q: keyword,
      session: selectedSessions.join(',') || '',
      people_id: peopleId || ''
    });

    showLoading(el);

    try {
      // Build query string
      const useFulltext = document.getElementById('kw-fulltext').checked;
      let qs = `q=${encodeURIComponent(keyword)}`;
      selectedSessions.forEach(s => { qs += `&session=${encodeURIComponent(s)}`; });
      if (peopleId) qs += `&people_id=${encodeURIComponent(peopleId)}`;
      if (useFulltext) qs += '&fulltext=1';

      const resp = await fetch(`/api/votes/keyword?${qs}`);
      const data = await resp.json();

      if (data.error) { showEmpty(el, data.error); return; }
      if (!data.results.length) {
        showEmpty(el, `No roll call votes found for bills matching "${escHtml(keyword)}".`);
        return;
      }

      if (data.mode === 'individual') {
        renderIndividualResults(el, data, keyword, selectedSessions);
      } else {
        renderAggregateResults(el, data, keyword, selectedSessions);
      }
    } catch (e) {
      el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
  }

  // Auto-search if URL has keyword
  if (urlParams.q) {
    setTimeout(() => runKeywordSearch(), 400);
  }

  // ── Tab switching ──
  document.querySelectorAll('#analysis-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#analysis-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

      // Show/hide the other-tab session selector
      if (btn.dataset.tab === 'keyword') {
        otherTabSession.style.display = 'none';
      } else {
        otherTabSession.style.display = '';
        loadOtherTab(btn.dataset.tab);
      }
    });
  });

  analysisSession.addEventListener('change', () => {
    const tab = getActiveNonKeywordTab();
    if (tab) loadOtherTab(tab);
  });

  function getActiveNonKeywordTab() {
    const active = document.querySelector('#analysis-tabs .tab-btn.active');
    return active && active.dataset.tab !== 'keyword' ? active.dataset.tab : null;
  }

  function loadOtherTab(tab) {
    const session = analysisSession.value;
    if (!session) return;
    if (tab === 'partyline') loadPartyLine(session);
    else if (tab === 'close') loadCloseVotes(session);
    else if (tab === 'bipartisan') loadBipartisan(session);
  }
});


/* ── Render: Individual legislator votes ── */
function renderIndividualResults(el, data, keyword, sessions) {
  const s = data.summary;
  const cast = s.yea + s.nay;
  const yeaPct = cast > 0 ? ((s.yea / cast) * 100).toFixed(1) : '—';

  el.innerHTML = `
    <div style="margin-bottom:16px">
      <div class="stats-grid" style="max-width:600px">
        <div class="stat-card"><div class="stat-value" style="color:var(--green)">${s.yea}</div><div class="stat-label">Yea</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--red)">${s.nay}</div><div class="stat-label">Nay</div></div>
        <div class="stat-card"><div class="stat-value">${s.total}</div><div class="stat-label">Total Votes</div></div>
        <div class="stat-card"><div class="stat-value">${yeaPct}${yeaPct !== '—' ? '%' : ''}</div><div class="stat-label">Yea Rate</div></div>
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:8px">
        <strong>${data.bills_matched}</strong> bills matching "<strong>${escHtml(keyword)}</strong>"
      </p>
      ${voteBar(s.yea, s.nay, s.nv, s.absent)}
    </div>

    <details style="margin-bottom:12px">
      <summary style="font-size:12px;color:var(--text-muted);cursor:pointer">Show matching bills (${data.bills_matched})</summary>
      <div style="margin-top:8px;max-height:200px;overflow-y:auto">
        <table style="font-size:12px">
          <tbody>
            ${data.bills.map(b => `
              <tr>
                <td class="td-nowrap"><a href="/alabama-legislature-dashboard/bills/${encodeURIComponent(b.source_session)}/${b.bill_id}">${escHtml(b.bill_number)}</a></td>
                <td>${escHtml(truncate(b.title, 100))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </details>

    <div class="card"><div class="table-wrap">
      <table>
        <thead><tr>
          <th>Date</th><th>Bill</th><th>Session</th><th class="td-title">Roll Call</th><th>Vote</th><th>Result</th>
        </tr></thead>
        <tbody>
          ${data.results.map(v => `
            <tr>
              <td class="td-nowrap">${formatDate(v.date)}</td>
              <td class="td-nowrap"><a href="/alabama-legislature-dashboard/bills/${encodeURIComponent(v.source_session)}/${v.bill_id}">${escHtml(v.bill_number)}</a></td>
              <td class="td-nowrap" style="font-size:11px">${escHtml(v.display_name || '')}</td>
              <td class="td-title">${escHtml(truncate(v.roll_call_desc || v.bill_title, 80))}</td>
              <td>${voteBadge(v.vote_desc)}</td>
              <td>${voteBar(v.yea, v.nay, v.nv, v.absent)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div></div>
  `;
}


/* ── Render: Aggregate (all legislators) ── */
function renderAggregateResults(el, data, keyword, sessions) {
  let sortCol = 'name';
  let sortDir = 'asc';
  const currentData = data.results;

  function render() {
    const sorted = [...currentData].sort((a, b) => {
      let va, vb;
      if (sortCol === 'name') { va = a.name; vb = b.name; }
      else if (sortCol === 'yea') { va = a.yea; vb = b.yea; }
      else if (sortCol === 'nay') { va = a.nay; vb = b.nay; }
      else if (sortCol === 'total') { va = a.total_votes; vb = b.total_votes; }
      else if (sortCol === 'pct') { va = a.yea / (a.yea + a.nay || 1); vb = b.yea / (b.yea + b.nay || 1); }
      else { va = a[sortCol]; vb = b[sortCol]; }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });

    const arrow = col => sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

    el.innerHTML = `
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
        <strong>${data.bills_matched}</strong> bills matching "<strong>${escHtml(keyword)}</strong>" &mdash;
        showing vote totals for <strong>${data.results.length}</strong> legislators.
        <em>Select a legislator from the dropdown above to see individual votes.</em>
      </p>
      <details style="margin-bottom:12px">
        <summary style="font-size:12px;color:var(--text-muted);cursor:pointer">Show matching bills (${data.bills_matched})</summary>
        <div style="margin-top:8px;max-height:200px;overflow-y:auto">
          <table style="font-size:12px">
            <tbody>
              ${data.bills.map(b => `
                <tr>
                  <td class="td-nowrap"><a href="/alabama-legislature-dashboard/bills/${encodeURIComponent(b.source_session)}/${b.bill_id}">${escHtml(b.bill_number)}</a></td>
                  <td>${escHtml(truncate(b.title, 100))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </details>
      <div class="card"><div class="table-wrap">
        <table id="keyword-table">
          <thead><tr>
            <th class="sortable" data-col="name" style="cursor:pointer">Legislator${arrow('name')}</th>
            <th>Party</th>
            <th>Role</th>
            <th>District</th>
            <th class="sortable" data-col="yea" style="cursor:pointer">Yea${arrow('yea')}</th>
            <th class="sortable" data-col="nay" style="cursor:pointer">Nay${arrow('nay')}</th>
            <th class="sortable" data-col="total" style="cursor:pointer">Total${arrow('total')}</th>
            <th class="sortable" data-col="pct" style="cursor:pointer">Yea %${arrow('pct')}</th>
            <th>Votes</th>
          </tr></thead>
          <tbody>
            ${sorted.map(r => {
              const cast = r.yea + r.nay;
              const yeaPct = cast > 0 ? ((r.yea / cast) * 100).toFixed(1) : '—';
              return `
                <tr class="kw-row" data-pid="${r.people_id}" style="cursor:pointer" title="Click to view individual votes">
                  <td class="td-nowrap"><a href="/alabama-legislature-dashboard/legislators/${r.people_id}" onclick="event.stopPropagation()">${escHtml(r.name)}</a></td>
                  <td>${partyBadge(r.party)}</td>
                  <td>${escHtml(r.role || '')}</td>
                  <td>${escHtml(r.district || '')}</td>
                  <td><strong style="color:var(--green)">${r.yea}</strong></td>
                  <td><strong style="color:var(--red)">${r.nay}</strong></td>
                  <td>${r.total_votes}</td>
                  <td>${yeaPct}${yeaPct !== '—' ? '%' : ''}</td>
                  <td>${voteBar(r.yea, r.nay, r.nv, r.absent)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div></div>
    `;

    // Sort handlers
    el.querySelectorAll('.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortCol = col; sortDir = col === 'name' ? 'asc' : 'desc'; }
        render();
      });
    });

    // Row click → select legislator and re-search
    el.querySelectorAll('.kw-row').forEach(row => {
      row.addEventListener('click', () => {
        const pid = row.dataset.pid;
        const sel = document.getElementById('kw-legislator');
        sel.value = pid;
        document.getElementById('keyword-search-btn').click();
      });
    });
  }

  render();
}


/* ── Other analysis tabs (unchanged logic) ── */

async function loadPartyLine(session, page = 1) {
  const el = document.getElementById('tab-partyline');
  showLoading(el);

  try {
    const data = await API.get('/api/votes/party-line', { session, page, per_page: 30 });
    if (!data.results.length) { showEmpty(el, 'No party-line votes found for this session.'); return; }

    el.innerHTML = `
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
        Votes where the Republican and Democratic majorities voted on opposite sides.
        <strong>${data.total}</strong> party-line votes found.
      </p>
      <div class="card"><div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Bill</th><th>Description</th><th>R (Y/N)</th><th>D (Y/N)</th><th>Result</th></tr></thead>
          <tbody>
            ${data.results.map(v => `
              <tr>
                <td class="td-nowrap">${formatDate(v.date)}</td>
                <td class="td-nowrap"><a href="/alabama-legislature-dashboard/bills/${encodeURIComponent(session)}/${v.bill_id}">${escHtml(v.bill_number)}</a></td>
                <td>${escHtml(truncate(v.description || v.title, 60))}</td>
                <td class="td-nowrap">${v.r_yea}/${v.r_nay}</td>
                <td class="td-nowrap">${v.d_yea}/${v.d_nay}</td>
                <td>${voteBar(v.yea, v.nay, v.nv, v.absent)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div></div>
      <div class="pagination" id="partyline-pagination"></div>
    `;

    renderPagination(document.getElementById('partyline-pagination'), data, pg => loadPartyLine(session, pg));
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

async function loadCloseVotes(session, page = 1) {
  const el = document.getElementById('tab-close');
  showLoading(el);

  try {
    const data = await API.get('/api/votes/close', { session, page, per_page: 30 });
    if (!data.results.length) { showEmpty(el, 'No roll call votes found.'); return; }

    el.innerHTML = `
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
        Roll calls sorted by smallest margin between yea and nay votes.
      </p>
      <div class="card"><div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Bill</th><th>Description</th><th>Margin</th><th>Result</th></tr></thead>
          <tbody>
            ${data.results.map(v => `
              <tr>
                <td class="td-nowrap">${formatDate(v.date)}</td>
                <td class="td-nowrap"><a href="/alabama-legislature-dashboard/bills/${encodeURIComponent(session)}/${v.bill_id}">${escHtml(v.bill_number)}</a></td>
                <td>${escHtml(truncate(v.description || v.title, 60))}</td>
                <td class="td-nowrap"><strong>${v.margin}</strong></td>
                <td>${voteBar(v.yea, v.nay, v.nv, v.absent)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div></div>
      <div class="pagination" id="close-pagination"></div>
    `;

    renderPagination(document.getElementById('close-pagination'), data, pg => loadCloseVotes(session, pg));
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

async function loadBipartisan(session, page = 1) {
  const el = document.getElementById('tab-bipartisan');
  showLoading(el);

  try {
    const data = await API.get('/api/votes/bipartisan', { session, page, per_page: 30 });
    if (!data.results.length) { showEmpty(el, 'No bipartisan votes found.'); return; }

    el.innerHTML = `
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
        Votes where both party majorities (>60%) voted the same way.
        <strong>${data.total}</strong> bipartisan votes found.
      </p>
      <div class="card"><div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Bill</th><th>Description</th><th>R (Y/N)</th><th>D (Y/N)</th><th>Result</th></tr></thead>
          <tbody>
            ${data.results.map(v => `
              <tr>
                <td class="td-nowrap">${formatDate(v.date)}</td>
                <td class="td-nowrap"><a href="/alabama-legislature-dashboard/bills/${encodeURIComponent(session)}/${v.bill_id}">${escHtml(v.bill_number)}</a></td>
                <td>${escHtml(truncate(v.description || v.title, 60))}</td>
                <td class="td-nowrap">${v.r_yea}/${v.r_nay}</td>
                <td class="td-nowrap">${v.d_yea}/${v.d_nay}</td>
                <td>${voteBar(v.yea, v.nay, v.nv, v.absent)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div></div>
      <div class="pagination" id="bipartisan-pagination"></div>
    `;

    renderPagination(document.getElementById('bipartisan-pagination'), data, pg => loadBipartisan(session, pg));
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}
