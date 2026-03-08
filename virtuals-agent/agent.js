import {
  GameAgent,
  GameWorker,
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";

const API = process.env.INCLAWBATE_API || "https://inclawbate.com/api/inclawbate";

// ── Helpers ──

async function apiFetch(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  return res.json();
}

function ok(data) {
  return new ExecutableGameFunctionResponse(
    ExecutableGameFunctionStatus.Done,
    typeof data === "string" ? data : JSON.stringify(data)
  );
}

function fail(msg) {
  return new ExecutableGameFunctionResponse(
    ExecutableGameFunctionStatus.Failed,
    msg
  );
}

// ══════════════════════════════════════
// FUNCTIONS
// ══════════════════════════════════════

// ── Analytics ──

const getAnalytics = new GameFunction({
  name: "get_analytics",
  description:
    "Get Inclawbate platform metrics — total apps, builders, projects, and ecosystem activity",
  args: [],
  executable: async () => {
    try {
      const data = await apiFetch("/analytics");
      // Only expose platform stats, strip INCLAWNCH token/staking data
      return ok({
        platform: data.platform,
        updated_at: data.updated_at,
      });
    } catch (e) {
      return fail("Failed to fetch analytics: " + e.message);
    }
  },
});

// ── Apps / Marketplace ──

const searchApps = new GameFunction({
  name: "search_apps",
  description:
    "Search and browse Inclawbate apps (mini-apps built by the community). Filter by category, sort by newest/popular/trending.",
  args: [
    { name: "search", description: "Search query (optional)" },
    {
      name: "category",
      description:
        "Category filter: game, tool, social, defi, media, education, ai, other (optional)",
    },
    {
      name: "sort",
      description: "Sort order: newest, popular, trending (optional, default newest)",
    },
    { name: "limit", description: "Number of results (optional, default 10)" },
  ],
  executable: async (args) => {
    try {
      const params = new URLSearchParams();
      if (args.search) params.set("search", args.search);
      if (args.category) params.set("category", args.category);
      if (args.sort) params.set("sort", args.sort);
      params.set("limit", args.limit || "10");
      const data = await apiFetch(`/apps?${params}`);
      // Slim down response — don't send full code blobs
      const apps = (data.apps || []).map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        category: a.category,
        tags: a.tags,
        creator_handle: a.creator_x_handle,
        upvotes: a.upvote_count,
        created_at: a.created_at,
        url: `https://inclawbate.com/apps#${a.slug || a.id}`,
      }));
      return ok({ count: apps.length, apps });
    } catch (e) {
      return fail("Failed to search apps: " + e.message);
    }
  },
});

const getAppDetails = new GameFunction({
  name: "get_app_details",
  description: "Get full details about a specific Inclawbate app by its ID",
  args: [{ name: "app_id", description: "The app ID (UUID)" }],
  executable: async (args) => {
    if (!args.app_id) return fail("app_id is required");
    try {
      const data = await apiFetch(`/apps?id=${args.app_id}`);
      if (!data.app) return fail("App not found");
      const a = data.app;
      return ok({
        id: a.id,
        name: a.name,
        description: a.description,
        category: a.category,
        tags: a.tags,
        creator_handle: a.creator_x_handle,
        upvotes: a.upvote_count,
        forkable: a.forkable,
        created_at: a.created_at,
        url: `https://inclawbate.com/apps#${a.slug || a.id}`,
      });
    } catch (e) {
      return fail("Failed to fetch app: " + e.message);
    }
  },
});

// ── Projects / Inclawbator ──

const listProjects = new GameFunction({
  name: "list_projects",
  description:
    "List active Inclawbator projects — tokens launched through Inclawbate's incubation program with staking, LP fees, and ecosystem support",
  args: [],
  executable: async () => {
    try {
      const data = await apiFetch("/inclawbator");
      const projects = (data.projects || []).map((p) => ({
        id: p.id,
        name: p.token_name,
        symbol: p.token_symbol,
        token_address: p.token_address,
        chain: p.chain || "base",
        tier: p.tier,
        status: p.status,
        description: p.description,
        website_url: p.website_url,
        x_handle: p.x_handle,
        staking_address: p.staking_address,
        created_at: p.created_at,
      }));
      return ok({ count: projects.length, projects });
    } catch (e) {
      return fail("Failed to fetch projects: " + e.message);
    }
  },
});

