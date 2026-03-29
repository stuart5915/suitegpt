// XML Sitemap for Inclawbate — lists all app landing pages for Google indexing

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
    const { data: apps } = await sb
        .from('user_apps')
        .select('slug, updated_at, created_at')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

    const urls = [
        // Homepage
        { loc: 'https://inclawbate.app/', priority: '1.0', changefreq: 'daily' },
        // Core product pages
        { loc: 'https://inclawbate.app/inclawbator', priority: '0.9', changefreq: 'daily' },
        { loc: 'https://inclawbate.app/apps', priority: '0.9', changefreq: 'daily' },
        { loc: 'https://inclawbate.app/skills', priority: '0.8', changefreq: 'weekly' },
        { loc: 'https://inclawbate.app/tokens', priority: '0.8', changefreq: 'daily' },
        { loc: 'https://inclawbate.app/stake', priority: '0.8', changefreq: 'daily' },
        { loc: 'https://inclawbate.app/claws', priority: '0.8', changefreq: 'weekly' },
        { loc: 'https://inclawbate.app/explore', priority: '0.8', changefreq: 'daily' },
        { loc: 'https://inclawbate.app/ecosystem', priority: '0.8', changefreq: 'weekly' },
        // Products / Incubations
        { loc: 'https://inclawbate.app/pokerai', priority: '0.7', changefreq: 'weekly' },
        { loc: 'https://inclawbate.app/oddsclaw', priority: '0.7', changefreq: 'weekly' },
        { loc: 'https://inclawbate.app/crash', priority: '0.6', changefreq: 'weekly' },
        { loc: 'https://inclawbate.app/compute', priority: '0.7', changefreq: 'weekly' },
        { loc: 'https://inclawbate.app/nfts', priority: '0.6', changefreq: 'weekly' },
        // Info pages
        { loc: 'https://inclawbate.app/about', priority: '0.7', changefreq: 'monthly' },
        { loc: 'https://inclawbate.app/docs', priority: '0.7', changefreq: 'weekly' },
        { loc: 'https://inclawbate.app/whitepaper', priority: '0.6', changefreq: 'monthly' },
        { loc: 'https://inclawbate.app/blog', priority: '0.7', changefreq: 'weekly' },
        { loc: 'https://inclawbate.app/how-it-works', priority: '0.6', changefreq: 'monthly' },
        // Builder pages
        { loc: 'https://inclawbate.app/build', priority: '0.7', changefreq: 'weekly' },
        { loc: 'https://inclawbate.app/tools', priority: '0.6', changefreq: 'weekly' },
        { loc: 'https://inclawbate.app/agents', priority: '0.6', changefreq: 'weekly' },
        { loc: 'https://inclawbate.app/leaderboard', priority: '0.5', changefreq: 'daily' },
        // Community
        { loc: 'https://inclawbate.app/team', priority: '0.5', changefreq: 'monthly' },
        { loc: 'https://inclawbate.app/partners', priority: '0.5', changefreq: 'monthly' },
        { loc: 'https://inclawbate.app/philanthropy', priority: '0.5', changefreq: 'monthly' },
        // Legal
        { loc: 'https://inclawbate.app/terms', priority: '0.3', changefreq: 'monthly' },
        { loc: 'https://inclawbate.app/privacy-policy', priority: '0.3', changefreq: 'monthly' },
    ];

    // Add all app landing pages
    if (apps) {
        for (const app of apps) {
            const lastmod = (app.updated_at || app.created_at || '').slice(0, 10);
            urls.push({
                loc: `https://inclawbate.app/app/${app.slug}`,
                priority: '0.6',
                changefreq: 'monthly',
                lastmod: lastmod || undefined,
            });
        }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.send(xml);
}
