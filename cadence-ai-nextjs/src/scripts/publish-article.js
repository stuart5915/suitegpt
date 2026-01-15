const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values.length) {
            process.env[key.trim()] = values.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

async function publish() {
    const filePath = path.resolve(__dirname, '../../content/articles/yield-powered-app.md');
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Parse frontmatter
    const match = fileContent.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
    if (!match) { console.error('Bad frontmatter'); process.exit(1); }

    const frontmatter = {};
    match[1].split('\n').forEach(line => {
        const [k, ...v] = line.split(':');
        if (k) frontmatter[k.trim()] = v.join(':').trim().replace(/^["']|["']$/g, '');
    });

    const title = frontmatter.title || 'Untitled';
    const body = match[2].trim();
    const slug = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

    console.log(`Publishing: ${title}`);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/articles`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            title,
            slug,
            content: body,
            status: 'published'
        })
    });

    if (!res.ok) {
        console.error('Error:', await res.text());
        process.exit(1);
    }

    const data = await res.json();
    console.log('Published! ID:', data[0]?.id);
}

publish();
