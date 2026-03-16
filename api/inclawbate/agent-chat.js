// Inclawbate Homepage Chat — Groq-powered (free, fast)
// POST { message, session_id } → { reply, function_called, session_id }

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = process.env.GROQ_API_KEY;
const APP_API = 'https://inclawbate.com/api/inclawbate';

const SYSTEM_PROMPT = `You are The Inclawbator — the official Inclawbate ecosystem agent. Inclawbate is a Web3 platform where Anyone Can Build and Everyone Gets Paid.

You are a knowledgeable guide across the ENTIRE Inclawbate ecosystem. You help people take action:

LAUNCH A TOKEN — When someone wants to launch/create/deploy a token, first use launch_token_info to open the launch form. Then ask them for details: token name, symbol, and description (required). Also ask which chain they want to launch on — Base (via Clanker, default) or Solana (via Bags/Meteora). Also ask about optional fields: image URL, website, X handle, telegram. As you gather info, call configure_token_launch with whatever details you have so far — you can call it multiple times as you learn more. Include the chain field if specified. The form will auto-fill on their screen. When all required fields are filled, tell them to click Deploy. Do NOT send them to a different page.

BUILD AN APP — When someone wants to build/create an app, use build_app_info. They can use the AI app builder at inclawbate.com/build — no code needed.

CREATE A MARKETING AGENT — When someone wants to set up an AI agent that posts to X/Twitter, use create_agent_info. They create agents from their dashboard.

CREATE A STAKE POOL — When someone wants staking for their token, use create_staking_info. Staking deployment is handled by the Inclawbate team as part of the incubation program.

DISCOVER APPS — Use browse_apps to find community-built apps in the app store.

STAKE CLAWS — Use get_staking_info to explain CLAWS staking and earning passive income.

FIND YIELD — Use get_basis_vaults to show DeFi yield vaults on Basis.

EXPLORE ECOSYSTEM — Use get_ecosystem_info for an overview of everything Inclawbate offers.

HIRE A HUMAN — When someone needs help with logo design, smart contracts, marketing strategy, content, or anything that requires human expertise, use browse_inclawbators to find available Inclawbators. For actually initiating a hire, use hire_inclawbator. They're vetted humans paid in CLAWS, direct wallet-to-wallet with zero platform fees. You can also use browse_open_gigs to show open gig requests — this is a freelance marketplace where hirers post requests and inclawbators apply.

BROWSE GIGS — When someone asks about available work, freelance opportunities, what help people need, or wants to find a gig to work on, use browse_open_gigs. This shows open gig requests from the ecosystem that inclawbators can claim.

BUILD A LANDING PAGE — When someone wants a branded page for their project, use build_landing_page. The AI builder creates full pages with no code needed.

REGISTER AN EXISTING PROJECT — When someone already has a token deployed elsewhere and wants to join the Inclawbate ecosystem, use register_project to explain how to register and get access to staking, agents, and the CLAWS flywheel.

CHECK STAKING STATS — When someone asks about staking performance, TVL, APY, or their staking position, use get_staking_stats to pull live data.

PROMOTE YOUR PROJECT — When someone wants to promote their project through the @inclawbate X account, use book_promo to show tiers and pricing. Projects can pay CLAWS to get promotional posts on the Inclawbate X schedule.

AIRDROP / DISTRIBUTE — When someone wants to airdrop or distribute tokens to multiple wallets, use disperse_tokens. Uses the Disperse contract for gas-efficient batch transfers.

DEPLOY STAKING — When someone wants to create a staking pool for their token, use deploy_staking. Staking pools are deployed via the Staking Factory with automatic CLAWS reward funding.

PROJECT HEALTH CHECK — When someone asks how their project is doing, use health_check with their token address and/or wallet. Pulls live data from DexScreener + staking + project registry.

CHECK HIRE STATUS — When someone asks about a hire they made, use check_hire_status to guide them.

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
          telegram_url: { type: 'string', description: 'Telegram group URL' },
          chain: { type: 'string', enum: ['base', 'solana'], description: 'Which chain to deploy on — base (Clanker) or solana (Bags/Meteora)' }
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
  },
  {
    type: 'function',
    function: {
      name: 'get_token_analytics',
      description: 'Get real-time token price, volume, liquidity from DexScreener. Use when someone asks about a token\'s performance, price, or trading activity.',
      parameters: {
        type: 'object',
        properties: {
          token_address: { type: 'string', description: 'Token contract address' }
        },
        required: ['token_address']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'setup_x_agent',
      description: 'Get info on setting up an X/Twitter marketing agent for a project. Use when someone wants automated posting, marketing, or X presence.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_project_status',
      description: 'Check the status of all projects launched by a wallet — tokens, staking, chain. Use when someone asks about their project status or wants to see what they\'ve launched.',
      parameters: {
        type: 'object',
        properties: {
          wallet: { type: 'string', description: 'Creator wallet address' }
        },
        required: ['wallet']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browse_inclawbators',
      description: 'Search for human Inclawbators available for hire — designers, developers, marketers, content writers. Use when someone needs help that requires a human (logo, branding, smart contracts, marketing strategy).',
      parameters: {
        type: 'object',
        properties: {
          skill: { type: 'string', description: 'Specialty filter: design, development, marketing, content, strategy' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'hire_inclawbator',
      description: 'Initiate hiring a specific human Inclawbator. Use after browse_inclawbators when user has chosen someone. Explains the payment + hiring process.',
      parameters: {
        type: 'object',
        properties: {
          handle: { type: 'string', description: 'X handle of the Inclawbator to hire' },
          task_description: { type: 'string', description: 'What the user needs done' },
          skill: { type: 'string', description: 'Required skill: design, development, marketing, content' }
        },
        required: ['handle']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browse_open_gigs',
      description: 'Show open gig requests from the ecosystem. Use when someone asks about available work, freelance opportunities, open gigs, or what help people need. Also use when an Inclawbator wants to find work.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Filter by category: design, dev, marketing, content, strategy' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'build_landing_page',
      description: 'Help user create a branded landing page for their project. Opens the AI app builder with project context. Use when someone needs a website, landing page, or project page.',
      parameters: {
        type: 'object',
        properties: {
          project_name: { type: 'string', description: 'Name of the project' },
          description: { type: 'string', description: 'What the project does' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'register_project',
      description: 'Register an existing token/project in the Inclawbate ecosystem. Use when someone already launched a token elsewhere and wants to join for staking, agents, and the CLAWS reward flywheel.',
      parameters: {
        type: 'object',
        properties: {
          project_name: { type: 'string', description: 'Project or token name' },
          token_address: { type: 'string', description: 'Deployed token contract address' },
          chain: { type: 'string', enum: ['base', 'solana'], description: 'Chain the token is on' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_staking_stats',
      description: 'Get live staking stats — TVL, APY, total stakers, distribution info. Optionally check a specific wallet position. Use when someone asks about staking performance or their staking status.',
      parameters: {
        type: 'object',
        properties: {
          wallet: { type: 'string', description: 'Optional wallet address to check their specific position' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'book_promo',
      description: 'Get info on promoting a project through the @inclawbate X account. Shows promo tiers, pricing in CLAWS, and booking process. Use when someone wants marketing, promotion, or exposure for their project.',
      parameters: {
        type: 'object',
        properties: {
          project_name: { type: 'string', description: 'Name of the project to promote' },
          tier: { type: 'string', enum: ['shoutout', 'campaign', 'featured'], description: 'Promo tier if already chosen' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'disperse_tokens',
      description: 'Airdrop or distribute tokens to multiple wallets in one transaction using the Disperse contract. Use when someone wants to airdrop, distribute, or send tokens to a list of addresses.',
      parameters: {
        type: 'object',
        properties: {
          token_address: { type: 'string', description: 'Token contract address to distribute' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deploy_staking',
      description: 'Deploy a staking pool for a token via the Staking Factory. The pool lets holders stake the token and earn CLAWS rewards. Use when someone wants to create a staking pool or add staking to their project.',
      parameters: {
        type: 'object',
        properties: {
          token_address: { type: 'string', description: 'Token contract address to create staking for' },
          project_name: { type: 'string', description: 'Project name for context' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'health_check',
      description: 'Run a comprehensive health check on a project — token price, volume, staking stats, and actionable suggestions. Use when someone asks how their project is doing or wants an assessment.',
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
      name: 'check_hire_status',
      description: 'Check the status of an active hire with an Inclawbator. Use when someone asks about a hire they made or wants to follow up on work.',
      parameters: {
        type: 'object',
        properties: {
          handle: { type: 'string', description: 'X handle of the hired Inclawbator' },
          wallet: { type: 'string', description: 'Wallet address of the person who hired' }
        }
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
  if (args.chain) fields.chain = args.chain;
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

async function getTokenAnalytics(args) {
  const address = args.token_address || '';
  if (!address) return JSON.stringify({ error: 'Token address required' });
  try {
    const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + address);
    const data = await res.json();
    const pairs = (data.pairs || []).filter(p => p.chainId === 'base' || p.chainId === 'solana');
    if (!pairs.length) return JSON.stringify({ message: 'No trading pairs found for this token on DexScreener', token_address: address });
    const top = pairs[0];
    return JSON.stringify({
      token: top.baseToken?.name || 'Unknown',
      symbol: top.baseToken?.symbol || '?',
      chain: top.chainId,
      price_usd: top.priceUsd || 'N/A',
      price_change_24h: top.priceChange?.h24 || 'N/A',
      volume_24h: top.volume?.h24 || 0,
      liquidity_usd: top.liquidity?.usd || 0,
      fdv: top.fdv || 0,
      pair_url: top.url || '',
      dex: top.dexId || ''
    });
  } catch (e) {
    return JSON.stringify({ error: 'Could not fetch token analytics' });
  }
}

function setupXAgentInfo() {
  return JSON.stringify({
    action: 'open_marketing_agents',
    how: 'Create an AI agent that auto-posts to X/Twitter about your project. Free forever — up to 3 posts/day + auto-replies.',
    steps: [
      '1. Go to the Agents tab or say "take me to agents"',
      '2. Click "+ Create Agent"',
      '3. Name it, pick a vibe (degen, hype, chill, pro, meme)',
      '4. Connect your X account via OAuth',
      '5. Set posting schedule (1-48 posts/day)',
      '6. Preview drafts before they go live'
    ],
    url: 'https://inclawbate.com/agents',
    note: 'Agents are completely free. They post on your behalf using AI-generated content tailored to your project.'
  });
}

async function getProjectStatus(args) {
  const wallet = (args.wallet || '').toLowerCase();
  if (!wallet) return JSON.stringify({ error: 'Wallet address required' });
  try {
    const res = await fetch(APP_API + '/inclawbator?wallet=' + encodeURIComponent(wallet));
    const data = await res.json();
    const projects = (data.projects || data || []);
    if (!projects.length) return JSON.stringify({ message: 'No projects found for this wallet. Launch a token to get started!' });
    const summary = projects.map(p => ({
      name: p.token_name || p.project_name,
      symbol: p.token_symbol,
      chain: p.chain || 'base',
      token_address: p.token_address,
      staking: p.staking_address ? 'Live' : 'Not deployed',
      status: p.status || 'active',
      created: p.created_at
    }));
    return JSON.stringify({ project_count: summary.length, projects: summary });
  } catch (e) {
    return JSON.stringify({ error: 'Could not fetch project status' });
  }
}

async function browseInclawbators(args) {
  try {
    let url = APP_API + '/humans?sort=hires&limit=8';
    if (args.skill) url += '&skill=' + encodeURIComponent(args.skill);
    const res = await fetch(url);
    const data = await res.json();
    const profiles = (data.profiles || []).filter(p => p.availability !== 'unavailable').slice(0, 6).map(p => ({
      name: p.display_name || p.x_name || p.x_handle,
      handle: p.x_handle ? '@' + p.x_handle : null,
      skills: (p.skills || []).slice(0, 4),
      tagline: (p.tagline || '').slice(0, 100),
      availability: p.availability || 'available',
      hires: p.hire_count || 0,
      earned: p.total_paid ? Math.round(p.total_paid) + ' CLAWS' : '0 CLAWS'
    }));
    if (!profiles.length) return JSON.stringify({ message: 'No Inclawbators found matching that skill. Check the full directory at inclawbate.com/inclawbator or post a gig request!' });
    return JSON.stringify({
      action: 'show_inclawbators',
      count: profiles.length,
      inclawbators: profiles,
      directory_url: 'https://inclawbate.com/inclawbator',
      payment: 'CLAWS token, direct wallet-to-wallet, zero platform fee',
      tip: 'You can also post a gig request and matching inclawbators will be notified automatically.'
    });
  } catch (e) {
    return JSON.stringify({ error: 'Could not fetch Inclawbators', directory_url: 'https://inclawbate.com/inclawbator' });
  }
}

function hireInclawbatorInfo(args) {
  const handle = args.handle || '';
  return JSON.stringify({
    action: 'initiate_hire',
    who: handle ? '@' + handle.replace(/^@/, '') : 'an Inclawbator',
    task: args.task_description || null,
    process: [
      '1. Send CLAWS payment directly to the Inclawbator\'s wallet',
      '2. Share the transaction hash here or on the platform',
      '3. The Inclawbator gets notified via Telegram',
      '4. They\'ll reach out to discuss details and deliver the work',
      '5. All communication happens through the Inclawbate platform'
    ],
    payment: 'CLAWS token on Base, direct wallet-to-wallet, zero platform fee',
    directory_url: 'https://inclawbate.com/inclawbator',
    note: handle
      ? 'Ready to hire @' + handle.replace(/^@/, '') + '! Send CLAWS to their wallet and share the tx hash to get started.'
      : 'Browse the Inclawbators directory to find the right person first.'
  });
}

async function browseOpenGigs(args) {
  try {
    let url = APP_API + '/gigs?status=open&limit=10';
    if (args.category) url += '&category=' + encodeURIComponent(args.category);
    const res = await fetch(url);
    const data = await res.json();
    const gigs = (data.gigs || []).slice(0, 8).map(g => ({
      description: (g.description || '').slice(0, 120),
      category: g.category,
      budget: Number(g.budget_claws).toLocaleString() + ' CLAWS',
      timeline: g.timeline === 'asap' ? 'ASAP' : g.timeline === 'week' ? 'This week' : 'No rush',
      posted_by: g.hirer_handle ? '@' + g.hirer_handle : 'anonymous'
    }));
    if (!gigs.length) return JSON.stringify({ message: 'No open gigs right now. Post one at inclawbate.com/agents!' });
    return JSON.stringify({
      action: 'show_open_gigs',
      count: gigs.length,
      gigs,
      post_url: 'https://inclawbate.com/agents',
      note: 'Click "Open gigs" to browse the full list, or "Post a gig" to create your own request.'
    });
  } catch (e) {
    return JSON.stringify({ error: 'Could not fetch gigs', url: 'https://inclawbate.com/agents' });
  }
}

function buildLandingPageInfo(args) {
  return JSON.stringify({
    action: 'open_builder',
    how: 'Build a branded landing page for your project using the AI app builder — no code needed.',
    steps: [
      '1. Go to inclawbate.com/build',
      '2. Describe your project — the AI generates a full branded page',
      '3. Preview and iterate until you\'re happy',
      '4. Publish — your page goes live at inclawbate.com/apps/your-slug'
    ],
    url: 'https://inclawbate.com/build',
    note: 'The builder supports custom branding, token integrations, social links, and interactive elements.',
    project_context: args.project_name ? { name: args.project_name, description: args.description } : null
  });
}

function registerProjectInfo(args) {
  return JSON.stringify({
    action: 'open_register',
    how: 'Register your existing project in the Inclawbate ecosystem to unlock staking, agents, and the CLAWS reward flywheel.',
    steps: [
      '1. Connect your wallet on inclawbate.com',
      '2. Come back here to the Inclawbator chat',
      '3. Launch your token through us, or tell us your existing token address',
      '4. We\'ll register it in the ecosystem and set up your staking pool',
      '5. The CLAWS reward flywheel activates automatically — 20% of LP fees fund staker rewards forever'
    ],
    benefits: [
      'Staking pool with auto-funded CLAWS rewards',
      'X/Twitter marketing agent (free)',
      'App store listing in ecosystem directory',
      'Ecosystem co-promotion with other projects',
      'Analytics dashboard for your project'
    ],
    url: 'https://inclawbate.com/inclawbator',
    project_info: args.project_name ? { name: args.project_name, token_address: args.token_address, chain: args.chain } : null
  });
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
      token: data.token?.symbol || 'INCLAWNCH',
      staking_url: 'https://inclawbate.com/stake'
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
    return JSON.stringify({ error: 'Could not fetch staking stats', staking_url: 'https://inclawbate.com/stake' });
  }
}

function bookPromoInfo(args) {
  const PROMO_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';
  return JSON.stringify({
    action: 'show_promo_tiers',
    what: 'Get your project promoted on the @inclawbate X account — reach the entire ecosystem audience.',
    tiers: [
      { name: 'Shoutout', posts: 1, price: '10,000 CLAWS', description: 'Single promotional post about your project' },
      { name: 'Campaign', posts: 5, price: '40,000 CLAWS', description: '5 posts over a week — varied angles, hashtags, engagement hooks' },
      { name: 'Featured', posts: 'Daily for 2 weeks', price: '100,000 CLAWS', description: 'Daily posts + featured in ecosystem page + co-promotion with other projects' }
    ],
    selected_tier: args.tier || null,
    project: args.project_name || null,
    how_to_book: [
      '1. Choose a tier (Shoutout, Campaign, or Featured)',
      '2. Send CLAWS to inclawbate.base.eth (' + PROMO_WALLET + ')',
      '3. Share the tx hash + your project name and description here',
      '4. Posts are created by AI, reviewed, and scheduled within 24 hours'
    ],
    payment_wallet: PROMO_WALLET,
    payment_token: 'CLAWS (0x7ca47B141639B893C6782823C0b219f872056379)',
    note: 'All promo content is AI-generated based on your project info and tailored to the Inclawbate audience. You can review drafts before they go live.'
  });
}

function disperseTokensInfo(args) {
  return JSON.stringify({
    action: 'open_airdrop',
    how: 'Distribute tokens to multiple wallets in a single transaction using the Disperse contract on Base.',
    steps: [
      '1. Go to inclawbate.com/tools#disperse',
      '2. Connect your wallet (must hold the tokens)',
      '3. Enter the token contract address' + (args.token_address ? ' (' + args.token_address + ')' : ''),
      '4. Paste your recipient list (address, amount — one per line)',
      '5. Approve the token spend, then execute the batch transfer',
      '6. All recipients receive tokens in one transaction'
    ],
    contract: '0xD152f549545093347A162Dce210e7293f1452150',
    url: 'https://inclawbate.com/tools#disperse',
    note: 'Disperse batches up to 200 recipients per transaction. For larger lists, it auto-splits into multiple batches.',
    token: args.token_address || null
  });
}

function deployStakingInfo(args) {
  return JSON.stringify({
    action: 'deploy_staking_pool',
    how: 'Deploy a staking pool where holders stake your token and earn CLAWS rewards — powered by the automated reward flywheel.',
    process: [
      '1. Your token must be deployed on Base already',
      '2. Contact the Inclawbate team (Telegram: @StuartDeFi) or register through the Inclawbator',
      '3. We deploy a staking pool via the Staking Factory — linked to your token',
      '4. inclawbate.base.eth is auto-registered as a reward depositor',
      '5. The CLAWS flywheel activates: 20% of your token\'s LP fees auto-convert to CLAWS and fund staker rewards',
      '6. Your staking page goes live at inclawbate.com/stake'
    ],
    whats_included: [
      'Staking contract (Synthetix-style reward drip)',
      'Dual depositor: you + inclawbate.base.eth both authorized to deposit rewards',
      'Auto CLAWS reward pipeline from LP trading fees',
      'Staking UI on inclawbate.com/stake',
      'Analytics dashboard for TVL, APY, staker count'
    ],
    cost: 'Free — included with incubation. The 20% LP fee split funds the rewards.',
    contact: { telegram: 'https://t.me/StuartDeFi', x: 'https://x.com/stuman' },
    token: args.token_address || null,
    project: args.project_name || null
  });
}

async function healthCheck(args) {
  const results = { token: null, staking: null, project: null, suggestions: [] };

  // Token analytics from DexScreener
  if (args.token_address) {
    try {
      const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + args.token_address);
      const data = await res.json();
      const pairs = (data.pairs || []).filter(p => p.chainId === 'base' || p.chainId === 'solana');
      if (pairs.length) {
        const top = pairs[0];
        results.token = {
          name: top.baseToken?.name,
          symbol: top.baseToken?.symbol,
          price: top.priceUsd || 'N/A',
          change_24h: top.priceChange?.h24 || 'N/A',
          volume_24h: top.volume?.h24 || 0,
          liquidity: top.liquidity?.usd || 0,
          fdv: top.fdv || 0
        };
        // Suggestions based on data
        if ((top.volume?.h24 || 0) < 100) results.suggestions.push('Volume is very low — consider promoting your token or adding liquidity');
        if ((top.liquidity?.usd || 0) < 1000) results.suggestions.push('Liquidity is thin — consider adding more LP to reduce slippage');
        if ((top.priceChange?.h24 || 0) < -20) results.suggestions.push('Price dropped significantly — engage your community and highlight upcoming developments');
      } else {
        results.suggestions.push('No trading pairs found on DexScreener — your token may not be listed yet');
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

  // Project info
  if (args.wallet) {
    try {
      const projRes = await fetch(APP_API + '/inclawbator?wallet=' + encodeURIComponent(args.wallet));
      const projData = await projRes.json();
      const projects = projData.projects || projData || [];
      if (projects.length) {
        results.project = projects.map(p => ({
          name: p.token_name || p.project_name,
          status: p.status,
          agent: p.agent_enabled ? 'Active' : 'Not set up',
          staking: p.staking_address ? 'Live' : 'Not deployed'
        }));
        // Suggestions
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

function checkHireStatusInfo(args) {
  return JSON.stringify({
    action: 'check_hire',
    how: 'Check on the status of your hire with an Inclawbator.',
    process: [
      '1. Go to your Inclawbate dashboard',
      '2. Check the "Hires" or "Conversations" section',
      '3. You can message your Inclawbator directly through the platform',
      '4. They\'ll respond via the platform or Telegram'
    ],
    handle: args.handle || null,
    dashboard_url: 'https://inclawbate.com/dashboard',
    note: args.handle
      ? 'Check your conversation with @' + args.handle.replace(/^@/, '') + ' in your dashboard.'
      : 'Go to your dashboard to see all active hires and conversations.'
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
    case 'get_token_analytics': return await getTokenAnalytics(args);
    case 'setup_x_agent': return setupXAgentInfo();
    case 'get_project_status': return await getProjectStatus(args);
    case 'browse_inclawbators': return await browseInclawbators(args);
    case 'hire_inclawbator': return hireInclawbatorInfo(args);
    case 'browse_open_gigs': return await browseOpenGigs(args);
    case 'build_landing_page': return buildLandingPageInfo(args);
    case 'register_project': return registerProjectInfo(args);
    case 'get_staking_stats': return await getStakingStats(args);
    case 'book_promo': return bookPromoInfo(args);
    case 'disperse_tokens': return disperseTokensInfo(args);
    case 'deploy_staking': return deployStakingInfo(args);
    case 'health_check': return await healthCheck(args);
    case 'check_hire_status': return checkHireStatusInfo(args);
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
