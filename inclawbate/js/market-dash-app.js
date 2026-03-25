// Inclawbate — Marketing Dashboard Controller
// Per-project marketing control center

(function () {
    'use strict';

    var API_BASE = '/api/inclawbate';

    // ── DOM refs ──
    var authGate    = document.getElementById('mdAuthGate');
    var loadingEl   = document.getElementById('mdLoading');
    var pickerEl    = document.getElementById('mdPicker');
    var pickerGrid  = document.getElementById('mdPickerGrid');
    var dashEl      = document.getElementById('mdDash');
    var backBtn     = document.getElementById('mdBackBtn');

    // Header
    var headerEl    = document.getElementById('mdHeader');

    // Vitals
    var vPrice      = document.getElementById('mdVitalPrice');
    var vVol        = document.getElementById('mdVitalVol');
    var vLiq        = document.getElementById('mdVitalLiq');
    var vChange     = document.getElementById('mdVitalChange');

    // Checklist
    var checklistEl = document.getElementById('mdChecklist');
    var checkToggle = document.getElementById('mdChecklistToggle');
    var checkBody   = document.getElementById('mdChecklistBody');
    var checkProg   = document.getElementById('mdChecklistProgress');

    // Plan
    var planPanel   = document.getElementById('mdPlanPanel');
    var planForm    = document.getElementById('mdPlanForm');
    var planContent = document.getElementById('mdPlanContent');
    var planMsg     = document.getElementById('mdPlanMsg');
    var planGenBtn  = document.getElementById('mdPlanGenBtn');
    var planCopyBtn = document.getElementById('mdPlanCopyBtn');
    var planRegenBtn= document.getElementById('mdPlanRegenBtn');
    var planSaveBtn = document.getElementById('mdPlanSaveBtn');
    var planCloseBtn= document.getElementById('mdPlanCloseBtn');
    var planNameIn  = document.getElementById('mdPlanName');
    var planSymIn   = document.getElementById('mdPlanSymbol');
    var planUniqIn  = document.getElementById('mdPlanUnique');
    var planAudIn   = document.getElementById('mdPlanAudience');
    var planStatusEl= document.getElementById('mdToolPlanStatus');

    // Ideas
    var ideasPanel  = document.getElementById('mdIdeasPanel');
    var ideasList   = document.getElementById('mdIdeasList');
    var ideasRegenBtn= document.getElementById('mdIdeasRegenBtn');
    var ideasCloseBtn= document.getElementById('mdIdeasCloseBtn');

    // Socials
    var socialsPanel= document.getElementById('mdSocialsPanel');
    var socialsList = document.getElementById('mdSocialsList');

    // Bottom panels
    var earningsBody= document.getElementById('mdEarningsBody');
    var stakingBody = document.getElementById('mdStakingBody');

    // State
    var currentProject = null;
    var allProjects = [];
    var generatedPlan = '';

    // ── Helpers ──

    function getStoredAuth() {
        try {
            var token = localStorage.getItem('inclawbate_token');
            var profile = JSON.parse(localStorage.getItem('inclawbate_profile') || 'null');
            if (token && profile) return { token: token, profile: profile };
        } catch (e) {}
        return null;
    }

    function authHeaders() {
        var token = localStorage.getItem('inclawbate_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        };
    }

    function esc(str) {
        var d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function hashColor(str) {
        var h = 0;
        for (var i = 0; i < (str || '').length; i++) {
            h = str.charCodeAt(i) + ((h << 5) - h);
        }
        return 'hsl(' + (Math.abs(h) % 360) + ', 55%, 35%)';
    }

    function formatUsd(n) {
        if (!n || n <= 0) return '--';
        if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
        if (n >= 1) return '$' + n.toFixed(2);
        if (n >= 0.0001) return '$' + n.toFixed(6);
        return '$' + n.toExponential(2);
    }

    function formatPct(n) {
        if (n === null || n === undefined || isNaN(n)) return '--';
        var prefix = n >= 0 ? '+' : '';
        return prefix + n.toFixed(2) + '%';
    }

    function shortAddr(addr) {
        if (!addr || addr.length < 10) return addr || '';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    }

    function showView(name) {
        authGate.classList.add('hidden');
        loadingEl.classList.add('hidden');
        pickerEl.classList.add('hidden');
        dashEl.classList.remove('active');

        if (name === 'auth')    authGate.classList.remove('hidden');
        if (name === 'loading') loadingEl.classList.remove('hidden');
        if (name === 'picker')  pickerEl.classList.remove('hidden');
        if (name === 'dash')    dashEl.classList.add('active');
    }

    // Simple markdown-like rendering (## headings, - bullets, **bold**)
    function renderMarkdown(text) {
        if (!text) return '';
        var lines = text.split('\n');
        var html = '';
        var inList = false;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];

            // Close list if we leave bullet context
            if (inList && !line.match(/^[-*]\s/) && line.trim() !== '') {
                html += '</ul>';
                inList = false;
            }

            if (line.match(/^##\s+/)) {
                html += '<h2>' + esc(line.replace(/^##\s+/, '')) + '</h2>';
            } else if (line.match(/^[-*]\s+/)) {
                if (!inList) { html += '<ul>'; inList = true; }
                var content = line.replace(/^[-*]\s+/, '');
                // Bold
                content = esc(content).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                html += '<li>' + content + '</li>';
            } else if (line.trim() === '') {
                if (inList) { html += '</ul>'; inList = false; }
                html += '<br>';
            } else {
                var p = esc(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                html += '<p>' + p + '</p>';
            }
        }
        if (inList) html += '</ul>';
        return html;
    }

    // ── URL param parsing ──

    function getProjectParam() {
        var params = new URLSearchParams(window.location.search);
        return params.get('project') || '';
    }

    function setProjectParam(id) {
        var url = new URL(window.location);
        url.searchParams.set('project', id);
        history.pushState({}, '', url);
    }

    function clearProjectParam() {
        var url = new URL(window.location);
        url.searchParams.delete('project');
        history.pushState({}, '', url);
    }

    // ── Init ──

    function init() {
        document.body.style.opacity = '1';
        var auth = getStoredAuth();
        if (!auth || !auth.token) {
            // No auth — show picker view (empty) instead of gate
            showView('picker');
            return;
        }

        showView('loading');

        var wallet = (auth.profile.wallet_address || '').toLowerCase();
        if (!wallet) {
            // No wallet — show picker view instead of gate
            showView('picker');
            return;
        }

        fetch(API_BASE + '/inclawbator?wallet=' + encodeURIComponent(wallet))
            .then(function (r) { return r.json(); })
            .then(function (data) {
                allProjects = (data.projects || data || []).map(function (p) {
                    // Normalize: inclawbator_projects uses token_name, market-dash uses name
                    if (!p.name && p.token_name) p.name = p.token_name;
                    return p;
                });

                var pid = getProjectParam();
                if (pid) {
                    var match = allProjects.find(function (p) {
                        return p.id === pid || p.id === parseInt(pid) || p.slug === pid;
                    });
                    if (match) {
                        loadProject(match);
                        return;
                    }
                }

                if (allProjects.length === 0) {
                    showView('picker');
                    pickerGrid.innerHTML = '<div class="md-picker-empty">No projects yet. <a href="/dashboard">Create a project first</a>.</div>';
                } else if (allProjects.length === 1) {
                    loadProject(allProjects[0]);
                } else {
                    renderPicker();
                }
            })
            .catch(function () {
                showView('picker');
                pickerGrid.innerHTML = '<div class="md-picker-empty">Failed to load projects.</div>';
            });
    }

    // ── Project Picker ──

    function renderPicker() {
        showView('picker');
        var html = '';
        allProjects.forEach(function (p) {
            var logo = p.logo_url
                ? '<img class="md-picker-logo" src="' + esc(p.logo_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                  '<div class="md-picker-logo-ph" style="display:none;background:' + hashColor(p.name) + '">' + esc((p.name || '?')[0]).toUpperCase() + '</div>'
                : '<div class="md-picker-logo-ph" style="background:' + hashColor(p.name) + '">' + esc((p.name || '?')[0]).toUpperCase() + '</div>';
            html += '<div class="md-picker-card" data-pid="' + p.id + '">' +
                logo +
                '<div class="md-picker-info">' +
                    '<div class="md-picker-name">' + esc(p.name) + '</div>' +
                    '<div class="md-picker-slug">' + (p.token_symbol ? '$' + esc(p.token_symbol) : (p.slug ? '/' + esc(p.slug) : '')) + '</div>' +
                '</div>' +
            '</div>';
        });
        pickerGrid.innerHTML = html;

        pickerGrid.querySelectorAll('.md-picker-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var pid = card.getAttribute('data-pid');
                var match = allProjects.find(function (p) { return String(p.id) === String(pid); });
                if (match) loadProject(match);
            });
        });
    }

    // ── Load Project ──

    function loadProject(p) {
        currentProject = p;
        setProjectParam(p.id);
        showView('dash');

        // Close all inline panels
        planPanel.classList.remove('active');
        ideasPanel.classList.remove('active');
        socialsPanel.classList.remove('active');

        renderHeader(p);
        renderChecklist(p);
        renderToolkitStatus(p);
        renderSocials(p);
        renderEarnings(p);
        renderStaking(p);
        loadVitals(p);

        // Pre-fill plan form
        planNameIn.value = p.name || '';
        planSymIn.value = p.token_symbol || '';
        planUniqIn.value = p.description || '';
        planAudIn.value = '';

        // If plan already saved, show it
        if (p.marketing_plan) {
            generatedPlan = p.marketing_plan;
            showPlanResult(p.marketing_plan);
            planStatusEl.textContent = 'View plan';
            planStatusEl.className = 'md-tool-status active';
        } else {
            generatedPlan = '';
            planStatusEl.textContent = 'Generate';
            planStatusEl.className = 'md-tool-status info';
        }
    }

    // ── Header ──

    function renderHeader(p) {
        var logo = p.logo_url
            ? '<img class="md-header-logo" src="' + esc(p.logo_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
              '<div class="md-header-logo-ph" style="display:none;background:' + hashColor(p.name) + '">' + esc((p.name || '?')[0]).toUpperCase() + '</div>'
            : '<div class="md-header-logo-ph" style="background:' + hashColor(p.name) + '">' + esc((p.name || '?')[0]).toUpperCase() + '</div>';

        var links = '';
        if (p.token_address) {
            links += '<a href="https://dexscreener.com/base/' + p.token_address + '" target="_blank" rel="noopener" class="md-quick-link">Chart</a>';
            links += '<a href="https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=' + p.token_address + '&chain=base" target="_blank" rel="noopener" class="md-quick-link">Buy</a>';
            links += '<a href="https://basescan.org/token/' + p.token_address + '" target="_blank" rel="noopener" class="md-quick-link">Scan</a>';
        }

        headerEl.innerHTML = logo +
            '<div class="md-header-info">' +
                '<div class="md-header-row">' +
                    '<span class="md-header-name">' + esc(p.name) + '</span>' +
                    (p.token_symbol ? '<span class="md-header-symbol">$' + esc(p.token_symbol) + '</span>' : '') +
                    (p.token_address ? '<span class="md-chain-badge">Base</span>' : '') +
                '</div>' +
                (links ? '<div class="md-header-links" style="margin-top:6px">' + links + '</div>' : '') +
            '</div>';
    }

    // ── Vitals ──

    function loadVitals(p) {
        vPrice.textContent = '--';
        vVol.textContent = '--';
        vLiq.textContent = '--';
        vChange.textContent = '--';
        vChange.className = 'md-vital-value';

        if (!p.token_address) return;

        fetch('https://api.dexscreener.com/latest/dex/tokens/' + p.token_address)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var pairs = data.pairs || [];
                if (!pairs.length) return;

                // Use the pair with highest liquidity
                pairs.sort(function (a, b) {
                    return (b.liquidity && b.liquidity.usd || 0) - (a.liquidity && a.liquidity.usd || 0);
                });
                var pair = pairs[0];

                var price = parseFloat(pair.priceUsd || 0);
                var vol = pair.volume && pair.volume.h24 ? pair.volume.h24 : 0;
                var liq = pair.liquidity && pair.liquidity.usd ? pair.liquidity.usd : 0;
                var change = pair.priceChange && pair.priceChange.h24 !== undefined ? pair.priceChange.h24 : null;

                vPrice.textContent = formatUsd(price);
                vVol.textContent = formatUsd(vol);
                vLiq.textContent = formatUsd(liq);

                if (change !== null) {
                    vChange.textContent = formatPct(change);
                    vChange.className = 'md-vital-value ' + (change >= 0 ? 'positive' : 'negative');
                }
            })
            .catch(function () {
                // silent fail
            });
    }

    // ── Checklist ──

    function renderChecklist(p) {
        var items = [
            { label: 'Token launched', done: !!p.token_address, link: '/tools#launch', linkText: 'Launch' },
            { label: 'Staking pool created', done: !!p.staking_address, link: '/tools#pool', linkText: 'Create' },
            { label: 'Socials connected', done: !!(p.x_handle || p.telegram_url || p.website_url), link: '/tools#socials', linkText: 'Connect' },
            { label: 'Marketing plan generated', done: !!p.marketing_plan, link: null, linkText: 'Generate' },
            { label: 'AI Agent active', done: false, link: '/inclawbator#agent', linkText: 'Setup' },
        ];

        var doneCount = items.filter(function (i) { return i.done; }).length;
        checkProg.textContent = doneCount + '/' + items.length;

        var html = '';
        items.forEach(function (item) {
            html += '<div class="md-check-item">' +
                '<div class="md-check-icon ' + (item.done ? 'done' : 'pending') + '">' +
                    (item.done ? '&#10003;' : '') +
                '</div>' +
                '<span class="md-check-label' + (item.done ? ' done' : '') + '">' + esc(item.label) + '</span>' +
                (!item.done && item.link ? '<a href="' + item.link + '" class="md-check-link">' + esc(item.linkText) + ' &rarr;</a>' : '') +
            '</div>';
        });
        checkBody.innerHTML = html;

        // Item for "Generate marketing plan" should trigger plan panel instead
        var planItem = checkBody.querySelectorAll('.md-check-item')[3];
        if (planItem && !p.marketing_plan) {
            var planLink = planItem.querySelector('.md-check-link');
            if (!planLink) {
                // Add inline link
                var a = document.createElement('a');
                a.href = '#';
                a.className = 'md-check-link';
                a.textContent = 'Generate';
                a.innerHTML += ' &rarr;';
                a.addEventListener('click', function (e) {
                    e.preventDefault();
                    openPlanPanel();
                });
                planItem.appendChild(a);
            }
        }
    }

    // ── Toolkit Status ──

    function renderToolkitStatus(p) {
        // Socials status
        var socialsStatusEl = document.getElementById('mdToolSocialsStatus');
        var connectedCount = 0;
        if (p.x_handle) connectedCount++;
        if (p.telegram_url) connectedCount++;
        if (p.website_url) connectedCount++;
        if (connectedCount > 0) {
            socialsStatusEl.textContent = connectedCount + '/3 linked';
            socialsStatusEl.className = 'md-tool-status active';
        } else {
            socialsStatusEl.textContent = 'None linked';
            socialsStatusEl.className = 'md-tool-status inactive';
        }

        // Agent status
        var agentStatusEl = document.getElementById('mdToolAgentStatus');
        // For now, agents are not yet integrated — placeholder
        agentStatusEl.textContent = 'Not active';
        agentStatusEl.className = 'md-tool-status inactive';
    }

    // ── Socials Panel ──

    function renderSocials(p) {
        var rows = [
            { name: 'X (Twitter)', value: p.x_handle ? '@' + p.x_handle : null, url: p.x_handle ? 'https://x.com/' + p.x_handle : null },
            { name: 'Telegram', value: p.telegram_url || null, url: p.telegram_url || null },
            { name: 'Website', value: p.website_url || null, url: p.website_url || null },
        ];

        var html = '';
        rows.forEach(function (r) {
            html += '<div class="md-social-row">' +
                '<span class="md-social-name">' + esc(r.name) + '</span>' +
                '<span class="md-social-value' + (r.value ? '' : ' empty') + '">' +
                    (r.value && r.url
                        ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.value) + '</a>'
                        : (r.value ? esc(r.value) : 'Not connected')) +
                '</span>' +
            '</div>';
        });
        socialsList.innerHTML = html;
    }

    // ── Earnings ──

    function renderEarnings(p) {
        if (!p.token_address) {
            earningsBody.innerHTML = '<p class="md-empty-msg">No token linked. <a href="/tools#launch" style="color:var(--lobster-300)">Launch a token</a></p>';
            return;
        }

        earningsBody.innerHTML =
            '<div class="md-earn-row">' +
                '<span class="md-earn-label">Token</span>' +
                '<span class="md-earn-value">' + (p.token_symbol ? '$' + esc(p.token_symbol) : shortAddr(p.token_address)) + '</span>' +
            '</div>' +
            '<div class="md-earn-row">' +
                '<span class="md-earn-label">LP Fee Balance</span>' +
                '<span class="md-earn-value accent" id="mdLpBalance">Loading...</span>' +
            '</div>' +
            '<button class="md-claim-btn" id="mdClaimFeeBtn">Claim LP Fees</button>';

        // Load LP fee earnings from DexScreener pair data
        loadLpFees(p);

        var claimBtn = document.getElementById('mdClaimFeeBtn');
        if (claimBtn) {
            claimBtn.addEventListener('click', function () {
                // Redirect to clanker claim page
                window.open('https://www.clanker.world/clanker/' + p.token_address, '_blank');
            });
        }
    }

    function loadLpFees(p) {
        var balEl = document.getElementById('mdLpBalance');
        if (!balEl) return;

        // We show a link to clanker for actual claim — show as info
        balEl.textContent = 'View on Clanker';
        balEl.style.cursor = 'pointer';
        balEl.addEventListener('click', function () {
            window.open('https://www.clanker.world/clanker/' + p.token_address, '_blank');
        });
    }

    // ── Staking ──

    function renderStaking(p) {
        if (!p.staking_address) {
            stakingBody.innerHTML = '<p class="md-empty-msg">No staking pool. <a href="/tools#pool" style="color:var(--lobster-300)">Create one</a></p>';
            return;
        }

        stakingBody.innerHTML =
            '<div class="md-staking-stat">' +
                '<span class="md-staking-label">Pool Address</span>' +
                '<span class="md-staking-value"><a href="https://basescan.org/address/' + p.staking_address + '" target="_blank" rel="noopener" style="color:var(--lobster-300)">' + shortAddr(p.staking_address) + '</a></span>' +
            '</div>' +
            '<div class="md-staking-stat">' +
                '<span class="md-staking-label">Stake Token</span>' +
                '<span class="md-staking-value">' + (p.token_symbol ? '$' + esc(p.token_symbol) : '--') + '</span>' +
            '</div>' +
            '<div class="md-staking-stat">' +
                '<span class="md-staking-label">Status</span>' +
                '<span class="md-staking-value" style="color:var(--seafoam-400)">Active</span>' +
            '</div>';

        if (p.token_symbol) {
            stakingBody.innerHTML += '<a href="/stake/' + p.token_symbol.toLowerCase() + '" style="display:block;margin-top:var(--space-md);text-align:center;font-family:var(--font-mono);font-size:0.74rem;font-weight:600;color:var(--lobster-300)">View pool details &rarr;</a>';
        }
    }

    // ── Marketing Plan ──

    function openPlanPanel() {
        planPanel.classList.add('active');
        ideasPanel.classList.remove('active');
        socialsPanel.classList.remove('active');

        if (generatedPlan) {
            showPlanResult(generatedPlan);
        } else {
            planForm.style.display = 'block';
            planContent.style.display = 'none';
            planContent.innerHTML = '';
            planCopyBtn.style.display = 'none';
            planRegenBtn.style.display = 'none';
            planSaveBtn.style.display = 'none';
        }

        planPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function showPlanResult(planText) {
        planForm.style.display = 'none';
        planContent.style.display = 'block';
        planContent.innerHTML = renderMarkdown(planText);
        planCopyBtn.style.display = 'inline-block';
        planRegenBtn.style.display = 'inline-block';

        // Only show save if not yet saved
        if (currentProject && !currentProject.marketing_plan) {
            planSaveBtn.style.display = 'inline-block';
        } else if (currentProject && currentProject.marketing_plan !== planText) {
            planSaveBtn.style.display = 'inline-block';
        } else {
            planSaveBtn.style.display = 'none';
        }
    }

    function generatePlan() {
        var name = planNameIn.value.trim();
        var symbol = planSymIn.value.trim();
        if (!name || !symbol) {
            showPlanMsg('error', 'Project name and symbol are required.');
            return;
        }

        planGenBtn.disabled = true;
        planGenBtn.textContent = 'Generating...';
        hidePlanMsg();

        fetch(API_BASE + '/generate-marketing', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                projectName: name,
                tokenSymbol: symbol,
                uniqueValue: planUniqIn.value.trim(),
                targetAudience: planAudIn.value.trim()
            })
        })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
            planGenBtn.disabled = false;
            planGenBtn.textContent = 'Generate Plan';

            if (!res.ok || !res.data.plan) {
                showPlanMsg('error', res.data.error || 'Failed to generate plan.');
                return;
            }

            generatedPlan = res.data.plan;
            showPlanResult(generatedPlan);
            planStatusEl.textContent = 'View plan';
            planStatusEl.className = 'md-tool-status active';
        })
        .catch(function () {
            planGenBtn.disabled = false;
            planGenBtn.textContent = 'Generate Plan';
            showPlanMsg('error', 'Network error. Try again.');
        });
    }

    function savePlan() {
        if (!currentProject || !generatedPlan) return;
        planSaveBtn.disabled = true;
        planSaveBtn.textContent = 'Saving...';

        fetch(API_BASE + '/inclawbator', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                action: 'update-project',
                project_id: currentProject.id,
                marketing_plan: generatedPlan
            })
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            planSaveBtn.disabled = false;
            planSaveBtn.textContent = 'Save';
            if (data.project || data.success) {
                currentProject.marketing_plan = generatedPlan;
                planSaveBtn.style.display = 'none';
                showPlanMsg('success', 'Plan saved.');
                renderChecklist(currentProject);
            } else {
                showPlanMsg('error', data.error || 'Failed to save.');
            }
        })
        .catch(function () {
            planSaveBtn.disabled = false;
            planSaveBtn.textContent = 'Save';
            showPlanMsg('error', 'Network error.');
        });
    }

    function regeneratePlan() {
        planForm.style.display = 'block';
        planContent.style.display = 'none';
        planCopyBtn.style.display = 'none';
        planRegenBtn.style.display = 'none';
        planSaveBtn.style.display = 'none';
        hidePlanMsg();
    }

    function copyPlan() {
        if (!generatedPlan) return;
        navigator.clipboard.writeText(generatedPlan).then(function () {
            planCopyBtn.textContent = 'Copied!';
            setTimeout(function () { planCopyBtn.textContent = 'Copy'; }, 1500);
        });
    }

    function showPlanMsg(type, text) {
        planMsg.style.display = 'block';
        planMsg.className = 'md-plan-msg ' + type;
        planMsg.textContent = text;
        setTimeout(hidePlanMsg, 4000);
    }

    function hidePlanMsg() {
        planMsg.style.display = 'none';
    }

    // ── Content Ideas ──

    function openIdeasPanel() {
        ideasPanel.classList.add('active');
        planPanel.classList.remove('active');
        socialsPanel.classList.remove('active');
        generateIdeas();
        ideasPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function generateIdeas() {
        if (!currentProject) return;
        ideasList.innerHTML = '<p style="text-align:center;color:var(--text-dim);font-size:0.82rem;padding:var(--space-md) 0">Generating ideas...</p>';
        ideasRegenBtn.disabled = true;

        var prompt = 'Generate 5 short tweet ideas (under 280 chars each) for the project: ' +
            (currentProject.name || 'Unknown') +
            (currentProject.token_symbol ? ' ($' + currentProject.token_symbol + ')' : '') +
            '. ' + (currentProject.description || '') +
            '\n\nReturn ONLY 5 tweets, one per line, numbered 1-5. No extra text.';

        fetch(API_BASE + '/generate-marketing', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                projectName: currentProject.name || 'Project',
                tokenSymbol: currentProject.token_symbol || 'TOKEN',
                uniqueValue: (currentProject.description || '') + '\n\nINSTRUCTION: Instead of a marketing plan, generate 5 tweet ideas (under 280 chars each). Number them 1-5, one per line. No headers, no extra text.',
                targetAudience: 'Crypto twitter'
            })
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            ideasRegenBtn.disabled = false;
            if (!data.plan) {
                ideasList.innerHTML = '<p style="text-align:center;color:#ef4444;font-size:0.82rem;padding:var(--space-md) 0">Failed to generate ideas.</p>';
                return;
            }
            renderIdeas(data.plan);
        })
        .catch(function () {
            ideasRegenBtn.disabled = false;
            ideasList.innerHTML = '<p style="text-align:center;color:#ef4444;font-size:0.82rem;padding:var(--space-md) 0">Network error.</p>';
        });
    }

    function renderIdeas(text) {
        // Parse numbered lines
        var lines = text.split('\n').filter(function (l) { return l.trim().length > 0; });
        var ideas = [];
        lines.forEach(function (line) {
            var clean = line.replace(/^\d+[\.\)]\s*/, '').trim();
            if (clean.length > 10 && clean.length < 350) {
                ideas.push(clean);
            }
        });

        // Take first 5
        ideas = ideas.slice(0, 5);

        if (!ideas.length) {
            ideasList.innerHTML = '<p style="text-align:center;color:var(--text-dim);font-size:0.82rem;padding:var(--space-md) 0">Could not parse ideas. Try regenerating.</p>';
            return;
        }

        var html = '';
        ideas.forEach(function (idea, idx) {
            html += '<div class="md-idea-item">' +
                '<span class="md-idea-num">' + (idx + 1) + '</span>' +
                '<span class="md-idea-text">' + esc(idea) + '</span>' +
                '<button class="md-idea-copy" data-text="' + esc(idea).replace(/"/g, '&quot;') + '">Copy</button>' +
            '</div>';
        });
        ideasList.innerHTML = html;

        ideasList.querySelectorAll('.md-idea-copy').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var text = btn.getAttribute('data-text');
                // Decode HTML entities
                var d = document.createElement('div');
                d.innerHTML = text;
                navigator.clipboard.writeText(d.textContent).then(function () {
                    btn.textContent = 'Copied!';
                    btn.classList.add('copied');
                    setTimeout(function () {
                        btn.textContent = 'Copy';
                        btn.classList.remove('copied');
                    }, 1500);
                });
            });
        });
    }

    // ── Event Listeners ──

    // Back button
    backBtn.addEventListener('click', function () {
        currentProject = null;
        clearProjectParam();
        if (allProjects.length > 1) {
            renderPicker();
        } else {
            init();
        }
    });

    // Checklist toggle
    checkToggle.addEventListener('click', function () {
        checklistEl.classList.toggle('open');
    });

    // Toolkit card clicks
    document.getElementById('mdToolPlan').addEventListener('click', function () {
        openPlanPanel();
    });

    document.getElementById('mdToolSocials').addEventListener('click', function () {
        socialsPanel.classList.toggle('active');
        planPanel.classList.remove('active');
        ideasPanel.classList.remove('active');
        if (socialsPanel.classList.contains('active')) {
            socialsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    document.getElementById('mdToolAgent').addEventListener('click', function () {
        window.location.href = '/inclawbator#agent';
    });

    document.getElementById('mdToolDisperse').addEventListener('click', function () {
        window.location.href = '/tools#disperse';
    });

    document.getElementById('mdToolIdeas').addEventListener('click', function () {
        openIdeasPanel();
    });

    document.getElementById('mdToolShare').addEventListener('click', function () {
        if (!currentProject) return;
        var url = window.location.origin + '/market-dash?project=' + currentProject.id;
        var statusEl = document.getElementById('mdToolShareStatus');
        navigator.clipboard.writeText(url).then(function () {
            statusEl.textContent = 'Copied!';
            statusEl.className = 'md-tool-status active';
            setTimeout(function () {
                statusEl.textContent = 'Copy link';
                statusEl.className = 'md-tool-status info';
            }, 2000);
        }).catch(function () {
            // Fallback
            window.open('/market-dash?project=' + currentProject.id, '_blank');
        });
    });

    // Plan buttons
    planGenBtn.addEventListener('click', generatePlan);
    planCopyBtn.addEventListener('click', copyPlan);
    planRegenBtn.addEventListener('click', regeneratePlan);
    planSaveBtn.addEventListener('click', savePlan);
    planCloseBtn.addEventListener('click', function () {
        planPanel.classList.remove('active');
    });

    // Ideas buttons
    ideasRegenBtn.addEventListener('click', generateIdeas);
    ideasCloseBtn.addEventListener('click', function () {
        ideasPanel.classList.remove('active');
    });

    // Listen for wallet connect event (in case user connects after page load)
    window.addEventListener('inclawbate:auth', function () {
        init();
    });

    // Handle popstate for back/forward
    window.addEventListener('popstate', function () {
        var pid = getProjectParam();
        if (pid && allProjects.length) {
            var match = allProjects.find(function (p) {
                return String(p.id) === String(pid) || p.slug === pid;
            });
            if (match) {
                loadProject(match);
                return;
            }
        }
        if (allProjects.length > 1) {
            renderPicker();
        } else {
            init();
        }
    });

    // ── Boot ──
    init();

})();
