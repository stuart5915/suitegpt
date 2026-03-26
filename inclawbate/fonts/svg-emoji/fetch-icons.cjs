// Fetch Lucide SVGs and save them named by emoji codepoint
const fs = require('fs');
const BASE = 'https://unpkg.com/lucide-static@latest/icons/';

// Map: emoji codepoint -> lucide icon name
const MAP = {
  // Top usage
  '1F99E': 'shell',          // 🦞 lobster (closest — we'll replace with custom later)
  '1F916': 'bot',            // 🤖 robot
  '2764':  'heart',          // ❤ heart
  '26A0':  'triangle-alert', // ⚠ warning
  '1F4B0': 'coins',          // 💰 money bag
  '274C':  'x',              // ❌ cross
  '2615':  'coffee',         // ☕ coffee
  '1F525': 'flame',          // 🔥 fire
  '2705':  'check',          // ✅ checkmark
  '1F3AE': 'gamepad-2',      // 🎮 gaming
  '2728':  'sparkles',       // ✨ sparkles
  '1F512': 'lock',           // 🔒 lock
  '1F4CB': 'clipboard-list', // 📋 clipboard
  '1F3AF': 'target',         // 🎯 target
  '1F4B5': 'banknote',       // 💵 dollar
  '1F4CA': 'bar-chart-3',    // 📊 chart
  '2B50':  'star',           // ⭐ star
  '26A1':  'zap',            // ⚡ lightning
  '1F517': 'link',           // 🔗 link
  '1F528': 'hammer',         // 🔨 hammer
  '1F4DD': 'file-text',      // 📝 notepad
  '1F3E6': 'landmark',       // 🏦 bank
  '1F680': 'rocket',         // 🚀 rocket
  '1F9E0': 'brain',          // 🧠 brain
  '1F6E0': 'wrench',         // 🛠 tools
  '1F465': 'users',          // 👥 users
  '1F4C8': 'trending-up',    // 📈 trending up
  '1F4B2': 'dollar-sign',    // 💲 dollar sign
  '1F53A': 'triangle',       // 🔺 triangle up
  '1F504': 'refresh-cw',     // 🔄 refresh
  '1F4BB': 'laptop',         // 💻 laptop
  '1F4E3': 'megaphone',      // 📣 megaphone
  '1F3C6': 'trophy',         // 🏆 trophy
  '1F449': 'arrow-right',    // 👉 arrow right
  '1F4AC': 'message-circle', // 💬 chat
  '1F3DB': 'columns-3',      // 🏛 pillars
  '1F331': 'sprout',         // 🌱 sprout
  '1F4D6': 'book-open',      // 📖 book
  '1F9EA': 'flask-conical',  // 🧪 test tube
  '1F9EC': 'dna',            // 🧬 dna
  '1F4A1': 'lightbulb',      // 💡 lightbulb
  '1F91D': 'handshake',      // 🤝 handshake
  '1F3A8': 'palette',        // 🎨 palette
  '1F4E6': 'package',        // 📦 package
  '1F310': 'globe',          // 🌐 globe
  '1F30D': 'earth',          // 🌍 earth
  '1F998': 'kangaroo',       // 🦘 (no lucide — skip)
  '23F3':  'hourglass',      // ⏳ hourglass
  '1F4F1': 'smartphone',     // 📱 phone
  '1F5D1': 'trash-2',        // 🗑 trash
  '1F5F3': 'vote',           // 🗳 ballot box
  '1F4E5': 'inbox',          // 📥 inbox
  '1F4E4': 'upload',         // 📤 outbox
  '1F4DC': 'scroll',         // 📜 scroll
  '1F6E1': 'shield',         // 🛡 shield
  '2694':  'swords',         // ⚔ swords
  '1F451': 'crown',          // 👑 crown
  '1F48E': 'gem',            // 💎 gem
  '1F300': 'loader',         // 🌀 spiral
  '1F534': 'circle',         // 🔴 red circle
  '1F7E2': 'circle-check',   // 🟢 green circle
  '1F511': 'key',            // 🔑 key
  '2699':  'settings',       // ⚙ gear
  '1F389': 'party-popper',   // 🎉 party
  '1F527': 'wrench',         // 🔧 wrench
  '1F3B2': 'dice-5',         // 🎲 dice
  '1F44B': 'hand',           // 👋 wave
  '1F914': 'help-circle',    // 🤔 thinking
  '26EA':  'church',         // ⛪ church
  '1F54A': 'bird',           // 🕊 dove
  '26D3':  'link-2',         // ⛓ chain
  '1F4CD': 'map-pin',        // 📍 pin
  '1F4CE': 'paperclip',      // 📎 paperclip
  '1F3E0': 'house',          // 🏠 house
  '2696':  'scale',          // ⚖ scale
  '1F4BC': 'briefcase',      // 💼 briefcase
  '1F52C': 'microscope',     // 🔬 microscope
  '1F3D7': 'building-2',     // 🏗 construction
  '1F6D2': 'shopping-cart',  // 🛒 cart
  '1F640': 'rocket',         // 🚀 (dup)
  '1F4A9': 'poo',            // 💩 (no lucide — skip)
  '1F480': 'skull',          // 💀 skull
  '2757':  'alert-circle',   // ❗ exclamation
  '1F44D': 'thumbs-up',      // 👍 thumbs up
  '267B':  'recycle',        // ♻ recycle
  '26D4':  'ban',            // ⛔ no entry
  '1F550': 'clock',          // 🕐 clock
  '1F4E2': 'volume-2',       // 📢 speaker
  '1F4C9': 'trending-down',  // 📉 trending down
  '1F4B8': 'wallet',         // 💸 money wings
  '1F3B0': 'slot-machine',   // 🎰 (no lucide — skip)
  '1F9F0': 'toolbox',        // 🧰 toolbox (no lucide — use wrench)
  '1F3F7': 'tag',            // 🏷 tag
  '1FA99': 'circle-dollar-sign', // 🪙 coin
  '1F477': 'hard-hat',       // 👷 worker
  '1F41B': 'bug',            // 🐛 bug
  '1F426': 'bird',           // 🐦 bird
  '1F4E1': 'satellite-dish', // 📡 satellite
  '1F333': 'tree-deciduous', // 🌳 tree
  '1F3A3': 'fish',           // 🎣 fishing
  '1F3AD': 'drama',          // 🎭 theater
  '1F64F': 'hand',           // 🙏 pray (use hand)
  '1F60E': 'glasses',        // 😎 cool
  '1F4D0': 'ruler',          // 📐 ruler
};

// Remove entries that don't exist in Lucide
const SKIP = new Set(['kangaroo','poo','slot-machine','drama','glasses','ruler','toolbox','hard-hat','hand']);

async function fetchAll() {
  let ok = 0, fail = 0;
  for (const [cp, icon] of Object.entries(MAP)) {
    if (SKIP.has(icon)) continue;
    const url = BASE + icon + '.svg';
    try {
      const resp = await fetch(url);
      if (!resp.ok) { console.log('MISS: ' + icon + ' (' + cp + ')'); fail++; continue; }
      let svg = await resp.text();
      // Lucide SVGs use stroke — we need to make them work as font glyphs
      // Font glyphs need filled paths, so we'll keep the SVGs as-is for now
      // and let svgtofont handle the conversion
      fs.writeFileSync(cp + '.svg', svg);
      ok++;
    } catch(e) { console.log('ERR: ' + icon + ' — ' + e.message); fail++; }
  }
  console.log('Done: ' + ok + ' fetched, ' + fail + ' missed');
}
fetchAll();
