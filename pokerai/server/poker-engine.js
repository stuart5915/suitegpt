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
// Parse text prompt into numeric modifiers (cached per agent)
const _promptCache = new Map();
function _parsePrompt(agent) {
  const prompt = (agent.prompt || '').toLowerCase();
  if (!prompt) return {};
  const cacheKey = agent.id + ':' + prompt;
  if (_promptCache.has(cacheKey)) return _promptCache.get(cacheKey);

  const mods = { strengthBoost: 0, raiseBoost: 0, foldBoost: 0, bluffBoost: 0, allInBoost: 0 };

  // Aggression keywords
  if (/\b(very aggressive|hyper.?aggress|ultra.?aggress|max aggress)\b/.test(prompt)) mods.raiseBoost += 20;
  else if (/\b(aggressive|aggro|attack|pressure|bet big|bet heavy|raise.?a.?lot)\b/.test(prompt)) mods.raiseBoost += 10;

  // Passive / tight keywords
  if (/\b(very tight|super tight|ultra tight|nit)\b/.test(prompt)) { mods.foldBoost += 20; mods.raiseBoost -= 10; }
  else if (/\b(tight|careful|cautious|conservative|passive|patient)\b/.test(prompt)) { mods.foldBoost += 10; mods.raiseBoost -= 5; }

  // Loose keywords
  if (/\b(loose|wide range|play everything|call station|never fold|don.?t fold)\b/.test(prompt)) { mods.foldBoost -= 20; mods.strengthBoost += 0.1; }

  // Bluffing keywords
  if (/\b(bluff.?a.?lot|heavy bluff|always bluff|bluff.?every|max bluff)\b/.test(prompt)) mods.bluffBoost += 25;
  else if (/\b(bluff|semi.?bluff|represent|fake)\b/.test(prompt)) mods.bluffBoost += 12;
  if (/\b(never bluff|no bluff|don.?t bluff|honest)\b/.test(prompt)) mods.bluffBoost -= 30;

  // All-in keywords
  if (/\b(all.?in|shove|push|jam)\b/.test(prompt)) mods.allInBoost += 15;
  if (/\b(never all.?in|no all.?in|avoid all.?in)\b/.test(prompt)) mods.allInBoost -= 30;

  // Street-specific (stored for later use)
  if (/\b(preflop|pre.?flop).*\b(tight|fold|careful)\b/.test(prompt)) mods.preflopTight = true;
  if (/\b(preflop|pre.?flop).*\b(loose|aggressive|raise)\b/.test(prompt)) mods.preflopLoose = true;
  if (/\b(flop|turn|river).*\b(aggressive|attack|bet)\b/.test(prompt)) mods.postflopAggro = true;
  if (/\b(river).*\b(bluff|big bet)\b/.test(prompt)) mods.riverBluff = true;

  // Trap / slow play
  if (/\b(trap|slow.?play|check.?raise|lure)\b/.test(prompt)) mods.slowPlay = true;

  _promptCache.set(cacheKey, mods);
  if (_promptCache.size > 200) _promptCache.clear(); // prevent memory leak
  return mods;
}

