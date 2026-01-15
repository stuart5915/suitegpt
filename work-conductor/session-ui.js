/**
 * WorkConductor - Session UI Components
 * Handles rendering and interaction for work session views
 */

const SessionUI = (function () {

    /**
     * Parse the AI response into structured task data
     */
    function parseSessionPlan(responseText) {
        const lines = responseText.split('\n');
        const result = {
            focus: '',
            estimatedTime: '',
            steps: [],
            checkpoint: ''
        };

        let currentStep = null;
        let currentSection = null;
        let inPromptBlock = false;
        let promptBuffer = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Parse focus
            if (trimmedLine.startsWith('Focus:')) {
                result.focus = trimmedLine.replace('Focus:', '').trim();
                continue;
            }

            // Parse estimated time
            if (trimmedLine.startsWith('Estimated Time:')) {
                result.estimatedTime = trimmedLine.replace('Estimated Time:', '').trim();
                continue;
            }

            // Parse checkpoint
            if (trimmedLine.startsWith('🏁 CHECKPOINT') || trimmedLine.toLowerCase().includes('checkpoint')) {
                // Get the next non-empty line as checkpoint text
                for (let j = i + 1; j < lines.length; j++) {
                    if (lines[j].trim() && !lines[j].trim().startsWith('---')) {
                        result.checkpoint = lines[j].trim();
                        break;
                    }
                }
                continue;
            }

            // Parse steps
            const stepMatch = trimmedLine.match(/^STEP\s+(\d+):\s*(.+?)(?:\s*\(~?(\d+)\s*min\))?$/i);
            if (stepMatch) {
                if (currentStep) {
                    result.steps.push(currentStep);
                }
                currentStep = {
                    number: parseInt(stepMatch[1]),
                    title: stepMatch[2].trim(),
                    estimatedMinutes: stepMatch[3] ? parseInt(stepMatch[3]) : null,
                    whatToDo: '',
                    prompt: '',
                    verify: []
                };
                currentSection = null;
                continue;
            }

            // Track current section within a step
            if (currentStep) {
                if (trimmedLine.startsWith('**What to do:**') || trimmedLine.toLowerCase().startsWith('what to do:')) {
                    currentSection = 'whatToDo';
                    continue;
                }
                if (trimmedLine.startsWith('**Send to Antigravity:**') || trimmedLine.toLowerCase().includes('send to antigravity')) {
                    currentSection = 'prompt';
                    continue;
                }
                if (trimmedLine.startsWith('**Verify:**') || trimmedLine.toLowerCase().startsWith('verify:')) {
                    currentSection = 'verify';
                    continue;
                }

                // Handle code blocks for prompts
                if (trimmedLine === '```') {
                    if (inPromptBlock) {
                        // End of prompt block
                        currentStep.prompt = promptBuffer.join('\n').trim();
                        promptBuffer = [];
                        inPromptBlock = false;
                    } else {
                        // Start of prompt block
                        inPromptBlock = true;
                    }
                    continue;
                }

                if (inPromptBlock) {
                    promptBuffer.push(line);
                    continue;
                }

                // Add content to current section
                if (currentSection === 'whatToDo' && trimmedLine) {
                    currentStep.whatToDo += (currentStep.whatToDo ? '\n' : '') + trimmedLine;
                } else if (currentSection === 'prompt' && trimmedLine && !trimmedLine.startsWith('```')) {
                    currentStep.prompt += (currentStep.prompt ? '\n' : '') + trimmedLine;
                } else if (currentSection === 'verify' && trimmedLine) {
                    if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
                        currentStep.verify.push(trimmedLine.substring(1).trim());
                    } else if (trimmedLine) {
                        currentStep.verify.push(trimmedLine);
                    }
                }
            }
        }

        // Don't forget the last step
        if (currentStep) {
            result.steps.push(currentStep);
        }

        return result;
    }

    /**
     * Render a single task card
     */
    function renderTaskCard(step, index, isActive = false, isCompleted = false) {
        const card = document.createElement('div');
        card.className = `task-card ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
        card.dataset.stepIndex = index;

        const timeEstimate = step.estimatedMinutes ? `~${step.estimatedMinutes} min` : '';

        card.innerHTML = `
            <div class="task-header">
                <span class="task-number">${step.number}</span>
                <span class="task-title">${escapeHtml(step.title)}</span>
                ${timeEstimate ? `<span class="task-time">${timeEstimate}</span>` : ''}
            </div>
            <div class="task-body">
                ${step.whatToDo ? `
                    <div class="task-section">
                        <span class="task-section-label">What to do</span>
                        <div class="task-section-content">${escapeHtml(step.whatToDo)}</div>
                    </div>
                ` : ''}
                
                ${step.prompt ? `
                    <div class="task-section">
                        <span class="task-section-label">Send to Antigravity</span>
                        <div class="prompt-box">
                            <button class="prompt-copy-btn" onclick="SessionUI.copyPrompt(this, '${index}')">Copy</button>
                            <code>${escapeHtml(step.prompt)}</code>
                        </div>
                    </div>
                ` : ''}
                
                ${step.verify && step.verify.length > 0 ? `
                    <div class="task-section">
                        <span class="task-section-label">Verify</span>
                        <div class="task-section-content">
                            ${step.verify.map(v => `• ${escapeHtml(v)}`).join('<br>')}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            ${!isCompleted ? `
                <div class="task-actions">
                    <button class="btn btn-complete" onclick="SessionUI.completeTask(${index})">
                        <span>✓ Complete</span>
                    </button>
                    <button class="btn btn-stuck" onclick="SessionUI.showFeedback(${index})">
                        <span>⚠️ Stuck</span>
                    </button>
                </div>
            ` : ''}
        `;

        return card;
    }

    /**
     * Render all task cards
     */
    function renderTasks(parsedPlan, completedSteps = []) {
        const container = document.getElementById('tasks-container');
        container.innerHTML = '';

        parsedPlan.steps.forEach((step, index) => {
            const isCompleted = completedSteps.includes(index);
            const isActive = !isCompleted && !completedSteps.includes(index - 1) &&
                (index === 0 || completedSteps.includes(index - 1));

            const card = renderTaskCard(step, index, isActive, isCompleted);
            container.appendChild(card);
        });

        // Update checkpoint
        const checkpointText = document.getElementById('checkpoint-text');
        if (parsedPlan.checkpoint) {
            checkpointText.textContent = parsedPlan.checkpoint;
        }
    }

    /**
     * Copy prompt to clipboard
     */
    async function copyPrompt(button, stepIndex) {
        const promptBox = button.parentElement;
        const codeElement = promptBox.querySelector('code');
        const text = codeElement.textContent;

        try {
            await navigator.clipboard.writeText(text);
            button.textContent = 'Copied!';
            button.classList.add('copied');

            setTimeout(() => {
                button.textContent = 'Copy';
                button.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            // Fallback to older method
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            button.textContent = 'Copied!';
            button.classList.add('copied');

            setTimeout(() => {
                button.textContent = 'Copy';
                button.classList.remove('copied');
            }, 2000);
        }
    }

    /**
     * Mark task as complete
     */
    function completeTask(stepIndex) {
        // This will be connected to the main app
        if (window.WorkConductorApp) {
            window.WorkConductorApp.completeTask(stepIndex);
        }
    }

    /**
     * Show feedback panel for a task
     */
    function showFeedback(stepIndex) {
        if (window.WorkConductorApp) {
            window.WorkConductorApp.showFeedback(stepIndex);
        }
    }

    /**
     * Render recent sessions list
     */
    function renderSessionsList(sessions) {
        const container = document.getElementById('sessions-list');

        if (!sessions || sessions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📋</span>
                    <p>No sessions yet. Start your first one!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = sessions.map(session => {
            const date = new Date(session.started_at);
            const dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });

            return `
                <div class="session-item" data-session-id="${session.id}">
                    <div class="session-item-info">
                        <span class="session-item-focus">${escapeHtml(session.focus || 'Work Session')}</span>
                        <span class="session-item-date">${dateStr}</span>
                    </div>
                    <span class="session-item-status ${session.status}">${session.status}</span>
                </div>
            `;
        }).join('');
    }

    /**
     * Render goals display
     */
    function renderGoals(telosText) {
        const container = document.getElementById('goals-display');
        if (!telosText) {
            container.innerHTML = '<p class="empty-state">No goals set yet.</p>';
            return;
        }

        // Truncate if too long
        const maxLength = 500;
        const displayText = telosText.length > maxLength
            ? telosText.substring(0, maxLength) + '...'
            : telosText;

        container.textContent = displayText;
    }

    /**
     * Update rate limit display
     */
    function updateRateLimitDisplay(status) {
        const bar = document.getElementById('rate-limit-bar');
        const proRequests = document.getElementById('pro-requests');
        const flashRequests = document.getElementById('flash-requests');
        const cooldownTimer = document.getElementById('cooldown-timer');
        const cooldownValue = document.getElementById('cooldown-value');
        const settingsProCount = document.getElementById('settings-pro-count');
        const settingsFlashCount = document.getElementById('settings-flash-count');

        if (status) {
            bar.classList.remove('hidden');
            proRequests.textContent = `${status.pro.count}/100`;
            flashRequests.textContent = `${status.flash.count}/100`;

            if (settingsProCount) settingsProCount.textContent = status.pro.count;
            if (settingsFlashCount) settingsFlashCount.textContent = status.flash.count;

            // Check cooldown
            const proCooldown = GeminiClient.getCooldownTime('PRO');
            if (proCooldown > 0) {
                cooldownTimer.classList.remove('hidden');
                cooldownValue.textContent = `${proCooldown}s`;
            } else {
                cooldownTimer.classList.add('hidden');
            }
        }
    }

    /**
     * Start cooldown countdown
     */
    function startCooldownCountdown(seconds, onComplete) {
        const cooldownTimer = document.getElementById('cooldown-timer');
        const cooldownValue = document.getElementById('cooldown-value');

        cooldownTimer.classList.remove('hidden');
        let remaining = seconds;

        const interval = setInterval(() => {
            remaining--;
            cooldownValue.textContent = `${remaining}s`;

            if (remaining <= 0) {
                clearInterval(interval);
                cooldownTimer.classList.add('hidden');
                if (onComplete) onComplete();
            }
        }, 1000);

        return interval;
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show loading state
     */
    function showLoading(message = 'Loading...', subMessage = '') {
        const loading = document.getElementById('session-loading');
        const content = document.getElementById('session-content');

        loading.querySelector('.loading-text').textContent = message;
        loading.querySelector('.loading-subtext').textContent = subMessage;

        loading.classList.remove('hidden');
        content.classList.add('hidden');
    }

    /**
     * Hide loading state
     */
    function hideLoading() {
        const loading = document.getElementById('session-loading');
        const content = document.getElementById('session-content');

        loading.classList.add('hidden');
        content.classList.remove('hidden');
    }

    /**
     * Show error toast
     */
    function showError(message) {
        // Simple alert for now - could be enhanced with a toast system
        alert('Error: ' + message);
    }

    /**
     * Show success toast
     */
    function showSuccess(message) {
        // Could be enhanced with a toast system
        console.log('Success:', message);
    }

    // Public API
    return {
        parseSessionPlan,
        renderTaskCard,
        renderTasks,
        copyPrompt,
        completeTask,
        showFeedback,
        renderSessionsList,
        renderGoals,
        updateRateLimitDisplay,
        startCooldownCountdown,
        showLoading,
        hideLoading,
        showError,
        showSuccess,
        escapeHtml
    };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.SessionUI = SessionUI;
}
