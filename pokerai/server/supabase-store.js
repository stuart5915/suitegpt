const { createClient } = require('@supabase/supabase-js');

class SupabaseStore {
  constructor(url, serviceKey) {
    this.supabase = createClient(url, serviceKey);
    this.walletCache = new Map();  // in-memory cache for hot path
    this.agentCache = [];
    this.backingCache = [];  // in-memory backing records
    this._initialized = false;
  }

  async init() {
    // Load all wallets and agents into memory (same pattern as JSON store)
    const { data: wallets, error: wErr } = await this.supabase
      .from('poker_wallets')
      .select('*');

    if (wErr) console.error(`[SupabaseStore] Failed to load wallets:`, wErr.message);
    for (const w of (wallets || [])) {
      this.walletCache.set(w.address, { balance: w.chip_balance, pokeraiBalance: w.pokerai_chip_balance || 0, createdAt: w.created_at });
      console.log(`[SupabaseStore] Wallet: ${w.address.slice(0,10)}... balance=${w.chip_balance} pokerai=${w.pokerai_chip_balance || 0}`);
    }

    const { data: agents, error: aErr } = await this.supabase
      .from('poker_agents')
      .select('*');

    if (aErr) console.error(`[SupabaseStore] Failed to load agents:`, aErr.message);
    this.agentCache = (agents || []).map(a => this._fromDbAgent(a));

    const { data: backings, error: bErr } = await this.supabase
      .from('poker_backers')
      .select('*');
    if (bErr) console.error(`[SupabaseStore] Failed to load backings:`, bErr.message);
    this.backingCache = (backings || []).map(b => ({
      id: b.id,
      backerWallet: b.backer_wallet,
      agentId: b.agent_id,
      chipsStaked: b.chips_staked,
      currentValue: b.current_value,
      roomId: b.room_id,
      createdAt: b.created_at
    }));

    this._initialized = true;
    console.log(`[SupabaseStore] Loaded ${this.walletCache.size} wallets, ${this.agentCache.length} agents, ${this.backingCache.length} backings`);
  }

  // =========== Wallet ===========

  async getOrCreateWallet(address) {
    const addr = address.toLowerCase();
    if (this.walletCache.has(addr)) {
      return { address: addr, balance: this.walletCache.get(addr).balance, pokeraiBalance: this.walletCache.get(addr).pokeraiBalance || 0 };
    }

    // New wallet — starts with 0 chips (must deposit USDC or POKERAI)
    const wallet = { balance: 0, pokeraiBalance: 0, createdAt: Date.now() };
    this.walletCache.set(addr, wallet);

    const { error } = await this.supabase.from('poker_wallets').upsert({
      address: addr,
      chip_balance: 0,
      pokerai_chip_balance: 0,
      created_at: new Date().toISOString()
    }, { onConflict: 'address' });
    if (error) console.error(`[SupabaseStore] getOrCreateWallet WRITE FAILED:`, error.message, error.details);
    else console.log(`[SupabaseStore] New wallet: ${addr}`);
    return { address: addr, balance: 0, pokeraiBalance: 0 };
  }

  getWallet(address) {
    const addr = address.toLowerCase();
    const cached = this.walletCache.get(addr);
    return cached ? { address: addr, balance: cached.balance, pokeraiBalance: cached.pokeraiBalance || 0 } : null;
  }

  getWalletBalance(address, currency) {
    const addr = address.toLowerCase();
    const cached = this.walletCache.get(addr);
    if (!cached) return 0;
    return currency === 'pokerai' ? (cached.pokeraiBalance || 0) : cached.balance;
  }

  async addBalance(address, amount, currency = 'usdc') {
    const addr = address.toLowerCase();
    let cached = this.walletCache.get(addr);
    if (!cached) {
      // Auto-create wallet with 0 balance, then add
      cached = { balance: 0, pokeraiBalance: 0, createdAt: Date.now() };
      this.walletCache.set(addr, cached);
      console.log(`[SupabaseStore] Auto-created wallet for addBalance: ${addr}`);
    }

    if (currency === 'pokerai') {
      cached.pokeraiBalance = (cached.pokeraiBalance || 0) + amount;
      const { error } = await this.supabase.from('poker_wallets')
        .upsert({ address: addr, pokerai_chip_balance: cached.pokeraiBalance, created_at: new Date().toISOString() }, { onConflict: 'address' });
      if (error) console.error(`[SupabaseStore] addBalance(pokerai) write failed:`, error.message);
      else console.log(`[SupabaseStore] addBalance(pokerai) ${addr.slice(0,8)}... → ${cached.pokeraiBalance} chips`);
    } else {
      cached.balance += amount;
      const { error } = await this.supabase.from('poker_wallets')
        .upsert({ address: addr, chip_balance: cached.balance, created_at: new Date().toISOString() }, { onConflict: 'address' });
      if (error) console.error(`[SupabaseStore] addBalance write failed:`, error.message);
      else console.log(`[SupabaseStore] addBalance ${addr.slice(0,8)}... → ${cached.balance} chips`);
    }
  }

