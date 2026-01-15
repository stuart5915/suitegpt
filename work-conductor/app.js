/**
 * WorkConductor v2 - Main Application
 * Chat-based interface with auto-managing goals
 */

const WorkConductorApp = (function () {

    /**
     * Initialize the app
     */
    async function init() {
        console.log('WorkConductor v2 initializing...');

        // Check if setup is complete
        if (hasCompletedSetup()) {
            // Load goals and show main view
            await GoalsManager.loadGoals();
            showView('main');
            ChatUI.init();
            ChatUI.renderGoalsTree();

            // Update rate limits
            const status = GeminiClient.getRateLimitStatus();
            ChatUI.updateRateLimits(status);

            // Run initial analysis for returning users too
            await runInitialAnalysis(true);
        } else {
            showView('setup');
        }

        // Bind events
        bindEvents();

        console.log('WorkConductor v2 ready!');
    }

    /**
     * Check if setup is complete
     */
    function hasCompletedSetup() {
        return !!localStorage.getItem('conductor_api_key') &&
            !!localStorage.getItem('conductor_telos');
    }

    /**
     * Bind event listeners
     */
    function bindEvents() {
        // Setup form
        const setupForm = document.getElementById('setup-form');
        if (setupForm) {
            setupForm.addEventListener('submit', handleSetup);
        }

        // Sidebar toggle
        const toggleBtn = document.getElementById('toggle-sidebar');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleSidebar);
        }

        // Settings
        const settingsBtn = document.getElementById('settings-btn');
        const closeSettings = document.getElementById('close-settings');
        const saveSettings = document.getElementById('save-settings');
        const exportGoals = document.getElementById('export-goals');
        const clearData = document.getElementById('clear-data');

        if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
        if (closeSettings) closeSettings.addEventListener('click', closeSettingsModal);
        if (saveSettings) saveSettings.addEventListener('click', handleSaveSettings);
        if (exportGoals) exportGoals.addEventListener('click', handleExportGoals);
        if (clearData) clearData.addEventListener('click', handleClearData);

        // Close modal on backdrop click
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
            });
        });
    }

    /**
     * Show a view
     */
    function showView(viewName) {
        document.getElementById('setup-view').classList.toggle('hidden', viewName !== 'setup');
        document.getElementById('main-view').classList.toggle('hidden', viewName !== 'main');
    }

    /**
     * Handle setup form
     */
    async function handleSetup(e) {
        e.preventDefault();

        const apiKey = document.getElementById('api-key').value.trim();
        const telos = document.getElementById('telos-input').value.trim();

        if (!apiKey || !telos) {
            alert('Please fill in all fields');
            return;
        }

        // Save API key
        GeminiClient.setApiKey(apiKey);

        // Parse and save goals
        GoalsManager.parseGoals(telos);

        // Show main view
        showView('main');
        ChatUI.init();
        ChatUI.renderGoalsTree();

        // Update rate limits
        const status = GeminiClient.getRateLimitStatus();
        ChatUI.updateRateLimits(status);

        // Trigger automatic initial analysis
        await runInitialAnalysis();
    }

    /**
     * Run initial analysis - proactively analyze goals and provide guidance
     */
    async function runInitialAnalysis(isReturning = false) {
        const goalsMarkdown = GoalsManager.toMarkdown();
        const stats = GoalsManager.getStats();

        // Show typing indicator
        ChatUI.showTyping();

        try {
            const contextIntro = isReturning
                ? `I'm back to continue working. Here are my current goals:`
                : `I just set up WorkConductor with these goals:`;

            const prompt = `${contextIntro}

${goalsMarkdown}

Stats: ${stats.total} total goals, ${stats.completed} completed, ${stats.inProgress} in progress

As my AI work manager, please:

1. **Quick Context** - ${isReturning ? 'Welcome me back and' : ''} Show you understand my project in 1-2 sentences
2. **Clarify** (only if something is confusing) - Ask 1-2 quick questions if needed
3. **Immediate Action** - Give me the #1 thing I should work on RIGHT NOW:
   - What to do (be specific)
   - An exact prompt to copy-paste to Antigravity (my AI coding assistant)
   - What to verify when done

Be concise but actionable. I want to start working immediately.`;

            // Use FLASH model to save Pro credits
            const response = await GeminiClient.processFeedback(
                'initial-analysis',
                prompt,
                goalsMarkdown,
                goalsMarkdown
            );

            ChatUI.hideTyping();
            ChatUI.addMessage(response.text, 'ai');
            ChatUI.updateRateLimits(response.rateLimitStatus);

        } catch (error) {
            ChatUI.hideTyping();

            // Fallback: provide basic guidance without AI
            const goals = GoalsManager.getGoals();
            let firstTask = 'your first goal';

            if (goals.sections.length > 0 && goals.sections[0].items.length > 0) {
                const firstItem = goals.sections[0].items.find(i => !i.isSubsection && i.status !== 'completed');
                if (firstItem) {
                    firstTask = firstItem.text;
                }
            }

            const greeting = isReturning ? 'Welcome back!' : "I've loaded your goals!";
            ChatUI.addMessage(`${greeting} I couldn't connect to AI right now (${error.message}), but based on your priorities, you should start with:\n\n**${firstTask}**\n\nTell me when you're done, or ask "what's next?" if you need more guidance.`, 'ai');
        }
    }

    /**
     * Toggle sidebar
     */
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
    }

    /**
     * Open settings modal
     */
    function openSettings() {
        const modal = document.getElementById('settings-modal');
        const apiKeyInput = document.getElementById('settings-api-key');

        // Populate current values
        apiKeyInput.value = GeminiClient.getApiKey() || '';

        // Update rate limit counts
        const status = GeminiClient.getRateLimitStatus();
        document.getElementById('settings-pro-count').textContent = status.pro.count;
        document.getElementById('settings-flash-count').textContent = status.flash.count;

        modal.classList.remove('hidden');
    }

    /**
     * Close settings modal
     */
    function closeSettingsModal() {
        document.getElementById('settings-modal').classList.add('hidden');
    }

    /**
     * Save settings
     */
    function handleSaveSettings() {
        const apiKey = document.getElementById('settings-api-key').value.trim();

        if (apiKey) {
            GeminiClient.setApiKey(apiKey);
        }

        closeSettingsModal();
    }

    /**
     * Export goals as markdown
     */
    function handleExportGoals() {
        const markdown = GoalsManager.toMarkdown();
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'workconductor-goals.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Clear all data
     */
    function handleClearData() {
        if (confirm('This will delete all your data including API key and goals. Are you sure?')) {
            localStorage.removeItem('conductor_api_key');
            localStorage.removeItem('conductor_telos');
            localStorage.removeItem('conductor_goals_data');
            localStorage.removeItem('conductor_user_id');
            localStorage.removeItem('conductor_rate_limits');
            location.reload();
        }
    }

    // Public API
    return {
        init
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', WorkConductorApp.init);
