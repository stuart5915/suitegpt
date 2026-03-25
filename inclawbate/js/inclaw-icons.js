// InclawIcons — auto-replaces system emoji with custom vector font
// Wraps emoji characters in <span class="ic"> to force InclawIcons font
// Runs once on load + watches for new DOM content (chat messages, etc.)

(function() {
    var EMOJI_RE = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}\u{231A}-\u{231B}\u{23F0}-\u{23FA}\u{2B50}\u{2B55}\u{2705}\u{274C}\u{2764}]/gu;

    function wrapEmojis(root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        while (walker.nextNode()) {
            if (EMOJI_RE.test(walker.currentNode.textContent)) {
                nodes.push(walker.currentNode);
            }
            EMOJI_RE.lastIndex = 0;
        }
        nodes.forEach(function(node) {
            // Skip if already wrapped or inside an .ic span
            if (node.parentElement && node.parentElement.classList.contains('ic')) return;
            // Skip script/style/textarea
            var tag = node.parentElement ? node.parentElement.tagName : '';
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT') return;

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
    }

    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { wrapEmojis(document.body); });
    } else {
        wrapEmojis(document.body);
    }

    // Watch for new content (chat messages, dynamic elements)
    var debounce = null;
    var observer = new MutationObserver(function(mutations) {
        if (debounce) return;
        debounce = setTimeout(function() {
            debounce = null;
            mutations.forEach(function(m) {
                m.addedNodes.forEach(function(n) {
                    if (n.nodeType === 1 && !n.classList.contains('ic')) wrapEmojis(n);
                });
            });
        }, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
