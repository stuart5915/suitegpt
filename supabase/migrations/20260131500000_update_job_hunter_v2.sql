UPDATE user_apps SET code = '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Job Hunter | SUITE</title>
    <link rel="icon" type="image/png" href="/assets/suite-logo-new.png">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg: #0a0a0a;
            --bg-card: #141414;
            --bg-card-hover: #1a1a1a;
            --bg-input: #111;
            --border: #222;
            --border-hover: #333;
            --text: #f0f0f0;
            --text-dim: #888;
            --text-muted: #555;
            --accent: #6366f1;
            --accent-soft: rgba(99,102,241,0.12);
            --green: #22c55e;
            --green-soft: rgba(34,197,94,0.12);
            --orange: #f59e0b;
            --orange-soft: rgba(245,158,11,0.12);
            --red: #ef4444;
            --red-soft: rgba(239,68,68,0.12);
            --blue: #3b82f6;
            --blue-soft: rgba(59,130,246,0.12);
            --purple: #a855f7;
            --purple-soft: rgba(168,85,247,0.12);
        }
        body {
            font-family: ''Nunito'', sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
        }

        /* Top Nav */
        .top-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 24px;
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            background: var(--bg);
            z-index: 100;
        }
        .top-bar-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .top-bar-logo {
            font-size: 1.3rem;
            font-weight: 800;
            background: linear-gradient(135deg, var(--accent), var(--purple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .top-bar-divider {
            width: 1px;
            height: 20px;
            background: var(--border);
        }
        .top-bar-title {
            font-size: 0.95rem;
            color: var(--text-dim);
            font-weight: 600;
        }

        /* Tab Nav */
        .tab-nav {
            display: flex;
            gap: 4px;
            padding: 12px 24px;
            border-bottom: 1px solid var(--border);
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
        }
        .tab-btn {
            padding: 8px 18px;
            border-radius: 10px;
            border: 1px solid transparent;
            background: transparent;
            color: var(--text-dim);
            font-family: inherit;
            font-size: 0.88rem;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
        }
        .tab-btn:hover { background: var(--bg-card); color: var(--text); }
        .tab-btn.active {
            background: var(--accent-soft);
            color: var(--accent);
            border-color: rgba(99,102,241,0.2);
        }

        /* Main Content */
        .main { padding: 24px; max-width: 1200px; margin: 0 auto; }
        .tab-panel { display: none; }
        .tab-panel.active { display: block; }

        /* Section Headers */
        .section-title {
            font-size: 1.1rem;
            font-weight: 700;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .section-title .count {
            font-size: 0.75rem;
            background: var(--accent-soft);
            color: var(--accent);
            padding: 2px 8px;
            border-radius: 6px;
            font-weight: 700;
        }

        /* Tag styles */
        .tag-hot { background: var(--red-soft); color: var(--red); }
        .tag-good { background: var(--green-soft); color: var(--green); }
        .tag-new { background: var(--blue-soft); color: var(--blue); }
        .tag-niche { background: var(--purple-soft); color: var(--purple); }

        /* Resume Section */
        .resume-section {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 20px;
        }
        .resume-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
        }
        .resume-header h3 {
            font-size: 1rem;
            font-weight: 700;
        }
        textarea, input[type="text"], input[type="url"] {
            width: 100%;
            padding: 12px 14px;
            border-radius: 12px;
            border: 1px solid var(--border);
            background: var(--bg-input);
            color: var(--text);
            font-family: inherit;
            font-size: 0.9rem;
            resize: vertical;
            transition: border-color 0.2s;
        }
        textarea:focus, input:focus {
            outline: none;
            border-color: var(--accent);
        }
        .textarea-large { min-height: 200px; }
        .textarea-sm { min-height: 100px; }

        .btn {
            padding: 10px 20px;
            border-radius: 10px;
            border: none;
            font-family: inherit;
            font-weight: 700;
            font-size: 0.88rem;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn-primary {
            background: linear-gradient(135deg, var(--accent), var(--purple));
            color: white;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-secondary {
            background: var(--bg-card);
            color: var(--text);
            border: 1px solid var(--border);
        }
        .btn-secondary:hover { border-color: var(--border-hover); }
        .btn-sm { padding: 6px 14px; font-size: 0.8rem; }
        .btn-ghost {
            background: transparent;
            color: var(--text-dim);
            border: none;
            padding: 6px 12px;
        }
        .btn-ghost:hover { color: var(--text); }

        .form-group { margin-bottom: 16px; }
        .form-label {
            display: block;
            font-size: 0.8rem;
            font-weight: 700;
            color: var(--text-dim);
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }

        /* AI Output */
        .ai-output {
            background: var(--bg-input);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
            min-height: 150px;
            font-size: 0.9rem;
            line-height: 1.7;
            white-space: pre-wrap;
            color: var(--text);
            margin-top: 12px;
        }
        .ai-output:empty::before {
            content: ''AI output will appear here...'';
            color: var(--text-muted);
        }

        /* Pipeline / Tracker */
        .pipeline-cols {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
        }
        .pipeline-col {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 14px;
            min-height: 200px;
        }
        .pipeline-col-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border);
        }
        .pipeline-col-title {
            font-size: 0.82rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .pipeline-col-count {
            font-size: 0.72rem;
            padding: 2px 7px;
            border-radius: 6px;
            font-weight: 700;
        }
        .pipeline-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 12px;
            margin-bottom: 8px;
            cursor: default;
        }
        .pipeline-card-company {
            font-weight: 700;
            font-size: 0.88rem;
            margin-bottom: 2px;
        }
        .pipeline-card-role {
            font-size: 0.78rem;
            color: var(--text-dim);
            margin-bottom: 6px;
        }
        .pipeline-card-date {
            font-size: 0.7rem;
            color: var(--text-muted);
        }
        .pipeline-card-actions {
            display: flex;
            gap: 4px;
            margin-top: 8px;
        }
        .pipeline-card-actions button {
            padding: 4px 8px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: transparent;
            color: var(--text-dim);
            font-family: inherit;
            font-size: 0.7rem;
            font-weight: 600;
            cursor: pointer;
        }
        .pipeline-card-actions button:hover { background: var(--accent-soft); color: var(--accent); }

        /* Add Application Form */
        .add-app-form {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .add-app-form-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr auto;
            gap: 10px;
            align-items: end;
        }

        /* Checklist */
        .checklist {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .checklist-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 16px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .checklist-item:hover { border-color: var(--border-hover); }
        .checklist-item.done { opacity: 0.5; }
        .checklist-item.done .checklist-title { text-decoration: line-through; }
        .checklist-check {
            width: 22px;
            height: 22px;
            border-radius: 7px;
            border: 2px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin-top: 1px;
            transition: all 0.2s;
        }
        .checklist-item.done .checklist-check {
            background: var(--green);
            border-color: var(--green);
        }
        .checklist-check svg { display: none; }
        .checklist-item.done .checklist-check svg { display: block; }
        .checklist-title {
            font-weight: 700;
            font-size: 0.92rem;
            margin-bottom: 2px;
        }
        .checklist-desc {
            font-size: 0.8rem;
            color: var(--text-dim);
            line-height: 1.4;
        }

        /* Stats Bar */
        .stats-bar {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 24px;
        }
        .stat-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 18px;
            text-align: center;
        }
        .stat-value {
            font-size: 1.8rem;
            font-weight: 800;
        }
        .stat-label {
            font-size: 0.78rem;
            color: var(--text-dim);
            font-weight: 600;
            margin-top: 4px;
        }

        /* Loading spinner */
        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.2);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Copy button */
        .copy-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            padding: 4px 10px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: var(--bg-card);
            color: var(--text-dim);
            font-size: 0.72rem;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
        }
        .copy-btn:hover { color: var(--text); }
        .ai-output-wrap { position: relative; }

        /* Role cards for resume */
        .role-cards {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 12px;
            margin-bottom: 24px;
        }
        .role-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 18px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .role-card:hover { border-color: var(--accent); background: var(--bg-card-hover); }
        .role-card.selected { border-color: var(--accent); background: var(--accent-soft); }
        .role-card-title { font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; }
        .role-card-desc { font-size: 0.8rem; color: var(--text-dim); line-height: 1.4; }
        .role-card-fit {
            display: inline-block;
            margin-top: 8px;
            font-size: 0.72rem;
            padding: 3px 8px;
            border-radius: 6px;
            font-weight: 700;
        }

        /* ===== BOARD BROWSER STYLES ===== */
        .board-tabs {
            display: flex;
            gap: 6px;
            padding: 0 0 16px 0;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
            flex-wrap: nowrap;
        }
        .board-tabs::-webkit-scrollbar { height: 4px; }
        .board-tabs::-webkit-scrollbar-track { background: transparent; }
        .board-tabs::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
        .board-tab {
            padding: 8px 16px;
            border-radius: 10px;
            border: 1px solid var(--border);
            background: var(--bg-card);
            color: var(--text-dim);
            font-family: inherit;
            font-size: 0.82rem;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
        }
        .board-tab:hover { border-color: var(--border-hover); color: var(--text); background: var(--bg-card-hover); }
        .board-tab.active {
            background: var(--accent-soft);
            color: var(--accent);
            border-color: rgba(99,102,241,0.3);
        }
        .board-tab-icon {
            width: 20px;
            height: 20px;
            border-radius: 5px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 0.65rem;
            font-weight: 800;
            flex-shrink: 0;
        }
        .board-iframe-container {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            overflow: hidden;
            margin-bottom: 12px;
            position: relative;
        }
        .board-iframe {
            width: 100%;
            height: 70vh;
            border: none;
            display: block;
            background: #fff;
        }
        .board-fallback {
            display: none;
            text-align: center;
            padding: 80px 20px;
            color: var(--text-dim);
        }
        .board-fallback.visible { display: block; }
        .board-fallback-icon { font-size: 2.5rem; margin-bottom: 12px; }
        .board-fallback-title { font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 8px; }
        .board-fallback-desc { font-size: 0.85rem; margin-bottom: 20px; line-height: 1.5; }
        .board-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        .board-current-label {
            font-size: 0.82rem;
            color: var(--text-dim);
            font-weight: 600;
            margin-right: auto;
        }

        /* Log Application Modal */
        .log-app-overlay {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6);
            z-index: 200;
            align-items: center;
            justify-content: center;
        }
        .log-app-overlay.visible { display: flex; }
        .log-app-modal {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            width: 400px;
            max-width: 90vw;
        }
        .log-app-modal h3 {
            font-size: 1rem;
            font-weight: 700;
            margin-bottom: 16px;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .pipeline-cols { grid-template-columns: 1fr 1fr; }
            .stats-bar { grid-template-columns: 1fr 1fr; }
            .add-app-form-row { grid-template-columns: 1fr; }
            .main { padding: 16px; }
            .board-iframe { height: 55vh; }
        }
        @media (max-width: 480px) {
            .pipeline-cols { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="top-bar">
        <div class="top-bar-left">
            <div class="top-bar-logo">SUITE</div>
            <div class="top-bar-divider"></div>
            <div class="top-bar-title">Job Hunter</div>
        </div>
    </div>

    <div class="tab-nav">
        <button class="tab-btn active" onclick="switchTab(''feed'')">Job Feed</button>
        <button class="tab-btn" onclick="switchTab(''resume'')">Resume Lab</button>
        <button class="tab-btn" onclick="switchTab(''tracker'')">Pipeline</button>
        <button class="tab-btn" onclick="switchTab(''checklist'')">Pre-Apply Checklist</button>
    </div>

    <div class="main">

        <!-- ======= JOB FEED TAB (Board Browser) ======= -->
        <div class="tab-panel active" id="tab-feed">

            <div class="board-tabs" id="boardTabs"></div>

            <div class="board-iframe-container" id="boardIframeContainer">
                <iframe class="board-iframe" id="boardIframe" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation-by-user-activation" allowfullscreen></iframe>
                <div class="board-fallback" id="boardFallback">
                    <div class="board-fallback-icon">&#x1F6AB;</div>
                    <div class="board-fallback-title">This site doesn''t allow embedding</div>
                    <div class="board-fallback-desc">Many job boards block iframe loading for security reasons.<br>Click below to open it in a new tab instead.</div>
                    <button class="btn btn-primary" onclick="openBoardExternal()">Open in New Tab</button>
                </div>
            </div>

            <div class="board-actions">
                <span class="board-current-label" id="boardCurrentLabel">Select a board above</span>
                <button class="btn btn-secondary btn-sm" onclick="openBoardExternal()">Open in New Tab</button>
                <button class="btn btn-primary btn-sm" onclick="showLogApplication()">Log Application</button>
            </div>

            <!-- Job Fit Analyzer -->
            <div class="resume-section" style="margin-top:20px;">
                <div class="resume-header">
                    <h3>Job Fit Analyzer</h3>
                    <button class="btn btn-primary btn-sm" onclick="analyzeJobFit()">Analyze Fit</button>
                </div>
                <div class="form-group">
                    <label class="form-label">Paste job description</label>
                    <textarea class="textarea-sm" id="fitJobDescription" placeholder="Copy a job posting from the board above and paste it here to get an AI analysis of how well you match..."></textarea>
                </div>
                <div class="ai-output-wrap">
                    <div class="ai-output" id="fitOutput"></div>
                    <button class="copy-btn" onclick="copyFitOutput()" style="display:none" id="fitCopyBtn">Copy</button>
                </div>
                <div id="fitAddPipeline" style="display:none;margin-top:12px;">
                    <button class="btn btn-secondary btn-sm" onclick="addFitToPipeline()">Add to Pipeline</button>
                </div>
            </div>
        </div>

        <!-- Log Application Modal -->
        <div class="log-app-overlay" id="logAppOverlay" onclick="if(event.target===this)hideLogApplication()">
            <div class="log-app-modal">
                <h3>Log Application</h3>
                <div class="form-group">
                    <label class="form-label">Company</label>
                    <input type="text" id="logAppCompany" placeholder="Company name">
                </div>
                <div class="form-group">
                    <label class="form-label">Role</label>
                    <input type="text" id="logAppRole" placeholder="e.g. Developer Relations">
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button class="btn btn-secondary btn-sm" onclick="hideLogApplication()">Cancel</button>
                    <button class="btn btn-primary btn-sm" onclick="submitLogApplication()">Add to Pipeline</button>
                </div>
            </div>
        </div>

        <!-- ======= RESUME LAB TAB ======= -->
        <div class="tab-panel" id="tab-resume">

            <div class="section-title">Target Role</div>
            <div class="role-cards" id="roleCards">
                <div class="role-card selected" onclick="selectRole(this, ''devrel'')" data-role="devrel">
                    <div class="role-card-title">Developer Relations</div>
                    <div class="role-card-desc">Build demos, write docs, give talks, grow community. Your SuiteGPT work is the perfect portfolio piece.</div>
                    <span class="role-card-fit tag-hot">Best Fit</span>
                </div>
                <div class="role-card" onclick="selectRole(this, ''solutions'')" data-role="solutions">
                    <div class="role-card-title">Solutions Engineer</div>
                    <div class="role-card-desc">Pre-sales technical work. Understand customer needs, build integrations, demo products.</div>
                    <span class="role-card-fit tag-good" style="background:var(--green-soft);color:var(--green)">Good Fit</span>
                </div>
                <div class="role-card" onclick="selectRole(this, ''applied'')" data-role="applied">
                    <div class="role-card-title">Applied AI Engineer</div>
                    <div class="role-card-desc">Build products with AI APIs. Not ML research — making AI useful in real apps.</div>
                    <span class="role-card-fit tag-good" style="background:var(--green-soft);color:var(--green)">Good Fit</span>
                </div>
                <div class="role-card" onclick="selectRole(this, ''product'')" data-role="product">
                    <div class="role-card-title">Product Engineer</div>
                    <div class="role-card-desc">Full-stack with product sense. Ship features end-to-end. Startup-oriented.</div>
                    <span class="role-card-fit tag-good" style="background:var(--green-soft);color:var(--green)">Good Fit</span>
                </div>
            </div>

            <div class="resume-section">
                <div class="resume-header">
                    <h3>Generate Resume for Role</h3>
                    <button class="btn btn-primary btn-sm" onclick="generateResume()">
                        Generate Resume
                    </button>
                </div>
                <div class="form-group">
                    <label class="form-label">Your Background (edit to personalize)</label>
                    <textarea class="textarea-sm" id="resumeBackground">Built SuiteGPT — an AI-native app ecosystem (getsuite.app) with 30k+ lines of code. Features: app builder with AI code generation, credit system with on-chain staking, iframe-sandboxed apps with postMessage bridges, Supabase backend, Vercel deployment, governance/proposal system, builder earnings via credit markup.

7 years in DeFi/crypto — built smart contracts (Solidity), token systems, staking rewards, treasury management on Base/Ethereum.

Prior: CNC engineering and woodworking — precision manufacturing, systems thinking.

Tech: JavaScript, HTML/CSS, Solidity, Supabase (Postgres/RPC/Auth), Vercel, REST APIs, Gemini/Groq/Claude API integration, ethers.js, Git.</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Specific Job Posting (optional — paste the job description to tailor)</label>
                    <textarea class="textarea-sm" id="jobPosting" placeholder="Paste a specific job posting here to get a resume tailored to that exact role and company..."></textarea>
                </div>
                <div class="ai-output-wrap">
                    <div class="ai-output" id="resumeOutput"></div>
                    <button class="copy-btn" onclick="copyOutput(''resumeOutput'')" style="display:none" id="resumeCopyBtn">Copy</button>
                </div>
            </div>

            <div class="resume-section">
                <div class="resume-header">
                    <h3>Cover Letter / Cold Outreach</h3>
                    <button class="btn btn-primary btn-sm" onclick="generateOutreach()">
                        Generate Outreach
                    </button>
                </div>
                <div class="form-group">
                    <label class="form-label">Company Name</label>
                    <input type="text" id="outreachCompany" placeholder="e.g. Anthropic, Vercel, Supabase...">
                </div>
                <div class="form-group">
                    <label class="form-label">What to emphasize</label>
                    <input type="text" id="outreachAngle" placeholder="e.g. I built an entire ecosystem using their product...">
                </div>
                <div class="ai-output-wrap">
                    <div class="ai-output" id="outreachOutput"></div>
                    <button class="copy-btn" onclick="copyOutput(''outreachOutput'')" style="display:none" id="outreachCopyBtn">Copy</button>
                </div>
            </div>
        </div>

        <!-- ======= PIPELINE TAB ======= -->
        <div class="tab-panel" id="tab-tracker">
            <div class="stats-bar" id="statsBar">
                <div class="stat-card">
                    <div class="stat-value" id="statApplied" style="color:var(--blue)">0</div>
                    <div class="stat-label">Applied</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="statResponded" style="color:var(--orange)">0</div>
                    <div class="stat-label">Responded</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="statInterview" style="color:var(--purple)">0</div>
                    <div class="stat-label">Interviewing</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="statOffer" style="color:var(--green)">0</div>
                    <div class="stat-label">Offers</div>
                </div>
            </div>

            <div class="add-app-form">
                <div style="font-weight:700; margin-bottom:12px; font-size:0.95rem;">Add Application</div>
                <div class="add-app-form-row">
                    <div class="form-group" style="margin:0">
                        <label class="form-label">Company</label>
                        <input type="text" id="addCompany" placeholder="Anthropic">
                    </div>
                    <div class="form-group" style="margin:0">
                        <label class="form-label">Role</label>
                        <input type="text" id="addRole" placeholder="Developer Relations">
                    </div>
                    <div class="form-group" style="margin:0">
                        <label class="form-label">Link</label>
                        <input type="url" id="addLink" placeholder="https://...">
                    </div>
                    <button class="btn btn-primary" onclick="addApplication()" style="height:42px;">Add</button>
                </div>
            </div>

            <div class="pipeline-cols" id="pipelineCols">
                <div class="pipeline-col">
                    <div class="pipeline-col-header">
                        <span class="pipeline-col-title" style="color:var(--blue)">Applied</span>
                        <span class="pipeline-col-count" style="background:var(--blue-soft);color:var(--blue)" id="colCountApplied">0</span>
                    </div>
                    <div id="colApplied"></div>
                </div>
                <div class="pipeline-col">
                    <div class="pipeline-col-header">
                        <span class="pipeline-col-title" style="color:var(--orange)">Responded</span>
                        <span class="pipeline-col-count" style="background:var(--orange-soft);color:var(--orange)" id="colCountResponded">0</span>
                    </div>
                    <div id="colResponded"></div>
                </div>
                <div class="pipeline-col">
                    <div class="pipeline-col-header">
                        <span class="pipeline-col-title" style="color:var(--purple)">Interviewing</span>
                        <span class="pipeline-col-count" style="background:var(--purple-soft);color:var(--purple)" id="colCountInterview">0</span>
                    </div>
                    <div id="colInterview"></div>
                </div>
                <div class="pipeline-col">
                    <div class="pipeline-col-header">
                        <span class="pipeline-col-title" style="color:var(--green)">Offer</span>
                        <span class="pipeline-col-count" style="background:var(--green-soft);color:var(--green)" id="colCountOffer">0</span>
                    </div>
                    <div id="colOffer"></div>
                </div>
            </div>
        </div>

        <!-- ======= CHECKLIST TAB ======= -->
        <div class="tab-panel" id="tab-checklist">
            <div class="section-title">Before You Apply Anywhere</div>
            <div class="checklist" id="checklistContainer"></div>
        </div>

    </div>

    <script>
        // ===== TAB SWITCHING =====
        function switchTab(tab) {
            document.querySelectorAll(''.tab-panel'').forEach(p => p.classList.remove(''active''));
            document.querySelectorAll(''.tab-btn'').forEach(b => b.classList.remove(''active''));
            document.getElementById(''tab-'' + tab)?.classList.add(''active'');
            const tabs = [''feed'', ''resume'', ''tracker'', ''checklist''];
            const idx = tabs.indexOf(tab);
            document.querySelectorAll(''.tab-btn'')[idx]?.classList.add(''active'');
        }

        // ===== ROLE SELECTION =====
        let selectedRole = ''devrel'';
        function selectRole(el, role) {
            document.querySelectorAll(''.role-card'').forEach(c => c.classList.remove(''selected''));
            el.classList.add(''selected'');
            selectedRole = role;
        }

        // ================================================================
        // ===== JOB BOARD BROWSER =====
        // ================================================================

        // embed: false = known to block iframes (X-Frame-Options / CSP)
        const JOB_BOARDS = [
            { name: ''LinkedIn Jobs'', icon: ''in'', color: ''var(--blue)'', bg: ''var(--blue-soft)'', embed: false, url: ''https://www.linkedin.com/jobs/search/?keywords=developer%20relations%20AI&f_TPR=r604800&f_WT=2'' },
            { name: ''Y Combinator'', icon: ''YC'', color: ''var(--orange)'', bg: ''var(--orange-soft)'', embed: false, url: ''https://www.workatastartup.com/jobs?role=eng&demographic=any&query=AI+developer+relations'' },
            { name: ''Wellfound'', icon: ''WF'', color: ''var(--green)'', bg: ''var(--green-soft)'', embed: false, url: ''https://wellfound.com/jobs?query=developer+relations+AI'' },
            { name: ''Remotive'', icon: ''R'', color: ''var(--green)'', bg: ''var(--green-soft)'', embed: true, url: ''https://remotive.com/remote-jobs/software-dev'' },
            { name: ''Web3.career'', icon: ''W3'', color: ''var(--red)'', bg: ''var(--red-soft)'', embed: true, url: ''https://web3.career/ai-jobs'' },
            { name: ''CryptoJobs'', icon: ''CJ'', color: ''var(--orange)'', bg: ''var(--orange-soft)'', embed: true, url: ''https://cryptocurrencyjobs.co/?query=AI'' },
            { name: ''ai-jobs.net'', icon: ''AI'', color: ''var(--purple)'', bg: ''var(--purple-soft)'', embed: true, url: ''https://ai-jobs.net/'' },
            { name: ''Anthropic'', icon: ''A'', color: ''var(--accent)'', bg: ''var(--accent-soft)'', embed: false, url: ''https://www.anthropic.com/careers'' },
            { name: ''OpenAI'', icon: ''O'', color: ''var(--green)'', bg: ''var(--green-soft)'', embed: false, url: ''https://openai.com/careers/search'' },
            { name: ''DeepMind'', icon: ''G'', color: ''var(--blue)'', bg: ''var(--blue-soft)'', embed: false, url: ''https://deepmind.google/about/careers/'' },
            { name: ''Hugging Face'', icon: ''HF'', color: ''var(--purple)'', bg: ''var(--purple-soft)'', embed: false, url: ''https://huggingface.co/jobs'' },
            { name: ''Vercel'', icon: ''V'', color: ''var(--green)'', bg: ''var(--green-soft)'', embed: false, url: ''https://vercel.com/careers'' },
            { name: ''Supabase'', icon: ''S'', color: ''var(--blue)'', bg: ''var(--blue-soft)'', embed: false, url: ''https://supabase.com/careers'' },
            { name: ''Replicate'', icon: ''R'', color: ''var(--orange)'', bg: ''var(--orange-soft)'', embed: false, url: ''https://replicate.com/about#careers'' },
            { name: ''Cohere'', icon: ''C'', color: ''var(--red)'', bg: ''var(--red-soft)'', embed: false, url: ''https://cohere.com/careers'' }
        ];

        let activeBoardIndex = -1;

        function renderBoardTabs() {
            const container = document.getElementById(''boardTabs'');
            container.innerHTML = JOB_BOARDS.map((b, i) => `
                <button class="board-tab ${i === activeBoardIndex ? ''active'' : ''''}" onclick="selectBoard(${i})">
                    <span class="board-tab-icon" style="background:${b.bg};color:${b.color};">${b.icon}</span>
                    ${b.name}
                </button>
            `).join('''');
        }

        function selectBoard(index) {
            activeBoardIndex = index;
            const board = JOB_BOARDS[index];
            if (!board) return;

            // Update tab highlighting
            document.querySelectorAll(''.board-tab'').forEach((t, i) => {
                t.classList.toggle(''active'', i === index);
            });

            // Update label
            document.getElementById(''boardCurrentLabel'').textContent = board.name;

            const iframe = document.getElementById(''boardIframe'');
            const fallback = document.getElementById(''boardFallback'');

            if (board.embed) {
                // Site allows iframing — show iframe
                iframe.style.display = ''block'';
                fallback.classList.remove(''visible'');
                iframe.src = board.url;
            } else {
                // Site blocks iframes — show fallback immediately
                iframe.style.display = ''none'';
                iframe.src = ''about:blank'';
                fallback.classList.add(''visible'');
            }
        }

        function openBoardExternal() {
            if (activeBoardIndex >= 0) {
                window.open(JOB_BOARDS[activeBoardIndex].url, ''_blank'');
            }
        }

        function showLogApplication() {
            if (activeBoardIndex < 0) {
                alert(''Select a board first.'');
                return;
            }
            const board = JOB_BOARDS[activeBoardIndex];
            document.getElementById(''logAppCompany'').value = board.name;
            document.getElementById(''logAppRole'').value = '''';
            document.getElementById(''logAppOverlay'').classList.add(''visible'');
        }

        function hideLogApplication() {
            document.getElementById(''logAppOverlay'').classList.remove(''visible'');
        }

        function submitLogApplication() {
            const company = document.getElementById(''logAppCompany'').value.trim();
            const role = document.getElementById(''logAppRole'').value.trim();
            if (!company || !role) {
                alert(''Company and role are required.'');
                return;
            }

            const apps = getApps();
            if (apps.some(a => a.company === company && a.role === role)) {
                alert(''Already in your pipeline.'');
                return;
            }

            apps.push({
                id: Date.now().toString(),
                company: company,
                role: role,
                link: JOB_BOARDS[activeBoardIndex]?.url || '''',
                stage: ''applied'',
                date: new Date().toLocaleDateString()
            });
            saveApps(apps);
            renderPipeline();
            hideLogApplication();
            alert(`Added ${company} — ${role} to Pipeline!`);
        }


        // ===== RESUME GENERATION =====
        const ROLE_PROMPTS = {
            devrel: ''Developer Relations / Developer Advocacy — emphasize: community building, creating demos and sample apps, writing technical content, public speaking potential, deep product knowledge, ability to translate complex technical concepts for developers'',
            solutions: ''Solutions Engineer — emphasize: technical pre-sales, customer-facing communication, building integrations and POCs, understanding business requirements, full-stack technical breadth'',
            applied: ''Applied AI Engineer — emphasize: building products with AI APIs (Gemini, Groq, Claude), prompt engineering, AI-powered features, full-stack development, shipping AI products to real users'',
            product: ''Product Engineer — emphasize: end-to-end feature ownership, shipping fast, product intuition, full-stack development, user-facing features, startup mentality''
        };

        async function generateResume() {
            const bg = document.getElementById(''resumeBackground'').value.trim();
            const posting = document.getElementById(''jobPosting'').value.trim();
            const output = document.getElementById(''resumeOutput'');
            const copyBtn = document.getElementById(''resumeCopyBtn'');

            if (!bg) { alert(''Add your background info first.''); return; }

            output.textContent = '''';
            copyBtn.style.display = ''none'';
            output.innerHTML = ''<span class="spinner"></span> Generating resume...'';

            const roleContext = ROLE_PROMPTS[selectedRole] || ROLE_PROMPTS.devrel;
            let prompt = `You are an expert resume writer. Create a professional, ATS-friendly resume for someone applying to this type of role:

TARGET ROLE: ${roleContext}

CANDIDATE BACKGROUND:
${bg}

${posting ? `SPECIFIC JOB POSTING TO TAILOR TO:\n${posting}\n\nTailor the resume specifically to match this job posting''s requirements and language.` : ''''}

Format the resume as clean plain text with clear sections:
- HEADER (name placeholder, contact placeholder)
- SUMMARY (3-4 lines, compelling, specific to the target role)
- EXPERIENCE (frame the SuiteGPT work as a real product role, quantify where possible; frame the DeFi work as relevant technical experience; frame CNC as systems/engineering background)
- PROJECTS (SuiteGPT as the headline project with specific technical details)
- SKILLS (organized by category)

Be specific and use strong action verbs. Don''t be generic. Make every line count.`;

            try {
                const resp = await fetch(''https://suitegpt.app/api/gemini'', {
                    method: ''POST'',
                    headers: { ''Content-Type'': ''application/json'' },
                    body: JSON.stringify({
                        prompt,
                        model: ''gemini-3-flash-preview'',
                        generationConfig: { temperature: 0.7, maxOutputTokens: 4000 }
                    })
                });
                const data = await resp.json();
                output.textContent = data.text || ''No output generated.'';
                copyBtn.style.display = ''block'';
            } catch (e) {
                output.textContent = ''Error: '' + e.message;
            }
        }

        // ===== OUTREACH GENERATION =====
        async function generateOutreach() {
            const bg = document.getElementById(''resumeBackground'').value.trim();
            const company = document.getElementById(''outreachCompany'').value.trim();
            const angle = document.getElementById(''outreachAngle'').value.trim();
            const output = document.getElementById(''outreachOutput'');
            const copyBtn = document.getElementById(''outreachCopyBtn'');

            if (!company) { alert(''Enter a company name.''); return; }

            output.textContent = '''';
            copyBtn.style.display = ''none'';
            output.innerHTML = ''<span class="spinner"></span> Generating outreach...'';

            const prompt = `Write a cold outreach email/LinkedIn message for someone reaching out to ${company} about a role.

CANDIDATE BACKGROUND:
${bg || ''Built SuiteGPT, an AI app ecosystem. 7 years in DeFi/crypto. Prior CNC engineering.''}

COMPANY: ${company}
${angle ? `ANGLE TO EMPHASIZE: ${angle}` : ''''}

Write TWO versions:
1. SHORT LINKEDIN MESSAGE (under 300 chars, casual but professional, gets attention)
2. EMAIL (3-4 paragraphs, specific about why this person + this company is a good fit, mentions specific things they''ve built, ends with a clear ask)

Be genuine, not salesy. Show you know the company. Reference specific things built (SuiteGPT, credit systems, smart contracts, etc).`;

            try {
                const resp = await fetch(''https://suitegpt.app/api/gemini'', {
                    method: ''POST'',
                    headers: { ''Content-Type'': ''application/json'' },
                    body: JSON.stringify({
                        prompt,
                        model: ''gemini-3-flash-preview'',
                        generationConfig: { temperature: 0.8, maxOutputTokens: 3000 }
                    })
                });
                const data = await resp.json();
                output.textContent = data.text || ''No output generated.'';
                copyBtn.style.display = ''block'';
            } catch (e) {
                output.textContent = ''Error: '' + e.message;
            }
        }

        function copyOutput(id) {
            const text = document.getElementById(id).textContent;
            navigator.clipboard.writeText(text);
            const btn = document.getElementById(id === ''resumeOutput'' ? ''resumeCopyBtn'' : ''outreachCopyBtn'');
            btn.textContent = ''Copied!'';
            setTimeout(() => btn.textContent = ''Copy'', 1500);
        }

        // ===== APPLICATION TRACKER =====
        function getApps() {
            return JSON.parse(localStorage.getItem(''jh_applications'') || ''[]'');
        }
        function saveApps(apps) {
            localStorage.setItem(''jh_applications'', JSON.stringify(apps));
        }

        function addApplication() {
            const company = document.getElementById(''addCompany'').value.trim();
            const role = document.getElementById(''addRole'').value.trim();
            const link = document.getElementById(''addLink'').value.trim();
            if (!company || !role) { alert(''Company and role required.''); return; }

            const apps = getApps();
            apps.push({
                id: Date.now().toString(),
                company, role, link,
                stage: ''applied'',
                date: new Date().toLocaleDateString()
            });
            saveApps(apps);
            document.getElementById(''addCompany'').value = '''';
            document.getElementById(''addRole'').value = '''';
            document.getElementById(''addLink'').value = '''';
            renderPipeline();
        }

        function moveApp(id, newStage) {
            const apps = getApps();
            const app = apps.find(a => a.id === id);
            if (app) app.stage = newStage;
            saveApps(apps);
            renderPipeline();
        }

        function removeApp(id) {
            saveApps(getApps().filter(a => a.id !== id));
            renderPipeline();
        }

        function renderPipeline() {
            const apps = getApps();
            const stages = [''applied'', ''responded'', ''interview'', ''offer''];
            const colIds = [''colApplied'', ''colResponded'', ''colInterview'', ''colOffer''];
            const countIds = [''colCountApplied'', ''colCountResponded'', ''colCountInterview'', ''colCountOffer''];
            const statIds = [''statApplied'', ''statResponded'', ''statInterview'', ''statOffer''];
            const nextStage = { applied: ''responded'', responded: ''interview'', interview: ''offer'' };
            const nextLabel = { applied: ''Responded'', responded: ''Interview'', interview: ''Offer'' };

            stages.forEach((stage, i) => {
                const col = document.getElementById(colIds[i]);
                const stageApps = apps.filter(a => a.stage === stage);
                document.getElementById(countIds[i]).textContent = stageApps.length;
                document.getElementById(statIds[i]).textContent = stageApps.length;

                col.innerHTML = stageApps.map(a => `
                    <div class="pipeline-card">
                        <div class="pipeline-card-company">${a.company}</div>
                        <div class="pipeline-card-role">${a.role}</div>
                        <div class="pipeline-card-date">${a.date}${a.link ? ` · <a href="${a.link}" target="_blank" style="color:var(--accent)">Link</a>` : ''''}</div>
                        <div class="pipeline-card-actions">
                            ${nextStage[stage] ? `<button onclick="moveApp(''${a.id}'',''${nextStage[stage]}'')">${nextLabel[stage]} &rarr;</button>` : ''''}
                            <button onclick="removeApp(''${a.id}'')">Remove</button>
                        </div>
                    </div>
                `).join('''');
            });
        }

        // ===== CHECKLIST =====
        const CHECKLIST_ITEMS = [
            { id: ''linkedin'', title: ''Update LinkedIn Profile'', desc: ''Headline should say what you build, not a job title. Add SuiteGPT as your current project. Update skills.'' },
            { id: ''portfolio'', title: ''Prepare Portfolio / Demo'', desc: ''Record a 2-3 min Loom walking through SuiteGPT. Show the builder, credit system, and a live app.'' },
            { id: ''github'', title: ''Clean Up GitHub'', desc: ''Pin your best repos. Add READMEs. Make sure commit history tells a story of consistent shipping.'' },
            { id: ''resume_base'', title: ''Create Base Resume'', desc: ''Use the Resume Lab tab to generate a base resume. Save it as a Google Doc you can fork per application.'' },
            { id: ''case_studies'', title: ''Write 2-3 Case Studies'', desc: ''Short write-ups: (1) Credit system architecture, (2) Iframe sandbox + postMessage bridge, (3) Builder earnings flow.'' },
            { id: ''target_list'', title: ''Build Target Company List'', desc: ''Pick 15-20 companies. Mix of dream companies (Anthropic, OpenAI) and realistic ones (Series A startups).'' },
            { id: ''network'', title: ''Identify People to Reach Out To'', desc: ''Find DevRel leads, engineering managers, or founders at target companies. LinkedIn connections > cold applications.'' },
            { id: ''twitter'', title: ''Start Posting About What You Build'', desc: ''Tweet about SuiteGPT, share technical decisions, build in public. DevRel teams notice builders who share.'' },
            { id: ''practice'', title: ''Practice Talking About Your Work'', desc: ''Can you explain what SuiteGPT does in 30 seconds? Can you walk through a technical decision in 5 min? Practice.'' },
            { id: ''apply'', title: ''Start Applying (Aim for 5/week)'', desc: ''Don\''t overthink it. Apply, track in the Pipeline tab, follow up after 5 business days if no response.'' },
        ];

        function getChecked() {
            return JSON.parse(localStorage.getItem(''jh_checklist'') || ''[]'');
        }

        function renderChecklist() {
            const checked = getChecked();
            const container = document.getElementById(''checklistContainer'');
            container.innerHTML = CHECKLIST_ITEMS.map(item => `
                <div class="checklist-item ${checked.includes(item.id) ? ''done'' : ''''}" onclick="toggleCheck(''${item.id}'')">
                    <div class="checklist-check">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                    <div>
                        <div class="checklist-title">${item.title}</div>
                        <div class="checklist-desc">${item.desc}</div>
                    </div>
                </div>
            `).join('''');
        }

        function toggleCheck(id) {
            let checked = getChecked();
            if (checked.includes(id)) {
                checked = checked.filter(c => c !== id);
            } else {
                checked.push(id);
            }
            localStorage.setItem(''jh_checklist'', JSON.stringify(checked));
            renderChecklist();
        }

        // ===== JOB FIT ANALYZER =====
        let lastFitCompany = '''';
        let lastFitRole = '''';

        async function analyzeJobFit() {
            const jobDesc = document.getElementById(''fitJobDescription'').value.trim();
            const bg = document.getElementById(''resumeBackground'')?.value.trim() || '''';
            const output = document.getElementById(''fitOutput'');
            const copyBtn = document.getElementById(''fitCopyBtn'');
            const pipelineBtn = document.getElementById(''fitAddPipeline'');

            if (!jobDesc) { alert(''Paste a job description first.''); return; }
            if (!bg) { alert(''Add your background in the Resume Lab tab first.''); return; }

            output.textContent = '''';
            copyBtn.style.display = ''none'';
            pipelineBtn.style.display = ''none'';
            output.innerHTML = ''<span class="spinner"></span> Analyzing job fit...'';

            const prompt = `You are a career advisor. Analyze how well this candidate fits this job posting.

CANDIDATE BACKGROUND:
${bg}

JOB POSTING:
${jobDesc}

Provide a structured analysis in this exact format:

FIT SCORE: [1-10]/10 — [Strong Fit / Good Fit / Moderate Fit / Weak Fit]

WHY IT''S A FIT:
• [Specific match between candidate background and job requirements]
• [Another match]
• [Continue as needed]

GAPS TO ADDRESS:
• [What''s missing and how to frame it positively]
• [Continue as needed]

APPLICATION APPROACH:
• [How to position yourself for this specific role]
• [What to emphasize in resume/cover letter]
• [Any specific angle or story to lead with]

EXTRACTED INFO:
Company: [company name from the posting]
Role: [job title from the posting]

Be specific — reference actual skills, projects, and experience from the candidate''s background. Don''t be generic.`;

            try {
                const resp = await fetch(''https://suitegpt.app/api/gemini'', {
                    method: ''POST'',
                    headers: { ''Content-Type'': ''application/json'' },
                    body: JSON.stringify({
                        prompt,
                        model: ''gemini-3-flash-preview'',
                        generationConfig: { temperature: 0.7, maxOutputTokens: 3000 }
                    })
                });
                const data = await resp.json();
                const text = data.text || ''No output generated.'';
                output.textContent = text;
                copyBtn.style.display = ''block'';

                // Try to extract company and role for pipeline
                const companyMatch = text.match(/Company:\s*(.+)/i);
                const roleMatch = text.match(/Role:\s*(.+)/i);
                lastFitCompany = companyMatch ? companyMatch[1].trim() : '''';
                lastFitRole = roleMatch ? roleMatch[1].trim() : '''';
                if (lastFitCompany && lastFitRole) {
                    pipelineBtn.style.display = ''block'';
                }
            } catch (e) {
                output.textContent = ''Error: '' + e.message;
            }
        }

        function copyFitOutput() {
            const text = document.getElementById(''fitOutput'').textContent;
            navigator.clipboard.writeText(text);
            const btn = document.getElementById(''fitCopyBtn'');
            btn.textContent = ''Copied!'';
            setTimeout(() => btn.textContent = ''Copy'', 1500);
        }

        function addFitToPipeline() {
            if (!lastFitCompany || !lastFitRole) return;
            const apps = getApps();
            if (apps.some(a => a.company === lastFitCompany && a.role === lastFitRole)) {
                alert(''Already in your pipeline.'');
                return;
            }
            apps.push({
                id: Date.now().toString(),
                company: lastFitCompany,
                role: lastFitRole,
                link: activeBoardIndex >= 0 ? JOB_BOARDS[activeBoardIndex].url : '''',
                stage: ''applied'',
                date: new Date().toLocaleDateString()
            });
            saveApps(apps);
            renderPipeline();
            document.getElementById(''fitAddPipeline'').style.display = ''none'';
            alert(`Added ${lastFitCompany} — ${lastFitRole} to Pipeline!`);
        }

        // ===== INIT =====
        renderBoardTabs();
        selectBoard(0);
        renderPipeline();
        renderChecklist();
    </script>
</body>
</html>
', updated_at = NOW() WHERE id = '11262151-cf35-4105-a886-4422dd7879b8';
