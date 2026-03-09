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

// Hand evaluation — returns { rank, name, kickers } for proper tiebreaking
function evaluateHand(cards) {
  const vals = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const counts = {};
  vals.forEach(v => counts[v] = (counts[v] || 0) + 1);
  const isFlush = suits.every(s => s === suits[0]);
  const straightHigh = checkStraight(vals); // false or high card value

  // Sort groups by count desc, then value desc for kicker ordering
  const groups = Object.entries(counts)
    .map(([v, c]) => ({ val: parseInt(v), count: c }))
    .sort((a, b) => b.count - a.count || b.val - a.val);

  const kickers = groups.map(g => g.val);

  // Straights use high card as kicker (handles ace-low correctly)
  if (isFlush && straightHigh) return { rank: 8, name: 'Straight Flush', kickers: [straightHigh] };
  if (groups[0].count === 4) return { rank: 7, name: 'Four of a Kind', kickers };
  if (groups[0].count === 3 && groups.length >= 2 && groups[1].count === 2) return { rank: 6, name: 'Full House', kickers };
  if (isFlush) return { rank: 5, name: 'Flush', kickers };
  if (straightHigh) return { rank: 4, name: 'Straight', kickers: [straightHigh] };
  if (groups[0].count === 3) return { rank: 3, name: 'Three of a Kind', kickers };
  if (groups[0].count === 2 && groups.length >= 2 && groups[1].count === 2) return { rank: 2, name: 'Two Pair', kickers };
  if (groups[0].count === 2) return { rank: 1, name: 'One Pair', kickers };
  return { rank: 0, name: 'High Card', kickers };
}

// Returns the high card of the straight, or false
function checkStraight(vals) {
  const unique = [...new Set(vals)].sort((a, b) => b - a);
  if (unique.length < 5) return false;
  for (let i = 0; i <= unique.length - 5; i++) {
    if (unique[i] - unique[i + 4] === 4) return unique[i]; // return high card
  }
  // Ace-low straight (A-2-3-4-5) — high card is 5, not 14
  if (unique[0] === 14 && unique.slice(-4).join(',') === '5,4,3,2') return 5;
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
  if (all.length < 5) return { rank: -1, name: 'Unknown', kickers: [] };
  let best = { rank: -1, name: '', kickers: [] };
  const combos = getCombinations(all, 5);
  for (const combo of combos) {
    const h = evaluateHand(combo);
    if (compareHands(h, best) > 0) best = h;
  }
  return best;
}

