/**
 * WorkConductor - Chat UI
 * Handles chat messages, rendering, and interaction
 */

const ChatUI = (function () {
    let messagesContainer = null;
    let chatInput = null;
    let sendBtn = null;
    let typingIndicator = null;

    /**
     * Initialize chat UI
     */
    function init() {
        messagesContainer = document.getElementById('chat-messages');
        chatInput = document.getElementById('chat-input');
        sendBtn = document.getElementById('send-btn');
        typingIndicator = document.getElementById('typing-indicator');

        // Auto-resize textarea
        chatInput.addEventListener('input', autoResizeInput);

        // Handle enter key
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Send button
        sendBtn.addEventListener('click', sendMessage);

        // Quick add input
        const quickAddInput = document.getElementById('quick-add-input');
        const quickAddBtn = document.getElementById('quick-add-btn');

        if (quickAddInput) {
            quickAddInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAdd();
                }
            });
        }

        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', handleQuickAdd);
        }
    }

    /**
     * Handle quick add from sidebar
     */
    async function handleQuickAdd() {
        const input = document.getElementById('quick-add-input');
        const status = document.getElementById('quick-add-status');
        const text = input.value.trim();

        if (!text) return;

        // Show processing
        input.disabled = true;

        try {
            // Use AI to categorize and add
            const goalsMarkdown = GoalsManager.toMarkdown();
            const prompt = `Quick add request: "${text}"

Current goals structure:
${goalsMarkdown}

Analyze this quick idea and tell me:
1. The exact goal text to add (clean it up if needed)
2. Which section it belongs in

Respond with ONLY this format:
[ADD] goal text | section name

Nothing else.`;

            const response = await GeminiClient.processFeedback('quick-add', prompt, goalsMarkdown, goalsMarkdown);

            // Parse and apply
            const changes = parseGoalChanges(response.text);

            if (changes.length > 0) {
                for (const change of changes) {
                    if (change.type === 'added') {
                        GoalsManager.addGoal(change.text, change.section);
                    }
                }

                // Show success
                showQuickAddStatus('success', `Added: ${changes[0].text}`);
                renderGoalsTree();
            } else {
                // Fallback: add directly
                GoalsManager.addGoal(text);
                showQuickAddStatus('success', `Added: ${text}`);
                renderGoalsTree();
            }

            // Clear input
            input.value = '';

            // Update rate limits
            updateRateLimits(response.rateLimitStatus);

        } catch (error) {
            // Fallback: add directly without AI
            GoalsManager.addGoal(text);
            showQuickAddStatus('success', `Added: ${text}`);
            renderGoalsTree();
            input.value = '';
        } finally {
            input.disabled = false;
            input.focus();
        }
    }

    /**
     * Show quick add status message
     */
    function showQuickAddStatus(type, message) {
        const status = document.getElementById('quick-add-status');
        status.className = `quick-add-status ${type}`;
        status.textContent = message;
        status.classList.remove('hidden');

        // Hide after 2 seconds
        setTimeout(() => {
            status.classList.add('hidden');
        }, 2000);
    }

    // Drag and drop state
    let draggedItem = null;
    let draggedItemId = null;

    /**
     * Auto-resize input based on content
     */
    function autoResizeInput() {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
    }

    /**
     * Send a message
     */
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Add user message
        addMessage(text, 'user');

        // Clear input
        chatInput.value = '';
        chatInput.style.height = 'auto';

        // Disable input while processing
        setInputEnabled(false);
        showTyping();

        try {
            // Process with AI
            const response = await processUserMessage(text);

            hideTyping();
            addMessage(response.message, 'ai', response.goalUpdates);

            // Update sidebar goals
            if (response.goalUpdates && response.goalUpdates.length > 0) {
                renderGoalsTree();
            }
        } catch (error) {
            hideTyping();
            addMessage(`Error: ${error.message}. Please try again.`, 'ai');
        } finally {
            setInputEnabled(true);
            chatInput.focus();
        }
    }

    /**
     * Process user message and get AI response
     */
    async function processUserMessage(text) {
        const textLower = text.toLowerCase();
        const goals = GoalsManager.getGoals();
        const goalsMarkdown = GoalsManager.toMarkdown();

        // Detect intent
        const intent = detectIntent(textLower);

        // Build prompt based on intent
        let prompt = '';
        let goalUpdates = [];

        if (intent.type === 'complete') {
            // Try to mark goal as complete locally first
            const completed = GoalsManager.completeGoal(intent.target);
            if (completed) {
                goalUpdates.push({ type: 'completed', text: completed.text });
            }

            prompt = `The user just told me they completed: "${text}"

Current goals:
${goalsMarkdown}

${completed ? `I've marked "${completed.text}" as complete.` : `I couldn't find a matching goal to mark complete.`}

Respond briefly:
1. Acknowledge what they completed
2. Update any related goals if needed (tell me what to add/remove/update)
3. Suggest what they should work on next based on their priorities

Format any goal changes as:
[ADD] new goal text | section name
[COMPLETE] goal text
[REMOVE] goal text

Keep response concise.`;

        } else if (intent.type === 'add') {
            prompt = `The user wants to add a new goal: "${text}"

Current goals:
${goalsMarkdown}

Help me:
1. Determine the exact goal text to add
2. Which section it belongs in (Immediate, This Week, etc)
3. Acknowledge the addition
4. Briefly mention how it fits with their other priorities

Format the addition as:
[ADD] goal text | section name

Keep response concise.`;

        } else if (intent.type === 'remove') {
            const removed = GoalsManager.removeGoal(intent.target);
            if (removed) {
                goalUpdates.push({ type: 'removed', text: removed.text });
            }

            prompt = `The user wants to remove/deprioritize: "${text}"

${removed ? `I've removed "${removed.text}" from their goals.` : `I couldn't find a matching goal.`}

Respond briefly acknowledging this change.`;

        } else if (intent.type === 'stuck') {
            prompt = `The user is stuck: "${text}"

Current goals:
${goalsMarkdown}

Help them:
1. Understand what's blocking them
2. Suggest specific steps to get unstuck
3. If appropriate, suggest breaking the task into smaller pieces
4. Ask clarifying questions if needed

Be helpful and action-oriented.`;

        } else if (intent.type === 'next' || intent.type === 'plan') {
            prompt = `The user wants to know what to work on next: "${text}"

Current goals:
${goalsMarkdown}

Analyze their goals and:
1. Identify the highest priority item they should work on RIGHT NOW
2. Break it into 2-3 specific steps
3. For each step, provide an exact prompt they can send to their AI coding assistant

Format like:
**Work on: [task name]**

Steps:
1. [Step description]
   → Send to Antigravity: "[exact prompt]"

2. [Step description]
   → Send to Antigravity: "[exact prompt]"

Be specific and actionable.`;

        } else if (intent.type === 'status') {
            const stats = GoalsManager.getStats();
            prompt = `The user wants a status update: "${text}"

Current goals:
${goalsMarkdown}

Stats: ${stats.completed} completed, ${stats.inProgress} in progress, ${stats.pending} pending, ${stats.blocked} blocked

Give them a brief status update:
1. What's been accomplished
2. What's currently in progress  
3. What's coming up next
4. Any blockers to be aware of

Keep it brief and motivating.`;

        } else {
            // General question or command
            prompt = `The user said: "${text}"

Current goals:
${goalsMarkdown}

Respond helpfully. If they seem to be:
- Asking what to work on → suggest next priority
- Reporting completion → acknowledge and suggest next
- Asking to add something → confirm what to add
- Confused or stuck → help clarify

If their message implies any goal changes, specify them as:
[ADD] goal text | section name
[COMPLETE] goal text  
[REMOVE] goal text
[UPDATE] old text → new text

Be conversational and helpful.`;
        }

        // Call Gemini
        const response = await GeminiClient.processFeedback('general', prompt, goalsMarkdown, goalsMarkdown);

        // Parse response for goal changes
        const changes = parseGoalChanges(response.text);
        goalUpdates = goalUpdates.concat(changes);

        // Apply changes
        for (const change of changes) {
            if (change.type === 'added') {
                GoalsManager.addGoal(change.text, change.section);
            } else if (change.type === 'completed') {
                GoalsManager.completeGoal(change.text);
            } else if (change.type === 'removed') {
                GoalsManager.removeGoal(change.text);
            }
        }

        // Update rate limits display
        updateRateLimits(response.rateLimitStatus);

        // Clean response text (remove the [ADD] etc markers)
        let cleanResponse = response.text
            .replace(/\[ADD\][^\n]*/g, '')
            .replace(/\[COMPLETE\][^\n]*/g, '')
            .replace(/\[REMOVE\][^\n]*/g, '')
            .replace(/\[UPDATE\][^\n]*/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        return {
            message: cleanResponse,
            goalUpdates: goalUpdates
        };
    }

    /**
     * Detect user intent from message
     */
    function detectIntent(text) {
        // Completion patterns
        if (text.match(/^(i |i've |just |finished|done|completed|fixed|shipped|deployed|built|created|made|implemented|added)/)) {
            const target = text.replace(/^(i |i've |just |finished|done|completed|fixed|shipped|deployed|built|created|made|implemented|added)\s*/i, '');
            return { type: 'complete', target };
        }

        // Add patterns
        if (text.match(/^(add|new|create|need to|todo|reminder)/)) {
            const target = text.replace(/^(add|new|create|need to|todo|reminder)\s*/i, '');
            return { type: 'add', target };
        }

        // Remove patterns
        if (text.match(/^(remove|delete|cancel|skip|deprioritize|ignore)/)) {
            const target = text.replace(/^(remove|delete|cancel|skip|deprioritize|ignore)\s*/i, '');
            return { type: 'remove', target };
        }

        // Stuck patterns
        if (text.match(/(stuck|blocked|help|issue|problem|error|bug|broken|not working|doesn't work|can't)/)) {
            return { type: 'stuck', target: text };
        }

        // Next/plan patterns
        if (text.match(/^(what('?s| should| do)|next|plan|priorities|focus|work on)/)) {
            return { type: 'next', target: text };
        }

        // Status patterns
        if (text.match(/^(status|progress|how am i|summary|overview|report)/)) {
            return { type: 'status', target: text };
        }

        return { type: 'general', target: text };
    }

    /**
     * Parse goal changes from AI response
     */
    function parseGoalChanges(text) {
        const changes = [];
        const lines = text.split('\n');

        for (const line of lines) {
            const addMatch = line.match(/\[ADD\]\s*(.+?)(?:\s*\|\s*(.+))?$/i);
            if (addMatch) {
                changes.push({
                    type: 'added',
                    text: addMatch[1].trim(),
                    section: addMatch[2]?.trim()
                });
            }

            const completeMatch = line.match(/\[COMPLETE\]\s*(.+)$/i);
            if (completeMatch) {
                changes.push({
                    type: 'completed',
                    text: completeMatch[1].trim()
                });
            }

            const removeMatch = line.match(/\[REMOVE\]\s*(.+)$/i);
            if (removeMatch) {
                changes.push({
                    type: 'removed',
                    text: removeMatch[1].trim()
                });
            }
        }

        return changes;
    }

    /**
     * Add a message to the chat
     */
    function addMessage(text, type, goalUpdates = []) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = type === 'ai' ? '🎯' : '👤';

        const content = document.createElement('div');
        content.className = 'message-content';
        content.innerHTML = formatMessage(text);

        // Add goal update badges
        if (goalUpdates && goalUpdates.length > 0) {
            for (const update of goalUpdates) {
                const badge = document.createElement('div');
                badge.className = `goal-update ${update.type}`;
                badge.textContent = `${getUpdateIcon(update.type)} ${update.text}`;
                content.appendChild(badge);
            }
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        messagesContainer.appendChild(messageDiv);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Get icon for update type
     */
    function getUpdateIcon(type) {
        switch (type) {
            case 'added': return '➕';
            case 'completed': return '✅';
            case 'removed': return '🗑️';
            default: return '📝';
        }
    }

    /**
     * Format message text with markdown-lite
     */
    function formatMessage(text) {
        if (!text) return '';

        // Process line by line for better control
        const lines = text.split('\n');
        let checkboxCounter = 0;

        const processedLines = lines.map((line) => {
            const trimmedLine = line.trim();

            // Headers
            if (trimmedLine.startsWith('### ')) {
                return `<h4 class="chat-h4">${escapeHtml(trimmedLine.substring(4))}</h4>`;
            }
            if (trimmedLine.startsWith('## ')) {
                return `<h3 class="chat-h3">${escapeHtml(trimmedLine.substring(3))}</h3>`;
            }
            if (trimmedLine.startsWith('# ')) {
                return `<h2 class="chat-h2">${escapeHtml(trimmedLine.substring(2))}</h2>`;
            }

            // Horizontal rules
            if (trimmedLine === '---' || trimmedLine === '***') {
                return '<hr class="chat-hr">';
            }

            // Checkbox items (- [ ] or - [x])
            const checkboxMatch = trimmedLine.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/);
            if (checkboxMatch) {
                checkboxCounter++;
                const isChecked = checkboxMatch[1].toLowerCase() === 'x';
                const itemText = checkboxMatch[2];
                return `<div class="chat-checkbox-item">
                    <input type="checkbox" class="chat-checkbox" ${isChecked ? 'checked' : ''}>
                    <label class="${isChecked ? 'checked' : ''}">${escapeHtml(itemText)}</label>
                </div>`;
            }

            // Regular list items - render as simple bullets, not checkboxes
            const listMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
            if (listMatch) {
                return `<div class="chat-list-item">• ${escapeHtml(listMatch[1])}</div>`;
            }

            // Numbered items - render with step number
            const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
            if (numberedMatch) {
                const num = numberedMatch[1];
                const itemText = numberedMatch[2];
                return `<div class="chat-step-item"><span class="step-number">${num}</span> ${escapeHtml(itemText)}</div>`;
            }

            // Regular text - escape and return
            return escapeHtml(line);
        });

        let formatted = processedLines.join('\n');

        // Bold
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Code blocks
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

        // Inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');

        // Clean up extra br tags around block elements
        formatted = formatted.replace(/<br><h/g, '<h');
        formatted = formatted.replace(/<\/h(\d)><br>/g, '</h$1>');
        formatted = formatted.replace(/<br><hr/g, '<hr');
        formatted = formatted.replace(/<hr([^>]*)><br>/g, '<hr$1>');
        formatted = formatted.replace(/<br><div/g, '<div');
        formatted = formatted.replace(/<\/div><br>/g, '</div>');

        return formatted;
    }

    /**
     * Handle checkbox change - mark item as done
     */
    function handleCheckboxChange(itemText, isChecked) {
        if (isChecked) {
            // Try to mark as complete in goals
            const completed = GoalsManager.completeGoal(itemText);
            if (completed) {
                renderGoalsTree();
                // Show brief confirmation
                console.log('Marked as complete:', itemText);
            }
        }
    }

    /**
     * Show typing indicator
     */
    function showTyping() {
        typingIndicator.classList.remove('hidden');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Hide typing indicator
     */
    function hideTyping() {
        typingIndicator.classList.add('hidden');
    }

    /**
     * Enable/disable input
     */
    function setInputEnabled(enabled) {
        chatInput.disabled = !enabled;
        sendBtn.disabled = !enabled;
    }

    /**
     * Update rate limits display
     */
    function updateRateLimits(status) {
        if (status) {
            document.getElementById('pro-count').textContent = `${status.pro.count}/100`;
            document.getElementById('flash-count').textContent = `${status.flash.count}/100`;

            const settingsPro = document.getElementById('settings-pro-count');
            const settingsFlash = document.getElementById('settings-flash-count');
            if (settingsPro) settingsPro.textContent = status.pro.count;
            if (settingsFlash) settingsFlash.textContent = status.flash.count;
        }
    }

    /**
     * Render the goals tree in sidebar
     */
    function renderGoalsTree() {
        const container = document.getElementById('goals-tree');
        const goals = GoalsManager.getGoals();

        if (!goals.sections || goals.sections.length === 0) {
            container.innerHTML = `
                <div class="goals-empty">
                    <p>Your goals will appear here.</p>
                    <p class="hint">Chat with the AI to add goals!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        for (const section of goals.sections) {
            const sectionEl = document.createElement('div');
            sectionEl.className = `goal-section ${section.collapsed ? 'collapsed' : ''}`;
            sectionEl.dataset.sectionId = section.id;

            // Count items
            let itemCount = section.items.filter(i => !i.isSubsection).length;
            section.items.forEach(i => {
                if (i.items) itemCount += i.items.length;
            });

            sectionEl.innerHTML = `
                <div class="goal-section-header" onclick="ChatUI.toggleSection('${section.id}')">
                    <svg class="goal-section-toggle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 9l6 6 6-6"/>
                    </svg>
                    <span class="goal-section-title">${escapeHtml(section.title)}</span>
                    <span class="goal-section-count">${itemCount}</span>
                </div>
                <div class="goal-items">
                    ${section.items.map(item => renderGoalItem(item)).join('')}
                </div>
            `;

            container.appendChild(sectionEl);
        }
    }

    /**
     * Render a single goal item
     */
    function renderGoalItem(item) {
        if (item.isSubsection) {
            return `
                <div class="goal-item subsection">
                    <span class="goal-text"><strong>${escapeHtml(item.text)}</strong></span>
                </div>
                ${item.items ? item.items.map(sub => renderGoalItem(sub)).join('') : ''}
            `;
        }

        // Context items (plain text, not tasks)
        if (item.isContext) {
            return `
                <div class="goal-item context">
                    <span class="goal-text">${escapeHtml(truncate(item.text, 60))}</span>
                </div>
            `;
        }

        return `
            <div class="goal-item ${item.status}" 
                 data-goal-id="${item.id}" 
                 draggable="true"
                 onclick="ChatUI.handleGoalClick('${item.id}')"
                 ondragstart="ChatUI.handleDragStart(event, '${item.id}')"
                 ondragover="ChatUI.handleDragOver(event)"
                 ondrop="ChatUI.handleDrop(event, '${item.id}')"
                 ondragend="ChatUI.handleDragEnd(event)">
                <span class="drag-handle"></span>
                <span class="goal-status ${item.status}"></span>
                <span class="goal-text">${escapeHtml(truncate(item.text, 45))}</span>
            </div>
        `;
    }

    /**
     * Handle goal click - toggle completion
     */
    function handleGoalClick(goalId) {
        const goals = GoalsManager.getGoals();
        for (const section of goals.sections) {
            const item = section.items.find(i => i.id === goalId);
            if (item) {
                // Cycle status: pending -> in-progress -> completed -> pending
                if (item.status === 'pending') {
                    item.status = 'in-progress';
                } else if (item.status === 'in-progress') {
                    item.status = 'completed';
                } else {
                    item.status = 'pending';
                }
                GoalsManager.saveGoals();
                renderGoalsTree();
                return;
            }
            // Check nested items
            for (const subItem of section.items) {
                if (subItem.items) {
                    const nested = subItem.items.find(i => i.id === goalId);
                    if (nested) {
                        if (nested.status === 'pending') {
                            nested.status = 'in-progress';
                        } else if (nested.status === 'in-progress') {
                            nested.status = 'completed';
                        } else {
                            nested.status = 'pending';
                        }
                        GoalsManager.saveGoals();
                        renderGoalsTree();
                        return;
                    }
                }
            }
        }
    }

    /**
     * Drag start handler
     */
    function handleDragStart(event, goalId) {
        draggedItemId = goalId;
        event.target.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
    }

    /**
     * Drag over handler
     */
    function handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        // Add visual indicator
        const target = event.target.closest('.goal-item');
        if (target && !target.classList.contains('dragging')) {
            // Remove drag-over from all
            document.querySelectorAll('.goal-item.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
            target.classList.add('drag-over');
        }
    }

    /**
     * Drop handler
     */
    function handleDrop(event, targetId) {
        event.preventDefault();

        if (draggedItemId && draggedItemId !== targetId) {
            // Reorder goals
            GoalsManager.reorderGoal(draggedItemId, targetId);
            renderGoalsTree();
        }

        // Clean up
        document.querySelectorAll('.goal-item.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }

    /**
     * Drag end handler
     */
    function handleDragEnd(event) {
        event.target.classList.remove('dragging');
        document.querySelectorAll('.goal-item.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        draggedItemId = null;
    }

    /**
     * Toggle section collapse
     */
    function toggleSection(sectionId) {
        GoalsManager.toggleSection(sectionId);
        renderGoalsTree();
    }

    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Truncate text
     */
    function truncate(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // Public API
    return {
        init,
        addMessage,
        showTyping,
        hideTyping,
        renderGoalsTree,
        toggleSection,
        updateRateLimits,
        handleGoalClick,
        handleDragStart,
        handleDragOver,
        handleDrop,
        handleDragEnd,
        handleCheckboxChange
    };
})();

// Export
if (typeof window !== 'undefined') {
    window.ChatUI = ChatUI;
}
