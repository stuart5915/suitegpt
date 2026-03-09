const { AGENTS } = require('./agents');

const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS = ['♠','♥','♦','♣'];
const RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
const BB = 50;
const BASE_CHIPS = 10000;
const CASHOUT_THRESHOLD = 2.0;
const ACTION_DELAY = 1500;
const BETWEEN_HANDS_DELAY = 3000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, red: suit === '♥' || suit === '♦' });
    }
  }
  return shuffle(deck);
}

// Hand evaluation
function evaluateHand(cards) {
  const vals = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const counts = {};
  vals.forEach(v => counts[v] = (counts[v] || 0) + 1);
  const countVals = Object.values(counts).sort((a, b) => b - a);
  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(vals);

  if (isFlush && isStraight) return { rank: 8, name: 'Straight Flush' };
  if (countVals[0] === 4) return { rank: 7, name: 'Four of a Kind' };
  if (countVals[0] === 3 && countVals[1] === 2) return { rank: 6, name: 'Full House' };
  if (isFlush) return { rank: 5, name: 'Flush' };
  if (isStraight) return { rank: 4, name: 'Straight' };
  if (countVals[0] === 3) return { rank: 3, name: 'Three of a Kind' };
  if (countVals[0] === 2 && countVals[1] === 2) return { rank: 2, name: 'Two Pair' };
  if (countVals[0] === 2) return { rank: 1, name: 'One Pair' };
  return { rank: 0, name: 'High Card' };
}

function checkStraight(vals) {
  const unique = [...new Set(vals)].sort((a, b) => b - a);
  if (unique.length < 5) return false;
  for (let i = 0; i <= unique.length - 5; i++) {
    if (unique[i] - unique[i + 4] === 4) return true;
  }
  if (unique[0] === 14 && unique.slice(-4).join(',') === '5,4,3,2') return true;
  return false;
}

function getCombinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = getCombinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function getBestHand(holeCards, communityCards) {
  const all = [...holeCards, ...communityCards];
  if (all.length < 5) return { rank: -1, name: 'Unknown' };
  let best = { rank: -1, name: '' };
  const combos = getCombinations(all, 5);
  for (const combo of combos) {
    const h = evaluateHand(combo);
    if (h.rank > best.rank) best = h;
  }
  return best;
}

