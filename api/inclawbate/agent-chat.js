// Inclawbate Homepage Chat — Groq-powered (free, fast)
// POST { message, session_id } → { reply, function_called, session_id }

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = process.env.GROQ_API_KEY;
const APP_API = 'https://inclawbate.com/api/inclawbate';

const SYSTEM_PROMPT = `You are The Inclawbator — the official Inclawbate ecosystem agent. Inclawbate is a Web3 platform where Anyone Can Build and Everyone Gets Paid.

You are a knowledgeable guide across the ENTIRE Inclawbate ecosystem. You help people:

1. DISCOVER APPS — Use browse_apps to find community-built apps in the app store.

2. BUILD SOMETHING — Use suggest_app_ideas to inspire builders. Point them to inclawbate.com/build where AI builds apps with no code.

3. STAKE CLAWS — Use get_staking_info to explain CLAWS staking and earning passive income through the Inclawbate ecosystem.

4. FIND YIELD — Use get_basis_vaults to show DeFi yield vaults on Basis (Aerodrome LP + Aave leverage strategies on Base). Users can deposit USDC to earn yield, or become vault managers to earn performance fees.

5. EXPLORE ECOSYSTEM — Use get_ecosystem_info to give an overview of everything Inclawbate offers: apps, tokens, staking, Basis vaults, PokerAI, skills marketplace, and more.

6. INCUBATION — ONLY when someone explicitly wants the team to build something FOR them (token launch, staking, website, branding). Use get_incubation_info. Tell them to DM @StuartDeFi on Telegram or @stuman on X.

Guidelines:
- Start by understanding what the person needs
- If an existing app or tool solves their problem, recommend it first
- For DeFi/yield questions, check Basis vaults
- For passive income questions, mention both CLAWS staking and Basis vaults
- Be friendly, concise, and helpful
- Keep responses under 3 sentences when possible
- When recommending apps, vaults, or tools, include direct links
- You are The Inclawbator — speak with confidence about the whole ecosystem`;

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

async function executeTool(name, args) {
  switch (name) {
    case 'browse_apps': return await browseApps(args);
    case 'suggest_app_ideas': return suggestAppIdeas(args);
    case 'get_ecosystem_info': return getEcosystemInfo();
    case 'get_incubation_info': return getIncubationInfo();
    case 'get_basis_vaults': return await getBasisVaults(args);
    case 'get_staking_info': return getStakingInfo();
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
        try {
          const toolData = JSON.parse(lastTool.content);
          if (toolData.ideas) fallback = toolData.ideas.join('\n• ') + '\n\nStart building at inclawbate.com/build — no code needed!';
          else if (toolData.apps) fallback = toolData.apps.map(a => a.name + ' — ' + a.url).join('\n• ');
          else fallback = toolData.message || JSON.stringify(toolData);
        } catch (e) {}
        history.push({ role: 'assistant', content: fallback });
        return res.status(200).json({ reply: fallback, function_called: functionCalled, session_id: sid });
      }
      choice = data.choices?.[0];
    }

    let reply = choice?.message?.content || '';
    // Llama sometimes leaks raw function-call syntax in text — strip it
    reply = reply.replace(/<function=[^>]*>[^<]*<\/function>/g, '').trim();

    // If reply is empty but we had tool data, build a fallback from it
    if (!reply && functionCalled) {
      const lastTool = history.filter(m => m.role === 'tool').pop();
      try {
        const toolData = JSON.parse(lastTool.content);
        if (toolData.ideas) reply = 'Here are some ideas:\n• ' + toolData.ideas.join('\n• ') + '\n\nStart building at inclawbate.com/build — no code needed!';
        else if (toolData.apps) reply = 'Check these out:\n' + toolData.apps.map(a => '• ' + a.name + ' — ' + a.url).join('\n');
        else if (toolData.description) reply = toolData.description;
        else reply = toolData.message || 'Check out our apps at inclawbate.com/apps!';
      } catch (e) { reply = 'Check out inclawbate.com/apps to explore what we have!'; }
    }
    if (!reply) reply = 'Hmm, let me try that again — ask me something else!';

    history.push({ role: 'assistant', content: reply });

    return res.status(200).json({ reply, function_called: functionCalled, session_id: sid });
  } catch (e) {
    console.error('Agent chat error:', e);
    return res.status(500).json({ error: 'Agent error: ' + e.message });
  }
}