  deductBalance(address, amount, currency = 'usdc') {
    if (!amount || amount <= 0) return false;
    const addr = address.toLowerCase();
    const cached = this.walletCache.get(addr);
    if (!cached) return false;

    if (currency === 'pokerai') {
      const bal = cached.pokeraiBalance || 0;
      if (bal < amount) return false;
      cached.pokeraiBalance = bal - amount;
      this.supabase.from('poker_wallets')
        .update({ pokerai_chip_balance: cached.pokeraiBalance })
        .eq('address', addr)
        .then(({ error }) => {
          if (error) console.error(`[SupabaseStore] deductBalance(pokerai) write failed:`, error.message);
        });
    } else {
      if (cached.balance < amount) return false;
      cached.balance -= amount;
      this.supabase.from('poker_wallets')
        .update({ chip_balance: cached.balance })
        .eq('address', addr)
        .then(({ error }) => {
          if (error) console.error(`[SupabaseStore] deductBalance write failed:`, error.message);
        });
    }
    return true;
  }

  async updateBalance(address, newBalance, currency = 'usdc') {
    const addr = address.toLowerCase();
    const cached = this.walletCache.get(addr);
    if (!cached) return;

    if (currency === 'pokerai') {
      cached.pokeraiBalance = newBalance;
      await this.supabase.from('poker_wallets')
        .update({ pokerai_chip_balance: newBalance })
        .eq('address', addr);
    } else {
      cached.balance = newBalance;
      await this.supabase.from('poker_wallets')
        .update({ chip_balance: newBalance })
        .eq('address', addr);
    }
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
      prompt: agent.prompt || '',
      chipStack: agent.chipStack || agent.chips || 0,
      handsWon: agent.handsWon || 0,
      handsPlayed: agent.handsPlayed || 0,
      biggestPot: agent.biggestPot || 0,
      currency: agent.currency || null
    };

    if (idx >= 0) {
      this.agentCache[idx] = data;
    } else {
      this.agentCache.push(data);
    }

    // Ensure wallet row exists in DB (foreign key requirement)
    if (data.walletAddress) {
      await this.supabase.from('poker_wallets').upsert({
        address: data.walletAddress,
        chip_balance: this.walletCache.has(data.walletAddress) ? this.walletCache.get(data.walletAddress).balance : 0,
        pokerai_chip_balance: this.walletCache.has(data.walletAddress) ? (this.walletCache.get(data.walletAddress).pokeraiBalance || 0) : 0,
        created_at: new Date().toISOString()
      }, { onConflict: 'address' });
    }

    const { error } = await this.supabase.from('poker_agents').upsert(this._toDbAgent(data), { onConflict: 'id' });
    if (error) console.error(`[SupabaseStore] saveAgent FAILED:`, error.message, error.details);
    else console.log(`[SupabaseStore] saveAgent ${data.name} (${data.id.slice(0,20)}...) wallet=${data.walletAddress.slice(0,8)}`);
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

  async getTotalDepositedChips(walletAddress) {
    const addr = walletAddress.toLowerCase();
    const { data, error } = await this.supabase
      .from('poker_transactions')
      .select('chip_amount')
      .eq('wallet_address', addr)
      .eq('type', 'deposit');
    if (error) { console.error('[SupabaseStore] getTotalDepositedChips failed:', error.message); return 0; }
    return (data || []).reduce((sum, r) => sum + (r.chip_amount || 0), 0);
  }

  async getTotalDepositedPokeraiChips(walletAddress) {
    const addr = walletAddress.toLowerCase();
    const { data, error } = await this.supabase
      .from('poker_transactions')
      .select('chip_amount')
      .eq('wallet_address', addr)
      .eq('type', 'deposit_pokerai');
    if (error) { console.error('[SupabaseStore] getTotalDepositedPokeraiChips failed:', error.message); return 0; }
    return (data || []).reduce((sum, r) => sum + (r.chip_amount || 0), 0);
  }

  // =========== Backings ===========

  getBackingsForAgent(agentId) {
    return this.backingCache.filter(b => b.agentId === agentId);
  }

  getBackingsForWallet(walletAddress) {
    const addr = walletAddress.toLowerCase();
    return this.backingCache.filter(b => b.backerWallet === addr);
  }

  getBackingById(backingId) {
    return this.backingCache.find(b => b.id === backingId) || null;
  }

  async createBacking(backerWallet, agentId, chipsStaked, roomId) {
    const backing = {
      id: null,
      backerWallet: backerWallet.toLowerCase(),
      agentId,
      chipsStaked,
      currentValue: chipsStaked,
      roomId,
      createdAt: new Date().toISOString()
    };

    const { data, error } = await this.supabase.from('poker_backers').insert({
      backer_wallet: backing.backerWallet,
      agent_id: agentId,
      chips_staked: chipsStaked,
      current_value: chipsStaked,
      room_id: roomId
    }).select('id').single();

    if (error) {
      console.error(`[SupabaseStore] createBacking FAILED:`, error.message);
      return null;
    }
    backing.id = data.id;
    this.backingCache.push(backing);
    console.log(`[SupabaseStore] Backing created: ${backing.backerWallet.slice(0,8)} → ${agentId.slice(0,20)} (${chipsStaked} chips)`);
    return backing;
  }

