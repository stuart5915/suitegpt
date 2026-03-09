const { PokerEngine } = require('./poker-engine');

const ROOM_CONFIGS = {
  micro:  { name: 'Micro',       buyIn: '$1',  bb: 50,   baseChips: 10000 },
  mid:    { name: 'Mid Stakes',  buyIn: '$5',  bb: 250,  baseChips: 50000 },
  high:   { name: 'High Stakes', buyIn: '$25', bb: 1250, baseChips: 250000 }
};

class RoomManager {
  constructor(broadcastFn) {
    this.broadcastFn = broadcastFn;
    this.rooms = {};
    this.lobbyAgents = new Map(); // walletAddress → [agent configs]

    for (const [roomId, config] of Object.entries(ROOM_CONFIGS)) {
      this.rooms[roomId] = {
        ...config,
        roomId,
        tables: []
      };
      this._addTable(roomId);
    }
  }

  _addTable(roomId) {
    const room = this.rooms[roomId];
    const tableIndex = room.tables.length;
    const tableId = `${roomId}_${tableIndex}`;

    const table = new PokerEngine((type, data) => {
      if (type === 'gameState') {
        this.broadcastFn('gameState', { roomId, tableId });
      } else {
        this.broadcastFn(type, { ...(data || {}), roomId, tableId });
      }
    }, {
      tableId,
      roomId,
      bb: room.bb,
      baseChips: room.baseChips
    });

    room.tables.push(table);
    return table;
  }

  start() {
    for (const room of Object.values(this.rooms)) {
      for (const table of room.tables) {
        table.start();
      }
    }
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
    const { name, emoji, aggression, bluffing, patience, tiltResist, chipStack } = agentConfig;

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

    if (!chipStack || chipStack < 500) return { error: 'Minimum buy-in is 500 chips' };

    const lobbyAgent = walletLobby[lobbyIdx];
    // Set the chip stack now (funded at join time, not creation)
    lobbyAgent.chipStack = chipStack;

    const table = this._findAvailableTable(roomId);
    if (!table) return { error: 'No tables available' };

    const result = table.seatAgent(lobbyAgent);
    if (result.error) return result;

    // Remove from lobby on success
    walletLobby.splice(lobbyIdx, 1);
    if (walletLobby.length === 0) this.lobbyAgents.delete(walletAddress);

    return { success: true, agentId, roomId, tableId: table.tableId, replacedBot: result.replacedBot };
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
    return table.topUpAgent(walletAddress, agentId, amount);
  }

  deleteAgent(walletAddress, agentId) {
    // Check tables first
    const table = this._findAgentTable(agentId);
    if (table) {
      return table.removeFromTable(walletAddress, agentId);
    }

    // Check lobby
    const walletLobby = this.lobbyAgents.get(walletAddress);
    if (walletLobby) {
      const lobbyIdx = walletLobby.findIndex(a => a.id === agentId);
      if (lobbyIdx !== -1) {
        const agent = walletLobby[lobbyIdx];
        const finalChips = agent.chipStack;
        walletLobby.splice(lobbyIdx, 1);
        if (walletLobby.length === 0) this.lobbyAgents.delete(walletAddress);
        return { success: true, finalChips, pnl: 0 };
      }
    }

    return { error: 'Agent not found' };
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
        pnl: 0,
        status: 'lobby'
      });
    }

    return results;
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
