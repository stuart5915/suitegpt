// Inclawbate Homepage Chat — Groq-powered (free, fast)
// POST { message, session_id, wallet } → { reply, function_called, session_id }

import { launchToken, disperseTokens, deployStakingPool } from './onchain-actions.js';

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
// Support multiple Groq API keys for higher throughput — comma-separated in env
const GROQ_KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
let groqKeyIndex = 0;
function nextGroqKey() { const k = GROQ_KEYS[groqKeyIndex % GROQ_KEYS.length]; groqKeyIndex++; return k; }
const APP_API = 'https://inclawbate.app/api/inclawbate';

const SYSTEM_PROMPT = `You are The Inclawbator — the official Inclawbate ecosystem AI agent.

Inclawbate is a self-sustaining engine that generates, manages, and distributes value forever. Anyone Can Build. Everyone Gets Paid.

You have 11 tools. Match the user's intent to the right one:

LAUNCH A TOKEN — Use deploy_token when you have name, symbol, AND the user's wallet address. Gather details conversationally (name, symbol, wallet required; description, image, website, X handle, telegram optional). The user's wallet receives 80% of LP fee rewards, Inclawbate receives 20%. If the user hasn't provided their wallet address, ASK for it before deploying — they need it to receive their fee rewards. The token launches on Base via Clanker automatically.

DEPLOY STAKING — Use deploy_staking when someone wants a staking pool for their token. Requires: token_address and creator_wallet. If the user hasn't provided their wallet address, ASK for it before deploying — their wallet becomes the pool admin so they can deposit rewards. If they haven't provided a token address, ASK for it too. The pool lets holders stake the token and earn CLAWS rewards. After deployment, tell them to go to inclawbate.app/dashboard to connect their wallet and deposit CLAWS rewards.

TOKEN ANALYTICS — Use get_token_analytics when someone asks about a token's price, volume, or liquidity. Requires a token address.

STAKING STATS — Use get_staking_stats when someone asks about staking APY, TVL, staker count, or their staking position. Can optionally take a wallet address.

HEALTH CHECK — Use health_check when someone asks how their project is doing. If they provide a wallet but no token address, use get_token_analytics on the CLAWS token as a fallback. Always pass the wallet if available.

MARKETING AGENT — Use create_agent_info when someone wants an AI agent that auto-posts to X/Twitter.

BOOK PROMO — Use book_promo when someone wants to promote their project through the @inclawbate X account.

AIRDROP / DISTRIBUTE — Use disperse_tokens when someone wants to airdrop or distribute tokens to multiple wallets. Requires token_address, recipients (array of addresses), and amounts (array of numbers). Executes the airdrop automatically on Base.

HIRE THE COUNCIL — Use hire_inclawbator when someone needs human help (design, dev, marketing, content, strategy). You MUST collect BOTH (1) what they need done and (2) how the council can reach them (X handle, Telegram, email, or wallet) BEFORE calling this tool. Do NOT call it without both fields. Ask for missing info first.

ECOSYSTEM INFO — Use get_ecosystem_info when someone asks what Inclawbate is, how it works, or about CLAWS.

FULL INCUBATION — Use get_incubation_info ONLY when someone wants the team to handle everything as a package.

Guidelines:
- ALWAYS use the right tool — don't guess, match intent to tool
- Be actionable — tell them exactly what to do
- Keep responses under 3 sentences when possible
- Be friendly, concise, and confident
- Never return raw JSON to the user — always speak naturally`;

