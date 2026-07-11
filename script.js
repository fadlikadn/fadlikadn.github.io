/* ============================================================
   Live GitHub data for the profile homepage.
   Everything is fetched client-side from the GitHub public REST
   API on every page load, so the page always reflects the
   current metrics — no rebuild or backend needed.

   Unauthenticated GitHub API allows 60 requests/hour per IP.
   We use 3 requests per load and keep a short localStorage
   cache purely as a fallback when the API rate-limits us.
   ============================================================ */

const USER = 'fadlikadn';
const API = 'https://api.github.com';
const CACHE_KEY = 'gh-cache-' + USER;
const CACHE_TTL = 5 * 60 * 1000; // 5 min fallback window

// GitHub's language color palette (subset of the common ones).
const LANG_COLORS = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
  Rust: '#dea584', Go: '#00ADD8', PHP: '#4F5D95', HTML: '#e34c26',
  CSS: '#563d7c', Shell: '#89e051', Vue: '#41b883', Ruby: '#701516',
  Java: '#b07219', 'C#': '#178600', 'C++': '#f34b7d', Dart: '#00B4AB',
  Svelte: '#ff3e00', Kotlin: '#A97BFF', Swift: '#F05138',
};

document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  const units = [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  for (const [sec, label] of units) if (s >= sec) return Math.floor(s / sec) + label + ' ago';
  return 'just now';
}

function animateCount(el, target) {
  const dur = 900, start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(target * eased));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function ghFetch(path) {
  const res = await fetch(API + path, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('GitHub API ' + res.status + ' for ' + path);
  return res.json();
}

/* ---------- rendering ---------- */
function renderStats(user, repos) {
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks = repos.reduce((s, r) => s + r.forks_count, 0);
  const years = new Date().getFullYear() - new Date(user.created_at).getFullYear();

  const map = {
    repos: user.public_repos,
    stars: totalStars,
    followers: user.followers,
    forks: totalForks,
    following: user.following,
    years: years,
  };
  for (const [key, val] of Object.entries(map)) {
    const el = $(`[data-stat="${key}"]`);
    if (el) animateCount(el, val);
  }
  if (user.bio) $('#hero-bio').textContent = user.bio;
}

function renderLanguages(repos) {
  const counts = {};
  repos.forEach((r) => { if (r.language) counts[r.language] = (counts[r.language] || 0) + 1; });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = entries.reduce((s, [, c]) => s + c, 0);

  const box = $('#lang-chart');
  if (!entries.length) { box.innerHTML = '<p class="muted">No language data available.</p>'; return; }

  box.innerHTML = entries.map(([lang, count]) => {
    const pct = Math.round((count / total) * 100);
    const color = LANG_COLORS[lang] || '#8b8fa3';
    return `<div class="lang-row">
      <span class="lang-row__name" style="color:${color}">${lang}</span>
      <span class="lang-row__bar"><span class="lang-row__fill" style="width:${pct}%;background:linear-gradient(90deg, ${color}, var(--accent))"></span></span>
      <span class="lang-row__pct">${pct}%</span>
    </div>`;
  }).join('');
}

function renderActivity(events) {
  const box = $('#activity-feed');
  const icons = { PushEvent: '📦', CreateEvent: '✨', WatchEvent: '⭐', ForkEvent: '🍴', PullRequestEvent: '🔀', IssuesEvent: '📋', ReleaseEvent: '🚀', IssueCommentEvent: '💬', DeleteEvent: '🗑️', PublicEvent: '🌍' };

  const describe = (e) => {
    const repo = e.repo.name.replace(USER + '/', '');
    switch (e.type) {
      case 'PushEvent': { const n = e.payload.commits?.length || e.payload.size || 1; return `Pushed <b>${n}</b> commit${n > 1 ? 's' : ''} to <b>${repo}</b>`; }
      case 'CreateEvent': return `Created ${e.payload.ref_type} in <b>${repo}</b>`;
      case 'WatchEvent': return `Starred <b>${repo}</b>`;
      case 'ForkEvent': return `Forked <b>${repo}</b>`;
      case 'PullRequestEvent': return `${e.payload.action} a PR in <b>${repo}</b>`;
      case 'IssuesEvent': return `${e.payload.action} an issue in <b>${repo}</b>`;
      case 'ReleaseEvent': return `Released in <b>${repo}</b>`;
      case 'IssueCommentEvent': return `Commented in <b>${repo}</b>`;
      case 'PublicEvent': return `Open-sourced <b>${repo}</b>`;
      default: return `Activity in <b>${repo}</b>`;
    }
  };

  const items = events.filter((e) => icons[e.type]).slice(0, 7);
  if (!items.length) { box.innerHTML = '<li class="muted">No recent public activity.</li>'; return; }

  box.innerHTML = items.map((e) => `
    <li>
      <span class="activity__ico">${icons[e.type] || '•'}</span>
      <span class="activity__txt">${describe(e)}<br><span class="activity__when">${timeAgo(e.created_at)}</span></span>
    </li>`).join('');
}

function renderRepos(repos) {
  const top = repos
    .filter((r) => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, 6);

  const grid = $('#repo-grid');
  if (!top.length) { grid.innerHTML = '<p class="muted">No public repositories found.</p>'; return; }

  grid.innerHTML = top.map((r) => {
    const color = LANG_COLORS[r.language] || '#8b8fa3';
    return `<a class="repo" href="${r.html_url}" target="_blank" rel="noopener">
      <div class="repo__head">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="#9aa0b0" aria-hidden="true"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/></svg>
        <span class="repo__name">${r.name}</span>
      </div>
      <p class="repo__desc">${r.description ? escapeHtml(r.description) : 'No description provided.'}</p>
      <div class="repo__meta">
        ${r.language ? `<span class="repo__lang"><span class="repo__dot" style="background:${color}"></span>${r.language}</span>` : ''}
        <span>⭐ ${fmt(r.stargazers_count)}</span>
        <span>🍴 ${fmt(r.forks_count)}</span>
        <span style="margin-left:auto">${timeAgo(r.pushed_at)}</span>
      </div>
    </a>`;
  }).join('');
}

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ---------- Activity-overview radar (Commits / Code review / PRs / Issues) ----------
   Built from GitHub's public Search API (its own rate-limit bucket, ~10 req/min
   unauthenticated). Approximates GitHub's native "Activity overview" from public data. */
