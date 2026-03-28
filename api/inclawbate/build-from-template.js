// Build a page from a pre-made template — no AI generation needed
// POST { template, data, slug } → publishes to inclawbate.app/s/{slug}
import { readFileSync } from 'fs';
import { join } from 'path';

const TEMPLATES = {
    'token-landing': {
        file: 'token-landing.html',
        required: ['TOKEN_NAME', 'TOKEN_SYMBOL', 'TOKEN_ADDRESS'],
        defaults: {
            TOKEN_EMOJI: '🪙',
            CHAIN: 'Base',
            LP_FEE_SPLIT: '80/20',
            WEBSITE_URL: '#',
            WEBSITE_DISPLAY: '-',
            X_HANDLE: '',
            TELEGRAM_URL: '#',
            STAKING_BUTTON: '',
            ABOUT_SECTION: '',
            TOKEN_DESCRIPTION: 'A token on Base.',
        }
    },
    'presale': {
        file: 'presale.html',
        required: ['TOKEN_NAME', 'TOKEN_SYMBOL', 'PRESALE_PRICE', 'HARD_CAP'],
        defaults: {
            TOKEN_EMOJI: '🚀',
            TOKEN_ADDRESS: '0x...',
            TOKEN_DESCRIPTION: 'Get in early.',
            CHAIN: 'Base',
            RAISED_ETH: '0',
            PROGRESS_PCT: '0',
            MIN_BUY: '0.01',
            MAX_BUY: '1',
            TOTAL_SUPPLY: '1,000,000,000',
            PRESALE_ALLOCATION: '30%',
            PRESALE_CONTRACT: '0x...',
            ABOUT_SECTION: '',
            TOKENOMICS_SECTION: '',
        }
    },
    'project-landing': {
        file: 'project-landing.html',
        required: ['PROJECT_NAME'],
        defaults: {
            PROJECT_EMOJI: '🚀',
            PROJECT_TAGLINE: 'Building the future.',
            PROJECT_DESCRIPTION: '',
            PRIMARY_CTA_URL: '#',
            PRIMARY_CTA_TEXT: 'Get Started',
            SECONDARY_CTA_URL: '#',
            SECONDARY_CTA_TEXT: 'Learn More',
            FEATURE_1_ICON: '⚡', FEATURE_1_TITLE: 'Fast', FEATURE_1_DESC: 'Built for speed.',
            FEATURE_2_ICON: '🔒', FEATURE_2_TITLE: 'Secure', FEATURE_2_DESC: 'Built for safety.',
            FEATURE_3_ICON: '🌍', FEATURE_3_TITLE: 'Open', FEATURE_3_DESC: 'Built for everyone.',
            ABOUT_SECTION: '',
            LINK_PILLS: '',
        }
    }
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — list available templates
    if (req.method === 'GET') {
        return res.json({
            templates: Object.entries(TEMPLATES).map(([id, t]) => ({
                id,
                required: t.required,
                defaults: Object.keys(t.defaults)
            }))
        });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { template, data, slug } = req.body;
    if (!template || !TEMPLATES[template]) {
        return res.status(400).json({ error: 'Invalid template. Available: ' + Object.keys(TEMPLATES).join(', ') });
    }
    if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'data object required' });
    }

    const tmpl = TEMPLATES[template];

    // Check required fields
    const missing = tmpl.required.filter(f => !data[f]);
    if (missing.length > 0) {
        return res.status(400).json({ error: 'Missing required fields: ' + missing.join(', ') });
    }

    // Read template file
    let html;
    try {
        const templatePath = join(process.cwd(), 'inclawbate', 'templates', tmpl.file);
        html = readFileSync(templatePath, 'utf-8');
    } catch (e) {
        return res.status(500).json({ error: 'Template file not found: ' + tmpl.file });
    }

    // Merge defaults + user data
    const merged = { ...tmpl.defaults, ...data };

    // Replace all {{PLACEHOLDERS}}
    for (const [key, value] of Object.entries(merged)) {
        const regex = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
        html = html.replace(regex, String(value || ''));
    }

    // Clean up any remaining unreplaced placeholders
    html = html.replace(/\{\{[A-Z_]+\}\}/g, '');

    // Generate slug
    const pageSlug = slug || (data.TOKEN_NAME || data.PROJECT_NAME || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

    // Publish via publish-site API
    try {
        const publishRes = await fetch('https://www.inclawbate.app/api/publish-site', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                slug: pageSlug,
                html,
                creator_wallet: data.creator_wallet || '0x91b5c0d07859cfeafeb67d9694121cd741f049bd',
                creator_x_handle: data.creator_x_handle || '',
                app_name: data.TOKEN_NAME || data.PROJECT_NAME || pageSlug,
                description: data.TOKEN_DESCRIPTION || data.PROJECT_DESCRIPTION || '',
            })
        });
        const publishData = await publishRes.json();
        if (publishData.error) {
            return res.status(500).json({ error: 'Publish failed: ' + publishData.error });
        }

        return res.json({
            ok: true,
            url: 'https://inclawbate.app/s/' + pageSlug,
            slug: pageSlug,
            template
        });
    } catch (e) {
        return res.status(500).json({ error: 'Publish error: ' + e.message });
    }
}
