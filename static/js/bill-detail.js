/* ── Bill Detail Page ── */
document.addEventListener('DOMContentLoaded', () => {
  const pathParts = window.location.pathname.split('/');
  const billId = pathParts.pop();
  const session = decodeURIComponent(pathParts.pop());

  loadBillDetail(session, billId);
});

async function loadBillDetail(session, billId) {
  const container = document.getElementById('bill-detail');
  showLoading(container);

  try {
    const bill = await API.get(`/api/bills/${encodeURIComponent(session)}/${billId}`);

    container.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
            <h1 style="font-size:20px;font-weight:700">${escHtml(bill.bill_number)}</h1>
            ${statusBadge(bill.status_desc)}
            ${window.INTERNAL_MODE ? renderControversyBadge(bill.controversy) : ''}
            <span style="font-size:13px;color:var(--text-muted)">${escHtml(bill.display_name)}</span>
          </div>
          <p style="font-size:15px;margin-bottom:8px">${highlightTerms(escHtml(bill.title))}</p>
          ${bill.description && bill.description !== bill.title ? `<p style="font-size:13px;color:var(--text-secondary)">${highlightTerms(escHtml(bill.description))}</p>` : ''}
          ${renderTopicTags(bill.topics)}
          ${bill.state_link ? `<p style="margin-top:8px"><a href="${escHtml(bill.state_link)}" target="_blank">View on ALISON &rarr;</a></p>` : ''}
        </div>
      </div>

      ${renderStatusPipeline(bill)}

      ${renderSponsors(bill.sponsors, session)}

      <div class="tabs" id="bill-tabs">
        <button class="tab-btn active" data-tab="history">History (${bill.history.length})</button>
        <button class="tab-btn" data-tab="rollcalls">Roll Calls (${bill.rollcalls.length})</button>
        <button class="tab-btn" data-tab="documents">Documents (${bill.documents.length})</button>
        <button class="tab-btn" data-tab="fiscal">Fiscal Notes</button>
        ${bill.news_count ? `<button class="tab-btn" data-tab="news">News (${bill.news_count})</button>` : `<button class="tab-btn" data-tab="news">News</button>`}
      </div>

      <div class="tab-panel active" id="tab-history">${renderHistory(bill.history)}</div>
      <div class="tab-panel" id="tab-rollcalls">${renderRollcalls(bill.rollcalls, session)}</div>
      <div class="tab-panel" id="tab-documents">${renderDocuments(bill.documents)}</div>
      <div class="tab-panel" id="tab-fiscal"><div class="loading">Loading…</div></div>
      <div class="tab-panel" id="tab-news"><div class="loading">Loading…</div></div>
    `;

    initTabs();
    initRollcallToggles(session);
    initFiscalTab(session, billId);
    initNewsTab(session, billId);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Error loading bill: ${e.message}</div>`;
  }
}

/* ── Status Pipeline ── */
function renderStatusPipeline(bill) {
  const status = bill.status || 0;
  const history = bill.history || [];

  // Determine which stages have been reached
  const stages = [
    { key: 'introduced', label: 'Introduced' },
    { key: 'committee', label: 'In Committee' },
    { key: 'floor', label: 'Floor Vote' },
    { key: 'passed_chamber', label: 'Passed Chamber' },
    { key: 'passed_both', label: 'Passed Both' },
    { key: 'enacted', label: 'Enacted' }
  ];

  // Parse history for committee and floor stages
  const actionText = history.map(h => h.action).join(' ').toLowerCase();
  const hasCommittee = actionText.includes('referred to') || actionText.includes('pending') || actionText.includes('committee');
  const hasFloor = actionText.includes('third reading') || actionText.includes('second reading') || actionText.includes('roll call') || bill.rollcalls?.length > 0;

  // Build reached map
  const reached = {
    introduced: status >= 1 || history.length > 0,
    committee: hasCommittee,
    floor: hasFloor,
    passed_chamber: status >= 2,
    passed_both: status >= 3,
    enacted: status >= 4
  };

  // Determine if vetoed
  const isVetoed = status === 5;
  if (isVetoed) {
    stages[5].label = 'Vetoed';
    reached.enacted = true; // Mark the final stage as reached (but styled differently)
  }

  // Determine if dead/stalled — check for "died" in history
  const isDead = actionText.includes('died in committee') || actionText.includes('carried over indefinitely');

  // Find current (last reached) stage
  let currentIdx = -1;
  stages.forEach((s, i) => { if (reached[s.key]) currentIdx = i; });

  return `
    <div class="bill-pipeline" style="margin-bottom:16px">
      <div class="pipeline-track">
        ${stages.map((s, i) => {
          let cls = 'pipeline-step';
          if (i <= currentIdx) cls += ' reached';
          if (i === currentIdx) cls += ' current';
          if (isVetoed && i === 5) cls += ' vetoed';
          if (isDead && i === currentIdx) cls += ' dead';
          return `<div class="${cls}">
            <div class="pipeline-dot"></div>
            <div class="pipeline-label">${s.label}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

/* ── Controversy Badge ── */
function renderControversyBadge(controversy) {
  if (!controversy || !controversy.controversy_score) return '';
  const score = Math.round(controversy.controversy_score);
  const parts = [];
  if (controversy.party_line_votes) parts.push(`Party-line votes: ${controversy.party_line_votes}`);
  if (controversy.closest_margin != null) parts.push(`Closest margin: ${controversy.closest_margin}`);
  if (controversy.max_dissent_pct) parts.push(`Max dissent: ${Math.round(controversy.max_dissent_pct)}%`);
  if (controversy.total_roll_calls) parts.push(`Roll calls: ${controversy.total_roll_calls}`);
  const tooltip = `Controversy Score: ${score}\n${parts.join('\n')}\n\nScored by party splits, close margins, and intra-party dissent.`;
  return `<span class="controversy-badge" title="${escHtml(tooltip)}">Controversy: ${score}</span>`;
}

/* ── Topic Tags ── */
function renderTopicTags(topics) {
  if (!topics || !topics.length) return '';
  return `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
    ${topics.map(t => `<span class="topic-tag">${escHtml(t.topic_label)}</span>`).join('')}
  </div>`;
}

/* ── Search Term Highlighting ── */
function getHighlightTerms() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || params.get('highlight') || '';
  return q.trim();
}