const TOOLS = [
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
      description: 'Get details about full-service Inclawbate incubation — services, process, cost.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deploy_token',
      description: 'Deploy a token on Base via Clanker. Requires name, symbol, and creator wallet address. The creator wallet receives 80% of LP fee rewards.',
      parameters: {
        type: 'object',
        properties: {
          token_name: { type: 'string', description: 'Token name (e.g. MoonCat)' },
          token_symbol: { type: 'string', description: 'Token symbol, max 10 chars (e.g. MCAT)' },
          creator_wallet: { type: 'string', description: 'Creator wallet address (receives 80% LP fee rewards)' },
          description: { type: 'string', description: 'Token description, max 280 chars' },
          image_url: { type: 'string', description: 'Token logo image URL' },
          website_url: { type: 'string', description: 'Project website URL' },
          x_handle: { type: 'string', description: 'X/Twitter handle' },
          telegram_url: { type: 'string', description: 'Telegram group URL' }
        },
        required: ['token_name', 'token_symbol', 'creator_wallet']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_agent_info',
      description: 'Get info on creating an AI marketing agent that auto-posts to X/Twitter.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_token_analytics',
      description: 'Get real-time token price, volume, liquidity from DexScreener. Requires a token contract address.',
      parameters: {
        type: 'object',
        properties: {
          token_address: { type: 'string', description: 'Token contract address (0x...)' }
        },
        required: ['token_address']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_staking_stats',
      description: 'Get live staking stats — TVL, APY, total stakers, distribution info. Optionally check a specific wallet position.',
      parameters: {
        type: 'object',
        properties: {
          wallet: { type: 'string', description: 'Optional wallet address to check their staking position' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'book_promo',
      description: 'Get info on promoting a project through the @inclawbate X account. Shows tiers and pricing in CLAWS.',
      parameters: {
        type: 'object',
        properties: {
          project_name: { type: 'string', description: 'Name of the project to promote' },
          tier: { type: 'string', enum: ['shoutout', 'campaign', 'featured'], description: 'Promo tier' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'disperse_tokens',
      description: 'Airdrop or distribute tokens to multiple wallets on Base. Executes the transaction automatically.',
      parameters: {
        type: 'object',
        properties: {
          token_address: { type: 'string', description: 'Token contract address to distribute' },
          recipients: { type: 'array', items: { type: 'string' }, description: 'Array of wallet addresses' },
          amounts: { type: 'array', items: { type: 'number' }, description: 'Array of token amounts (human readable, not wei)' }
        },
        required: ['token_address', 'recipients', 'amounts']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deploy_staking',
      description: 'Deploy a staking pool for a token via the Staking Factory. Holders stake and earn CLAWS rewards.',
      parameters: {
        type: 'object',
        properties: {
          token_address: { type: 'string', description: 'Token contract address to create staking pool for' },
          creator_wallet: { type: 'string', description: 'Creator wallet address — becomes pool admin' }
        },
        required: ['token_address', 'creator_wallet']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'health_check',
      description: 'Run a health check on a project — token price, volume, staking stats, suggestions. Pass token_address and/or wallet.',
      parameters: {
        type: 'object',
        properties: {
          token_address: { type: 'string', description: 'Token contract address to check' },
          wallet: { type: 'string', description: 'Creator wallet for project lookup' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'hire_inclawbator',
      description: 'Post a hire request to the Inclawbate Council Telegram group. REQUIRES both task_description and contact. Do NOT call without both.',
      parameters: {
        type: 'object',
        properties: {
          task_description: { type: 'string', description: 'What the user needs done' },
          contact: { type: 'string', description: 'How council members can reach them (X handle, Telegram, email, or wallet)' },
          budget_claws: { type: 'number', description: 'Optional budget in CLAWS (0 = let them quote)' }
        },
        required: ['task_description', 'contact']
      }
    }
  }
];

// ── Tool implementations ──

function getEcosystemInfo() {
  return JSON.stringify({
    name: 'Inclawbate',
    tagline: 'Anyone Can Build. Everyone Gets Paid.',
    mission: 'A self-sustaining engine that generates, manages, and distributes value forever.',
    website: 'https://inclawbate.app',
    what_you_can_do: [
      'Launch tokens on Base or Solana',
      'Deploy staking pools with automatic CLAWS rewards',
      'Create AI marketing agents for X/Twitter',
      'Airdrop tokens to your community',
      'Book promotions on the @inclawbate X account',
      'Hire the Council — vetted humans for design, dev, marketing',
      'Get full-service incubation (token + staking + branding + marketing)'
    ],
    token: { name: 'CLAWS', address: '0x7ca47B141639B893C6782823C0b219f872056379', chain: 'Base', staking: 'https://inclawbate.app/stake' },
    links: { stake: 'https://inclawbate.app/stake', inclawbator: 'https://inclawbate.app/inclawbator', telegram: 'https://t.me/inclawbate' }
  });
}

function getIncubationInfo() {
  return JSON.stringify({
    what: 'Full-service incubation — we build your entire project presence.',
    services: ['Token launch on Base or Solana', 'Staking contract + CLAWS rewards', 'Branding/logo', 'Landing page', 'Marketing agent', 'X/Twitter presence', 'Revenue sharing via LP fees'],
    cost: 'Free. Small fee split from LP trading fees.',
    contact: { telegram: 'https://t.me/StuartDeFi', x: 'https://x.com/inclawbate' }
  });
}

async function deployTokenAction(args) {
  try {
    const result = await launchToken({
      name: args.token_name,
      symbol: args.token_symbol,
      creator_wallet: args.creator_wallet,
      description: args.description,
      image_url: args.image_url,
      website_url: args.website_url,
      x_handle: args.x_handle,
      telegram_url: args.telegram_url
    });
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: err.message, hint: 'Token deployment failed. Try again or contact the Council.' });
  }
}

function createAgentInfo() {
  return JSON.stringify({
    how: 'Create an AI marketing agent that auto-posts to X/Twitter about your project.',
    steps: [
      'Go to inclawbate.app/dashboard → "My Agents" tab',
      'Click "Create New Agent"',
      'Choose a vibe (degen, builder, scholar, academic, or custom)',
      'Set name, posts per day (1-8), optional profile pic',
      'Connect an X/Twitter account to the agent',
      'Agent starts auto-posting based on its persona and schedule'
    ],
    url: 'https://inclawbate.app/dashboard',
    note: 'Agents are free to create. They need credits to run — buy from dashboard.'
  });
}

async function getTokenAnalytics(args) {
  const address = args.token_address || '';
  if (!address || address === 'user_token_address') return JSON.stringify({ error: 'A valid token contract address is required. Ask the user for their token address.' });
  try {
    const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + address);
    const data = await res.json();
    const pairs = (data.pairs || []).filter(p => p.chainId === 'base' || p.chainId === 'solana');
    if (!pairs.length) return JSON.stringify({ message: 'No trading pairs found for this token on DexScreener', token_address: address });
    const top = pairs[0];
    return JSON.stringify({
      token: top.baseToken?.name || 'Unknown', symbol: top.baseToken?.symbol || '?', chain: top.chainId,
      price_usd: top.priceUsd || 'N/A', price_change_24h: top.priceChange?.h24 || 'N/A',
      volume_24h: top.volume?.h24 || 0, liquidity_usd: top.liquidity?.usd || 0, fdv: top.fdv || 0,
      pair_url: top.url || '', dex: top.dexId || ''
    });
  } catch (e) {
    return JSON.stringify({ error: 'Could not fetch token analytics' });
  }
}

async function getStakingStats(args) {
  try {
    let url = APP_API + '/staking';
    if (args.wallet) url += '?wallet=' + encodeURIComponent(args.wallet);
    const res = await fetch(url);
    const data = await res.json();
    const result = {
      total_stakers: data.treasury?.total_stakers || 0,
      total_staked: data.treasury?.total_staked || '0',
      tvl_usd: data.treasury?.tvl_usd ? '$' + Number(data.treasury.tvl_usd).toLocaleString() : '$0',
      estimated_apy: data.treasury?.estimated_apy ? data.treasury.estimated_apy + '%' : 'N/A',
      total_distributed: data.treasury?.total_distributed || '0',
      total_distributed_usd: data.treasury?.total_distributed_usd ? '$' + Number(data.treasury.total_distributed_usd).toLocaleString() : '$0',
      last_distribution: data.treasury?.last_distribution_at || null,
      staking_url: 'https://inclawbate.app/stake',
      buy_claws: 'https://app.uniswap.org/swap?outputCurrency=0x7ca47B141639B893C6782823C0b219f872056379&chain=base'
    };
    if (args.wallet && data.wallet_position) {
      result.wallet_position = {
        staked: data.wallet_position.total_staked || '0',
        staked_usd: data.wallet_position.staked_usd ? '$' + Number(data.wallet_position.staked_usd).toLocaleString() : '$0',
        share: data.wallet_position.share_pct ? data.wallet_position.share_pct + '%' : '0%',
        daily_reward: data.wallet_position.estimated_daily_reward || '0',
        weekly_reward: data.wallet_position.estimated_weekly_reward || '0'
      };
    }
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ error: 'Could not fetch staking stats', staking_url: 'https://inclawbate.app/stake' });
  }
}

function bookPromoInfo(args) {
  const PROMO_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';
  return JSON.stringify({
    what: 'Promote your project on the @inclawbate X account.',
    tiers: [
      { name: 'Shoutout', posts: 1, price: '10,000 CLAWS', description: 'Single promotional post' },
      { name: 'Campaign', posts: 5, price: '40,000 CLAWS', description: '5 posts over a week' },
      { name: 'Featured', posts: 'Daily for 2 weeks', price: '100,000 CLAWS', description: 'Daily posts + ecosystem feature' }
    ],
    how_to_book: [
      'Choose a tier',
      'Send CLAWS to inclawbate.base.eth (' + PROMO_WALLET + ')',
      'Share the tx hash + project name here',
      'Posts scheduled within 24 hours'
    ],
    payment_wallet: PROMO_WALLET,
    payment_token: 'CLAWS (0x7ca47B141639B893C6782823C0b219f872056379)',
    selected_tier: args.tier || null, project: args.project_name || null
  });
}

async function disperseTokensAction(args) {
  try {
    const result = await disperseTokens({
      token_address: args.token_address,
      recipients: args.recipients,
      amounts: args.amounts
    });
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: err.message, hint: 'Airdrop failed. Make sure the token address is correct and the operator wallet has enough tokens.' });
  }
}

async function deployStakingAction(args) {
  try {
    const result = await deployStakingPool({
      token_address: args.token_address,
      creator_wallet: args.creator_wallet
    });
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: err.message, hint: 'Staking pool deployment failed. Make sure the token address is a valid Base token.' });
  }
}

async function healthCheck(args) {
  const results = { token: null, staking: null, project: null, suggestions: [] };

  const tokenAddr = args.token_address && args.token_address !== 'user_token_address' ? args.token_address : null;

  // If we have a wallet but no token, try to look up their project
  if (args.wallet && !tokenAddr) {
    try {
      const projRes = await fetch(APP_API + '/inclawbator?wallet=' + encodeURIComponent(args.wallet));
      const projData = await projRes.json();
      const projects = projData.projects || projData || [];
      if (projects.length) {
        results.project = projects.map(p => ({
          name: p.token_name || p.project_name, status: p.status,
          agent: p.agent_enabled ? 'Active' : 'Not set up',
          staking: p.staking_address ? 'Live' : 'Not deployed'
        }));
        // Use first project's token for analytics
        const firstToken = projects[0]?.token_address;
        if (firstToken) {
          args.token_address = firstToken;
        }
        const p = projects[0];
        if (!p.agent_enabled) results.suggestions.push('Set up an X marketing agent — free automated posting');
        if (!p.staking_address) results.suggestions.push('Deploy a staking pool to activate the CLAWS reward flywheel');
      } else {
        results.suggestions.push('No projects found for this wallet. Launch a token to get started!');
      }
    } catch (e) {}
  }

  // Token analytics from DexScreener
  const finalTokenAddr = args.token_address && args.token_address !== 'user_token_address' ? args.token_address : null;
  if (finalTokenAddr) {
    try {
      const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + finalTokenAddr);
      const data = await res.json();
      const pairs = (data.pairs || []).filter(p => p.chainId === 'base' || p.chainId === 'solana');
      if (pairs.length) {
        const top = pairs[0];
        results.token = {
          name: top.baseToken?.name, symbol: top.baseToken?.symbol,
          price: top.priceUsd || 'N/A', change_24h: top.priceChange?.h24 || 'N/A',
          volume_24h: top.volume?.h24 || 0, liquidity: top.liquidity?.usd || 0, fdv: top.fdv || 0
        };
        if ((top.volume?.h24 || 0) < 100) results.suggestions.push('Volume is very low — consider promoting or adding liquidity');
        if ((top.liquidity?.usd || 0) < 1000) results.suggestions.push('Liquidity is thin — consider adding more LP');
        if ((top.priceChange?.h24 || 0) < -20) results.suggestions.push('Price dropped significantly — engage your community');
      } else {
        results.suggestions.push('No trading pairs found on DexScreener');
      }
    } catch (e) {}
  }

  // Staking stats
  try {
    const stakingRes = await fetch(APP_API + '/staking');
    const stakingData = await stakingRes.json();
    if (stakingData.treasury) {
      results.staking = {
        total_stakers: stakingData.treasury.total_stakers || 0,
        tvl_usd: stakingData.treasury.tvl_usd || 0,
        apy: stakingData.treasury.estimated_apy || 'N/A',
        total_distributed: stakingData.treasury.total_distributed || 0
      };
    }
  } catch (e) {}

  // Project lookup if wallet provided and not already done
  if (args.wallet && !results.project) {
    try {
      const projRes = await fetch(APP_API + '/inclawbator?wallet=' + encodeURIComponent(args.wallet));
      const projData = await projRes.json();
      const projects = projData.projects || projData || [];
      if (projects.length) {
        results.project = projects.map(p => ({
          name: p.token_name || p.project_name, status: p.status,
          agent: p.agent_enabled ? 'Active' : 'Not set up',
          staking: p.staking_address ? 'Live' : 'Not deployed'
        }));
        const p = projects[0];
        if (!p.agent_enabled) results.suggestions.push('Set up an X marketing agent — free automated posting');
        if (!p.staking_address) results.suggestions.push('Deploy a staking pool to activate the CLAWS reward flywheel');
      }
    } catch (e) {}
  }

  if (!results.suggestions.length) results.suggestions.push('Everything looks healthy! Keep building and engaging your community.');

  return JSON.stringify({
    health_report: results,
    overall: results.suggestions.length <= 1 ? 'Healthy' : 'Needs attention',
    suggestion_count: results.suggestions.length
  });
}

async function hireInclawbatorInfo(args) {
  const desc = args.task_description || '';
  const contact = args.contact || '';
  if (!desc || !contact) {
    return JSON.stringify({
      error: 'Need both task_description and contact info to post a hire request.',
      hint: 'Ask the user: what do they need done, and how should the council reach them (X handle, Telegram, email, or wallet)?'
    });
  }
  try {
    const res = await fetch(APP_API + '/hire-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, contact: contact, budget_claws: args.budget_claws || 0 })
    });
    const data = await res.json();
    if (data.success) {
      return JSON.stringify({
        posted: true,
        message: 'Request posted to the Inclawbate Council Telegram group. A council member will reach out via: ' + contact,
        request_id: data.id,
        what_happens_next: 'Council members see the request, claim it, and contact you directly. Payment in CLAWS when work is delivered.'
      });
    }
    return JSON.stringify({ error: data.error || 'Failed to post hire request' });
  } catch (e) {
    return JSON.stringify({ error: 'Failed to reach hire-request API: ' + e.message });
  }
}

