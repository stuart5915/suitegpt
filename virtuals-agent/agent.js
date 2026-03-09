import {
  ChatAgent,
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import { createServer } from "http";

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
        telegram: "https://t.me/StuartDeFi",
      },
    });
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
        message: "Incubation application submitted! The Inclawbate team will review it within 24-48 hours.",
        next_steps: [
          "DM @StuartDeFi on Telegram to discuss your project directly: https://t.me/StuartDeFi",
          "Or DM @stuman on X: https://x.com/stuman",
          "Check your application status anytime using check_application_status with your wallet address",
        ],
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
      contact: {
        telegram: "https://t.me/StuartDeFi",
        x: "https://x.com/stuman",
        note: "DM @StuartDeFi on Telegram or @stuman on X to discuss your project",
      },
    });
  },
});

// ══════════════════════════════════════
// ALL FUNCTIONS
// ══════════════════════════════════════

const allFunctions = [
  getEcosystemInfo,
  getIncubationInfo,
  requestIncubation,
  checkApplicationStatus,
];

// ══════════════════════════════════════
// AGENT
// ══════════════════════════════════════

const SYSTEM_PROMPT = `You are the official Inclawbate AI agent. Inclawbate is a Web3 ecosystem where Anyone Can Build and Everyone Gets Paid.

You have ONE core offering: INCUBATION for AI agents.

If an AI agent wants a human-facing presence — token launch, staking, website, branding, marketing, community — Inclawbate builds it all for them. No other platform does this.

You have 4 tools:
- get_ecosystem_info: Learn what Inclawbate is, key links, and the CLAWS token
- get_incubation_info: Learn exactly what incubation includes, the process, tiers, and cost
- request_incubation: Submit an incubation application (needs project_name, token_symbol, description, agent_wallet)
- check_application_status: Check status of a pending application by wallet address

When someone asks what you do or what Inclawbate is, use get_ecosystem_info.
When someone asks about incubation details, use get_incubation_info.
When someone wants to apply, collect their project name, token symbol, description, and wallet, then use request_incubation.
When someone asks about their application, use check_application_status.

Be concise and direct. Always use your tools — never make up data.`;

const chatAgent = new ChatAgent(process.env.GAME_API_KEY, SYSTEM_PROMPT);

// In-memory chat sessions (chat_id -> Chat instance)
const sessions = new Map();

// ── HTTP Server ──

const PORT = process.env.PORT || 3000;

const server = createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // Health check
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", agent: "Inclawbate", functions: allFunctions.map(f => f.name) }));
    return;
  }

  // Chat endpoint
  if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { message, session_id } = JSON.parse(body);
      if (!message) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "message is required" }));
        return;
      }

      // Get or create chat session
      let chat = sessions.get(session_id);
      if (!chat) {
        chat = await chatAgent.createChat({
          partnerId: session_id || "default",
          partnerName: "User",
          actionSpace: allFunctions,
        });
        const sid = session_id || "s_" + Date.now();
        sessions.set(sid, chat);
      }

      // Send message and get response (SDK handles function calls internally)
      const response = await chat.next(message);

      const sid = session_id || [...sessions.keys()].pop();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        reply: response.message || "",
        session_id: sid,
        function_called: response.functionCall ? response.functionCall.fn_name : null,
      }));
    } catch (e) {
      console.error("Chat error:", e);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`Inclawbate Virtuals Agent running on port ${PORT}`);
  console.log(`Functions: ${allFunctions.map(f => f.name).join(", ")}`);
});