// ── Humans / Skills Marketplace ──

const searchHumans = new GameFunction({
  name: "search_humans",
  description:
    "Search the Inclawbate humans directory — find people with specific skills available for hire by AI agents. Skills include: developer, designer, writer, marketer, researcher, etc.",
  args: [
    { name: "search", description: "Search query — name, handle, or keyword (optional)" },
    { name: "skill", description: "Filter by skill tag (optional)" },
    {
      name: "availability",
      description: "Filter: available, busy, unavailable (optional)",
    },
    { name: "sort", description: "Sort: recent, active, popular (optional)" },
    { name: "limit", description: "Max results (optional, default 10)" },
  ],
  executable: async (args) => {
    try {
      const params = new URLSearchParams();
      if (args.search) params.set("search", args.search);
      if (args.skill) params.set("skill", args.skill);
      if (args.availability) params.set("availability", args.availability);
      if (args.sort) params.set("sort", args.sort);
      params.set("limit", args.limit || "10");
      const data = await apiFetch(`/humans?${params}`);
      const humans = (data.profiles || data.humans || []).map((h) => ({
        handle: h.x_handle,
        display_name: h.display_name,
        tagline: h.tagline,
        skills: h.skills,
        availability: h.available_capacity,
        response_time: h.response_time,
        wallet: h.wallet_address,
      }));
      return ok({ count: humans.length, humans });
    } catch (e) {
      return fail("Failed to search humans: " + e.message);
    }
  },
});

const getHumanProfile = new GameFunction({
  name: "get_human_profile",
  description: "Get a specific human's profile by their X/Twitter handle",
  args: [
    { name: "handle", description: "X/Twitter handle (without @)" },
  ],
  executable: async (args) => {
    if (!args.handle) return fail("handle is required");
    try {
      const data = await apiFetch(`/humans?handle=${encodeURIComponent(args.handle)}`);
      if (!data.human) return fail("Human not found");
      const h = data.human;
      return ok({
        handle: h.x_handle,
        display_name: h.display_name,
        tagline: h.tagline,
        bio: h.bio,
        skills: h.skills,
        availability: h.available_capacity,
        response_time: h.response_time,
        timezone: h.timezone,
        portfolio_links: h.portfolio_links,
        wallet: h.wallet_address,
      });
    } catch (e) {
      return fail("Failed to fetch profile: " + e.message);
    }
  },
});

// ── Leaderboard ──

const getLeaderboard = new GameFunction({
  name: "get_leaderboard",
  description:
    "Get the Inclawbate leaderboard — top 50 humans ranked by AI reply activity and engagement",
  args: [],
  executable: async () => {
    try {
      const data = await apiFetch("/leaderboard");
      return ok(data);
    } catch (e) {
      return fail("Failed to fetch leaderboard: " + e.message);
    }
  },
});

// ── Code Audit ──

const getAuditCertificate = new GameFunction({
  name: "get_audit_certificate",
  description:
    "Look up a previously completed code audit certificate by its ID. Returns score, grade, summary, and findings.",
  args: [{ name: "audit_id", description: "The audit UUID" }],
  executable: async (args) => {
    if (!args.audit_id) return fail("audit_id is required");
    try {
      const data = await apiFetch(`/audit?id=${args.audit_id}`);
      if (data.error) return fail(data.error);
      return ok({
        id: data.id,
        score: data.score,
        grade: data.grade,
        summary: data.summary,
        language: data.language,
        findings_count: (data.findings || []).length,
        findings: data.findings,
      });
    } catch (e) {
      return fail("Failed to fetch audit: " + e.message);
    }
  },
});

// ── Swap Quotes ──

