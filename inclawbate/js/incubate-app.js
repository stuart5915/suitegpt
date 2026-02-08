// Inclawbate — Incubation Workflow Controller

import { auth } from './auth.js';
import { claws } from './claws.js';
import { $, $$, getQueryParam, showToast, createElement } from './utils.js';
import { renderMessage, renderSystemMessage } from './chat-renderer.js';
import { renderAssetChecklist, renderAssetPreview, getAssetProgress } from './asset-manager.js';
import { getPhaseIndex, PHASES } from './state-machine.js';

// State
let project = null;
let brandOptions = [];
let assets = [];
let messages = [];
let selectedBrandId = null;
let previewingAsset = null;

// DOM refs
const chatMessages = $('#chatMessages');
const chatInput = $('#chatInput');
const phaseSteps = $$('.stepper-dot');
const phaseLabels = $$('.stepper-label');
const phaseLines = $$('.stepper-line');
const panelBody = $('#panelBody');
const connectBtn = $('#connectWallet');
const startSection = $('#startSection');
const mainSection = $('#mainSection');

// ── Auth ──
function updateAuthState() {
    if (auth.isConnected) {
        claws.setToken(auth.token);
        connectBtn.textContent = auth.wallet.slice(0, 6) + '...' + auth.wallet.slice(-4);
        connectBtn.onclick = () => {
            auth.disconnect();
            updateAuthState();
        };
    } else {
        connectBtn.textContent = 'Connect Wallet';
        connectBtn.onclick = connectWallet;
    }
}