async function executeTool(name, args) {
  switch (name) {
    case 'get_ecosystem_info': return getEcosystemInfo();
    case 'get_incubation_info': return getIncubationInfo();
    case 'deploy_token': return await deployTokenAction(args);
    case 'create_agent_info': return createAgentInfo();
    case 'get_token_analytics': return await getTokenAnalytics(args);
    case 'get_staking_stats': return await getStakingStats(args);
    case 'book_promo': return bookPromoInfo(args);
    case 'disperse_tokens': return await disperseTokensAction(args);
    case 'deploy_staking': return await deployStakingAction(args);
    case 'health_check': return await healthCheck(args);
    case 'hire_inclawbator': return await hireInclawbatorInfo(args);
    default: return JSON.stringify({ error: 'Unknown tool' });
  }
}

// ── Session store ──
const sessions = new Map();

// ── LLM Providers (all free) ──
// Groq: primary (fast, free, rate-limited)
// Cerebras: fallback (free, fast Llama inference)
const CEREBRAS_API = 'https://api.cerebras.ai/v1/chat/completions';
const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY || '';

const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile'
];
const CEREBRAS_MODELS = [
  'llama-3.3-70b'
];

async function callLLM(messages) {
  // 1. Try Groq first (all keys × models)
  const groqAttempts = GROQ_KEYS.length * GROQ_MODELS.length;
  for (let attempt = 0; attempt < groqAttempts; attempt++) {
    const key = nextGroqKey();
    const model = GROQ_MODELS[attempt % GROQ_MODELS.length];
    try {
      const res = await fetch(GROQ_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: 'auto', max_tokens: 512 })
      });
      const data = await res.json();
      if (data.error) {
        const errMsg = data.error.message || data.error.type || '';
        const isRateLimit = res.status === 429 || errMsg.includes('rate_limit') || errMsg.includes('limit') || errMsg.includes('capacity') || errMsg.includes('overloaded');
        console.error('Groq error (' + model + ', key ' + (groqKeyIndex % GROQ_KEYS.length) + '):', errMsg);
        if (isRateLimit) continue;
        return data;
      }
      return data;
    } catch (e) {
      console.error('Groq fetch error (' + model + '):', e.message);
      continue;
    }
  }

  // 2. Fallback: Cerebras (free Llama)
  if (CEREBRAS_KEY) {
    for (const model of CEREBRAS_MODELS) {
      try {
        const res = await fetch(CEREBRAS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CEREBRAS_KEY },
          body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: 'auto', max_tokens: 512 })
        });
        const data = await res.json();
        if (!data.error) return data;
        console.error('Cerebras error (' + model + '):', data.error?.message || data.error);
      } catch (e) {
        console.error('Cerebras fetch error (' + model + '):', e.message);
      }
    }
  }

  return { error: { message: 'All LLM providers unavailable' } };
}

