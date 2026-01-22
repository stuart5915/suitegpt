// Seed SUITE Apps via Supabase REST API
// Run with: node scripts/seed-apps.js

const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

const apps = [
    {
        name: 'FoodVitals',
        slug: 'foodvitals',
        tagline: 'Nutrition scanner',
        description: 'Scan food labels and get instant nutrition analysis with AI',
        category: 'health',
        status: 'approved',
        icon_url: '/assets/icons/foodvitals-icon.jpg',
        app_url: '/foodvitals/index.html',
        creator_name: 'SUITE',
        creator_username: 'Stu'
    },
    {
        name: 'OpticRep',
        slug: 'opticrep',
        tagline: 'AI rep counter',
        description: 'AI-powered workout rep counter using your camera',
        category: 'health',
        status: 'approved',
        icon_url: '/assets/icons/opticrep-icon.jpg',
        app_url: null,
        creator_name: 'SUITE',
        creator_username: 'Stu'
    },
    {
        name: 'Proto Golf',
        slug: 'proto-golf',
        tagline: 'Your golf companion',
        description: 'AI-powered golf equipment fitting and tracking',
        category: 'other',
        status: 'approved',
        icon_url: '/assets/icons/protogolf-icon.jpg',
        app_url: '/proto-golf.html',
        creator_name: 'SUITE',
        creator_username: 'Stu'
    },
    {
        name: 'Cheshbon',
        slug: 'cheshbon',
        tagline: 'Daily reflection',
        description: 'AI-guided daily reflection and journaling',
        category: 'productivity',
        status: 'approved',
        icon_url: '/assets/icons/cheshbon-icon.jpg',
        app_url: '/cheshbon.html',
        creator_name: 'SUITE',
        creator_username: 'Stu'
    },
    {
        name: 'NoteBox',
        slug: 'notebox',
        tagline: 'Audio learning',
        description: 'Turn podcasts and videos into actionable notes',
        category: 'productivity',
        status: 'approved',
        icon_url: '/assets/icons/notebox-icon.png',
        app_url: '/notebox.html',
        creator_name: 'SUITE',
        creator_username: 'Stu'
    },
    {
        name: 'RemCast',
        slug: 'remcast',
        tagline: 'Voice memos',
        description: 'Record voice memos and get AI summaries',
        category: 'productivity',
        status: 'approved',
        icon_url: '/assets/icons/remcast-icon.jpg',
        app_url: null,
        creator_name: 'SUITE',
        creator_username: 'Stu'
    },
    {
        name: 'SUITEhub',
        slug: 'suitehub',
        tagline: 'Your AI assistant',
        description: 'Central AI hub connected to all your SUITE apps',
        category: 'productivity',
        status: 'approved',
        icon_url: '/assets/icons/suitehub-icon.jpg',
        app_url: '/suitehub.html',
        creator_name: 'SUITE',
        creator_username: 'Stu'
    },
    {
        name: 'Cadence AI',
        slug: 'cadence-ai',
        tagline: 'Content creation',
        description: 'AI-powered social media content scheduling',
        category: 'creative',
        status: 'approved',
        icon_url: '/assets/icons/cadence-icon.jpg',
        app_url: null,
        creator_name: 'SUITE',
        creator_username: 'Stu'
    },
    {
        name: 'Life Hub',
        slug: 'life-hub',
        tagline: 'Life dashboard',
        description: 'Personal dashboard for goals, habits, and reflections',
        category: 'productivity',
        status: 'pending',
        icon_url: '/assets/icons/life-hub-icon.png',
        app_url: null,
        creator_name: 'SUITE',
        creator_username: 'Stu'
    },
    {
        name: 'Deal Tracker',
        slug: 'deal-tracker',
        tagline: 'Find deals',
        description: 'Track local deals and discounts',
        category: 'finance',
        status: 'pending',
        icon_url: '/assets/icons/deal-tracker-icon.png',
        app_url: null,
        creator_name: 'SUITE',
        creator_username: 'Stu'
    },
    {
        name: 'DeFi Knowledge',
        slug: 'defi-knowledge',
        tagline: 'Master DeFi',
        description: 'Learn decentralized finance with AI tutoring',
        category: 'finance',
        status: 'approved',
        icon_url: '/assets/icons/defiknowledge-icon.png',
        app_url: null,
        creator_name: 'SUITE',
        creator_username: 'Stu'
    }
];

async function seedApps() {
    console.log('Seeding SUITE apps to `apps` table...\n');

    for (const app of apps) {
        try {
            // Check if it exists
            const checkResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/apps?slug=eq.${app.slug}`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                }
            );

            const existing = await checkResponse.json();

            if (existing && existing.length > 0) {
                // Update existing - only update specific fields, preserve others
                const updateData = {
                    name: app.name,
                    tagline: app.tagline,
                    description: app.description,
                    category: app.category,
                    icon_url: app.icon_url,
                    app_url: app.app_url
                };

                const updateResponse = await fetch(
                    `${SUPABASE_URL}/rest/v1/apps?slug=eq.${app.slug}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify(updateData)
                    }
                );

                if (updateResponse.ok) {
                    console.log(`✓ Updated: ${app.name}`);
                } else {
                    const error = await updateResponse.text();
                    console.log(`✗ Failed to update ${app.name}: ${error}`);
                }
            } else {
                // Insert new
                const insertResponse = await fetch(
                    `${SUPABASE_URL}/rest/v1/apps`,
                    {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify(app)
                    }
                );

                if (insertResponse.ok) {
                    console.log(`✓ Inserted: ${app.name}`);
                } else {
                    const error = await insertResponse.text();
                    console.log(`✗ Failed to insert ${app.name}: ${error}`);
                }
            }
        } catch (err) {
            console.log(`✗ Error with ${app.name}: ${err.message}`);
        }
    }

    console.log('\nDone! Check your Supabase dashboard to verify.');
}

seedApps();
