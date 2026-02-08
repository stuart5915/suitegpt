// Inclawbate — Asset Manager UI

import { createElement } from './utils.js';

const ASSET_LABELS = {
    'landing-page': 'Landing Page',
    'logo': 'Logo Image',
    'launch-post': 'Launch Post',
    'dexscreener-profile': 'DexScreener Profile',
    'twitter-profile': 'Twitter Profile',
    'content-calendar': 'Content Calendar',
    'farcaster-profile': 'Farcaster Profile'
};

const REQUIRED = ['landing-page', 'logo', 'launch-post', 'dexscreener-profile'];
const OPTIONAL = ['twitter-profile', 'content-calendar', 'farcaster-profile'];

export function renderAssetChecklist(assets, onPreview) {
    const container = createElement('div', { className: 'assets-checklist' });

    const allTypes = [...REQUIRED, ...OPTIONAL];

    allTypes.forEach(type => {
        const asset = assets.find(a => a.assetType === type);
        const isRequired = REQUIRED.includes(type);
        const status = asset ? 'staged' : 'pending';

        const item = createElement('div', {
            className: 'asset-item',
            onClick: () => { if (asset && onPreview) onPreview(asset); }
        });

        const left = createElement('div', { className: 'asset-item-left' });
        const dot = createElement('div', { className: `asset-status-dot ${status}` });
        const name = createElement('span', {
            className: 'asset-item-name',
            textContent: ASSET_LABELS[type] || type
        });

        left.appendChild(dot);
        left.appendChild(name);
        item.appendChild(left);

        // Badge
        let badgeText, badgeClass;
        if (asset) {
            badgeText = 'Staged';
            badgeClass = 'badge badge-green';
        } else if (isRequired) {
            badgeText = 'Required';
            badgeClass = 'badge badge-yellow';
        } else {
            badgeText = 'Optional';
            badgeClass = 'badge badge-neutral';
        }

        const badge = createElement('span', {
            className: badgeClass,
            textContent: badgeText
        });
        item.appendChild(badge);
        container.appendChild(item);
    });

    return container;
}

export function renderAssetPreview(asset) {
    const container = createElement('div', { className: 'card' });

    const header = createElement('div', { className: 'card-header' });
    const title = createElement('h3', {
        className: 'card-title',
        textContent: ASSET_LABELS[asset.assetType] || asset.assetType
    });
    const badge = createElement('span', { className: 'badge badge-green', textContent: 'Staged' });
    header.appendChild(title);
    header.appendChild(badge);
    container.appendChild(header);

    // Content preview based on type
    if (asset.assetType === 'landing-page') {
        const iframe = createElement('iframe', {
            style: 'width: 100%; height: 300px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: white;'
        });
        iframe.srcdoc = asset.content;
        container.appendChild(iframe);
    } else if (asset.assetType === 'logo') {
        const img = createElement('img', {
            src: asset.content,
            style: 'max-width: 200px; border-radius: var(--radius-md);',
            alt: 'Token logo'
        });
        container.appendChild(img);
    } else if (asset.assetType === 'launch-post') {
        const pre = createElement('pre', {
            style: 'background: var(--bg-deepest); padding: var(--space-md); border-radius: var(--radius-md); font-family: var(--font-mono); font-size: 0.8rem; white-space: pre-wrap; color: var(--text-secondary);',
            textContent: asset.content
        });
        container.appendChild(pre);
    } else {
        const content = createElement('div', {
            style: 'font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6;'
        });
        content.textContent = typeof asset.content === 'string' ? asset.content : JSON.stringify(asset.content, null, 2);
        container.appendChild(content);
    }

    return container;
}

export function getAssetProgress(assets) {
    const stagedRequired = REQUIRED.filter(t => assets.some(a => a.assetType === t)).length;
    return {
        required: REQUIRED.length,
        staged: stagedRequired,
        complete: stagedRequired === REQUIRED.length,
        percent: Math.round((stagedRequired / REQUIRED.length) * 100)
    };
}
