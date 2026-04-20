/* ── Bill Search Page ── */
document.addEventListener('DOMContentLoaded', () => {
  const sessionSelect = document.getElementById('filter-session');
  const keywordInput = document.getElementById('filter-keyword');
  const statusSelect = document.getElementById('filter-status');
  const topicSelect = document.getElementById('filter-topic');
  const chamberSelect = document.getElementById('filter-chamber');
  const resultsBody = document.getElementById('bills-results');
  const resultsWrap = document.getElementById('bills-table-wrap');
  const paginationEl = document.getElementById('bills-pagination');

  const params = getParams();

  // Populate filters
  populateSessionSelect(sessionSelect, params.session || '');
  loadStatuses();
  loadTopics();

  if (params.q) keywordInput.value = params.q;
  if (params.chamber) chamberSelect.value = params.chamber;

  // Initial load
  searchBills();

  // Events
  document.getElementById('bills-search-form').addEventListener('submit', e => {
    e.preventDefault();
    searchBills(1);
  });

  keywordInput.addEventListener('input', debounce(() => searchBills(1)));
  sessionSelect.addEventListener('change', () => searchBills(1));
  statusSelect.addEventListener('change', () => searchBills(1));
  topicSelect.addEventListener('change', () => searchBills(1));
  chamberSelect.addEventListener('change', () => searchBills(1));

  async function loadStatuses() {
    try {
      const statuses = await API.get('/api/bills/statuses');
      statusSelect.innerHTML = '<option value="">All Statuses</option>';
      statuses.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.status;
        opt.textContent = s.status_desc || `Status ${s.status}`;
        if (String(s.status) === params.status) opt.selected = true;
        statusSelect.appendChild(opt);
      });
    } catch (e) {}
  }

  async function loadTopics() {
    try {
      const topics = await API.get('/api/bills/topics');
      topicSelect.innerHTML = '<option value="">All Topics</option>';
      topics.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.topic;
        opt.textContent = `${t.topic_label} (${t.count.toLocaleString()})`;
        if (t.topic === params.topic) opt.selected = true;
        topicSelect.appendChild(opt);
      });
    } catch (e) {}
  }

  async function searchBills(page) {
    const p = {
      session: sessionSelect.value,
      q: keywordInput.value.trim(),
      status: statusSelect.value,
      topic: topicSelect.value,
      chamber: chamberSelect.value,
      page: page || params.page || 1
    };
    setParams(p);
    showLoading(resultsWrap);

    try {
      const data = await API.get('/api/bills', p);
      if (!data.results.length) {
        showEmpty(resultsWrap);
        paginationEl.innerHTML = '';
        return;
      }

      resultsWrap.innerHTML = `<table>
        <thead><tr>
          <th>Bill</th><th>Session</th><th class="td-title">Title</th>
          <th>Status</th><th>Topics</th><th>Last Action</th>
        </tr></thead>
        <tbody id="bills-results"></tbody>
      </table>`;

      const tbody = document.getElementById('bills-results');
      tbody.innerHTML = data.results.map(b => `
        <tr>
          <td class="td-nowrap"><a href="/bills/${encodeURIComponent(b.source_session)}/${b.bill_id}">${escHtml(b.bill_number)}</a></td>
          <td class="td-nowrap">${escHtml(b.display_name)}</td>
          <td class="td-title">${escHtml(truncate(b.title, 120))}</td>
          <td class="td-nowrap">${statusBadge(b.status_desc)}</td>
          <td>${(b.topics || []).map(t => `<span class="topic-tag">${escHtml(t)}</span>`).join(' ')}</td>
          <td class="td-nowrap">${formatDate(b.last_action_date)}</td>
        </tr>
      `).join('');

      renderPagination(paginationEl, data, pg => searchBills(pg));
    } catch (e) {
      resultsWrap.innerHTML = `<div class="empty-state">Error loading bills: ${e.message}</div>`;
    }
  }
});
