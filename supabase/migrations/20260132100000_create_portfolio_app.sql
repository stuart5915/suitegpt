-- Create Portfolio app — shareable portfolio/website for job applications
INSERT INTO user_apps (id, user_id, name, code, created_at, updated_at)
VALUES (
    'a2c7e3f1-9d84-4b6a-8e2f-1a3c5d7e9f0b',
    '71963d89-452d-4ed3-ba16-e340f36a310f',
    'Portfolio',
    '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stuart Hollinger | Portfolio</title>
    <link rel="icon" type="image/png" href="/assets/suite-logo-new.png">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg: #0a0a0a;
            --bg-card: #141414;
            --bg-card-hover: #1a1a1a;
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
            --blue: #3b82f6;
            --blue-soft: rgba(59,130,246,0.12);
            --purple: #a855f7;
            --purple-soft: rgba(168,85,247,0.12);
            --red: #ef4444;
            --red-soft: rgba(239,68,68,0.12);
        }
        html { scroll-behavior: smooth; }
        body {
            font-family: ''Nunito'', sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            overflow-x: hidden;
        }

        /* ===== NAV ===== */
        .port-nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 100;
            background: rgba(10,10,10,0.85);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border);
            padding: 0 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 56px;
        }
        .port-nav-logo {
            font-weight: 800;
            font-size: 1.1rem;
            background: linear-gradient(135deg, var(--accent), var(--purple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .port-nav-links {
            display: flex;
            gap: 6px;
        }
        .port-nav-links a {
            color: var(--text-dim);
            text-decoration: none;
            font-size: 0.85rem;
            font-weight: 600;
            padding: 6px 14px;
            border-radius: 8px;
            transition: all 0.2s;
        }
        .port-nav-links a:hover {
            color: var(--text);
            background: var(--bg-card);
        }

        /* ===== HERO ===== */
        .hero {
            padding: 140px 24px 80px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .hero::before {
            content: "";
            position: absolute;
            top: -40%;
            left: 50%;
            transform: translateX(-50%);
            width: 800px;
            height: 800px;
            background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.06) 40%, transparent 70%);
            pointer-events: none;
        }
        .hero-badge {
            display: inline-block;
            padding: 6px 16px;
            border-radius: 20px;
            background: var(--accent-soft);
            color: var(--accent);
            font-size: 0.78rem;
            font-weight: 700;
            margin-bottom: 20px;
            border: 1px solid rgba(99,102,241,0.2);
        }
        .hero h1 {
            font-size: 3rem;
            font-weight: 900;
            line-height: 1.1;
            margin-bottom: 12px;
        }
        .hero h1 span {
            background: linear-gradient(135deg, var(--accent), var(--purple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .hero-subtitle {
            font-size: 1.15rem;
            color: var(--text-dim);
            max-width: 600px;
            margin: 0 auto 32px;
            line-height: 1.6;
        }
        .hero-cta {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .hero-cta a {
            padding: 12px 28px;
            border-radius: 12px;
            font-family: inherit;
            font-weight: 700;
            font-size: 0.92rem;
            text-decoration: none;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .cta-primary {
            background: linear-gradient(135deg, var(--accent), var(--purple));
            color: white;
        }
        .cta-primary:hover { opacity: 0.9; }
        .cta-secondary {
            background: var(--bg-card);
            color: var(--text);
            border: 1px solid var(--border);
        }
        .cta-secondary:hover { border-color: var(--border-hover); }

        /* ===== SECTIONS ===== */
        .section {
            max-width: 1000px;
            margin: 0 auto;
            padding: 80px 24px;
        }
        .section-label {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: var(--accent);
            margin-bottom: 8px;
        }
        .section-heading {
            font-size: 1.8rem;
            font-weight: 800;
            margin-bottom: 24px;
        }

        /* ===== ABOUT ===== */
        .about-text {
            font-size: 1.05rem;
            color: var(--text-dim);
            line-height: 1.8;
            max-width: 700px;
        }
        .about-text strong { color: var(--text); }

        /* ===== FEATURED PROJECT ===== */
        .project-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 40px;
            position: relative;
            overflow: hidden;
        }
        .project-card::after {
            content: "";
            position: absolute;
            top: 0;
            right: 0;
            width: 200px;
            height: 200px;
            background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%);
            pointer-events: none;
        }
        .project-name {
            font-size: 1.5rem;
            font-weight: 800;
            margin-bottom: 8px;
        }
        .project-desc {
            font-size: 0.95rem;
            color: var(--text-dim);
            line-height: 1.7;
            margin-bottom: 24px;
            max-width: 600px;
        }
        .project-stats {
            display: flex;
            gap: 24px;
            margin-bottom: 24px;
            flex-wrap: wrap;
        }
        .project-stat {
            text-align: center;
        }
        .project-stat-value {
            font-size: 1.6rem;
            font-weight: 800;
            color: var(--accent);
        }
        .project-stat-label {
            font-size: 0.75rem;
            color: var(--text-dim);
            font-weight: 600;
        }
        .tech-badges {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 24px;
        }
        .tech-badge {
            padding: 5px 12px;
            border-radius: 8px;
            font-size: 0.78rem;
            font-weight: 700;
            border: 1px solid var(--border);
            background: var(--bg);
            color: var(--text-dim);
        }
        .project-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: var(--accent);
            font-weight: 700;
            font-size: 0.9rem;
            text-decoration: none;
        }
        .project-link:hover { text-decoration: underline; }

        /* ===== SKILLS GRID ===== */
        .skills-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 14px;
        }
        .skill-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 20px;
            transition: all 0.2s;
        }
        .skill-card:hover { border-color: var(--border-hover); background: var(--bg-card-hover); }
        .skill-card-icon {
            font-size: 1.5rem;
            margin-bottom: 10px;
        }
        .skill-card-title {
            font-weight: 700;
            font-size: 0.92rem;
            margin-bottom: 8px;
        }
        .skill-card-list {
            font-size: 0.82rem;
            color: var(--text-dim);
            line-height: 1.6;
        }

        /* ===== TIMELINE ===== */
        .timeline {
            position: relative;
            padding-left: 32px;
        }
        .timeline::before {
            content: "";
            position: absolute;
            left: 7px;
            top: 4px;
            bottom: 4px;
            width: 2px;
            background: var(--border);
        }
        .timeline-item {
            position: relative;
            margin-bottom: 32px;
        }
        .timeline-item:last-child { margin-bottom: 0; }
        .timeline-dot {
            position: absolute;
            left: -32px;
            top: 6px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 3px solid var(--accent);
            background: var(--bg);
        }
        .timeline-item:first-child .timeline-dot {
            background: var(--accent);
            box-shadow: 0 0 12px rgba(99,102,241,0.4);
        }
        .timeline-period {
            font-size: 0.75rem;
            font-weight: 700;
            color: var(--accent);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .timeline-title {
            font-size: 1.1rem;
            font-weight: 800;
            margin-bottom: 4px;
        }
        .timeline-desc {
            font-size: 0.88rem;
            color: var(--text-dim);
            line-height: 1.6;
        }

        /* ===== CONTACT ===== */
        .contact-links {
            display: flex;
            gap: 14px;
            flex-wrap: wrap;
        }
        .contact-link {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 16px 24px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            text-decoration: none;
            color: var(--text);
            font-weight: 700;
            font-size: 0.9rem;
            transition: all 0.2s;
            min-width: 180px;
        }
        .contact-link:hover { border-color: var(--accent); background: var(--bg-card-hover); }
        .contact-link-icon {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.1rem;
            flex-shrink: 0;
        }

        /* ===== FOOTER ===== */
        .port-footer {
            text-align: center;
            padding: 40px 24px;
            border-top: 1px solid var(--border);
            color: var(--text-muted);
            font-size: 0.82rem;
        }

        /* ===== SCROLL REVEAL ===== */
        .reveal {
            opacity: 0;
            transform: translateY(24px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .reveal.visible {
            opacity: 1;
            transform: translateY(0);
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 768px) {
            .hero h1 { font-size: 2rem; }
            .hero-subtitle { font-size: 1rem; }
            .section { padding: 60px 16px; }
            .project-card { padding: 24px; }
            .project-stats { gap: 16px; }
            .skills-grid { grid-template-columns: 1fr 1fr; }
            .contact-links { flex-direction: column; }
            .port-nav-links a { padding: 6px 10px; font-size: 0.78rem; }
        }
        @media (max-width: 480px) {
            .hero h1 { font-size: 1.6rem; }
            .skills-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>

    <!-- Nav -->
    <nav class="port-nav">
        <div class="port-nav-logo">Stuart Hollinger</div>
        <div class="port-nav-links">
            <a href="#about">About</a>
            <a href="#project">Project</a>
            <a href="#skills">Skills</a>
            <a href="#experience">Experience</a>
            <a href="#contact">Contact</a>
        </div>
    </nav>

    <!-- Hero -->
    <section class="hero" id="hero">
        <div class="hero-badge">Open to Work</div>
        <h1>Stuart <span>Hollinger</span></h1>
        <p class="hero-subtitle">AI Product Builder & Full-Stack Engineer. I shipped an entire app ecosystem from scratch — 30k+ lines, 8+ apps, zero team.</p>
        <div class="hero-cta">
            <a href="#project" class="cta-primary">See What I Built</a>
            <a href="#contact" class="cta-secondary">Get in Touch</a>
        </div>
    </section>

    <!-- About -->
    <section class="section" id="about">
        <div class="reveal">
            <div class="section-label">About</div>
            <h2 class="section-heading">Builder First, Engineer Second</h2>
            <div class="about-text">
                <p>I build things that work and ship them. <strong>SuiteGPT</strong> is the proof — a full AI-powered app ecosystem I designed, coded, and deployed solo.</p>
                <br>
                <p>My path here wasn''t traditional. I started in <strong>CNC engineering and precision manufacturing</strong>, where I learned systems thinking and tight tolerances. Then I spent <strong>7 years in DeFi and crypto</strong>, building smart contracts, token economies, staking systems, and treasury management on Ethereum and Base.</p>
                <br>
                <p>Now I''m combining all of it — <strong>engineering discipline, crypto-native economics, and AI-first product design</strong> — to build tools that actually matter. I''m looking for a team that ships fast and thinks big.</p>
            </div>
        </div>
    </section>

    <!-- Featured Project -->
    <section class="section" id="project">
        <div class="reveal">
            <div class="section-label">Featured Project</div>
            <h2 class="section-heading">SuiteGPT</h2>
            <div class="project-card">
                <div class="project-name">AI-Native App Ecosystem</div>
                <div class="project-desc">
                    A complete platform where anyone can build, deploy, and monetize AI-powered apps. Features an AI code generator, credit system with on-chain staking, iframe-sandboxed apps with postMessage bridges, governance system, and builder earnings via credit markup. Live and serving real users.
                </div>
                <div class="project-stats">
                    <div class="project-stat">
                        <div class="project-stat-value">30k+</div>
                        <div class="project-stat-label">Lines of Code</div>
                    </div>
                    <div class="project-stat">
                        <div class="project-stat-value">8+</div>
                        <div class="project-stat-label">Live Apps</div>
                    </div>
                    <div class="project-stat">
                        <div class="project-stat-value">Solo</div>
                        <div class="project-stat-label">Developer</div>
                    </div>
                    <div class="project-stat">
                        <div class="project-stat-value">Live</div>
                        <div class="project-stat-label">In Production</div>
                    </div>
                </div>
                <div class="tech-badges">
                    <span class="tech-badge">JavaScript</span>
                    <span class="tech-badge">Supabase</span>
                    <span class="tech-badge">Vercel</span>
                    <span class="tech-badge">Gemini API</span>
                    <span class="tech-badge">Claude API</span>
                    <span class="tech-badge">Solidity</span>
                    <span class="tech-badge">ethers.js</span>
                    <span class="tech-badge">HTML/CSS</span>
                    <span class="tech-badge">PostgreSQL</span>
                </div>
                <a href="https://getsuite.app" target="_blank" class="project-link">Visit getsuite.app &rarr;</a>
            </div>
        </div>
    </section>

    <!-- Skills -->
    <section class="section" id="skills">
        <div class="reveal">
            <div class="section-label">Skills</div>
            <h2 class="section-heading">What I Work With</h2>
            <div class="skills-grid">
                <div class="skill-card">
                    <div class="skill-card-icon" style="color:var(--blue)">&#x1F310;</div>
                    <div class="skill-card-title">Frontend</div>
                    <div class="skill-card-list">JavaScript, HTML5, CSS3, Responsive Design, Iframe Sandboxing, PostMessage APIs</div>
                </div>
                <div class="skill-card">
                    <div class="skill-card-icon" style="color:var(--green)">&#x2699;&#xFE0F;</div>
                    <div class="skill-card-title">Backend</div>
                    <div class="skill-card-list">Supabase, PostgreSQL, RPC Functions, REST APIs, Row-Level Security, Edge Functions</div>
                </div>
                <div class="skill-card">
                    <div class="skill-card-icon" style="color:var(--orange)">&#x26D3;&#xFE0F;</div>
                    <div class="skill-card-title">Blockchain</div>
                    <div class="skill-card-list">Solidity, ethers.js, ERC-20 Tokens, Staking Contracts, Base/Ethereum, DeFi Protocols</div>
                </div>
                <div class="skill-card">
                    <div class="skill-card-icon" style="color:var(--purple)">&#x1F916;</div>
                    <div class="skill-card-title">AI / LLMs</div>
                    <div class="skill-card-list">Gemini API, Claude API, Groq, Prompt Engineering, AI Code Generation, Multi-Model Routing</div>
                </div>
                <div class="skill-card">
                    <div class="skill-card-icon" style="color:var(--red)">&#x1F680;</div>
                    <div class="skill-card-title">DevOps</div>
                    <div class="skill-card-list">Vercel, Git, CI/CD, DNS Management, Domain Routing, Environment Management</div>
                </div>
            </div>
        </div>
    </section>

    <!-- Experience -->
    <section class="section" id="experience">
        <div class="reveal">
            <div class="section-label">Experience</div>
            <h2 class="section-heading">Where I''ve Been</h2>
            <div class="timeline">
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-period">2024 - Present</div>
                    <div class="timeline-title">Founder & Solo Developer — SuiteGPT</div>
                    <div class="timeline-desc">Designed and built an AI-native app ecosystem from scratch. 30k+ lines of code, 8+ production apps, credit economy with on-chain staking, governance system, and automated content publishing. Full-stack: frontend, backend, smart contracts, AI integration, deployment.</div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-period">2017 - 2024</div>
                    <div class="timeline-title">DeFi & Crypto Builder</div>
                    <div class="timeline-desc">7 years building in decentralized finance. Smart contract development (Solidity), token economics design, staking and yield systems, treasury management, and community governance on Ethereum and Base L2.</div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-period">Prior</div>
                    <div class="timeline-title">CNC Engineering & Precision Manufacturing</div>
                    <div class="timeline-desc">Programmed and operated CNC machines for precision parts. Developed strong systems thinking, attention to detail, and process optimization skills that directly transfer to software architecture.</div>
                </div>
            </div>
        </div>
    </section>

    <!-- Contact -->
    <section class="section" id="contact">
        <div class="reveal">
            <div class="section-label">Contact</div>
            <h2 class="section-heading">Let''s Connect</h2>
            <div class="contact-links">
                <a href="https://github.com/stuarthollinger" target="_blank" class="contact-link">
                    <div class="contact-link-icon" style="background:var(--bg);border:1px solid var(--border);">&#x1F4BB;</div>
                    GitHub
                </a>
                <a href="https://linkedin.com/in/stuarthollinger" target="_blank" class="contact-link">
                    <div class="contact-link-icon" style="background:var(--blue-soft);color:var(--blue);">in</div>
                    LinkedIn
                </a>
                <a href="mailto:stuart@getsuite.app" class="contact-link">
                    <div class="contact-link-icon" style="background:var(--accent-soft);color:var(--accent);">&#x2709;&#xFE0F;</div>
                    Email
                </a>
                <a href="https://getsuite.app" target="_blank" class="contact-link">
                    <div class="contact-link-icon" style="background:var(--purple-soft);color:var(--purple);">S</div>
                    getsuite.app
                </a>
            </div>
        </div>
    </section>

    <footer class="port-footer">
        Built with SUITE &middot; Stuart Hollinger &middot; 2026
    </footer>

    <script>
        // Scroll reveal
        const revealEls = document.querySelectorAll(''.reveal'');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add(''visible'');
                }
            });
        }, { threshold: 0.15 });
        revealEls.forEach(el => observer.observe(el));

        // Smooth scroll nav
        document.querySelectorAll(''.port-nav-links a'').forEach(link => {
            link.addEventListener(''click'', (e) => {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute(''href''));
                if (target) {
                    target.scrollIntoView({ behavior: ''smooth'', block: ''start'' });
                }
            });
        });
    </script>
</body>
</html>',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Add to suite_operators so it shows on /apps page
INSERT INTO suite_operators (user_app_id, user_id, name, description, status, slug)
VALUES (
    'a2c7e3f1-9d84-4b6a-8e2f-1a3c5d7e9f0b',
    '71963d89-452d-4ed3-ba16-e340f36a310f',
    'Portfolio',
    'Professional portfolio website — shareable link for job applications with project showcase, skills, experience timeline, and contact info',
    'active',
    'portfolio'
) ON CONFLICT DO NOTHING;