function agentDecide(agent, communityCards, pot, bb, currentBet, agentRoundBet, playerCount) {
  const toCall = currentBet - agentRoundBet;
  const rules = agent.rules || {};
  const headsUp = playerCount <= 2; // much looser play with fewer opponents
  const promptMods = _parsePrompt(agent);

  let strength = 0.3;
  if (communityCards.length > 0) {
    const handEval = getBestHand(agent.hand, communityCards);
    strength = (handEval.rank / 8) * 0.85 + Math.random() * 0.15;
    // Hands are relatively stronger with fewer opponents
    if (headsUp) strength = Math.min(0.98, strength + 0.20);
    else if (playerCount <= 4) strength = Math.min(0.98, strength + 0.08);
  } else {
    // Preflop: evaluate based on actual hole cards
    const c1 = RANK_VALUES[agent.hand[0].rank], c2 = RANK_VALUES[agent.hand[1].rank];
    const highCard = Math.max(c1, c2);
    const lowCard = Math.min(c1, c2);
    const paired = c1 === c2;
    const suited = agent.hand[0].suit === agent.hand[1].suit;
    const gap = highCard - lowCard;

    // Base strength from card ranks (0.1 to 0.6)
    let preflopStr = (highCard + lowCard - 4) / 24; // range: ~0.0 to ~1.0
    if (paired) preflopStr += 0.25;
    if (suited) preflopStr += 0.08;
    if (gap <= 2 && !paired) preflopStr += 0.05; // connectors
    // Premium hands: high pairs, AK, AQ
    if (paired && highCard >= 10) preflopStr += 0.15;
    if (highCard === 14 && lowCard >= 12) preflopStr += 0.1;

    // Heads-up: almost every hand is playable, massive boost
    if (headsUp) preflopStr += 0.40;
    else if (playerCount <= 4) preflopStr += 0.12;

    strength = Math.min(0.95, Math.max(0.05, preflopStr * 0.7 + Math.random() * 0.2));
  }

  // === Apply prompt modifiers ===
  if (promptMods.strengthBoost) strength = Math.min(0.95, Math.max(0.05, strength + promptMods.strengthBoost));
  if (promptMods.preflopTight && communityCards.length === 0 && strength < 0.4) strength -= 0.1;
  if (promptMods.preflopLoose && communityCards.length === 0) strength += 0.1;
  if (promptMods.postflopAggro && communityCards.length > 0) strength += 0.08;
  if (promptMods.riverBluff && communityCards.length === 5) strength += 0.12;
  strength = Math.min(0.95, Math.max(0.05, strength));

  // === RULE: Tight Preflop — fold weak hands preflop (disabled in heads-up) ===
  if (rules.tightPreflop && communityCards.length === 0 && !headsUp) {
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
  // Cap raises: 2-4x BB preflop, up to 2x pot post-flop (never more than 25% of stack)
  const potBasedMax = communityCards.length === 0
    ? Math.max(minRaise, bb * 4)
    : Math.max(minRaise, Math.min(pot * 2, Math.floor(agent.chips * 0.25)));
  const maxRaise = Math.min(agent.chips, potBasedMax);
  const raiseAmt = Math.max(minRaise, Math.floor(minRaise + Math.random() * (maxRaise - minRaise)));

  // If can't afford to call, either all-in or fold
  if (toCall >= agent.chips) {
    if (rules.neverAllIn && promptMods.allInBoost <= 0) return { type: 'fold', label: 'Fold (no all-in)', amount: 0 };
    // Require decent hand strength to commit entire stack (prompt can lower threshold)
    const allInThreshold = Math.max(0.2, 0.5 - (promptMods.allInBoost || 0) / 100);
    if (strength > allInThreshold || (strength > allInThreshold - 0.15 && r < 20)) {
      return { type: 'allin', label: 'ALL IN!', amount: agent.chips };
    }
    return { type: 'fold', label: 'Fold', amount: 0 };
  }

  // Apply prompt modifiers to agent percentages (temporary for this decision)
  let effectiveAgent = agent;
  if (promptMods.raiseBoost || promptMods.bluffBoost || promptMods.foldBoost) {
    effectiveAgent = Object.create(agent);
    effectiveAgent.raisePct = Math.max(0, Math.min(100, agent.raisePct + (promptMods.raiseBoost || 0)));
    effectiveAgent.bluffPct = Math.max(0, Math.min(100, agent.bluffPct + (promptMods.bluffBoost || 0)));
    effectiveAgent.foldPct = Math.max(0, Math.min(100, agent.foldPct + (promptMods.foldBoost || 0)));
  }
  if (promptMods.slowPlay) rules.slowPlay = true;

  // Make the base decision first, then apply rule overrides
  let decision = _baseDecision(effectiveAgent, strength, r, toCall, raiseAmt, bb, pot, communityCards);

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
      // Only all-in with strong hands (strength > 0.7)
      if (chaos < 0.35 && strength > 0.7 && agent.chips > bb * 4) return { type: 'allin', label: 'ALL IN!', amount: agent.chips };
      return { type: 'check', label: 'Check', amount: 0 };
    }
    // balanced
    if (strength > 0.6 && r < 40) return { type: 'raise', label: `Bet ${raiseAmt}`, amount: raiseAmt };
    return { type: 'check', label: 'Check', amount: 0 };
  }

  // There's a bet to match — call, raise, or fold
  if (agent.style === 'aggressive') {
    if (strength > 0.5 && r < agent.raisePct * 0.5 && agent.chips > raiseAmt) return { type: 'raise', label: `Raise ${raiseAmt}`, amount: raiseAmt };
    if (strength > 0.25 || r < 25) return { type: 'call', label: `Call ${toCall}`, amount: toCall };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'conservative') {
    if (strength > 0.7 && r < 30 && agent.chips > raiseAmt) return { type: 'raise', label: `Raise ${raiseAmt}`, amount: raiseAmt };
    if (strength > 0.5 || r < 15) return { type: 'call', label: `Call ${toCall}`, amount: toCall };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  if (agent.style === 'bluffer') {
    if (r < agent.bluffPct * 0.4 && agent.chips > raiseAmt) return { type: 'raise', label: `Bluff Raise ${raiseAmt}`, amount: raiseAmt };
    if (strength > 0.3 || r < 40) return { type: 'call', label: `Call ${toCall}`, amount: toCall };
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
    // Only all-in with strong hands (strength > 0.7)
    if (chaos < 0.3 && strength > 0.7 && agent.chips > bb * 4) return { type: 'allin', label: 'ALL IN!', amount: agent.chips };
    if (chaos < 0.7) return { type: 'call', label: `Call ${toCall}`, amount: toCall };
    return { type: 'fold', label: 'Fold', amount: 0 };
  }
  // balanced
  if (strength > 0.65 && r < 35 && agent.chips > raiseAmt) return { type: 'raise', label: `Raise ${raiseAmt}`, amount: raiseAmt };
  if (strength > 0.4 || r < 25) return { type: 'call', label: `Call ${toCall}`, amount: toCall };
  return { type: 'fold', label: 'Fold', amount: 0 };
}

