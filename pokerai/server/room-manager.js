const { PokerEngine } = require('./poker-engine');
const { AgentStore } = require('./agent-store');

const ROOM_CONFIGS = {
  sandbox: { name: 'Sandbox',      buyIn: 'FREE', bb: 50,   baseChips: 10000,  rakePct: 0,     isSandbox: true, currency: 'free', maxStack: Infinity },
  micro:   { name: 'Micro',        buyIn: '25/50',   bb: 50,   baseChips: 10000,  rakePct: 0.025, currency: 'usdc', maxStack: 50000 },
  mid:     { name: 'Mid Stakes',   buyIn: '125/250', bb: 250,  baseChips: 50000,  rakePct: 0.025, currency: 'usdc', maxStack: 250000 },
  high:    { name: 'High Stakes',  buyIn: '625/1250', bb: 1250, baseChips: 250000, rakePct: 0.025, currency: 'usdc', maxStack: 1000000 }
};

const RAKE_FLUSH_INTERVAL = 60 * 60 * 1000; // Flush rake to chain once per hour

// Platform agent rebalancing — wallets whose agents auto-move between tables as liquidity
const DEFAULT_PLATFORM_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const PLATFORM_WALLETS = new Set(
  [DEFAULT_PLATFORM_WALLET, ...(process.env.PLATFORM_WALLETS || '').split(',').filter(Boolean)].map(s => s.trim().toLowerCase())
);
const PLATFORM_TARGET_PER_TABLE = 5; // target total players per table with humans

class RoomManager {
  constructor(broadcastFn, externalStore) {
    this.broadcastFn = broadcastFn;
    this.store = externalStore || new AgentStore();
    this.rooms = {};
    this.lobbyAgents = new Map(); // walletAddress → [agent configs]
    this.pendingRakeChips = 0; // Accumulated rake waiting to be flushed on-chain
    this.chainService = null; // Set by index.js after init
    this.autoTopUp = new Map(); // walletAddress → { enabled, targetChips }
    this.onBalanceChange = null; // callback set by index.js to notify clients

    for (const [roomId, config] of Object.entries(ROOM_CONFIGS)) {
      this.rooms[roomId] = {
        ...config,
        roomId,
        tables: []
      };
      this._addTable(roomId);
    }

    // Restore persisted agents to lobby
    this._restoreAgents();
  }