// Generate human-readable replies directly from tool data — skips the second LLM call
function generateDirectReply(tool, resultJson, args) {
  try {
    const d = JSON.parse(resultJson || '{}');
    if (d.error) return d.hint || d.error;

    switch (tool) {
      case 'get_ecosystem_info':
        return `Inclawbate is a self-sustaining engine that generates, manages, and distributes value forever. Anyone Can Build. Everyone Gets Paid.\n\nYou can launch tokens, deploy staking pools, create AI marketing agents, airdrop tokens, hire the Council, and get full incubation — all at inclawbate.app.\n\nThe ecosystem runs on $CLAWS on Base: ${d.token?.address || ''}`;

      case 'get_incubation_info':
        return `Full-service incubation — we handle everything: ${(d.services || []).join(', ')}.\n\nCost: ${d.cost}\n\nReach out on Telegram: ${d.contact?.telegram || 't.me/StuartDeFi'}`;

      case 'deploy_token':
        if (d.success) return `Token deployed!\n\n• **${args.token_name}** ($${args.token_symbol})\n• Contract: \`${d.token_address}\`\n• DEX: ${d.dex_url}\n• Tx: ${d.basescan_url}\n\nYour token is live on Base with automatic Uniswap liquidity. Anyone can trade it now.`;
        return d.error || 'Token deployment failed. Try again.';

      case 'create_agent_info':
        return "Here's how to create an AI marketing agent:\n" + (d.steps || []).map((s, i) => (i + 1) + '. ' + s).join('\n') + "\n\nAgents are free to create. Head to " + (d.url || 'inclawbate.app/dashboard');

      case 'get_token_analytics': {
        if (d.message) return d.message;
        const change = d.price_change_24h ? ` (${d.price_change_24h > 0 ? '+' : ''}${d.price_change_24h}% 24h)` : '';
        return `**${d.token || 'Token'}** (${d.symbol || '?'}) on ${d.chain || 'Base'}:\n• Price: $${d.price_usd}${change}\n• 24h Volume: $${Number(d.volume_24h || 0).toLocaleString()}\n• Liquidity: $${Number(d.liquidity_usd || 0).toLocaleString()}\n• FDV: $${Number(d.fdv || 0).toLocaleString()}`;
      }

      case 'get_staking_stats':
        return `Staking stats:\n• Total stakers: ${d.total_stakers}\n• TVL: ${d.tvl_usd}\n• APY: ${d.estimated_apy || 'N/A'}\n• Total distributed: ${d.total_distributed_usd || d.total_distributed}\n\nStake at: ${d.staking_url || 'inclawbate.app/stake'}` + (d.wallet_position ? `\n\nYour position: ${d.wallet_position.staked} staked (${d.wallet_position.share} share)` : '');

      case 'book_promo':
        return `Promote on @inclawbate X:\n\n` + (d.tiers || []).map(t => `• **${t.name}** — ${t.posts} post${t.posts === 1 ? '' : 's'}, ${t.price}`).join('\n') + `\n\nSend CLAWS to ${d.payment_wallet}, share the tx hash here, and posts go live within 24 hours.`;

      case 'disperse_tokens':
        if (d.success) return `Airdrop complete!\n\n• Recipients: ${d.recipients_count}\n• Total distributed: ${d.total_distributed}\n• Tx: ${d.basescan_url}`;
        return d.error || 'Airdrop failed. Try again.';

      case 'deploy_staking':
        if (d.error) return "Staking pool deployment failed: " + d.error + (d.hint ? "\n\n" + d.hint : '');
        return "Staking pool deployed!\n\nPool: " + d.pool_address + "\nStake: " + d.staking_token + "\nEarn: CLAWS\nAdmin: " + d.admin + "\n\nTx: " + d.basescan_url + "\n\nGo to https://inclawbate.app/dashboard, connect your wallet, and deposit CLAWS rewards to start the reward drip for stakers.";

      case 'hire_inclawbator':
        if (d.posted) return d.message + "\n\n" + d.what_happens_next;
        return d.message || d.error || 'Request submitted!';

      case 'health_check':
        // Let LLM interpret health checks — they need nuanced advice
        return null;

      default:
        return null;
    }
  } catch (e) {
    return null; // Fall back to LLM
  }
}

