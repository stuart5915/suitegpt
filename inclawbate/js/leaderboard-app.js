(async function() {
    const list = document.getElementById('leaderboardList');

    try {
        const res = await fetch('/api/inclawbate/leaderboard');
        const { leaderboard } = await res.json();

        if (!leaderboard || leaderboard.length === 0) {
            list.innerHTML = '<div class="lb-empty"><p>No replies generated yet. Be the first!</p></div>';
            return;
        }

        list.innerHTML = leaderboard.map(function(user) {
            var rankClass = user.rank <= 3 ? ' lb-rank-' + user.rank : '';
            var avatar = user.x_avatar_url || '';
            var name = user.x_name || user.x_handle;
            var handle = user.x_handle;
            var replies = user.total_replies.toLocaleString();

            return '<a href="/u/' + encodeURIComponent(handle) + '" class="lb-row">' +
                '<div class="lb-rank' + rankClass + '">' + user.rank + '</div>' +
                (avatar ? '<img class="lb-avatar" src="' + avatar + '" alt="" loading="lazy">' : '<div class="lb-avatar"></div>') +
                '<div class="lb-info">' +
                    '<div class="lb-name">' + escapeHtml(name) + '</div>' +
                    '<div class="lb-handle">@' + escapeHtml(handle) + '</div>' +
                '</div>' +
                '<div class="lb-replies">' + replies + ' replies</div>' +
            '</a>';
        }).join('');

    } catch (err) {
        console.error('Leaderboard fetch error:', err);
        list.innerHTML = '<div class="lb-empty"><p>Failed to load leaderboard.</p></div>';
    }
})();

function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
