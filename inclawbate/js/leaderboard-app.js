// Inclawbator — Leaderboard + Pricing

var CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
var TARGET_USD_PER_CREDIT = 0.005;
var MIN_TOKENS_PER_CREDIT = 1;
var MAX_TOKENS_PER_CREDIT = 10000;

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
        var rawTpc = TARGET_USD_PER_CREDIT / clawnchPrice;
        var tokensPerCredit = Math.max(MIN_TOKENS_PER_CREDIT, Math.min(MAX_TOKENS_PER_CREDIT, rawTpc));
        var costPerReply = (tokensPerCredit * clawnchPrice).toFixed(4);
        var repliesPer1k = Math.floor(1000 / tokensPerCredit);
        var roundedTpc = Math.round(tokensPerCredit);

        ['pricePerReply', 'creditsPricePerReply'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.textContent = '~$' + costPerReply;
        });

        ['repliesPer1k', 'creditsRepliesPer1k'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.textContent = repliesPer1k.toLocaleString();
        });

        ['liveClawnchPrice', 'creditsLivePrice'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.textContent = '$' + clawnchPrice.toFixed(6);
        });

        // Dynamic rate displays
        ['sidebarTokensPerCredit', 'creditsTokensPerCredit', 'lbTokensPerCredit'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.textContent = roundedTpc.toLocaleString();
        });
        ['sidebarTpcLabel', 'creditsTpcLabel', 'lbTpcLabel'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.textContent = roundedTpc.toLocaleString() + ' INCLAWNCH per Credit';
        });
    } else {
        ['liveClawnchPrice', 'creditsLivePrice'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.textContent = 'unavailable';
        });
    }
})();