function highlightTerms(text) {
  const q = getHighlightTerms();
  if (!q || !text) return text;
  // Split on spaces for multi-word, escape regex special chars
  const terms = q.split(/\s+/).filter(t => t.length >= 2);
  if (!terms.length) return text;
  const pattern = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/* ── Sponsors ── */
function renderSponsors(sponsors, session) {
  if (!sponsors.length) return '';
  return `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">Sponsors</div>
      <div class="card-body">
        <div class="sponsor-list">
          ${sponsors.map(s => `
            <span class="sponsor-chip">
              <a href="/alabama-legislature-dashboard/legislators/${s.people_id}">${escHtml(s.name)}</a>
              ${partyBadge(s.party)}
              ${s.position <= 1 ? '<span style="font-size:11px;color:var(--text-muted)">(primary)</span>' : ''}
            </span>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/* ── History Timeline ── */
function renderHistory(history) {
  if (!history.length) return '<div class="empty-state">No history available.</div>';
  return `
    <div class="card"><div class="card-body">
      <div class="timeline">
        ${history.map(h => `
          <div class="timeline-item">
            <div class="timeline-date">${formatDate(h.date)} ${h.chamber ? chamberBadge(h.chamber) : ''}</div>
            <div class="timeline-action">${highlightTerms(escHtml(h.action))}</div>
          </div>
        `).join('')}
      </div>
    </div></div>
  `;
}

/* ── Roll Calls ── */
function renderRollcalls(rollcalls, session) {
  if (!rollcalls.length) return '<div class="empty-state">No roll call votes.</div>';
  return rollcalls.map(rc => `
    <div class="rollcall-section" data-session="${escHtml(session)}" data-rcid="${rc.roll_call_id}">
      <div class="rollcall-header">
        <div>
          <div class="rollcall-desc">${escHtml(rc.description || 'Roll Call Vote')}</div>
          <div class="rollcall-date">${formatDate(rc.date)} ${chamberBadge(rc.chamber)}</div>
        </div>
        <div>${voteBar(rc.yea, rc.nay, rc.nv, rc.absent)}</div>
      </div>
      <div class="rollcall-body" id="rc-body-${rc.roll_call_id}"></div>
    </div>
  `).join('');
}

/* ── Documents ── */
function renderDocuments(documents) {
  if (!documents.length) return '<div class="empty-state">No documents available.</div>';
  return `
    <div class="card"><div class="card-body">
      <ul class="doc-list">
        ${documents.map(d => `
          <li>
            <strong>${escHtml(d.document_desc || d.document_type || 'Document')}</strong>
            ${d.state_link ? `<a href="${escHtml(d.state_link)}" target="_blank" style="margin-left:8px">View on ALISON &rarr;</a>` : ''}
          </li>
        `).join('')}
      </ul>
    </div></div>
  `;
}

/* ── Tabs ── */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

/* ── Roll Call Toggles ── */
function initRollcallToggles(session) {
  document.querySelectorAll('.rollcall-header').forEach(header => {
    header.addEventListener('click', async () => {
      const section = header.closest('.rollcall-section');
      const body = section.querySelector('.rollcall-body');
      if (body.classList.contains('open')) {
        body.classList.remove('open');
        return;
      }

      if (!body.dataset.loaded) {
        body.innerHTML = '<div class="loading">Loading votes…</div>';
        body.classList.add('open');
        const rcId = section.dataset.rcid;
        const sess = section.dataset.session;
        try {
          const votes = await API.get(`/api/rollcalls/${encodeURIComponent(sess)}/${rcId}/votes`);
          body.innerHTML = renderVoteDetail(votes);
          body.dataset.loaded = '1';
        } catch (e) {
          body.innerHTML = `<div class="empty-state">Error loading votes</div>`;
        }
      } else {
        body.classList.add('open');
      }
    });
  });
}

/* ── Fiscal Notes Tab ── */
function formatDollars(amount) {
  if (amount == null) return '';
  if (amount >= 1e9) return '$' + (amount / 1e9).toFixed(1) + 'B';
  if (amount >= 1e6) return '$' + (amount / 1e6).toFixed(1) + 'M';
  if (amount >= 1e3) return '$' + (amount / 1e3).toFixed(0) + 'K';
  return '$' + amount.toFixed(0);
}

function impactBadge(direction) {
  const colors = {
    increase: '#dc3545',
    decrease: '#28a745',
    neutral: '#6c757d',
    mixed: '#fd7e14',
    undetermined: '#adb5bd'
  };
  const labels = {
    increase: 'Increases Spending',
    decrease: 'Decreases Spending',
    neutral: 'No Fiscal Impact',
    mixed: 'Mixed Impact',
    undetermined: 'Undetermined'
  };
  const color = colors[direction] || '#adb5bd';
  const label = labels[direction] || direction;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;color:#fff;background:${color}">${label}</span>`;
}

function initFiscalTab(session, billId) {
  let loaded = false;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === 'fiscal') {
      btn.addEventListener('click', async () => {
        if (loaded) return;
        loaded = true;
        const el = document.getElementById('tab-fiscal');
        try {
          const notes = await API.get(`/api/bills/${encodeURIComponent(session)}/${billId}/fiscal-notes`);
          if (!notes.length) {
            el.innerHTML = '<div class="empty-state">No fiscal notes available for this bill.</div>';
            return;
          }
          btn.textContent = `Fiscal Notes (${notes.length})`;
          el.innerHTML = notes.map(fn => `
            <div class="card" style="margin-bottom:12px">
              <div class="card-body">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
                  ${impactBadge(fn.impact_direction)}
                  ${fn.max_amount ? `<span style="font-size:16px;font-weight:700">${formatDollars(fn.max_amount)}</span>` : ''}
                </div>
                <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--text-muted);margin-bottom:10px">
                  ${fn.committee ? `<span>Committee: ${escHtml(fn.committee)}</span>` : ''}
                  ${fn.analyst ? `<span>Analyst: ${escHtml(fn.analyst)}</span>` : ''}
                  ${fn.fiscal_note_date ? `<span>Date: ${escHtml(fn.fiscal_note_date)}</span>` : ''}
                </div>
                <div style="font-size:13px;line-height:1.6;white-space:pre-wrap;max-height:300px;overflow-y:auto;padding:10px;background:var(--bg);border-radius:6px">${escHtml(fn.full_text)}</div>
              </div>
            </div>
          `).join('');
        } catch (e) {
          el.innerHTML = '<div class="empty-state">Error loading fiscal notes.</div>';
        }
      });
    }
  });
}

