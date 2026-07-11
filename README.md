# Fadlika Dita Nurjanto — Profile Homepage

A single-page, zero-build personal homepage for GitHub Pages. All GitHub metrics are
fetched **client-side from the GitHub public REST API on every page load**, so the page
always reflects the current numbers — whenever your GitHub activity changes, the next
visit shows the updated data. No backend, no rebuild.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Structure + static profile content (bio, journey, certs, links) |
| `styles.css` | Dark, glassmorphism + gradient theme, fully responsive |
| `script.js` | Live GitHub data: stats, top languages, recent activity, top repos |

## What updates live (from GitHub)

- Public repos, total stars, followers, total forks, following, years on GitHub
- Top languages (computed from your repositories)
- Recent public activity feed (pushes, stars, PRs, releases, …)
- Top repositories by stars
- Contribution graph (via `ghchart.rshah.org`, regenerated on request)

The GitHub API allows 60 unauthenticated requests/hour per visitor IP; this page uses 3
per load and keeps a 5-minute `localStorage` fallback for the rare rate-limit case.

## Deploy to GitHub Pages

### Option A — user site at `https://fadlikadn.github.io` (recommended)

```bash
# 1. Create a public repo named exactly: fadlikadn.github.io
gh repo create fadlikadn.github.io --public

# 2. From this homepage/ folder:
git init
git add index.html styles.css script.js README.md
git commit -m "feat: personal profile homepage with live GitHub stats"
git branch -M main
git remote add origin https://github.com/fadlikadn/fadlikadn.github.io.git
git push -u origin main
```

GitHub Pages auto-serves `fadlikadn.github.io` repos. Live in ~1 minute at
`https://fadlikadn.github.io/`.

### Option B — project site (any repo)

Push these files, then: **Settings → Pages → Source: Deploy from a branch → `main` / root**.
Served at `https://fadlikadn.github.io/<repo>/`.

## Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Customize

- Colors: edit the `:root` variables in `styles.css`.
- GitHub username: change `const USER` at the top of `script.js`.
- Static content (journey, certifications, links): edit `index.html` directly.
