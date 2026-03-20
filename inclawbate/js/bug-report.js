// Bug Report Widget — floating button on every page
// Requires wallet connection via nav-auth.js (reads inclawbate_profile from localStorage)

(function() {
'use strict';

var API = '/api/inclawbate/bug-report';

function getWallet() {
    try {
        var profile = JSON.parse(localStorage.getItem('inclawbate_profile') || 'null');
        return profile && profile.wallet_address ? profile.wallet_address : null;
    } catch (e) { return null; }
}

function inject() {
    // ── Styles ──
    var style = document.createElement('style');
    style.textContent = ''
        + '.br-fab {'
        + '  position: fixed; bottom: 20px; right: 20px; z-index: 9999;'
        + '  width: 48px; height: 48px; border-radius: 50%;'
        + '  background: linear-gradient(135deg, #6366f1, #8b5cf6);'
        + '  border: none; cursor: pointer; display: flex;'
        + '  align-items: center; justify-content: center;'
        + '  box-shadow: 0 4px 16px rgba(99,102,241,0.4);'
        + '  transition: transform 0.15s, box-shadow 0.15s;'
        + '  font-size: 20px; color: #fff;'
        + '}'
        + '.br-fab:hover { transform: scale(1.1); box-shadow: 0 6px 24px rgba(99,102,241,0.5); }'
        + '.br-fab.open { transform: rotate(45deg); }'
        + '.br-panel {'
        + '  position: fixed; bottom: 80px; right: 20px; z-index: 9998;'
        + '  width: 320px; max-width: calc(100vw - 40px);'
        + '  background: #12121a; border: 1px solid rgba(255,255,255,0.08);'
        + '  border-radius: 16px; padding: 20px;'
        + '  box-shadow: 0 8px 32px rgba(0,0,0,0.6);'
        + '  display: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;'
        + '}'
        + '.br-panel.visible { display: block; animation: brSlide 0.2s ease-out; }'
        + '@keyframes brSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }'
        + '.br-title {'
        + '  font-size: 0.95rem; font-weight: 800; color: #f0f0f5;'
        + '  margin-bottom: 4px;'
        + '}'
        + '.br-subtitle {'
        + '  font-size: 0.72rem; color: #888; margin-bottom: 14px;'
        + '}'
        + '.br-cats {'
        + '  display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;'
        + '}'
        + '.br-cat {'
        + '  font-size: 0.68rem; font-weight: 600; padding: 4px 10px;'
        + '  border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);'
        + '  background: rgba(255,255,255,0.04); color: #aaa;'
        + '  cursor: pointer; transition: all 0.15s;'
        + '}'
        + '.br-cat:hover { border-color: rgba(99,102,241,0.4); color: #c4b5fd; }'
        + '.br-cat.active { background: rgba(99,102,241,0.15); border-color: #6366f1; color: #a78bfa; }'
        + '.br-textarea {'
        + '  width: 100%; min-height: 80px; max-height: 200px; resize: vertical;'
        + '  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);'
        + '  border-radius: 10px; padding: 10px 12px;'
        + '  font-family: inherit; font-size: 0.82rem; color: #e0e0e5;'
        + '  outline: none; transition: border-color 0.15s;'
        + '  box-sizing: border-box;'
        + '}'
        + '.br-textarea:focus { border-color: #6366f1; }'
        + '.br-textarea::placeholder { color: #555; }'
        + '.br-send {'
        + '  margin-top: 10px; width: 100%; padding: 10px;'
        + '  background: linear-gradient(135deg, #6366f1, #8b5cf6);'
        + '  color: #fff; border: none; border-radius: 10px;'
        + '  font-size: 0.82rem; font-weight: 700; cursor: pointer;'
        + '  transition: opacity 0.15s;'
        + '}'
        + '.br-send:hover { opacity: 0.9; }'
        + '.br-send:disabled { opacity: 0.4; cursor: not-allowed; }'
        + '.br-msg {'
        + '  font-size: 0.72rem; margin-top: 8px; text-align: center;'
        + '}'
        + '.br-msg.success { color: #4ade80; }'
        + '.br-msg.error { color: #f87171; }'
        + '.br-connect {'
        + '  text-align: center; padding: 16px 0; color: #888; font-size: 0.8rem;'
        + '}'
        + '.br-connect a {'
        + '  color: #818cf8; cursor: pointer; text-decoration: underline;'
        + '}';
    document.head.appendChild(style);

    // ── FAB Button ──
    var fab = document.createElement('button');
    fab.className = 'br-fab';
    fab.innerHTML = '&#128027;'; // bug emoji
    fab.title = 'Report a bug';
    document.body.appendChild(fab);

    // ── Panel ──
    var panel = document.createElement('div');
    panel.className = 'br-panel';
    panel.innerHTML = ''
        + '<div class="br-title">Report an Issue</div>'
        + '<div class="br-subtitle">Found something wrong? Let us know — CLAWS rewards for valid reports!</div>'
        + '<div id="brBody"></div>';
    document.body.appendChild(panel);

    var isOpen = false;

    fab.addEventListener('click', function() {
        isOpen = !isOpen;
        fab.classList.toggle('open', isOpen);
        panel.classList.toggle('visible', isOpen);
        if (isOpen) renderBody();
    });

    // Close on outside click
    document.addEventListener('click', function(e) {
        if (isOpen && !panel.contains(e.target) && e.target !== fab) {
            isOpen = false;
            fab.classList.remove('open');
            panel.classList.remove('visible');
        }
    });

    var selectedCat = 'bug';

    function renderBody() {
        var body = document.getElementById('brBody');
        var wallet = getWallet();

        if (!wallet) {
            body.innerHTML = '<div class="br-connect">Connect your wallet to submit reports.<br><a onclick="if(window.navWalletConnect)window.navWalletConnect()">Connect Wallet</a></div>';
            return;
        }

        body.innerHTML = ''
            + '<div class="br-cats">'
            + '  <button class="br-cat active" data-cat="bug">&#128027; Bug</button>'
            + '  <button class="br-cat" data-cat="ui">&#127912; UI Issue</button>'
            + '  <button class="br-cat" data-cat="security">&#128274; Security</button>'
            + '  <button class="br-cat" data-cat="other">&#128221; Other</button>'
            + '</div>'
            + '<textarea class="br-textarea" id="brText" placeholder="Describe the issue... What happened? What did you expect?"></textarea>'
            + '<button class="br-send" id="brSend">Submit Report</button>'
            + '<div class="br-msg" id="brMsg"></div>';

        selectedCat = 'bug';

        body.querySelectorAll('.br-cat').forEach(function(btn) {
            btn.addEventListener('click', function() {
                body.querySelectorAll('.br-cat').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                selectedCat = btn.dataset.cat;
            });
        });

        document.getElementById('brSend').addEventListener('click', submit);
    }

    async function submit() {
        var wallet = getWallet();
        var text = document.getElementById('brText');
        var btn = document.getElementById('brSend');
        var msg = document.getElementById('brMsg');

        if (!wallet) { msg.className = 'br-msg error'; msg.textContent = 'Connect wallet first'; return; }
        if (!text.value.trim()) { msg.className = 'br-msg error'; msg.textContent = 'Please describe the issue'; return; }

        btn.disabled = true;
        btn.textContent = 'Sending...';
        msg.textContent = '';

        try {
            var res = await fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: wallet,
                    page: window.location.pathname,
                    message: text.value.trim(),
                    category: selectedCat
                })
            });
            var data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to send');

            msg.className = 'br-msg success';
            msg.textContent = 'Sent! Thank you — CLAWS rewards for valid reports 🦞';
            text.value = '';

            setTimeout(function() {
                isOpen = false;
                fab.classList.remove('open');
                panel.classList.remove('visible');
            }, 2500);

        } catch (e) {
            msg.className = 'br-msg error';
            msg.textContent = e.message;
        }

        btn.disabled = false;
        btn.textContent = 'Submit Report';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
} else {
    inject();
}

})();