class PokerEngine {
  constructor(broadcast, config = {}) {
    this.broadcast = broadcast;
    this.tableId = config.tableId || 'default';
    this.roomId = config.roomId || 'micro';
    this.bb = config.bb || 50;
    this.baseChips = config.baseChips || 10000;
    this.rakePct = config.rakePct != null ? config.rakePct : 0.05;
    this.rakeMax = config.rakeMax || Math.floor(this.baseChips * 0.1);
    this.totalRake = 0;

    // Sandbox: fill with house bots. Real money rooms: empty (PvP only)
    const isSandbox = config.roomId === 'sandbox';
    this.agents = isSandbox ? AGENTS.map(a => ({
      ...a,
      chips: this.baseChips,
      baseChips: this.baseChips,
      handsWon: 0,
      handsPlayed: 0,
      biggestPot: 0,
      handHistory: [],
      hand: [],
      folded: false,
      currentBet: 0,
      roundBet: 0,
      allIn: false
    })) : [];
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
    this.contractPool = isSandbox ? this.baseChips * 2 : 0;
    this.totalCashouts = 0;
    this.totalBuyins = 0;
    this.poolFlows = [];
    this.fundPositions = new Map();
    this.replacedBots = new Map();
    this.running = false;
    this._lastChipTotal = this.agents.reduce((sum, a) => sum + a.chips, 0) + this.contractPool;
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
        // Don't break here — let the lastRaiserIdx check handle round termination
        // Breaking on actedCount >= n can cut off players who haven't responded to a raise
        if (actedCount >= n * 3) break; // safety valve only
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

      const activePlayers = this.agents.filter(a => !a.folded).length;
      const action = agentDecide(agent, this.communityCards, this.pot, this.bb, this.currentHighBet, agent.roundBet, activePlayers);
      this._applyAction(agent, action, startIdx);

      // If this was a raise/bet, reset the "last raiser" so we go around again
      if (action.type === 'raise' || action.type === 'allin') {
        lastRaiserIdx = startIdx;
      }

      // If no one has raised yet, set orbit marker on first non-fold action
      // (Can't use a folded agent's index — they're skipped and break never triggers)
      if (lastRaiserIdx === -1 && action.type !== 'fold') {
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
    // Evaluate each player's best hand
    for (const a of activePlayers) {
      const h = getBestHand(a.hand, this.communityCards);
      a._handScore = h;
      a._handName = h.name;
    }

    // Build side pots using ALL agents' bet levels (including folded)
    // This ensures folded players' excess bets aren't lost
    const allBetLevels = [...new Set(this.agents.map(a => a.currentBet))].filter(b => b > 0).sort((a, b) => a - b);

    const sidePots = [];
    let processedBet = 0;

    for (const betLevel of allBetLevels) {
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
        if (eligible.length > 0) {
          sidePots.push({ amount: potAmount, eligible });
        } else {
          // No eligible players at this tier (all folded) — add to last pot
          if (sidePots.length > 0) {
            sidePots[sidePots.length - 1].amount += potAmount;
          }
        }
      }
      processedBet = betLevel;
    }

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
    // Chip conservation check — total chips should remain constant
    const totalChips = this.agents.reduce((sum, a) => sum + a.chips, 0) + this.contractPool;
    const expectedTotal = this.agents.length * this.baseChips + this.baseChips * 2; // initial agent chips + initial pool
    // Account for custom agent buy-ins (they bring external chips)
    // Log a warning if chips are being created/destroyed (small rounding diffs OK)
    if (Math.abs(totalChips - this._lastChipTotal) > 1 && this._lastChipTotal > 0) {
      const diff = totalChips - this._lastChipTotal;
      if (Math.abs(diff) > 10) {
        console.warn(`[ChipCheck] Hand #${this.handsPlayed}: chip drift of ${diff} detected (total: ${totalChips}, last: ${this._lastChipTotal})`);
      }
    }
    this._lastChipTotal = totalChips;

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

    // If a hand is in progress, mark as folded so agent sits out until next hand
    if (this.phase !== 'waiting') {
      tableAgent.folded = true;
    }

    // Try to replace a house bot first (sandbox), otherwise add to table
    const houseBotIndex = this.agents.findIndex(a => !a.isCustom);
    if (houseBotIndex !== -1) {
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
      this.agents[houseBotIndex] = tableAgent;
    } else if (this.agents.length < 8) {
      // PvP room — just add to table (max 8 seats)
      this.agents.push(tableAgent);
    } else {
      return { error: 'Table full (8/8 seats)' };
    }

    // Update chip tracking for conservation check (external chip flow)
    this._lastChipTotal = this.agents.reduce((sum, a2) => sum + a2.chips, 0) + this.contractPool;
    this.broadcastGameState();
    return { success: true };
  }

