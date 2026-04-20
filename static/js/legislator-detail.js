/* ── Legislator Profile Page ── */
document.addEventListener('DOMContentLoaded', () => {
  const peopleId = window.location.pathname.split('/').pop();
  loadLegislator(peopleId);
});

async function loadLegislator(peopleId) {
  const container = document.getElementById('legislator-detail');
  showLoading(container);

  try {
    const data = await API.get(`/api/legislators/${peopleId}`);
    const info = data.info;

    // Compute career totals
    const career = data.vote_summaries.reduce((acc, s) => {
      acc.yea += s.yea_votes; acc.nay += s.nay_votes;
      acc.nv += s.nv_votes; acc.absent += s.absent_votes;
      acc.total += s.total_votes;
      return acc;
    }, { yea: 0, nay: 0, nv: 0, absent: 0, total: 0 });

    container.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="profile-header">
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div class="profile-name">${escHtml(info.name)}</div>
              ${window.INTERNAL_MODE ? `<a href="/legislators/${peopleId}/report" target="_blank" class="btn btn-secondary" style="font-size:12px;padding:5px 12px">Print Report</a>` : ''}
            </div>
            <div class="profile-meta">
              ${partyBadge(info.party)}
              <span>${escHtml(info.role || '')}</span>
              ${info.district ? `<span>District ${escHtml(info.district)}</span>` : ''}
              <span>${data.sessions.length} session${data.sessions.length !== 1 ? 's' : ''} served</span>
            </div>
            <div style="margin-top:12px;display:flex;align-items:center;gap:10px">
              <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Session</label>
              <select id="global-session-select" class="session-select" style="font-size:14px;padding:8px 12px;min-width:220px">
                <option value="" selected>All Sessions (Career)</option>
                ${data.sessions.map(s => `<option value="${escHtml(s.source_session)}">${escHtml(s.display_name)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="tabs" id="leg-tabs">
        <button class="tab-btn active" data-tab="overview">Overview</button>
        <button class="tab-btn" data-tab="analysis">Analysis</button>
        <button class="tab-btn" data-tab="record">Voting Record</button>
        <button class="tab-btn" data-tab="bills" id="bills-tab-btn">Sponsored Bills (${data.sponsored_bills.length})</button>
      </div>

      <!-- OVERVIEW TAB -->
      <div class="tab-panel active" id="tab-overview">
        <div id="report-card-results"><div class="loading">Loading report card…</div></div>
        <div id="key-votes-results" style="margin-top:16px"><div class="loading">Loading key votes…</div></div>
        ${renderCareerCharts(data.vote_summaries, career)}
      </div>

      <!-- ANALYSIS TAB -->
      <div class="tab-panel" id="tab-analysis">
        <div style="margin-bottom:12px">
          <div class="sub-tabs" id="analysis-sub-tabs">
            ${window.INTERNAL_MODE ? `
            <button class="sub-tab-btn active" data-subtab="vulnerability">Vulnerability</button>
            <button class="sub-tab-btn" data-subtab="toxic">Toxic Exposure</button>
            <button class="sub-tab-btn" data-subtab="taxvotes">Tax Votes</button>
            <button class="sub-tab-btn" data-subtab="fiscal">Fiscal Impact</button>
            ` : ''}
            <button class="sub-tab-btn ${window.INTERNAL_MODE ? '' : 'active'}" data-subtab="topics">Topic Analysis</button>
            <button class="sub-tab-btn" data-subtab="peers">Peer Comparison</button>
          </div>
        </div>
        ${window.INTERNAL_MODE ? `
        <div class="sub-panel active" id="sub-vulnerability">
          <div id="vuln-results"><div class="loading">Loading vulnerability…</div></div>
        </div>
        <div class="sub-panel" id="sub-toxic"><div id="toxic-results"></div></div>
        <div class="sub-panel" id="sub-taxvotes"><div id="tax-results"></div></div>
        <div class="sub-panel" id="sub-fiscal"><div id="fiscal-results"></div></div>
        ` : ''}
        <div class="sub-panel ${window.INTERNAL_MODE ? '' : 'active'}" id="sub-topics"><div id="topic-results"><div class="loading">Loading…</div></div></div>
        <div class="sub-panel" id="sub-peers"><div id="peers-results"></div></div>
      </div>

      <!-- VOTING RECORD TAB -->
      <div class="tab-panel" id="tab-record">
        <div style="display:flex;gap:12px;margin-bottom:12px;align-items:center;flex-wrap:wrap">
          <div class="sub-tabs" id="record-sub-tabs">
            <button class="sub-tab-btn active" data-subtab="summary">Summary</button>
            <button class="sub-tab-btn" data-subtab="votes">Full Record</button>
            <button class="sub-tab-btn" data-subtab="agreement">Agreement Scores</button>
          </div>
        </div>
        <div class="sub-panel active" id="sub-summary">${renderVotingSummary(data.vote_summaries)}</div>
        <div class="sub-panel" id="sub-votes">
          <div id="voting-record-table"></div>
          <div class="pagination" id="voting-record-pagination"></div>
        </div>
        <div class="sub-panel" id="sub-agreement"><div id="agreement-results"></div></div>
      </div>

      <!-- SPONSORED BILLS TAB -->
      <div class="tab-panel" id="tab-bills"><div id="bills-results">${renderSponsoredBills(data.sponsored_bills, '', data.sessions)}</div></div>
    `;

    initProfileTabs(peopleId, data);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}


/* ── Report Card ── */

function formatDollars(amount) {
  if (amount == null) return '';
  if (amount >= 1e12) return '$' + (amount / 1e12).toFixed(1) + 'T';
  if (amount >= 1e9) return '$' + (amount / 1e9).toFixed(1) + 'B';
  if (amount >= 1e6) return '$' + (amount / 1e6).toFixed(1) + 'M';
  if (amount >= 1e3) return '$' + (amount / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(amount).toLocaleString();
}

async function loadReportCard(peopleId, session) {
  const el = document.getElementById('report-card-results');
  showLoading(el);

  try {
    const data = await API.get(`/api/legislators/${peopleId}/report-card`, { session });

    const chamberLabel = data.chamber === 'Sen' ? 'Senate' : 'House';
    const peerNote = data.party_peer_count !== data.peer_count
      ? ` (party loyalty ranked among ${data.party_peer_count} same-party peers)`
      : '';

    el.innerHTML = `
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
        ${escHtml(data.display_name)} — compared against <strong>${data.peer_count}</strong> ${chamberLabel} peers${peerNote}
      </div>
      <div class="report-card-grid">
        ${data.metrics.map(m => renderReportCardMetric(m)).join('')}
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error loading report card: ${e.message}</div>`;
  }
}

function renderReportCardMetric(m) {
  let displayVal;
  if (m.format === 'dollars') {
    displayVal = formatDollars(m.value);
  } else if (m.unit === '%') {
    displayVal = m.value + '%';
  } else {
    displayVal = typeof m.value === 'number' ? m.value.toLocaleString() : m.value;
  }

  // Color based on percentile for ranked metrics
  let color = 'var(--primary)';
  if (m.rank && m.peer_count) {
    const pctile = m.percentile || 0;
    if (m.higher_better === true) {
      color = pctile >= 66 ? '#38a169' : pctile >= 33 ? '#b7791f' : '#e53e3e';
    } else if (m.higher_better === false) {
      color = pctile >= 66 ? '#38a169' : pctile >= 33 ? '#b7791f' : '#e53e3e';
    }
  }

  const rankStr = m.rank && m.peer_count ? `
    <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
      Rank <strong>${m.rank}</strong> of ${m.peer_count}
      ${m.avg != null ? ` · avg ${m.unit === '%' ? m.avg + '%' : m.avg}` : ''}
    </div>
  ` : '';

  return `
    <div class="report-card-item">
      <div class="rc-value" style="color:${color}">${displayVal}</div>
      <div class="rc-label">${escHtml(m.label)}</div>
      ${rankStr}
      <div style="font-size:10px;color:var(--text-muted);margin-top:3px">${escHtml(m.context || '')}</div>
    </div>
  `;
}


/* ── Key Votes ── */

async function loadKeyVotes(peopleId, session) {
  const el = document.getElementById('key-votes-results');
  showLoading(el);

  try {
    const votes = await API.get(`/api/legislators/${peopleId}/key-votes`, { session });

    if (!votes.length) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <span>${session ? 'Key Votes This Session' : 'Key Votes (Career)'}</span>
          <span style="font-size:11px;color:var(--text-muted)">Ranked by controversy, party breaks, fiscal impact & news coverage</span>
        </div>
        <div class="card-body" style="padding:0">
          ${votes.map((v, i) => {
            const brk = v.is_party_break ? '<span style="font-size:9px;background:#fde8e8;color:#c53030;padding:1px 6px;border-radius:4px;font-weight:700">PARTY BREAK</span>' : '';
            const fiscal = v.fiscal_amount ? `<span style="font-size:10px;color:var(--text-muted)">${formatDollars(v.fiscal_amount)}</span>` : '';
            const news = v.news_count ? `<span style="font-size:9px;background:#e8f0fe;color:#2b6cb0;padding:1px 5px;border-radius:5px">${v.news_count} news</span>` : '';
            const topics = (v.topics || []).map(t =>
              '<span style="font-size:9px;background:#f0f0f0;padding:1px 5px;border-radius:5px">' + escHtml(t.topic_label) + '</span>'
            ).join(' ');
            const margin = Math.abs(v.yea - v.nay);
            const close = margin <= 5 ? '<span style="font-size:9px;background:#fefce8;color:#b7791f;padding:1px 5px;border-radius:5px">CLOSE VOTE</span>' : '';
            const controversy = v.controversy_score >= 30 ? `<span style="font-size:9px;background:#fff5f5;color:#c53030;padding:1px 5px;border-radius:5px">Controversy: ${Math.round(v.controversy_score)}</span>` : '';

            return `
              <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px${i === 0 ? ';background:#fffbfb' : ''}">
                <div style="min-width:24px;font-size:12px;font-weight:700;color:var(--text-muted);padding-top:2px">#${i + 1}</div>
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">
                    <a href="/bills/${encodeURIComponent(v.source_session || session)}/${v.bill_id}" style="font-weight:700;font-size:13px">${escHtml(v.bill_number)}</a>
                    ${voteBadge(v.vote_desc)}
                    ${brk}${close}${news}${controversy}${fiscal}
                    ${!session && v.session_display ? `<span style="font-size:10px;color:var(--text-muted)">${escHtml(v.session_display)}</span>` : ''}
                  </div>
                  <div style="font-size:12px;color:var(--text-secondary)">${escHtml(truncate(v.title, 100))}</div>
                  ${topics ? '<div style="margin-top:3px">' + topics + '</div>' : ''}
                </div>
                <div style="text-align:right;min-width:55px">
                  ${voteBar(v.yea, v.nay, 0, 0)}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error loading key votes: ${e.message}</div>`;
  }
}


/* ── Charts ── */

function renderCareerCharts(summaries, career) {
  if (summaries.length < 1) return '';

  const sessions = [...summaries].reverse();

  return `
    <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <div class="card-header">Career Vote Breakdown</div>
        <div class="card-body" style="display:flex;align-items:center;justify-content:center;gap:24px;padding:24px">
          ${renderDonut(career)}
        </div>
      </div>
      <div class="card">
        <div class="card-header">Participation by Session</div>
        <div class="card-body" style="padding:16px">
          ${renderBarChart(sessions, 'participation')}
        </div>
      </div>
    </div>
  `;
}

function renderDonut(career) {
  const { yea, nay, nv, absent, total } = career;
  if (total === 0) return '<div class="empty-state">No votes</div>';

  const slices = [
    { val: yea, color: '#38a169', label: 'Yea' },
    { val: nay, color: '#e53e3e', label: 'Nay' },
    { val: nv, color: '#a0aec0', label: 'NV' },
    { val: absent, color: '#ecc94b', label: 'Absent' },
  ].filter(s => s.val > 0);

  const r = 60, cx = 80, cy = 80, stroke = 20;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const arcs = slices.map(s => {
    const pct = s.val / total;
    const dashLen = circumference * pct;
    const arc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}"
      stroke-width="${stroke}" stroke-dasharray="${dashLen} ${circumference - dashLen}"
      stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" />`;
    offset += dashLen;
    return arc;
  });

  const legend = slices.map(s => {
    const pct = ((s.val / total) * 100).toFixed(1);
    return `<div style="display:flex;align-items:center;gap:6px;font-size:13px">
      <span style="width:10px;height:10px;border-radius:2px;background:${s.color};display:inline-block"></span>
      <span><strong>${s.val.toLocaleString()}</strong> ${s.label} (${pct}%)</span>
    </div>`;
  });

  return `
    <svg width="160" height="160" viewBox="0 0 160 160">${arcs.join('')}
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="20" font-weight="700" fill="var(--text)">${total.toLocaleString()}</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="11" fill="var(--text-muted)">total votes</text>
    </svg>
    <div style="display:flex;flex-direction:column;gap:6px">${legend.join('')}</div>
  `;
}

function shortSessionLabel(s) {
  const dn = s.display_name || `${s.year}`;
  const yr = "'" + String(s.year).slice(2);
  if (/Regular/i.test(dn)) return yr;
  const sm = dn.match(/(\d+)\w*\s*Special/i);
  if (sm) return `${yr} S${sm[1]}`;
  if (/Org/i.test(dn)) return `${yr} Org`;
  return yr;
}

function renderBarChart(sessions, mode) {
  if (!sessions.length) return '<div class="empty-state">No data</div>';

  const n = sessions.length;
  const barW = Math.min(36, Math.max(16, Math.floor(700 / n) - 6));
  const gap = 4;
  const chartH = 160;
  const labelH = 40;
  const leftPad = 32;
  const svgW = leftPad + n * (barW + gap) + 10;

  if (mode === 'participation') {
    const values = sessions.map(s => {
      const cast = s.yea_votes + s.nay_votes;
      return s.total_votes > 0 ? (cast / s.total_votes) * 100 : 0;
    });
    const maxVal = 100;

    const bars = sessions.map((s, i) => {
      const val = values[i];
      const h = (val / maxVal) * chartH;
      const x = leftPad + i * (barW + gap);
      const y = chartH - h;
      const color = val >= 90 ? '#38a169' : val >= 70 ? '#ecc94b' : '#e53e3e';
      const label = shortSessionLabel(s);
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="${color}" opacity="0.85">
          <title>${s.display_name}: ${val.toFixed(1)}%</title>
        </rect>
        <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--text)">${val.toFixed(0)}%</text>
        <text x="${x + barW / 2}" y="${chartH + 12}" text-anchor="end" font-size="8" fill="var(--text-muted)" transform="rotate(-60 ${x + barW / 2} ${chartH + 12})">${escHtml(label)}</text>
      `;
    });

    const gridlines = [0, 25, 50, 75, 100].map(v => {
      const y = chartH - (v / maxVal) * chartH;
      return `<line x1="${leftPad - 5}" y1="${y}" x2="${svgW}" y2="${y}" stroke="var(--border)" stroke-dasharray="3,3" />
              <text x="${leftPad - 8}" y="${y + 3}" text-anchor="end" font-size="9" fill="var(--text-muted)">${v}%</text>`;
    });

    return `<div style="overflow-x:auto"><svg width="${svgW}" height="${chartH + labelH}" viewBox="0 0 ${svgW} ${chartH + labelH}">
      ${gridlines.join('')}${bars.join('')}
    </svg></div>`;
  }

  return '';
}


/* ── Voting Summary Table ── */

function renderVotingSummary(summaries) {
  if (!summaries.length) return '<div class="empty-state">No voting data available.</div>';
  return `
    <div class="card"><div class="table-wrap">
      <table>
        <thead><tr>
          <th>Session</th><th>Total Votes</th><th>Yea</th><th>Nay</th>
          <th>NV</th><th>Absent</th><th>Participation</th><th>Breakdown</th>
        </tr></thead>
        <tbody>
          ${summaries.map(s => {
            const participation = s.total_votes > 0
              ? (((s.yea_votes + s.nay_votes) / s.total_votes) * 100).toFixed(1) : '0';
            return `
              <tr>
                <td class="td-nowrap">${escHtml(s.display_name)}</td>
                <td>${s.total_votes}</td>
                <td>${s.yea_votes}</td>
                <td>${s.nay_votes}</td>
                <td>${s.nv_votes}</td>
                <td>${s.absent_votes}</td>
                <td><strong>${participation}%</strong></td>
                <td>${voteBar(s.yea_votes, s.nay_votes, s.nv_votes, s.absent_votes)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div></div>
  `;
}


/* ── Sponsored Bills ── */

function renderSponsoredBills(allBills, session, sessions) {
  const bills = session ? allBills.filter(b => b.source_session === session) : allBills;

  if (!bills.length) return '<div class="empty-state">No sponsored bills found for this session.</div>';

  const primary = bills.filter(b => b.position <= 1);
  const cosponsor = bills.filter(b => b.position > 1);
  const isPassed = b => b.status_desc && /pass|enact|sign|enroll/i.test(b.status_desc);
  const primaryPassed = primary.filter(isPassed);
  const primaryNotPassed = primary.length - primaryPassed.length;
  const passRate = primary.length > 0 ? (primaryPassed.length / primary.length * 100).toFixed(0) : '0';
  const showSession = !session;


  return `
    <div class="report-card-grid" style="margin-bottom:14px">
      <div class="report-card-item">
        <div class="rc-value">${bills.length}</div>
        <div class="rc-label">Total Bills</div>
      </div>
      <div class="report-card-item">
        <div class="rc-value">${primary.length}</div>
        <div class="rc-label">Primary Author</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Filed the bill</div>
      </div>
      <div class="report-card-item">
        <div class="rc-value">${cosponsor.length}</div>
        <div class="rc-label">Co-Sponsored</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Added name in support</div>
      </div>
      <div class="report-card-item">
        <div class="rc-value" style="color:var(--green)">${primaryPassed.length}</div>
        <div class="rc-label">Authored &amp; Passed</div>
      </div>
      <div class="report-card-item">
        <div class="rc-value" style="color:var(--red)">${primaryNotPassed}</div>
        <div class="rc-label">Authored &amp; Did Not Pass</div>
      </div>
      <div class="report-card-item">
        <div class="rc-value" style="color:${parseInt(passRate) >= 20 ? 'var(--green)' : 'var(--text)'}">${passRate}%</div>
        <div class="rc-label">Author Pass Rate</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px">${primaryPassed.length} of ${primary.length} authored</div>
      </div>
    </div>

    <div class="card"><div class="table-wrap">
      <table>
        <thead><tr>
          <th>Bill</th>${showSession ? '<th>Session</th>' : ''}<th>Role</th><th class="td-title">Title</th><th>Status</th><th>Last Action</th>
        </tr></thead>
        <tbody>
          ${bills.map(b => `
            <tr>
              <td class="td-nowrap"><a href="/bills/${encodeURIComponent(b.source_session)}/${b.bill_id}">${escHtml(b.bill_number)}</a></td>
              ${showSession ? `<td class="td-nowrap">${escHtml(b.display_name)}</td>` : ''}
              <td style="font-size:11px">${b.position <= 1 ? '<strong>Primary</strong>' : 'Co-sponsor'}</td>
              <td class="td-title">${escHtml(truncate(b.title, 90))}</td>
              <td class="td-nowrap">${statusBadge(b.status_desc)}</td>
              <td class="td-nowrap">${formatDate(b.last_action_date)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div></div>
  `;
}


/* ── Tab initialization ── */

function initProfileTabs(peopleId, data) {
  const globalSel = document.getElementById('global-session-select');
  const getSession = () => globalSel.value;
  const allSponsoredBills = data.sponsored_bills;

  // Helper to update bills tab content and count
  function updateBillsTab(session) {
    const filtered = session ? allSponsoredBills.filter(b => b.source_session === session) : allSponsoredBills;
    document.getElementById('bills-results').innerHTML = renderSponsoredBills(allSponsoredBills, session, data.sessions);
    document.getElementById('bills-tab-btn').textContent = `Sponsored Bills (${filtered.length})`;
  }

  // Track what's been loaded so we can reload on session change
  const loaded = {
    overview: false, vulnerability: false, toxic: false,
    taxvotes: false, fiscal: false, peers: false,
    votes: false, agreement: false
  };

  // Helper: get currently active main tab and analysis/record sub-tab
  const activeMainTab = () => document.querySelector('#leg-tabs .tab-btn.active')?.dataset.tab;
  const activeAnalysisSub = () => document.querySelector('#analysis-sub-tabs .sub-tab-btn.active')?.dataset.subtab;
  const activeRecordSub = () => document.querySelector('#record-sub-tabs .sub-tab-btn.active')?.dataset.subtab;

  const needsSessionMsg = '<div class="empty-state">Select a specific session above to view this data.</div>';

  // Helper: reload the currently visible content for the given session
  function reloadCurrentView(session) {
    const tab = activeMainTab();

    if (tab === 'overview') {
      loadReportCard(peopleId, session);
      loadKeyVotes(peopleId, session);
    } else if (tab === 'analysis') {
      const sub = activeAnalysisSub();
      if (sub === 'vulnerability') {
        if (!session) loadCareerVulnerability(peopleId);
        else loadVulnerability(peopleId, session);
      }
      else if (sub === 'toxic') {
        if (!session) document.getElementById('toxic-results').innerHTML = needsSessionMsg;
        else loadToxicVotes(peopleId, session);
      }
      else if (sub === 'taxvotes') {
        if (!session) document.getElementById('tax-results').innerHTML = needsSessionMsg;
        else loadTaxVotes(peopleId, session);
      }
      else if (sub === 'fiscal') loadFiscalSummary(peopleId, session);
      else if (sub === 'topics') loadTopicAnalysis(peopleId, session);
      else if (sub === 'peers') {
        if (!session) document.getElementById('peers-results').innerHTML = needsSessionMsg;
        else loadPeerComparison(peopleId, session);
      }
    } else if (tab === 'record') {
      const sub = activeRecordSub();
      if (sub === 'votes') {
        if (!session) document.getElementById('voting-record-table').innerHTML = needsSessionMsg;
        else loadVotingRecord(peopleId, session);
      }
      else if (sub === 'agreement') {
        if (!session) document.getElementById('agreement-results').innerHTML = needsSessionMsg;
        else loadAgreement(peopleId, session);
      }
    } else if (tab === 'bills') {
      updateBillsTab(session);
    }
  }

  // Load overview immediately
  loadReportCard(peopleId, getSession());
  loadKeyVotes(peopleId, getSession());
  loaded.overview = true;

  // Global session change → reload whatever is currently visible + update bills count
  globalSel.addEventListener('change', () => {
    const session = getSession();
    // Mark session-specific tabs as needing reload
    loaded.vulnerability = false; loaded.toxic = false;
    loaded.taxvotes = false; loaded.fiscal = false;
    loaded.peers = false; loaded.votes = false;
    loaded.agreement = false;
    // Always update bills tab count and content
    updateBillsTab(session);
    reloadCurrentView(session);
  });

  // Main tabs
  document.querySelectorAll('#leg-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#leg-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#leg-tabs ~ .tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

      const session = getSession();

      if (btn.dataset.tab === 'analysis') {
        if (window.INTERNAL_MODE && !loaded.vulnerability) {
          loaded.vulnerability = true;
          if (!session) loadCareerVulnerability(peopleId);
          else loadVulnerability(peopleId, session);
        } else if (!window.INTERNAL_MODE) {
          loadTopicAnalysis(peopleId, session);
        }
      }
    });
  });

  // Analysis sub-tabs — always reload on click (session may have changed)
  document.querySelectorAll('#analysis-sub-tabs .sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#analysis-sub-tabs .sub-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#tab-analysis .sub-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`sub-${btn.dataset.subtab}`).classList.add('active');

      const session = getSession();
      const sub = btn.dataset.subtab;

      if (sub === 'vulnerability') {
        if (!session) loadCareerVulnerability(peopleId);
        else loadVulnerability(peopleId, session);
      }
      if (sub === 'toxic') {
        if (!session) document.getElementById('toxic-results').innerHTML = needsSessionMsg;
        else loadToxicVotes(peopleId, session);
      }
      if (sub === 'taxvotes') {
        if (!session) document.getElementById('tax-results').innerHTML = needsSessionMsg;
        else loadTaxVotes(peopleId, session);
      }
      if (sub === 'fiscal') {
        loadFiscalSummary(peopleId, session);
      }
      if (sub === 'topics') {
        loadTopicAnalysis(peopleId, session);
      }
      if (sub === 'peers') {
        if (!session) document.getElementById('peers-results').innerHTML = needsSessionMsg;
        else loadPeerComparison(peopleId, session);
      }
    });
  });

  // Record sub-tabs — always reload on click
  document.querySelectorAll('#record-sub-tabs .sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#record-sub-tabs .sub-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#tab-record .sub-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`sub-${btn.dataset.subtab}`).classList.add('active');

      const session = getSession();
      const sub = btn.dataset.subtab;

      if (sub === 'votes') {
        if (!session) document.getElementById('voting-record-table').innerHTML = needsSessionMsg;
        else loadVotingRecord(peopleId, session);
      }
      if (sub === 'agreement') {
        if (!session) document.getElementById('agreement-results').innerHTML = needsSessionMsg;
        else loadAgreement(peopleId, session);
      }
    });
  });
}


/* ── Voting Record (lazy) ── */

async function loadVotingRecord(peopleId, session, page = 1) {
  const tableEl = document.getElementById('voting-record-table');
  const pagEl = document.getElementById('voting-record-pagination');
  showLoading(tableEl);

  try {
    const data = await API.get(`/api/legislators/${peopleId}/votes`, { session, page, per_page: 30 });
    if (!data.results.length) {
      showEmpty(tableEl, 'No voting records for this session.');
      pagEl.innerHTML = '';
      return;
    }

    tableEl.innerHTML = `
      <div class="card"><div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Bill</th><th class="td-title">Description</th><th>Vote</th><th>Result</th></tr></thead>
          <tbody>
            ${data.results.map(v => `
              <tr>
                <td class="td-nowrap">${formatDate(v.date)}</td>
                <td class="td-nowrap"><a href="/bills/${encodeURIComponent(session)}/${v.bill_id}">${escHtml(v.bill_number)}</a></td>
                <td class="td-title">${escHtml(truncate(v.roll_call_desc || v.bill_title, 80))}</td>
                <td>${voteBadge(v.vote_desc)}</td>
                <td>${voteBar(v.yea, v.nay, v.nv, v.absent)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div></div>
    `;

    renderPagination(pagEl, data, pg => loadVotingRecord(peopleId, session, pg));
  } catch (e) {
    tableEl.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}


/* ── Agreement Scores (lazy) ── */

async function loadAgreement(peopleId, session) {
  const el = document.getElementById('agreement-results');
  showLoading(el);

  try {
    const data = await API.get(`/api/legislators/${peopleId}/agreement`, { session });

    const renderTable = (title, list, showDisagreement) => {
      if (!list.length) return `<p style="color:var(--text-muted);font-size:13px">Not enough data.</p>`;
      const pctCol = showDisagreement ? 'Disagreement' : 'Agreement';
      return `
        <h3 style="font-size:14px;font-weight:700;margin-bottom:8px">${title}</h3>
        <div class="card" style="margin-bottom:16px"><div class="table-wrap">
          <table class="agreement-table">
            <thead><tr><th>Legislator</th><th>Party</th><th>District</th><th>Shared Votes</th><th>${pctCol}</th></tr></thead>
            <tbody>
              ${list.map(r => {
                const pct = showDisagreement ? r.disagreement_pct : r.agreement_pct;
                const color = showDisagreement ? 'var(--red)' : 'var(--green)';
                return `
                  <tr>
                    <td><a href="/legislators/${r.people_id}">${escHtml(r.name)}</a></td>
                    <td>${partyBadge(r.party)}</td>
                    <td>${r.district || '—'}</td>
                    <td>${r.shared_votes}</td>
                    <td style="color:${color};font-weight:700">${pct}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div></div>
      `;
    };

    el.innerHTML = `
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">
        Agreement scores based on roll calls where <strong>both</strong> legislators cast Yea or Nay.
        In Alabama's supermajority Republican legislature, even top opponents may agree on 85%+ of votes.
      </p>
    ` + renderTable('Top Allies', data.allies, false) + renderTable('Top Opponents', data.opponents, true);
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}


/* ── Peer Comparison ── */

async function loadPeerComparison(peopleId, session) {
  const el = document.getElementById('peers-results');
  showLoading(el);

  try {
    const data = await API.get(`/api/legislators/${peopleId}/peers`, { session });

    const chamberLabel = data.chamber === 'Sen' ? 'Senate' : data.chamber === 'Rep' ? 'House' : data.chamber;

    el.innerHTML = `
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
        Compared against <strong>${data.peer_count}</strong> ${chamberLabel} peers.
        The gauge shows where this legislator falls relative to the full range (min to max).
        The diamond marks the chamber average.
      </p>
      <div class="peer-metrics">
        ${data.metrics.map(m => renderPeerMetric(m)).join('')}
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

function renderPeerMetric(m) {
  const range = m.max - m.min;
  const valuePct = range > 0 ? ((m.value - m.min) / range) * 100 : 50;
  const avgPct = range > 0 ? ((m.avg - m.min) / range) * 100 : 50;

  let color;
  if (m.higher_better === null) {
    color = 'var(--primary)';
  } else if (m.higher_better) {
    color = m.percentile >= 66 ? '#38a169' : m.percentile >= 33 ? '#ecc94b' : '#e53e3e';
  } else {
    color = m.percentile <= 33 ? '#38a169' : m.percentile <= 66 ? '#ecc94b' : '#e53e3e';
  }

  const unit = m.unit || '';
  const fmtVal = v => typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1)) : v;

  let vsAvg = '';
  if (m.higher_better === false) {
    if (m.value < m.avg) vsAvg = `<span style="color:#38a169;font-weight:600">${fmtVal(m.avg - m.value)}${unit} fewer</span> than avg`;
    else if (m.value > m.avg) vsAvg = `<span style="color:#e53e3e;font-weight:600">${fmtVal(m.value - m.avg)}${unit} more</span> than avg`;
    else vsAvg = `<span style="color:var(--text-muted);font-weight:600">= avg</span>`;
  } else {
    if (m.value > m.avg) vsAvg = `<span style="color:#38a169;font-weight:600">+${fmtVal(m.value - m.avg)}${unit}</span> above avg`;
    else if (m.value < m.avg) vsAvg = `<span style="color:#e53e3e;font-weight:600">-${fmtVal(m.avg - m.value)}${unit}</span> below avg`;
    else vsAvg = `<span style="color:var(--text-muted);font-weight:600">= avg</span>`;
  }

  return `
    <div class="card" style="margin-bottom:12px">
      <div class="card-body" style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
          <div>
            <span style="font-weight:700;font-size:14px">${escHtml(m.label)}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-left:8px">${escHtml(m.desc)}</span>
          </div>
          <div style="text-align:right">
            <span style="font-size:22px;font-weight:700;color:${color}">${fmtVal(m.value)}${unit}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-left:6px">Rank ${m.rank}/${m.peer_count}</span>
          </div>
        </div>
        <div style="position:relative;height:28px;margin:10px 0 6px">
          <div style="position:absolute;top:10px;left:0;right:0;height:8px;background:var(--bg);border-radius:4px;border:1px solid var(--border)"></div>
          <div style="position:absolute;top:10px;left:0;width:${Math.max(1, valuePct)}%;height:8px;background:${color};border-radius:4px;opacity:0.3"></div>
          <div style="position:absolute;top:4px;left:${valuePct}%;transform:translateX(-50%)">
            <div style="width:14px;height:20px;background:${color};border-radius:3px;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></div>
          </div>
          <div style="position:absolute;top:6px;left:${avgPct}%;transform:translateX(-50%) rotate(45deg);width:10px;height:10px;background:var(--text-muted);border:2px solid white;box-shadow:0 1px 2px rgba(0,0,0,0.15);z-index:1" title="Chamber average: ${fmtVal(m.avg)}${unit}"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted)">
          <span>Min: ${fmtVal(m.min)}${unit}</span>
          <span>${vsAvg}</span>
          <span>Max: ${fmtVal(m.max)}${unit}</span>
        </div>
      </div>
    </div>
  `;
}


/* ── Primary Vulnerability ── */

async function loadCareerVulnerability(peopleId) {
  const el = document.getElementById('vuln-results');
  showLoading(el);

  try {
    const [topData, careerData] = await Promise.all([
      API.get(`/api/legislators/${peopleId}/vulnerability/top`, { limit: 15 }),
      API.get(`/api/legislators/${peopleId}/vulnerability/career`)
    ]);

    if (!topData.votes || !topData.votes.length) {
      el.innerHTML = '<div class="empty-state">No high-risk party-breaking votes found across any session.</div>';
      return;
    }

    const riskColor = score => score >= 60 ? 'var(--red)' : score >= 40 ? '#c05621' : 'var(--yellow)';

    let html = '';

    if (careerData && careerData.career_breaks > 0) {
      html += `<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <div class="stat-card" style="min-width:auto;padding:10px 14px">
          <div class="stat-value" style="font-size:20px;color:var(--red)">${careerData.career_breaks}</div>
          <div class="stat-label">Career Party Breaks</div>
        </div>
        <div class="stat-card" style="min-width:auto;padding:10px 14px">
          <div class="stat-value" style="font-size:20px;color:var(--red)">${careerData.career_break_rate}%</div>
          <div class="stat-label">Break Rate</div>
        </div>
        <div class="stat-card" style="min-width:auto;padding:10px 14px">
          <div class="stat-value" style="font-size:20px">${topData.votes.length}</div>
          <div class="stat-label">High-Risk Votes</div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary)">
          ${careerData.career_votes.toLocaleString()} total votes across ${careerData.sessions.length} sessions
        </div>
      </div>`;
    }

    html += `<h3 style="font-size:13px;font-weight:700;margin-bottom:8px">Most Vulnerable Votes (All Sessions)</h3>`;

    html += topData.votes.map(v => {
      const color = riskColor(v.vulnerability_score);
      const attackLines = v.attack_line || [];
      const topicTags = (v.topics || []).map(t =>
        `<span style="font-size:9px;background:#f0f0f0;padding:1px 5px;border-radius:5px">${escHtml(t.topic_label)}</span>`
      ).join(' ');
      return `
        <div class="card" style="margin-bottom:8px;border-left:4px solid ${color}">
          <div class="card-body" style="padding:10px 14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
              <div style="flex:1;min-width:250px">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap">
                  <a href="/bills/${encodeURIComponent(v.source_session)}/${v.bill_id}" style="font-weight:700;font-size:13px">${escHtml(v.bill_number)}</a>
                  ${voteBadge(v.vote_desc)}
                  <span style="font-size:10px;color:var(--text-muted)">${escHtml(v.session_display || '')}</span>
                  ${v.news_count > 0 ? `<span style="font-size:9px;background:#e8f0fe;color:#2b6cb0;padding:1px 5px;border-radius:5px">${v.news_count} news</span>` : ''}
                </div>
                ${attackLines.length ? `<div style="font-size:12px;font-weight:600;color:var(--red);margin-bottom:3px">${escHtml(attackLines[0])}</div>` : ''}
                ${attackLines.length > 1 ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">${escHtml(attackLines[1])}</div>` : ''}
                ${attackLines.length > 2 ? `<div style="font-size:11px;font-weight:600;color:#744210;background:#fefce8;padding:3px 8px;border-radius:4px;display:inline-block;margin-bottom:2px">${escHtml(attackLines[2])}</div>` : ''}
                <div style="font-size:10px;color:var(--text-muted)">${formatDate(v.date)}</div>
                ${topicTags ? `<div style="margin-top:2px">${topicTags}</div>` : ''}
              </div>
              <div style="text-align:right;min-width:60px">
                <div style="font-size:16px;font-weight:700;color:${color};line-height:1">${v.vulnerability_score}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error loading career vulnerability: ${e.message}</div>`;
  }
}


async function loadVulnerability(peopleId, session) {
  const el = document.getElementById('vuln-results');
  showLoading(el);

  try {
    const data = await API.get(`/api/legislators/${peopleId}/vulnerability`, { session });

    if (data.error) { showEmpty(el, data.error); return; }
    if (!data.votes.length) {
      showEmpty(el, 'No party-breaking votes found for this session.');
      return;
    }

    const riskColor = score => score >= 60 ? 'var(--red)' : score >= 40 ? '#c05621' : score >= 20 ? 'var(--yellow)' : 'var(--text-muted)';
    const riskLabel = score => score >= 60 ? 'HIGH RISK' : score >= 40 ? 'MODERATE' : score >= 20 ? 'LOW RISK' : 'MINOR';

    const topVote = data.votes[0];
    const topAttack = topVote.attack_line || [];

    let html = `
      <div class="card" style="margin-bottom:14px;border-left:4px solid var(--red);background:#fffbfb">
        <div class="card-body" style="padding:16px 18px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--red);margin-bottom:6px">Most Vulnerable Vote This Session</div>
          <div style="font-size:15px;font-weight:600;margin-bottom:4px">
            ${topAttack.length ? escHtml(topAttack[0]) : `${escHtml(data.legislator.name)} <a href="/bills/${encodeURIComponent(session)}/${topVote.bill_id}">${escHtml(topVote.bill_number)}</a>`}
          </div>
          ${topAttack.length > 1 ? `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:2px">${escHtml(topAttack[1])}</div>` : ''}
          <div style="font-size:12px;color:var(--text-muted)">${escHtml(topVote.context)} &middot; <a href="/bills/${encodeURIComponent(session)}/${topVote.bill_id}">${escHtml(topVote.bill_number)}</a></div>
        </div>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
        <div class="stat-card" style="min-width:auto;padding:12px 16px">
          <div class="stat-value" style="font-size:22px;color:var(--red)">${data.total_party_breaks}</div>
          <div class="stat-label">Party Breaks</div>
        </div>
        <div class="stat-card" style="min-width:auto;padding:12px 16px">
          <div class="stat-value" style="font-size:22px;color:#c05621">${data.high_risk_votes}</div>
          <div class="stat-label">High-Risk</div>
        </div>
      </div>
    `;

    if (data.topic_summary && data.topic_summary.length) {
      html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
        <span class="vuln-filter active" data-filter="all" style="font-size:11px;padding:3px 10px;border-radius:10px;cursor:pointer;border:1px solid var(--primary);background:var(--primary-light);color:var(--primary);font-weight:600">All (${data.votes.length})</span>
        <span class="vuln-filter" data-filter="high" style="font-size:11px;padding:3px 10px;border-radius:10px;cursor:pointer;border:1px solid var(--border);color:var(--text-secondary);font-weight:600">High Risk Only</span>
        ${data.topic_summary.filter(t => t.weight >= 7).map(t =>
          `<span class="vuln-filter" data-filter="topic:${t.label}" style="font-size:11px;padding:3px 10px;border-radius:10px;cursor:pointer;border:1px solid var(--border);color:var(--text-secondary);font-weight:600">${escHtml(t.label)} (${t.count})</span>`
        ).join('')}
      </div>`;
    }

    const topicColors = {
      guns: '#c53030', immigration: '#c53030', social_cultural: '#9b2c2c',
      elections: '#b7791f', taxes: '#c05621', criminal_justice: '#744210',
      education: '#2b6cb0', healthcare: '#276749', government: '#718096',
      business_economy: '#4a5568'
    };

    html += `<div id="vuln-vote-list">
      ${data.votes.map(v => {
        const color = riskColor(v.vulnerability_score);
        const label = riskLabel(v.vulnerability_score);
        const topicNames = (v.topics || []).map(t => t.topic_label).join(',');
        const topicTags = (v.topics || []).map(t =>
          `<span style="font-size:10px;background:#f0f0f0;padding:1px 6px;border-radius:6px;color:${topicColors[t.topic] || '#666'}">${escHtml(t.topic_label)}</span>`
        ).join(' ');
        return `
          <div class="vuln-card" data-risk="${v.vulnerability_score >= 60 ? 'high' : 'other'}" data-topics="${escHtml(topicNames)}" style="margin-bottom:8px">
            <div class="card" style="border-left:4px solid ${color}">
              <div class="card-body" style="padding:10px 14px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
                  <div style="flex:1;min-width:250px">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">
                      <a href="/bills/${encodeURIComponent(session)}/${v.bill_id}" style="font-weight:700;font-size:13px">${escHtml(v.bill_number)}</a>
                      ${voteBadge(v.vote_desc)}
                      ${v.news_count > 0 ? `<span style="font-size:10px;background:#e8f0fe;color:#2b6cb0;padding:1px 5px;border-radius:6px">${v.news_count} news</span>` : ''}
                    </div>
                    ${v.attack_line && v.attack_line.length ? `<div style="font-size:12px;font-weight:600;color:var(--red);margin-bottom:3px">${escHtml(v.attack_line[0])}</div>` : ''}
                    ${v.attack_line && v.attack_line.length > 1 ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">${escHtml(v.attack_line[1])}</div>` : ''}
                    ${v.attack_line && v.attack_line.length > 2 ? `<div style="font-size:11px;font-weight:600;color:#744210;background:#fefce8;padding:3px 8px;border-radius:4px;display:inline-block;margin-bottom:2px">${escHtml(v.attack_line[2])}</div>` : ''}
                    <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${formatDate(v.date)}</div>
                    ${topicTags ? `<div style="margin-top:3px">${topicTags}</div>` : ''}
                  </div>
                  <div style="text-align:right;min-width:70px">
                    <div style="font-size:18px;font-weight:700;color:${color};line-height:1">${v.vulnerability_score}</div>
                    <div style="font-size:9px;font-weight:700;color:${color};text-transform:uppercase">${label}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>`;

    el.innerHTML = html;

    // Wire up filters
    el.querySelectorAll('.vuln-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.vuln-filter').forEach(b => {
          b.style.background = ''; b.style.color = 'var(--text-secondary)'; b.style.borderColor = 'var(--border)';
          b.classList.remove('active');
        });
        btn.style.background = 'var(--primary-light)'; btn.style.color = 'var(--primary)'; btn.style.borderColor = 'var(--primary)';
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        el.querySelectorAll('.vuln-card').forEach(card => {
          if (filter === 'all') card.style.display = '';
          else if (filter === 'high') card.style.display = card.dataset.risk === 'high' ? '' : 'none';
          else if (filter.startsWith('topic:')) {
            const topic = filter.replace('topic:', '');
            card.style.display = card.dataset.topics.includes(topic) ? '' : 'none';
          }
        });
      });
    });
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}


/* ── Fiscal Impact ── */

function impactColor(direction) {
  const colors = { increase: '#dc3545', decrease: '#28a745', neutral: '#6c757d', mixed: '#fd7e14', undetermined: '#adb5bd' };
  return colors[direction] || '#adb5bd';
}

async function loadFiscalSummary(peopleId, session) {
  const el = document.getElementById('fiscal-results');
  showLoading(el);

  try {
    const params = {};
    if (session) params.session = session;
    const data = await API.get(`/api/legislators/${peopleId}/fiscal-summary`, params);

    if (!data.summary.length && !data.top_bills.length) {
      showEmpty(el, 'No fiscal note data available for this legislator\'s votes.');
      return;
    }

    const summaryCards = data.summary.map(s => {
      const labels = { increase: 'Spending Increases', decrease: 'Spending Decreases', neutral: 'No Fiscal Impact', mixed: 'Mixed Impact', undetermined: 'Undetermined' };
      return `
        <div class="stat-card" style="border-left:3px solid ${impactColor(s.impact_direction)}">
          <div class="stat-value">${s.bill_count}</div>
          <div class="stat-label">${labels[s.impact_direction] || s.impact_direction}</div>
          ${s.total_amount ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">Total: ${formatDollars(s.total_amount)}</div>` : ''}
        </div>
      `;
    }).join('');

    const topBillRows = data.top_bills.map(b => `
      <tr>
        <td class="td-nowrap"><a href="/bills/${encodeURIComponent(b.source_session)}/${b.bill_id || ''}">${escHtml(b.bill_number)}</a></td>
        <td class="td-title">${escHtml(b.title)}</td>
        <td class="td-nowrap" style="font-weight:600">${b.max_amount ? formatDollars(b.max_amount) : '-'}</td>
        <td><span style="color:${impactColor(b.impact_direction)};font-weight:600">${escHtml(b.impact_direction)}</span></td>
        <td>${voteBadge(b.vote_desc)}</td>
        <td class="td-nowrap" style="font-size:12px;color:var(--text-muted)">${escHtml(b.display_name)}</td>
      </tr>
    `).join('');

    el.innerHTML = `
      <div class="stats-grid" style="margin-bottom:16px">${summaryCards}</div>
      ${data.top_bills.length ? `
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
            <span>Top Bills by Fiscal Impact</span>
            <span style="font-size:11px;color:var(--text-muted);font-weight:400">Showing top 20 of ${data.summary.reduce((a,s) => a + s.bill_count, 0)} bills with fiscal notes</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Bill</th><th class="td-title">Title</th><th>Max Amount</th><th>Impact</th><th>Vote</th><th>Session</th></tr></thead>
              <tbody>${topBillRows}</tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `;
  } catch (e) {
    showEmpty(el, 'Error loading fiscal data: ' + e.message);
  }
}


/* ── Tax Votes ── */

async function loadTaxVotes(peopleId, session) {
  const el = document.getElementById('tax-results');
  showLoading(el);

  try {
    const [data, career] = await Promise.all([
      API.get(`/api/legislators/${peopleId}/tax-votes`, { session }),
      API.get(`/api/legislators/${peopleId}/tax-votes/career`)
    ]);

    if (!data.score) {
      showEmpty(el, 'No tax-raising bill votes found for this session.');
      return;
    }

    const s = data.score;
    const proTax = s.advancing_yea + s.blocking_nay;
    const antiTax = s.advancing_nay + s.blocking_yea;
    const total = proTax + antiTax;
    const supportPct = total > 0 ? (proTax / total * 100).toFixed(1) : '—';
    const supportColor = parseFloat(supportPct) >= 80 ? 'var(--red)' :
                         parseFloat(supportPct) >= 50 ? '#c05621' : 'var(--green)';

    let html = `
      <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
        <div class="stat-card" style="min-width:auto;padding:12px 16px">
          <div class="stat-value" style="font-size:22px;color:${supportColor}">${supportPct}%</div>
          <div class="stat-label">Pro-Tax Rate</div>
        </div>
        <div class="stat-card" style="min-width:auto;padding:12px 16px">
          <div class="stat-value" style="font-size:22px;color:var(--red)">${proTax}</div>
          <div class="stat-label">Pro-Tax Votes</div>
        </div>
        <div class="stat-card" style="min-width:auto;padding:12px 16px">
          <div class="stat-value" style="font-size:22px;color:var(--green)">${antiTax}</div>
          <div class="stat-label">Anti-Tax Votes</div>
        </div>
    `;

    if (career && career.career) {
      const c = career.career;
      const cColor = c.tax_support_pct >= 80 ? 'var(--red)' : c.tax_support_pct >= 50 ? '#c05621' : 'var(--green)';
      html += `
        <div style="flex:1;min-width:200px">
          <span style="font-size:20px;font-weight:700;color:${cColor}">${c.tax_support_pct !== null ? c.tax_support_pct + '%' : '—'}</span>
          <span style="font-size:12px;color:var(--text-muted)">career pro-tax rate</span>
          <div style="font-size:11px;color:var(--text-secondary)">
            <strong style="color:var(--red)">${c.pro_tax_votes}</strong> pro /
            <strong style="color:var(--green)">${c.anti_tax_votes}</strong> anti across ${career.sessions.length} sessions
          </div>
        </div>
      `;
    }
    html += `</div>`;

    html += `<p style="font-size:11px;color:var(--text-muted);margin-bottom:10px">
      Pro-tax = Yea on advancing motions or Nay on blocking motions. Counts every procedural vote, not just final passage.
    </p>`;

    if (data.votes.length) {
      html += `
        <div class="card"><div class="card-header">Individual Votes on Tax-Raising Bills (${data.votes.length})</div><div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Bill</th><th class="td-title">Description</th><th>Vote</th><th>Stance</th></tr></thead>
            <tbody>
              ${data.votes.map(v => {
                const stanceColor = v.tax_stance === 'pro-tax' ? 'var(--red)' : 'var(--green)';
                const stanceLabel = v.tax_stance === 'pro-tax' ? 'PRO-TAX' : 'ANTI-TAX';
                return `<tr>
                  <td class="td-nowrap">${formatDate(v.date)}</td>
                  <td class="td-nowrap"><a href="/bills/${encodeURIComponent(session)}/${v.bill_id}">${escHtml(v.bill_number)}</a></td>
                  <td class="td-title" style="font-size:11px">${escHtml(truncate(v.title || '', 50))}</td>
                  <td>${voteBadge(v.vote_desc)}</td>
                  <td><span style="color:${stanceColor};font-weight:700;font-size:11px">${stanceLabel}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div></div>
      `;
    }

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}


/* ── Toxic Exposure ── */

/* ── Topic Analysis ── */

const topicColors = {
  taxes: '#c05621', criminal_justice: '#744210', education: '#2b6cb0',
  healthcare: '#276749', elections: '#b7791f', guns: '#c53030',
  government: '#718096', social_cultural: '#9b2c2c', business_economy: '#4a5568',
  immigration: '#c53030'
};

async function loadTopicAnalysis(peopleId, session) {
  const el = document.getElementById('topic-results');
  showLoading(el);

  try {
    // Always load Option A (public-safe)
    const promises = [
      API.get(`/api/legislators/${peopleId}/topic-engagement`, { session })
    ];

    // Load Options B and C only in internal mode
    if (window.INTERNAL_MODE) {
      promises.push(API.get(`/api/legislators/${peopleId}/topic-alignment`, { session }));
      if (session) {
        promises.push(API.get(`/api/legislators/${peopleId}/topic-spectrum`, { session }));
      }
    }

    const results = await Promise.all(promises);
    const engagement = results[0];
    const alignment = results[1] || null;
    const spectrum = results[2] || null;

    if (!engagement.length) {
      showEmpty(el, 'No topic data available.');
      return;
    }

    let html = '';

    // === Option A: Topic Engagement (always shown) ===
    html += `<h3 style="font-size:14px;font-weight:700;margin-bottom:10px">Topic Engagement</h3>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:12px">How active this legislator is on each policy area — bills voted on, authored, and co-sponsored.</p>
      <div class="card" style="margin-bottom:16px"><div class="table-wrap">
        <table>
          <thead><tr><th>Topic</th><th>Bills Voted On</th><th>Total Votes</th><th>Yea</th><th>Nay</th><th>Authored</th><th>Co-Sponsored</th></tr></thead>
          <tbody>
            ${engagement.map(t => {
              const color = topicColors[t.topic] || '#718096';
              const cosponsor = t.bills_sponsored - t.bills_authored;
              return `<tr>
                <td style="font-weight:600;color:${color}">${escHtml(t.label)}</td>
                <td>${t.bills_voted_on}</td>
                <td>${t.total_votes}</td>
                <td style="color:var(--green)">${t.yea_votes}</td>
                <td style="color:var(--red)">${t.nay_votes}</td>
                <td style="font-weight:600">${t.bills_authored}</td>
                <td>${cosponsor > 0 ? cosponsor : '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div></div>`;

    // === Option B: Party Alignment by Topic (internal only) ===
    if (alignment && alignment.topics && alignment.topics.length) {
      const partyLabel = alignment.party === 'R' ? 'Republican' : 'Democrat';
      html += `<h3 style="font-size:14px;font-weight:700;margin-bottom:10px">
        Party Alignment by Topic
        <span style="font-size:10px;font-weight:400;color:var(--red);margin-left:8px">INTERNAL ONLY</span>
      </h3>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:12px">How often this legislator votes with the ${partyLabel} majority on each topic.</p>
      <div class="card" style="margin-bottom:16px"><div class="card-body" style="padding:0">
        ${alignment.topics.map(t => {
          const color = topicColors[t.topic] || '#718096';
          const pct = t.alignment_pct;
          const barColor = pct >= 95 ? '#38a169' : pct >= 85 ? '#b7791f' : '#e53e3e';
          return `<div style="display:flex;align-items:center;gap:12px;padding:8px 16px;border-bottom:1px solid var(--border)">
            <div style="width:140px;font-weight:600;font-size:12px;color:${color}">${escHtml(t.topic_label)}</div>
            <div style="flex:1;position:relative;height:20px;background:var(--bg);border-radius:4px;overflow:hidden">
              <div style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${barColor};border-radius:4px;opacity:0.7"></div>
            </div>
            <div style="width:50px;text-align:right;font-weight:700;font-size:14px;color:${barColor}">${pct}%</div>
            <div style="width:80px;text-align:right;font-size:11px;color:var(--text-muted)">${t.against_party} break${t.against_party !== 1 ? 's' : ''}</div>
          </div>`;
        }).join('')}
      </div></div>`;
    }

    // === Option C: Voting Pattern Comparison (internal only, session-specific) ===
    if (spectrum && spectrum.topics && spectrum.topics.length) {
      html += `<h3 style="font-size:14px;font-weight:700;margin-bottom:10px">
        Cross-Party Voting Comparison
        <span style="font-size:10px;font-weight:400;color:var(--red);margin-left:8px">INTERNAL ONLY</span>
      </h3>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:12px">
        How often this legislator agrees with ${escHtml(spectrum.party_label)} peers vs. ${escHtml(spectrum.other_party_label)} peers on each topic.
        Lower ${escHtml(spectrum.party_label)} agreement = more independent on that issue.
      </p>
      <div class="card"><div class="table-wrap">
        <table>
          <thead><tr>
            <th>Topic</th>
            <th>Agrees with ${escHtml(spectrum.party_label)}s</th>
            <th>Agrees with ${escHtml(spectrum.other_party_label)}s</th>
            <th>Gap</th>
            <th>Votes</th>
          </tr></thead>
          <tbody>
            ${spectrum.topics.map(t => {
              const color = topicColors[t.topic] || '#718096';
              const samePct = t.same_party_pct != null ? t.same_party_pct : 0;
              const otherPct = t.other_party_pct != null ? t.other_party_pct : 0;
              const gap = samePct - otherPct;
              const gapColor = Math.abs(gap) < 10 ? '#b7791f' : gap > 0 ? '#38a169' : '#e53e3e';
              const gapLabel = gap > 0 ? `+${gap.toFixed(0)}` : gap.toFixed(0);
              return `<tr>
                <td style="font-weight:600;color:${color}">${escHtml(t.label)}</td>
                <td style="font-weight:700;color:#2b6cb0">${samePct != null ? samePct + '%' : 'N/A'}</td>
                <td style="font-weight:700;color:#c53030">${otherPct != null ? otherPct + '%' : 'N/A'}</td>
                <td style="font-weight:700;color:${gapColor}">${gapLabel}pp</td>
                <td style="color:var(--text-muted)">${t.votes}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div></div>`;
    } else if (window.INTERNAL_MODE && !session) {
      html += `<div style="font-size:12px;color:var(--text-muted);margin-top:12px;font-style:italic">Select a specific session above to see cross-party voting comparison.</div>`;
    }

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error loading topic analysis: ${e.message}</div>`;
  }
}


/* ── Toxic Exposure ── */

async function loadToxicVotes(peopleId, session) {
  const el = document.getElementById('toxic-results');
  showLoading(el);

  try {
    const data = await API.get(`/api/legislators/${peopleId}/toxic-votes`, { session });

    if (!data.categories || !data.categories.length) {
      showEmpty(el, 'No toxic exposure found for this session.');
      return;
    }

    const catColors = {
      'Self-Dealing': '#c53030', 'Big Spending': '#c05621', 'Soft on Crime': '#9b2c2c',
      'Voted Against Victims/Heroes': '#744210', 'Symbolic/Patriotic': '#2b6cb0',
      'Gun Restrictions': '#c53030', 'Weak on Immigration': '#c53030',
      'Tax/Fee Increases': '#c05621', 'Gambling': '#b7791f', 'Corporate Welfare': '#4a5568',
      'Education Culture War': '#276749', 'Utility Capture': '#718096'
    };

    let html = `<div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div class="stat-card" style="min-width:auto;padding:12px 16px">
        <div class="stat-value" style="font-size:22px;color:var(--red)">${data.total_exposed || data.categories.reduce((a,c) => a + c.count, 0)}</div>
        <div class="stat-label">Toxic Bills Voted On</div>
      </div>
      <div class="stat-card" style="min-width:auto;padding:12px 16px">
        <div class="stat-value" style="font-size:22px">${data.categories.length}</div>
        <div class="stat-label">Categories</div>
      </div>
    </div>`;

    html += data.categories.map(cat => {
      const catName = cat.label || cat.category || 'Unknown';
      const color = catColors[catName] || '#718096';
      return `
        <div class="card" style="margin-bottom:10px;border-left:4px solid ${color}">
          <div class="card-body" style="padding:12px 16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-weight:700;font-size:14px;color:${color}">${escHtml(catName)}</span>
              <span style="font-size:12px;color:var(--text-muted)">${cat.bills.length} bill${cat.bills.length !== 1 ? 's' : ''}</span>
            </div>
            ${cat.bills.map(b => `
              <div style="padding:4px 0;font-size:12px;border-top:1px solid var(--border)">
                <a href="/bills/${encodeURIComponent(session)}/${b.bill_id}" style="font-weight:600">${escHtml(b.bill_number)}</a>
                <span style="color:var(--text-secondary)">${escHtml(truncate(b.attack_angle || b.title || '', 80))}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}