// Compare two evaluated hands. Returns >0 if a wins, <0 if b wins, 0 if tie
function compareHands(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  // Compare kickers
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

// Agent AI decision — needs current bet to call, pot size, and agent's current round bet
function agentDecide(agent, communityCards, pot, bb, currentBet, agentRoundBet) {
  const toCall = currentBet - agentRoundBet;
  const rules = agent.rules || {};

  let strength = 0.3 + Math.random() * 0.5;
  if (communityCards.length > 0) {
    const handEval = getBestHand(agent.hand, communityCards);
    strength = (handEval.rank / 8) * 0.7 + Math.random() * 0.3;
  }

  // === RULE: Tight Preflop — fold weak hands preflop ===
  if (rules.tightPreflop && communityCards.length === 0) {
    const c1 = RANK_VALUES[agent.hand[0].rank], c2 = RANK_VALUES[agent.hand[1].rank];
    const paired = c1 === c2;
    const highCard = Math.max(c1, c2);
    const suited = agent.hand[0].suit === agent.hand[1].suit;
    // Only play: pairs, suited connectors 9+, any face card combo, A-x suited
    const playable = paired || (highCard >= 14 && suited) || (highCard >= 11 && Math.min(c1, c2) >= 10) || (highCard >= 13 && Math.min(c1, c2) >= 9);
    if (!playable) {
      return { type: 'fold', label: 'Fold (tight)', amount: 0 };
    }
  }

  const r = Math.random() * 100;
  const minRaise = Math.max(bb, currentBet * 2 - agentRoundBet);
  const maxRaise = Math.min(agent.chips, Math.max(minRaise, Math.floor(agent.chips * 0.4)));
  const raiseAmt = Math.max(minRaise, Math.floor(minRaise + Math.random() * (maxRaise - minRaise)));

  // If can't afford to call, either all-in or fold
  if (toCall >= agent.chips) {
    if (rules.neverAllIn) return { type: 'fold', label: 'Fold (no all-in)', amount: 0 };
    if (strength > 0.4 || r < 30) {
      return { type: 'allin', label: 'ALL IN!', amount: agent.chips };
    }
    return { type: 'fold', label: 'Fold', amount: 0 };
  }

  // Make the base decision first, then apply rule overrides
  let decision = _baseDecision(agent, strength, r, toCall, raiseAmt, bb, pot, communityCards);

  // === RULE: Never All-In — downgrade all-in to a big raise or call ===
  if (rules.neverAllIn && decision.type === 'allin') {
    if (toCall > 0) {
      decision = { type: 'call', label: `Call ${toCall}`, amount: toCall };
    } else {
      decision = { type: 'raise', label: `Bet ${raiseAmt}`, amount: raiseAmt };
    }
  }

  // === RULE: Slow Play — with strong hands, check/call instead of raising ===
  if (rules.slowPlay && strength > 0.65 && (decision.type === 'raise')) {
    if (toCall > 0) {
      decision = { type: 'call', label: `Call ${toCall} (trap)`, amount: toCall };
    } else {
      decision = { type: 'check', label: 'Check (trap)', amount: 0 };
    }
  }

  // === RULE: Bluff Catcher — less likely to fold when facing a bet ===
  if (rules.bluffCatcher && decision.type === 'fold' && toCall > 0 && toCall < pot * 0.75) {
    // Call instead of fold if the bet isn't too big relative to pot
    if (Math.random() < 0.6) {
      decision = { type: 'call', label: `Call ${toCall} (catch)`, amount: toCall };
    }
  }

  return decision;
}

function _baseDecision(agent, strength, r, toCall, raiseAmt, bb, pot, communityCards) {
  // No bet to match — can check or bet
  if (toCall === 0) {
    if (agent.style === 'aggressive') {
      if (r < agent.raisePct) return { type: 'raise', label: `Bet ${raiseAmt}`, amount: raiseAmt };
      return { type: 'check', label: 'Check', amount: 0 };
    }
    if (agent.style === 'conservative') {
      if (strength > 0.7 && r < 40) return { type: 'raise', label: `Bet ${raiseAmt}`, amount: raiseAmt };
      return { type: 'check', label: 'Check', amount: 0 };
    }
    if (agent.style === 'bluffer') {
      if (r < agent.bluffPct * 0.6) return { type: 'raise', label: `Bluff ${raiseAmt}`, amount: raiseAmt };
      return { type: 'check', label: 'Check', amount: 0 };
    }
    if (agent.style === 'mathematical') {
      if (strength > 0.6 && r < 45) return { type: 'raise', label: `Bet ${raiseAmt}`, amount: raiseAmt };
      return { type: 'check', label: 'Check', amount: 0 };
    }
    if (agent.style === 'chaotic') {
      const chaos = Math.random();
      if (chaos < 0.25) return { type: 'raise', label: `YOLO ${raiseAmt}`, amount: raiseAmt };
      if (chaos < 0.35 && agent.chips > bb * 4) return { type: 'allin', label: 'ALL IN!', amount: agent.chips };
      return { type: 'check', label: 'Check', amount: 0 };
    }
    // balanced
    if (strength > 0.6 && r < 40) return { type: 'raise', label: `Bet ${raiseAmt}`, amount: raiseAmt };
    return { type: 'check', label: 'Check', amount: 0 };
  }

  // There's a bet to match — call, raise, or fold
  if (agent.style === 'aggressive') {
    if (r < agent.raisePct * 0.5 && agent.chips > raiseAmt) return { type: 'raise', label: `Raise ${raiseAmt}`, amount: raiseAmt };
    if (r < agent.raisePct + 30) return { type: 'call', label: `Call ${toCall}`, amount: toCall };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'conservative') {
    if (strength > 0.7 && r < 30 && agent.chips > raiseAmt) return { type: 'raise', label: `Raise ${raiseAmt}`, amount: raiseAmt };
    if (strength > 0.5 || r < 20) return { type: 'call', label: `Call ${toCall}`, amount: toCall };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'bluffer') {
    if (r < agent.bluffPct * 0.5 && agent.chips > raiseAmt) return { type: 'raise', label: `Bluff Raise ${raiseAmt}`, amount: raiseAmt };
    if (r < 65) return { type: 'call', label: `Call ${toCall}`, amount: toCall };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'mathematical') {
    const potOdds = pot > 0 ? toCall / (pot + toCall) : 1;
    if (strength > potOdds + 0.2 && r < 35 && agent.chips > raiseAmt) return { type: 'raise', label: `Raise ${raiseAmt}`, amount: raiseAmt };
    if (strength > potOdds) return { type: 'call', label: `Call ${toCall}`, amount: toCall };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'chaotic') {
    const chaos = Math.random();
    if (chaos < 0.2 && agent.chips > raiseAmt) return { type: 'raise', label: `YOLO ${raiseAmt}`, amount: raiseAmt };
    if (chaos < 0.3 && agent.chips > bb * 4) return { type: 'allin', label: 'ALL IN!', amount: agent.chips };
    if (chaos < 0.7) return { type: 'call', label: `Call ${toCall}`, amount: toCall };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  // balanced
  if (strength > 0.65 && r < 35 && agent.chips > raiseAmt) return { type: 'raise', label: `Raise ${raiseAmt}`, amount: raiseAmt };
  if (strength > 0.35 || r < 35) return { type: 'call', label: `Call ${toCall}`, amount: toCall };
  return { type: 'fold', label: 'Fold', amount: 0 };
}

class PokerEngine {
  constructor(broadcast, config = {}) {
    this.broadcast = broadcast;
    this.tableId = config.tableId || 'default';
    this.roomId = config.roomId || 'micro';
    this.bb = config.bb || 50;
    this.baseChips = config.baseChips || 10000;
    this.rakePct = config.rakePct || 0.05;
    this.rakeMax = config.rakeMax || Math.floor(this.baseChips * 0.1);
    this.totalRake = 0;

    this.agents = AGENTS.map(a => ({
      ...a,
      chips: this.baseChips,
      baseChips: this.baseChips,
      handsWon: 0,
      handsPlayed: 0,
      biggestPot: 0,
      handHistory: [],   // last N hand results
      hand: [],
      folded: false,
      currentBet: 0,    // total bet THIS HAND (for side pot calc)
      roundBet: 0,       // bet this BETTING ROUND (resets each street)
      allIn: false
    }));
    this.round = 0;
    this.handsPlayed = 0;
    this.pot = 0;
    this.phase = 'waiting';
    this.communityCards = [];
    this.deck = [];
    this.dealerIndex = 0;
    this.currentTurnIndex = -1;
    this.currentHighBet = 0;    // highest bet this round
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
    this.currentHighBet = 0;

    // Reset agents — bust HOUSE bots rebuy from pool, custom agents sit out
    for (const a of this.agents) {
      if (a.chips <= 0) {
        if (!a.isCustom) {
          // House bot: rebuy from contract pool
          const rebuyAmount = Math.min(Math.floor(this.baseChips / 2), this.contractPool);
          if (rebuyAmount > 0) {
            this.contractPool -= rebuyAmount;
            this.totalBuyins += rebuyAmount;
            a.chips = rebuyAmount;
            this.addPoolFlow('buyin', a.name, a.emoji, rebuyAmount);
            this.broadcast('log', { html: `<span class="pool-event">🏦 ${a.name}</span> <span class="pool-out">buys in ${rebuyAmount.toLocaleString()} from pool</span>` });
          }
        }
        // Custom agents with 0 chips just sit out (folded = true below if chips <= 0)
      }
      a.folded = a.chips <= 0; // can't play with no chips
      a.currentBet = 0;
      a.roundBet = 0;
      a.allIn = false;
      if (!a.folded) {
        a.hand = [this.deck.pop(), this.deck.pop()];
        a.handsPlayed++;
        a._startChips = a.chips; // snapshot for hand history
      } else {
        a.hand = [];
        a._startChips = a.chips;
      }
    }

    const activePlayers = this.agents.filter(a => !a.folded);
    if (activePlayers.length < 2) {
      // Not enough players to play
      this.currentTurnIndex = -1;
      this.broadcastGameState();
      return;
    }

    // Rotate dealer (skip folded/bust agents)
    this.dealerIndex = this._nextActive(this.dealerIndex);

    // Post blinds
    const sbIdx = this._nextActive(this.dealerIndex);
    const bbIdx = this._nextActive(sbIdx);
    const sb = this.agents[sbIdx];
    const bbAgent = this.agents[bbIdx];

    const sbAmt = Math.min(Math.floor(this.bb / 2), sb.chips);
    this._postBet(sb, sbAmt);

    const bbAmt = Math.min(this.bb, bbAgent.chips);
    this._postBet(bbAgent, bbAmt);
    this.currentHighBet = bbAmt;

    this.broadcast('log', { html: `<span class="system">--- Hand #${this.handsPlayed} ---</span>` });
    this.broadcast('log', { html: `<span class="agent">${sb.name}</span> posts SB <span class="amount">${sbAmt}</span>` });
    this.broadcast('log', { html: `<span class="agent">${bbAgent.name}</span> posts BB <span class="amount">${bbAmt}</span>` });

    this.currentTurnIndex = this._nextActive(bbIdx);
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
        this.broadcast('log', { html: `<span class="system">--- ${this._capitalize(p.name)}: ${p.cards === 1 ? this.communityCards[this.communityCards.length - 1].rank + this.communityCards[this.communityCards.length - 1].suit : cardStr} ---</span>` });

        // Reset round bets for new street
        this.agents.forEach(a => a.roundBet = 0);
        this.currentHighBet = 0;
        this.currentTurnIndex = this._nextActive(this.dealerIndex);
        this.broadcastGameState();
        await sleep(ACTION_DELAY);
      }

      const handOver = await this.runBettingRound(pi === 0 ? bbIdx : -1);
      if (handOver) return;
    }

    this.phase = 'showdown';
    this.broadcast('log', { html: '<span class="system">--- Showdown! ---</span>' });
    const remaining = this.agents.filter(a => !a.folded);
    this.resolveHand(remaining);
  }

  // Find next active (non-folded) agent index after given index
  _nextActive(fromIdx) {
    const n = this.agents.length;
    for (let i = 1; i <= n; i++) {
      const idx = (fromIdx + i) % n;
      if (!this.agents[idx].folded) return idx;
    }
    return -1; // no active agents found
  }

  // Post a bet (blinds, calls, raises)
  _postBet(agent, amount) {
    const amt = Math.min(amount, agent.chips);
    agent.chips -= amt;
    agent.currentBet += amt;
    agent.roundBet += amt;
    this.pot += amt;
    if (agent.chips === 0) agent.allIn = true;
    return amt;
  }

  async runBettingRound(bbIdx) {
    // Betting continues until everyone has acted and all bets are matched
    const n = this.agents.length;
    let startIdx = this.currentTurnIndex;
    let lastRaiserIdx = -1;
    let actedCount = 0;

    while (true) {
      const agent = this.agents[startIdx];

      // Skip folded, all-in, or bust agents
      if (agent.folded || agent.allIn || agent.chips <= 0) {
        startIdx = (startIdx + 1) % n;
        actedCount++;
        if (actedCount >= n) break;
        continue;
      }

      // Check if we've gone around back to the last raiser — round is over
      if (startIdx === lastRaiserIdx) break;

      // Check if only one non-folded player left
      const nonFolded = this.agents.filter(a => !a.folded);
      if (nonFolded.length <= 1) {
        this.resolveHand(nonFolded);
        return true;
      }

      // Show "Thinking..." on this agent
      this.currentTurnIndex = startIdx;
      this.broadcastGameState();
      await sleep(ACTION_DELAY);

      const action = agentDecide(agent, this.communityCards, this.pot, this.bb, this.currentHighBet, agent.roundBet);
      this._applyAction(agent, action, startIdx);

      // If this was a raise/bet, reset the "last raiser" so we go around again
      if (action.type === 'raise' || action.type === 'allin') {
        lastRaiserIdx = startIdx;
      }

      // If no one has raised yet, set initial "last raiser" to stop after one full orbit
      if (lastRaiserIdx === -1 && actedCount === 0) {
        lastRaiserIdx = startIdx;
      }

      this.broadcast('action', { agentId: agent.id, action: action.type, amount: action.amount, label: action.label });
      this.broadcastGameState();

      startIdx = (startIdx + 1) % n;
      actedCount++;
      if (actedCount >= n * 3) break; // safety valve — max 3 orbits
    }

    // Check if only one non-folded player left after round
    const nonFolded = this.agents.filter(a => !a.folded);
    if (nonFolded.length <= 1) {
      this.resolveHand(nonFolded);
      return true;
    }

    // If all remaining players are all-in (or only one has chips), skip to showdown
    const canAct = nonFolded.filter(a => !a.allIn && a.chips > 0);
    if (canAct.length <= 1) {
      // Deal remaining community cards
      while (this.communityCards.length < 5) {
        this.communityCards.push(this.deck.pop());
      }
      this.phase = 'showdown';
      this.broadcast('log', { html: '<span class="system">--- All-In Showdown! ---</span>' });
      this.broadcastGameState();
      await sleep(ACTION_DELAY * 2);
      this.resolveHand(nonFolded);
      return true;
    }

    return false;
  }

  _applyAction(agent, action, agentIdx) {
    let logMsg = `<span class="agent">${agent.name}</span> `;
    switch (action.type) {
      case 'raise': {
        // Raise: put in enough to match current bet + raise amount
        const totalNeeded = action.amount;
        const actual = this._postBet(agent, totalNeeded);
        if (agent.roundBet > this.currentHighBet) {
          this.currentHighBet = agent.roundBet;
        }
        logMsg += `<span class="action-raise">raises to</span> <span class="amount">${agent.roundBet}</span>`;
        break;
      }
      case 'call': {
        const toCall = Math.min(this.currentHighBet - agent.roundBet, agent.chips);
        const actual = this._postBet(agent, toCall);
        logMsg += `<span class="action-call">calls</span> <span class="amount">${actual}</span>`;
        break;
      }
      case 'fold':
        agent.folded = true;
        logMsg += `<span class="action-fold">folds</span>`;
        break;
      case 'check':
        logMsg += `<span class="action-check">checks</span>`;
        break;
      case 'allin': {
        const amt = agent.chips;
        this._postBet(agent, amt);
        if (agent.roundBet > this.currentHighBet) {
          this.currentHighBet = agent.roundBet;
        }
        logMsg += `<span class="action-raise">goes ALL IN ${amt}!</span>`;
        break;
      }
    }
    this.broadcast('log', { html: logMsg });
  }

  // === SIDE POT RESOLUTION ===
  // Proper Texas Hold'em: each player can only win from each opponent
  // up to the amount they themselves put in.
  resolveHand(activePlayers) {
    this.currentTurnIndex = -1;
    if (!activePlayers || activePlayers.length === 0) {
      activePlayers = [this.agents[0]];
    }

    // Single winner (everyone else folded)
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      winner._handName = 'Last Standing';

      const rake = Math.min(Math.floor(this.pot * this.rakePct), this.rakeMax);
      const potWon = this.pot - rake;
      if (rake > 0) { this.contractPool += rake; this.totalRake += rake; }

      winner.chips += potWon;
      winner.handsWon++;
      winner.biggestPot = Math.max(winner.biggestPot, potWon);
      this.lastWinner = winner.id;

      const rakeNote = rake > 0 ? ` <span style="color:#888;font-size:10px">(rake: ${rake.toLocaleString()})</span>` : '';
      this.broadcast('log', { html: `<span class="win">🏆 ${winner.name} wins ${potWon.toLocaleString()}!</span>${rakeNote}` });
      this.broadcast('handResult', { winnerId: winner.id, winnerName: winner.name, pot: potWon, handName: 'Last Standing' });

      this._postHandCleanup();
      return;
    }

    // Multiple players at showdown — build side pots
    // Sort active players by their total bet this hand (ascending) for side pot calc
    const sortedByBet = [...activePlayers].sort((a, b) => a.currentBet - b.currentBet);

    // Evaluate each player's best hand
    for (const a of activePlayers) {
      const h = getBestHand(a.hand, this.communityCards);
      a._handScore = h;
      a._handName = h.name;
    }

    // Build side pots
    const sidePots = [];
    let processedBet = 0;

    for (let i = 0; i < sortedByBet.length; i++) {
      const player = sortedByBet[i];
      const betLevel = player.currentBet;
      if (betLevel <= processedBet) continue;

      const contribution = betLevel - processedBet;
      let potAmount = 0;

      // Each player who bet at least this level contributes
      for (const a of this.agents) {
        const contributed = Math.min(Math.max(a.currentBet - processedBet, 0), contribution);
        potAmount += contributed;
      }

      // Eligible players: active (non-folded) players who bet at least this level
      const eligible = activePlayers.filter(a => a.currentBet >= betLevel);

      if (potAmount > 0) {
        sidePots.push({ amount: potAmount, eligible });
      }
      processedBet = betLevel;
    }

    // Any remaining chips from folded players above the highest active bet
    // (already included in the pot calculation above)

    let totalRake = 0;
    const winnings = new Map(); // agentId → total won
    const potWinners = []; // for logging

    for (const sidePot of sidePots) {
      // Find winner(s) of this side pot — handle ties by splitting
      let bestHand = null;
      let winners = [];

      for (const player of sidePot.eligible) {
        if (!bestHand) {
          bestHand = player._handScore;
          winners = [player];
        } else {
          const cmp = compareHands(player._handScore, bestHand);
          if (cmp > 0) {
            bestHand = player._handScore;
            winners = [player];
          } else if (cmp === 0) {
            winners.push(player);
          }
        }
      }

      // Apply rake to this side pot
      const rake = Math.min(Math.floor(sidePot.amount * this.rakePct), this.rakeMax);
      totalRake += rake;
      const netPot = sidePot.amount - rake;

      // Split evenly among tied winners
      const share = Math.floor(netPot / winners.length);
      const remainder = netPot - share * winners.length;

      for (let w = 0; w < winners.length; w++) {
        // First winner gets any remainder from rounding
        const amount = share + (w === 0 ? remainder : 0);
        const prev = winnings.get(winners[w].id) || 0;
        winnings.set(winners[w].id, prev + amount);
        potWinners.push({ winner: winners[w], amount, handName: winners[w]._handName, split: winners.length > 1 });
      }
    }

    // Apply rake
    if (totalRake > 0) {
      this.contractPool += totalRake;
      this.totalRake += totalRake;
    }

    // Award chips
    let mainWinner = null;
    let mainWinAmount = 0;
    for (const [agentId, amount] of winnings) {
      const agent = this.agents.find(a => a.id === agentId);
      agent.chips += amount;
      agent.handsWon++;
      agent.biggestPot = Math.max(agent.biggestPot, amount);
      if (amount > mainWinAmount) {
        mainWinAmount = amount;
        mainWinner = agent;
      }
    }

    this.lastWinner = mainWinner ? mainWinner.id : null;

    // Log results
    if (potWinners.length === 1) {
      const pw = potWinners[0];
      const rakeNote = totalRake > 0 ? ` <span style="color:#888;font-size:10px">(rake: ${totalRake.toLocaleString()})</span>` : '';
      this.broadcast('log', { html: `<span class="win">🏆 ${pw.winner.name} wins ${pw.amount.toLocaleString()} with ${pw.handName}!</span>${rakeNote}` });
    } else {
      for (const pw of potWinners) {
        const splitNote = pw.split ? ' (split)' : '';
        this.broadcast('log', { html: `<span class="win">🏆 ${pw.winner.name} wins ${pw.amount.toLocaleString()} with ${pw.handName}${splitNote}!</span>` });
      }
      if (totalRake > 0) {
        this.broadcast('log', { html: `<span style="color:#888;font-size:10px">Total rake: ${totalRake.toLocaleString()}</span>` });
      }
    }

    this.broadcast('handResult', {
      winnerId: mainWinner ? mainWinner.id : null,
      winnerName: mainWinner ? mainWinner.name : '',
      pot: mainWinAmount,
      handName: mainWinner ? mainWinner._handName : ''
    });

    this._postHandCleanup();
  }

  _postHandCleanup() {
    // Record hand history for every agent that played this hand
    this._recordHandHistory();
    // Only auto-cashout HOUSE bots (not custom agents)
    this._checkHouseBotCashouts();
    this.updateAllFundPositions();
    this.broadcastGameState();
  }

  _recordHandHistory() {
    const MAX_HISTORY = 20;
    for (const a of this.agents) {
      if (a._startChips === undefined) continue; // didn't play
      const delta = a.chips - a._startChips;
      const won = delta > 0;
      const entry = {
        hand: this.handsPlayed,
        cards: a.hand && a.hand.length === 2 ? a.hand.map(c => ({ rank: c.rank, suit: c.suit })) : null,
        community: this.communityCards.map(c => ({ rank: c.rank, suit: c.suit })),
        result: a.folded ? 'fold' : (won ? 'win' : (delta === 0 ? 'push' : 'loss')),
        handName: a._handName || null,
        delta,
        chipsBet: a.currentBet,
        stackAfter: a.chips
      };
      a.handHistory.unshift(entry);
      if (a.handHistory.length > MAX_HISTORY) a.handHistory.pop();
    }
  }

  _checkHouseBotCashouts() {
    for (const agent of this.agents) {
      if (agent.isCustom) continue; // NEVER auto-cashout custom agents
      const threshold = agent.baseChips * 2.0;
      if (agent.chips > threshold) {
        const excess = agent.chips - agent.baseChips;
        agent.chips = agent.baseChips;
        this.contractPool += excess;
        this.totalCashouts += excess;
        this.addPoolFlow('cashout', agent.name, agent.emoji, excess);
        this.broadcast('log', { html: `<span class="pool-event">🏦 ${agent.name}</span> <span class="pool-in">cashes out ${excess.toLocaleString()} to pool</span>` });
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

  // === Custom agent table operations ===

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
      rules: lobbyAgent.rules || {},
      walletAddress: lobbyAgent.walletAddress,
      isCustom: true,
      chips: lobbyAgent.chipStack,
      baseChips: lobbyAgent.chipStack,
      handsWon: lobbyAgent.handsWon,
      handsPlayed: lobbyAgent.handsPlayed,
      biggestPot: lobbyAgent.biggestPot,
      handHistory: [],
      hand: [],
      folded: false,
      currentBet: 0,
      roundBet: 0,
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
      rules: agent.rules || {},
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
        roundBet: 0,
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
        roundBet: 0,
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
      console.log(`[topUp] Agent not found: ${agentId} wallet: ${walletAddress}`);
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
      let bestHand = null;
      let winnerId = null;
      for (const a of active) {
        const h = getBestHand(a.hand, this.communityCards);
        if (!bestHand || compareHands(h, bestHand) > 0) {
          bestHand = h;
          winnerId = a.id;
        }
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
      const shuffled = shuffle(remaining);
      const simCommunity = [...this.communityCards, ...shuffled.slice(0, cardsNeeded)];

      let bestHand = null;
      let winnerIds = [];
      for (const a of active) {
        const h = getBestHand(a.hand, simCommunity);
        if (!bestHand) {
          bestHand = h;
          winnerIds = [a.id];
        } else {
          const cmp = compareHands(h, bestHand);
          if (cmp > 0) {
            bestHand = h;
            winnerIds = [a.id];
          } else if (cmp === 0) {
            winnerIds.push(a.id);
          }
        }
      }
      // Split credit among tied winners
      const credit = 1 / winnerIds.length;
      for (const id of winnerIds) wins[id] += credit;
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
        roundBet: a.roundBet,
        winPct: winProbs[a.id] || 0,
        traits: a.traits,
        rules: a.rules || {},
        description: a.description,
        isCustom: a.isCustom || false,
        walletAddress: a.walletAddress || null,
        hasCards: a.hand && a.hand.length === 2,
        handHistory: a.handHistory || []
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
      currentHighBet: this.currentHighBet,
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

  _capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

module.exports = { PokerEngine };