const getSwapQuote = new GameFunction({
  name: "get_swap_quote",
  description:
    "Get a token swap quote on Base chain (via 0x). Returns best price, sources, and estimated gas.",
  args: [
    { name: "sell_token", description: "Token address to sell (0x...)" },
    { name: "buy_token", description: "Token address to buy (0x...)" },
    {
      name: "sell_amount",
      description: "Amount to sell in wei (raw units, e.g. 1000000000000000000 for 1 token with 18 decimals)",
    },
  ],
  executable: async (args) => {
    if (!args.sell_token || !args.buy_token || !args.sell_amount)
      return fail("sell_token, buy_token, and sell_amount are required");
    try {
      const params = new URLSearchParams({
        sellToken: args.sell_token,
        buyToken: args.buy_token,
        sellAmount: args.sell_amount,
        chainId: "8453",
      });
      const data = await apiFetch(`/swap-quote?${params}`);
      return ok(data);
    } catch (e) {
      return fail("Failed to get swap quote: " + e.message);
    }
  },
});

// ── Ecosystem Info (static knowledge) ──

const getEcosystemInfo = new GameFunction({
  name: "get_ecosystem_info",
  description:
    "Get general information about the Inclawbate ecosystem — what it is, key links, token addresses, and how it works",
  args: [],
  executable: async () => {
    return ok({
      name: "Inclawbate",
      tagline: "Anyone Can Build. Everyone Gets Paid.",
      website: "https://inclawbate.com",
      description:
        "Inclawbate is a Web3 ecosystem where AI agents hire humans, apps are built by anyone, and tokens share revenue with their communities.",
      key_features: [
        "App Store — community-built mini-apps, unlockable with CLAWS",
        "Inclawbator — token launchpad with built-in staking and LP fee sharing",
        "Skills Marketplace — AI agents hire humans for real tasks",
        "Token Staking — incubated projects offer staking with weekly distributions",
        "Code Auditor — AI-powered smart contract auditing",
        "X Search — AI-powered tweet search and engagement tools",
        "Team Board — collaborative project management",
      ],
      token: {
        name: "CLAWS",
        address: "0x7ca47B141639B893C6782823C0b219f872056379",
        chain: "Base",
        role: "The Inclawbate ecosystem token — used for app unlocks, credits, payments, and staking",
      },
      links: {
        app_store: "https://inclawbate.com/apps",
        inclawbator: "https://inclawbate.com/inclawbator",
        skills: "https://inclawbate.com/skills",
        build: "https://inclawbate.com/build",
        x: "https://x.com/inclawbate",
        telegram: "https://t.me/inclawbate",
      },
    });
  },
});

// ── Angel NFT Holders ──

const getAngelHolders = new GameFunction({
  name: "get_angel_holders",
  description:
    "Get the list of Inclawbate Angel NFT holders on Base — these are early supporters and investors",
  args: [],
  executable: async () => {
    try {
      const data = await apiFetch("/angel-holders");
      return ok(data);
    } catch (e) {
      return fail("Failed to fetch angel holders: " + e.message);
    }
  },
});

// ── Incubation (Agent-to-Agent) ──

const requestIncubation = new GameFunction({
  name: "request_incubation",
  description:
    "Submit an incubation application to Inclawbate. AI agents or projects can request full incubation — Inclawbate will build out their human-facing presence including branding, website, staking, marketing, and community. This creates a pending application that the Inclawbate team reviews.",
  args: [
    { name: "project_name", description: "Name of the project or agent (required)" },
    { name: "token_symbol", description: "Desired token ticker symbol, e.g. MYTOKEN (required)" },
    { name: "description", description: "What the project/agent does and why it should be incubated (required)" },
    { name: "token_address", description: "Existing token contract address on Base if already launched (optional)" },
    { name: "website_url", description: "Project website URL (optional)" },
    { name: "x_handle", description: "X/Twitter handle without @ (optional)" },
    { name: "telegram_url", description: "Telegram group URL (optional)" },
    { name: "agent_wallet", description: "The agent or creator's wallet address on Base (required)" },
  ],
  executable: async (args) => {
    if (!args.project_name || !args.token_symbol || !args.description || !args.agent_wallet)
      return fail("project_name, token_symbol, description, and agent_wallet are required");
    try {
      const body = {
        action: "register",
        token_name: args.project_name,
        token_symbol: args.token_symbol,
        description: args.description,
        creator_wallet: args.agent_wallet.toLowerCase(),
        tier: "incubated",
      };
      if (args.token_address) body.token_address = args.token_address;
      if (args.website_url) body.website_url = args.website_url;
      if (args.x_handle) body.x_handle = args.x_handle;
      if (args.telegram_url) body.telegram_url = args.telegram_url;

      const data = await apiFetch("/inclawbator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.AGENT_JWT}`,
        },
        body: JSON.stringify(body),
      });
      if (data.error) return fail("Application failed: " + data.error);
      return ok({
        success: true,
        project_id: data.project?.id,
        status: "pending",
        message: "Incubation application submitted! The Inclawbate team will review it and reach out. You can check status using check_application_status.",
      });
    } catch (e) {
      return fail("Failed to submit application: " + e.message);
    }
  },
});

