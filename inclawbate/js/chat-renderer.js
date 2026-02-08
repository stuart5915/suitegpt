// Inclawbate — Chat Message Renderer

import { escapeHtml, timeAgo, createElement } from './utils.js';

export function renderMessage(msg) {
    const wrapper = createElement('div', { className: `chat-msg ${msg.role}` });

    if (msg.role !== 'system') {
        const avatar = createElement('div', { className: 'chat-msg-avatar' });
        avatar.textContent = msg.role === 'agent' ? 'A' : 'Y';
        wrapper.appendChild(avatar);
    }

    const body = createElement('div', { className: 'chat-msg-body' });
    const text = createElement('div', { className: 'chat-msg-text' });
    text.innerHTML = escapeHtml(msg.content).replace(/\n/g, '<br>');
    body.appendChild(text);

    if (msg.createdAt) {
        const time = createElement('div', {
            className: 'chat-msg-time',
            textContent: timeAgo(msg.createdAt)
        });
        body.appendChild(time);
    }

    // Render inline brand cards if present
    if (msg.brandOptions && msg.brandOptions.length > 0) {
        const cards = renderBrandCards(msg.brandOptions, msg.onSelectBrand);
        body.appendChild(cards);
    }

    wrapper.appendChild(body);
    return wrapper;
}

export function renderBrandCards(options, onSelect) {
    const container = createElement('div', { className: 'chat-brand-cards' });

    options.forEach(opt => {
        const card = createElement('div', {
            className: `chat-brand-card${opt.selected ? ' selected' : ''}`,
            onClick: () => {
                if (onSelect) onSelect(opt.optionId);
            }
        });

        const name = createElement('div', { className: 'chat-brand-name', textContent: opt.name });
        const ticker = createElement('div', { className: 'chat-brand-ticker', textContent: `$${opt.ticker}` });
        card.appendChild(name);
        card.appendChild(ticker);

        if (opt.tagline) {
            const tagline = createElement('div', { className: 'chat-brand-tagline', textContent: opt.tagline });
            card.appendChild(tagline);
        }

        if (opt.colorPrimary || opt.colorSecondary) {
            const colors = createElement('div', { className: 'chat-brand-colors' });
            if (opt.colorPrimary) {
                colors.appendChild(createElement('div', {
                    className: 'chat-brand-swatch',
                    style: `background: ${opt.colorPrimary}`
                }));
            }
            if (opt.colorSecondary) {
                colors.appendChild(createElement('div', {
                    className: 'chat-brand-swatch',
                    style: `background: ${opt.colorSecondary}`
                }));
            }
            card.appendChild(colors);
        }

        container.appendChild(card);
    });

    return container;
}

export function renderSystemMessage(text) {
    return renderMessage({
        role: 'system',
        content: text,
        createdAt: new Date().toISOString()
    });
}

export function renderLoadingMessage() {
    const wrapper = createElement('div', { className: 'chat-msg agent' });
    const avatar = createElement('div', { className: 'chat-msg-avatar', textContent: 'A' });
    const body = createElement('div', { className: 'chat-msg-body' });
    const spinner = createElement('div', { className: 'spinner' });
    body.appendChild(spinner);
    wrapper.appendChild(avatar);
    wrapper.appendChild(body);
    return wrapper;
}
