// Leaderboard

function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

(async function() {
    var list = document.getElementById('leaderboardList');

    var res = await fetch('/api/inclawbate/leaderboard').then(function(r) { return r.json(); }).catch(function() { return null; });

    if (!res || !res.leaderboard || res.leaderboard.length === 0) {
        list.innerHTML = '<div class="lb-empty"><p>No replies generated yet. Be the first!</p></div>';
        return;
    }

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
})();
