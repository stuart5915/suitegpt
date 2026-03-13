// SEO Landing Page for Inclawbate Apps
// Serves at /app/{slug} — server-rendered HTML with meta tags, OG, structured data

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const CATEGORY_LABELS = {
    tools: 'Tools', games: 'Games', creative: 'Creative',
    finance: 'Finance', social: 'Social', other: 'Other', defi: 'DeFi',
};
const CATEGORY_ICONS = {
    tools: '\u{1F6E0}', games: '\u{1F3AE}', creative: '\u{1F3A8}',
    finance: '\u{1F4B0}', social: '\u{1F4AC}', other: '\u{1F4E6}', defi: '\u{26D3}',
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripHtml(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '').trim();
}

export default async function handler(req, res) {
    const slug = (req.query.slug || '').toLowerCase().trim();
    if (!slug) return res.status(400).send('Missing slug');

    // Fetch app
    const { data: app, error } = await sb
        .from('user_apps')
        .select('id, name, slug, description, category, claws_price, creator_wallet, creator_x_handle, tags, upvote_count, created_at, is_public, app_url')
        .eq('slug', slug)
        .eq('is_public', true)
        .maybeSingle();

    if (error || !app) {
        // Debug: return error details
        if (req.query.debug === '1') {
            return res.json({ error: error?.message, slug, hasUrl: !!process.env.SUPABASE_URL, app });
        }
        return res.status(404).send(render404());
    }

    // Fetch related apps (same category, exclude current)
    const { data: related } = await sb
        .from('user_apps')
        .select('name, slug, description, category, upvote_count')
        .eq('category', app.category)
        .eq('is_public', true)
        .neq('slug', slug)
        .order('upvote_count', { ascending: false })
        .limit(6);

    // Fetch total app count for footer
    const { count: totalApps } = await sb
        .from('user_apps')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.send(renderPage(app, related || [], totalApps || 0));
}

function renderPage(app, related, totalApps) {
    const title = escapeHtml(app.name);
    const desc = escapeHtml(stripHtml(app.description) || `${app.name} — free app on Inclawbate`);
    const descShort = desc.length > 160 ? desc.slice(0, 157) + '...' : desc;
    const cat = CATEGORY_LABELS[app.category] || 'App';
    const catIcon = CATEGORY_ICONS[app.category] || '\u{1F4E6}';
    const url = `https://inclawbate.com/app/${app.slug}`;
    const appUrl = `/s/${app.slug}`;
    const price = app.claws_price > 0 ? `${app.claws_price} CLAWS` : 'Free';
    const creator = app.creator_x_handle ? `@${escapeHtml(app.creator_x_handle)}` : '';
    const tags = Array.isArray(app.tags) ? app.tags : [];
    const date = new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: app.name,
        description: stripHtml(app.description),
        url: url,
        applicationCategory: cat,
        operatingSystem: 'Web',
        offers: {
            '@type': 'Offer',
            price: app.claws_price || 0,
            priceCurrency: app.claws_price > 0 ? 'CLAWS' : 'USD',
        },
        aggregateRating: app.upvote_count > 0 ? {
            '@type': 'AggregateRating',
            ratingValue: Math.min(5, 3.5 + app.upvote_count * 0.1),
            ratingCount: app.upvote_count,
            bestRating: 5,
        } : undefined,
    });

    const relatedHtml = related.map(r => `
        <a href="/app/${escapeHtml(r.slug)}" class="related-card">
            <div class="related-icon">${CATEGORY_ICONS[r.category] || '\u{1F4E6}'}</div>
            <div class="related-info">
                <div class="related-name">${escapeHtml(r.name)}</div>
                <div class="related-desc">${escapeHtml((stripHtml(r.description) || '').slice(0, 80))}</div>
            </div>
        </a>`).join('');

    const tagsHtml = tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Free on Inclawbate</title>
<meta name="description" content="${descShort}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="${title} — Free on Inclawbate">
<meta property="og:description" content="${descShort}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Inclawbate">

<!-- Twitter -->
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${descShort}">
<meta name="twitter:site" content="@inclawbate">

<link rel="icon" type="image/png" href="/assets/claw-logo.png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

<script type="application/ld+json">${jsonLd}</script>

<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0a0f;--bg-card:#12121a;--bg-card-hover:#1a1a28;--border:#1e1e2e;--accent:#6366f1;--accent-hover:#818cf8;--text:#e2e2e8;--text-dim:#6b6b80;--text-muted:#3a3a4a;--green:#4ade80;--radius:12px}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}
a:hover{color:var(--accent-hover)}
::selection{background:rgba(99,102,241,0.3)}

.nav{display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(10,10,15,0.95);backdrop-filter:blur(12px);z-index:100}
.nav-brand{font-weight:800;font-size:1.1rem;color:var(--text);letter-spacing:-0.02em}
.nav-links{display:flex;gap:1.5rem;font-size:0.85rem;font-weight:500}
.nav-links a{color:var(--text-dim);transition:color 0.2s}
.nav-links a:hover{color:var(--text)}

.container{max-width:720px;margin:0 auto;padding:2.5rem 1.5rem}

.breadcrumb{font-size:0.8rem;color:var(--text-dim);margin-bottom:1.5rem}
.breadcrumb a{color:var(--text-dim)}
.breadcrumb a:hover{color:var(--accent)}

