const { createClient } = require('@supabase/supabase-js');

class SupabaseStore {
  constructor(url, serviceKey) {
    this.supabase = createClient(url, serviceKey);
    this.walletCache = new Map();  // in-memory cache for hot path
    this.agentCache = [];
    this._initialized = false;
  }

  async init() {
    // Load all wallets and agents into memory (same pattern as JSON store)
    const { data: wallets } = await this.supabase
      .from('poker_wallets')
      .select('*');

    for (const w of (wallets || [])) {
      this.walletCache.set(w.address, { balance: w.chip_balance, createdAt: w.created_at });
    }

    const { data: agents } = await this.supabase
      .from('poker_agents')
      .select('*');

    this.agentCache = (agents || []).map(a => this._fromDbAgent(a));
    this._initialized = true;
    console.log(`[SupabaseStore] Loaded ${this.walletCache.size} wallets, ${this.agentCache.length} agents`);
  }

  // =========== Wallet ===========

  async getOrCreateWallet(address) {
    const addr = address.toLowerCase();
    if (this.walletCache.has(addr)) {
      return { address: addr, balance: this.walletCache.get(addr).balance };
    }

    // New wallet — starts with 0 chips (must deposit USDC)
    const wallet = { balance: 0, createdAt: Date.now() };
    this.walletCache.set(addr, wallet);

    await this.supabase.from('poker_wallets').upsert({
      address: addr,
      chip_balance: 0,
      created_at: new Date().toISOString()
    }, { onConflict: 'address' });

    console.log(`[SupabaseStore] New wallet: ${addr}`);
    return { address: addr, balance: 0 };
  }

  getWallet(address) {
    const addr = address.toLowerCase();
    const cached = this.walletCache.get(addr);
    return cached ? { address: addr, balance: cached.balance } : null;
  }

  async addBalance(address, amount) {
    const addr = address.toLowerCase();
    const cached = this.walletCache.get(addr);
    if (!cached) {
      console.error(`[SupabaseStore] addBalance: wallet ${addr} not in cache!`);
      return;
    }
    cached.balance += amount;

    const { error } = await this.supabase.from('poker_wallets')
      .update({ chip_balance: cached.balance })
      .eq('address', addr);
    if (error) console.error(`[SupabaseStore] addBalance write failed:`, error.message);
    else console.log(`[SupabaseStore] addBalance ${addr.slice(0,8)}... → ${cached.balance} chips`);
  }

  async deductBalance(address, amount) {
    const addr = address.toLowerCase();
    const cached = this.walletCache.get(addr);
    if (!cached || cached.balance < amount) return false;
    cached.balance -= amount;

    await this.supabase.from('poker_wallets')
      .update({ chip_balance: cached.balance })
      .eq('address', addr);
    return true;
  }

  async updateBalance(address, newBalance) {
    const addr = address.toLowerCase();
    const cached = this.walletCache.get(addr);
    if (!cached) return;
    cached.balance = newBalance;

    await this.supabase.from('poker_wallets')
      .update({ chip_balance: newBalance })
      .eq('address', addr);
  }

  // =========== Agents ===========

  get agents() {
    return this.agentCache;
  }

  async saveAgent(agent) {
    const idx = this.agentCache.findIndex(a => a.id === agent.id);
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
      this.agentCache[idx] = data;
    } else {
      this.agentCache.push(data);
    }

    await this.supabase.from('poker_agents').upsert(this._toDbAgent(data), { onConflict: 'id' });
  }

  async deleteAgent(agentId) {
    this.agentCache = this.agentCache.filter(a => a.id !== agentId);
    await this.supabase.from('poker_agents').delete().eq('id', agentId);
  }

  getAgentsForWallet(address) {
    const addr = address.toLowerCase();
    return this.agentCache.filter(a => a.walletAddress === addr);
  }

  getAgent(agentId) {
    return this.agentCache.find(a => a.id === agentId) || null;
  }

  async updateAgentStats(agentId, stats) {
    const idx = this.agentCache.findIndex(a => a.id === agentId);
    if (idx >= 0) {
      Object.assign(this.agentCache[idx], stats);

      const dbUpdate = {};
      if (stats.chipStack !== undefined) dbUpdate.chip_stack = stats.chipStack;
      if (stats.handsWon !== undefined) dbUpdate.hands_won = stats.handsWon;
      if (stats.handsPlayed !== undefined) dbUpdate.hands_played = stats.handsPlayed;
      if (stats.biggestPot !== undefined) dbUpdate.biggest_pot = stats.biggestPot;
      dbUpdate.updated_at = new Date().toISOString();

      await this.supabase.from('poker_agents').update(dbUpdate).eq('id', agentId);
    }
  }

  async updateAgentChips(agentId, chips) {
    return this.updateAgentStats(agentId, { chipStack: chips });
  }

  // =========== Transactions ===========

  async recordTransaction(walletAddress, type, usdcAmount, chipAmount, txHash = null) {
    await this.supabase.from('poker_transactions').insert({
      wallet_address: walletAddress.toLowerCase(),
      type,
      usdc_amount: usdcAmount,
      chip_amount: chipAmount,
      tx_hash: txHash
    });
  }

  // =========== DB ↔ App mapping ===========

  _fromDbAgent(row) {
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      name: row.name,
      emoji: row.emoji,
      style: row.style,
      description: row.description,
      raisePct: row.raise_pct,
      bluffPct: row.bluff_pct,
      foldPct: row.fold_pct,
      traits: row.traits || {},
      rules: row.rules || {},
      chipStack: row.chip_stack || 0,
      handsWon: row.hands_won || 0,
      handsPlayed: row.hands_played || 0,
      biggestPot: row.biggest_pot || 0
    };
  }

  _toDbAgent(agent) {
    return {
      id: agent.id,
      wallet_address: (agent.walletAddress || '').toLowerCase(),
      name: agent.name,
      emoji: agent.emoji,
      style: agent.style,
      description: agent.description,
      raise_pct: agent.raisePct,
      bluff_pct: agent.bluffPct,
      fold_pct: agent.foldPct,
      traits: agent.traits || {},
      rules: agent.rules || {},
      chip_stack: agent.chipStack || 0,
      hands_won: agent.handsWon || 0,
      hands_played: agent.handsPlayed || 0,
      biggest_pot: agent.biggestPot || 0,
      updated_at: new Date().toISOString()
    };
  }
}

module.exports = { SupabaseStore };