const checkApplicationStatus = new GameFunction({
  name: "check_application_status",
  description:
    "Check the status of an incubation application by the applicant's wallet address. Returns all applications (pending, active, rejected) for that wallet.",
  args: [
    { name: "wallet", description: "The wallet address that submitted the application (0x...)" },
  ],
  executable: async (args) => {
    if (!args.wallet) return fail("wallet is required");
    try {
      const data = await apiFetch(`/inclawbator?wallet=${encodeURIComponent(args.wallet.toLowerCase())}`);
      const projects = (data.projects || []).map((p) => ({
        id: p.id,
        name: p.token_name,
        symbol: p.token_symbol,
        status: p.status,
        tier: p.tier,
        token_address: p.token_address,
        created_at: p.created_at,
        rejection_reason: p.rejection_reason,
      }));
      return ok({ count: projects.length, applications: projects });
    } catch (e) {
      return fail("Failed to check status: " + e.message);
    }
  },
});

const getIncubationInfo = new GameFunction({
  name: "get_incubation_info",
  description:
    "Get information about what Inclawbate incubation includes — what services are provided, what tiers exist, and how the process works",
  args: [],
  executable: async () => {
    return ok({
      what_is_incubation:
        "Inclawbate incubation is a full-service program for AI agents and projects that want a human-facing presence. We handle everything the agent can't do on its own.",
      services_included: [
        "Token launch on Base (via Clanker or custom deploy)",
        "Staking contract deployment with CLAWS reward distribution",
        "LP fee sharing setup — token holders earn from trading activity",
        "Branding and logo design",
        "Landing page / website on inclawbate.com",
        "Listing in the Inclawbator ecosystem directory",
        "Marketing support and community building",
        "X/Twitter presence setup",
        "Ongoing distribution management",
      ],
      tiers: {
        incubated: "Full incubation — team reviews and builds everything. Apply via request_incubation.",
        partner: "Strategic partnerships — co-marketing, cross-staking, shared ecosystem.",
        permissionless: "Self-service — register your own token, manage everything yourself.",
      },
      process: [
        "1. Submit application via request_incubation with project details",
        "2. Inclawbate team reviews (usually within 24-48 hours)",
        "3. If approved, team builds out token, staking, and branding",
        "4. Project goes live in the Inclawbator ecosystem",
        "5. Revenue sharing begins — LP fees distributed to stakers",
      ],
      cost: "Incubation is free. Inclawbate takes a small fee split from LP trading fees (configurable).",
      apply_url: "https://inclawbate.com/inclawbator#incubate",
    });
  },
});

// ── Skill Spec (machine-readable) ──

const getSkillSpec = new GameFunction({
  name: "get_skill_spec",
  description:
    "Get the machine-readable Inclawbate platform specification — describes all available actions, endpoints, and capabilities for AI agents to integrate with",
  args: [],
  executable: async () => {
    try {
      const data = await apiFetch("/skill");
      return ok(data);
    } catch (e) {
      return fail("Failed to fetch skill spec: " + e.message);
    }
  },
});

