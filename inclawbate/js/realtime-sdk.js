// Realtime SDK — auto-injected into every app served by Inclawbate
// Exposes window.Realtime for multiplayer: broadcast messaging + presence tracking
// Powered by Supabase Realtime (no custom server needed)
(function() {
    'use strict';

    var SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2MzU4MTEsImV4cCI6MjA0OTIxMTgxMX0.G9OJ1lGVn1QPBK4F5kl_K1ILp-eoKCGiAAdZbzQ38c4';
    var CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    var RATE_LIMIT_MS = 50; // 20 msg/sec
    var MAX_PAYLOAD = 8192;

    var scriptTag = document.currentScript || document.querySelector('script[data-app-id]');
    var appId = scriptTag ? scriptTag.getAttribute('data-app-id') : 'unknown';

    // Persistent player ID per app
    var storageKey = '_rt_pid_' + appId;
    var playerId = localStorage.getItem(storageKey);
    if (!playerId) {
        playerId = 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(storageKey, playerId);
    }

    var supabaseClient = null;
    var channel = null;
    var connected = false;
    var lastSend = 0;
    var listeners = {};       // event -> [callback, ...]
    var joinCbs = [];
    var leaveCbs = [];
    var presenceState = {};   // key -> [{id, ...state}]

    function loadSupabase() {
        if (window.supabase) return Promise.resolve();
        return new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            s.src = CDN;
            s.onload = resolve;
            s.onerror = function() { reject(new Error('Failed to load Supabase client')); };
            document.head.appendChild(s);
        });
    }

    function fireEvent(event, data, senderId) {
        var cbs = listeners[event];
        if (!cbs) return;
        for (var i = 0; i < cbs.length; i++) {
            try { cbs[i](data, senderId); } catch (e) { console.error('[Realtime]', e); }
        }
    }

    function syncPresence() {
        if (!channel) return;
        var raw = channel.presenceState();
        presenceState = raw;
    }

    function getPlayersFromState() {
        var players = [];
        var keys = Object.keys(presenceState);
        for (var i = 0; i < keys.length; i++) {
            var entries = presenceState[keys[i]];
            if (entries && entries.length > 0) {
                var entry = entries[entries.length - 1]; // latest
                var player = { id: keys[i] };
                var eKeys = Object.keys(entry);
                for (var j = 0; j < eKeys.length; j++) {
                    if (eKeys[j] !== 'presence_ref' && eKeys[j] !== 'online_at') {
                        player[eKeys[j]] = entry[eKeys[j]];
                    }
                }
                players.push(player);
            }
        }
        return players;
    }

    async function connect(room) {
        if (connected) return;
        room = room || 'lobby';

        await loadSupabase();
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            realtime: { params: { eventsPerSecond: 20 } }
        });

        var channelName = 'app:' + appId + ':room:' + room;
        channel = supabaseClient.channel(channelName, {
            config: {
                broadcast: { self: false },
                presence: { key: playerId }
            }
        });

        // Broadcast handler — single 'msg' event, route by inner event name
        channel.on('broadcast', { event: 'msg' }, function(payload) {
            var d = payload.payload || {};
            fireEvent(d._evt, d.data, d._from);
        });

        // Presence sync
        channel.on('presence', { event: 'sync' }, function() {
            syncPresence();
        });

        channel.on('presence', { event: 'join' }, function(payload) {
            syncPresence();
            var keys = Object.keys(payload.newPresences || {});
            for (var i = 0; i < joinCbs.length; i++) {
                for (var j = 0; j < keys.length; j++) {
                    var entries = (payload.newPresences || {})[keys[j]];
                    if (entries) {
                        for (var k = 0; k < entries.length; k++) {
                            try { joinCbs[i]({ id: keys[j] }); } catch (e) {}
                        }
                    }
                }
            }
        });

        channel.on('presence', { event: 'leave' }, function(payload) {
            syncPresence();
            var keys = Object.keys(payload.leftPresences || {});
            for (var i = 0; i < leaveCbs.length; i++) {
                for (var j = 0; j < keys.length; j++) {
                    var entries = (payload.leftPresences || {})[keys[j]];
                    if (entries) {
                        for (var k = 0; k < entries.length; k++) {
                            try { leaveCbs[i]({ id: keys[j] }); } catch (e) {}
                        }
                    }
                }
            }
        });

        await channel.subscribe(function(status) {
            if (status === 'SUBSCRIBED') {
                connected = true;
                channel.track({ online_at: Date.now() });
            }
        });

        // Wait for SUBSCRIBED status
        await new Promise(function(resolve) {
            var check = setInterval(function() {
                if (connected) { clearInterval(check); resolve(); }
            }, 50);
            // Timeout after 10s
            setTimeout(function() { clearInterval(check); resolve(); }, 10000);
        });
    }

    function send(event, data) {
        if (!channel || !connected) {
            console.warn('[Realtime] Not connected. Call await Realtime.connect() first.');
            return;
        }
        var now = Date.now();
        if (now - lastSend < RATE_LIMIT_MS) return;
        lastSend = now;

        var payload = { _evt: event, _from: playerId, data: data };
        var str = JSON.stringify(payload);
        if (str.length > MAX_PAYLOAD) {
            console.warn('[Realtime] Payload too large (' + str.length + ' > ' + MAX_PAYLOAD + ')');
            return;
        }
        channel.send({ type: 'broadcast', event: 'msg', payload: payload });
    }

    function on(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
    }

    function onJoin(callback) { joinCbs.push(callback); }
    function onLeave(callback) { leaveCbs.push(callback); }

    function getPlayers() {
        syncPresence();
        return getPlayersFromState();
    }

    function setMyState(state) {
        if (!channel || !connected) return;
        state = state || {};
        state.online_at = Date.now();
        channel.track(state);
    }

    function disconnect() {
        if (channel) {
            channel.untrack();
            channel.unsubscribe();
            channel = null;
        }
        if (supabaseClient) {
            supabaseClient.removeAllChannels();
            supabaseClient = null;
        }
        connected = false;
        presenceState = {};
    }

    // Auto-disconnect on page close
    window.addEventListener('beforeunload', function() {
        disconnect();
    });

    // --- Presence pill UI ---
    var pillEl = null;

    function injectPresencePill() {
        if (pillEl) return;
        pillEl = document.createElement('div');
        pillEl.id = '_rt_presence_pill';
        pillEl.style.cssText = 'position:fixed;bottom:16px;right:16px;background:rgba(0,0,0,0.7);color:#fff;' +
            'font-family:Inter,system-ui,sans-serif;font-size:13px;padding:6px 12px;border-radius:20px;' +
            'display:none;align-items:center;gap:6px;z-index:99999;pointer-events:none;' +
            'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);';
        pillEl.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;"></span>' +
            '<span id="_rt_pill_count">1 online</span>';
        document.body.appendChild(pillEl);
    }

    function updatePill() {
        if (!pillEl) return;
        var count = getPlayers().length;
        var countEl = document.getElementById('_rt_pill_count');
        if (count >= 1) {
            pillEl.style.display = 'flex';
            if (countEl) countEl.textContent = count + ' online';
        } else {
            pillEl.style.display = 'none';
        }
    }

    // Hook presence events to update pill
    var origSyncPresence = syncPresence;
    syncPresence = function() {
        origSyncPresence();
        updatePill();
    };

    // --- Auto-connect for top-level pages ---
    var autoConnectTimer = null;
    var manualConnectCalled = false;

    var originalConnect = connect;

    // Wrapped connect that cancels auto-connect
    async function wrappedConnect(room) {
        manualConnectCalled = true;
        if (autoConnectTimer) {
            clearTimeout(autoConnectTimer);
            autoConnectTimer = null;
        }
        await originalConnect(room);
        injectPresencePill();
        updatePill();
    }

    // Schedule auto-connect if top-level page
    if (window === window.top) {
        autoConnectTimer = setTimeout(function() {
            if (!manualConnectCalled && !connected) {
                originalConnect('lobby').then(function() {
                    injectPresencePill();
                    updatePill();
                });
            }
        }, 500);
    }

    // Expose
    window.Realtime = {
        me: { id: playerId },
        connect: wrappedConnect,
        send: send,
        on: on,
        onJoin: onJoin,
        onLeave: onLeave,
        getPlayers: getPlayers,
        setMyState: setMyState,
        disconnect: disconnect
    };
})();
