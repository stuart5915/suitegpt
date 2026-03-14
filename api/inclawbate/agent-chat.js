// Inclawbate Homepage Chat — Groq-powered (free, fast)
// POST { message, session_id } → { reply, function_called, session_id }

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = process.env.GROQ_API_KEY;
const APP_API = 'https://inclawbate.com/api/inclawbate';

const SYSTEM_PROMPT = `You are The Inclawbator — the official Inclawbate ecosystem agent. Inclawbate is a Web3 platform where Anyone Can Build and Everyone Gets Paid.

You are a knowledgeable guide across the ENTIRE Inclawbate ecosystem. You help people take action:

LAUNCH A TOKEN — When someone wants to launch/create/deploy a token, first use launch_token_info to open the launch form. Then ask them for details: token name, symbol, and description (required). Also ask about optional fields: image URL, website, X handle, telegram. As you gather info, call configure_token_launch with whatever details you have so far — you can call it multiple times as you learn more. The form will auto-fill on their screen. When all required fields are filled, tell them to click Deploy. Do NOT send them to a different page.

BUILD AN APP — When someone wants to build/create an app, use build_app_info. They can use the AI app builder at inclawbate.com/build — no code needed.

CREATE A MARKETING AGENT — When someone wants to set up an AI agent that posts to X/Twitter, use create_agent_info. They create agents from their dashboard.

CREATE A STAKE POOL — When someone wants staking for their token, use create_staking_info. Staking deployment is handled by the Inclawbate team as part of the incubation program.

DISCOVER APPS — Use browse_apps to find community-built apps in the app store.

STAKE CLAWS — Use get_staking_info to explain CLAWS staking and earning passive income.

FIND YIELD — Use get_basis_vaults to show DeFi yield vaults on Basis.

EXPLORE ECOSYSTEM — Use get_ecosystem_info for an overview of everything Inclawbate offers.

FULL-SERVICE INCUBATION — ONLY when someone wants the team to handle everything (token + staking + branding + marketing as a package). Use get_incubation_info.

WORKSPACE — If a wallet address is provided, use get_user_workspace to see what the user has built.

Guidelines:
- ALWAYS use the right tool for the request — match launch/build/agent/staking to their specific tools
- Be actionable — tell them exactly what to do and where to go
- Keep responses under 3 sentences when possible
- Include direct links when recommending pages or tools
- If the user has a connected wallet, personalize your advice with get_user_workspace
- Be friendly, concise, and confident`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'browse_apps',
      description: 'Search and browse the Inclawbate app store. Returns community-built apps.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search query to filter apps' },
          category: { type: 'string', description: 'Category: defi, social, gaming, tools, creative' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'suggest_app_ideas',
      description: 'Suggest app ideas someone could build on Inclawbate.',
      parameters: {
        type: 'object',
        properties: {
          interest: { type: 'string', description: 'Interest area: defi, gaming, social, tools, ai' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_ecosystem_info',
      description: 'Get info about Inclawbate — what it is, key links, CLAWS token.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_incubation_info',
      description: 'Get details about Inclawbate incubation — services, process, cost.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_basis_vaults',
      description: 'Get DeFi yield vaults from Basis — shows APY, TVL, strategy type. For users asking about yield, DeFi, or earning on their crypto.',
      parameters: {
        type: 'object',
        properties: {
          sort: { type: 'string', description: 'Sort by: apy, return, newest, active, tvl. Default: apy' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_staking_info',
      description: 'Get CLAWS token staking info — how to stake, rewards, APY.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'launch_token_info',
      description: 'Open the token launch form. Use this FIRST when someone wants to launch a token, before gathering details.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'configure_token_launch',
      description: 'Fill in token details on the launch form. Call this as you gather info from the user. You can call it multiple times — each call updates the form with new fields.',
      parameters: {
        type: 'object',
        properties: {
          token_name: { type: 'string', description: 'Token name (e.g. MoonCat)' },
          token_symbol: { type: 'string', description: 'Token symbol, max 10 chars (e.g. MCAT)' },
          description: { type: 'string', description: 'Token description, max 280 chars' },
          image_url: { type: 'string', description: 'Token logo image URL' },
          website_url: { type: 'string', description: 'Project website URL' },
          x_handle: { type: 'string', description: 'X/Twitter handle' },
          telegram_url: { type: 'string', description: 'Telegram group URL' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'build_app_info',
      description: 'Get info on how to build an app on Inclawbate using the AI app builder. Use when someone wants to build, create, or make an app.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_agent_info',
      description: 'Get info on how to create a marketing AI agent that auto-posts to X/Twitter. Use when someone wants to set up an agent.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_staking_info',
      description: 'Get info on how to create a staking pool for a token. Use when someone wants to set up staking or a stake pool.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_user_workspace',
      description: 'Get everything a connected wallet has built — their apps, marketing agents, and Basis vaults. Use when user has a wallet connected.',
      parameters: {
        type: 'object',
        properties: {
          wallet: { type: 'string', description: 'The user wallet address (0x...)' }
        },
        required: ['wallet']
      }
    }
  }
];

// ── Tool implementations ──

async function browseApps(args) {
  try {
    let url = APP_API + '/apps?sort=popular&limit=8';
    if (args.search) url += '&search=' + encodeURIComponent(args.search);
    if (args.category) url += '&category=' + encodeURIComponent(args.category);
    const res = await fetch(url);
    const data = await res.json();
    const apps = (data.apps || data || []).slice(0, 8).map(a => ({
      name: a.name || a.title,
      slug: a.slug,
      description: (a.description || a.tagline || '').slice(0, 100),
      url: 'https://inclawbate.com/apps/' + a.slug
    }));
    if (!apps.length) return JSON.stringify({ message: 'No apps found. Browse all at https://inclawbate.com/apps' });
    return JSON.stringify({ count: apps.length, apps, browse_all: 'https://inclawbate.com/apps' });
  } catch (e) {
    return JSON.stringify({ error: 'Could not fetch apps' });
  }
}

function suggestAppIdeas(args) {
  const ideas = {
    defi: ['Portfolio tracker — show token balances', 'Yield calculator — estimate staking rewards', 'Token swap aggregator', 'Whale watcher — track large wallets'],
    gaming: ['Prediction market — bet on crypto prices', 'Trivia game — compete for CLAWS', 'Trading card game — NFT cards', 'Leaderboard app'],
    social: ['Anonymous confessions board', 'Community poll booth', 'Group jukebox — collaborative playlist', 'Chat rooms'],
    tools: ['Smart contract auditor', 'Token launcher — one click deploy', 'Airdrop tool — distribute tokens', 'Marketing plan generator'],
    ai: ['AI agent dashboard', 'Prompt marketplace', 'AI art generator', 'Chatbot builder']
  };
  const interest = (args.interest || '').toLowerCase();
  const selected = ideas[interest] || [ideas.defi[0], ideas.gaming[0], ideas.social[0], ideas.tools[0], ideas.ai[0]];
  return JSON.stringify({ ideas: selected, build_url: 'https://inclawbate.com/build', message: 'Start building at inclawbate.com/build — AI builds it, no code needed!' });
}

function getEcosystemInfo() {
  return JSON.stringify({
    name: 'Inclawbate', tagline: 'Anyone Can Build. Everyone Gets Paid.',
    website: 'https://inclawbate.com',
    description: 'Web3 ecosystem where AI agents hire humans, apps are built by anyone, and tokens share revenue. The ecosystem spans DeFi, gaming, AI agents, and community tools.',
    products: [
      { name: 'App Store', description: 'Community-built apps — browse or build your own with AI', url: 'https://inclawbate.com/apps' },
      { name: 'App Builder', description: 'AI builds apps for you, no code needed', url: 'https://inclawbate.com/build' },
      { name: 'Basis', description: 'DeFi yield vaults — Aerodrome LP + Aave leverage on Base', url: 'https://basisubi.com' },
      { name: 'PokerAI', description: 'AI poker — watch agents play, deposit USDC chips', url: 'https://pokerai.app' },
      { name: 'CLAWS Staking', description: 'Stake CLAWS to earn passive income', url: 'https://inclawbate.com/stake' },
      { name: 'Skills Marketplace', description: 'Browse and use agent skills', url: 'https://inclawbate.com/skills' },
      { name: 'Incubation', description: 'Full-service token launch + branding + marketing', url: 'https://inclawbate.com/inclawbator' },
      { name: 'AgentScape', description: 'On-chain agent RPG game', url: 'https://agentscape.app' }
    ],
    token: { name: 'CLAWS', address: '0x7ca47B141639B893C6782823C0b219f872056379', chain: 'Base', staking: 'https://inclawbate.com/stake' },
    links: { apps: 'https://inclawbate.com/apps', build: 'https://inclawbate.com/build', stake: 'https://inclawbate.com/stake', basis: 'https://basisubi.com', poker: 'https://pokerai.app', ecosystem: 'https://inclawbate.com/ecosystem' }
  });
}

function getIncubationInfo() {
  return JSON.stringify({
    what: 'Full-service program — we build your entire human-facing presence.',
    services: ['Token launch on Base', 'Staking contract + CLAWS rewards', 'Branding/logo', 'Landing page', 'Marketing', 'X/Twitter presence', 'Revenue sharing via LP fees'],
    cost: 'Free. Small fee split from LP trading fees.',
    contact: { telegram: 'https://t.me/StuartDeFi', x: 'https://x.com/stuman' }
  });
}

function launchTokenInfo() {
  return JSON.stringify({
    action: 'show_launch_form',
    message: 'Token launch form is now open. Ask the user for: token name, symbol, and description (required). Image URL, website, and socials are optional.',
    note: 'Clanker deploys on Base with automatic Uniswap V3 liquidity. Free to launch (0% allocation) or burn CLAWS for 1-10% pre-allocation.'
  });
}

function configureTokenLaunch(args) {
  const fields = {};
  if (args.token_name) fields.token_name = args.token_name;
  if (args.token_symbol) fields.token_symbol = args.token_symbol.toUpperCase();
  if (args.description) fields.description = args.description;
  if (args.image_url) fields.image_url = args.image_url;
  if (args.website_url) fields.website_url = args.website_url;
  if (args.x_handle) fields.x_handle = args.x_handle.replace(/^@/, '');
  if (args.telegram_url) fields.telegram_url = args.telegram_url;
  const filled = Object.keys(fields);
  const missing = ['token_name', 'token_symbol', 'description'].filter(f => !fields[f]);
  return JSON.stringify({
    action: 'fill_launch_form',
    fields,
    filled_count: filled.length,
    missing_required: missing,
    ready: missing.length === 0,
    message: missing.length === 0
      ? 'All required fields are filled! The user can review and click Deploy.'
      : 'Still need: ' + missing.join(', ')
  });
}

function buildAppInfo() {
  return JSON.stringify({
    how: 'Build an app with AI — no code needed. Describe what you want and the builder creates it.',
    steps: [
      '1. Go to inclawbate.com/build',
      '2. Sign in with your wallet',
      '3. Describe the app you want (e.g. "A staking dashboard for my token")',
      '4. AI generates the full app with HTML/CSS/JS',
      '5. Preview it live, iterate on changes, then publish',
      '6. Your app gets a URL: inclawbate.com/apps/your-app-name'
    ],
    features: 'Supports APIs, wallet integrations, canvas, images, and more. You can fork and edit existing apps too.',
    url: 'https://inclawbate.com/build',
    browse_apps: 'https://inclawbate.com/apps'
  });
}

function createAgentInfo() {
  return JSON.stringify({
    how: 'Create an AI marketing agent that auto-posts to X/Twitter about your project.',
    steps: [
      '1. Go to inclawbate.com/dashboard',
      '2. Open the "My Agents" tab',
      '3. Click "Create New Agent"',
      '4. Choose a vibe (degen, builder, scholar, academic, or custom)',
      '5. Set agent name, posts per day (1-8), and optional profile pic',
      '6. Link to your existing token/project or create standalone',
      '7. Connect an X/Twitter account to the agent',
      '8. Agent starts auto-posting based on its persona and schedule'
    ],
    features: 'Personality customization, posting schedule, draft review, post history, and engagement tracking.',
    url: 'https://inclawbate.com/dashboard',
    note: 'Agents need credits to run. You can buy credits from the dashboard.'
  });
}

function createStakingInfo() {
  return JSON.stringify({
    how: 'Staking pools are deployed by the Inclawbate team as part of the incubation program.',
    process: [
      '1. You need an existing token (launch one at inclawbate.com/inclawbator if needed)',
      '2. Apply for incubation — request staking setup for your token',
      '3. The team deploys a staking contract using the Inclawbate staking factory',
      '4. Your token gets a staking page at inclawbate.com/stake',
      '5. Stakers earn CLAWS rewards powered by ecosystem revenue'
    ],
    contact: { telegram: 'https://t.me/StuartDeFi', x: 'https://x.com/stuman' },
    apply_url: 'https://inclawbate.com/inclawbator',
    note: 'Staking is free to set up — it comes as part of the incubation package with revenue sharing via LP fees.'
  });
}

async function getBasisVaults(args) {
  try {
    const sort = args.sort || 'apy';
    const res = await fetch('https://inclawbate.com/api/basis/marketplace?sort=' + sort + '&limit=8');
    const data = await res.json();
    const vaults = (data.vaults || []).map(v => ({
      name: v.name,
      manager: v.manager_name || 'Anonymous',
      apy: v.estimated_apy ? v.estimated_apy.toFixed(1) + '%' : 'N/A',
      tvl: v.tvl_usdc ? '$' + Number(v.tvl_usdc).toLocaleString() : '$0',
      return_7d: v.return_7d ? v.return_7d.toFixed(2) + '%' : 'N/A',
      fee: v.performance_fee_bps ? (v.performance_fee_bps / 100) + '%' : '0%',
      strategy: v.brain_config || {}
    }));
    if (!vaults.length) return JSON.stringify({ message: 'No vaults found yet. Check back soon at https://basisubi.com' });
    return JSON.stringify({ count: vaults.length, vaults, explore: 'https://basisubi.com', deposit_info: 'Deposit USDC into any vault to earn yield. Vaults use Aerodrome LP + Aave leverage strategies on Base.' });
  } catch (e) {
    return JSON.stringify({ error: 'Could not fetch vaults', explore: 'https://basisubi.com' });
  }
}

function getStakingInfo() {
  return JSON.stringify({
    token: 'CLAWS',
    address: '0x7ca47B141639B893C6782823C0b219f872056379',
    chain: 'Base',
    staking_url: 'https://inclawbate.com/stake',
    how_it_works: 'Stake CLAWS to earn rewards from the Inclawbate ecosystem. Staking powers the agentic UBI model — stakers earn passive income while supporting ecosystem growth.',
    rewards: 'CLAWS rewards distributed from ecosystem revenue (app fees, incubation, LP fees)',
    staking_contract: '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6',
    steps: ['Connect wallet at inclawbate.com/stake', 'Approve CLAWS tokens', 'Stake your CLAWS', 'Earn rewards automatically'],
    buy_claws: 'https://app.uniswap.org/swap?outputCurrency=0x7ca47B141639B893C6782823C0b219f872056379&chain=base'
  });
}

async function getUserWorkspace(args) {
  const wallet = (args.wallet || '').toLowerCase();
  if (!wallet) return JSON.stringify({ error: 'No wallet provided' });

  const results = { apps: [], agents: [], vaults: [] };

  try {
    const appsRes = await fetch(APP_API + '/apps?creator_wallet=' + encodeURIComponent(wallet) + '&limit=20');
    const appsData = await appsRes.json();
    results.apps = (appsData.apps || []).map(a => ({
      name: a.name || a.title, slug: a.slug, users: a.view_count || 0,
      url: 'https://inclawbate.com/apps/' + a.slug
    }));
  } catch (e) {}

  try {
    const projRes = await fetch(APP_API + '/projects?wallet=' + encodeURIComponent(wallet));
    const projData = await projRes.json();
    results.agents = (projData.projects || []).filter(p => p.agent_enabled).map(p => ({
      name: p.name, status: p.agent_status, x_handle: p.x_handle, posts: p.agent_total_posts || 0
    }));
  } catch (e) {}

  try {
    const vaultRes = await fetch('https://inclawbate.com/api/basis/marketplace?manager=' + encodeURIComponent(wallet));
    const vaultData = await vaultRes.json();
    results.vaults = (vaultData.vaults || []).map(v => ({
      name: v.name, apy: v.estimated_apy ? v.estimated_apy.toFixed(1) + '%' : 'N/A',
      tvl: v.tvl_usdc ? '$' + Number(v.tvl_usdc).toLocaleString() : '$0'
    }));
  } catch (e) {}

  const summary = [];
  if (results.apps.length) summary.push(results.apps.length + ' app' + (results.apps.length > 1 ? 's' : ''));
  if (results.agents.length) summary.push(results.agents.length + ' agent' + (results.agents.length > 1 ? 's' : ''));
  if (results.vaults.length) summary.push(results.vaults.length + ' vault' + (results.vaults.length > 1 ? 's' : ''));

  return JSON.stringify({
    wallet, summary: summary.length ? summary.join(', ') : 'Fresh workspace — nothing built yet!',
    ...results,
    suggestions: !summary.length ? ['Launch a token', 'Build an app', 'Create a marketing agent', 'Explore yield vaults'] : []
  });
}

async function executeTool(name, args) {
  switch (name) {
    case 'browse_apps': return await browseApps(args);
    case 'suggest_app_ideas': return suggestAppIdeas(args);
    case 'get_ecosystem_info': return getEcosystemInfo();
    case 'get_incubation_info': return getIncubationInfo();
    case 'launch_token_info': return launchTokenInfo();
    case 'configure_token_launch': return configureTokenLaunch(args);
    case 'build_app_info': return buildAppInfo();
    case 'create_agent_info': return createAgentInfo();
    case 'create_staking_info': return createStakingInfo();
    case 'get_basis_vaults': return await getBasisVaults(args);
    case 'get_staking_info': return getStakingInfo();
    case 'get_user_workspace': return await getUserWorkspace(args);
    default: return JSON.stringify({ error: 'Unknown tool' });
  }
}

// ── Session store ──
const sessions = new Map();

async function callGroq(messages) {
  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 512
    })
  });
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { message, session_id } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });

  const sid = session_id || 'anon_' + Date.now();
  if (!sessions.has(sid)) sessions.set(sid, [{ role: 'system', content: SYSTEM_PROMPT }]);
  const history = sessions.get(sid);

  history.push({ role: 'user', content: message });

  // Keep history manageable
  if (history.length > 22) {
    const sys = history[0];
    history.splice(1, history.length - 21);
  }

  try {
    let functionCalled = null;
    let toolArgs = null;
    let data = await callGroq(history);

    // Check for Groq API error
    if (data.error) {
      console.error('Groq error:', data.error);
      return res.status(200).json({ reply: 'AI is temporarily busy — try again in a moment!', session_id: sid });
    }

    let choice = data.choices?.[0];

    // Handle tool calls
    if (choice?.finish_reason === 'tool_calls' || choice?.message?.tool_calls) {
      const toolCalls = choice.message.tool_calls || [];
      // Push assistant message with tool_calls to history
      history.push({ role: 'assistant', content: choice.message.content || null, tool_calls: toolCalls });

      for (const tc of toolCalls) {
        functionCalled = tc.function.name;
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) {}
        toolArgs = args;
        const result = await executeTool(tc.function.name, args);
        history.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }

      // Get final response after tool execution
      data = await callGroq(history);
      if (data.error) {
        console.error('Groq error (post-tool):', data.error);
        // Return tool result directly as fallback
        const lastTool = history.filter(m => m.role === 'tool').pop();
        let fallback = 'Here are some ideas!';
        // User-friendly fallbacks for launch tools
        if (functionCalled === 'launch_token_info') fallback = "I've opened the token launch form for you! Fill in your token name, symbol, and description — then hit Deploy. What do you want to call your token?";
        else if (functionCalled === 'configure_token_launch') {
          try { const td = JSON.parse(lastTool.content); fallback = td.ready ? "Looking good! Review the details and click Deploy when you're ready." : "I've filled in what I have so far. " + (td.missing_required?.length ? "Still need: " + td.missing_required.join(', ') + ". What's next?" : ''); } catch(e) { fallback = "I've updated the form with your details!"; }
        } else {
          try {
            const toolData = JSON.parse(lastTool.content);
            if (toolData.ideas) fallback = toolData.ideas.join('\n• ') + '\n\nStart building at inclawbate.com/build — no code needed!';
            else if (toolData.apps) fallback = toolData.apps.map(a => a.name + ' — ' + a.url).join('\n• ');
            else fallback = toolData.message || JSON.stringify(toolData);
          } catch (e) {}
        }
        history.push({ role: 'assistant', content: fallback });
        return res.status(200).json({ reply: fallback, function_called: functionCalled, tool_args: toolArgs, session_id: sid });
      }
      choice = data.choices?.[0];
    }

    let reply = choice?.message?.content || '';
    // Llama sometimes leaks raw function-call syntax in text — strip it
    reply = reply.replace(/<function=[^>]*>[^<]*<\/function>/g, '').trim();

    // If reply is empty but we had tool data, build a fallback from it
    if (!reply && functionCalled) {
      if (functionCalled === 'launch_token_info') {
        reply = "I've opened the token launch form for you! Fill in your token name, symbol, and description — then hit Deploy. What do you want to call your token?";
      } else if (functionCalled === 'configure_token_launch') {
        try { const td = JSON.parse(history.filter(m => m.role === 'tool').pop().content); reply = td.ready ? "Looking good! Review the details and click Deploy when you're ready." : "I've updated the form. " + (td.missing_required?.length ? "Still need: " + td.missing_required.join(', ') : ''); } catch(e) { reply = "I've updated the form!"; }
      } else {
        const lastTool = history.filter(m => m.role === 'tool').pop();
        try {
          const toolData = JSON.parse(lastTool.content);
          if (toolData.ideas) reply = 'Here are some ideas:\n• ' + toolData.ideas.join('\n• ') + '\n\nStart building at inclawbate.com/build — no code needed!';
          else if (toolData.apps) reply = 'Check these out:\n' + toolData.apps.map(a => '• ' + a.name + ' — ' + a.url).join('\n');
          else if (toolData.description) reply = toolData.description;
          else reply = toolData.message || 'Check out our apps at inclawbate.com/apps!';
        } catch (e) { reply = 'Check out inclawbate.com/apps to explore what we have!'; }
      }
    }
    if (!reply) reply = 'Hmm, let me try that again — ask me something else!';

    history.push({ role: 'assistant', content: reply });

    return res.status(200).json({ reply, function_called: functionCalled, tool_args: toolArgs, session_id: sid });
  } catch (e) {
    console.error('Agent chat error:', e);
    return res.status(500).json({ error: 'Agent error: ' + e.message });
  }
}
