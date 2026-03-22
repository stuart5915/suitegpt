// Inclawbate Homepage Chat — Groq-powered (free, fast)
// POST { message, session_id, wallet } → { reply, function_called, session_id }

import { launchToken, deployStakingPool } from './onchain-actions.js';
import { logToFeed } from './notify.js';

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
// Support multiple Groq API keys for higher throughput — comma-separated in env
const GROQ_KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
let groqKeyIndex = 0;
function nextGroqKey() { const k = GROQ_KEYS[groqKeyIndex % GROQ_KEYS.length]; groqKeyIndex++; return k; }
const APP_API = 'https://inclawbate.app/api/inclawbate';

const SYSTEM_PROMPT = `You are The Inclawbator — the official Inclawbate ecosystem AI agent.

Inclawbate is a self-sustaining engine that generates, manages, and distributes value forever. Anyone Can Build. Everyone Gets Paid.

You have 11 tools. Match the user's intent to the right one.

IMPORTANT: If your previous message asked the user for missing details (like a wallet address or token address), and the user's next message contains those details, call THE SAME TOOL AGAIN with the new information filled in. Do NOT switch to a different tool.

LAUNCH A TOKEN — Use deploy_token when you have name, symbol, AND the user's wallet address. Gather details conversationally (name, symbol, wallet required; description, image, website, X handle, telegram optional). The user's wallet receives 80% of LP fee rewards, Inclawbate receives 20%. If the user hasn't provided their wallet address, ASK for it before deploying — they need it to receive their fee rewards. The token launches on Base via Clanker automatically.

DEPLOY STAKING — Use deploy_staking when someone wants a staking pool for their token. Requires: token_address and creator_wallet. If the user hasn't provided their wallet address, ASK for it before deploying — their wallet becomes the pool admin so they can deposit rewards. If they haven't provided a token address, ASK for it too. The pool lets holders stake the token and earn CLAWS rewards. After deployment, tell them to go to inclawbate.app/dashboard to connect their wallet and deposit CLAWS rewards.

TOKEN ANALYTICS — Use get_token_analytics when someone asks about a token's price, volume, or liquidity. Requires a token address.

STAKING STATS — Use get_staking_stats when someone asks about staking APY, TVL, staker count, or their staking position. Can optionally take a wallet address.

HEALTH CHECK — Use health_check when someone asks how their project is doing. If they provide a wallet but no token address, use get_token_analytics on the CLAWS token as a fallback. Always pass the wallet if available.

MARKETING AGENT — Use create_agent_info when someone wants an AI agent that auto-posts to X/Twitter.

BOOK PROMO — Use book_promo when someone wants to promote their project through the @inclawbate X account.

AIRDROP / DISTRIBUTE — Use disperse_tokens when someone wants to airdrop or distribute tokens to multiple wallets. Collect token_address, recipients (array of addresses), and amounts (array of numbers). This returns instructions and a direct link to the airdrop tool — the user executes the transaction from their own wallet.

BUILD AN APP — Use build_app when someone says "build", "make", "create", or "generate" a website, app, page, site, landing page, dashboard, or UI. This tool AUTOMATICALLY builds and publishes a live web app — no human needed. Collect: app_name (short name for the URL) and description (what it should look like and do). The app will be generated and published live at inclawbate.app/s/[slug]. If they want updates to an existing app, include update: true and the same app_name. IMPORTANT: If someone asks to "build a website" or "make me an app", use build_app — NOT hire_inclawbator.

HIRE THE COUNCIL — Use hire_inclawbator ONLY when someone explicitly needs HUMAN help from the team (design consulting, strategy sessions, marketing campaigns, content creation). Do NOT use this when someone asks you to build/create/generate something — that's build_app. You MUST collect BOTH (1) what they need done and (2) how the council can reach them (X handle, Telegram, email, or wallet) BEFORE calling this tool. Do NOT call it without both fields. Ask for missing info first.

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
      description: 'Airdrop or distribute tokens to multiple wallets on Base. Returns instructions and a link to the airdrop tool.',
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
  },
  {
    type: 'function',
    function: {
      name: 'build_app',
      description: 'Build and publish a web app, landing page, or site. Generated with AI and published live.',
      parameters: {
        type: 'object',
        properties: {
          app_name: { type: 'string', description: 'Short name for the app (used in URL)' },
          description: { type: 'string', description: 'What the app should look like and do — be detailed' },
          update: { type: 'boolean', description: 'True if updating an existing app' }
        },
        required: ['app_name', 'description']
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

const isValidAddr = (a) => /^0x[a-fA-F0-9]{40}$/.test(a);

async function deployTokenAction(args) {
  const missing = [];
  if (!args.token_name) missing.push('token name');
  if (!args.token_symbol) missing.push('ticker/symbol');
  if (!isValidAddr(args.creator_wallet)) missing.push('your wallet address (receives 80% of LP fee rewards)');
  if (missing.length) return JSON.stringify({ needs_info: true, missing, message: 'I need a few more details to launch your token: ' + missing.join(', ') + '.' });

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
      'Go to https://inclawbate.app/schedule',
      'Name your agent and pick a vibe (degen, builder, scholar, or custom)',
      'Connect your X/Twitter account',
      'Set your posting schedule — and you\'re live!'
    ],
    url: 'https://inclawbate.app/schedule',
    note: 'Agents are free to create. Head to the link above to get started in under 2 minutes.'
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

function disperseTokensAction(args) {
  const DISPERSE_CONTRACT = '0xD152f549545093347A162Dce210e7293f1452150';
  const recipients = args.recipients || [];
  const amounts = args.amounts || [];
  const tokenAddr = args.token_address || '';

  // Build CSV-style list for the user
  const csvLines = recipients.map((r, i) => `${r},${amounts[i] || 0}`).join('\n');

  return JSON.stringify({
    method: 'self_execute',
    message: 'Airdrops require you to send from your own wallet (you hold the tokens). Use the Inclawbate airdrop tool to do it in a few clicks.',
    steps: [
      'Go to https://inclawbate.app/dashboard',
      'Connect the wallet that holds the tokens',
      'Open the Airdrop tool',
      'Paste your token address: ' + (tokenAddr || '(your token contract)'),
      'Paste the recipient list (address,amount per line)',
      'Approve token spending, then send the transaction'
    ],
    url: 'https://inclawbate.app/dashboard',
    disperse_contract: DISPERSE_CONTRACT,
    token_address: tokenAddr,
    recipients_csv: csvLines || null,
    recipient_count: recipients.length
  });
}

// ── Build App ──
const APP_GEN_PROMPT = `You are a web developer. Generate a COMPLETE, standalone HTML file based on the user's description.

