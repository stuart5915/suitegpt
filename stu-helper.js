/**
 * Stu Helper Widget - AI-Powered FAQ Chatbot
 * Features: Pre-built FAQ, Gemini AI fallback, Click-to-Explain mode
 */

(function () {
    // Configuration - Gemini API
    const GEMINI_API_KEY = 'AIzaSyAVMyNlk_X6WbZ1iWLDhdBpwHYOtO42zh0'; // Your Gemini key
    const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

    // FAQ Knowledge Base - Used first before AI
    const FAQ = {
        "what is suite": "SUITE is an ecosystem of AI-powered apps built by creators like you! 🚀 You can discover apps, build your own without coding, and earn SUITE tokens along the way.",
        "how do i earn": "There are several ways to earn SUITE tokens:\n\n💰 **Try Apps** - Use apps with active campaigns\n⭐ **Write Reviews** - Give honest feedback\n📺 **Watch Ads** - Quick videos for SUITE\n🛠️ **Build Apps** - Earn from your creations",
        "what are campaigns": "Campaigns are how developers pay users to try their apps. When you see a '💰 Earn SUITE' badge on an app, you can use it and earn tokens! Just meet the minimum requirements (like using the app for 5 minutes).",
        "what are power-ups": "Power-Ups are in-app upgrades you can buy with SUITE tokens. Things like premium features, extra content, or special abilities. Developers earn 70% of each sale!",
        "how do i build an app": "Building an app is easy! 🎨\n\n1. Join our Discord\n2. Go to #the-forge channel\n3. Describe your app idea\n4. Our AI builds it for you!\n\nNo coding required!",
        "what is the dashboard": "The Developer Dashboard (getsuite.app/dashboard) is where you manage your apps, create campaigns, request reviews, and track your SUITE balance. Login with Discord!",
        "how do reviews work": "Developers can pay users for honest reviews:\n\n1. You use the app for the minimum time\n2. Write an honest review\n3. Get paid in SUITE tokens!\n\nLook for the '⭐ Review' badge on apps.",
        "what is suite token": "SUITE is the currency of our ecosystem. Earn it by using apps, writing reviews, or watching ads. Spend it on app features, Power-Ups, or cash out to real money!",
        "how do i get started": "Welcome! Here's how to start:\n\n1. 🎮 Browse apps at getsuite.app/apps\n2. 💰 Earn SUITE at getsuite.app/earn\n3. 🛠️ Build your own at getsuite.app/start-building\n4. 💬 Join our Discord for help!"
    };

    // State
    let isExplainMode = false;
    let explainHighlight = null;

    // Normalize query for matching
    function normalizeQuery(q) {
        return q.toLowerCase().replace(/[?!.,]/g, '').trim();
    }

    // Find FAQ answer
    function findFaqAnswer(query) {
        const normalized = normalizeQuery(query);

        for (const [key, answer] of Object.entries(FAQ)) {
            if (normalized.includes(key) || key.split(' ').every(word => normalized.includes(word))) {
                return answer;
            }
        }

        // Partial keyword matches
        const keywords = {
            'earn': 'how do i earn', 'money': 'how do i earn', 'tokens': 'what is suite token',
            'campaign': 'what are campaigns', 'power': 'what are power-ups',
            'build': 'how do i build an app', 'create': 'how do i build an app',
            'dashboard': 'what is the dashboard', 'review': 'how do reviews work',
            'start': 'how do i get started', 'begin': 'how do i get started'
        };

        for (const [keyword, faqKey] of Object.entries(keywords)) {
            if (normalized.includes(keyword)) return FAQ[faqKey];
        }

        return null; // No FAQ match - will use AI
    }

    // Ask Gemini AI
    async function askGemini(question, context = '') {
        const systemPrompt = `You are Stu, a friendly hamster mascot for SUITE - an ecosystem where anyone can build AI apps without coding and earn SUITE tokens. 

Key facts about SUITE:
- Users can discover and use apps at getsuite.app/apps
- Developers build apps via Discord's #the-forge channel - just describe your idea
- SUITE tokens are earned by: trying apps with campaigns, writing reviews, watching ads
- Developers earn 90% revenue from their apps
- Power-Ups are in-app purchases (devs get 70%)
- Dashboard at getsuite.app/dashboard for managing apps
- All apps are free to use - users spend SUITE tokens

Keep responses short, friendly, and helpful. Use emojis sparingly. If you don't know something, suggest joining the Discord.`;

        const userPrompt = context
            ? `The user clicked on this element and wants to understand it:\n\n"${context}"\n\nExplain what this is in the context of SUITE.`
            : question;

        try {
            const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: systemPrompt },
                            { text: userPrompt }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 300
                    }
                })
            });

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm having trouble thinking right now. Try again or ask in Discord! 💬";
        } catch (error) {
            console.error('Gemini error:', error);
            return "Oops! I couldn't connect to my brain. 🧠 Try asking in our Discord instead!";
        }
    }

    // Create widget HTML
    function createWidget() {
        const widget = document.createElement('div');
        widget.className = 'stu-widget';
        widget.innerHTML = `
            <!-- Speech Bubble - appears on page load -->
            <div class="stu-bubble" id="stuBubble">
                👋 Need help? Ask me anything!
            </div>
            <div class="stu-panel">
                <div class="stu-header">
                    <div class="suite-coin-icon">$</div>
                    <div class="stu-header-text">
                        <h3>SUITE Help</h3>
                        <p>AI-powered assistance</p>
                    </div>
                </div>
                <div class="stu-messages" id="stuMessages">
                    <div class="stu-message stu">
                        Hey! 👋 How can I help you with SUITE today?
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
                <div class="stu-input-area">
                    <input type="text" id="stuInput" placeholder="Type a question..." autocomplete="off">
                    <button id="stuSend" title="Send">➤</button>
                    <button id="stuExplain" title="Click something on the page to explain it">🎯</button>
                </div>
                <a href="https://discord.gg/getsuite" target="_blank" class="stu-discord">
                    💬 Ask in Discord for more help
                </a>
            </div>
            <button class="stu-button" aria-label="Open help chat">
                <img src="/assets/suite-token.png" alt="SUITE" class="suite-coin-btn-img">
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

        msg.innerHTML = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: #ff9500;">$1</a>')
            .replace(/\n/g, '<br>');

        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
    }

    // Show typing indicator
    function showTyping() {
        const messages = document.getElementById('stuMessages');
        const typing = document.createElement('div');
        typing.className = 'stu-message stu stu-typing';
        typing.id = 'stuTyping';
        typing.innerHTML = '<span></span><span></span><span></span>';
        messages.appendChild(typing);
        messages.scrollTop = messages.scrollHeight;
    }

    function hideTyping() {
        const typing = document.getElementById('stuTyping');
        if (typing) typing.remove();
    }

    // Handle question
    async function handleQuestion(question, isElementContext = false) {
        if (!isElementContext) addMessage(question, true);

        // Try FAQ first
        const faqAnswer = findFaqAnswer(question);
        if (faqAnswer && !isElementContext) {
            setTimeout(() => addMessage(faqAnswer), 400);
            return;
        }

        // Use AI for complex questions
        showTyping();
        const aiAnswer = await askGemini(question, isElementContext ? question : '');
        hideTyping();
        addMessage(aiAnswer);
    }

    // Click-to-Explain mode
    function enableExplainMode() {
        isExplainMode = true;
        document.body.style.cursor = 'help';

        // Create highlight overlay
        explainHighlight = document.createElement('div');
        explainHighlight.id = 'stuExplainHighlight';
        explainHighlight.style.cssText = `
            position: fixed; pointer-events: none; border: 3px solid #ff9500;
            border-radius: 8px; background: rgba(255, 149, 0, 0.1);
            z-index: 99998; transition: all 0.15s ease; display: none;
        `;
        document.body.appendChild(explainHighlight);

        // Add label
        const label = document.createElement('div');
        label.id = 'stuExplainLabel';
        label.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(135deg, #ff9500, #ff6b9d); color: white;
            padding: 12px 24px; border-radius: 100px; font-weight: 700;
            font-size: 0.9rem; z-index: 99999; font-family: 'Nunito', sans-serif;
            box-shadow: 0 8px 24px rgba(255, 149, 0, 0.4);
        `;
        label.textContent = '🎯 Click any element to explain it • Press ESC to cancel';
        document.body.appendChild(label);

        addMessage("Click on anything on the page and I'll explain what it is! 🎯", false);
    }

    function disableExplainMode() {
        isExplainMode = false;
        document.body.style.cursor = '';
        document.getElementById('stuExplainHighlight')?.remove();
        document.getElementById('stuExplainLabel')?.remove();
        explainHighlight = null;
    }

    // Initialize
    function init() {
        const widget = createWidget();
        const button = widget.querySelector('.stu-button');
        const pills = widget.querySelectorAll('.stu-pill');
        const input = document.getElementById('stuInput');
        const sendBtn = document.getElementById('stuSend');
        const explainBtn = document.getElementById('stuExplain');

        // Toggle open/close
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            widget.classList.toggle('open');
            if (isExplainMode) disableExplainMode();

            // Hide speech bubble when panel opens
            const bubble = document.getElementById('stuBubble');
            if (bubble) bubble.classList.add('hidden');
        });

        // Speech bubble: show for 8 seconds, then hide
        const bubble = document.getElementById('stuBubble');
        if (bubble) {
            setTimeout(() => {
                bubble.classList.add('hidden');
            }, 8000);
        }

        // Jiggle animation: trigger every 8 seconds (when widget is closed)
        setInterval(() => {
            if (!widget.classList.contains('open')) {
                button.classList.add('jiggle');
                setTimeout(() => {
                    button.classList.remove('jiggle');
                }, 600);
            }
        }, 8000);

        // Quick question pills
        pills.forEach(pill => {
            pill.addEventListener('click', () => handleQuestion(pill.dataset.q));
        });

        // Text input
        const submitQuestion = () => {
            const q = input.value.trim();
            if (q) {
                handleQuestion(q);
                input.value = '';
            }
        };

        sendBtn.addEventListener('click', submitQuestion);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitQuestion();
        });

        // Explain mode button
        explainBtn.addEventListener('click', () => {
            if (isExplainMode) {
                disableExplainMode();
            } else {
                enableExplainMode();
            }
        });

        // Document click for explain mode
        document.addEventListener('click', (e) => {
            if (isExplainMode && !widget.contains(e.target)) {
                e.preventDefault();
                e.stopPropagation();

                const element = e.target;
                const text = element.textContent?.slice(0, 200) || '';
                const tagName = element.tagName.toLowerCase();
                const className = element.className?.toString()?.slice(0, 100) || '';

                const context = `Element: <${tagName}> with class "${className}"\nText/Content: "${text}"`;

                disableExplainMode();
                handleQuestion(context, true);

                return false;
            }

            // Close widget on outside click
            if (!widget.contains(e.target) && widget.classList.contains('open') && !isExplainMode) {
                widget.classList.remove('open');
            }
        }, true);

        // Hover highlight for explain mode
        document.addEventListener('mousemove', (e) => {
            if (!isExplainMode || !explainHighlight) return;

            const target = e.target;
            if (widget.contains(target)) {
                explainHighlight.style.display = 'none';
                return;
            }

            const rect = target.getBoundingClientRect();
            explainHighlight.style.display = 'block';
            explainHighlight.style.top = rect.top + 'px';
            explainHighlight.style.left = rect.left + 'px';
            explainHighlight.style.width = rect.width + 'px';
            explainHighlight.style.height = rect.height + 'px';
        });

        // ESC to cancel explain mode
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isExplainMode) {
                disableExplainMode();
                addMessage("Explain mode cancelled. Ask me anything! 😊", false);
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
