// Inclawbator — Leaderboard + Pricing

var CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
var CLAWNCH_PER_CREDIT = 50;

function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

(async function() {
    // Fetch leaderboard and CLAWNCH price in parallel
    var results = await Promise.all([
        fetch('/api/inclawbate/leaderboard').then(function(r) { return r.json(); }).catch(function() { return null; }),
        fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWNCH_ADDRESS)
            .then(function(r) { return r.json(); }).catch(function() { return null; })
    ]);

    var res = results[0];
    var priceRes = results[1];

    // ── Leaderboard ──
    var list = document.getElementById('leaderboardList');

    if (!res || !res.leaderboard || res.leaderboard.length === 0) {
        list.innerHTML = '<div class="lb-empty"><p>No replies generated yet. Be the first!</p></div>';
    } else {
        list.innerHTML = res.leaderboard.map(function(user) {
            var rankClass = user.rank <= 3 ? ' lb-rank-' + user.rank : '';
            var avatar = user.x_avatar_url || '';
            var name = user.x_name || user.x_handle;
            var handle = user.x_handle;
            var replies = user.total_replies.toLocaleString();

            return '<a href="/u/' + encodeURIComponent(handle) + '" class="lb-row">' +
                '<div class="lb-rank' + rankClass + '">' + user.rank + '</div>' +
                (avatar ? '<img class="lb-avatar" src="' + esc(avatar) + '" alt="" loading="lazy">' : '<div class="lb-avatar"></div>') +
                '<div class="lb-info">' +
                    '<div class="lb-name">' + esc(name) + '</div>' +
                    '<div class="lb-handle">@' + esc(handle) + '</div>' +
                '</div>' +
                '<div class="lb-replies">' + replies + ' replies</div>' +
            '</a>';
        }).join('');
    }

    // ── Pricing Transparency ──
    var clawnchPrice = 0;
    if (priceRes && priceRes.pairs && priceRes.pairs[0]) {
        clawnchPrice = parseFloat(priceRes.pairs[0].priceUsd) || 0;
    }

    if (clawnchPrice > 0) {
        var costPerReply = (CLAWNCH_PER_CREDIT * clawnchPrice).toFixed(4);
        var repliesPer1k = Math.floor(1000 / CLAWNCH_PER_CREDIT);

        var priceEl = document.getElementById('pricePerReply');
        if (priceEl) priceEl.textContent = '~$' + costPerReply;

        var repliesEl = document.getElementById('repliesPer1k');
        if (repliesEl) repliesEl.textContent = repliesPer1k.toLocaleString();

        var liveEl = document.getElementById('liveClawnchPrice');
        if (liveEl) liveEl.textContent = '$' + clawnchPrice.toFixed(6);
    } else {
        var liveEl2 = document.getElementById('liveClawnchPrice');
        if (liveEl2) liveEl2.textContent = 'unavailable';
    }
})();
