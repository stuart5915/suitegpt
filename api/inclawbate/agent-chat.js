// Inclawbate Homepage Chat — Groq-powered (free, fast)
// POST { message, session_id } → { reply, function_called, session_id }

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = process.env.GROQ_API_KEY;
const APP_API = 'https://inclawbate.com/api/inclawbate';

const SYSTEM_PROMPT = `You are the Inclawbate assistant — a helpful guide on the Inclawbate homepage. Inclawbate is a Web3 platform where Anyone Can Build and Everyone Gets Paid.

You help people in 3 ways:

1. DISCOVER APPS — Use browse_apps to recommend existing apps from the app store. If someone describes a need, search for relevant apps first.

2. BUILD SOMETHING — Use suggest_app_ideas to inspire people to build their own apps. Always point them to inclawbate.com/build where AI builds apps for them with no code needed.

3. INCUBATION — ONLY when someone explicitly wants the Inclawbate team to build something FOR them (token launch, staking, website, branding, marketing). Use get_incubation_info to explain what's included. Tell them to DM @StuartDeFi on Telegram or @stuman on X.

Guidelines:
- Start by understanding what the person needs — don't jump to incubation
- If an existing app solves their problem, recommend it first
- If they could build it themselves, encourage that and link to /build
- Only suggest incubation for complex projects needing hands-on help
- Be friendly, concise, and helpful
- Keep responses under 3 sentences when possible
- When recommending apps or ideas, include direct links`;

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
    description: 'Web3 ecosystem where AI agents hire humans, apps are built by anyone, and tokens share revenue.',
    features: ['App Store', 'Inclawbator (token launchpad)', 'Skills Marketplace', 'Code Auditor', 'X Search'],
    token: { name: 'CLAWS', address: '0x7ca47B141639B893C6782823C0b219f872056379', chain: 'Base' },
    links: { apps: 'https://inclawbate.com/apps', tools: 'https://inclawbate.com/tools', build: 'https://inclawbate.com/build', stake: 'https://inclawbate.com/stake' }
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

async function executeTool(name, args) {
  switch (name) {
    case 'browse_apps': return await browseApps(args);
    case 'suggest_app_ideas': return suggestAppIdeas(args);
    case 'get_ecosystem_info': return getEcosystemInfo();
    case 'get_incubation_info': return getIncubationInfo();
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

    let reply = choice?.message?.content || 'Sorry, I couldn\'t generate a response. Try again!';
    // Llama sometimes leaks raw function-call syntax in text — strip it
    reply = reply.replace(/<function=[^>]*>[^<]*<\/function>/g, '').trim();
    if (!reply) reply = 'Sorry, I couldn\'t generate a response. Try again!';
    history.push({ role: 'assistant', content: reply });

    return res.status(200).json({ reply, function_called: functionCalled, session_id: sid });
  } catch (e) {
    console.error('Agent chat error:', e);
    return res.status(500).json({ error: 'Agent error: ' + e.message });
  }
}