Rules:
- Output ONLY the HTML code, nothing else — no markdown, no backticks, no explanation
- Must start with <!DOCTYPE html>
- All CSS must be embedded in <style> tags
- All JS must be embedded in <script> tags
- Use modern, clean design with dark theme (background: #0a0a0f, text: white, accent: #6366f1)
- Mobile responsive
- Use Google Fonts (Nunito or Inter) via CDN link
- Make it look professional and polished
- No external JS libraries unless absolutely necessary (use CDN if needed)
- Include proper meta tags and title`;

async function buildAppAction(args) {
  if (!args.app_name) return JSON.stringify({ needs_info: true, missing: ['app name'], message: 'What should we call this app? I need a short name for the URL.' });
  if (!args.description || args.description.length < 10) return JSON.stringify({ needs_info: true, missing: ['description'], message: 'Tell me more about what you want built — what should it look like? What should it do?' });

  const slug = args.app_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  if (!slug) return JSON.stringify({ error: 'Invalid app name — use letters and numbers.' });

  try {
    // Generate HTML using Groq Llama 70B (free)
    const genMessages = [
      { role: 'system', content: APP_GEN_PROMPT },
      { role: 'user', content: `Build this: ${args.description}\n\nApp name: ${args.app_name}` }
    ];

    let html = null;

    // Try Groq first
    for (const key of GROQ_KEYS) {
      try {
        const r = await fetch(GROQ_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: genMessages, max_tokens: 8000 })
        });
        const d = await r.json();
        if (d.choices?.[0]?.message?.content) { html = d.choices[0].message.content; break; }
      } catch (e) { continue; }
    }

    // Fallback: Cerebras
    if (!html && CEREBRAS_KEY) {
      try {
        const r = await fetch(CEREBRAS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CEREBRAS_KEY },
          body: JSON.stringify({ model: 'llama-3.3-70b', messages: genMessages, max_tokens: 8000 })
        });
        const d = await r.json();
        if (d.choices?.[0]?.message?.content) html = d.choices[0].message.content;
      } catch (e) { /* fallback failed */ }
    }

    if (!html) return JSON.stringify({ error: 'Could not generate the app right now. Try again in a moment.' });

    // Clean up — remove markdown code fences if present
    html = html.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();
    if (!html.includes('<!DOCTYPE') && !html.includes('<!doctype')) {
      html = '<!DOCTYPE html>\n' + html;
    }

    // Publish via publish-site API
    const publishRes = await fetch('https://www.inclawbate.app/api/publish-site', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: args.app_name,
        slug,
        code: html,
        email: 'inclawbator@inclawbate.app',
        description: args.description.slice(0, 200),
        source: 'inclawbator-chat',
        category: 'other',
        is_listed: true,
        update: !!args.update
      })
    });
    const publishData = await publishRes.json();

    if (publishData.error) {
      // If slug taken and not updating, try with a suffix
      if (publishData.error.includes('already taken') && !args.update) {
        const newSlug = slug + '-' + Date.now().toString(36).slice(-4);
        const retryRes = await fetch('https://www.inclawbate.app/api/publish-site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: args.app_name,
            slug: newSlug,
            code: html,
            email: 'inclawbator@inclawbate.app',
            description: args.description.slice(0, 200),
            source: 'inclawbator-chat',
            category: 'other',
            is_listed: true
          })
        });
        const retryData = await retryRes.json();
        if (retryData.error) return JSON.stringify({ error: retryData.error });
        return JSON.stringify({ success: true, url: retryData.url, slug: newSlug, app_name: args.app_name });
      }
      return JSON.stringify({ error: publishData.error });
    }

    return JSON.stringify({ success: true, url: publishData.url, slug, app_name: args.app_name, updated: !!args.update });
  } catch (err) {
    return JSON.stringify({ error: err.message });
  }
}

async function deployStakingAction(args) {
  const missing = [];
  if (!isValidAddr(args.token_address)) missing.push('token contract address');
  if (!isValidAddr(args.creator_wallet)) missing.push('your wallet address (will become the pool admin)');
  if (missing.length) return JSON.stringify({ needs_info: true, missing, message: 'I need a few more details to deploy the staking pool: ' + missing.join(' and ') + '.' });

  try {
    const result = await deployStakingPool({
      token_address: args.token_address,
      creator_wallet: args.creator_wallet
    });
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: err.message, hint: 'Staking pool deployment failed: ' + err.message });
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
        what_happens_next: 'A Council member will claim your request and contact you within 24 hours. Payment in CLAWS when work is delivered.',
        contact_methods: {
          telegram_group: 'https://t.me/inclawbate',
          x_dm: 'https://x.com/inclawbate',
          note: 'If you need faster response, drop a message in the Telegram group or DM @inclawbate on X.'
        }
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
    case 'build_app': return await buildAppAction(args);
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

const BANKR_API = 'https://llm.bankr.bot/v1/chat/completions';
const BANKR_KEY = process.env.BANKR_API_KEY || '';

const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile'
];
const BANKR_MODELS = [
  'deepseek-v3.2',
  'qwen3.5-flash'
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

  // 2. Fallback: Bankr LLM Gateway (usage tracked on Bankr profile)
  if (BANKR_KEY) {
    for (const model of BANKR_MODELS) {
      try {
        const res = await fetch(BANKR_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + BANKR_KEY },
          body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: 'auto', max_tokens: 512 })
        });
        const data = await res.json();
        if (!data.error) return data;
        console.error('Bankr error (' + model + '):', data.error?.message || data.error);
      } catch (e) {
        console.error('Bankr fetch error (' + model + '):', e.message);
      }
    }
  }

  // 3. Fallback: Cerebras (free Llama)
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
    if (d.needs_info) return d.message;
    if (d.error) return d.hint || d.error;

    switch (tool) {
      case 'get_ecosystem_info':
        return `Inclawbate is a self-sustaining engine that generates, manages, and distributes value forever. Anyone Can Build. Everyone Gets Paid.\n\nYou can launch tokens, deploy staking pools, create AI marketing agents, airdrop tokens, hire the Council, and get full incubation — all at inclawbate.app.\n\nThe ecosystem runs on $CLAWS on Base: ${d.token?.address || ''}`;

      case 'get_incubation_info':
        return `Full-service incubation — we handle everything: ${(d.services || []).join(', ')}.\n\nCost: ${d.cost}\n\nReach out on Telegram: ${d.contact?.telegram || 't.me/StuartDeFi'}`;

      case 'deploy_token':
        if (d.success) return `Token deployed!\n\n• **${args.token_name}** ($${args.token_symbol})\n• Contract: \`${d.token_address}\`\n• Clanker: ${d.clanker_url}\n• Tx: ${d.basescan_url}\n\nYour token is live on Base with automatic Uniswap liquidity. Anyone can trade it now.`;
        return d.error || 'Token deployment failed. Try again.';

      case 'create_agent_info':
        return "Here's how to create an AI marketing agent:\n" + (d.steps || []).map((s, i) => (i + 1) + '. ' + s).join('\n') + "\n\n" + (d.note || 'Agents are free to create.');

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
        if (d.method === 'self_execute') return d.message + "\n\n" + (d.steps || []).map((s, i) => (i + 1) + '. ' + s).join('\n') + (d.recipients_csv ? "\n\nRecipient list:\n```\n" + d.recipients_csv + "\n```" : '');
        if (d.success) return `Airdrop complete!\n\n• Recipients: ${d.recipients_count}\n• Total distributed: ${d.total_distributed}\n• Tx: ${d.basescan_url}`;
        return d.error || 'Airdrop failed. Try again.';

      case 'deploy_staking':
        if (d.error) return "Staking pool deployment failed: " + d.error + (d.hint ? "\n\n" + d.hint : '');
        return "Staking pool deployed!\n\nPool: " + d.pool_address + "\nStake: " + d.staking_token + "\nEarn: CLAWS\nAdmin: " + d.admin + "\n\nTx: " + d.basescan_url + "\n\nView your pool: https://inclawbate.app/stake\nDeposit rewards: https://inclawbate.app/dashboard (connect wallet → deposit CLAWS)";

      case 'hire_inclawbator':
        if (d.posted) {
          let reply = d.message + "\n\n" + d.what_happens_next;
          if (d.request_id) reply += "\n\nRequest ID: " + d.request_id;
          if (d.contact_methods) reply += "\n\nNeed faster response? " + d.contact_methods.note;
          return reply;
        }
        return d.message || d.error || 'Request submitted!';

      case 'build_app':
        if (d.error) return "App build failed: " + d.error;
        if (d.needs_info) return d.message;
        return (d.updated ? "App updated!" : "App built!") + "\n\nLive at: " + d.url + "\n\n(May take a moment to appear — hard refresh if needed.)\n\nWant me to make any changes? Just describe what you'd like updated.\n\nNeed higher quality or a custom build? DM @inclawbate on X or visit inclawbate.app/build for premium builds.";

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
  if (/(launch|deploy|create|make)\s*(me\s*)?(a\s*)?(new\s*)?token/i.test(m) || /token\s*(launch|called|named)/i.test(m) || /make\s*me\s*a\s*(coin|token)/i.test(m)) {
    // Try to extract name/symbol from the message
    const calledMatch = m.match(/(?:called|named)\s+(.+?)(?:\s+(?:and|with)\s+(?:ticker|symbol)\s+(\w+)|$)/i);
    const tickerMatch = m.match(/(?:ticker|symbol)\s+(\w+)/i);
    const hasName = calledMatch ? calledMatch[1].trim() : null;
    const hasSymbol = tickerMatch ? tickerMatch[1] : (calledMatch && calledMatch[2]) || null;
    const hasWallet = m.match(/0x[a-fA-F0-9]{40}/);
    const missing = [];
    if (!hasName) missing.push('**Token name**');
    if (!hasSymbol) missing.push('**Ticker/symbol**');
    if (!hasWallet) missing.push('**Your wallet address** (receives 80% of LP fee rewards)');
    const ack = hasName ? `Got it — "${hasName}"${hasSymbol ? ` ($${hasSymbol.toUpperCase()})` : ''}! ` : '';
    return { tool: 'deploy_token', reply: ack + (missing.length ? "I still need: " + missing.join(', ') + "." : "Ready to deploy! Confirm and I'll launch it.") };
  }
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
    return { tool: 'create_agent_info', reply: "I can help you set up an AI marketing agent that auto-posts to X! Head to https://inclawbate.app/schedule — name it, pick a vibe, connect X, and you're live." };
  if (/(build|make|create|generate)\s+\w*\s*(a\s+)?(web\s*)?(?:site|website|app|page|landing|dashboard|ui|game)/i.test(m) || /(build|make|create)\s+(?:an?\s+)?(?:app|site|website|page|game)/i.test(m) || /(?:want|need)\s+(?:a\s+)?(?:website|app|site|page|landing)/i.test(m))
    return { tool: 'build_app', reply: "I can build you a web app and publish it live! I need:\n\n1. **App name** (short name for the URL)\n2. **Description** (what it should look like and do)\n\nWhat do you want me to build?" };
  if (/what.*inclawbat|who.*you|what.*can.*do|help/i.test(m))
    return { tool: null, reply: "I'm the Inclawbator — the Inclawbate ecosystem AI agent. I can:\n\n• **Launch tokens** on Base via Clanker\n• **Deploy staking pools** for any token\n• **Airdrop tokens** to multiple wallets\n• **Check token analytics** (price, volume, liquidity)\n• **Run health checks** on your project\n• **Hire the Council** (real builders)\n• **Set up AI marketing agents**\n• **Build web apps** — I'll generate and publish them live\n\nWhat would you like to do?" };
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { message, session_id, wallet, client_history } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });

  const sid = session_id || 'anon_' + Date.now();

  // Prefer client-side history (Vercel serverless functions are stateless across cold starts)
  if (Array.isArray(client_history) && client_history.length > 0) {
    // Rebuild history from client — only allow user/assistant roles, sanitize
    const rebuilt = [{ role: 'system', content: SYSTEM_PROMPT }];
    for (const msg of client_history.slice(-20)) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        rebuilt.push({ role: msg.role, content: String(msg.content || '').slice(0, 2000) });
      }
    }
    sessions.set(sid, rebuilt);
  }

  if (!sessions.has(sid)) sessions.set(sid, [{ role: 'system', content: SYSTEM_PROMPT }]);
  const history = sessions.get(sid);

  // Detect source for feed logging (X replies are logged from x-responder with tweet URL)
  const xMentionMatch = message.match(/^\[X mention from @(\w+)\]/);
  const feedSource = xMentionMatch ? 'x' : 'website';
  const feedUser = xMentionMatch ? `@${xMentionMatch[1]}` : (wallet ? wallet.slice(0, 10) + '...' : null);
  const rawMessage = xMentionMatch ? message.replace(/^\[X mention from @\w+\]:\s*/, '') : message;

  // Helper: log to @inclawbator feed then return response (skip X — logged from x-responder with tweet link)
  const sendReply = (body) => {
    if (feedSource !== 'x') {
      logToFeed({ source: feedSource, user: feedUser, message: rawMessage, reply: body.reply, tool: body.function_called }).catch(() => {});
    }
    return res.status(200).json(body);
  };

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
          return sendReply({ reply, function_called: fallback.tool, session_id: sid });
        }
        history.push({ role: 'assistant', content: fallback.reply });
        return sendReply({ reply: fallback.reply, session_id: sid });
      }
      const defaultReply = "I'm the Inclawbator! I can launch tokens, deploy staking pools, airdrop tokens, check analytics, and more. What would you like to do?";
      history.push({ role: 'assistant', content: defaultReply });
      return sendReply({ reply: defaultReply, session_id: sid });
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
        return sendReply({ reply: directReply, function_called: functionCalled, tool_args: toolArgs, session_id: sid });
      }

      // Complex tools (health_check) — use LLM to interpret
      data = await callLLM(history);
      if (data.error) {
        const fallback = 'I ran the check but had trouble summarizing. Try again in a moment!';
        history.push({ role: 'assistant', content: fallback });
        return sendReply({ reply: fallback, function_called: functionCalled, tool_args: toolArgs, session_id: sid });
      }
      choice = data.choices?.[0];
    }

    let reply = choice?.message?.content || '';
    // Strip raw function call tags the LLM sometimes outputs in text
    // Matches both <function=name>...</function> and <name>...</function>
    reply = reply.replace(/<(?:function=)?[a-z_]+>[^<]*<\/function>/gi, '').trim();

    // Fallback: LLM sometimes outputs tool args as raw JSON text instead of using tool_calls
    if (!functionCalled && reply) {
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          // Detect which tool the JSON belongs to by checking key fields
          let detectedTool = null;
          if (parsed.app_name !== undefined || (parsed.description && reply.toLowerCase().includes('build'))) detectedTool = 'build_app';
          else if (parsed.token_name && parsed.token_symbol) detectedTool = 'deploy_token';
          else if (parsed.token_address && parsed.creator_wallet && !parsed.recipients) detectedTool = 'deploy_staking';
          else if (parsed.recipients && parsed.amounts) detectedTool = 'disperse_tokens';
          else if (parsed.task_description !== undefined) detectedTool = 'hire_inclawbator';

          if (detectedTool) {
            const result = await executeTool(detectedTool, parsed);
            const directReply = generateDirectReply(detectedTool, result, parsed);
            if (directReply) {
              history.push({ role: 'assistant', content: directReply });
              return sendReply({ reply: directReply, function_called: detectedTool, tool_args: parsed, session_id: sid });
            }
          }
        } catch (_) { /* not valid JSON, continue normally */ }
      }
    }

    if (!reply) reply = 'Hmm, let me try that again — ask me something else!';

    history.push({ role: 'assistant', content: reply });
    return sendReply({ reply, function_called: functionCalled, tool_args: toolArgs, session_id: sid });
  } catch (e) {
    console.error('Agent chat error:', e);
    return res.status(500).json({ error: 'Agent error: ' + e.message });
  }
}
