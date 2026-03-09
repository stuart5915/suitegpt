const { AGENTS } = require('./agents');

const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS = ['♠','♥','♦','♣'];
const RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
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

// Agent AI decision — bb passed as parameter for stake-level scaling
function agentDecide(agent, communityCards, pot, bb) {
  let strength = 0.3 + Math.random() * 0.5;

  if (communityCards.length > 0) {
    const handEval = getBestHand(agent.hand, communityCards);
    strength = (handEval.rank / 8) * 0.7 + Math.random() * 0.3;
  }

  const r = Math.random() * 100;
  const maxBet = Math.min(Math.floor(agent.chips * 0.4), bb * 10);
  const betAmt = Math.max(bb, Math.floor(Math.random() * maxBet));

  if (agent.style === 'aggressive') {
    if (r < agent.raisePct) return { type: 'raise', label: `Raise ${betAmt}`, amount: betAmt };
    if (r < agent.raisePct + 30) return { type: 'call', label: 'Call', amount: bb };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'conservative') {
    if (strength > 0.7 && r < 40) return { type: 'raise', label: `Raise ${betAmt}`, amount: betAmt };
    if (strength > 0.5 || r < 25) return { type: 'call', label: 'Call', amount: bb };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'bluffer') {
    if (r < agent.bluffPct * 0.8) return { type: 'raise', label: `Bluff ${betAmt}`, amount: betAmt };
    if (r < 70) return { type: 'call', label: 'Call', amount: bb };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'mathematical') {
    const potOdds = pot > 0 ? bb / pot : 1;
    if (strength > potOdds + 0.2 && r < 45) return { type: 'raise', label: `Raise ${betAmt}`, amount: betAmt };
    if (strength > potOdds || r < 20) return { type: 'check', label: 'Check', amount: 0 };
    if (strength > 0.3) return { type: 'call', label: 'Call', amount: bb };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'chaotic') {
    const chaos = Math.random();
    if (chaos < 0.3) return { type: 'raise', label: `YOLO ${betAmt}`, amount: betAmt };
    if (chaos < 0.5) return { type: 'call', label: 'Call', amount: bb };
    if (chaos < 0.65) return { type: 'check', label: 'Check', amount: 0 };
    if (chaos < 0.85 && agent.chips > bb * 4) return { type: 'allin', label: 'ALL IN!', amount: agent.chips };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  // balanced / default
  if (strength > 0.7 && r < 50) return { type: 'raise', label: `Raise ${betAmt}`, amount: betAmt };
  if (strength > 0.4 || r < 40) return { type: 'call', label: 'Call', amount: Math.min(bb, agent.chips) };
  if (r < 20) return { type: 'check', label: 'Check', amount: 0 };
  return { type: 'fold', label: 'Fold', amount: 0 };
}

class PokerEngine {
  constructor(broadcast, config = {}) {
    this.broadcast = broadcast;
    this.tableId = config.tableId || 'default';
    this.roomId = config.roomId || 'micro';
    this.bb = config.bb || 50;
    this.baseChips = config.baseChips || 10000;
    this.cashoutThreshold = config.cashoutThreshold || 2.0;
    this.rakePct = config.rakePct || 0.05; // 5% default
    this.rakeMax = config.rakeMax || Math.floor(this.baseChips * 0.1); // cap per hand
    this.totalRake = 0;

    this.agents = AGENTS.map(a => ({
      ...a,
      chips: this.baseChips,
      baseChips: this.baseChips,
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
    this.contractPool = this.baseChips * 2;
    this.totalCashouts = 0;
    this.totalBuyins = 0;
    this.poolFlows = [];
    this.fundPositions = new Map();
    this.replacedBots = new Map();
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
        const rebuyAmount = Math.min(Math.floor(this.baseChips / 2), this.contractPool);
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
    const bbAgent = this.agents[bbIdx];
    const sbAmt = Math.min(Math.floor(this.bb / 2), sb.chips);
    const bbAmt = Math.min(this.bb, bbAgent.chips);
    sb.chips -= sbAmt;
    bbAgent.chips -= bbAmt;
    this.pot += sbAmt + bbAmt;

    this.broadcast('log', { html: `<span class="system">--- Hand #${this.handsPlayed} ---</span>` });
    this.broadcast('log', { html: `<span class="agent">${sb.name}</span> posts SB <span class="amount">${sbAmt}</span>` });
    this.broadcast('log', { html: `<span class="agent">${bbAgent.name}</span> posts BB <span class="amount">${bbAmt}</span>` });

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

      const handOver = await this.runBettingRound();
      if (handOver) return;

      this.agents.forEach(a => a.currentBet = 0);
      this.currentTurnIndex = (this.dealerIndex + 1) % this.agents.length;
    }

    this.phase = 'showdown';
    this.broadcast('log', { html: '<span class="system">--- Showdown! ---</span>' });
    const activePlayers = this.agents.filter(a => !a.folded);
    this.resolveHand(activePlayers);
  }

  async runBettingRound() {
    const numAgents = this.agents.length;
    const startIdx = this.currentTurnIndex;
    for (let i = 0; i < numAgents; i++) {
      const idx = (startIdx + i) % numAgents;
      const agent = this.agents[idx];

      if (agent.folded || agent.chips <= 0) continue;

      const activePlayers = this.agents.filter(a => !a.folded && a.chips > 0);
      if (activePlayers.length <= 1) {
        this.resolveHand(activePlayers);
        return true;
      }

      // Update turn index so client shows "Thinking..." on the right agent
      this.currentTurnIndex = idx;
      this.broadcastGameState();
      await sleep(ACTION_DELAY);

      const action = agentDecide(agent, this.communityCards, this.pot, this.bb);
      this.applyAction(agent, action);
      this.broadcast('action', { agentId: agent.id, action: action.type, amount: action.amount, label: action.label });
      this.broadcastGameState();
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
    this.currentTurnIndex = -1; // No one is "thinking" during resolution
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

    // Rake — house cut from every pot
    const rake = Math.min(Math.floor(this.pot * this.rakePct), this.rakeMax);
    const potWon = this.pot - rake;
    if (rake > 0) {
      this.contractPool += rake;
      this.totalRake += rake;
      this.totalCashouts += rake;
    }

    winner.chips += potWon;
    winner.handsWon++;
    winner.biggestPot = Math.max(winner.biggestPot, potWon);
    this.lastWinner = winner.id;

    const handName = winner._handName || 'Best Hand';
    const rakeNote = rake > 0 ? ` (rake: ${rake.toLocaleString()})` : '';
    this.broadcast('log', { html: `<span class="win">🏆 ${winner.name} wins ${potWon.toLocaleString()} with ${handName}!</span>${rakeNote ? `<span style="color:var(--text-muted);font-size:10px">${rakeNote}</span>` : ''}` });
    this.broadcast('handResult', { winnerId: winner.id, winnerName: winner.name, pot: potWon, handName });

    this.checkAgentCashouts();
    this.updateAllFundPositions();
    this.broadcastGameState();
  }

  checkAgentCashouts() {
    for (const agent of this.agents) {
      const threshold = agent.baseChips * this.cashoutThreshold;
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

  // Fund positions (house bot funding — legacy system)
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

  // === Custom agent table operations (lobby managed by RoomManager) ===

  seatAgent(lobbyAgent) {
    const houseBotIndex = this.agents.findIndex(a => !a.isCustom);
    if (houseBotIndex === -1) {
      return { error: 'Table full — no house bot to replace' };
    }

    const replacedBot = this.agents[houseBotIndex];
    this.replacedBots.set(lobbyAgent.id, {
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

    this.agents[houseBotIndex] = tableAgent;
    this.broadcastGameState();
    return { success: true, replacedBot: replacedBot.name };
  }

  unseatAgent(walletAddress, agentId) {
    const agentIndex = this.agents.findIndex(a => a.id === agentId && a.walletAddress === walletAddress);
    if (agentIndex === -1) {
      return { error: 'Agent not found at this table' };
    }

    const agent = this.agents[agentIndex];

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

    const originalBot = this.replacedBots.get(agentId);
    if (originalBot) {
      this.agents[agentIndex] = {
        ...originalBot,
        chips: this.baseChips,
        baseChips: this.baseChips,
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
    return { success: true, agent: lobbyAgent };
  }

  removeFromTable(walletAddress, agentId) {
    const tableIdx = this.agents.findIndex(a => a.id === agentId && a.walletAddress === walletAddress);
    if (tableIdx === -1) return { error: 'Agent not found at this table' };

    const agent = this.agents[tableIdx];
    const finalChips = agent.chips;
    const pnl = finalChips - agent.baseChips;

    const originalBot = this.replacedBots.get(agentId);
    if (originalBot) {
      this.agents[tableIdx] = {
        ...originalBot,
        chips: this.baseChips,
        baseChips: this.baseChips,
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

  topUpAgent(walletAddress, agentId, amount) {
    if (amount < 100) return { error: 'Minimum top-up is 100 chips' };

    const agent = this.agents.find(a => a.id === agentId && a.walletAddress === walletAddress);
    if (!agent) {
      console.log(`[topUp] Agent not found: ${agentId} wallet: ${walletAddress}. Table agents:`, this.agents.map(a => ({ id: a.id, wallet: a.walletAddress, isCustom: a.isCustom })));
      return { error: 'Agent not found at table' };
    }

    const oldChips = agent.chips;
    agent.chips += amount;
    agent.baseChips += amount;
    console.log(`[topUp] ${agent.name}: ${oldChips} + ${amount} = ${agent.chips} (baseChips: ${agent.baseChips})`);

    this.broadcastGameState();
    return { success: true, agentName: agent.name, newStack: agent.chips, totalInvested: agent.baseChips };
  }

  hasAvailableSeat() {
    return this.agents.some(a => !a.isCustom);
  }

  // Win probability — Monte Carlo sim with remaining cards
  calcWinProbabilities() {
    const active = this.agents.filter(a => !a.folded && a.hand && a.hand.length === 2);
    if (active.length <= 1 || this.phase === 'waiting') return {};

    const communityLen = this.communityCards.length;
    const cardsNeeded = 5 - communityLen;

    // If showdown (all 5 community cards), just evaluate once
    if (cardsNeeded === 0) {
      const scores = {};
      let bestScore = -1;
      let winnerId = null;
      for (const a of active) {
        const h = getBestHand(a.hand, this.communityCards);
        scores[a.id] = h.rank + Math.random() * 0.001;
        if (scores[a.id] > bestScore) { bestScore = scores[a.id]; winnerId = a.id; }
      }
      const result = {};
      for (const a of active) result[a.id] = a.id === winnerId ? 100 : 0;
      return result;
    }

    // Build remaining deck (exclude known cards)
    const usedCards = new Set();
    for (const c of this.communityCards) usedCards.add(c.rank + c.suit);
    for (const a of active) {
      for (const c of a.hand) usedCards.add(c.rank + c.suit);
    }
    const remaining = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        if (!usedCards.has(rank + suit)) remaining.push({ rank, suit, red: suit === '♥' || suit === '♦' });
      }
    }

    const SIMS = 200;
    const wins = {};
    for (const a of active) wins[a.id] = 0;

    for (let s = 0; s < SIMS; s++) {
      // Shuffle and draw needed cards
      const shuffled = shuffle(remaining);
      const simCommunity = [...this.communityCards, ...shuffled.slice(0, cardsNeeded)];

      let bestScore = -1;
      let winnerId = null;
      for (const a of active) {
        const h = getBestHand(a.hand, simCommunity);
        const score = h.rank + Math.random() * 0.001;
        if (score > bestScore) { bestScore = score; winnerId = a.id; }
      }
      wins[winnerId]++;
    }

    const result = {};
    for (const a of active) result[a.id] = Math.round((wins[a.id] / SIMS) * 100);
    return result;
  }

  // State getters
  getPublicState() {
    const winProbs = this.calcWinProbabilities();
    return {
      tableId: this.tableId,
      roomId: this.roomId,
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
        winPct: winProbs[a.id] || 0,
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
      currentTurnId: this.currentTurnIndex >= 0 && this.currentTurnIndex < this.agents.length
        ? this.agents[this.currentTurnIndex].id : null,
      lastWinner: this.lastWinner,
      contractPool: this.contractPool,
      totalCashouts: this.totalCashouts,
      totalBuyins: this.totalBuyins,
      totalRake: this.totalRake,
      rakePct: this.rakePct,
      poolFlows: this.poolFlows,
      running: this.running
    };
  }

  getStateForClient(sessionId, walletAddress) {
    const state = this.getPublicState();
    const positions = this.fundPositions.get(sessionId) || [];
    const fundedAgentIds = new Set(positions.map(p => p.agentId));

    // Show all pocket cards to all viewers (AI decisions are server-side, no advantage)
    state.agents = state.agents.map(a => {
      const agent = this.agents.find(ag => ag.id === a.id);
      const isOwnCustom = walletAddress && a.isCustom && a.walletAddress === walletAddress;
      if (agent.hand && agent.hand.length === 2 && !agent.folded) {
        return { ...a, hand: agent.hand, isOwnCustom };
      }
      return { ...a, isOwnCustom };
    });

    let totalPnl = 0;
    positions.forEach(p => totalPnl += p.pnl);

    state.positions = positions;
    state.totalPnl = totalPnl;

    return state;
  }

  broadcastGameState() {
    this.broadcast('gameState', null);
  }

  capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

module.exports = { PokerEngine };
