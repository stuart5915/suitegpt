// Leaderboard + Weekly Rewards
(async function() {
    const list = document.getElementById('leaderboardList');

    // Load rewards config and leaderboard in parallel
    const [rewardsRes, lbRes] = await Promise.all([
        fetch('/api/inclawbate/rewards').then(r => r.json()).catch(() => null),
        fetch('/api/inclawbate/leaderboard').then(r => r.json()).catch(() => null)
    ]);

    // ── Rewards Banner ──
    if (rewardsRes) {
        const banner = document.getElementById('rewardsBanner');
        banner.style.display = '';

        const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();

        document.getElementById('rewardsPool').textContent = fmt(rewardsRes.current_pool) + ' CLAWNCH';
        document.getElementById('rewardsTopN').textContent = rewardsRes.top_n || 10;
        document.getElementById('statLastWeek').textContent = fmt(rewardsRes.last_distributed);
        document.getElementById('statThisWeek').textContent = fmt(rewardsRes.current_pool);
        document.getElementById('statNextWeek').textContent = fmt(rewardsRes.next_pool);
        document.getElementById('statTotal').textContent = fmt(rewardsRes.total_distributed);

        // Countdown
        if (rewardsRes.week_ends_at) {
            const endTime = new Date(rewardsRes.week_ends_at).getTime();
            const cdDays = document.getElementById('cdDays');
            const cdHours = document.getElementById('cdHours');
            const cdMins = document.getElementById('cdMins');
            const cdSecs = document.getElementById('cdSecs');
            const countdownEl = document.getElementById('countdown');

            function tick() {
                const now = Date.now();
                const diff = endTime - now;

                if (diff <= 0) {
                    countdownEl.innerHTML = '<div class="countdown-ended">Week ended — rewards distributing soon!</div>';
                    return;
                }

                const d = Math.floor(diff / 86400000);
                const h = Math.floor((diff % 86400000) / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                const s = Math.floor((diff % 60000) / 1000);

                cdDays.textContent = d;
                cdHours.textContent = String(h).padStart(2, '0');
                cdMins.textContent = String(m).padStart(2, '0');
                cdSecs.textContent = String(s).padStart(2, '0');

                requestAnimationFrame(tick);
            }
            tick();
        }
    }

    // ── Leaderboard ──
    if (!lbRes || !lbRes.leaderboard || lbRes.leaderboard.length === 0) {
        list.innerHTML = '<div class="lb-empty"><p>No replies generated yet. Be the first!</p></div>';
        return;
    }

    list.innerHTML = lbRes.leaderboard.map(function(user) {
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

function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
