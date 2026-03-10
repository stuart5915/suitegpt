const { PokerEngine } = require('./poker-engine');
const { AgentStore } = require('./agent-store');

const ROOM_CONFIGS = {
  sandbox: { name: 'Sandbox',      buyIn: 'FREE', bb: 50,   baseChips: 10000,  rakePct: 0,     isSandbox: true, currency: 'free' },
  micro:   { name: 'Micro',        buyIn: '$1',   bb: 50,   baseChips: 10000,  rakePct: 0.025, currency: 'usdc' },  // 2.5% rake
  mid:     { name: 'Mid Stakes',   buyIn: '$5',   bb: 250,  baseChips: 50000,  rakePct: 0.025, currency: 'usdc' },  // 2.5% rake
  high:    { name: 'High Stakes',  buyIn: '$25',  bb: 1250, baseChips: 250000, rakePct: 0.025, currency: 'usdc' }   // 2.5% rake
};

const RAKE_FLUSH_INTERVAL = 60 * 60 * 1000; // Flush rake to chain once per hour

class RoomManager {
  constructor(broadcastFn, externalStore) {
    this.broadcastFn = broadcastFn;
    this.store = externalStore || new AgentStore();
    this.rooms = {};
    this.lobbyAgents = new Map(); // walletAddress → [agent configs]
    this.pendingRakeChips = 0; // Accumulated rake waiting to be flushed on-chain
    this.chainService = null; // Set by index.js after init

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

    room.tables.push(table);
    return table;
  }

  _persistPlayingAgents(table) {
    for (const a of table.agents) {
      if (a.isCustom && !a.walletAddress?.startsWith('sandbox_')) {
        this.store.updateAgentStats(a.id, {
          chipStack: a.chips,
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
  }

  _findAvailableTable(roomId) {
    const room = this.rooms[roomId];
    if (!room) return null;

    for (const table of room.tables) {
      if (table.hasAvailableSeat()) {
        return table;
      }
    }

    // All tables full — spawn new one
    const table = this._addTable(roomId);
    table.start();
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
    const { name, emoji, aggression, bluffing, patience, tiltResist, rules } = agentConfig;

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
      lobbyAgent.chipStack = freeChips;

      const table = this._findAvailableTable(roomId);
      if (!table) return { error: 'No tables available' };

      const result = table.seatAgent(lobbyAgent);
      if (result.error) return result;

      walletLobby.splice(lobbyIdx, 1);
      if (walletLobby.length === 0) this.lobbyAgents.delete(walletAddress);

      return {
        success: true, agentId, roomId, tableId: table.tableId, replacedBot: result.replacedBot,
        sandbox: true
      };
    }

    if (!chipStack || chipStack < 500) return { error: 'Minimum buy-in is 500 chips' };

    // Deduct from wallet balance (server-side)
    const wallet = this.store.getWallet(walletAddress);
    if (!wallet) return { error: 'Wallet not found' };
    if (wallet.balance < chipStack) return { error: `Not enough chips! You have ${wallet.balance.toLocaleString()}` };

    const lobbyAgent = walletLobby[lobbyIdx];
    lobbyAgent.chipStack = chipStack;

    const table = this._findAvailableTable(roomId);
    if (!table) return { error: 'No tables available' };

    const result = table.seatAgent(lobbyAgent);
    if (result.error) return result;

    // Deduct balance on success
    this.store.deductBalance(walletAddress, chipStack);

    // Remove from lobby on success
    walletLobby.splice(lobbyIdx, 1);
    if (walletLobby.length === 0) this.lobbyAgents.delete(walletAddress);

    // Update persisted agent
    this.store.updateAgentStats(agentId, { chipStack });

    return {
      success: true, agentId, roomId, tableId: table.tableId, replacedBot: result.replacedBot,
      newBalance: this.store.getWallet(walletAddress).balance
    };
  }

  leaveTable(walletAddress, agentId) {
    const table = this._findAgentTable(agentId);
    if (!table) return { error: 'Agent not found at any table' };

    const result = table.unseatAgent(walletAddress, agentId);
    if (result.error) return result;

    // Put agent back in lobby
    const lobbyAgent = result.agent;
    if (!this.lobbyAgents.has(walletAddress)) {
      this.lobbyAgents.set(walletAddress, []);
    }
    this.lobbyAgents.get(walletAddress).push(lobbyAgent);

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

    // Deduct from wallet
    const wallet = this.store.getWallet(walletAddress);
    if (!wallet) return { error: 'Wallet not found' };
    if (wallet.balance < amount) return { error: `Not enough chips! You have ${wallet.balance.toLocaleString()}` };

    const result = table.topUpAgent(walletAddress, agentId, amount);
    if (result.error) return result;

    this.store.deductBalance(walletAddress, amount);
    result.newBalance = this.store.getWallet(walletAddress).balance;
    return result;
  }

  deleteAgent(walletAddress, agentId) {
    let finalChips = 0;
    let pnl = 0;

    // Check tables first
    const table = this._findAgentTable(agentId);
    if (table) {
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

    // Return chips to wallet (not for sandbox agents)
    const wasInSandbox = table && this.rooms[table.roomId] && this.rooms[table.roomId].isSandbox;
    if (finalChips > 0 && !wasInSandbox) {
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
              pnl: a.chips - a.baseChips,
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
        pnl: 0,
        status: 'lobby'
      });
    }

    return results;
  }

  // Get total chips currently in play (at tables + lobby) for a wallet
  getChipsInPlay(walletAddress) {
    let total = 0;
    for (const room of Object.values(this.rooms)) {
      for (const table of room.tables) {
        for (const a of table.agents) {
          if (a.isCustom && a.walletAddress === walletAddress) {
            total += a.chips;
          }
        }
      }
    }
    const walletLobby = this.lobbyAgents.get(walletAddress) || [];
    for (const a of walletLobby) {
      total += a.chipStack || 0;
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

  getStateForClient(sessionId, walletAddress, activeRoom = 'micro') {
    const room = this.rooms[activeRoom];
    if (!room || room.tables.length === 0) {
      return { agents: [], rooms: this.getRoomsSummary(), lobbyAgents: [], activeRoom };
    }

    // Find table: prefer one with this wallet's agent, else first table
    let activeTable = room.tables[0];
    if (walletAddress) {
      for (const table of room.tables) {
        if (table.agents.some(a => a.isCustom && a.walletAddress === walletAddress)) {
          activeTable = table;
          break;
        }
      }
    }

    const state = activeTable.getStateForClient(sessionId, walletAddress);

    // Add room/table info
    state.activeRoom = activeRoom;
    state.activeTableId = activeTable.tableId;
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
        tableCount: room.tables.length,
        playerCount,
        totalHands
      };
    }
    return summary;
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

module.exports = { RoomManager, ROOM_CONFIGS };
