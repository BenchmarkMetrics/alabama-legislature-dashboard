/* ── Legislator Browse Page ── */
document.addEventListener('DOMContentLoaded', () => {
  const sessionSelect = document.getElementById('filter-session');
  const nameInput = document.getElementById('filter-name');
  const partySelect = document.getElementById('filter-party');
  const chamberSelect = document.getElementById('filter-chamber');
  const minSessionsSelect = document.getElementById('filter-min-sessions');
  const gridEl = document.getElementById('legislators-grid');
  const paginationEl = document.getElementById('legislators-pagination');

  const params = getParams();

  populateSessionSelect(sessionSelect, params.session || '');
  if (params.q) nameInput.value = params.q;
  if (params.party) partySelect.value = params.party;
  if (params.chamber) chamberSelect.value = params.chamber;
  if (params.min_sessions) minSessionsSelect.value = params.min_sessions;

  searchLegislators();

  nameInput.addEventListener('input', debounce(() => searchLegislators(1)));
  sessionSelect.addEventListener('change', () => searchLegislators(1));
  partySelect.addEventListener('change', () => searchLegislators(1));
  chamberSelect.addEventListener('change', () => searchLegislators(1));
  minSessionsSelect.addEventListener('change', () => searchLegislators(1));

  async function searchLegislators(page) {
    const p = {
      session: sessionSelect.value,
      q: nameInput.value.trim(),
      party: partySelect.value,
      chamber: chamberSelect.value,
      min_sessions: minSessionsSelect.value,
      page: page || params.page || 1
    };
    setParams(p);
    showLoading(gridEl);

    try {
      const data = await API.get('/api/legislators', p);
      if (!data.results.length) {
        showEmpty(gridEl);
        paginationEl.innerHTML = '';
        return;
      }

      gridEl.innerHTML = `<div class="legislator-grid">${data.results.map(leg => `
        <div class="leg-card">
          <div class="leg-card-name">
            <a href="/legislators/${leg.people_id}">${escHtml(leg.name)}</a>
          </div>
          <div class="leg-card-meta">
            ${partyBadge(leg.party)}
            <span>${escHtml(leg.role || '')}</span>
            ${leg.district ? `<span>District ${escHtml(leg.district)}</span>` : ''}
          </div>
          <div class="leg-card-stats">
            <span><strong>${leg.sessions_served}</strong> session${leg.sessions_served !== 1 ? 's' : ''}</span>
            <span><strong>${leg.total_bills_sponsored}</strong> bills sponsored</span>
          </div>
        </div>
      `).join('')}</div>`;

      renderPagination(paginationEl, data, pg => searchLegislators(pg));
    } catch (e) {
      gridEl.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
  }
});
