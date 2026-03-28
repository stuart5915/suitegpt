// Page templates as string constants — Vercel bundles JS but NOT static HTML files
// Used by agent-chat.js and build-from-template.js

export const TOKEN_LANDING = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TOKEN_NAME}} ({{TOKEN_SYMBOL}}) — Token on Base</title>
    <meta name="description" content="{{TOKEN_DESCRIPTION}}">
    <meta property="og:title" content="{{TOKEN_NAME}} ({{TOKEN_SYMBOL}})">
    <meta property="og:description" content="{{TOKEN_DESCRIPTION}}">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🪙</text></svg>">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0a0a0f;--card:rgba(255,255,255,0.03);--border:rgba(255,255,255,0.06);--text:#f0f0f5;--dim:#606070;--accent:#e87955;--teal:#2dd4bf;--font:'Inter',sans-serif;--mono:'JetBrains Mono',monospace}
        body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased}
        a{color:var(--teal);text-decoration:none}
        .page{max-width:720px;margin:0 auto;padding:60px 24px 80px}
        .hero{text-align:center;padding:40px 0 48px}
        .hero-emoji{font-size:3rem;margin-bottom:16px}
        .hero h1{font-size:2.4rem;font-weight:900;margin-bottom:8px;letter-spacing:-0.02em}
        .hero h1 span{color:var(--accent)}
        .hero-symbol{font-family:var(--mono);font-size:1.1rem;color:var(--accent);margin-bottom:16px}
        .hero-desc{font-size:1rem;color:rgba(255,255,255,0.6);line-height:1.65;max-width:520px;margin:0 auto 24px}
        .hero-contract{font-family:var(--mono);font-size:0.72rem;color:var(--dim);background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 14px;display:inline-block;word-break:break-all;cursor:pointer}
        .hero-contract:hover{border-color:var(--accent)}
        .actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:28px 0}
        .btn{display:inline-flex;align-items:center;gap:6px;padding:12px 28px;border-radius:999px;font-weight:700;font-size:0.88rem;border:none;cursor:pointer;transition:all 0.15s;text-decoration:none}
        .btn-primary{background:var(--accent);color:#fff}
        .btn-primary:hover{opacity:0.88;color:#fff}
        .btn-secondary{background:var(--card);border:1px solid var(--border);color:var(--text)}
        .btn-secondary:hover{border-color:rgba(255,255,255,0.15);color:var(--text)}
        .btn-teal{background:rgba(45,212,191,0.12);border:1px solid rgba(45,212,191,0.25);color:var(--teal)}
        .btn-teal:hover{background:rgba(45,212,191,0.2);color:var(--teal)}
        .stats{display:flex;justify-content:center;gap:32px;flex-wrap:wrap;padding:24px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin:32px 0}
        .stat{text-align:center}
        .stat-val{font-family:var(--mono);font-size:1.3rem;font-weight:800;color:var(--text)}
        .stat-label{font-size:0.68rem;color:var(--dim);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-top:2px}
        .cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:32px 0}
        .info-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px}
        .info-card-title{font-size:0.75rem;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px}
        .info-card-value{font-size:0.92rem;font-weight:600;color:var(--text);word-break:break-all}
        .info-card-value a{color:var(--teal)}
        .section{margin:40px 0}
        .section h2{font-size:1.3rem;font-weight:800;margin-bottom:16px}
        .steps{display:flex;flex-direction:column;gap:12px}
        .step{display:flex;gap:14px;align-items:flex-start;padding:16px;background:var(--card);border:1px solid var(--border);border-radius:12px}
        .step-num{width:28px;height:28px;border-radius:50%;background:rgba(232,121,85,0.12);color:var(--accent);font-weight:800;font-size:0.82rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .step-text{font-size:0.88rem;color:rgba(255,255,255,0.7);line-height:1.55}
        .step-text strong{color:var(--text)}
        .footer{text-align:center;padding:40px 0 20px;border-top:1px solid var(--border);margin-top:48px;color:var(--dim);font-size:0.75rem}
        .footer-links{display:flex;gap:16px;justify-content:center;margin-bottom:12px}
        .footer-links a{color:var(--dim);font-size:0.78rem;font-weight:500}
        .footer-links a:hover{color:var(--text)}
        @media(max-width:600px){
            .hero h1{font-size:1.8rem}
            .cards{grid-template-columns:1fr}
            .stats{gap:20px}
        }
    </style>
</head>
<body>
<div class="page">
    <div class="hero">
        <div class="hero-emoji">{{TOKEN_EMOJI}}</div>
        <h1>{{TOKEN_NAME}} <span>{{TOKEN_SYMBOL}}</span></h1>
        <div class="hero-desc">{{TOKEN_DESCRIPTION}}</div>
        <div class="hero-contract" onclick="navigator.clipboard.writeText('{{TOKEN_ADDRESS}}');this.textContent='Copied!';setTimeout(()=>this.textContent='{{TOKEN_ADDRESS}}',2000)" title="Click to copy">{{TOKEN_ADDRESS}}</div>
    </div>
    <div class="actions">
        <a href="https://app.uniswap.org/swap?outputCurrency={{TOKEN_ADDRESS}}&chain=base" target="_blank" rel="noopener" class="btn btn-primary">Buy on Uniswap</a>
        <a href="https://dexscreener.com/base/{{TOKEN_ADDRESS}}" target="_blank" rel="noopener" class="btn btn-secondary">DexScreener</a>
        <a href="https://www.clanker.world/clanker/{{TOKEN_ADDRESS}}" target="_blank" rel="noopener" class="btn btn-secondary">Clanker</a>
        {{STAKING_BUTTON}}
    </div>
    <div class="stats">
        <div class="stat">
            <div class="stat-val">{{CHAIN}}</div>
            <div class="stat-label">Chain</div>
        </div>
        <div class="stat">
            <div class="stat-val">{{TOKEN_SYMBOL}}</div>
            <div class="stat-label">Token</div>
        </div>
        <div class="stat">
            <div class="stat-val">{{LP_FEE_SPLIT}}</div>
            <div class="stat-label">Creator LP Fee</div>
        </div>
    </div>
    <div class="cards">
        <div class="info-card">
            <div class="info-card-title">Contract</div>
            <div class="info-card-value" style="font-family:var(--mono);font-size:0.72rem">{{TOKEN_ADDRESS}}</div>
        </div>
        <div class="info-card">
            <div class="info-card-title">Website</div>
            <div class="info-card-value"><a href="{{WEBSITE_URL}}" target="_blank">{{WEBSITE_DISPLAY}}</a></div>
        </div>
        <div class="info-card">
            <div class="info-card-title">X / Twitter</div>
            <div class="info-card-value"><a href="https://x.com/{{X_HANDLE}}" target="_blank">@{{X_HANDLE}}</a></div>
        </div>
        <div class="info-card">
            <div class="info-card-title">Telegram</div>
            <div class="info-card-value"><a href="{{TELEGRAM_URL}}" target="_blank">Join Community</a></div>
        </div>
    </div>
    <div class="section">
        <h2>How to Buy</h2>
        <div class="steps">
            <div class="step">
                <div class="step-num">1</div>
                <div class="step-text"><strong>Get a wallet</strong> — install MetaMask or Coinbase Wallet and add the Base network.</div>
            </div>
            <div class="step">
                <div class="step-num">2</div>
                <div class="step-text"><strong>Get ETH on Base</strong> — bridge ETH to Base using <a href="https://bridge.base.org" target="_blank">bridge.base.org</a> or buy directly on Coinbase.</div>
            </div>
            <div class="step">
                <div class="step-num">3</div>
                <div class="step-text"><strong>Swap for {{TOKEN_SYMBOL}}</strong> — go to <a href="https://app.uniswap.org/swap?outputCurrency={{TOKEN_ADDRESS}}&chain=base" target="_blank">Uniswap</a>, paste the contract address, and swap your ETH.</div>
            </div>
            <div class="step">
                <div class="step-num">4</div>
                <div class="step-text"><strong>Add to wallet</strong> — import the token using the contract address so you can see your balance.</div>
            </div>
        </div>
    </div>
    {{ABOUT_SECTION}}
</div>
<footer class="footer">
    <div class="footer-links">
        <a href="https://dexscreener.com/base/{{TOKEN_ADDRESS}}" target="_blank">DexScreener</a>
        <a href="https://basescan.org/token/{{TOKEN_ADDRESS}}" target="_blank">BaseScan</a>
        <a href="https://www.clanker.world/clanker/{{TOKEN_ADDRESS}}" target="_blank">Clanker</a>
    </div>
    <p>Built with <a href="https://inclawbate.app" target="_blank" style="color:var(--accent)">Inclawbate</a></p>
</footer>
</body>
</html>`;

export const PRESALE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TOKEN_NAME}} ({{TOKEN_SYMBOL}}) — Presale</title>
    <meta name="description" content="{{TOKEN_NAME}} presale is live. Get in early at {{PRESALE_PRICE}} ETH per token.">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0a0a0f;--card:rgba(255,255,255,0.03);--border:rgba(255,255,255,0.06);--text:#f0f0f5;--dim:#606070;--accent:#e87955;--teal:#2dd4bf;--green:#4ade80;--font:'Inter',sans-serif;--mono:'JetBrains Mono',monospace}
        body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh}
        a{color:var(--teal);text-decoration:none}
        .page{max-width:680px;margin:0 auto;padding:60px 24px 80px}
        .hero{text-align:center;padding:20px 0 40px}
        .hero-badge{display:inline-block;font-family:var(--mono);font-size:0.68rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--green);background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);padding:5px 16px;border-radius:999px;margin-bottom:20px}
        .hero h1{font-size:2.2rem;font-weight:900;margin-bottom:8px}
        .hero h1 span{color:var(--accent)}
        .hero-desc{font-size:0.95rem;color:rgba(255,255,255,0.55);max-width:480px;margin:0 auto;line-height:1.6}
        .presale-card{background:var(--card);border:1.5px solid rgba(232,121,85,0.2);border-radius:20px;padding:32px;margin:32px 0}
        .presale-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px}
        .presale-title{font-size:1.1rem;font-weight:800}
        .presale-status{font-family:var(--mono);font-size:0.7rem;font-weight:700;color:var(--green);background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.15);padding:4px 12px;border-radius:999px}
        .progress-wrap{margin-bottom:20px}
        .progress-labels{display:flex;justify-content:space-between;margin-bottom:6px}
        .progress-raised{font-family:var(--mono);font-size:0.85rem;font-weight:700;color:var(--accent)}
        .progress-cap{font-family:var(--mono);font-size:0.85rem;color:var(--dim)}
        .progress-bar{height:12px;background:rgba(255,255,255,0.04);border-radius:6px;overflow:hidden}
        .progress-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--teal));border-radius:6px;transition:width 0.5s ease;min-width:2%}
        .progress-pct{text-align:center;font-family:var(--mono);font-size:0.75rem;color:var(--dim);margin-top:4px}
        .presale-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px}
        .ps-stat{text-align:center;padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px}
        .ps-stat-val{font-family:var(--mono);font-size:1rem;font-weight:800}
        .ps-stat-label{font-size:0.65rem;color:var(--dim);text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}
        .contribute{margin-top:24px}
        .contribute-label{font-size:0.78rem;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px}
        .contribute-row{display:flex;gap:8px}
        .contribute-input{flex:1;padding:14px 16px;background:rgba(0,0,0,0.3);border:1.5px solid var(--border);border-radius:12px;color:var(--text);font-family:var(--mono);font-size:1rem;outline:none}
        .contribute-input:focus{border-color:var(--accent)}
        .contribute-input::placeholder{color:var(--dim)}
        .contribute-btn{padding:14px 32px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-weight:800;font-size:0.95rem;cursor:pointer;font-family:var(--font);transition:opacity 0.15s;white-space:nowrap}
        .contribute-btn:hover{opacity:0.88}
        .contribute-note{font-size:0.72rem;color:var(--dim);margin-top:8px;text-align:center}
        .token-calc{text-align:center;padding:16px;background:rgba(45,212,191,0.04);border:1px solid rgba(45,212,191,0.12);border-radius:12px;margin-top:16px}
        .token-calc-label{font-size:0.72rem;color:var(--dim);margin-bottom:4px}
        .token-calc-val{font-family:var(--mono);font-size:1.2rem;font-weight:800;color:var(--teal)}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:32px 0}
        .info-item{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px}
        .info-item-label{font-size:0.65rem;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px}
        .info-item-val{font-size:0.88rem;font-weight:600;word-break:break-all}
        .info-item-val a{color:var(--teal)}
        .about{margin:32px 0}
        .about h2{font-size:1.2rem;font-weight:800;margin-bottom:12px}
        .about p{font-size:0.88rem;color:rgba(255,255,255,0.6);line-height:1.65}
        .about ul{list-style:none;margin-top:12px}
        .about li{padding:6px 0;font-size:0.85rem;color:rgba(255,255,255,0.6)}
        .about li::before{content:'✦ ';color:var(--accent)}
        .tokenomics{margin:32px 0}
        .tokenomics h2{font-size:1.2rem;font-weight:800;margin-bottom:16px}
        .toke-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);font-size:0.85rem}
        .toke-row:last-child{border-bottom:none}
        .toke-label{color:rgba(255,255,255,0.5)}
        .toke-val{font-weight:700;font-family:var(--mono)}
        .footer{text-align:center;padding:40px 0 20px;border-top:1px solid var(--border);margin-top:48px;color:var(--dim);font-size:0.75rem}
        .footer a{color:var(--accent)}
        @media(max-width:600px){
            .hero h1{font-size:1.7rem}
            .presale-stats{grid-template-columns:1fr}
            .contribute-row{flex-direction:column}
            .info-grid{grid-template-columns:1fr}
        }
    </style>
</head>
<body>
<div class="page">
    <div class="hero">
        <div class="hero-badge">Presale Live</div>
        <h1>{{TOKEN_NAME}} <span>{{TOKEN_SYMBOL}}</span></h1>
        <div class="hero-desc">{{TOKEN_DESCRIPTION}}</div>
    </div>
    <div class="presale-card">
        <div class="presale-header">
            <div class="presale-title">{{TOKEN_SYMBOL}} Presale</div>
            <div class="presale-status">● Live</div>
        </div>
        <div class="progress-wrap">
            <div class="progress-labels">
                <span class="progress-raised">{{RAISED_ETH}} ETH raised</span>
                <span class="progress-cap">{{HARD_CAP}} ETH hard cap</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width:{{PROGRESS_PCT}}%"></div>
            </div>
            <div class="progress-pct">{{PROGRESS_PCT}}% filled</div>
        </div>
        <div class="presale-stats">
            <div class="ps-stat">
                <div class="ps-stat-val">{{PRESALE_PRICE}}</div>
                <div class="ps-stat-label">Price (ETH)</div>
            </div>
            <div class="ps-stat">
                <div class="ps-stat-val">{{HARD_CAP}}</div>
                <div class="ps-stat-label">Hard Cap (ETH)</div>
            </div>
            <div class="ps-stat">
                <div class="ps-stat-val">{{MIN_BUY}}</div>
                <div class="ps-stat-label">Min Buy (ETH)</div>
            </div>
        </div>
        <div class="contribute">
            <div class="contribute-label">Contribute ETH</div>
            <div class="contribute-row">
                <input type="number" class="contribute-input" id="contributeAmount" placeholder="0.1" step="0.01" min="{{MIN_BUY}}">
                <button class="contribute-btn" onclick="alert('Connect wallet to contribute. Presale contract: {{PRESALE_CONTRACT}}')">Contribute</button>
            </div>
            <div class="contribute-note">Min {{MIN_BUY}} ETH · Max {{MAX_BUY}} ETH per wallet</div>
        </div>
        <div class="token-calc">
            <div class="token-calc-label">You will receive</div>
            <div class="token-calc-val" id="tokenCalc">0 {{TOKEN_SYMBOL}}</div>
        </div>
    </div>
    <div class="info-grid">
        <div class="info-item">
            <div class="info-item-label">Token Contract</div>
            <div class="info-item-val" style="font-family:var(--mono);font-size:0.7rem">{{TOKEN_ADDRESS}}</div>
        </div>
        <div class="info-item">
            <div class="info-item-label">Chain</div>
            <div class="info-item-val">{{CHAIN}}</div>
        </div>
        <div class="info-item">
            <div class="info-item-label">Total Supply</div>
            <div class="info-item-val">{{TOTAL_SUPPLY}}</div>
        </div>
        <div class="info-item">
            <div class="info-item-label">Presale Allocation</div>
            <div class="info-item-val">{{PRESALE_ALLOCATION}}</div>
        </div>
    </div>
    {{ABOUT_SECTION}}
    {{TOKENOMICS_SECTION}}
</div>
<footer class="footer">
    <p>Built with <a href="https://inclawbate.app">Inclawbate</a> · <a href="https://basescan.org/token/{{TOKEN_ADDRESS}}" target="_blank">BaseScan</a></p>
</footer>
<script>
var price = parseFloat('{{PRESALE_PRICE}}') || 0.001;
var input = document.getElementById('contributeAmount');
var calc = document.getElementById('tokenCalc');
if (input && calc) {
    input.addEventListener('input', function() {
        var eth = parseFloat(this.value) || 0;
        var tokens = Math.floor(eth / price);
        calc.textContent = tokens.toLocaleString() + ' {{TOKEN_SYMBOL}}';
    });
}
</script>
</body>
</html>`;

export const PROJECT_LANDING = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{PROJECT_NAME}} — {{PROJECT_TAGLINE}}</title>
    <meta name="description" content="{{PROJECT_DESCRIPTION}}">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>{{PROJECT_EMOJI}}</text></svg>">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0a0a0f;--card:rgba(255,255,255,0.03);--border:rgba(255,255,255,0.06);--text:#f0f0f5;--dim:#606070;--accent:#e87955;--teal:#2dd4bf;--font:'Inter',sans-serif;--mono:'JetBrains Mono',monospace}
        body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh}
        a{color:var(--teal);text-decoration:none}
        .page{max-width:800px;margin:0 auto;padding:60px 24px 80px}
        .hero{text-align:center;padding:40px 0 48px;position:relative}
        .hero::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:400px;height:400px;background:radial-gradient(circle,rgba(232,121,85,0.06),transparent 70%);pointer-events:none}
        .hero-emoji{font-size:3.5rem;margin-bottom:16px;position:relative}
        .hero h1{font-size:2.6rem;font-weight:900;margin-bottom:12px;letter-spacing:-0.02em;position:relative}
        .hero-tagline{font-size:1.15rem;color:var(--accent);font-weight:600;margin-bottom:16px;position:relative}
        .hero-desc{font-size:0.95rem;color:rgba(255,255,255,0.55);line-height:1.65;max-width:560px;margin:0 auto;position:relative}
        .cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:32px 0;position:relative}
        .btn{display:inline-flex;align-items:center;gap:6px;padding:14px 32px;border-radius:999px;font-weight:700;font-size:0.9rem;border:none;cursor:pointer;transition:all 0.15s;text-decoration:none}
        .btn-primary{background:var(--accent);color:#fff}
        .btn-primary:hover{opacity:0.88;color:#fff}
        .btn-outline{background:transparent;border:1.5px solid var(--border);color:var(--text)}
        .btn-outline:hover{border-color:rgba(255,255,255,0.2);color:var(--text)}
        .features{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:48px 0}
        .feature{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;text-align:center;transition:border-color 0.2s}
        .feature:hover{border-color:rgba(232,121,85,0.2)}
        .feature-icon{font-size:1.8rem;margin-bottom:10px}
        .feature-title{font-size:0.92rem;font-weight:700;margin-bottom:4px}
        .feature-desc{font-size:0.78rem;color:var(--dim);line-height:1.5}
        .about{margin:48px 0;display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:center}
        .about-text h2{font-size:1.5rem;font-weight:800;margin-bottom:12px}
        .about-text p{font-size:0.88rem;color:rgba(255,255,255,0.55);line-height:1.65;margin-bottom:12px}
        .about-stats{display:flex;flex-direction:column;gap:12px}
        .about-stat{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;justify-content:space-between;align-items:center}
        .about-stat-label{font-size:0.78rem;color:var(--dim)}
        .about-stat-val{font-family:var(--mono);font-weight:800;font-size:1rem}
        .links{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:40px 0}
        .link-pill{padding:10px 20px;background:var(--card);border:1px solid var(--border);border-radius:999px;font-size:0.82rem;font-weight:600;color:var(--text);transition:all 0.15s}
        .link-pill:hover{border-color:rgba(232,121,85,0.3);color:var(--accent)}
        .footer{text-align:center;padding:40px 0 20px;border-top:1px solid var(--border);margin-top:48px;color:var(--dim);font-size:0.75rem}
        .footer a{color:var(--accent)}
        @media(max-width:700px){
            .features{grid-template-columns:1fr}
            .about{grid-template-columns:1fr}
            .hero h1{font-size:2rem}
        }
    </style>
</head>
<body>
<div class="page">
    <div class="hero">
        <div class="hero-emoji">{{PROJECT_EMOJI}}</div>
        <h1>{{PROJECT_NAME}}</h1>
        <div class="hero-tagline">{{PROJECT_TAGLINE}}</div>
        <div class="hero-desc">{{PROJECT_DESCRIPTION}}</div>
    </div>
    <div class="cta">
        <a href="{{PRIMARY_CTA_URL}}" target="_blank" class="btn btn-primary">{{PRIMARY_CTA_TEXT}}</a>
        <a href="{{SECONDARY_CTA_URL}}" target="_blank" class="btn btn-outline">{{SECONDARY_CTA_TEXT}}</a>
    </div>
    <div class="features">
        <div class="feature">
            <div class="feature-icon">{{FEATURE_1_ICON}}</div>
            <div class="feature-title">{{FEATURE_1_TITLE}}</div>
            <div class="feature-desc">{{FEATURE_1_DESC}}</div>
        </div>
        <div class="feature">
            <div class="feature-icon">{{FEATURE_2_ICON}}</div>
            <div class="feature-title">{{FEATURE_2_TITLE}}</div>
            <div class="feature-desc">{{FEATURE_2_DESC}}</div>
        </div>
        <div class="feature">
            <div class="feature-icon">{{FEATURE_3_ICON}}</div>
            <div class="feature-title">{{FEATURE_3_TITLE}}</div>
            <div class="feature-desc">{{FEATURE_3_DESC}}</div>
        </div>
    </div>
    {{ABOUT_SECTION}}
    <div class="links">
        {{LINK_PILLS}}
    </div>
</div>
<footer class="footer">
    <p>Built with <a href="https://inclawbate.app">Inclawbate</a></p>
</footer>
</body>
</html>`;

// Helper: fill placeholders and publish
export function fillTemplate(templateHtml, data) {
    let html = templateHtml;
    for (const [key, value] of Object.entries(data)) {
        html = html.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), String(value || ''));
    }
    // Clean up unreplaced placeholders
    html = html.replace(/\{\{[A-Z_]+\}\}/g, '');
    return html;
}

export async function publishTemplate(templateHtml, data, slug) {
    const html = fillTemplate(templateHtml, data);
    const pageSlug = slug || (data.TOKEN_NAME || data.PROJECT_NAME || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const res = await fetch('https://www.inclawbate.app/api/publish-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            slug: pageSlug,
            code: html,
            name: data.TOKEN_NAME || data.PROJECT_NAME || pageSlug,
            description: data.TOKEN_DESCRIPTION || data.PROJECT_DESCRIPTION || '',
            email: 'anonymous@inclawbate.app',
            source: 'template',
        })
    });
    const result = await res.json();
    return { ...result, slug: pageSlug, url: `https://inclawbate.app/s/${pageSlug}` };
}
