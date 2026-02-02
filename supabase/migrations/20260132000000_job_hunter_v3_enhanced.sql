UPDATE user_apps SET code = '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Job Hunter | SUITE</title>
    <link rel="icon" type="image/png" href="/assets/suite-logo-new.png">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&display=swap" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
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
            flex-wrap: wrap;
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

        /* ===== DESIGNED RESUME PREVIEW ===== */
        .resume-preview {
            background: #fff;
            color: #1a1a1a;
            font-family: Georgia, ''Times New Roman'', serif;
            padding: 48px 56px;
            border-radius: 12px;
            border: 1px solid var(--border);
            margin-top: 16px;
            line-height: 1.5;
            max-width: 800px;
        }
        .rp-name {
            font-size: 1.8rem;
            font-weight: 700;
            color: #111;
            margin-bottom: 4px;
            letter-spacing: -0.5px;
        }
        .rp-contact {
            font-size: 0.82rem;
            color: #555;
            margin-bottom: 20px;
            font-family: ''Nunito'', sans-serif;
        }
        .rp-section-title {
            font-size: 0.78rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #333;
            border-bottom: 2px solid #333;
            padding-bottom: 4px;
            margin: 20px 0 10px;
            font-family: ''Nunito'', sans-serif;
        }
        .rp-text {
            font-size: 0.92rem;
            color: #222;
            margin-bottom: 8px;
        }
        .rp-text strong {
            color: #111;
        }
        .rp-bullet {
            margin-left: 20px;
            margin-bottom: 4px;
            font-size: 0.88rem;
            color: #333;
        }
        .resume-preview-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            flex-wrap: wrap;
        }

        /* ===== BULK FIT TABLE ===== */
        .fit-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            font-size: 0.85rem;
        }
        .fit-table th {
            text-align: left;
            font-size: 0.72rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-dim);
            padding: 10px 12px;
            border-bottom: 1px solid var(--border);
        }
        .fit-table td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
        }
        .fit-table tr:hover td {
            background: var(--bg-card-hover);
        }
        .fit-score-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 8px;
            font-weight: 800;
            font-size: 0.82rem;
            min-width: 38px;
            text-align: center;
        }
        .fit-score-high { background: var(--green-soft); color: var(--green); }
        .fit-score-mid { background: var(--orange-soft); color: var(--orange); }
        .fit-score-low { background: var(--red-soft); color: var(--red); }
        .fit-table .fit-why { color: var(--text); font-size: 0.82rem; }
        .fit-table .fit-gap { color: var(--text-dim); font-size: 0.78rem; }
        .fit-table .fit-rank { font-weight: 800; color: var(--text-dim); width: 36px; }
        .fit-table .fit-title-cell { font-weight: 700; white-space: nowrap; }
        .fit-add-btn {
            padding: 3px 8px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: transparent;
            color: var(--text-dim);
            font-family: inherit;
            font-size: 0.7rem;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
        }
        .fit-add-btn:hover { background: var(--accent-soft); color: var(--accent); }

        /* ===== TEMPLATE SELECTOR ===== */
        .template-selector {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin: 16px 0;
        }
        .template-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 18px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
        }
        .template-card:hover { border-color: var(--accent); background: var(--bg-card-hover); }
        .template-card.selected { border-color: var(--accent); background: var(--accent-soft); }
        .template-card-icon {
            font-size: 1.6rem;
            margin-bottom: 8px;
        }
        .template-card-title { font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; }
        .template-card-desc { font-size: 0.78rem; color: var(--text-dim); line-height: 1.4; }

        /* Responsive */
        @media (max-width: 768px) {
            .pipeline-cols { grid-template-columns: 1fr 1fr; }
            .stats-bar { grid-template-columns: 1fr 1fr; }
            .add-app-form-row { grid-template-columns: 1fr; }
            .main { padding: 16px; }
            .board-iframe { height: 55vh; }
            .resume-preview { padding: 24px 20px; }
            .template-selector { grid-template-columns: 1fr; }
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
        <button class="tab-btn" onclick="switchTab(''profile'')">My Profile</button>
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

            <!-- Bulk Fit Scanner -->
            <div class="resume-section" style="margin-top:20px;">
                <div class="resume-header">
                    <h3>Bulk Fit Scanner</h3>
                    <button class="btn btn-primary btn-sm" onclick="bulkFitScan()">Scan All</button>
                </div>
                <div class="form-group">
                    <label class="form-label">Paste job listings (raw copy-paste from any job board)</label>
                    <textarea class="textarea-large" id="bulkFitTitles" placeholder="Just paste raw listings from web3.career, LinkedIn, etc. — messy formatting is fine. Example:

Staff Backend Engineer Historical APIs
Helius
3h United States
$88k - $150k

Senior Software Engineer I API
Zinnia
4d Remote
$130k - $150k

The AI will parse out the job titles, companies, and salaries automatically."></textarea>
                </div>
                <div id="bulkFitResults"></div>
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

        <!-- ======= MY PROFILE TAB ======= -->
        <div class="tab-panel" id="tab-profile">
            <div class="section-title">My Profile</div>

            <div class="resume-section">
                <div class="resume-header">
                    <h3>Dump Everything About You</h3>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <span id="profileSaveStatus" style="font-size:0.78rem;color:var(--text-muted);"></span>
                        <button class="btn btn-primary btn-sm" onclick="parseProfile()">Save &amp; Parse Profile</button>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Paste your LinkedIn, Indeed resume, project notes, anything</label>
                    <textarea id="profileRawDump" style="min-height:350px;width:100%;padding:14px;border-radius:12px;border:1px solid var(--border);background:var(--bg-input);color:var(--text);font-family:inherit;font-size:0.88rem;resize:vertical;line-height:1.6;" placeholder="Paste EVERYTHING here. Examples of what to include:

- Your full LinkedIn profile (copy the text from your profile page)
- Your Indeed or other resume (just paste the raw text)
- Job titles, companies, dates for every role you have had
- Descriptions of projects you have built (the more detail the better)
- Technical skills, tools, languages, frameworks
- Education, certifications, courses
- Side projects, open source contributions
- Achievements with numbers (grew X by Y%, built Z with N users)
- Anything unique about your background
- Links to portfolio, GitHub, personal site

Do not worry about formatting. Just dump it all in. The AI will parse and structure everything."></textarea>
                </div>
            </div>

            <!-- Parsed Profile Preview -->
            <div class="resume-section" id="profileParsedSection" style="display:none;">
                <div class="resume-header">
                    <h3>Your Parsed Profile</h3>
                    <button class="btn btn-secondary btn-sm" onclick="parseProfile()">Re-parse</button>
                </div>
                <div id="profileParsedPreview" class="ai-output" style="white-space:pre-wrap;line-height:1.7;"></div>
                <div id="profileTimestamp" style="font-size:0.72rem;color:var(--text-muted);margin-top:8px;"></div>
            </div>
        </div>

        <!-- ======= RESUME LAB TAB ======= -->
        <div class="tab-panel" id="tab-resume">

            <div class="section-title">Target Role</div>
            <div class="role-cards" id="roleCards">
                <div class="role-card selected" onclick="selectRole(this, ''techwriter'')" data-role="techwriter">
                    <div class="role-card-title">Technical Writer</div>
                    <div class="role-card-desc">Whitepapers, docs, API guides, how-to content. Your core skillset with 10+ whitepapers.</div>
                    <span class="role-card-fit tag-hot">Best Fit</span>
                </div>
                <div class="role-card" onclick="selectRole(this, ''marketing'')" data-role="marketing">
                    <div class="role-card-title">Marketing Manager</div>
                    <div class="role-card-desc">Content strategy, SEO, social media, community building, AMAs, brand voice.</div>
                    <span class="role-card-fit tag-good" style="background:var(--green-soft);color:var(--green)">Good Fit</span>
                </div>
                <div class="role-card" onclick="selectRole(this, ''content'')" data-role="content">
                    <div class="role-card-title">Content Strategist</div>
                    <div class="role-card-desc">Content planning, editorial calendars, audience growth, cross-platform strategy.</div>
                    <span class="role-card-fit tag-good" style="background:var(--green-soft);color:var(--green)">Good Fit</span>
                </div>
                <div class="role-card" onclick="selectRole(this, ''operations'')" data-role="operations">
                    <div class="role-card-title">Operations / General</div>
                    <div class="role-card-desc">Ops director, project management, cross-functional leadership. Flexible for any role.</div>
                    <span class="role-card-fit tag-good" style="background:var(--green-soft);color:var(--green)">Good Fit</span>
                </div>
            </div>

            <!-- Resume Generator -->
            <div class="resume-section">
                <div class="resume-header">
                    <h3>Generate Resume for Role</h3>
                    <button class="btn btn-primary btn-sm" onclick="generateResume()">
                        Generate Resume
                    </button>
                </div>
                <div class="form-group">
                    <label class="form-label">Your Profile</label>
                    <div id="resumeProfileStatus"></div>
                    <textarea class="textarea-sm" id="resumeBackground" style="display:none;"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Specific Job Posting (optional — paste the job description to tailor)</label>
                    <textarea class="textarea-sm" id="jobPosting" placeholder="Paste a specific job posting here to get a resume tailored to that exact role and company..."></textarea>
                </div>
                <div class="ai-output-wrap">
                    <div class="ai-output" id="resumeOutput"></div>
                    <button class="copy-btn" onclick="copyOutput(''resumeOutput'')" style="display:none" id="resumeCopyBtn">Copy</button>
                </div>

                <!-- Template Selector + Designed Resume Preview (hidden until generated) -->
                <div id="resumePreviewSection" style="display:none;">
                    <div style="margin-top:24px;margin-bottom:8px;">
                        <h3 style="font-size:1rem;font-weight:700;margin-bottom:4px;">Resume Template</h3>
                        <div class="template-selector">
                            <div class="template-card selected" onclick="selectTemplate(''classic'', this)">
                                <div class="template-card-icon">&#x1F4DC;</div>
                                <div class="template-card-title">Classic</div>
                                <div class="template-card-desc">Single-column, serif font, traditional layout with centered header</div>
                            </div>
                            <div class="template-card" onclick="selectTemplate(''modern'', this)">
                                <div class="template-card-icon">&#x1F4CA;</div>
                                <div class="template-card-title">Modern</div>
                                <div class="template-card-desc">Two-column sidebar with dark left panel and clean right side</div>
                            </div>
                            <div class="template-card" onclick="selectTemplate(''minimal'', this)">
                                <div class="template-card-icon">&#x2728;</div>
                                <div class="template-card-title">Minimal</div>
                                <div class="template-card-desc">Sans-serif, generous whitespace, subtle accent color</div>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                        <h3 style="font-size:1rem;font-weight:700;">Preview</h3>
                        <div class="resume-preview-actions">
                            <button class="btn btn-secondary btn-sm" onclick="toggleResumeView()">Toggle Plain / Designed</button>
                            <button class="btn btn-primary btn-sm" onclick="downloadResumePDF()">Download PDF</button>
                        </div>
                    </div>
                    <div class="resume-preview" id="resumePreviewContent"></div>
                </div>
            </div>

            <!-- Cover Letter Generator -->
            <div class="resume-section">
                <div class="resume-header">
                    <h3>Cover Letter Generator</h3>
                    <button class="btn btn-primary btn-sm" onclick="generateCoverLetter()">
                        Generate Cover Letter
                    </button>
                </div>
                <div class="form-group">
                    <label class="form-label">Company Name</label>
                    <input type="text" id="coverCompany" placeholder="e.g. Anthropic, Vercel, Supabase...">
                </div>
                <div class="form-group">
                    <label class="form-label">Role Title</label>
                    <input type="text" id="coverRole" placeholder="e.g. Developer Relations Engineer">
                </div>
                <div class="form-group">
                    <label class="form-label">Job Description (paste for best results)</label>
                    <textarea class="textarea-sm" id="coverJobDesc" placeholder="Paste the full job description here to get a tailored cover letter..."></textarea>
                </div>
                <div class="ai-output-wrap">
                    <div class="ai-output" id="coverOutput"></div>
                    <button class="copy-btn" onclick="copyOutput(''coverOutput'')" style="display:none" id="coverCopyBtn">Copy</button>
                </div>
                <div id="coverPreviewSection" style="display:none;">
                    <div class="resume-preview-actions" style="margin-top:12px;">
                        <button class="btn btn-primary btn-sm" onclick="downloadCoverLetterPDF()">Download PDF</button>
                    </div>
                    <div class="resume-preview" id="coverPreviewContent" style="margin-top:12px;"></div>
                </div>
            </div>

            <!-- Cold Outreach (existing) -->
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
            const tabs = [''feed'', ''profile'', ''resume'', ''tracker'', ''checklist''];
            const idx = tabs.indexOf(tab);
            document.querySelectorAll(''.tab-btn'')[idx]?.classList.add(''active'');
        }

        // ===== PROFILE SYSTEM =====
        function getProfileBg() {
            return localStorage.getItem(''jh_profile_parsed'') || localStorage.getItem(''jh_profile_raw'') || '''';
        }

        function initProfile() {
            // Load saved raw dump
            const raw = localStorage.getItem(''jh_profile_raw'') || '''';
            const parsed = localStorage.getItem(''jh_profile_parsed'') || '''';
            const updated = localStorage.getItem(''jh_profile_updated'') || '''';
            const dumpEl = document.getElementById(''profileRawDump'');

            if (raw && dumpEl) dumpEl.value = raw;

            // Show parsed preview if exists
            if (parsed) {
                document.getElementById(''profileParsedSection'').style.display = ''block'';
                document.getElementById(''profileParsedPreview'').textContent = parsed;
                if (updated) {
                    document.getElementById(''profileTimestamp'').textContent = ''Last parsed: '' + new Date(updated).toLocaleString();
                }
            }

            // Auto-save raw text on input (debounced)
            if (dumpEl) {
                let saveTimer;
                dumpEl.addEventListener(''input'', () => {
                    clearTimeout(saveTimer);
                    saveTimer = setTimeout(() => {
                        localStorage.setItem(''jh_profile_raw'', dumpEl.value);
                        const status = document.getElementById(''profileSaveStatus'');
                        if (status) {
                            status.textContent = ''Draft saved'';
                            setTimeout(() => status.textContent = '''', 2000);
                        }
                    }, 1000);
                });
            }

            // Update Resume Lab profile status
            updateResumeLabProfile();
        }

        function updateResumeLabProfile() {
            const parsed = getProfileBg();
            const statusEl = document.getElementById(''resumeProfileStatus'');
            const bgEl = document.getElementById(''resumeBackground'');
            if (!statusEl) return;

            if (parsed) {
                const preview = parsed.length > 300 ? parsed.substring(0, 300) + ''...'' : parsed;
                statusEl.innerHTML = `<div style="background:var(--bg-input);border:1px solid var(--border);border-radius:12px;padding:14px;font-size:0.85rem;color:var(--text-dim);line-height:1.5;max-height:120px;overflow:hidden;white-space:pre-wrap;">${preview.replace(/</g, ''&lt;'')}</div><div style="margin-top:6px;"><button class="btn btn-ghost btn-sm" onclick="switchTab(''profile'')" style="padding-left:0;">Edit in My Profile tab</button></div>`;
                if (bgEl) bgEl.value = parsed;
            } else {
                statusEl.innerHTML = `<div style="background:var(--bg-input);border:1px solid var(--border);border-radius:12px;padding:24px;text-align:center;"><div style="color:var(--text-dim);font-size:0.9rem;margin-bottom:8px;">No profile set up yet</div><button class="btn btn-primary btn-sm" onclick="switchTab(''profile'')">Set Up My Profile</button></div>`;
            }
        }

        async function parseProfile() {
            const raw = document.getElementById(''profileRawDump'').value.trim();
            if (!raw) { alert(''Paste your background info first.''); return; }

            // Save raw immediately
            localStorage.setItem(''jh_profile_raw'', raw);

            const statusEl = document.getElementById(''profileSaveStatus'');
            const previewEl = document.getElementById(''profileParsedPreview'');
            const sectionEl = document.getElementById(''profileParsedSection'');

            statusEl.innerHTML = ''<span class="spinner"></span> Parsing...'';

            const prompt = `You are a professional resume writer. The user has dumped their entire background below as raw text — it may include LinkedIn profile text, Indeed resume, project descriptions, notes, or random info. Parse and structure it.

RAW INPUT:
${raw}

Extract and organize into this EXACT format (use these markers):

===NAME===
[Full name]

===CONTACT===
[email] | [phone] | [location] | [LinkedIn URL] | [GitHub URL] | [portfolio URL]
(Include only what was provided. Use placeholders for missing critical info.)

===SUMMARY===
[Write a compelling 3-4 sentence professional summary based on their strongest qualifications. Make it specific, not generic.]

===EXPERIENCE===
**[Job Title] — [Company]** | [Start Date] - [End Date or Present]
- [Achievement or responsibility — quantify with numbers where possible]
- [Another achievement]

(List ALL positions found. If dates are not provided, note the role anyway.)

===PROJECTS===
**[Project Name]** — [Brief description]
- [Technical detail, tech stack used]
- [Impact, metrics, or notable feature]

(List ALL projects mentioned.)

===SKILLS===
Languages: [list]
Frameworks & Tools: [list]
Platforms: [list]
Other: [list]

===EDUCATION===
[Degree/Cert] — [Institution] | [Year]

IMPORTANT: Extract EVERYTHING mentioned. Do not skip or summarize away details — the more detail preserved, the better the resumes will be. If something does not fit a category, add it to the closest one.`;

            try {
                const resp = await fetch(''https://suitegpt.app/api/gemini'', {
                    method: ''POST'',
                    headers: { ''Content-Type'': ''application/json'' },
                    body: JSON.stringify({
                        prompt,
                        model: ''gemini-3-flash-preview'',
                        generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
                    })
                });
                const data = await resp.json();
                const text = data.text || ''Could not parse profile.'';

                // Save parsed profile
                localStorage.setItem(''jh_profile_parsed'', text);
                localStorage.setItem(''jh_profile_updated'', new Date().toISOString());

                // Show preview
                sectionEl.style.display = ''block'';
                previewEl.textContent = text;
                document.getElementById(''profileTimestamp'').textContent = ''Last parsed: '' + new Date().toLocaleString();
                statusEl.textContent = ''Profile saved!'';
                setTimeout(() => statusEl.textContent = '''', 3000);

                // Update Resume Lab
                updateResumeLabProfile();
            } catch (e) {
                statusEl.textContent = ''Error: '' + e.message;
            }
        }

        // ===== ROLE SELECTION =====
        let selectedRole = ''techwriter'';
        function selectRole(el, role) {
            document.querySelectorAll(''.role-card'').forEach(c => c.classList.remove(''selected''));
            el.classList.add(''selected'');
            selectedRole = role;
        }

        // ================================================================
        // ===== JOB BOARD BROWSER =====
        // ================================================================

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

            document.querySelectorAll(''.board-tab'').forEach((t, i) => {
                t.classList.toggle(''active'', i === index);
            });

            document.getElementById(''boardCurrentLabel'').textContent = board.name;

            const iframe = document.getElementById(''boardIframe'');
            const fallback = document.getElementById(''boardFallback'');

            if (board.embed) {
                iframe.style.display = ''block'';
                fallback.classList.remove(''visible'');
                iframe.src = board.url;
            } else {
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
            techwriter: ''Technical Writer — emphasize: whitepapers, documentation (GitBook, API docs), audit reports, press releases, translating complex technical concepts into accessible content, DeFi/blockchain/AI domain expertise, published author'',
            marketing: ''Marketing Manager — emphasize: content strategy, SEO, social media management, community building, brand voice, AMAs, Twitter Spaces, ambassador programs, content calendars, cross-platform campaigns'',
            content: ''Content Strategist — emphasize: editorial planning, audience growth, content lifecycle management, multi-channel strategy, thought leadership, long-form and short-form content, analytics-driven decisions'',
            operations: ''Operations Director / General — emphasize: cross-functional leadership, project management, strategic planning, team coordination, process optimization, stakeholder communication. Adapt freely to the specific job posting if provided''
        };

        let lastResumeText = '''';

        async function generateResume() {
            const bg = getProfileBg();
            const posting = document.getElementById(''jobPosting'').value.trim();
            const output = document.getElementById(''resumeOutput'');
            const copyBtn = document.getElementById(''resumeCopyBtn'');

            if (!bg) { alert(''Set up your profile in the My Profile tab first.''); return; }

            output.textContent = '''';
            copyBtn.style.display = ''none'';
            document.getElementById(''resumePreviewSection'').style.display = ''none'';
            output.innerHTML = ''<span class="spinner"></span> Generating resume...'';

            const roleContext = ROLE_PROMPTS[selectedRole] || ROLE_PROMPTS.techwriter;
            let prompt = `You are an expert resume writer. Create a professional, ATS-friendly resume.

IMPORTANT RULES:
1. ONLY use facts from the CANDIDATE BACKGROUND below. NEVER invent skills, tools, companies, or achievements that are not mentioned.
2. The candidate''s name is Stuart Hollinger. Email: stuart@suitegpt.app. Location: Cambridge, ON, Canada. LinkedIn: linkedin.com/in/stuart-hollinger. Portfolio: portfolio.suitegpt.app. Telegram: t.me/StuartDeFi.
3. Do NOT include a phone number.
4. Do NOT use markdown formatting (no #, ##, ###, **, *, etc). Use ONLY plain text with the section markers below.

TARGET ROLE TYPE: ${roleContext}

CANDIDATE BACKGROUND:
${bg}

${posting ? `SPECIFIC JOB POSTING TO TAILOR TO:\n${posting}\n\nTailor the resume to match this posting. Emphasize relevant experience from the background. Do NOT invent experience or skills not in the background.` : ''''}

OUTPUT FORMAT — You MUST use these EXACT markers. Each marker on its own line. No markdown. Plain text only:

===NAME===
Stuart Hollinger

===CONTACT===
stuart@suitegpt.app | Cambridge, ON, Canada | linkedin.com/in/stuart-hollinger | portfolio.suitegpt.app

===SUMMARY===
3-4 lines tailored to the target role. Use facts from the background only.

===EXPERIENCE===
Job Title — Company | Date Range
- Achievement bullet point
- Another bullet point

(Include all relevant positions from the background. Do not invent companies or roles.)

===PROJECTS===
Project Name — One-line description
- Detail or achievement
- Another detail

===SKILLS===
Category: skill1, skill2, skill3
Category: skill1, skill2, skill3

Use strong action verbs. Every bullet must be based on real experience from the background. No filler.`;

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
                const text = data.text || ''No output generated.'';
                output.textContent = text;
                copyBtn.style.display = ''block'';
                lastResumeText = text;

                // Render designed preview using selected template
                const resumeData = parseResumeData(text);
                document.getElementById(''resumePreviewContent'').innerHTML = renderResumeTemplate(resumeData, selectedTemplate);
                document.getElementById(''resumePreviewSection'').style.display = ''block'';
            } catch (e) {
                output.textContent = ''Error: '' + e.message;
            }
        }

        // ===== TEMPLATE SYSTEM =====
        let selectedTemplate = ''classic'';

        function selectTemplate(template, el) {
            document.querySelectorAll(''.template-card'').forEach(c => c.classList.remove(''selected''));
            el.classList.add(''selected'');
            selectedTemplate = template;
            // Re-render if we have resume text
            if (lastResumeText) {
                const data = parseResumeData(lastResumeText);
                document.getElementById(''resumePreviewContent'').innerHTML = renderResumeTemplate(data, template);
            }
        }

        // ===== PARSE RESUME TEXT INTO STRUCTURED DATA =====
        function parseResumeData(text) {
            const data = { name: '''', contact: '''', summary: '''', experience: [], projects: [], skills: [], education: [] };

            // Try structured markers first
            const nameMatch = text.match(/===NAME===\s*\n([^\n=]+)/);
            const contactMatch = text.match(/===CONTACT===\s*\n([^\n=]+)/);
            const summaryMatch = text.match(/===SUMMARY===\s*\n([\s\S]*?)(?=\n===|$)/);
            const expMatch = text.match(/===EXPERIENCE===\s*\n([\s\S]*?)(?=\n===|$)/);
            const projMatch = text.match(/===PROJECTS===\s*\n([\s\S]*?)(?=\n===|$)/);
            const skillsMatch = text.match(/===SKILLS===\s*\n([\s\S]*?)(?=\n===|$)/);

            if (nameMatch) data.name = nameMatch[1].trim().replace(/\*\*/g, '''');
            if (contactMatch) data.contact = contactMatch[1].trim().replace(/\*\*/g, '''');
            if (summaryMatch) data.summary = summaryMatch[1].trim().replace(/\*\*/g, '''');

            // Parse experience entries
            if (expMatch) {
                const expText = expMatch[1].trim();
                const entries = expText.split(/\n(?=\*\*)/);
                entries.forEach(entry => {
                    const lines = entry.split(''\n'').filter(l => l.trim());
                    if (!lines.length) return;
                    const titleLine = lines[0].replace(/\*\*/g, '''').trim();
                    const bullets = lines.slice(1).filter(l => /^[\-\u2022\*]\s/.test(l.trim())).map(l => l.trim().replace(/^[\-\u2022\*]\s*/, ''''));
                    if (titleLine) data.experience.push({ title: titleLine, bullets });
                });
            }

            // Parse projects
            if (projMatch) {
                const projText = projMatch[1].trim();
                const entries = projText.split(/\n(?=\*\*)/);
                entries.forEach(entry => {
                    const lines = entry.split(''\n'').filter(l => l.trim());
                    if (!lines.length) return;
                    const titleLine = lines[0].replace(/\*\*/g, '''').trim();
                    const bullets = lines.slice(1).filter(l => /^[\-\u2022\*]\s/.test(l.trim())).map(l => l.trim().replace(/^[\-\u2022\*]\s*/, ''''));
                    if (titleLine) data.projects.push({ title: titleLine, bullets });
                });
            }

            // Parse skills
            if (skillsMatch) {
                const skillLines = skillsMatch[1].trim().split(''\n'').filter(l => l.trim());
                skillLines.forEach(line => {
                    const clean = line.replace(/\*\*/g, '''').replace(/^[\-\u2022\*]\s*/, '''').trim();
                    if (clean) data.skills.push(clean);
                });
            }

            // Fallback: if no markers found, use legacy parsing
            if (!nameMatch && !summaryMatch) {
                return parseResumeDataFallback(text);
            }

            return data;
        }

        function parseResumeDataFallback(text) {
            const data = { name: '''', contact: '''', summary: '''', experience: [], projects: [], skills: [], education: [] };
            const lines = text.split(''\n'');
            let currentSection = '''';
            let currentEntry = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const cleanLine = line.replace(/\*\*/g, '''').replace(/^#+\s*/, '''');

                // Detect section headers
                if (/^(SUMMARY|PROFESSIONAL SUMMARY)/i.test(cleanLine)) { currentSection = ''summary''; continue; }
                if (/^(EXPERIENCE|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE)/i.test(cleanLine)) { currentSection = ''experience''; currentEntry = null; continue; }
                if (/^(PROJECTS|KEY PROJECTS)/i.test(cleanLine)) { currentSection = ''projects''; currentEntry = null; continue; }
                if (/^(SKILLS|TECHNICAL SKILLS)/i.test(cleanLine)) { currentSection = ''skills''; continue; }
                if (/^(EDUCATION)/i.test(cleanLine)) { currentSection = ''education''; continue; }
                if (/^(HEADER|CONTACT)/i.test(cleanLine)) { currentSection = ''header''; continue; }

                // Name detection (first meaningful line)
                if (!data.name && !currentSection && cleanLine.length < 60) {
                    data.name = cleanLine;
                    continue;
                }
                if (data.name && !currentSection && (cleanLine.includes(''@'') || cleanLine.includes(''|'') || cleanLine.includes(''linkedin''))) {
                    data.contact = cleanLine;
                    continue;
                }
                if (currentSection === ''header'' && !data.name) { data.name = cleanLine; continue; }
                if (currentSection === ''header'' && data.name) { data.contact = cleanLine; currentSection = ''''; continue; }

                if (currentSection === ''summary'') {
                    data.summary += (data.summary ? '' '' : '''') + cleanLine;
                } else if (currentSection === ''experience'') {
                    if (/^[\-\u2022\*]\s/.test(line) && currentEntry) {
                        currentEntry.bullets.push(line.replace(/^[\-\u2022\*]\s*/, ''''));
                    } else if (cleanLine.length > 5) {
                        currentEntry = { title: cleanLine, bullets: [] };
                        data.experience.push(currentEntry);
                    }
                } else if (currentSection === ''projects'') {
                    if (/^[\-\u2022\*]\s/.test(line) && currentEntry) {
                        currentEntry.bullets.push(line.replace(/^[\-\u2022\*]\s*/, ''''));
                    } else if (cleanLine.length > 5) {
                        currentEntry = { title: cleanLine, bullets: [] };
                        data.projects.push(currentEntry);
                    }
                } else if (currentSection === ''skills'') {
                    const clean = line.replace(/^[\-\u2022\*]\s*/, '''').replace(/\*\*/g, '''').trim();
                    if (clean) data.skills.push(clean);
                }
            }
            return data;
        }

        // ===== TEMPLATE RENDERERS =====
        function renderResumeTemplate(data, template) {
            if (template === ''modern'') return renderModernTemplate(data);
            if (template === ''minimal'') return renderMinimalTemplate(data);
            return renderClassicTemplate(data);
        }

        function renderClassicTemplate(data) {
            const esc = (s) => s.replace(/</g, ''&lt;'').replace(/>/g, ''&gt;'');
            let html = `<div style="font-family:''Lora'',Georgia,''Times New Roman'',serif;color:#1a1a1a;padding:40px 48px;line-height:1.45;max-width:100%;">`;

            // Name
            html += `<div style="text-align:center;font-size:24pt;font-weight:700;color:#111;margin-bottom:4px;letter-spacing:-0.5px;">${esc(data.name || ''Your Name'')}</div>`;

            // Contact
            if (data.contact) {
                html += `<div style="text-align:center;font-size:10pt;color:#555;font-family:''Nunito'',sans-serif;margin-bottom:20px;">${esc(data.contact)}</div>`;
            }

            // Summary
            if (data.summary) {
                html += `<div style="font-size:10pt;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#333;border-bottom:1.5px solid #333;padding-bottom:4px;margin:20px 0 10px;font-family:''Nunito'',sans-serif;">SUMMARY</div>`;
                html += `<div style="font-size:11pt;color:#222;margin-bottom:8px;">${esc(data.summary)}</div>`;
            }

            // Experience
            if (data.experience.length) {
                html += `<div style="font-size:10pt;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#333;border-bottom:1.5px solid #333;padding-bottom:4px;margin:20px 0 10px;font-family:''Nunito'',sans-serif;">EXPERIENCE</div>`;
                data.experience.forEach(exp => {
                    html += `<div style="font-size:11pt;font-weight:700;color:#111;margin-bottom:3px;margin-top:10px;">${esc(exp.title)}</div>`;
                    exp.bullets.forEach(b => {
                        html += `<div style="margin-left:20px;font-size:10.5pt;color:#333;margin-bottom:3px;">&ndash; ${esc(b)}</div>`;
                    });
                });
            }

            // Projects
            if (data.projects.length) {
                html += `<div style="font-size:10pt;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#333;border-bottom:1.5px solid #333;padding-bottom:4px;margin:20px 0 10px;font-family:''Nunito'',sans-serif;">PROJECTS</div>`;
                data.projects.forEach(proj => {
                    html += `<div style="font-size:11pt;font-weight:700;color:#111;margin-bottom:3px;margin-top:10px;">${esc(proj.title)}</div>`;
                    proj.bullets.forEach(b => {
                        html += `<div style="margin-left:20px;font-size:10.5pt;color:#333;margin-bottom:3px;">&ndash; ${esc(b)}</div>`;
                    });
                });
            }

            // Skills
            if (data.skills.length) {
                html += `<div style="font-size:10pt;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#333;border-bottom:1.5px solid #333;padding-bottom:4px;margin:20px 0 10px;font-family:''Nunito'',sans-serif;">SKILLS</div>`;
                data.skills.forEach(s => {
                    html += `<div style="font-size:10.5pt;color:#222;margin-bottom:4px;">${esc(s)}</div>`;
                });
            }

            html += ''</div>'';
            return html;
        }

        function renderModernTemplate(data) {
            const esc = (s) => s.replace(/</g, ''&lt;'').replace(/>/g, ''&gt;'');

            let sidebar = '''';
            let main = '''';

            // Sidebar: name, contact, skills
            sidebar += `<div style="font-size:18pt;font-weight:800;color:#fff;margin-bottom:12px;font-family:''Nunito'',sans-serif;">${esc(data.name || ''Your Name'')}</div>`;
            if (data.contact) {
                const parts = data.contact.split(/\s*\|\s*/);
                parts.forEach(p => {
                    sidebar += `<div style="font-size:9pt;color:rgba(255,255,255,0.8);margin-bottom:4px;">${esc(p.trim())}</div>`;
                });
            }
            if (data.skills.length) {
                sidebar += `<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.6);margin:24px 0 10px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:4px;">SKILLS</div>`;
                data.skills.forEach(s => {
                    sidebar += `<div style="font-size:9pt;color:rgba(255,255,255,0.85);margin-bottom:5px;">${esc(s)}</div>`;
                });
            }

            // Main: summary, experience, projects
            if (data.summary) {
                main += `<div style="font-size:10pt;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1.5px;border-left:3px solid #6366f1;padding-left:10px;margin-bottom:8px;font-family:''Nunito'',sans-serif;">SUMMARY</div>`;
                main += `<div style="font-size:10.5pt;color:#333;margin-bottom:16px;line-height:1.5;">${esc(data.summary)}</div>`;
            }
            if (data.experience.length) {
                main += `<div style="font-size:10pt;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1.5px;border-left:3px solid #6366f1;padding-left:10px;margin-bottom:8px;font-family:''Nunito'',sans-serif;">EXPERIENCE</div>`;
                data.experience.forEach(exp => {
                    main += `<div style="font-size:10.5pt;font-weight:700;color:#111;margin-bottom:3px;margin-top:8px;">${esc(exp.title)}</div>`;
                    exp.bullets.forEach(b => {
                        main += `<div style="margin-left:14px;font-size:10pt;color:#444;margin-bottom:3px;">&bull; ${esc(b)}</div>`;
                    });
                });
            }
            if (data.projects.length) {
                main += `<div style="font-size:10pt;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1.5px;border-left:3px solid #6366f1;padding-left:10px;margin:16px 0 8px;font-family:''Nunito'',sans-serif;">PROJECTS</div>`;
                data.projects.forEach(proj => {
                    main += `<div style="font-size:10.5pt;font-weight:700;color:#111;margin-bottom:3px;margin-top:8px;">${esc(proj.title)}</div>`;
                    proj.bullets.forEach(b => {
                        main += `<div style="margin-left:14px;font-size:10pt;color:#444;margin-bottom:3px;">&bull; ${esc(b)}</div>`;
                    });
                });
            }

            return `<div style="display:flex;font-family:''Nunito'',sans-serif;color:#1a1a1a;line-height:1.45;max-width:100%;min-height:600px;">
                <div style="width:32%;background:#1a1a2e;color:#fff;padding:32px 22px;border-radius:12px 0 0 12px;">${sidebar}</div>
                <div style="width:68%;padding:32px 28px;">${main}</div>
            </div>`;
        }

        function renderMinimalTemplate(data) {
            const esc = (s) => s.replace(/</g, ''&lt;'').replace(/>/g, ''&gt;'');
            let html = `<div style="font-family:''Nunito'',sans-serif;color:#1a1a1a;padding:44px 48px;line-height:1.55;max-width:100%;">`;

            // Name
            html += `<div style="font-size:28pt;font-weight:800;color:#111;margin-bottom:2px;letter-spacing:-0.5px;">${esc(data.name || ''Your Name'')}</div>`;
            html += `<div style="width:50px;height:3px;background:#6366f1;border-radius:2px;margin:6px 0 12px;"></div>`;

            // Contact
            if (data.contact) {
                html += `<div style="font-size:9.5pt;color:#888;margin-bottom:24px;letter-spacing:0.3px;">${esc(data.contact)}</div>`;
            }

            // Summary
            if (data.summary) {
                html += `<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#999;margin:24px 0 8px;">SUMMARY</div>`;
                html += `<div style="font-size:10.5pt;color:#333;margin-bottom:10px;line-height:1.6;">${esc(data.summary)}</div>`;
            }

            // Experience
            if (data.experience.length) {
                html += `<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#999;margin:24px 0 8px;">EXPERIENCE</div>`;
                data.experience.forEach(exp => {
                    html += `<div style="font-size:10.5pt;font-weight:700;color:#111;margin-bottom:3px;margin-top:10px;">${esc(exp.title)}</div>`;
                    exp.bullets.forEach(b => {
                        html += `<div style="margin-left:16px;font-size:10pt;color:#555;margin-bottom:3px;">&bull; ${esc(b)}</div>`;
                    });
                });
            }

            // Projects
            if (data.projects.length) {
                html += `<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#999;margin:24px 0 8px;">PROJECTS</div>`;
                data.projects.forEach(proj => {
                    html += `<div style="font-size:10.5pt;font-weight:700;color:#111;margin-bottom:3px;margin-top:10px;">${esc(proj.title)}</div>`;
                    proj.bullets.forEach(b => {
                        html += `<div style="margin-left:16px;font-size:10pt;color:#555;margin-bottom:3px;">&bull; ${esc(b)}</div>`;
                    });
                });
            }

            // Skills
            if (data.skills.length) {
                html += `<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#999;margin:24px 0 8px;">SKILLS</div>`;
                data.skills.forEach(s => {
                    html += `<div style="font-size:10pt;color:#444;margin-bottom:4px;">${esc(s)}</div>`;
                });
            }

            html += ''</div>'';
            return html;
        }

        function toggleResumeView() {
            const preview = document.getElementById(''resumePreviewSection'');
            const output = document.getElementById(''resumeOutput'').parentElement;
            if (preview.style.display === ''none'') {
                preview.style.display = ''block'';
                output.style.display = ''none'';
            } else {
                preview.style.display = ''none'';
                output.style.display = ''block'';
            }
        }

        function downloadResumePDF() {
            const element = document.getElementById(''resumePreviewContent'');
            const name = (parseResumeData(lastResumeText).name || ''resume'').replace(/\s+/g, ''_'').toLowerCase();
            html2pdf().set({
                margin: [10, 12, 10, 12],
                filename: name + ''_resume.pdf'',
                image: { type: ''jpeg'', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { format: ''letter'', orientation: ''portrait'' },
                pagebreak: { mode: ''avoid-all'' }
            }).from(element).save();
        }

        // ===== COVER LETTER GENERATOR =====
        async function generateCoverLetter() {
            const bg = getProfileBg();
            const company = document.getElementById(''coverCompany'').value.trim();
            const role = document.getElementById(''coverRole'').value.trim();
            const jobDesc = document.getElementById(''coverJobDesc'').value.trim();
            const output = document.getElementById(''coverOutput'');
            const copyBtn = document.getElementById(''coverCopyBtn'');

            if (!company || !role) { alert(''Enter company name and role.''); return; }

            output.textContent = '''';
            copyBtn.style.display = ''none'';
            document.getElementById(''coverPreviewSection'').style.display = ''none'';
            output.innerHTML = ''<span class="spinner"></span> Generating cover letter...'';

            const prompt = `You are an expert career coach. Write a professional, compelling cover letter for the following:

CANDIDATE BACKGROUND:
${bg}

COMPANY: ${company}
ROLE: ${role}
${jobDesc ? `\nJOB DESCRIPTION:\n${jobDesc}` : ''''}

Write a formal cover letter with:
1. Opening paragraph — why you''re excited about this specific company and role
2. Body paragraph 1 — your most relevant experience (SuiteGPT as the centerpiece)
3. Body paragraph 2 — supporting skills and unique background (DeFi, engineering)
4. Closing paragraph — enthusiasm and call to action

Guidelines:
- Address to "Hiring Manager" unless a name is available from the job description
- Be genuine and specific — reference real things you''ve built
- Show you know the company and why you''d be a great fit
- Keep it to one page (3-4 paragraphs)
- Professional but not stiff — show personality
- Don''t use cliches like "passionate" or "results-driven"`;

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

                // Render cover letter preview
                const coverHTML = parseCoverLetterToHTML(text);
                document.getElementById(''coverPreviewContent'').innerHTML = coverHTML;
                document.getElementById(''coverPreviewSection'').style.display = ''block'';
            } catch (e) {
                output.textContent = ''Error: '' + e.message;
            }
        }

        function parseCoverLetterToHTML(text) {
            const paragraphs = text.split(''\n'').filter(l => l.trim());
            let html = `<div style="font-family:''Lora'',Georgia,serif;color:#1a1a1a;padding:40px 48px;line-height:1.6;max-width:100%;">`;
            paragraphs.forEach(p => {
                const clean = p.trim().replace(/\*\*(.+?)\*\*/g, ''<strong>$1</strong>'');
                html += `<div style="font-size:11pt;color:#222;margin-bottom:14px;">${clean}</div>`;
            });
            html += `</div>`;
            return html;
        }

        function downloadCoverLetterPDF() {
            const element = document.getElementById(''coverPreviewContent'');
            const company = (document.getElementById(''coverCompany'').value || ''cover_letter'').replace(/\s+/g, ''_'').toLowerCase();
            html2pdf().set({
                margin: [10, 12, 10, 12],
                filename: company + ''_cover_letter.pdf'',
                image: { type: ''jpeg'', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { format: ''letter'', orientation: ''portrait'' },
                pagebreak: { mode: ''avoid-all'' }
            }).from(element).save();
        }

        // ===== OUTREACH GENERATION =====
        async function generateOutreach() {
            const bg = getProfileBg();
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
${bg}

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
            const btnMap = {
                resumeOutput: ''resumeCopyBtn'',
                outreachOutput: ''outreachCopyBtn'',
                coverOutput: ''coverCopyBtn''
            };
            const btn = document.getElementById(btnMap[id] || id + ''CopyBtn'');
            if (btn) {
                btn.textContent = ''Copied!'';
                setTimeout(() => btn.textContent = ''Copy'', 1500);
            }
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

        // ===== REFINE RESUME from Pipeline =====
        function refineResume(appId) {
            const apps = getApps();
            const app = apps.find(a => a.id === appId);
            if (!app) return;

            // Switch to Resume Lab tab
            switchTab(''resume'');

            // Pre-fill job posting field
            document.getElementById(''jobPosting'').value = `Company: ${app.company}\nRole: ${app.role}\n\n[Paste the full job description here for a tailored resume]`;

            // Pre-fill cover letter fields
            document.getElementById(''coverCompany'').value = app.company;
            document.getElementById(''coverRole'').value = app.role;

            // Focus the job posting textarea
            setTimeout(() => {
                document.getElementById(''jobPosting'').focus();
            }, 100);
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
                            <button onclick="refineResume(''${a.id}'')">Refine Resume</button>
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
            const bg = getProfileBg();
            const output = document.getElementById(''fitOutput'');
            const copyBtn = document.getElementById(''fitCopyBtn'');
            const pipelineBtn = document.getElementById(''fitAddPipeline'');

            if (!jobDesc) { alert(''Paste a job description first.''); return; }
            if (!bg) { alert(''Set up your profile in the My Profile tab first.''); return; }

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

        // ===== BULK FIT SCANNER =====
        let bulkFitResults = [];

        async function bulkFitScan() {
            const raw = document.getElementById(''bulkFitTitles'').value.trim();
            const bg = getProfileBg();
            const resultsDiv = document.getElementById(''bulkFitResults'');

            if (!raw) { alert(''Paste some job listings first.''); return; }
            if (!bg) { alert(''Set up your profile in the My Profile tab first.''); return; }

            resultsDiv.innerHTML = ''<div style="padding:20px;text-align:center;"><span class="spinner"></span> Parsing and scanning job listings...</div>'';

            const prompt = `You are a career advisor. The user has copy-pasted raw job listings from a job board. The formatting is messy — job titles, company names, salaries, locations, and tags are all mixed together.

CANDIDATE BACKGROUND:
${bg}

RAW PASTED JOB LISTINGS:
${raw}

INSTRUCTIONS:
1. Parse the raw text to extract individual job listings. Ignore ads, bootcamp promos, and non-job content.
2. For each real job listing, extract: title, company, salary range (if present), and location (if present).
3. Rate how well the candidate fits each job (1-10).

Return your response as a JSON array (and nothing else — no markdown fences, no explanation). Each element must have these exact keys:
- "title": the job title (cleaned up, ASCII only)
- "company": the company name (ASCII only)
- "salary": salary range as string, or "" if not listed
- "location": location or "Remote", or "" if not listed
- "score": number 1-10
- "why": short reason it fits (max 10 words)
- "gap": biggest gap (max 10 words)

CRITICAL: You MUST include EVERY job from the input. Do NOT skip any. Do NOT truncate. I expect 20-30+ results. Keep "why" and "gap" very short to save space.
Sort the array from highest score to lowest. Return ONLY valid JSON array.`;

            try {
                const resp = await fetch(''https://suitegpt.app/api/gemini'', {
                    method: ''POST'',
                    headers: { ''Content-Type'': ''application/json'' },
                    body: JSON.stringify({
                        prompt,
                        model: ''gemini-3-flash-preview'',
                        generationConfig: { temperature: 0.3, maxOutputTokens: 16000 }
                    })
                });
                const data = await resp.json();
                const text = (data.text || '''').trim();

                // Parse JSON — strip markdown fences if present
                let cleaned = text.replace(/^```json?\s*/i, '''').replace(/```\s*$/, '''').trim();
                let results;
                try {
                    results = JSON.parse(cleaned);
                } catch (e) {
                    resultsDiv.innerHTML = `<div class="ai-output">${text.replace(/</g, ''&lt;'')}</div>`;
                    return;
                }

                // Sort by score descending
                results.sort((a, b) => b.score - a.score);
                bulkFitResults = results;

                // Render table
                let html = `<div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:8px;">${results.length} jobs found and ranked</div>`;
                html += `<table class="fit-table"><thead><tr>`;
                html += `<th>#</th><th>Job Title</th><th>Company</th><th>Salary</th><th>Score</th><th>Why</th><th>Gap</th><th></th>`;
                html += `</tr></thead><tbody>`;

                const esc = (s) => (s || '''').replace(/</g, ''&lt;'').replace(/>/g, ''&gt;'').replace(/"/g, ''&quot;'');

                results.forEach((r, i) => {
                    const scoreClass = r.score >= 7 ? ''fit-score-high'' : r.score >= 4 ? ''fit-score-mid'' : ''fit-score-low'';
                    html += `<tr>
                        <td class="fit-rank">${i + 1}</td>
                        <td class="fit-title-cell">${esc(r.title)}</td>
                        <td style="color:var(--text-dim);font-size:0.82rem;">${esc(r.company)}</td>
                        <td style="color:var(--green);font-size:0.78rem;white-space:nowrap;">${esc(r.salary)}</td>
                        <td><span class="fit-score-badge ${scoreClass}">${r.score}</span></td>
                        <td class="fit-why">${esc(r.why)}</td>
                        <td class="fit-gap">${esc(r.gap)}</td>
                        <td><button class="fit-add-btn" onclick="addBulkToPipeline(${i})">&plus; Pipeline</button></td>
                    </tr>`;
                });

                html += `</tbody></table>`;
                resultsDiv.innerHTML = html;
            } catch (e) {
                resultsDiv.innerHTML = `<div class="ai-output">Error: ${e.message}</div>`;
            }
        }

        function addBulkToPipeline(index) {
            const r = bulkFitResults[index];
            if (!r) return;
            const apps = getApps();
            if (apps.some(a => a.role === r.title && a.company === r.company)) {
                alert(''Already in your pipeline.'');
                return;
            }
            apps.push({
                id: Date.now().toString(),
                company: r.company || ''—'',
                role: r.title,
                link: '''',
                stage: ''applied'',
                date: new Date().toLocaleDateString()
            });
            saveApps(apps);
            renderPipeline();
            alert(`Added ${r.company} — ${r.title} to Pipeline!`);
        }

        // ===== INIT =====
        initProfile();
        renderBoardTabs();
        selectBoard(0);
        renderPipeline();
        renderChecklist();
    </script>
</body>
</html>
', updated_at = NOW() WHERE id = '11262151-cf35-4105-a886-4422dd7879b8';