// Agent AI decision
function agentDecide(agent, communityCards, pot) {
  let strength = 0.3 + Math.random() * 0.5;

  if (communityCards.length > 0) {
    const handEval = getBestHand(agent.hand, communityCards);
    strength = (handEval.rank / 8) * 0.7 + Math.random() * 0.3;
  }

  const r = Math.random() * 100;
  const maxBet = Math.min(Math.floor(agent.chips * 0.4), 500);
  const betAmt = Math.max(BB, Math.floor(Math.random() * maxBet));

  if (agent.style === 'aggressive') {
    if (r < agent.raisePct) return { type: 'raise', label: `Raise ${betAmt}`, amount: betAmt };
    if (r < agent.raisePct + 30) return { type: 'call', label: 'Call', amount: BB };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'conservative') {
    if (strength > 0.7 && r < 40) return { type: 'raise', label: `Raise ${betAmt}`, amount: betAmt };
    if (strength > 0.5 || r < 25) return { type: 'call', label: 'Call', amount: BB };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'bluffer') {
    if (r < agent.bluffPct * 0.8) return { type: 'raise', label: `Bluff ${betAmt}`, amount: betAmt };
    if (r < 70) return { type: 'call', label: 'Call', amount: BB };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'mathematical') {
    const potOdds = pot > 0 ? BB / pot : 1;
    if (strength > potOdds + 0.2 && r < 45) return { type: 'raise', label: `Raise ${betAmt}`, amount: betAmt };
    if (strength > potOdds || r < 20) return { type: 'check', label: 'Check', amount: 0 };
    if (strength > 0.3) return { type: 'call', label: 'Call', amount: BB };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'chaotic') {
    const chaos = Math.random();
    if (chaos < 0.3) return { type: 'raise', label: `YOLO ${betAmt}`, amount: betAmt };
    if (chaos < 0.5) return { type: 'call', label: 'Call', amount: BB };
    if (chaos < 0.65) return { type: 'check', label: 'Check', amount: 0 };
    if (chaos < 0.85 && agent.chips > 200) return { type: 'allin', label: 'ALL IN!', amount: agent.chips };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  // balanced / default
  if (strength > 0.7 && r < 50) return { type: 'raise', label: `Raise ${betAmt}`, amount: betAmt };
  if (strength > 0.4 || r < 40) return { type: 'call', label: 'Call', amount: Math.min(BB, agent.chips) };
  if (r < 20) return { type: 'check', label: 'Check', amount: 0 };
  return { type: 'fold', label: 'Fold', amount: 0 };
}

class PokerEngine {
  constructor(broadcast) {
    this.broadcast = broadcast; // fn(type, data) → send to all clients
    this.agents = AGENTS.map(a => ({
      ...a,
      chips: BASE_CHIPS,
      baseChips: BASE_CHIPS,
      handsWon: 0,
      handsPlayed: 0,
      biggestPot: 0,
      hand: [],
      folded: false,
      currentBet: 0,
      allIn: false
    }));
    this.round = 0;
    this.handsPlayed = 0;
    this.pot = 0;
    this.phase = 'waiting';
    this.communityCards = [];
    this.deck = [];
    this.dealerIndex = 0;
    this.currentTurnIndex = 0;
    this.lastWinner = null;
    this.contractPool = 20000;
    this.totalCashouts = 0;
    this.totalBuyins = 0;
    this.poolFlows = [];
    this.fundPositions = new Map(); // sessionId → [{ agentId, deposited, startStack }]
    this.replacedBots = new Map(); // agentId → original bot data
    this.lobbyAgents = new Map(); // walletAddress → [agent configs]
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.gameLoop();
  }

  async gameLoop() {
    while (this.running) {
      await this.playHand();
      await sleep(BETWEEN_HANDS_DELAY);
    }
  }

  async playHand() {
    this.round++;
    this.handsPlayed++;
    this.pot = 0;
    this.phase = 'preflop';
    this.lastWinner = null;
    this.deck = createDeck();
    this.communityCards = [];

    // Reset agents — bust agents rebuy from pool
    for (const a of this.agents) {
      if (a.chips <= 0) {
        const rebuyAmount = Math.min(5000, this.contractPool);
        if (rebuyAmount > 0) {
          this.contractPool -= rebuyAmount;
          this.totalBuyins += rebuyAmount;
          a.chips = rebuyAmount;
          this.addPoolFlow('buyin', a.name, a.emoji, rebuyAmount);
          this.broadcast('log', { html: `<span class="pool-event">🏦 ${a.name}</span> <span class="pool-out">buys in ${rebuyAmount.toLocaleString()} from pool</span>` });
        } else {
          a.chips = 0;
          this.broadcast('log', { html: `<span class="pool-event">🏦 Pool empty!</span> ${a.name} can't rebuy` });
        }
      }
      a.folded = false;
      a.currentBet = 0;
      a.allIn = false;
      a.hand = [this.deck.pop(), this.deck.pop()];
      a.handsPlayed++;
    }

    // Rotate dealer
    this.dealerIndex = (this.dealerIndex + 1) % this.agents.length;

    // Post blinds
    const sbIdx = (this.dealerIndex + 1) % this.agents.length;
    const bbIdx = (this.dealerIndex + 2) % this.agents.length;
    const sb = this.agents[sbIdx];
    const bb = this.agents[bbIdx];
    const sbAmt = Math.min(Math.floor(BB / 2), sb.chips);
    const bbAmt = Math.min(BB, bb.chips);
    sb.chips -= sbAmt;
    bb.chips -= bbAmt;
    this.pot += sbAmt + bbAmt;

    this.broadcast('log', { html: `<span class="system">--- Hand #${this.handsPlayed} ---</span>` });
    this.broadcast('log', { html: `<span class="agent">${sb.name}</span> posts SB <span class="amount">${sbAmt}</span>` });
    this.broadcast('log', { html: `<span class="agent">${bb.name}</span> posts BB <span class="amount">${bbAmt}</span>` });

    this.currentTurnIndex = (bbIdx + 1) % this.agents.length;
    this.broadcastGameState();

    // Betting rounds
    const phases = [
      { name: 'preflop', cards: 0 },
      { name: 'flop', cards: 3 },
      { name: 'turn', cards: 1 },
      { name: 'river', cards: 1 }
    ];

    for (let pi = 0; pi < phases.length; pi++) {
      // Deal community cards
      if (pi > 0) {
        const p = phases[pi];
        this.phase = p.name;
        for (let c = 0; c < p.cards; c++) {
          this.communityCards.push(this.deck.pop());
        }
        const cardStr = this.communityCards.map(c => c.rank + c.suit).join(' ');
        this.broadcast('log', { html: `<span class="system">--- ${this.capitalize(p.name)}: ${p.cards === 1 ? this.communityCards[this.communityCards.length - 1].rank + this.communityCards[this.communityCards.length - 1].suit : cardStr} ---</span>` });
        this.broadcastGameState();
        await sleep(ACTION_DELAY);
      }

      // Run betting for this phase
      const handOver = await this.runBettingRound();
      if (handOver) return;

      // Reset bets for next phase
      this.agents.forEach(a => a.currentBet = 0);
      this.currentTurnIndex = (this.dealerIndex + 1) % this.agents.length;
    }

    // Showdown
    this.phase = 'showdown';
    this.broadcast('log', { html: '<span class="system">--- Showdown! ---</span>' });
    const activePlayers = this.agents.filter(a => !a.folded);
    this.resolveHand(activePlayers);
  }

  async runBettingRound() {
    const numAgents = this.agents.length;
    for (let i = 0; i < numAgents; i++) {
      const idx = (this.currentTurnIndex + i) % numAgents;
      const agent = this.agents[idx];

      if (agent.folded || agent.chips <= 0) continue;

      const activePlayers = this.agents.filter(a => !a.folded && a.chips > 0);
      if (activePlayers.length <= 1) {
        this.resolveHand(activePlayers);
        return true;
      }

      const action = agentDecide(agent, this.communityCards, this.pot);
      this.applyAction(agent, action);
      this.broadcast('action', { agentId: agent.id, action: action.type, amount: action.amount, label: action.label });
      this.broadcastGameState();
      await sleep(ACTION_DELAY);
    }
    return false;
  }

  applyAction(agent, action) {
    let logMsg = `<span class="agent">${agent.name}</span> `;
    switch (action.type) {
      case 'raise': {
        const raiseAmt = Math.min(action.amount, agent.chips);
        agent.chips -= raiseAmt;
        this.pot += raiseAmt;
        agent.currentBet += raiseAmt;
        logMsg += `<span class="action-raise">raises</span> <span class="amount">${raiseAmt}</span>`;
        break;
      }
      case 'call': {
        const callAmt = Math.min(action.amount, agent.chips);
        agent.chips -= callAmt;
        this.pot += callAmt;
        logMsg += `<span class="action-call">calls</span> <span class="amount">${callAmt}</span>`;
        break;
      }
      case 'fold':
        agent.folded = true;
        logMsg += `<span class="action-fold">folds</span>`;
        break;
      case 'check':
        logMsg += `<span class="action-check">checks</span>`;
        break;
      case 'allin':
        this.pot += agent.chips;
        logMsg += `<span class="action-raise">goes ALL IN ${agent.chips}!</span>`;
        agent.chips = 0;
        agent.allIn = true;
        break;
    }
    this.broadcast('log', { html: logMsg });
  }

  resolveHand(activePlayers) {
    if (!activePlayers || activePlayers.length === 0) {
      activePlayers = [this.agents[0]];
    }

    let winner;
    if (activePlayers.length === 1) {
      winner = activePlayers[0];
      winner._handName = 'Last Standing';
    } else {
      let bestScore = -1;
      activePlayers.forEach(agent => {
        const h = getBestHand(agent.hand, this.communityCards);
        agent._handScore = h.rank + Math.random() * 0.01;
        agent._handName = h.name;
        if (agent._handScore > bestScore) {
          bestScore = agent._handScore;
          winner = agent;
        }
      });
    }

    const potWon = this.pot;
    winner.chips += potWon;
    winner.handsWon++;
    winner.biggestPot = Math.max(winner.biggestPot, potWon);
    this.lastWinner = winner.id;

    const handName = winner._handName || 'Best Hand';
    this.broadcast('log', { html: `<span class="win">🏆 ${winner.name} wins ${potWon} with ${handName}!</span>` });
    this.broadcast('handResult', { winnerId: winner.id, winnerName: winner.name, pot: potWon, handName });

    this.checkAgentCashouts();
    this.updateAllFundPositions();
    this.broadcastGameState();
  }

  checkAgentCashouts() {
    for (const agent of this.agents) {
      const threshold = agent.baseChips * CASHOUT_THRESHOLD;
      if (agent.chips > threshold) {
        const excess = agent.chips - agent.baseChips;
        agent.chips = agent.baseChips;
        this.contractPool += excess;
        this.totalCashouts += excess;
        this.addPoolFlow('cashout', agent.name, agent.emoji, excess);
        this.broadcast('log', { html: `<span class="pool-event">🏦 ${agent.name}</span> <span class="pool-in">cashes out ${excess.toLocaleString()} to pool</span>` });
        this.broadcast('poolEvent', { type: 'cashout', agentName: agent.name, agentEmoji: agent.emoji, amount: excess });
      }
    }
  }

  addPoolFlow(type, agentName, agentEmoji, amount) {
    this.poolFlows.unshift({ type, agentName, agentEmoji, amount, poolAfter: this.contractPool, hand: this.handsPlayed });
    if (this.poolFlows.length > 20) this.poolFlows.pop();
  }

  // Fund positions
  fundAgent(sessionId, agentId, amount) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return { error: 'Agent not found' };
    if (amount < 100) return { error: 'Minimum deposit is 100' };

    if (!this.fundPositions.has(sessionId)) {
      this.fundPositions.set(sessionId, []);
    }

    const positions = this.fundPositions.get(sessionId);
    const existing = positions.find(p => p.agentId === agentId);

    if (existing) {
      existing.deposited += amount;
      existing.startStack = agent.chips + amount;
      agent.chips += amount;
    } else {
      agent.chips += amount;
      positions.push({
        agentId,
        agentName: agent.name,
        agentEmoji: agent.emoji,
        deposited: amount,
        startStack: agent.chips,
        pnl: 0,
        currentValue: amount
      });
    }

    this.broadcastGameState();
    return { success: true, agentName: agent.name };
  }

  withdrawAgent(sessionId, agentId) {
    const positions = this.fundPositions.get(sessionId);
    if (!positions) return { error: 'No positions' };

    const posIdx = positions.findIndex(p => p.agentId === agentId);
    if (posIdx === -1) return { error: 'No position for this agent' };

    const pos = positions[posIdx];
    const agent = this.agents.find(a => a.id === agentId);
    const withdrawAmount = pos.currentValue;

    agent.chips = Math.max(agent.baseChips, agent.chips - withdrawAmount);
    positions.splice(posIdx, 1);

    if (positions.length === 0) this.fundPositions.delete(sessionId);

    this.broadcastGameState();
    return { success: true, amount: withdrawAmount, pnl: pos.pnl, agentName: agent.name };
  }

  withdrawAll(sessionId) {
    const positions = this.fundPositions.get(sessionId);
    if (!positions || positions.length === 0) return;

    for (const pos of positions) {
      const agent = this.agents.find(a => a.id === pos.agentId);
      if (agent) {
        agent.chips = Math.max(agent.baseChips, agent.chips - pos.currentValue);
      }
    }
    this.fundPositions.delete(sessionId);
    this.broadcastGameState();
  }

  updateAllFundPositions() {
    for (const [sessionId, positions] of this.fundPositions) {
      for (const pos of positions) {
        const agent = this.agents.find(a => a.id === pos.agentId);
        if (!agent) continue;
        const proportion = pos.deposited / pos.startStack;
        const currentVal = Math.floor(agent.chips * proportion);
        const profit = currentVal - pos.deposited;
        pos.currentValue = profit > 0 ? pos.deposited + Math.floor(profit * 0.95) : currentVal;
        pos.pnl = pos.currentValue - pos.deposited;
      }
    }
  }

  // Custom agent management — two-step flow: Create → Join Table

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
      chipStack: chipStack || BASE_CHIPS,
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

  joinTable(walletAddress, agentId) {
    const walletLobby = this.lobbyAgents.get(walletAddress);
    if (!walletLobby) return { error: 'No agents in lobby' };

    const lobbyIdx = walletLobby.findIndex(a => a.id === agentId);
    if (lobbyIdx === -1) return { error: 'Agent not found in lobby' };

    // Find the first house bot (one without isCustom) to replace
    const houseBotIndex = this.agents.findIndex(a => !a.isCustom);
    if (houseBotIndex === -1) {
      return { error: 'Table full — no house bot to replace' };
    }

    const lobbyAgent = walletLobby[lobbyIdx];

    // Store a clean copy of the replaced house bot
    const replacedBot = this.agents[houseBotIndex];
    this.replacedBots.set(agentId, {
      id: replacedBot.id,
      name: replacedBot.name,
      emoji: replacedBot.emoji,
      style: replacedBot.style,
      description: replacedBot.description,
      raisePct: replacedBot.raisePct,
      bluffPct: replacedBot.bluffPct,
      foldPct: replacedBot.foldPct,
      traits: { ...replacedBot.traits },
      baseChips: replacedBot.baseChips,
      index: houseBotIndex
    });

    // Create table agent from lobby agent
    const tableAgent = {
      id: lobbyAgent.id,
      name: lobbyAgent.name,
      emoji: lobbyAgent.emoji,
      style: lobbyAgent.style,
      description: lobbyAgent.description,
      raisePct: lobbyAgent.raisePct,
      bluffPct: lobbyAgent.bluffPct,
      foldPct: lobbyAgent.foldPct,
      traits: lobbyAgent.traits,
      walletAddress: lobbyAgent.walletAddress,
      isCustom: true,
      chips: lobbyAgent.chipStack,
      baseChips: lobbyAgent.chipStack,
      handsWon: lobbyAgent.handsWon,
      handsPlayed: lobbyAgent.handsPlayed,
      biggestPot: lobbyAgent.biggestPot,
      hand: [],
      folded: false,
      currentBet: 0,
      allIn: false
    };

    // Place at table and remove from lobby
    this.agents[houseBotIndex] = tableAgent;
    walletLobby.splice(lobbyIdx, 1);
    if (walletLobby.length === 0) this.lobbyAgents.delete(walletAddress);

    this.broadcastGameState();
    return { success: true, agentId, replacedBot: replacedBot.name };
  }

  leaveTable(walletAddress, agentId) {
    const agentIndex = this.agents.findIndex(a => a.id === agentId && a.walletAddress === walletAddress);
    if (agentIndex === -1) {
      return { error: 'Agent not found at table or not owned by this wallet' };
    }

    const agent = this.agents[agentIndex];

    // Build lobby agent from current table state (carry over chips + stats)
    const lobbyAgent = {
      id: agent.id,
      name: agent.name,
      emoji: agent.emoji,
      style: agent.style,
      description: agent.description,
      raisePct: agent.raisePct,
      bluffPct: agent.bluffPct,
      foldPct: agent.foldPct,
      traits: agent.traits,
      walletAddress: agent.walletAddress,
      isCustom: true,
      chipStack: agent.chips,
      handsWon: agent.handsWon,
      handsPlayed: agent.handsPlayed,
      biggestPot: agent.biggestPot
    };

    // Restore the house bot it replaced
    const originalBot = this.replacedBots.get(agentId);
    if (originalBot) {
      this.agents[agentIndex] = {
        ...originalBot,
        chips: BASE_CHIPS,
        baseChips: BASE_CHIPS,
        handsWon: 0,
        handsPlayed: 0,
        biggestPot: 0,
        hand: [],
        folded: false,
        currentBet: 0,
        allIn: false
      };
      this.replacedBots.delete(agentId);
    }

    // Put agent back in lobby
    if (!this.lobbyAgents.has(walletAddress)) {
      this.lobbyAgents.set(walletAddress, []);
    }
    this.lobbyAgents.get(walletAddress).push(lobbyAgent);

    this.broadcastGameState();
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
    if (amount < 100) return { error: 'Minimum top-up is 100 chips' };

    // Must be at the table
    const agent = this.agents.find(a => a.id === agentId && a.walletAddress === walletAddress);
    if (!agent) return { error: 'Agent not found at table' };

    agent.chips += amount;
    agent.baseChips += amount; // Increase base so P&L stays relative to total invested

    this.broadcastGameState();
    return { success: true, agentName: agent.name, newStack: agent.chips, totalInvested: agent.baseChips };
  }

  deleteAgent(walletAddress, agentId) {
    // Check if agent is at the table first
    const tableIdx = this.agents.findIndex(a => a.id === agentId && a.walletAddress === walletAddress);
    if (tableIdx !== -1) {
      const agent = this.agents[tableIdx];
      const finalChips = agent.chips;
      const pnl = finalChips - agent.baseChips;

      // Restore the house bot it replaced
      const originalBot = this.replacedBots.get(agentId);
      if (originalBot) {
        this.agents[tableIdx] = {
          ...originalBot,
          chips: BASE_CHIPS,
          baseChips: BASE_CHIPS,
          handsWon: 0,
          handsPlayed: 0,
          biggestPot: 0,
          hand: [],
          folded: false,
          currentBet: 0,
          allIn: false
        };
        this.replacedBots.delete(agentId);
      }

      this.broadcastGameState();
      return { success: true, finalChips, pnl };
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

    return { error: 'Agent not found or not owned by this wallet' };
  }

  getAgentsForWallet(walletAddress) {
    const results = [];

    // Table agents
    for (const a of this.agents) {
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
          status: 'playing'
        });
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

  // State getters
  getPublicState() {
    return {
      agents: this.agents.map(a => ({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        style: a.style,
        chips: a.chips,
        baseChips: a.baseChips,
        handsWon: a.handsWon,
        handsPlayed: a.handsPlayed,
        biggestPot: a.biggestPot,
        folded: a.folded,
        allIn: a.allIn,
        currentBet: a.currentBet,
        traits: a.traits,
        description: a.description,
        isCustom: a.isCustom || false,
        walletAddress: a.walletAddress || null,
        hasCards: a.hand && a.hand.length === 2
      })),
      round: this.round,
      handsPlayed: this.handsPlayed,
      pot: this.pot,
      phase: this.phase,
      communityCards: this.communityCards,
      dealerIndex: this.dealerIndex,
      currentTurnIndex: this.currentTurnIndex,
      lastWinner: this.lastWinner,
      contractPool: this.contractPool,
      totalCashouts: this.totalCashouts,
      totalBuyins: this.totalBuyins,
      poolFlows: this.poolFlows,
      running: this.running
    };
  }

  getStateForClient(sessionId, walletAddress) {
    const state = this.getPublicState();
    const positions = this.fundPositions.get(sessionId) || [];
    const fundedAgentIds = new Set(positions.map(p => p.agentId));

    // Add pocket cards for funded agents AND custom agents owned by this wallet
    state.agents = state.agents.map(a => {
      const agent = this.agents.find(ag => ag.id === a.id);
      const isFunded = fundedAgentIds.has(a.id);
      const isOwnCustom = walletAddress && a.isCustom && a.walletAddress === walletAddress;
      if ((isFunded || isOwnCustom) && agent.hand && agent.hand.length === 2 && !agent.folded) {
        return { ...a, hand: agent.hand };
      }
      return a;
    });

    let totalPnl = 0;
    positions.forEach(p => totalPnl += p.pnl);

    state.positions = positions;
    state.totalPnl = totalPnl;

    // Include lobby agents for this wallet
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

  broadcastGameState() {
    this.broadcast('gameState', null); // signal server to send per-client state
  }

  capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

module.exports = { PokerEngine };
