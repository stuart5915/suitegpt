// Fix icon URLs in database to match actual files
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

const fixes = [
    { slug: 'cadence-ai', icon_url: '/assets/icons/cadence-icon.jpg' },
    { slug: 'cheshbon', icon_url: '/assets/icons/cheshbon-icon.jpg' },
    { slug: 'foodvitals', icon_url: '/assets/icons/foodvitals-icon.jpg' },
    { slug: 'opticrep', icon_url: '/assets/icons/opticrep-icon.jpg' },
    { slug: 'remcast', icon_url: '/assets/icons/remcast-icon.jpg' },
    { slug: 'defi-knowledge', icon_url: '/assets/icons/defiknowledge-icon.png' },
    { slug: 'suitehub', icon_url: '/assets/icons/suitehub-icon.jpg' },
];

async function fixIcons() {
    console.log('Fixing icon URLs...\n');

    for (const fix of fixes) {
        try {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/apps?slug=eq.${fix.slug}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ icon_url: fix.icon_url })
                }
            );

            if (response.ok) {
                console.log(`✓ Fixed: ${fix.slug} → ${fix.icon_url}`);
            } else {
                const error = await response.text();
                console.log(`✗ Failed ${fix.slug}: ${error}`);
            }
        } catch (err) {
            console.log(`✗ Error with ${fix.slug}: ${err.message}`);
        }
    }

    console.log('\nDone!');
}

fixIcons();
