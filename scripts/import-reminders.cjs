const https = require('https');

const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

const ideas = [
    {
        raw_input: "OpticRep - Add in 2 in 1 track reps + video record edit share to social",
        category: "suite_feature",
        title: "OpticRep: 2-in-1 rep tracking + video share",
        content: "Add feature to track reps while simultaneously recording video, then edit and share to social media",
        status: "inbox"
    },
    {
        raw_input: "I think my email for Apple ID is georgeahollinger@gmail.com",
        category: "personal",
        title: "Apple ID email note",
        content: "georgeahollinger@gmail.com",
        status: "inbox"
    },
    {
        raw_input: "REMcast - Analyze dreams option",
        category: "suite_feature",
        title: "REMcast: Dream analysis feature",
        content: "Add option to analyze dreams with AI interpretation",
        status: "inbox"
    },
    {
        raw_input: "Close door of room ALL THE TIME — cats pee on bed",
        category: "personal",
        title: "Close bedroom door - cats",
        content: "Always keep bedroom door closed to prevent cats from peeing on bed",
        status: "inbox"
    },
    {
        raw_input: "Cadence- Reply / engage section/panel - auto finds content to engage with",
        category: "app_idea",
        title: "Cadence: Auto-engagement panel",
        content: "New app concept - panel that auto-finds content to engage with, reply/engage section",
        status: "inbox"
    },
    {
        raw_input: "Serwin William - white w/ tinysmall beige for queens 10:30am",
        category: "action_item",
        title: "Sherwin Williams paint - Queens 10:30am",
        content: "Get white with tiny/small beige paint at Sherwin Williams Queens location",
        status: "inbox"
    },
    {
        raw_input: "Can I make it so 100% of revenue goes to token holders and I just then hold some of the token is that possible or no and like I just like provide liquidity myself against the query provider — included donation section and allocate percentage of app / token / DAO treasury based of how much percentage of token you own etc…",
        category: "suite_business",
        title: "100% revenue to token holders model",
        content: "Explore model where 100% of revenue goes to token holders. Hold tokens personally, provide liquidity. Include donation section, allocate percentage of app/token/DAO treasury based on token ownership percentage.",
        status: "inbox"
    },
    {
        raw_input: "Stuart Hollinger prompt in telegram next + —— cta is like deposit money here, it will be productive, use the app, and then sell back your tokens and receive more usd back per SUITE (because value deposited is being productive. Create graph to show logic or something) — is it possible for the SUITE token to also be tradeable? Not just receipt token for treasury? And its minted upon depositing value to the treasury? Maybe there's a swap fee connected to it?",
        category: "suite_business",
        title: "SUITE token deposit & productivity model",
        content: "CTA: deposit money, it becomes productive, use app, sell tokens back for more USD per SUITE. Explore: tradeable SUITE token (not just receipt), minted on deposit, possible swap fee.",
        status: "inbox"
    }
];

function insertIdeas() {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(ideas);

        const options = {
            hostname: 'rdsmdywbdiskxknluiym.supabase.co',
            path: '/rest/v1/personal_ideas',
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`Successfully inserted ${ideas.length} ideas!`);
                    resolve(responseData);
                } else {
                    console.error(`Error: ${res.statusCode}`);
                    console.error(responseData);
                    reject(new Error(responseData));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

insertIdeas()
    .then(() => console.log('Done! Check getsuite.app/appfactory.html'))
    .catch(err => console.error('Failed:', err.message));
