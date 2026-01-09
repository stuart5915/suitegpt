/**
 * Stu Helper Widget - Free FAQ Chatbot
 * A floating mascot help widget with pre-built answers
 */

(function () {
    // FAQ Knowledge Base - Add more Q&A pairs as needed
    const FAQ = {
        "what is suite": "SUITE is an ecosystem of AI-powered apps built by creators like you! 🚀 You can discover apps, build your own without coding, and earn SUITE tokens along the way.",
        "how do i earn": "There are several ways to earn SUITE tokens:\n\n💰 **Try Apps** - Use apps with active campaigns\n⭐ **Write Reviews** - Give honest feedback\n📺 **Watch Ads** - Quick videos for SUITE\n🛠️ **Build Apps** - Earn from your creations",
        "what are campaigns": "Campaigns are how developers pay users to try their apps. When you see a '💰 Earn SUITE' badge on an app, you can use it and earn tokens! Just meet the minimum requirements (like using the app for 5 minutes).",
        "what are power-ups": "Power-Ups are in-app upgrades you can buy with SUITE tokens. Things like premium features, extra content, or special abilities. Developers earn 70% of each sale!",
        "how do i build an app": "Building an app is easy! 🎨\n\n1. Join our Discord\n2. Go to #the-forge channel\n3. Describe your app idea\n4. Our AI builds it for you!\n\nNo coding required!",
        "what is the dashboard": "The Developer Dashboard (getsuite.app/dashboard) is where you manage your apps, create campaigns, request reviews, and track your SUITE balance. Login with Discord!",
        "how do reviews work": "Developers can pay users for honest reviews:\n\n1. You use the app for the minimum time\n2. Write an honest review\n3. Get paid in SUITE tokens!\n\nLook for the '⭐ Review' badge on apps.",
        "what is suite token": "SUITE is the currency of our ecosystem. Earn it by using apps, writing reviews, or watching ads. Spend it on app features, Power-Ups, or cash out to real money!",
        "how do i get started": "Welcome! Here's how to start:\n\n1. 🎮 Browse apps at getsuite.app/apps\n2. 💰 Earn SUITE at getsuite.app/earn\n3. 🛠️ Build your own at getsuite.app/start-building\n4. 💬 Join our Discord for help!",
        "default": "Great question! I don't have a specific answer for that yet. 🤔\n\nFor detailed help, join our Discord community where humans and bots are ready to assist!\n\n[Join Discord →](https://discord.gg/suite)"
    };

    // Normalize query for matching
    function normalizeQuery(q) {
        return q.toLowerCase().replace(/[?!.,]/g, '').trim();
    }

    // Find best matching answer
    function findAnswer(query) {
        const normalized = normalizeQuery(query);

        // Check for keyword matches
        for (const [key, answer] of Object.entries(FAQ)) {
            if (key === 'default') continue;
            if (normalized.includes(key) || key.split(' ').every(word => normalized.includes(word))) {
                return answer;
            }
        }

        // Partial matches
        const keywords = {
            'earn': 'how do i earn',
            'money': 'how do i earn',
            'tokens': 'what is suite token',
            'campaign': 'what are campaigns',
            'power': 'what are power-ups',
            'build': 'how do i build an app',
            'create': 'how do i build an app',
            'dashboard': 'what is the dashboard',
            'review': 'how do reviews work',
            'start': 'how do i get started',
            'begin': 'how do i get started',
            'new': 'how do i get started'
        };

        for (const [keyword, faqKey] of Object.entries(keywords)) {
            if (normalized.includes(keyword)) {
                return FAQ[faqKey];
            }
        }

        return FAQ['default'];
    }

    // Create widget HTML
    function createWidget() {
        const widget = document.createElement('div');
        widget.className = 'stu-widget';
        widget.innerHTML = `
            <div class="stu-panel">
                <div class="stu-header">
                    <img src="/assets/suite-mascot.png" alt="Stu">
                    <div class="stu-header-text">
                        <h3>Hey, I'm Stu! 👋</h3>
                        <p>Ask me anything about SUITE</p>
                    </div>
                </div>
                <div class="stu-messages" id="stuMessages">
                    <div class="stu-message stu">
                        Hi there! 🎉 I'm Stu, your SUITE guide. Click a question below or type your own!
                    </div>
                </div>
                <div class="stu-quick">
                    <div class="stu-quick-label">Quick Questions</div>
                    <div class="stu-pills">
                        <button class="stu-pill" data-q="What is SUITE?">What is SUITE?</button>
                        <button class="stu-pill" data-q="How do I earn?">How do I earn?</button>
                        <button class="stu-pill" data-q="What are campaigns?">Campaigns?</button>
                        <button class="stu-pill" data-q="How do I build an app?">Build an app</button>
                    </div>
                </div>
                <a href="https://discord.gg/getsuite" target="_blank" class="stu-discord">
                    💬 Ask in Discord for more help
                </a>
            </div>
            <button class="stu-button" aria-label="Open help chat">
                <img src="/assets/suite-mascot.png" alt="Stu">
                <span class="stu-close">✕</span>
            </button>
        `;
        document.body.appendChild(widget);
        return widget;
    }

    // Add a message to the chat
    function addMessage(text, isUser = false) {
        const messages = document.getElementById('stuMessages');
        const msg = document.createElement('div');
        msg.className = `stu-message ${isUser ? 'user' : 'stu'}`;

        // Simple markdown-ish parsing
        msg.innerHTML = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: #ff9500;">$1</a>')
            .replace(/\n/g, '<br>');

        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
    }

    // Handle question
    function handleQuestion(question) {
        addMessage(question, true);

        // Small delay for natural feel
        setTimeout(() => {
            const answer = findAnswer(question);
            addMessage(answer);
        }, 400);
    }

    // Initialize
    function init() {
        const widget = createWidget();
        const button = widget.querySelector('.stu-button');
        const pills = widget.querySelectorAll('.stu-pill');

        // Toggle open/close
        button.addEventListener('click', () => {
            widget.classList.toggle('open');
        });

        // Quick question pills
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                handleQuestion(pill.dataset.q);
            });
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!widget.contains(e.target) && widget.classList.contains('open')) {
                widget.classList.remove('open');
            }
        });
    }

    // Start when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