  async deleteBacking(backingId) {
    this.backingCache = this.backingCache.filter(b => b.id !== backingId);
    await this.supabase.from('poker_backers').delete().eq('id', backingId);
  }

  async updateBackingValues(agentId, updates) {
    // updates = [{ id, currentValue }]
    for (const u of updates) {
      const cached = this.backingCache.find(b => b.id === u.id);
      if (cached) {
        cached.currentValue = u.currentValue;
        cached.updatedAt = new Date().toISOString();
      }
    }
    // Batch write to DB
    for (const u of updates) {
      await this.supabase.from('poker_backers')
        .update({ current_value: u.currentValue, updated_at: new Date().toISOString() })
        .eq('id', u.id);
    }
  }

  async withdrawAllBackingsForAgent(agentId) {
    const backings = this.getBackingsForAgent(agentId);
    const results = [];
    for (const b of backings) {
      if (b.currentValue > 0) {
        await this.addBalance(b.backerWallet, b.currentValue);
        results.push({ wallet: b.backerWallet, returned: b.currentValue, pnl: b.currentValue - b.chipsStaked });
      }
      await this.deleteBacking(b.id);
    }
    return results;
  }

  // =========== Hand History ===========

  _initHandHistoryBatch() {
    this._handHistoryBatch = [];
    this._handHistoryTimer = setInterval(() => this._flushHandHistory(), 5000);
  }

  saveHandHistory(entry) {
    if (!this._handHistoryBatch) this._initHandHistoryBatch();
    this._handHistoryBatch.push({
      agent_id: entry.agentId,
      wallet_address: (entry.walletAddress || '').toLowerCase(),
      room_id: entry.roomId || null,
      hand_number: entry.handNumber || null,
      cards: entry.cards ? entry.cards.map(c => c.rank + c.suit) : null,
      community: entry.community ? entry.community.map(c => c.rank + c.suit) : null,
      hand_name: entry.handName || null,
      result: entry.result || null,
      delta: entry.delta || 0,
      chips_bet: entry.chipsBet || 0,
      stack_after: entry.stackAfter || 0,
      fold_phase: entry.foldPhase || null,
      opponent_hand: entry.opponentHand || null
    });
    if (this._handHistoryBatch.length >= 10) this._flushHandHistory();
  }

  async _flushHandHistory() {
    if (!this._handHistoryBatch || this._handHistoryBatch.length === 0) return;
    const batch = this._handHistoryBatch;
    this._handHistoryBatch = [];
    const { error } = await this.supabase.from('poker_hand_history').insert(batch);
    if (error) console.error(`[SupabaseStore] Hand history flush failed (${batch.length} rows):`, error.message);
  }

  async getAgentHandHistory(agentId, limit = 200) {
    const { data, error } = await this.supabase
      .from('poker_hand_history')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { console.error(`[SupabaseStore] getAgentHandHistory failed:`, error.message); return []; }
    return data || [];
  }

  // =========== Learned Traits ===========

  async saveLearnedTraits(agentId, learnedTraits) {
    const idx = this.agentCache.findIndex(a => a.id === agentId);
    if (idx >= 0) {
      if (!this.agentCache[idx].traits) this.agentCache[idx].traits = {};
      this.agentCache[idx].traits.learned = learnedTraits;
    }
    await this.supabase.from('poker_agents')
      .update({ learned_traits: learnedTraits, updated_at: new Date().toISOString() })
      .eq('id', agentId);
  }

  getLearnedTraits(agentId) {
    const agent = this.agentCache.find(a => a.id === agentId);
    return agent?.traits?.learned || {};
  }

  // =========== DB ↔ App mapping ===========

  _fromDbAgent(row) {
    const traits = row.traits || {};
    // Restore learned traits from dedicated column into traits.learned
    if (row.learned_traits && Object.keys(row.learned_traits).length > 0) {
      traits.learned = row.learned_traits;
    }
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
      traits,
      rules: row.rules || {},
      prompt: (row.traits && row.traits._prompt) || '',
      chipStack: row.chip_stack || 0,
      handsWon: row.hands_won || 0,
      handsPlayed: row.hands_played || 0,
      biggestPot: row.biggest_pot || 0,
      currency: row.currency || null
    };
  }

  _toDbAgent(agent) {
    const traits = { ...(agent.traits || {}) };
    if (agent.prompt) traits._prompt = agent.prompt;
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
      traits,
      rules: agent.rules || {},
      chip_stack: agent.chipStack || 0,
      hands_won: agent.handsWon || 0,
      hands_played: agent.handsPlayed || 0,
      biggest_pot: agent.biggestPot || 0,
      currency: agent.currency || null,
      updated_at: new Date().toISOString()
    };
  }
}

module.exports = { SupabaseStore };
