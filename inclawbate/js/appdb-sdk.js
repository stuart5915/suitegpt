// AppDB SDK — auto-injected into every app served by Inclawbate
// Exposes window.AppDB for persistent key-value storage (user-scoped + global)
(function() {
    'use strict';

    var scriptTag = document.currentScript || document.querySelector('script[data-app-id]');
    var appId = scriptTag ? scriptTag.getAttribute('data-app-id') : null;
    var API = 'https://inclawbate.com/api/appdb';

    // User scope: wallet address if available, else anonymous localStorage ID
    function getUserScope() {
        // Check if wallet connected (from CLAWS SDK or ethereum provider)
        if (window.ethereum && window.ethereum.selectedAddress) {
            return window.ethereum.selectedAddress.toLowerCase();
        }
        // Fallback: anonymous persistent ID
        var key = '_appdb_uid';
        var uid = localStorage.getItem(key);
        if (!uid) {
            uid = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem(key, uid);
        }
        return uid;
    }

    function post(action, opts) {
        var body = { action: action, app_id: appId };
        if (opts) {
            if (opts.key !== undefined) body.key = opts.key;
            if (opts.value !== undefined) body.value = opts.value;
            if (opts.scope !== undefined) body.user_scope = opts.scope;
        }
        return fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function(r) { return r.json(); });
    }

    window.AppDB = {
        // ── User-scoped (private per user) ──
        get: function(key) {
            return post('get', { key: key, scope: getUserScope() }).then(function(r) { return r.value; });
        },
        set: function(key, value) {
            return post('set', { key: key, value: value, scope: getUserScope() });
        },
        delete: function(key) {
            return post('delete', { key: key, scope: getUserScope() });
        },
        list: function() {
            return post('list', { scope: getUserScope() }).then(function(r) { return r.entries || []; });
        },

        // ── Global (shared across all users of this app) ──
        getGlobal: function(key) {
            return post('get', { key: key, scope: '_global' }).then(function(r) { return r.value; });
        },
        setGlobal: function(key, value) {
            return post('set', { key: key, value: value, scope: '_global' });
        },
        deleteGlobal: function(key) {
            return post('delete', { key: key, scope: '_global' });
        },
        listGlobal: function() {
            return post('list', { scope: '_global' }).then(function(r) { return r.entries || []; });
        }
    };
})();