  _restoreAgents() {
    const allAgents = this.store.agents;
    let count = 0;
    for (const saved of allAgents) {
      const wallet = saved.walletAddress;
      if (!wallet) continue;

      const lobbyAgent = {
        id: saved.id,
        name: saved.name,
        emoji: saved.emoji,
        style: saved.style,
        description: saved.description || `Custom agent by ${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
        raisePct: saved.raisePct,
        bluffPct: saved.bluffPct,
        foldPct: saved.foldPct,
        traits: saved.traits,
        rules: saved.rules || {},
        walletAddress: wallet,
        isCustom: true,
        chipStack: saved.chipStack || 0,
        handsWon: saved.handsWon || 0,
        handsPlayed: saved.handsPlayed || 0,
        biggestPot: saved.biggestPot || 0
      };

      if (!this.lobbyAgents.has(wallet)) {
        this.lobbyAgents.set(wallet, []);
      }
      this.lobbyAgents.get(wallet).push(lobbyAgent);
      count++;
    }
    if (count > 0) console.log(`[RoomManager] Restored ${count} agents to lobby`);
  }

  _addTable(roomId) {
    const room = this.rooms[roomId];
    const tableIndex = room.tables.length;
    const tableId = `${roomId}_${tableIndex}`;

    const table = new PokerEngine((type, data) => {
      if (type === 'gameState') {
        this.broadcastFn('gameState', { roomId, tableId });
        this._persistPlayingAgents(table);
        // Collect rake from real-money tables (not sandbox)
        if (!room.isSandbox) this._collectRake(table);
      } else {
        this.broadcastFn(type, { ...(data || {}), roomId, tableId });
      }
    }, {
      tableId,
      roomId,
      bb: room.bb,
      baseChips: room.baseChips,
      rakePct: room.rakePct
    });

    // Handle deferred leaves (agents that requested sit-out mid-hand)
    table._onPendingLeave = (walletAddress, agentId, lobbyAgent) => {
      this._finalizeLeave(walletAddress, table, lobbyAgent);
      // Notify connected clients
      this.broadcastFn('leaveTableResult', {
        success: true, pending: false, agentId,
        agent: { id: lobbyAgent.id, name: lobbyAgent.name, chipStack: lobbyAgent.chipStack }
      });
    };

    // Rebalance platform agents after each hand completes
    table._onHandComplete = () => {
      if (!room.isSandbox) {
        this._rebalanceRoom(roomId);
        // Notify reward engine of value changes
        if (this.onHandComplete) this.onHandComplete(table);
      }
    };

    room.tables.push(table);
    return table;
  }

  _persistPlayingAgents(table) {
    for (const a of table.agents) {
      if (a.isCustom && !a.walletAddress?.startsWith('sandbox_')) {
        // For sandbox tables, persist the REAL chipStack (not inflated sandbox chips)
        const chipStack = (a._realChipStack !== undefined) ? a._realChipStack : a.chips;
        this.store.updateAgentStats(a.id, {
          chipStack,
          handsWon: a.handsWon,
          handsPlayed: a.handsPlayed,
          biggestPot: a.biggestPot
        });
      }
    }
  }

  _collectRake(table) {
    const key = '_lastRakeSnapshot';
    const prev = table[key] || 0;
    const current = table.totalRake;
    const newRake = current - prev;
    if (newRake > 0) {
      table[key] = current;
      this.pendingRakeChips += newRake;
    }

    // Update backing values based on agent performance this hand
    this._updateBackingValues(table);

    // Auto top-up: check agents at this table and refill from wallet if needed
    this._runAutoTopUp(table);

    // Rake recycle: credit contractPool chips back to wallets with auto-top-up
    this._recycleRake(table);
  }

  _runAutoTopUp(table) {
    for (const agent of table.agents) {
      if (!agent.isCustom || !agent.walletAddress) continue;
      const config = this.autoTopUp.get(agent.walletAddress);
      if (!config || !config.enabled) continue;

      const target = config.targetChips;

      // Auto cash-out: if agent is above cash-out threshold, skim excess back to wallet
      if (config.cashOutAt > 0 && agent.chips > config.cashOutAt) {
        const excess = agent.chips - target; // bring back down to target, not cashOutAt
        if (excess > 0) {
          agent.chips -= excess;
          this.store.addBalance(agent.walletAddress, excess);
          console.log(`[AutoCashOut] ${agent.name}: -${excess} chips to wallet`);
          if (this.onBalanceChange) this.onBalanceChange(agent.walletAddress);
        }
      }

      // Auto top-up: if agent drops below 50% of target, refill
      if (agent.chips < target * 0.5) {
        const needed = target - agent.chips;
        const wallet = this.store.getWallet(agent.walletAddress);
        if (!wallet || wallet.balance <= 0) continue;

        const topUp = Math.min(needed, wallet.balance);
        if (topUp <= 0) continue;

        const deducted = this.store.deductBalance(agent.walletAddress, topUp);
        if (deducted === false) continue; // wallet couldn't cover it, skip
        agent.chips += topUp;
        console.log(`[AutoTopUp] ${agent.name}: +${topUp} chips (wallet: ${wallet.balance - topUp})`);

        if (this.onBalanceChange) this.onBalanceChange(agent.walletAddress);
        // Notify client about the auto-top-up
        if (this.onAutoTopUp) this.onAutoTopUp(agent.walletAddress, agent.name, topUp, agent.chips);
      }
    }
  }

  _recycleRake(table) {
    // Credit contractPool chips back to wallets that have auto-top-up enabled
    // This keeps the system self-sustaining when admin is bootstrapping tables
    if (table.contractPool <= 0) return;

    // Find all unique wallets with auto-top-up at this table
    const wallets = new Set();
    for (const a of table.agents) {
      if (a.isCustom && a.walletAddress) {
        const config = this.autoTopUp.get(a.walletAddress);
        if (config && config.enabled) wallets.add(a.walletAddress);
      }
    }

    if (wallets.size === 0) return;

    // Split pool evenly among auto-top-up wallets (usually just 1 admin)
    const perWallet = Math.floor(table.contractPool / wallets.size);
    if (perWallet <= 0) return;

    let totalRecycled = 0;
    for (const addr of wallets) {
      this.store.addBalance(addr, perWallet);
      totalRecycled += perWallet;
      console.log(`[RakeRecycle] ${addr.slice(0,8)}...: +${perWallet} chips from pool`);
      if (this.onBalanceChange) this.onBalanceChange(addr);
    }

    table.contractPool -= totalRecycled;

    // Subtract recycled chips from pending on-chain rake to prevent double-counting
    // (chips recycled in-game should NOT also be flushed on-chain)
    this.pendingRakeChips = Math.max(0, this.pendingRakeChips - totalRecycled);
  }

  // === Platform Agent Rebalancing ===
  // Platform agents act as elastic liquidity — they fill tables so humans always have opponents,
  // and move between tables as humans join/leave.

  _isPlatformAgent(agent) {
    return agent.isCustom && agent.walletAddress && PLATFORM_WALLETS.has(agent.walletAddress.toLowerCase());
  }

  // Check if agent was auto-seated by rebalancing (vs manually joined)
  _isAutoSeated(agent) {
    return this._isPlatformAgent(agent) && agent._autoSeated === true;
  }

  _getTableStats(table) {
    let humans = 0, platform = 0;
    for (const a of table.agents) {
      if (!a.isCustom) continue; // house bot (sandbox only)
      // Only count auto-seated platform agents as "platform"
      // Manually joined platform-wallet agents count as humans
      if (this._isAutoSeated(a)) platform++;
      else humans++;
    }
    return { humans, platform, total: table.agents.length };
  }

  // Main rebalancing logic — called after hands complete and after human joins/leaves
  _rebalanceRoom(roomId) {
    const room = this.rooms[roomId];
    if (!room || room.isSandbox) return;

    // Step 1: Balance tables — even distribution across all tables
    this._balanceTables(roomId);

    // Step 2: Platform agent liquidity — keep tables populated, platform agents play 24/7
    if (PLATFORM_WALLETS.size > 0) {
      const stats = room.tables.map(t => ({ table: t, ...this._getTableStats(t) }));
      for (const s of stats) {
        // Seed platform agents if table is below target (regardless of human presence)
        const needed = Math.max(0, PLATFORM_TARGET_PER_TABLE - s.table.agents.length);
        if (needed > 0) {
          const seeded = this._seedPlatformAgents(s.table, roomId, needed);
          if (seeded > 0) console.log(`[Rebalance] Seeded ${seeded} platform agent(s) → ${s.table.tableId}`);
        }
      }
    }

    this._cleanupEmptyTables(roomId);
  }

  // Balance agents evenly across tables in a room
  // e.g. 9 agents across 2 tables → 5 + 4 (not 8 + 1)
  _balanceTables(roomId) {
    const room = this.rooms[roomId];
    const activeTables = room.tables.filter(t => t.agents.length > 0);
    if (activeTables.length < 2) return;

    const totalAgents = activeTables.reduce((sum, t) => sum + t.agents.length, 0);
    if (totalAgents === 0) return;

    // Check if we can consolidate to fewer tables (max 8 per table)
    const minTables = Math.ceil(totalAgents / 8);
    if (minTables < activeTables.length) {
      // Merge: move everyone from smallest tables into bigger ones
      const sorted = [...activeTables].sort((a, b) => a.agents.length - b.agents.length);
      for (const source of sorted) {
        if (activeTables.filter(t => t.agents.length > 0).length <= minTables) break;
        if (source.phase !== 'waiting') continue; // can't move mid-hand
        // Move all agents from this table to others
        for (let i = source.agents.length - 1; i >= 0; i--) {
          const target = activeTables.find(t => t !== source && t.agents.length < 8);
          if (!target) break;
          this._moveAgentBetweenTables(source, i, target);
        }
      }
    }

    // Even out: move agents from overfull to underfull tables
    const tablesWithAgents = room.tables.filter(t => t.agents.length > 0);
    if (tablesWithAgents.length < 2) return;

    const total = tablesWithAgents.reduce((sum, t) => sum + t.agents.length, 0);
    const ideal = Math.ceil(total / tablesWithAgents.length);

    // Sort: biggest first
    const sorted = [...tablesWithAgents].sort((a, b) => b.agents.length - a.agents.length);

    for (const source of sorted) {
      if (source.agents.length <= ideal) continue;
      if (source.phase !== 'waiting') continue; // can only move between hands

      const excess = source.agents.length - ideal;
      let moved = 0;

      for (const target of [...sorted].reverse()) {
        if (moved >= excess) break;
        if (target === source) continue;
        if (target.agents.length >= ideal) continue;

        const needed = ideal - target.agents.length;
        const toMove = Math.min(excess - moved, needed);

        for (let m = 0; m < toMove; m++) {
          // Move from end of agents array (most recently seated)
          const idx = source.agents.length - 1;
          if (idx < 0) break;
          if (this._moveAgentBetweenTables(source, idx, target)) {
            moved++;
          } else {
            break;
          }
        }
      }
    }
  }

  // Move a single agent from one table to another (between hands only)
  _moveAgentBetweenTables(source, agentIndex, target) {
    if (!target.hasAvailableSeat()) return false;

    const agent = source.agents[agentIndex];
    if (!agent) return false;

    const wasAutoSeated = agent._autoSeated;
    const result = source._executeUnseat(agentIndex, agent);
    if (!result.success) return false;

    const lobbyAgent = result.agent;
    const seatResult = target.seatAgent(lobbyAgent);
    if (seatResult.success) {
      // Preserve _autoSeated flag on the new table agent
      if (wasAutoSeated) {
        const seated = target.agents.find(a => a.id === lobbyAgent.id);
        if (seated) seated._autoSeated = true;
      }
      console.log(`[TableBalance] Moved ${lobbyAgent.name} from ${source.tableId} → ${target.tableId}`);
      return true;
    }

    // Failed to seat at target — put back in lobby
    this._finalizeLeave(lobbyAgent.walletAddress, source, lobbyAgent);
    return false;
  }

  // Remove auto-seated platform agents from a table — immediate if between hands, queued if mid-hand
  // Only extracts agents with _autoSeated flag (manually joined agents are left alone)
  _extractPlatformAgents(table) {
    if (table.phase === 'waiting') {
      // Between hands — safe to splice (reverse iterate for index safety)
      for (let i = table.agents.length - 1; i >= 0; i--) {
        const agent = table.agents[i];
        if (this._isAutoSeated(agent)) {
          delete agent._autoSeated;
          const result = table._executeUnseat(i, agent);
          if (result.success) {
            this._finalizeLeave(agent.walletAddress, table, result.agent);
          }
        }
      }
    } else {
      // Hand in progress — queue for end of hand
      for (const agent of table.agents) {
        if (this._isAutoSeated(agent) && !table._pendingLeaves.has(agent.id)) {
          table._pendingLeaves.set(agent.id, agent.walletAddress);
        }
      }
    }
  }

  // Seat platform agents from lobby into a table
  _seedPlatformAgents(table, roomId, count) {
    let seeded = 0;

    // Collect wallets that already have a human (manually-joined) agent at this table
    // so we don't auto-seat their other lobby agents as platform liquidity
    const humansAtTable = new Set();
    for (const a of table.agents) {
      if (a.isCustom && a.walletAddress && !a._autoSeated) {
        humansAtTable.add(a.walletAddress.toLowerCase());
      }
    }

    for (const [walletAddress, agents] of this.lobbyAgents) {
      if (!PLATFORM_WALLETS.has(walletAddress.toLowerCase())) continue;

      // Skip this wallet if they already have a manually-joined agent at the table
      // (they chose to sit one agent — don't auto-seat the rest)
      if (humansAtTable.has(walletAddress.toLowerCase())) continue;

      for (let i = agents.length - 1; i >= 0; i--) {
        if (seeded >= count) return seeded;
        if (!table.hasAvailableSeat()) return seeded;

        const lobbyAgent = agents[i];
        if (lobbyAgent.chipStack < 500) continue; // not funded enough

        const result = table.seatAgent(lobbyAgent);
        if (result.success) {
          // Mark as auto-seated so rebalancing can extract it later
          // (manually joined agents won't have this flag)
          const seated = table.agents.find(a => a.id === lobbyAgent.id);
          if (seated) seated._autoSeated = true;
          agents.splice(i, 1);
          if (agents.length === 0) this.lobbyAgents.delete(walletAddress);
          seeded++;
        }
      }
    }

    return seeded;
  }

  // Remove trailing empty tables (keep at least 1 per room)
  _cleanupEmptyTables(roomId) {
    const room = this.rooms[roomId];
    while (room.tables.length > 1) {
      const lastTable = room.tables[room.tables.length - 1];
      if (lastTable.agents.length === 0) {
        lastTable.running = false;
        room.tables.pop();
      } else {
        break;
      }
    }
  }

  // === Auto Top-Up settings ===

  setAutoTopUp(walletAddress, enabled, targetChips, cashOutAt) {
    if (enabled) {
      this.autoTopUp.set(walletAddress, { enabled: true, targetChips: targetChips || 10000, cashOutAt: cashOutAt || 0 });
      console.log(`[AutoTopUp] Enabled for ${walletAddress.slice(0,8)}... target=${targetChips} cashOut=${cashOutAt}`);
    } else {
      this.autoTopUp.delete(walletAddress);
      console.log(`[AutoTopUp] Disabled for ${walletAddress.slice(0,8)}...`);
    }
    return { success: true, enabled, targetChips, cashOutAt };
  }

  getAutoTopUp(walletAddress) {
    return this.autoTopUp.get(walletAddress) || { enabled: false, targetChips: 10000, cashOutAt: 0 };
  }

  _startRakeTimer() {
    setInterval(() => this._flushRake(), RAKE_FLUSH_INTERVAL);
    console.log(`[RoomManager] Rake flush scheduled every ${RAKE_FLUSH_INTERVAL / 60000} min`);
  }

  _flushRake() {
    if (this.pendingRakeChips <= 0 || !this.chainService) return;
    const chips = this.pendingRakeChips;
    this.pendingRakeChips = 0;
    console.log(`[RoomManager] Flushing ${chips} chips rake to chain`);
    this.chainService.recordRake(chips).catch(e => {
      this.pendingRakeChips += chips;
      console.error('[RoomManager] Rake flush failed, will retry next cycle:', e.message);
    });
  }

  start() {
    for (const room of Object.values(this.rooms)) {
      for (const table of room.tables) {
        table.start();
      }
    }
    this._startRakeTimer();

    // Initial platform agent seeding for PvP rooms
    if (PLATFORM_WALLETS.size > 0) {
      for (const [roomId, room] of Object.entries(this.rooms)) {
        if (!room.isSandbox) {
          this._rebalanceRoom(roomId);
        }
      }
      console.log(`[RoomManager] Platform rebalancing active (${PLATFORM_WALLETS.size} platform wallet(s))`);
    }
  }

  _findAvailableTable(roomId) {
    const room = this.rooms[roomId];
    if (!room) return null;

    if (!room.isSandbox) {
      // PvP: prefer table with most existing players (instant action for human)
      let bestTable = null;
      let bestCount = -1;
      for (const table of room.tables) {
        if (table.hasAvailableSeat() && table.agents.length > bestCount) {
          bestCount = table.agents.length;
          bestTable = table;
        }
      }
      if (bestTable) return bestTable;
    } else {
      // Sandbox: first available
      for (const table of room.tables) {
        if (table.hasAvailableSeat()) return table;
      }
    }

    // All tables full — spawn new one (caller must start after seating agent)
    const table = this._addTable(roomId);
    table._needsStart = true;
    return table;
  }

  _findAgentTable(agentId) {
    for (const room of Object.values(this.rooms)) {
      for (const table of room.tables) {
        const agent = table.agents.find(a => a.id === agentId && a.isCustom);
        if (agent) return table;
      }
    }
    return null;
  }

  // === Lobby management ===

  createLobbyAgent(walletAddress, agentConfig) {
    const { name, emoji, aggression, bluffing, patience, tiltResist, rules, prompt } = agentConfig;

    const agentId = `custom_${walletAddress}_${Date.now()}`;
    const raisePct = Math.round(aggression * 0.65 + 5);
    const bluffPct = Math.round(bluffing * 0.7);
    const foldPct = Math.max(5, Math.round(patience * 0.6));

    let style;
    if (aggression >= 70) style = 'aggressive';
    else if (bluffing >= 60) style = 'bluffer';
    else if (patience >= 70) style = 'conservative';
    else style = 'balanced';

    const lobbyAgent = {
      id: agentId,
      name,
      emoji,
      style,
      description: `Custom agent by ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      raisePct,
      bluffPct,
      foldPct,
      traits: { aggression, bluffing, patience, tiltResist },
      rules: rules || {},
      prompt: prompt || '',
      walletAddress,
      isCustom: true,
      chipStack: 0, // funded when joining a table
      handsWon: 0,
      handsPlayed: 0,
      biggestPot: 0
    };

    if (!this.lobbyAgents.has(walletAddress)) {
      this.lobbyAgents.set(walletAddress, []);
    }
    this.lobbyAgents.get(walletAddress).push(lobbyAgent);

    // Persist (skip sandbox agents — they're ephemeral)
    if (!walletAddress.startsWith('sandbox_')) {
      this.store.saveAgent(lobbyAgent);
    }

    return {
      success: true,
      agent: {
        id: lobbyAgent.id,
        name: lobbyAgent.name,
        emoji: lobbyAgent.emoji,
        style: lobbyAgent.style,
        traits: lobbyAgent.traits,
        chipStack: lobbyAgent.chipStack
      }
    };
  }

  // === Update agent in lobby or at table ===

  updateLobbyAgent(walletAddress, agentId, config) {
    const { name, emoji, aggression, bluffing, patience, tiltResist, rules, prompt } = config;

    // Find agent in lobby or at a table
    let agent = null;
    const walletLobby = this.lobbyAgents.get(walletAddress);
    if (walletLobby) agent = walletLobby.find(a => a.id === agentId);

    // Also check tables (agent might be playing)
    let tableAgent = null;
    if (!agent) {
      const table = this._findAgentTable(agentId);
      if (table) {
        tableAgent = table.agents.find(a => a.id === agentId && a.walletAddress === walletAddress);
      }
    }

    const target = agent || tableAgent;
    if (!target) return { error: 'Agent not found' };

    // Update strategy
    const raisePct = Math.round(aggression * 0.65 + 5);
    const bluffPct = Math.round(bluffing * 0.7);
    const foldPct = Math.max(5, Math.round(patience * 0.6));

    let style;
    if (aggression >= 70) style = 'aggressive';
    else if (bluffing >= 60) style = 'bluffer';
    else if (patience >= 70) style = 'conservative';
    else style = 'balanced';

    target.name = name || target.name;
    target.emoji = emoji || target.emoji;
    target.style = style;
    target.raisePct = raisePct;
    target.bluffPct = bluffPct;
    target.foldPct = foldPct;
    target.traits = { aggression, bluffing, patience, tiltResist };
    target.rules = rules || {};
    target.prompt = prompt || '';

    // Persist
    if (!walletAddress.startsWith('sandbox_')) {
      this.store.saveAgent(target);
    }

    console.log(`[RoomManager] Updated agent ${target.name} (${agentId})`);
    return { success: true, agent: { id: target.id, name: target.name, style: target.style } };
  }

  // === Fund agent in lobby (separate from joining) ===

  fundLobbyAgent(walletAddress, agentId, amount) {
    const walletLobby = this.lobbyAgents.get(walletAddress);
    if (!walletLobby) return { error: 'No agents in lobby' };
    const agent = walletLobby.find(a => a.id === agentId);
    if (!agent) return { error: 'Agent not found in lobby' };
    if (!amount || amount < 500) return { error: 'Minimum fund is 500 chips' };

    const wallet = this.store.getWallet(walletAddress);
    if (!wallet || wallet.balance < amount) return { error: `Not enough chips! You have ${(wallet ? wallet.balance : 0).toLocaleString()}` };

    const deducted = this.store.deductBalance(walletAddress, amount);
    if (deducted === false) {
      return { error: 'Failed to deduct chips from wallet' };
    }
    agent.chipStack += amount;
    this.store.saveAgent(agent);
    console.log(`[RoomManager] Funded ${agent.name} with ${amount} chips (total: ${agent.chipStack})`);
    return { success: true, agentId, chipStack: agent.chipStack };
  }

  defundLobbyAgent(walletAddress, agentId, amount) {
    const walletLobby = this.lobbyAgents.get(walletAddress);
    if (!walletLobby) return { error: 'No agents in lobby' };
    const agent = walletLobby.find(a => a.id === agentId);
    if (!agent) return { error: 'Agent not found in lobby' };

    // If no amount specified, withdraw all
    const withdrawAmt = amount || agent.chipStack;
    if (withdrawAmt <= 0 || withdrawAmt > agent.chipStack) return { error: 'Invalid amount' };

    agent.chipStack -= withdrawAmt;
    this.store.addBalance(walletAddress, withdrawAmt);
    this.store.saveAgent(agent);
    const wallet = this.store.getWallet(walletAddress);
    const newBalance = wallet ? wallet.balance : 0;
    console.log(`[RoomManager] Defunded ${agent.name}: -${withdrawAmt} chips (remaining: ${agent.chipStack}, wallet: ${newBalance})`);
    return { success: true, agentId, chipStack: agent.chipStack, amount: withdrawAmt, newBalance };
  }

  // === Backing operations ===

  backAgent(walletAddress, agentId, amount) {
    if (!amount || amount < 500) return { error: 'Minimum backing is 500 chips' };

    // Find agent at a table (not lobby — must be playing)
    const table = this._findAgentTable(agentId);
    if (!table) return { error: 'Agent not found at any table' };

    // No backing in sandbox
    const roomId = table.roomId;
    const room = this.rooms[roomId];
    if (room && room.isSandbox) return { error: 'Cannot back agents in sandbox' };

    // Check wallet balance
    const wallet = this.store.getWallet(walletAddress);
    if (!wallet || wallet.balance < amount) return { error: `Not enough chips! You have ${(wallet ? wallet.balance : 0).toLocaleString()}` };

    const agent = table.agents.find(a => a.id === agentId);
    if (!agent) return { error: 'Agent not found' };

    // Deduct from wallet
    const deducted = this.store.deductBalance(walletAddress, amount);
    if (deducted === false) {
      return { error: 'Failed to deduct chips from wallet' };
    }

    // Create backing record (marked as pending — activates next hand)
    const backing = this.store.createBacking(walletAddress, agentId, amount, roomId);

    // Mark as pending so it's excluded from P&L distribution until activated
    if (backing) backing._pending = true;

    // Queue chips for next hand — don't add mid-hand (prevents exploit + fixes P&L math)
    if (!agent._pendingBackings) agent._pendingBackings = [];
    agent._pendingBackings.push({ backingId: backing?.id, amount });

    console.log(`[RoomManager] ${walletAddress.slice(0,8)} backed ${agent.name} with ${amount} chips (pending — activates next hand)`);
    return { success: true, agentId, agentName: agent.name, amount, pending: true };
  }

  unbackAgent(walletAddress, backingId) {
    const backing = this.store.getBackingById(backingId);
    if (!backing) return { error: 'Backing not found' };
    if (backing.backerWallet !== walletAddress.toLowerCase()) return { error: 'Not your backing' };

    // Find the agent
    const table = this._findAgentTable(backing.agentId);
    const agent = table ? table.agents.find(a => a.id === backing.agentId) : null;

    // Check if backing is still pending (not yet activated)
    if (agent && agent._pendingBackings) {
      const pendingIdx = agent._pendingBackings.findIndex(pb => pb.backingId === backingId);
      if (pendingIdx !== -1) {
        // Cancel pending backing — full refund, no P&L
        agent._pendingBackings.splice(pendingIdx, 1);
        this.store.addBalance(walletAddress, backing.chipsStaked);
        this.store.deleteBacking(backingId);
        console.log(`[RoomManager] ${walletAddress.slice(0,8)} cancelled pending backing: refund=${backing.chipsStaked}`);
        return { success: true, originalStake: backing.chipsStaked, withdrawn: backing.chipsStaked, pnl: 0 };
      }
    }

    // 1-hand cooldown: backing must have been active for at least 1 hand
    if (backing._activatedAt && Date.now() - backing._activatedAt < 20000) {
      return { error: 'Please wait for at least 1 hand before withdrawing' };
    }

    const currentValue = Math.max(0, backing.currentValue);
    const pnl = currentValue - backing.chipsStaked;

    // Deduct the backing's current value from the agent's chip stack
    if (agent) {
      // Don't take more than the agent has
      const deductFromAgent = Math.min(currentValue, agent.chips);
      agent.chips -= deductFromAgent;
    }

    // Return current value to wallet
    if (currentValue > 0) {
      this.store.addBalance(walletAddress, currentValue);
    }
    this.store.deleteBacking(backingId);

    console.log(`[RoomManager] ${walletAddress.slice(0,8)} withdrew backing: staked=${backing.chipsStaked}, returned=${currentValue}, pnl=${pnl}`);
    return { success: true, originalStake: backing.chipsStaked, withdrawn: currentValue, pnl };
  }

  // Called after each hand to update backing values based on agent performance
  _updateBackingValues(table) {
    for (const agent of table.agents) {
      if (agent._startChips === undefined) continue;

      // Calculate delta BEFORE activating pending backings
      // so the deposit itself isn't counted as profit
      const delta = agent.chips - agent._startChips;

      // Activate pending backings (queued mid-hand, now safe to include)
      if (agent._pendingBackings && agent._pendingBackings.length > 0) {
        let pendingTotal = 0;
        for (const pb of agent._pendingBackings) {
          agent.chips += pb.amount;
          pendingTotal += pb.amount;
          // Mark backing as activated — clear pending flag
          const backing = this.store.getBackingById(pb.backingId);
          if (backing) {
            delete backing._pending;
            backing._activatedAt = Date.now();
          }
        }
        // Update _startChips to include newly activated backings
        // so they don't inflate delta on subsequent hands
        agent._startChips += pendingTotal;
        console.log(`[RoomManager] Activated ${agent._pendingBackings.length} pending backing(s) for ${agent.name}: +${pendingTotal} chips`);
        agent._pendingBackings = [];
      }
      if (delta === 0) continue;

      // Only include active (non-pending) backings in P&L distribution
      // _pending = not yet activated, _activatedAt < 1s = just activated this cycle
      const backings = this.store.getBackingsForAgent(agent.id).filter(b => !b._pending && (!b._activatedAt || Date.now() - b._activatedAt > 1000));
      if (backings.length === 0) continue;

      // Backer's share = their original stake / total pool at start of hand
      // This gives a fixed proportional ownership that doesn't drift
      // e.g. agent 10K + backer 1K = backer owns 1K/11K = 9.09% of gains/losses
      const totalPool = agent._startChips;
      if (totalPool <= 0) continue;

      const updates = [];
      for (const b of backings) {
        const share = Math.min(1, b.chipsStaked / totalPool);
        const backerDelta = Math.floor(delta * share);
        const newValue = Math.max(0, b.currentValue + backerDelta);
        updates.push({ id: b.id, currentValue: newValue });
      }
      this.store.updateBackingValues(agent.id, updates);
    }
  }

  // === Room operations ===

  joinRoom(walletAddress, agentId, roomId, chipStack) {
    const walletLobby = this.lobbyAgents.get(walletAddress);
    if (!walletLobby) return { error: 'No agents in lobby' };

    const lobbyIdx = walletLobby.findIndex(a => a.id === agentId);
    if (lobbyIdx === -1) return { error: 'Agent not found in lobby' };

    const room = this.rooms[roomId];
    if (!room) return { error: 'Room not found' };

    // Sandbox: free chips, no wallet deduction
    if (room.isSandbox) {
      const freeChips = chipStack || room.baseChips;
      const lobbyAgent = walletLobby[lobbyIdx];
      // Save real chipStack so sandbox can't inflate it
      lobbyAgent._realChipStack = lobbyAgent.chipStack;
      lobbyAgent.chipStack = freeChips;

      const table = this._findAvailableTable(roomId);
      if (!table) return { error: 'No tables available' };

      const result = table.seatAgent(lobbyAgent);
      if (result.error) return result;

      // Start newly created tables AFTER seating (avoids race where empty table gets cleaned up)
      if (table._needsStart) { delete table._needsStart; table.start(); }

      walletLobby.splice(lobbyIdx, 1);
      if (walletLobby.length === 0) this.lobbyAgents.delete(walletAddress);

      return {
        success: true, agentId, roomId, tableId: table.tableId, replacedBot: result.replacedBot,
        sandbox: true
      };
    }

    const lobbyAgent = walletLobby[lobbyIdx];

    // If agent is already funded (via fundAgent), use their existing stack
    // Otherwise fund inline (legacy flow)
    let fundedInline = false;
    if (lobbyAgent.chipStack >= 500) {
      // Already pre-funded — skip inline funding even if chipStack param was provided
    } else if (chipStack && chipStack > 0) {
      if (chipStack < 500) return { error: 'Minimum buy-in is 500 chips' };
      const wallet = this.store.getWallet(walletAddress);
      if (!wallet) return { error: 'Wallet not found' };
      if (wallet.balance < chipStack) return { error: `Not enough chips! You have ${wallet.balance.toLocaleString()}` };
      lobbyAgent.chipStack = chipStack;
      fundedInline = true;
    }

    if (!lobbyAgent.chipStack || lobbyAgent.chipStack < 500) {
      return { error: 'Agent needs at least 500 chips. Fund your agent first!' };
    }

    // Enforce max stack per room tier
    const maxStack = room.maxStack || Infinity;
    if (lobbyAgent.chipStack > maxStack) {
      return { error: `Max buy-in for ${room.name} is ${maxStack.toLocaleString()} chips ($${(maxStack / 10000).toFixed(0)} USDC). Withdraw some chips first.` };
    }

    const table = this._findAvailableTable(roomId);
    if (!table) return { error: 'No tables available' };

    const result = table.seatAgent(lobbyAgent);
    if (result.error) return result;

    // Start newly created tables AFTER seating (avoids race where empty table gets cleaned up)
    if (table._needsStart) { delete table._needsStart; table.start(); }

    // Deduct balance if funded inline (not pre-funded)
    if (fundedInline) {
      const deducted = this.store.deductBalance(walletAddress, chipStack);
      if (deducted === false) {
        // Roll back: unseat the agent and return to lobby
        const agentIdx = table.agents.findIndex(a => a.id === agentId);
        if (agentIdx >= 0) table._executeUnseat(agentIdx, table.agents[agentIdx]);
        lobbyAgent.chipStack = 0;
        if (!this.lobbyAgents.has(walletAddress)) this.lobbyAgents.set(walletAddress, []);
        this.lobbyAgents.get(walletAddress).push(lobbyAgent);
        return { error: 'Failed to deduct chips from wallet' };
      }
    }

    // Remove from lobby on success
    walletLobby.splice(lobbyIdx, 1);
    if (walletLobby.length === 0) this.lobbyAgents.delete(walletAddress);

    // Update persisted agent
    this.store.updateAgentStats(agentId, { chipStack: lobbyAgent.chipStack });

    // Rebalance platform agents (seed opponents to this table if needed)
    this._rebalanceRoom(roomId);

    return {
      success: true, agentId, roomId, tableId: table.tableId, replacedBot: result.replacedBot,
      newBalance: this.store.getWallet(walletAddress).balance
    };
  }

  leaveTable(walletAddress, agentId) {
    const table = this._findAgentTable(agentId);
    if (!table) return { error: 'Agent not found at any table' };

    const roomId = table.roomId;
    const result = table.unseatAgent(walletAddress, agentId);
    if (result.error) return result;

    // If queued for end of hand, return pending status (don't move to lobby yet)
    if (result.pending) {
      return { success: true, pending: true, agentId };
    }

    // Immediate leave — put agent back in lobby
    const leaveResult = this._finalizeLeave(walletAddress, table, result.agent);

    // Rebalance tables after leave (may merge tables)
    if (roomId !== 'sandbox') this._rebalanceRoom(roomId);

    return leaveResult;
  }

  // Called both for immediate leaves and deferred (post-hand) leaves
  _finalizeLeave(walletAddress, table, lobbyAgent) {
    delete lobbyAgent._autoSeated; // clean up rebalancing flag
    const isSandboxTable = table.roomId === 'sandbox';

    // Sandbox: restore real chipStack, don't let sandbox chips leak out
    if (isSandboxTable && lobbyAgent._realChipStack !== undefined) {
      lobbyAgent.chipStack = lobbyAgent._realChipStack;
      delete lobbyAgent._realChipStack;
    } else if (isSandboxTable) {
      lobbyAgent.chipStack = 0;
    }

    if (!this.lobbyAgents.has(walletAddress)) {
      this.lobbyAgents.set(walletAddress, []);
    }
    this.lobbyAgents.get(walletAddress).push(lobbyAgent);

    // Auto-withdraw all backers when agent leaves table
    // Deduct backing value from agent's chipStack so chips are conserved
    if (this.store.withdrawAllBackingsForAgent) {
      const backings = this.store.getBackingsForAgent ? this.store.getBackingsForAgent(lobbyAgent.id) : [];
      const totalBackingValue = backings.reduce((sum, b) => sum + Math.max(0, b.currentValue), 0);
      if (totalBackingValue > 0) {
        const deductFromAgent = Math.min(totalBackingValue, lobbyAgent.chipStack);
        lobbyAgent.chipStack -= deductFromAgent;
        console.log(`[RoomManager] Deducted ${deductFromAgent} backing chips from ${lobbyAgent.name} on leave (remaining: ${lobbyAgent.chipStack})`);
      }
      this.store.withdrawAllBackingsForAgent(lobbyAgent.id);
    }

    // Persist updated agent (skip sandbox)
    if (!walletAddress.startsWith('sandbox_')) {
      this.store.saveAgent(lobbyAgent);
    }

    return {
      success: true,
      agent: {
        id: lobbyAgent.id,
        name: lobbyAgent.name,
        emoji: lobbyAgent.emoji,
        style: lobbyAgent.style,
        chipStack: lobbyAgent.chipStack,
        handsWon: lobbyAgent.handsWon,
        handsPlayed: lobbyAgent.handsPlayed,
        biggestPot: lobbyAgent.biggestPot
      }
    };
  }

  topUpAgent(walletAddress, agentId, amount) {
    const table = this._findAgentTable(agentId);
    if (!table) return { error: 'Agent not found at any table' };

    // Enforce max stack per room tier
    const roomConfig = ROOM_CONFIGS[table.roomId];
    if (roomConfig && roomConfig.maxStack) {
      const agent = table.agents.find(a => a.id === agentId);
      if (agent && agent.chips + amount > roomConfig.maxStack) {
        const canAdd = roomConfig.maxStack - agent.chips;
        if (canAdd <= 0) return { error: `Agent is already at the ${roomConfig.name} max (${roomConfig.maxStack.toLocaleString()} chips)` };
        return { error: `Max for ${roomConfig.name} is ${roomConfig.maxStack.toLocaleString()} chips. You can add up to ${canAdd.toLocaleString()}.` };
      }
    }

    // Deduct from wallet
    const wallet = this.store.getWallet(walletAddress);
    if (!wallet) return { error: 'Wallet not found' };
    if (wallet.balance < amount) return { error: `Not enough chips! You have ${wallet.balance.toLocaleString()}` };

    const result = table.topUpAgent(walletAddress, agentId, amount);
    if (result.error) return result;

    const deducted = this.store.deductBalance(walletAddress, amount);
    if (deducted === false) {
      // Roll back: remove the top-up chips from the agent
      const agent = table.agents.find(a => a.id === agentId);
      if (agent) agent.chips -= amount;
      return { error: 'Failed to deduct chips from wallet' };
    }
    result.newBalance = this.store.getWallet(walletAddress).balance;
    return result;
  }

  deleteAgent(walletAddress, agentId) {
    let finalChips = 0;
    let pnl = 0;

    // Calculate total backing value BEFORE withdrawing, so we can deduct from finalChips
    let totalBackingValue = 0;
    if (this.store.getBackingsForAgent && this.store.withdrawAllBackingsForAgent) {
      const backings = this.store.getBackingsForAgent(agentId);
      totalBackingValue = backings.reduce((sum, b) => sum + Math.max(0, b.currentValue), 0);
      // Withdraw all backings (returns chips to backers' wallets)
      this.store.withdrawAllBackingsForAgent(agentId);
    }

    // Check tables first
    const table = this._findAgentTable(agentId);
    let savedRealChipStack;
    if (table) {
      // Grab _realChipStack before removal (sandbox exploit prevention)
      const tableAgent = table.agents.find(a => a.id === agentId);
      if (tableAgent) savedRealChipStack = tableAgent._realChipStack;
      const result = table.removeFromTable(walletAddress, agentId);
      if (result.error) return result;
      finalChips = result.finalChips;
      pnl = result.pnl;
    } else {
      // Check lobby
      const walletLobby = this.lobbyAgents.get(walletAddress);
      if (walletLobby) {
        const lobbyIdx = walletLobby.findIndex(a => a.id === agentId);
        if (lobbyIdx !== -1) {
          const agent = walletLobby[lobbyIdx];
          finalChips = agent.chipStack;
          walletLobby.splice(lobbyIdx, 1);
          if (walletLobby.length === 0) this.lobbyAgents.delete(walletAddress);
        } else {
          return { error: 'Agent not found' };
        }
      } else {
        return { error: 'Agent not found' };
      }
    }

    // Deduct backing value from finalChips (backers already received their share above)
    if (totalBackingValue > 0) {
      const deduct = Math.min(totalBackingValue, finalChips);
      finalChips -= deduct;
      console.log(`[RoomManager] Deducted ${deduct} backing chips from deleteAgent finalChips (owner gets ${finalChips})`);
    }

    // Return chips to wallet
    const wasInSandbox = table && this.rooms[table.roomId] && this.rooms[table.roomId].isSandbox;
    if (wasInSandbox) {
      // Sandbox: return the real funded chips, not inflated sandbox chips
      const realChips = (savedRealChipStack !== undefined) ? savedRealChipStack : 0;
      if (realChips > 0) {
        this.store.addBalance(walletAddress, realChips);
        finalChips = realChips;
      } else {
        finalChips = 0;
      }
    } else if (finalChips > 0) {
      this.store.addBalance(walletAddress, finalChips);
    }

    // Remove from persistent store (skip sandbox)
    if (!walletAddress.startsWith('sandbox_')) {
      this.store.deleteAgent(agentId);
    }

    return {
      success: true, finalChips, pnl,
      newBalance: this.store.getWallet(walletAddress).balance
    };
  }

  getAgentsForWallet(walletAddress) {
    const results = [];

    // Check all tables
    for (const room of Object.values(this.rooms)) {
      for (const table of room.tables) {
        for (const a of table.agents) {
          if (a.isCustom && a.walletAddress === walletAddress) {
            // Calculate backing total so client can show owner's actual share
            let backingTotal = 0;
            if (this.store.getBackingsForAgent) {
              const backings = this.store.getBackingsForAgent(a.id);
              backingTotal = backings.reduce((sum, b) => sum + Math.max(0, b.currentValue || 0), 0);
            }
            results.push({
              id: a.id,
              name: a.name,
              emoji: a.emoji,
              style: a.style,
              chips: a.chips,
              chipStack: a.chips,
              baseChips: a.baseChips,
              handsWon: a.handsWon,
              handsPlayed: a.handsPlayed,
              biggestPot: a.biggestPot,
              traits: a.traits,
              rules: a.rules || {},
              prompt: a.prompt || '',
              pnl: a.chips - a.baseChips,
              backingTotal,
              status: 'playing',
              roomId: table.roomId,
              tableId: table.tableId
            });
          }
        }
      }
    }

    // Lobby agents
    const walletLobby = this.lobbyAgents.get(walletAddress) || [];
    for (const a of walletLobby) {
      results.push({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        style: a.style,
        chips: a.chipStack,
        chipStack: a.chipStack,
        baseChips: a.chipStack,
        handsWon: a.handsWon,
        handsPlayed: a.handsPlayed,
        biggestPot: a.biggestPot,
        traits: a.traits,
        rules: a.rules || {},
        prompt: a.prompt || '',
        pnl: 0,
        status: 'lobby'
      });
    }

    return results;
  }

  // Get total chips currently in play (at tables + lobby) for a wallet
  getChipsInPlay(walletAddress) {
    // Only count chips from YOUR agents actively seated at tables
    // Lobby agents, idle wallet balance, and backing stakes do NOT earn rewards
    let total = 0;
    for (const room of Object.values(this.rooms)) {
      if (room.isSandbox) continue; // sandbox doesn't earn rewards
      for (const table of room.tables) {
        for (const a of table.agents) {
          if (a.isCustom && a.walletAddress === walletAddress) {
            total += a.chips;
          }
        }
      }
    }
    return total;
  }

  // === Wallet ===

  getWalletBalance(walletAddress) {
    // Use synchronous cache read (getWallet) for hot path
    const wallet = this.store.getWallet ? this.store.getWallet(walletAddress) : null;
    if (wallet) return wallet;
    // Fallback: return 0 balance, don't create wallet synchronously
    return { address: walletAddress, balance: 0 };
  }

  // === State ===

  getStateForClient(sessionId, walletAddress, activeRoom = 'micro', preferredTableId = null) {
    const room = this.rooms[activeRoom];
    if (!room || room.tables.length === 0) {
      return { agents: [], rooms: this.getRoomsSummary(), lobbyAgents: [], activeRoom };
    }

    // Find table: if client requested a specific table, use it; else find their agent's table
    let activeTable = room.tables[0];
    if (preferredTableId) {
      const preferred = room.tables.find(t => t.tableId === preferredTableId);
      if (preferred) activeTable = preferred;
    } else if (walletAddress) {
      for (const table of room.tables) {
        if (table.agents.some(a => a.isCustom && a.walletAddress === walletAddress)) {
          activeTable = table;
          break;
        }
      }
    }

    const state = activeTable.getStateForClient(sessionId, walletAddress);

    // Add backing info per agent
    if (state.agents) {
      const wAddr = walletAddress ? walletAddress.toLowerCase() : null;
      state.agents = state.agents.map(a => {
        const backings = this.store.getBackingsForAgent ? this.store.getBackingsForAgent(a.id) : [];
        const totalBacked = backings.reduce((sum, b) => sum + b.currentValue, 0);
        const myBacking = wAddr ? backings.find(b => b.backerWallet === wAddr) : null;
        return {
          ...a,
          totalBacked,
          backerCount: backings.length,
          myBacking: myBacking ? {
            id: myBacking.id,
            staked: myBacking.chipsStaked,
            currentValue: myBacking.currentValue,
            pnl: myBacking.currentValue - myBacking.chipsStaked
          } : null
        };
      });
    }

    // Add room/table info
    state.activeRoom = activeRoom;
    state.activeTableId = activeTable.tableId;
    state.tableCount = room.tables.length;
    state.tables = room.tables.map(t => ({
      tableId: t.tableId,
      playerCount: t.agents.filter(a => a.isCustom).length,
      phase: t.phase,
      hasMyAgent: walletAddress ? t.agents.some(a => a.isCustom && a.walletAddress === walletAddress) : false
    }));
    state.rooms = this.getRoomsSummary();

    // Add lobby agents for this wallet
    if (walletAddress) {
      const walletLobby = this.lobbyAgents.get(walletAddress) || [];
      state.lobbyAgents = walletLobby.map(a => ({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        style: a.style,
        chipStack: a.chipStack,
        handsWon: a.handsWon,
        handsPlayed: a.handsPlayed,
        biggestPot: a.biggestPot,
        traits: a.traits,
        rules: a.rules || {},
        status: 'lobby'
      }));
    } else {
      state.lobbyAgents = [];
    }

    return state;
  }

  getRoomsSummary() {
    const summary = {};
    for (const [roomId, room] of Object.entries(this.rooms)) {
      let playerCount = 0;
      let totalHands = 0;
      for (const table of room.tables) {
        playerCount += table.agents.filter(a => a.isCustom).length;
        totalHands += table.handsPlayed;
      }
      summary[roomId] = {
        name: room.name,
        buyIn: room.buyIn,
        bb: room.bb,
        baseChips: room.baseChips,
        maxStack: room.maxStack || Infinity,
        tableCount: room.tables.length,
        playerCount,
        totalHands
      };
    }
    return summary;
  }

  getGlobalRoster() {
    const seen = new Set();
    const roster = [];
    for (const [roomId, room] of Object.entries(this.rooms)) {
      for (const table of room.tables) {
        for (const a of table.agents) {
          if (seen.has(a.id)) continue;
          seen.add(a.id);
          roster.push({
            id: a.id,
            name: a.name,
            emoji: a.emoji,
            style: a.style,
            chips: a.chips,
            baseChips: a.baseChips,
            handsWon: a.handsWon,
            handsPlayed: a.handsPlayed,
            biggestPot: a.biggestPot,
            description: a.description,
            isCustom: a.isCustom || false,
            walletAddress: a.walletAddress || null,
            traits: a.traits,
            rules: a.rules || {},
            room: roomId,
            roomName: room.name
          });
        }
      }
    }
    // Sort by win rate descending, then hands played descending as tiebreaker
    roster.sort((a, b) => {
      const wrA = a.handsPlayed > 0 ? a.handsWon / a.handsPlayed : 0;
      const wrB = b.handsPlayed > 0 ? b.handsWon / b.handsPlayed : 0;
      if (wrB !== wrA) return wrB - wrA;
      return b.handsPlayed - a.handsPlayed;
    });
    return roster;
  }

  get totalHandsPlayed() {
    let total = 0;
    for (const room of Object.values(this.rooms)) {
      for (const table of room.tables) {
        total += table.handsPlayed;
      }
    }
    return total;
  }

  // Fund positions — delegate to correct table
  fundAgent(sessionId, agentId, amount) {
    for (const room of Object.values(this.rooms)) {
      for (const table of room.tables) {
        if (table.agents.some(a => a.id === agentId)) {
          return table.fundAgent(sessionId, agentId, amount);
        }
      }
    }
    return { error: 'Agent not found' };
  }

  withdrawAgent(sessionId, agentId) {
    for (const room of Object.values(this.rooms)) {
      for (const table of room.tables) {
        const positions = table.fundPositions.get(sessionId);
        if (positions && positions.some(p => p.agentId === agentId)) {
          return table.withdrawAgent(sessionId, agentId);
        }
      }
    }
    return { error: 'No position found' };
  }

  withdrawAll(sessionId) {
    for (const room of Object.values(this.rooms)) {
      for (const table of room.tables) {
        table.withdrawAll(sessionId);
      }
    }
  }
}

module.exports = { RoomManager, ROOM_CONFIGS, PLATFORM_WALLETS };
