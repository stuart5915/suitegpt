// InclawIcons — auto-replaces system emoji with custom vector font
// Wraps emoji characters in <span class="ic"> to force InclawIcons font

(function() {
    try {
    var EMOJI_RE = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}\u{231A}-\u{231B}\u{23F0}-\u{23FA}\u{2B50}\u{2B55}\u{2705}\u{274C}\u{2764}]/gu;

    // Tags and selectors to skip entirely
    var SKIP_TAGS = { SCRIPT:1, STYLE:1, TEXTAREA:1, INPUT:1, SVG:1, CANVAS:1 };

    var wrapping = false; // prevent observer re-entry

    function shouldSkip(el) {
        if (!el) return true;
        if (SKIP_TAGS[el.tagName]) return true;
        if (el.classList && el.classList.contains('ic')) return true;
        // Skip elements with IDs — they're dynamic content targets (stats, counters, etc.)
        if (el.id) return true;
        // Skip contenteditable
        if (el.isContentEditable) return true;
        return false;
    }

    function wrapEmojis(root) {
        if (wrapping) return;
        wrapping = true;
        try {
            var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
            var nodes = [];
            while (walker.nextNode()) {
                var n = walker.currentNode;
                if (!EMOJI_RE.test(n.textContent)) { EMOJI_RE.lastIndex = 0; continue; }
                EMOJI_RE.lastIndex = 0;
                if (shouldSkip(n.parentElement)) continue;
                // Also check grandparent (emoji might be inside a span inside a stat element)
                if (n.parentElement && shouldSkip(n.parentElement.parentElement)) continue;
                nodes.push(n);
            }
            nodes.forEach(function(node) {
                var html = node.textContent.replace(EMOJI_RE, function(match) {
                    return '<span class="ic">' + match + '</span>';
                });
                if (html !== node.textContent) {
                    var temp = document.createElement('span');
                    temp.innerHTML = html;
                    var parent = node.parentNode;
                    while (temp.firstChild) {
                        parent.insertBefore(temp.firstChild, node);
                    }
                    parent.removeChild(node);
                }
            });
        } finally {
            wrapping = false;
        }
    }

    // Run after everything else has loaded
    setTimeout(function() { wrapEmojis(document.body); }, 500);

    // Watch for new content (chat messages, etc.) — debounced, skips during wrap
    var debounce = null;
    var observer = new MutationObserver(function(mutations) {
        if (wrapping || debounce) return;
        debounce = setTimeout(function() {
            debounce = null;
            mutations.forEach(function(m) {
                m.addedNodes.forEach(function(n) {
                    if (n.nodeType === 1 && !shouldSkip(n)) wrapEmojis(n);
                });
            });
        }, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    } catch(e) { console.error('InclawIcons error:', e); }
})();