.app-header{margin-bottom:2rem}
.app-meta-row{display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;flex-wrap:wrap}
.cat-badge{display:inline-flex;align-items:center;gap:0.35rem;padding:0.25rem 0.75rem;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:20px;font-size:0.75rem;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:0.04em}
.price-badge{padding:0.25rem 0.65rem;border-radius:20px;font-size:0.75rem;font-weight:600;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.2);color:var(--green)}
.upvotes{font-size:0.8rem;color:var(--text-dim)}

h1{font-size:2.2rem;font-weight:800;letter-spacing:-0.03em;line-height:1.2;margin-bottom:0.75rem}
.app-desc{font-size:1.05rem;color:var(--text-dim);line-height:1.7;margin-bottom:1.5rem}

.cta-row{display:flex;gap:0.75rem;margin-bottom:1.5rem;flex-wrap:wrap}
.btn-primary{display:inline-flex;align-items:center;gap:0.5rem;padding:0.75rem 2rem;background:var(--accent);color:#fff;font-weight:700;font-size:0.95rem;border-radius:8px;transition:background 0.2s;border:none;cursor:pointer}
.btn-primary:hover{background:var(--accent-hover);color:#fff}
.btn-secondary{display:inline-flex;align-items:center;gap:0.5rem;padding:0.75rem 1.5rem;background:transparent;color:var(--text-dim);font-weight:600;font-size:0.9rem;border-radius:8px;border:1px solid var(--border);transition:all 0.2s}
.btn-secondary:hover{border-color:var(--text-dim);color:var(--text)}

.app-details{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:2rem;padding:1.25rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius)}
.detail-item{font-size:0.85rem}
.detail-label{color:var(--text-muted);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.15rem}
.detail-value{color:var(--text);font-weight:500}

.tags{display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:2rem}
.tag{padding:0.2rem 0.6rem;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;font-size:0.75rem;color:var(--text-dim)}

.section-title{font-size:1.1rem;font-weight:700;margin-bottom:1rem;letter-spacing:-0.02em}

.related-grid{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:2.5rem}
.related-card{display:flex;gap:0.75rem;padding:1rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);transition:all 0.2s;text-decoration:none}
.related-card:hover{border-color:rgba(99,102,241,0.3);background:var(--bg-card-hover)}
.related-icon{font-size:1.5rem;flex-shrink:0;width:36px;text-align:center}
.related-info{min-width:0}
.related-name{font-weight:600;font-size:0.85rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.related-desc{font-size:0.75rem;color:var(--text-dim);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

.footer{text-align:center;padding:2rem;border-top:1px solid var(--border);font-size:0.8rem;color:var(--text-muted)}
.footer a{color:var(--text-dim)}

@media(max-width:600px){
    h1{font-size:1.6rem}
    .container{padding:1.5rem 1rem}
    .app-details{grid-template-columns:1fr}
    .related-grid{grid-template-columns:1fr}
    .nav{padding:0.75rem 1rem}
    .nav-links{gap:1rem;font-size:0.8rem}
}
</style>
</head>
<body>

<nav class="nav">
    <a href="/" class="nav-brand">Inclawbate</a>
    <div class="nav-links">
        <a href="/apps">Apps</a>
        <a href="/tools">Tools</a>
        <a href="/build">Build</a>
        <a href="/dashboard">Dashboard</a>
    </div>
</nav>

<div class="container">
    <div class="breadcrumb">
        <a href="/">Home</a> / <a href="/apps">Apps</a> / <a href="/apps?category=${escapeHtml(app.category)}">${cat}</a> / ${title}
    </div>

    <div class="app-header">
        <div class="app-meta-row">
            <span class="cat-badge">${catIcon} ${cat}</span>
            <span class="price-badge">${price}</span>
            ${app.upvote_count > 0 ? `<span class="upvotes">\u{1F44D} ${app.upvote_count} upvotes</span>` : ''}
        </div>
        <h1>${title}</h1>
        <div class="app-desc">${desc}</div>

        <div class="cta-row">
            <a href="${appUrl}" class="btn-primary">\u{1F680} Open App</a>
            <a href="/apps" class="btn-secondary">Browse All Apps</a>
        </div>
    </div>

    <div class="app-details">
        <div class="detail-item">
            <div class="detail-label">Category</div>
            <div class="detail-value">${cat}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Price</div>
            <div class="detail-value">${price}</div>
        </div>
        ${creator ? `<div class="detail-item">
            <div class="detail-label">Creator</div>
            <div class="detail-value">${creator}</div>
        </div>` : ''}
        <div class="detail-item">
            <div class="detail-label">Published</div>
            <div class="detail-value">${date}</div>
        </div>
    </div>

    ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ''}

    ${relatedHtml ? `
    <h2 class="section-title">More ${cat} Apps</h2>
    <div class="related-grid">${relatedHtml}</div>
    ` : ''}
</div>

<footer class="footer">
    <p>${totalApps}+ free apps on <a href="/">Inclawbate</a>. <a href="/build">Build your own</a> in minutes.</p>
</footer>

</body>
</html>`;
}

function render404() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>App Not Found — Inclawbate</title>
<style>body{background:#0a0a0f;color:#e2e2e8;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
h1{font-size:2rem;margin-bottom:1rem}a{color:#6366f1}</style>
</head>
<body><div><h1>App not found</h1><p><a href="/apps">Browse all apps</a></p></div></body>
</html>`;
}