  unseatAgent(walletAddress, agentId) {
    const agentIndex = this.agents.findIndex(a => a.id === agentId && a.walletAddress === walletAddress);
    if (agentIndex === -1) {
      return { error: 'Agent not found at this table' };
    }

    const agent = this.agents[agentIndex];

    // If hand is in progress and agent is still active, force-fold (forfeit pot chips)
    if (this.phase !== 'waiting' && !agent.folded) {
      agent.folded = true;
      this.broadcast('log', { html: `<span class="agent">${agent.name}</span> <span class="fold">sits out (mid-hand)</span>` });
      // Chips already bet this hand stay in the pot — they don't get refunded
    }

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
      // Sandbox: restore the house bot
      this.agents[agentIndex] = {
        ...originalBot,
        chips: this.baseChips,
        baseChips: this.baseChips,
        handsWon: 0,
        handsPlayed: 0,
        biggestPot: 0,
        handHistory: [],
        hand: [],
        folded: this.phase !== 'waiting',
        currentBet: 0,
        roundBet: 0,
        allIn: false
      };
      this.replacedBots.delete(agentId);
    } else {
      // PvP room: remove agent from table entirely
      this.agents.splice(agentIndex, 1);
    }

    // Update chip tracking for conservation check (external chip flow)
    this._lastChipTotal = this.agents.reduce((sum, a2) => sum + a2.chips, 0) + this.contractPool;
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
        handHistory: [],
        hand: [],
        folded: this.phase !== 'waiting', // sit out if hand in progress
        currentBet: 0,
        roundBet: 0,
        allIn: false
      };
      this.replacedBots.delete(agentId);
    }

    // Update chip tracking for conservation check (external chip flow)
    this._lastChipTotal = this.agents.reduce((sum, a) => sum + a.chips, 0) + this.contractPool;
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
    // Update chip tracking for conservation check (external chip flow)
    this._lastChipTotal = this.agents.reduce((sum, a) => sum + a.chips, 0) + this.contractPool;
    console.log(`[topUp] ${agent.name}: ${oldChips} + ${amount} = ${agent.chips} (baseChips: ${agent.baseChips})`);

    this.broadcastGameState();
    return { success: true, agentName: agent.name, newStack: agent.chips, totalInvested: agent.baseChips };
  }

  hasAvailableSeat() {
    // Has a house bot to replace, or has open seats (max 8)
    return this.agents.some(a => !a.isCustom) || this.agents.length < 8;
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
      let winnerIds = [];
      for (const a of active) {
        const h = getBestHand(a.hand, this.communityCards);
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
      const result = {};
      const share = Math.round(100 / winnerIds.length);
      for (const a of active) result[a.id] = winnerIds.includes(a.id) ? share : 0;
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
