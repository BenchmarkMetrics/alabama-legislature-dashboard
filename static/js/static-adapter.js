/* ── Static Site API Adapter ── */
/* Overrides API.get() to fetch from static JSON files instead of Flask endpoints */
(function() {
  const BASE = window.BASE_URL || '';

  API.get = async function(url, params = {}) {
    // Map API URLs to static JSON file paths
    let jsonPath = mapToStaticPath(url, params);
    if (jsonPath) {
      const resp = await fetch(BASE + jsonPath);
      if (!resp.ok) throw new Error(`Static data not found: ${BASE + jsonPath}`);
      return resp.json();
    }
    // Fallback (should not happen in static mode)
    throw new Error(`No static data for: ${url}`);
  };

  function mapToStaticPath(url, params) {
    const session = params.session || '';

    // Sessions list
    if (url === '/api/sessions') return '/api/sessions.json';

    // Dashboard
    if (url === '/api/dashboard') return `/api/dashboard/${session}.json`;

    // Stats (legacy)
    if (url === '/api/stats') return `/api/dashboard/${session}.json`;

    // Recent activity (served from dashboard)
    if (url === '/api/recent-activity') return `/api/dashboard/${session}.json`;

    // Quick search
    if (url === '/api/search/quick') {
      // Client-side search — handled separately
      return null;
    }

    // Controversial bills
    if (url === '/api/controversial') return `/api/controversial/${session || 'default'}.json`;

    // Bill list / search
    if (url === '/api/bills') return `/api/bills/list/${session || '2026-2026_Regular_Session'}.json`;

    // Bill statuses
    if (url === '/api/bills/statuses') return '/api/bills/statuses.json';

    // Bill topics
    if (url === '/api/bills/topics') return '/api/bills/topics.json';

    // Voting analysis
    if (url === '/api/votes/party-line') return `/api/votes/party-line-${session}.json`;
    if (url === '/api/votes/close') return `/api/votes/close-${session}.json`;
    if (url === '/api/votes/bipartisan') return `/api/votes/bipartisan-${session}.json`;

    // Bill detail
    let m = url.match(/\/api\/bills\/([^/]+)\/([^/]+)$/);
    if (m) return `/api/bills/${m[1]}/${m[2]}.json`;

    // Roll call votes
    m = url.match(/\/api\/rollcalls\/([^/]+)\/([^/]+)\/votes$/);
    if (m) return `/api/rollcalls/${m[1]}/${m[2]}.json`;

    // Bill news
    m = url.match(/\/api\/bills\/([^/]+)\/([^/]+)\/news$/);
    if (m) return `/api/news/${m[1]}/${m[2]}.json`;

    // Bill fiscal notes
    m = url.match(/\/api\/bills\/([^/]+)\/([^/]+)\/fiscal-notes$/);
    if (m) return `/api/fiscal/${m[1]}/${m[2]}.json`;

    // Legislator profile
    m = url.match(/\/api\/legislators\/(\d+)$/);
    if (m) return `/api/legislators/${m[1]}.json`;

    // Legislator topic engagement
    m = url.match(/\/api\/legislators\/(\d+)\/topic-engagement$/);
    if (m) return `/api/legislators/${m[1]}-topics.json`;

    // Legislator report card
    m = url.match(/\/api\/legislators\/(\d+)\/report-card$/);
    if (m) return `/api/legislators/${m[1]}-report-card.json`;

    // Legislator key votes
    m = url.match(/\/api\/legislators\/(\d+)\/key-votes$/);
    if (m) return `/api/legislators/${m[1]}-key-votes.json`;

    // Legislator peers
    m = url.match(/\/api\/legislators\/(\d+)\/peers$/);
    if (m) return `/api/legislators/${m[1]}-peers.json`;

    // Legislator agreement
    m = url.match(/\/api\/legislators\/(\d+)\/agreement$/);
    if (m) return `/api/legislators/${m[1]}-agreement.json`;

    // Legislator votes (paginated)
    m = url.match(/\/api\/legislators\/(\d+)\/votes$/);
    if (m) return `/api/legislators/${m[1]}-votes-${session}.json`;

    // Legislator list
    if (url === '/api/legislators') return '/api/legislators/list.json';
    if (url === '/api/legislators/list') return '/api/legislators/list.json';

    // Fulltext stats
    if (url === '/api/fulltext/stats') return '/api/fulltext-stats.json';

    return null;
  }
})();

/* ── Client-side Quick Search (replaces /api/search/quick) ── */
(function() {
  let billIndex = null;
  let legIndex = null;

  const originalSearch = API.get;

  // Override only for search
  const _get = API.get;
  API.get = async function(url, params = {}) {
    if (url === '/api/search/quick') {
      return clientSideSearch(params.q || '');
    }
    return _get.call(this, url, params);
  };

  async function clientSideSearch(q) {
    if (!q || q.length < 2) return { bills: [], legislators: [] };

    // Lazy load indexes
    if (!billIndex) {
      try { billIndex = await (await fetch(BASE + '/api/search/bills.json')).json(); } catch(e) { billIndex = []; }
    }
    if (!legIndex) {
      try { legIndex = await (await fetch(BASE + '/api/search/legislators.json')).json(); } catch(e) { legIndex = []; }
    }

    const lower = q.toLowerCase();
    const bills = billIndex.filter(b =>
      b.bill_number.toLowerCase().includes(lower) || b.title.toLowerCase().includes(lower)
    ).slice(0, 6);

    const legislators = legIndex.filter(l =>
      l.name.toLowerCase().includes(lower)
    ).slice(0, 6);

    return { bills, legislators };
  }
})();
