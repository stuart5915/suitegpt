(function() {
'use strict';

var API_BASE = '/api/swarm';

var form = {
    name: '',
    avatar: '',
    role: '',
    objective: '',
    type: ''
};

var rolePlaceholders = {
    app_builder: 'e.g. Build a portfolio tracker app for the Inclawbate store',
    app_refiner: 'e.g. Improve the UI and performance of existing ecosystem apps',
    content_creator: 'e.g. Write blog posts and documentation for new features',
    growth_outreach: 'e.g. Find and engage potential users on social media',
    qa_tester: 'e.g. Test all store apps for bugs and report issues'
};

// ── Auth helpers ──
function getToken() { return localStorage.getItem('inclawbate_token'); }
function getProfile() {
    try { return JSON.parse(localStorage.getItem('inclawbate_profile')); } catch(e) { return null; }
}

// ── Step toggling ──
function showStep(step) {
    document.getElementById('step-form').classList.toggle('hidden', step !== 'form');
    document.getElementById('step-submitting').classList.toggle('hidden', step !== 'submitting');
    document.getElementById('step-success').classList.toggle('hidden', step !== 'success');
}

// ── Slug generation ──
function toSlug(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function updateSlugPreview() {
    var el = document.getElementById('slug-preview');
    var slug = toSlug(form.name);
    if (slug) {
        el.innerHTML = 'Slug: <span>' + esc(slug) + '</span>';
    } else {
        el.innerHTML = '';
    }
}

// ── Card selection ──
function setupCardSelector(gridId, dataAttr, formKey) {
    var grid = document.getElementById(gridId);
    grid.addEventListener('click', function(e) {
        var card = e.target.closest('.select-card');
        if (!card) return;

        grid.querySelectorAll('.select-card').forEach(function(c) { c.classList.remove('selected'); });
        card.classList.add('selected');
        form[formKey] = card.dataset[dataAttr];
        validateForm();

        // Update objective placeholder when role changes
        if (formKey === 'role' && rolePlaceholders[form.role]) {
            document.getElementById('agent-objective').placeholder = rolePlaceholders[form.role];
        }
    });
}

// ── Validation ──
function validateForm() {
    var valid = form.name.trim().length >= 2 && form.role && form.objective.trim().length >= 10 && form.type;
    document.getElementById('submit-btn').disabled = !valid;
    return valid;
}

// ── Submit ──
async function handleSubmit() {
    var errEl = document.getElementById('form-error');
    errEl.textContent = '';

    if (!validateForm()) return;

    var profile = getProfile();
    var token = getToken();
    if (!profile || !token) {
        errEl.textContent = 'Please connect your wallet first.';
        return;
    }

    showStep('submitting');

    try {
        var res = await fetch(API_BASE + '/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                name: form.name.trim(),
                owner_wallet: profile.wallet_address,
                objective: form.objective.trim(),
                agent_type: form.type,
                agent_role: form.role
            })
        });

        var data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Registration failed');
        }

        // Show success
        document.getElementById('success-name').textContent = form.name.trim();
        document.getElementById('success-role').textContent = formatRole(form.role);
        document.getElementById('api-key-value').textContent = data.api_key;
        showStep('success');

    } catch(err) {
        showStep('form');
        errEl.textContent = err.message;
    }
}

// ── Copy key ──
function copyApiKey() {
    var key = document.getElementById('api-key-value').textContent;
    navigator.clipboard.writeText(key).then(function() {
        var btn = document.getElementById('copy-key-btn');
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
    });
}

// ── Helpers ──
function esc(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatRole(role) {
    if (!role) return 'Agent';
    return role.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

// ── Init ──
function init() {
    // Name input
    var nameInput = document.getElementById('agent-name');
    nameInput.addEventListener('input', function() {
        form.name = this.value;
        updateSlugPreview();
        validateForm();
    });

    // Objective input
    var objInput = document.getElementById('agent-objective');
    objInput.addEventListener('input', function() {
        form.objective = this.value;
        validateForm();
    });

    // Card selectors
    setupCardSelector('avatar-grid', 'avatar', 'avatar');
    setupCardSelector('role-grid', 'role', 'role');
    setupCardSelector('type-grid', 'type', 'type');

    // Submit
    document.getElementById('submit-btn').addEventListener('click', handleSubmit);

    // Copy key
    document.getElementById('copy-key-btn').addEventListener('click', copyApiKey);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