async function connectWallet() {
    try {
        await auth.connect();
        claws.setToken(auth.token);
        updateAuthState();
        checkProject();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Project Loading ──
async function checkProject() {
    const projectId = getQueryParam('project');
    if (projectId && auth.isConnected) {
        await loadProject(projectId);
    } else if (!projectId) {
        showStartView();
    }
}

async function loadProject(projectId) {
    try {
        const data = await claws.getProject(projectId);
        if (!data.success) throw new Error('Failed to load project');

        project = data.project;
        brandOptions = data.brandOptions || [];
        assets = data.assets || [];
        messages = data.recentMessages || [];

        showMainView();
        renderChat();
        updateStepper();
        renderPanel();
    } catch (err) {
        showToast('Failed to load project: ' + err.message, 'error');
        showStartView();
    }
}

async function createNewProject(concept) {
    if (!auth.isConnected) {
        showToast('Connect your wallet first', 'error');
        return;
    }

    try {
        const data = await claws.storeProject({ concept });
        if (!data.success) throw new Error(data.error || 'Failed to create project');

        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('project', data.projectId);
        history.pushState({}, '', url);

        await loadProject(data.projectId);
        showToast('Project created!');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Views ──
function showStartView() {
    if (startSection) startSection.classList.remove('hidden');
    if (mainSection) mainSection.classList.add('hidden');
}

function showMainView() {
    if (startSection) startSection.classList.add('hidden');
    if (mainSection) mainSection.classList.remove('hidden');
}

// ── Chat ──
function renderChat() {
    chatMessages.innerHTML = '';
    messages.forEach(msg => {
        const el = renderMessage(msg);
        chatMessages.appendChild(el);
    });
    scrollChatBottom();
}

function addChatMessage(role, content) {
    const msg = { role, content, createdAt: new Date().toISOString() };
    messages.push(msg);
    const el = renderMessage(msg);
    chatMessages.appendChild(el);
    scrollChatBottom();
}

function scrollChatBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ── Stepper ──
function updateStepper() {
    if (!project) return;
    const currentIdx = getPhaseIndex(project.currentPhase);
    const phases = [PHASES.CONCEPT, PHASES.BUILD, PHASES.LAUNCH, PHASES.GROW];

    phaseSteps.forEach((dot, i) => {
        dot.classList.remove('active', 'complete');
        phaseLabels[i]?.parentElement.classList.remove('active', 'complete');

        if (i < currentIdx) {
            dot.classList.add('complete');
            dot.innerHTML = '&#10003;';
            phaseLabels[i]?.parentElement.classList.add('complete');
        } else if (i === currentIdx) {
            dot.classList.add('active');
            dot.textContent = i + 1;
            phaseLabels[i]?.parentElement.classList.add('active');
        } else {
            dot.textContent = i + 1;
        }
    });

    phaseLines.forEach((line, i) => {
        line.classList.toggle('complete', i < currentIdx);
    });
}

// ── Panel Rendering ──
function renderPanel() {
    if (!project) return;
    panelBody.innerHTML = '';

    switch (project.currentPhase) {
        case PHASES.CONCEPT:
            renderConceptPanel();
            break;
        case PHASES.BUILD:
            renderBuildPanel();
            break;
        case PHASES.LAUNCH:
            renderLaunchPanel();
            break;
        case PHASES.GROW:
            renderGrowPanel();
            break;
    }
}

function renderConceptPanel() {
    if (brandOptions.length === 0) {
        const empty = createElement('div', { className: 'empty-state' });
        empty.innerHTML = `
            <div class="empty-state-icon">&#127912;</div>
            <p class="empty-state-title">Awaiting Brand Options</p>
            <p class="empty-state-desc">An agent will explore your concept and submit brand options for review.</p>
        `;
        panelBody.appendChild(empty);
        return;
    }

    const title = createElement('h3', {
        style: 'margin-bottom: var(--space-md);',
        textContent: 'Choose a Brand'
    });
    panelBody.appendChild(title);

    const grid = createElement('div', { className: 'brand-options-grid' });

    brandOptions.forEach(opt => {
        const card = createElement('div', {
            className: `brand-option-card${selectedBrandId === opt.optionId ? ' selected' : ''}`,
            onClick: () => {
                selectedBrandId = opt.optionId;
                renderPanel();
            }
        });

        card.innerHTML = `
            <div class="brand-option-header">
                <span class="brand-option-name">${opt.name}</span>
                <span class="brand-option-ticker">$${opt.ticker}</span>
            </div>
            <div class="brand-option-tagline">${opt.tagline || ''}</div>
            ${opt.narrative ? `<div class="brand-option-narrative">${opt.narrative}</div>` : ''}
            <div class="brand-option-footer">
                <div class="swatch-row">
                    ${opt.colorPrimary ? `<div class="swatch" style="background:${opt.colorPrimary}"></div>` : ''}
                    ${opt.colorSecondary ? `<div class="swatch" style="background:${opt.colorSecondary}"></div>` : ''}
                </div>
                ${selectedBrandId === opt.optionId ? '<span class="badge badge-primary">Selected</span>' : ''}
            </div>
        `;

        grid.appendChild(card);
    });

    panelBody.appendChild(grid);

    // Approve / Reject buttons
    if (project.subState === 'reviewing') {
        const actions = createElement('div', {
            style: 'display: flex; gap: var(--space-md); margin-top: var(--space-lg);'
        });

        const approveBtn = createElement('button', {
            className: 'btn btn-primary',
            textContent: 'Approve Selected',
            onClick: () => approveBrand()
        });
        approveBtn.disabled = !selectedBrandId;

        const rejectBtn = createElement('button', {
            className: 'btn btn-danger',
            textContent: 'Reject All',
            onClick: () => rejectBrand()
        });

        actions.appendChild(approveBtn);
        actions.appendChild(rejectBtn);
        panelBody.appendChild(actions);
    }
}

function renderBuildPanel() {
    const progress = getAssetProgress(assets);

    const header = createElement('div', {
        style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);'
    });
    header.innerHTML = `
        <h3>Launch Assets</h3>
        <span class="badge ${progress.complete ? 'badge-green' : 'badge-yellow'}">${progress.staged}/${progress.required} required</span>
    `;
    panelBody.appendChild(header);

    const checklist = renderAssetChecklist(assets, (asset) => {
        previewingAsset = asset;
        renderAssetPreviewModal();
    });
    panelBody.appendChild(checklist);

    // Preview area
    if (previewingAsset) {
        const divider = createElement('div', { className: 'divider' });
        panelBody.appendChild(divider);
        const preview = renderAssetPreview(previewingAsset);
        panelBody.appendChild(preview);
    }

    // Approve / Reject buttons
    if (project.subState === 'reviewing') {
        const actions = createElement('div', {
            style: 'display: flex; gap: var(--space-md); margin-top: var(--space-lg);'
        });

        const approveBtn = createElement('button', {
            className: 'btn btn-primary',
            textContent: 'Approve Assets',
            onClick: () => approveAssets()
        });

        const rejectBtn = createElement('button', {
            className: 'btn btn-danger',
            textContent: 'Request Revisions',
            onClick: () => rejectAssets()
        });

        actions.appendChild(approveBtn);
        actions.appendChild(rejectBtn);
        panelBody.appendChild(actions);
    }
}

function renderLaunchPanel() {
    const panel = createElement('div', { className: 'launch-panel' });

    if (project.subState === 'ready') {
        panel.innerHTML = `
            <div class="launch-ready-icon">&#128640;</div>
            <h2 style="margin-bottom: var(--space-sm);">Ready to Launch</h2>
            <p style="color: var(--text-secondary); margin-bottom: var(--space-xl);">
                All assets approved. Hit the button to deploy your token on Base.
            </p>
        `;
        const btn = createElement('button', {
            className: 'launch-btn',
            textContent: 'LAUNCH TOKEN',
            onClick: () => triggerLaunch()
        });
        panel.appendChild(btn);
    } else if (project.subState === 'executing') {
        panel.innerHTML = `
            <div class="spinner spinner-lg" style="margin: 0 auto var(--space-lg);"></div>
            <h2 style="margin-bottom: var(--space-sm);">Launching...</h2>
            <p style="color: var(--text-secondary);">
                Token is being deployed to Base via Clawnch. This takes about 60 seconds.
            </p>
        `;
    }

    panelBody.appendChild(panel);
}

function renderGrowPanel() {
    const panel = createElement('div');
    panel.innerHTML = `
        <h3 style="margin-bottom: var(--space-md);">Growth Dashboard</h3>
        <div class="grow-stats-grid">
            <div class="grow-stat-card">
                <div class="stat-label">Price</div>
                <div class="stat-value">--</div>
            </div>
            <div class="grow-stat-card">
                <div class="stat-label">Market Cap</div>
                <div class="stat-value">--</div>
            </div>
            <div class="grow-stat-card">
                <div class="stat-label">Holders</div>
                <div class="stat-value">--</div>
            </div>
            <div class="grow-stat-card">
                <div class="stat-label">Fees Earned</div>
                <div class="stat-value">--</div>
            </div>
        </div>
        <p style="color: var(--text-dim); font-size: 0.85rem; margin-top: var(--space-lg); text-align: center;">
            Analytics will populate once the token is live on Base.
        </p>
    `;
    panelBody.appendChild(panel);
}

function renderAssetPreviewModal() {
    // Just re-render panel with preview shown
    renderPanel();
}

// ── Actions ──
async function approveBrand() {
    if (!selectedBrandId) return;
    try {
        const data = await claws.approvePhase(project.projectId, 'concept', 'approve', selectedBrandId);
        if (data.success) {
            project = data.project;
            addChatMessage('system', data.message);
            updateStepper();
            renderPanel();
            showToast('Brand approved!');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function rejectBrand() {
    const feedback = prompt('Feedback for the agent (optional):');
    try {
        const data = await claws.approvePhase(project.projectId, 'concept', 'reject', null, feedback);
        if (data.success) {
            project = data.project;
            brandOptions = [];
            selectedBrandId = null;
            addChatMessage('system', data.message);
            renderPanel();
            showToast('Brand rejected — agent will revise');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function approveAssets() {
    try {
        const data = await claws.approvePhase(project.projectId, 'build', 'approve');
        if (data.success) {
            project = data.project;
            addChatMessage('system', data.message);
            updateStepper();
            renderPanel();
            showToast('Assets approved! Ready to launch.');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function rejectAssets() {
    const feedback = prompt('Feedback for the agent (optional):');
    try {
        const data = await claws.approvePhase(project.projectId, 'build', 'reject', null, feedback);
        if (data.success) {
            project = data.project;
            addChatMessage('system', data.message);
            renderPanel();
            showToast('Assets sent back for revision');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function triggerLaunch() {
    if (!confirm('Launch token? This will deploy on Base and cannot be undone.')) return;
    try {
        const data = await claws.triggerLaunch(project.projectId);
        if (data.success) {
            project.subState = 'executing';
            addChatMessage('system', 'Launch initiated! Deploying token on Base...');
            renderPanel();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Chat Input ──
function handleChatSubmit() {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    addChatMessage('human', text);
}

// ── Mobile Tabs ──
function setupMobileTabs() {
    const chatTab = $('#mobileTabChat');
    const panelTab = $('#mobileTabPanel');
    const chatView = $('.incubate-chat');
    const panelView = $('.incubate-panel');

    if (!chatTab || !panelTab) return;

    chatTab.addEventListener('click', () => {
        chatTab.classList.add('active');
        panelTab.classList.remove('active');
        chatView.classList.remove('hidden');
        panelView.classList.add('hidden');
    });

    panelTab.addEventListener('click', () => {
        panelTab.classList.add('active');
        chatTab.classList.remove('active');
        panelView.classList.remove('hidden');
        chatView.classList.add('hidden');
    });
}

// ── Init ──
function init() {
    updateAuthState();
    setupMobileTabs();

    // Chat input
    if (chatInput) {
        chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatSubmit();
            }
        });
    }

    const sendBtn = $('#chatSendBtn');
    if (sendBtn) sendBtn.addEventListener('click', handleChatSubmit);

    // Create project form
    const createForm = $('#createProjectForm');
    if (createForm) {
        createForm.addEventListener('submit', e => {
            e.preventDefault();
            const concept = $('#conceptInput').value.trim();
            if (concept.length >= 10) createNewProject(concept);
        });
    }

    // Check for existing project
    checkProject();
}

init();