async function searchCount(kind, q, accept) {
  const url = `${API}/search/${kind}?q=${encodeURIComponent(q)}&per_page=1`;
  const res = await fetch(url, { headers: { Accept: accept || 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('search ' + res.status);
  const j = await res.json();
  return j.total_count || 0;
}

function renderRadar(counts) {
  // Clockwise from top, matching GitHub's layout.
  const axes = [
    { key: 'Code review',   dir: 'top' },
    { key: 'Issues',        dir: 'right' },
    { key: 'Pull requests', dir: 'bottom' },
    { key: 'Commits',       dir: 'left' },
  ];
  const total = axes.reduce((s, a) => s + (counts[a.key] || 0), 0);
  const max = Math.max(...axes.map((a) => counts[a.key] || 0), 1);

  const box = document.getElementById('radar');
  if (!box) return;
  if (!total) { box.innerHTML = '<p class="muted">No public contribution data available right now.</p>'; return; }

  const W = 320, H = 250, cx = 160, cy = 120, R = 74;
  const ends = { top: [cx, cy - R], right: [cx + R, cy], bottom: [cx, cy + R], left: [cx - R, cy] };
  const GREEN = '#3fb950';

  const pts = axes.map((a) => {
    const v = counts[a.key] || 0;
    const f = v / max;                       // scale so the largest axis reaches the ring
    const [ex, ey] = ends[a.dir];
    return { ...a, v, pct: Math.round((v / total) * 100), x: cx + (ex - cx) * f, y: cy + (ey - cy) * f };
  });
  const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const label = (a) => {
    const p = pts.find((x) => x.key === a.key);
    const anchors = {
      top:    { x: cx,        y: cy - R - 30, anchor: 'middle' },
      right:  { x: cx + R + 12, y: cy - 6,    anchor: 'start'  },
      bottom: { x: cx,        y: cy + R + 20, anchor: 'middle' },
      left:   { x: cx - R - 12, y: cy - 6,    anchor: 'end'    },
    }[a.dir];
    return `<text x="${anchors.x}" y="${anchors.y}" text-anchor="${anchors.anchor}" class="radar__lbl">
        <tspan x="${anchors.x}" class="radar__pct">${p.pct}%</tspan>
        <tspan x="${anchors.x}" dy="17" class="radar__name">${a.key}</tspan>
      </text>`;
  };

  box.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="radar__svg" role="img" aria-label="Contribution activity radar: ${pts.map((p) => p.key + ' ' + p.pct + '%').join(', ')}">
      <line x1="${ends.left[0]}" y1="${ends.left[1]}" x2="${ends.right[0]}" y2="${ends.right[1]}" class="radar__axis"/>
      <line x1="${ends.top[0]}" y1="${ends.top[1]}" x2="${ends.bottom[0]}" y2="${ends.bottom[1]}" class="radar__axis"/>
      <polygon points="${poly}" class="radar__poly"/>
      ${pts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${GREEN}"/>`).join('')}
      ${axes.map(label).join('')}
    </svg>`;
}

function renderTotals(counts) {
  const box = document.getElementById('contrib-totals');
  if (!box) return;
  const rows = [
    { k: 'Commits', ico: '📦', v: counts['Commits'] },
    { k: 'Pull requests', ico: '🔀', v: counts['Pull requests'] },
    { k: 'Code reviews', ico: '👀', v: counts['Code review'] },
    { k: 'Issues', ico: '📋', v: counts['Issues'] },
  ];
  box.innerHTML = rows.map((r) => `
    <li>
      <span class="activity__ico">${r.ico}</span>
      <span class="activity__txt"><b>${fmt(r.v)}</b> ${r.k}<br><span class="activity__when">indexed public contributions</span></span>
    </li>`).join('');
}

async function loadRadar() {
  try {
    const [commits, prs, issues, reviews] = await Promise.all([
      searchCount('commits', `author:${USER}`, 'application/vnd.github.cloak-preview+json'),
      searchCount('issues', `author:${USER} type:pr`),
      searchCount('issues', `author:${USER} type:issue`),
      searchCount('issues', `reviewed-by:${USER} type:pr`),
    ]);
    const counts = { 'Commits': commits, 'Pull requests': prs, 'Issues': issues, 'Code review': reviews };
    renderRadar(counts);
    renderTotals(counts);
    try { localStorage.setItem(CACHE_KEY + '-radar', JSON.stringify({ t: Date.now(), counts })); } catch {}
  } catch (err) {
    console.warn('Radar fetch failed:', err.message);
    const raw = localStorage.getItem(CACHE_KEY + '-radar');
    if (raw) { try { const { counts } = JSON.parse(raw); renderRadar(counts); renderTotals(counts); return; } catch {} }
    const box = document.getElementById('radar');
    if (box) box.innerHTML = '<p class="muted">Breakdown unavailable — GitHub Search API rate limit. Try again shortly.</p>';
    document.getElementById('contrib-totals').innerHTML = '<li class="muted">Could not load totals.</li>';
  }
}

function markSynced(fromCache) {
  const el = $('#last-sync');
  const t = new Date().toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
  el.textContent = fromCache ? `cached · ${t} (API rate-limited)` : `updated ${t}`;
}

/* ---------- orchestration ---------- */
async function load() {
  try {
    const [user, repos, events] = await Promise.all([
      ghFetch(`/users/${USER}`),
      ghFetch(`/users/${USER}/repos?per_page=100&sort=pushed`),
      ghFetch(`/users/${USER}/events/public?per_page=30`),
    ]);

    renderStats(user, repos);
    renderLanguages(repos);
    renderActivity(events);
    renderRepos(repos);
    markSynced(false);

    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), user, repos, events })); } catch {}
  } catch (err) {
    console.warn('Live fetch failed, trying cache:', err.message);
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      try {
        const { user, repos, events } = JSON.parse(raw);
        renderStats(user, repos);
        renderLanguages(repos);
        renderActivity(events);
        renderRepos(repos);
        markSynced(true);
        return;
      } catch {}
    }
    $('#last-sync').textContent = 'GitHub API unavailable — try again shortly';
    $('#lang-chart').innerHTML = '<p class="muted">Could not load — GitHub API rate limit or offline.</p>';
    $('#activity-feed').innerHTML = '<li class="muted">Could not load activity.</li>';
    $('#repo-grid').innerHTML = '<p class="muted">Could not load repositories — please retry in a bit.</p>';
  }
}

/* ---------- scroll reveal ---------- */
function initReveal() {
  const els = $$('.section, .hero__text, .hero__avatar-wrap');
  els.forEach((el) => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  els.forEach((el) => io.observe(el));
}

initReveal();
load();
loadRadar();