// Keyword-based intent matcher — fallback when Groq is unavailable
function matchIntent(msg) {
  const m = msg.toLowerCase();
  if (/(launch|deploy|create)\s*(a\s*)?(new\s*)?token/i.test(m) || /token\s*launch/i.test(m))
    return { tool: 'deploy_token', reply: "I'd love to help you launch a token! I need a few details:\n\n1. **Token name** (e.g. CrabCoin)\n2. **Ticker/symbol** (e.g. TCRAB)\n3. **Your wallet address** (receives 80% of LP fee rewards)\n\nOptional: description, image URL, website, X handle, Telegram link.\n\nWhat's the token name and symbol?" };
  if (/(stake|staking)\s*pool|deploy\s*stak/i.test(m))
    return { tool: 'deploy_staking', reply: "I can deploy a staking pool for your token! I need:\n\n1. **Token address** (the Base contract address)\n2. **Your wallet address** (becomes the pool admin)\n\nWhat's the token address?" };
  if (/airdrop|disperse|distribute\s*token/i.test(m))
    return { tool: 'disperse_tokens', reply: "I can help you airdrop tokens! I need:\n\n1. **Token address**\n2. **Recipient wallet addresses**\n3. **Amounts for each recipient**\n\nWhat token are you distributing?" };
  if (/price|analytics|volume|market\s*cap|how.*doing/i.test(m) && /0x[a-fA-F0-9]{40}/.test(m)) {
    const addr = m.match(/0x[a-fA-F0-9]{40}/)[0];
    return { tool: 'get_token_analytics', execute: true, args: { token_address: addr } };
  }
  if (/price|analytics|volume|chart/i.test(m))
    return { tool: 'get_token_analytics', reply: "I can look up token analytics! What's the token contract address?" };
  if (/health\s*check|diagnos/i.test(m))
    return { tool: 'health_check', reply: "I can run a health check on your project! What's your token address or wallet?" };
  if (/hire|council|help.*build/i.test(m))
    return { tool: 'hire_inclawbator', reply: "The Inclawbate Council is a team of real builders ready to help. What do you need built? I'll post your request to the Council." };
  if (/staking\s*stats|apy|tvl|staker/i.test(m))
    return { tool: 'get_staking_stats', reply: "I can check staking stats! What's the token you want stats for? (Or share your wallet to see your position.)" };
  if (/market.*agent|promo|advertis/i.test(m))
    return { tool: 'create_agent_info', reply: "I can help you set up an AI marketing agent that auto-posts to X! Head to inclawbate.app/dashboard, connect your wallet, and enable the agent on your token's card." };
  if (/what.*inclawbat|who.*you|what.*can.*do|help/i.test(m))
    return { tool: null, reply: "I'm the Inclawbator — the Inclawbate ecosystem AI agent. I can:\n\n• **Launch tokens** on Base via Clanker\n• **Deploy staking pools** for any token\n• **Airdrop tokens** to multiple wallets\n• **Check token analytics** (price, volume, liquidity)\n• **Run health checks** on your project\n• **Hire the Council** (real builders)\n• **Set up AI marketing agents**\n\nWhat would you like to do?" };
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { message, session_id, wallet } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });

  const sid = session_id || 'anon_' + Date.now();
  if (!sessions.has(sid)) sessions.set(sid, [{ role: 'system', content: SYSTEM_PROMPT }]);
  const history = sessions.get(sid);

  // Inject wallet context if provided
  const userMsg = wallet ? message + '\n\n[User wallet: ' + wallet + ']' : message;
  history.push({ role: 'user', content: userMsg });

  // Keep history manageable
  if (history.length > 22) {
    history.splice(1, history.length - 21);
  }

  try {
    let functionCalled = null;
    let toolArgs = null;
    let data = await callLLM(history);

    if (data.error) {
      // Groq unavailable — fall back to keyword intent matching
      const fallback = matchIntent(message);
      if (fallback) {
        if (fallback.execute && fallback.args) {
          const result = await executeTool(fallback.tool, fallback.args);
          const directReply = generateDirectReply(fallback.tool, result, fallback.args);
          const reply = directReply || 'Here are the results. Ask me anything else!';
          history.push({ role: 'assistant', content: reply });
          return res.status(200).json({ reply, function_called: fallback.tool, session_id: sid });
        }
        history.push({ role: 'assistant', content: fallback.reply });
        return res.status(200).json({ reply: fallback.reply, session_id: sid });
      }
      const defaultReply = "I'm the Inclawbator! I can launch tokens, deploy staking pools, airdrop tokens, check analytics, and more. What would you like to do?";
      history.push({ role: 'assistant', content: defaultReply });
      return res.status(200).json({ reply: defaultReply, session_id: sid });
    }

    let choice = data.choices?.[0];

    // Handle tool calls
    if (choice?.finish_reason === 'tool_calls' || choice?.message?.tool_calls) {
      const toolCalls = choice.message.tool_calls || [];
      history.push({ role: 'assistant', content: choice.message.content || null, tool_calls: toolCalls });

      for (const tc of toolCalls) {
        functionCalled = tc.function.name;
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) {}
        // Inject wallet into tools that accept it
        if (wallet && !args.wallet && (functionCalled === 'health_check' || functionCalled === 'get_staking_stats')) {
          args.wallet = wallet;
        }
        toolArgs = args;
        const result = await executeTool(tc.function.name, args);
        history.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }

      // For most tools, generate response directly (saves a Groq call = 2x throughput)
      const lastToolResult = history.filter(m => m.role === 'tool').pop();
      let directReply = generateDirectReply(functionCalled, lastToolResult?.content, toolArgs);

      if (directReply) {
        // Direct response — no second LLM call needed
        history.push({ role: 'assistant', content: directReply });
        return res.status(200).json({ reply: directReply, function_called: functionCalled, tool_args: toolArgs, session_id: sid });
      }

      // Complex tools (health_check) — use LLM to interpret
      data = await callLLM(history);
      if (data.error) {
        const fallback = 'I ran the check but had trouble summarizing. Try again in a moment!';
        history.push({ role: 'assistant', content: fallback });
        return res.status(200).json({ reply: fallback, function_called: functionCalled, tool_args: toolArgs, session_id: sid });
      }
      choice = data.choices?.[0];
    }

    let reply = choice?.message?.content || '';
    reply = reply.replace(/<function=[^>]*>[^<]*<\/function>/g, '').trim();
    if (!reply) reply = 'Hmm, let me try that again — ask me something else!';

    history.push({ role: 'assistant', content: reply });
    return res.status(200).json({ reply, function_called: functionCalled, tool_args: toolArgs, session_id: sid });
  } catch (e) {
    console.error('Agent chat error:', e);
    return res.status(500).json({ error: 'Agent error: ' + e.message });
  }
}
