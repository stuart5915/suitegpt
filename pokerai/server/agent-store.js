const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'agents.json');
const STARTING_BALANCE = 50000;

function ensureDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  ensureDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      return {
        wallets: data.wallets || {},
        agents: data.agents || []
      };
    }
  } catch (e) {
    console.error('[AgentStore] Failed to load:', e.message);
  }
  return { wallets: {}, agents: [] };
}

function save(data) {
  ensureDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[AgentStore] Failed to save:', e.message);
  }
}

class AgentStore {
  constructor() {
    const data = load();
    this.wallets = data.wallets;   // { address: { balance, createdAt } }
    this.agents = data.agents;     // [ { id, walletAddress, ...agentFields } ]
    console.log(`[AgentStore] Loaded ${Object.keys(this.wallets).length} wallets, ${this.agents.length} agents`);
  }

  _save() {
    save({ wallets: this.wallets, agents: this.agents });
  }

  // === Wallet ===

  getOrCreateWallet(address) {
    const addr = address.toLowerCase();
    if (!this.wallets[addr]) {
      this.wallets[addr] = {
        balance: STARTING_BALANCE,
        createdAt: Date.now()
      };
      this._save();
      console.log(`[AgentStore] New wallet: ${addr} — ${STARTING_BALANCE} chips`);
    }
    return { address: addr, ...this.wallets[addr] };
  }

  getWallet(address) {
    const addr = address.toLowerCase();
    return this.wallets[addr] || null;
  }

  updateBalance(address, newBalance) {
    const addr = address.toLowerCase();
    if (!this.wallets[addr]) return;
    this.wallets[addr].balance = newBalance;
    this._save();
  }

  deductBalance(address, amount) {
    const addr = address.toLowerCase();
    if (!this.wallets[addr]) return false;
    if (this.wallets[addr].balance < amount) return false;
    this.wallets[addr].balance -= amount;
    this._save();
    return true;
  }

  addBalance(address, amount) {
    const addr = address.toLowerCase();
    if (!this.wallets[addr]) return;
    this.wallets[addr].balance += amount;
    this._save();
  }

  // === Agents ===

  saveAgent(agent) {
    const idx = this.agents.findIndex(a => a.id === agent.id);
    const data = {
      id: agent.id,
      walletAddress: (agent.walletAddress || '').toLowerCase(),
      name: agent.name,
      emoji: agent.emoji,
      style: agent.style,
      description: agent.description,
      raisePct: agent.raisePct,
      bluffPct: agent.bluffPct,
      foldPct: agent.foldPct,
      traits: agent.traits,
      rules: agent.rules || {},
      chipStack: agent.chipStack || agent.chips || 0,
      handsWon: agent.handsWon || 0,
      handsPlayed: agent.handsPlayed || 0,
      biggestPot: agent.biggestPot || 0
    };
    if (idx >= 0) {
      this.agents[idx] = data;
    } else {
      this.agents.push(data);
    }
    this._save();
  }

  deleteAgent(agentId) {
    this.agents = this.agents.filter(a => a.id !== agentId);
    this._save();
  }

  getAgentsForWallet(address) {
    const addr = address.toLowerCase();
    return this.agents.filter(a => a.walletAddress === addr);
  }

  getAgent(agentId) {
    return this.agents.find(a => a.id === agentId) || null;
  }

  // Update a playing agent's chips (called periodically or on hand end)
  updateAgentChips(agentId, chips) {
    const idx = this.agents.findIndex(a => a.id === agentId);
    if (idx >= 0) {
      this.agents[idx].chipStack = chips;
      this._save();
    }
  }

  updateAgentStats(agentId, stats) {
    const idx = this.agents.findIndex(a => a.id === agentId);
    if (idx >= 0) {
      Object.assign(this.agents[idx], stats);
      this._save();
    }
  }
}

module.exports = { AgentStore, STARTING_BALANCE };
