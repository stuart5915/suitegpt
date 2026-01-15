/**
 * Content Sanitization Service
 * Cleans user input for reflections, replies, and profile fields
 */

// Minimal profanity list - only the most vulgar words
const PROFANITY_LIST = [
    'fuck', 'fucking', 'fucked', 'fucker',
    'shit', 'shitting', 'bullshit',
    'ass', 'asshole',
    'bitch', 'bitches',
    'damn', 'damnit',
    'cunt',
    'dick', 'dickhead',
    'bastard',
];

// Build regex pattern for whole-word matching (case insensitive)
const profanityRegex = new RegExp(
    `\\b(${PROFANITY_LIST.join('|')})\\b`,
    'gi'
);

// URL patterns to block
const urlPatterns = [
    /https?:\/\/[^\s]+/gi,           // http:// or https://
    /www\.[^\s]+/gi,                  // www.
    /[^\s]+\.(com|org|net|io|co|me|app|xyz|info|biz)[^\s]*/gi,  // common TLDs
];

/**
 * Sanitize reflection/reply text
 */
export function sanitizeReflection(text: string): string {
    let cleaned = text;

    // 1. Trim whitespace
    cleaned = cleaned.trim();

    // 2. Collapse excessive newlines (max 2 consecutive)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // 3. Strip HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, '');

    // 4. Block URLs
    for (const pattern of urlPatterns) {
        cleaned = cleaned.replace(pattern, '[link removed]');
    }

    // 5. Light profanity filter
    cleaned = cleaned.replace(profanityRegex, '***');

    return cleaned;
}

/**
 * Validate and sanitize username
 * Rules: 3-20 chars, lowercase, alphanumeric + underscores only
 */
export function sanitizeUsername(text: string): { valid: boolean; username: string; error?: string } {
    // Trim and lowercase
    let username = text.trim().toLowerCase();

    // Remove @ prefix if user entered it
    if (username.startsWith('@')) {
        username = username.slice(1);
    }

    // Check length
    if (username.length < 3) {
        return { valid: false, username, error: 'Username must be at least 3 characters' };
    }
    if (username.length > 20) {
        return { valid: false, username, error: 'Username must be 20 characters or less' };
    }

    // Check format (alphanumeric + underscores only)
    if (!/^[a-z0-9_]+$/.test(username)) {
        return { valid: false, username, error: 'Username can only contain letters, numbers, and underscores' };
    }

    // Check doesn't start with number
    if (/^[0-9]/.test(username)) {
        return { valid: false, username, error: 'Username cannot start with a number' };
    }

    // Check profanity
    if (profanityRegex.test(username)) {
        return { valid: false, username, error: 'Username contains inappropriate language' };
    }

    return { valid: true, username };
}

/**
 * Sanitize display name
 */
export function sanitizeDisplayName(text: string): string {
    let cleaned = text;

    // Trim
    cleaned = cleaned.trim();

    // Remove excessive spaces
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Strip HTML
    cleaned = cleaned.replace(/<[^>]*>/g, '');

    // Light profanity filter
    cleaned = cleaned.replace(profanityRegex, '***');

    // Limit length
    if (cleaned.length > 50) {
        cleaned = cleaned.slice(0, 50);
    }

    return cleaned;
}

/**
 * Sanitize bio text
 */
export function sanitizeBio(text: string): string {
    let cleaned = text;

    // Trim
    cleaned = cleaned.trim();

    // Collapse excessive newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Strip HTML
    cleaned = cleaned.replace(/<[^>]*>/g, '');

    // Block URLs
    for (const pattern of urlPatterns) {
        cleaned = cleaned.replace(pattern, '[link removed]');
    }

    // Light profanity filter
    cleaned = cleaned.replace(profanityRegex, '***');

    // Limit length
    if (cleaned.length > 160) {
        cleaned = cleaned.slice(0, 160);
    }

    return cleaned;
}

/**
 * Check if text contains blocked content (for validation without modifying)
 */
export function containsBlockedContent(text: string): { hasLinks: boolean; hasProfanity: boolean } {
    const hasLinks = urlPatterns.some(pattern => pattern.test(text));
    const hasProfanity = profanityRegex.test(text);

    // Reset regex lastIndex since we're using global flag
    profanityRegex.lastIndex = 0;

    return { hasLinks, hasProfanity };
}
