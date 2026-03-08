// Code Reviewer / Smart Contract Auditor
// GET  /api/inclawbate/audit?id=<uuid>  — Public certificate
// POST /api/inclawbate/audit             — Run review (10 credits)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const FREE_CREDIT_WALLETS = [
    '0x91b5c0d07859cfeafeb67d9694121cd741f049bd'
];
const FREE_HANDLES = ['artstu'];

const CREDIT_COST = 10;

const SMART_CONTRACT_PROMPT = `You are a senior smart contract security auditor. Review the following code for:
- Reentrancy vulnerabilities
- Access control issues
- Integer overflow/underflow
- Front-running risks
- Gas optimization
- Logic errors
- Unsafe external calls
- Missing input validation

Return ONLY valid JSON (no markdown, no code fences) with this structure:
{"score": 0-100, "grade": "A-F", "summary": "1 paragraph", "findings": [{"severity": "critical|high|medium|low|info", "title": "string", "description": "string", "line": number_or_null}]}

Severity levels: critical, high, medium, low, info
Be thorough but fair. A score of 80+ means production-ready with minor issues. Below 50 means serious problems.`;

const GENERAL_CODE_PROMPT = `You are a senior code reviewer. Review the following code for:
- Bugs and logic errors
- Security vulnerabilities (injection, XSS, etc.)
- Performance issues
- Code quality and readability
- Best practices violations

Return ONLY valid JSON (no markdown, no code fences) with this structure:
{"score": 0-100, "grade": "A-F", "summary": "1 paragraph", "findings": [{"severity": "critical|high|medium|low|info", "title": "string", "description": "string", "line": number_or_null}]}

Severity levels: critical, high, medium, low, info
Be thorough but fair. A score of 80+ means production-ready with minor issues. Below 50 means serious problems.`;

const SMART_CONTRACT_LANGUAGES = ['solidity', 'vyper', 'move', 'cairo'];

function detectLanguage(code) {
    const lower = code.toLowerCase();
    if (/pragma\s+solidity/i.test(code) || /contract\s+\w+\s*\{/i.test(code)) return 'solidity';
    if (/@external|@internal|@view|@pure/.test(code) && /def\s+\w+/.test(code) && /#\s*@version/.test(code)) return 'vyper';
    if (/module\s+\w+::/.test(code)) return 'move';
    if (/#\[starknet::contract\]/.test(code)) return 'cairo';
    if (/^use\s+|fn\s+\w+|impl\s+\w+/m.test(code) && /->/.test(code)) return 'rust';
    if (/^package\s+\w+/m.test(code) && /func\s+\w+/m.test(code)) return 'go';
    if (/^import\s+.*from\s+['"]|const\s+\w+\s*=|=>\s*\{/m.test(code)) return 'javascript';
    if (/:\s*(string|number|boolean|void)\b|interface\s+\w+/m.test(code)) return 'typescript';
    if (/^(def |class |import |from )/m.test(code) && /:\s*$/m.test(code)) return 'python';
    return 'unknown';
}

async function hashCode(code) {
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — public certificate
    if (req.method === 'GET') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'Missing audit id' });

        const { data, error } = await supabase
            .from('inclawbate_audits')
            .select('id, code_hash, language, is_smart_contract, score, grade, findings, summary, model_used, created_at')
            .eq('id', id)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Audit not found' });

        return res.status(200).json(data);
    }

    // POST — run review
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const profileId = user.sub;

    // Credit check
    const { data: profile } = await supabase
        .from('human_profiles')
        .select('id, credits, wallet_address, x_handle')
        .eq('id', profileId)
        .single();

    const isAdmin = FREE_CREDIT_WALLETS.includes(profile?.wallet_address?.toLowerCase())
        || FREE_HANDLES.includes(profile?.x_handle?.toLowerCase());

    if (!isAdmin) {
        if ((profile?.credits || 0) < CREDIT_COST) {
            return res.status(402).json({ error: 'Insufficient credits', credits: profile?.credits || 0 });
        }
    }

    const { code, language: langOverride } = req.body || {};
    if (!code || typeof code !== 'string' || code.trim().length < 10) {
        return res.status(400).json({ error: 'Code is required (minimum 10 characters)' });
    }
    if (code.length > 50000) {
        return res.status(400).json({ error: 'Code too long (max 50,000 characters)' });
    }

    const language = langOverride && langOverride !== 'auto' ? langOverride : detectLanguage(code);
    const isSmartContract = SMART_CONTRACT_LANGUAGES.includes(language);
    const systemPrompt = isSmartContract ? SMART_CONTRACT_PROMPT : GENERAL_CODE_PROMPT;
    const codeHash = await hashCode(code);

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 4096,
                system: systemPrompt,
                messages: [{ role: 'user', content: `Review this ${language} code:\n\n${code}` }]
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Anthropic error:', data);
            return res.status(500).json({ error: 'AI review failed' });
        }

        const text = data.content?.[0]?.text || '';

        let result;
        try {
            // Try to extract JSON even if wrapped in code fences
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            result = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        } catch (e) {
            console.error('Failed to parse AI response:', text);
            return res.status(500).json({ error: 'Failed to parse review results' });
        }

        // Store in DB
        const { data: audit, error: insertError } = await supabase
            .from('inclawbate_audits')
            .insert({
                profile_id: profileId,
                code_hash: codeHash,
                language,
                is_smart_contract: isSmartContract,
                score: result.score,
                grade: result.grade,
                findings: result.findings || [],
                summary: result.summary,
                model_used: 'claude-haiku-4-5-20251001',
                credits_charged: isAdmin ? 0 : CREDIT_COST
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('DB insert error:', insertError);
            return res.status(500).json({ error: 'Failed to save audit' });
        }

        // Deduct credits
        let creditsRemaining = profile?.credits || 0;
        if (!isAdmin) {
            creditsRemaining -= CREDIT_COST;
            await supabase.from('human_profiles')
                .update({ credits: creditsRemaining })
                .eq('id', profileId);
        }

        return res.status(200).json({
            id: audit.id,
            score: result.score,
            grade: result.grade,
            summary: result.summary,
            findings: result.findings || [],
            language,
            is_smart_contract: isSmartContract,
            code_hash: codeHash,
            credits: creditsRemaining
        });

    } catch (err) {
        console.error('audit error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
