// Inclawbate — Overview Dashboard

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    return Math.floor(days / 30) + 'mo ago';
}

// Animated counter
function animateValue(el, target, duration) {
    if (target === 0) { el.textContent = '0'; return; }
    const start = 0;
    const startTime = performance.now();

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (target - start) * eased);

        if (target >= 1000000) {
            el.textContent = (current / 1000000).toFixed(1) + 'M';
        } else if (target >= 10000) {
            el.textContent = (current / 1000).toFixed(1) + 'K';
        } else {
            el.textContent = current.toLocaleString();
        }

        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

(async function() {
    // Fetch stats and rewards in parallel
    const [statsRes, rewardsRes] = await Promise.all([
        fetch('/api/inclawbate/stats').then(r => r.json()).catch(() => null),
        fetch('/api/inclawbate/rewards').then(r => r.json()).catch(() => null)
    ]);

    if (!statsRes) {
        document.getElementById('lastUpdated').textContent = 'Failed to load metrics';
        return;
    }

    const now = new Date();
    document.getElementById('lastUpdated').textContent =
        'Live data \u00b7 ' + now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // ── KPI Counters ──
    animateValue(document.getElementById('kpiHumans'), statsRes.total_humans || 0, 1200);
    animateValue(document.getElementById('kpiWallets'), statsRes.wallets_connected || 0, 1400);
    animateValue(document.getElementById('kpiClawnch'), Math.round(statsRes.total_clawnch || 0), 1600);
    animateValue(document.getElementById('kpiHires'), statsRes.total_hires || 0, 1300);

    // ── Top Skills ──
    const skillsList = document.getElementById('skillsList');
    const skills = statsRes.top_skills || [];
    if (skills.length === 0) {
        skillsList.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">No skills tracked yet</p>';
    } else {
        const maxCount = skills[0].count || 1;
        skillsList.innerHTML = skills.slice(0, 8).map(function(s) {
            const pct = Math.round((s.count / maxCount) * 100);
            return '<div class="ov-skill-row">' +
                '<span class="ov-skill-name">' + esc(s.skill) + '</span>' +
                '<div class="ov-skill-bar-track"><div class="ov-skill-bar" data-width="' + pct + '"></div></div>' +
                '<span class="ov-skill-count">' + s.count + '</span>' +
            '</div>';
        }).join('');

        // Animate bars after render
        requestAnimationFrame(function() {
            skillsList.querySelectorAll('.ov-skill-bar').forEach(function(bar) {
                bar.style.width = bar.dataset.width + '%';
            });
        });
    }

    // ── Recent Signups ──
    const signupsList = document.getElementById('signupsList');
    const signups = statsRes.recent_signups || [];
    if (signups.length === 0) {
        signupsList.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">No signups yet</p>';
    } else {
        signupsList.innerHTML = signups.map(function(u) {
            const avatar = u.x_avatar_url
                ? '<img class="ov-signup-avatar" src="' + esc(u.x_avatar_url) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
                : '<div class="ov-signup-avatar"></div>';
            const name = u.x_name || u.x_handle;
            const ago = timeAgo(u.created_at);
            return '<a href="/u/' + encodeURIComponent(u.x_handle) + '" class="ov-signup-row" style="text-decoration:none;color:inherit;">' +
                avatar +
                '<div class="ov-signup-info">' +
                    '<div class="ov-signup-name">' + esc(name) + '</div>' +
                    '<div class="ov-signup-handle">@' + esc(u.x_handle) + '</div>' +
                '</div>' +
                '<span class="ov-signup-time">' + ago + '</span>' +
            '</a>';
        }).join('');
    }

    // ── Top Earners ──
    const earnersList = document.getElementById('earnersList');
    const earners = statsRes.top_earners || [];
    if (earners.length === 0) {
        earnersList.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">No earnings yet</p>';
    } else {
        const rankClasses = ['gold', 'silver', 'bronze'];
        earnersList.innerHTML = earners.map(function(e, i) {
            const rc = i < 3 ? rankClasses[i] : '';
            const avatar = e.x_avatar_url
                ? '<img class="ov-earner-avatar" src="' + esc(e.x_avatar_url) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
                : '<div class="ov-earner-avatar"></div>';
            const amt = Math.round(Number(e.total_paid) || 0).toLocaleString();
            return '<a href="/u/' + encodeURIComponent(e.x_handle) + '" class="ov-earner-row" style="text-decoration:none;color:inherit;">' +
                '<span class="ov-earner-rank ' + rc + '">' + (i + 1) + '</span>' +
                avatar +
                '<div class="ov-earner-info">' +
                    '<div class="ov-earner-name">' + esc(e.x_name || e.x_handle) + '</div>' +
                '</div>' +
                '<span class="ov-earner-amount">' + amt + ' CLAWNCH</span>' +
            '</a>';
        }).join('');
    }

    // ── Rewards Pool ──
    const rewardsInfo = document.getElementById('rewardsInfo');
    if (!rewardsRes) {
        rewardsInfo.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">Rewards not configured</p>';
    } else {
        const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();
        rewardsInfo.innerHTML =
            '<div class="ov-rewards-pool">' + fmt(rewardsRes.current_pool) + ' CLAWNCH</div>' +
            '<div class="ov-rewards-sub">Top ' + (rewardsRes.top_n || 10) + ' humans split the pool weekly</div>' +
            '<div class="ov-rewards-stat-row">' +
                '<div class="ov-rewards-stat">' +
                    '<span class="ov-rewards-stat-val">' + fmt(rewardsRes.last_distributed) + '</span>' +
                    '<span class="ov-rewards-stat-label">Last Week</span>' +
                '</div>' +
                '<div class="ov-rewards-stat">' +
                    '<span class="ov-rewards-stat-val">' + fmt(rewardsRes.next_pool) + '</span>' +
                    '<span class="ov-rewards-stat-label">Next Week</span>' +
                '</div>' +
                '<div class="ov-rewards-stat">' +
                    '<span class="ov-rewards-stat-val">' + fmt(rewardsRes.total_distributed) + '</span>' +
                    '<span class="ov-rewards-stat-label">All Time</span>' +
                '</div>' +
            '</div>';
    }
})();