/* ── News Tab ── */
function initNewsTab(session, billId) {
  let loaded = false;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === 'news') {
      btn.addEventListener('click', async () => {
        if (loaded) return;
        loaded = true;
        const el = document.getElementById('tab-news');
        try {
          const articles = await API.get(`/api/bills/${encodeURIComponent(session)}/${billId}/news`);
          if (!articles.length) {
            el.innerHTML = '<div class="empty-state">No news articles collected for this bill yet.</div>';
            return;
          }
          btn.textContent = `News (${articles.length})`;
          el.innerHTML = `
            <div class="card"><div class="card-body">
              ${articles.map(a => `
                <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)">
                  <a href="${escHtml(a.url)}" target="_blank" style="font-weight:600;font-size:14px">${escHtml(a.headline)}</a>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${escHtml(a.source_name)}${a.date ? ' — ' + formatDate(a.date) : ''}</div>
                  ${a.snippet ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${escHtml(a.snippet)}</div>` : ''}
                </div>
              `).join('')}
            </div></div>
          `;
        } catch (e) {
          el.innerHTML = '<div class="empty-state">Error loading news.</div>';
        }
      });
    }
  });
}

/* ── Vote Detail ── */
function renderVoteDetail(votes) {
  const byParty = {};
  votes.forEach(v => {
    const p = v.party || 'Other';
    if (!byParty[p]) byParty[p] = [];
    byParty[p].push(v);
  });

  const partyOrder = ['R', 'D', ...Object.keys(byParty).filter(p => p !== 'R' && p !== 'D')];

  return `
    <div class="party-breakdown">
      ${partyOrder.filter(p => byParty[p]).map(p => `
        <div class="party-group">
          <h4>${p === 'R' ? 'Republicans' : p === 'D' ? 'Democrats' : p}</h4>
          <table>
            <tbody>
              ${byParty[p].map(v => `
                <tr>
                  <td><a href="/alabama-legislature-dashboard/legislators/${v.people_id}">${escHtml(v.name)}</a></td>
                  <td>${v.district ? 'Dist. ' + escHtml(v.district) : ''}</td>
                  <td>${voteBadge(v.vote_desc)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </div>
  `;
}