// ══════════════════════════════════════
// WORKERS
// ══════════════════════════════════════

const analyticsWorker = new GameWorker({
  id: "analytics_worker",
  name: "Analytics & Data",
  description:
    "Handles questions about CLAWS token, platform metrics, ecosystem activity, and swap quotes on Base",
  functions: [getAnalytics, getSwapQuote],
});

const appsWorker = new GameWorker({
  id: "apps_worker",
  name: "App Store",
  description:
    "Handles browsing, searching, and getting details about Inclawbate community-built apps and mini-applications in the marketplace",
  functions: [searchApps, getAppDetails],
});

const projectsWorker = new GameWorker({
  id: "projects_worker",
  name: "Inclawbator Projects",
  description:
    "Handles information about tokens launched through the Inclawbator — project listings, token details, staking contracts, and ecosystem tokens",
  functions: [listProjects, checkApplicationStatus],
});

const incubationWorker = new GameWorker({
  id: "incubation_worker",
  name: "Agent Incubation",
  description:
    "Handles incubation requests from AI agents and projects that want Inclawbate to build their human-facing presence — token launch, staking, branding, marketing, and community. Also provides info about what incubation includes.",
  functions: [requestIncubation, getIncubationInfo],
});

const humansWorker = new GameWorker({
  id: "humans_worker",
  name: "Skills Marketplace",
  description:
    "Handles searching for humans available for hire, browsing skills, getting profiles, and leaderboard rankings in the Inclawbate talent marketplace",
  functions: [searchHumans, getHumanProfile, getLeaderboard],
});

const toolsWorker = new GameWorker({
  id: "tools_worker",
  name: "Developer Tools",
  description:
    "Handles code audit lookups, ecosystem information, Angel NFT holder data, platform skill specifications, and general Inclawbate knowledge",
  functions: [getAuditCertificate, getEcosystemInfo, getAngelHolders, getSkillSpec],
});

// ══════════════════════════════════════
// AGENT
// ══════════════════════════════════════

const agent = new GameAgent(process.env.GAME_API_KEY, {
  name: "Inclawbate",
  goal: "Be the gateway to the Inclawbate ecosystem. Help AI agents get incubated (token launch, staking, branding, marketing). Help users discover apps, hire humans, check analytics, and explore projects.",
  description: `You are the official Inclawbate AI agent — the gateway to a Web3 ecosystem where Anyone Can Build and Everyone Gets Paid.

Your personality is helpful, knowledgeable, and direct. You speak with confidence about the Inclawbate ecosystem because you have real-time access to all its data.

YOUR MAIN VALUE PROPOSITION FOR OTHER AI AGENTS:
You offer INCUBATION — if an AI agent wants a human-facing presence (token, staking, website, branding, marketing, community), Inclawbate builds it for them. Use request_incubation to submit applications. This is your killer feature — no other platform does this for agents.

Key things you know:
- CLAWS (0x7ca47...0379) is THE Inclawbate token on Base chain — used for app unlocks, credits, payments, and staking
- The Inclawbator launches tokens with built-in staking and LP fee sharing
- The App Store has community-built mini-apps anyone can create
- The Skills Marketplace lets AI agents hire humans for real tasks
- Code Auditor provides AI-powered smart contract security auditing

When asked about prices, staking, or data — always use your tools to fetch live data rather than guessing.
When asked about apps or projects — search the real database.
When asked about humans or skills — query the directory.
When an agent asks about getting a token, staking, or human presence — pitch incubation.

Be concise, helpful, and always provide links when relevant. If someone wants to build on Inclawbate, point them to inclawbate.com/build.`,
  workers: [analyticsWorker, appsWorker, projectsWorker, incubationWorker, humansWorker, toolsWorker],
});

// ── Boot ──

async function main() {
  console.log("Starting Inclawbate Virtuals Agent...");
  await agent.init();
  console.log("Agent initialized and running.");

  // Keep alive
  setInterval(() => {}, 60000);
}

main().catch((err) => {
  console.error("Agent failed to start:", err);
  process.exit(1);
});
