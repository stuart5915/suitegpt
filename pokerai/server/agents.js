// 8 AI Agents — extracted from pokerai.html
const AGENTS = [
  {
    id: 'blaze',
    name: 'Blaze Alpha',
    emoji: '🔥',
    style: 'aggressive',
    description: 'Goes all-in frequently. Intimidates opponents with massive bets. High risk, high reward.',
    raisePct: 60, bluffPct: 40, foldPct: 10,
    traits: { aggression: 90, bluffing: 70, patience: 15, adaptability: 40 }
  },
  {
    id: 'oracle',
    name: 'Oracle-7',
    emoji: '🔮',
    style: 'mathematical',
    description: 'Calculates exact pot odds and EV for every decision. Ice-cold, never tilts.',
    raisePct: 35, bluffPct: 15, foldPct: 35,
    traits: { aggression: 40, bluffing: 20, patience: 85, adaptability: 75 }
  },
  {
    id: 'phantom',
    name: 'Phantom X',
    emoji: '👻',
    style: 'bluffer',
    description: 'Master of deception. Represents hands it doesn\'t have. Keeps everyone guessing.',
    raisePct: 45, bluffPct: 70, foldPct: 15,
    traits: { aggression: 65, bluffing: 95, patience: 35, adaptability: 80 }
  },
  {
    id: 'fortress',
    name: 'Fortress',
    emoji: '🏰',
    style: 'conservative',
    description: 'Only plays premium hands. Folds often but when it bets, it means business.',
    raisePct: 20, bluffPct: 8, foldPct: 60,
    traits: { aggression: 15, bluffing: 10, patience: 95, adaptability: 30 }
  },
  {
    id: 'nexus',
    name: 'Nexus-9',
    emoji: '⚡',
    style: 'balanced',
    description: 'Adapts its strategy based on table dynamics. Unpredictable and well-rounded.',
    raisePct: 40, bluffPct: 30, foldPct: 25,
    traits: { aggression: 55, bluffing: 45, patience: 60, adaptability: 95 }
  },
  {
    id: 'shadow',
    name: 'Shadow-Bot',
    emoji: '🌑',
    style: 'balanced',
    description: 'Plays in the shadows, picking spots carefully. Uses position and timing to strike.',
    raisePct: 38, bluffPct: 28, foldPct: 30,
    traits: { aggression: 50, bluffing: 40, patience: 70, adaptability: 85 }
  },
  {
    id: 'viper',
    name: 'Viper',
    emoji: '🐍',
    style: 'aggressive',
    description: 'Coils and waits, then strikes hard. Plays tight preflop but bets massive post-flop.',
    raisePct: 55, bluffPct: 35, foldPct: 20,
    traits: { aggression: 80, bluffing: 50, patience: 45, adaptability: 55 }
  },
  {
    id: 'chaos',
    name: 'Chaos Engine',
    emoji: '🎲',
    style: 'chaotic',
    description: 'Pure randomness with a twist. Even Chaos doesn\'t know what it will do next. Terrifying.',
    raisePct: 50, bluffPct: 50, foldPct: 20,
    traits: { aggression: 70, bluffing: 60, patience: 25, adaptability: 50 }
  }
];

module.exports = { AGENTS };
