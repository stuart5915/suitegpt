const ESV_API_KEY = process.env.ESV_API_KEY || 'e55ab33811225c8a3ff071a920733c42bdbd8a01';
const ESV_API_URL = 'https://api.esv.org/v3/passage/html/';

import { OfflineStorageService } from './offlineStorage';
import { BibleVersionsService, POPULAR_VERSIONS, type BibleVersion } from './bibleVersions';

export interface ScripturePassage {
    reference: string;
    html: string;
    isCached?: boolean;
    versionId?: string;
}

// Format book name and chapter for ESV API
function formatPassageReference(book: string, chapterStart: number, chapterEnd?: number): string {
    if (chapterEnd && chapterEnd > chapterStart) {
        return `${book} ${chapterStart}-${chapterEnd}`;
    }
    return `${book} ${chapterStart}`;
}

// Check if version is ESV (use native ESV API for better formatting)
function isEsvVersion(version: BibleVersion | null): boolean {
    if (!version) return true;
    return version.abbreviation === 'ESV';
}

// Maximum chapters to fetch in a single API call (ESV API truncates larger requests)
const MAX_CHAPTERS_PER_REQUEST = 10;

// Fetch scripture passage from ESV API (with Offline Fallback) - Original function kept for backwards compatibility
export async function fetchScripture(
    book: string,
    chapterStart: number,
    chapterEnd?: number
): Promise<ScripturePassage> {
    const reference = formatPassageReference(book, chapterStart, chapterEnd);
    const numChapters = (chapterEnd || chapterStart) - chapterStart + 1;

    // 1. Check Cache First (only serve HTML-format cache)
    try {
        const cached = await OfflineStorageService.getCachedScripture(reference, 'ESV');
        // Only use cache if it's HTML format (contains < character, indicating tags)
        if (cached && cached.text.includes('<')) {
            return {
                reference,
                html: cached.text,
                isCached: true,
                versionId: 'ESV',
            };
        }
    } catch (err) {
        console.error('[Cache Check Error]', err);
    }

    // 2. For large chapter ranges, batch into smaller requests
    if (numChapters > MAX_CHAPTERS_PER_REQUEST && chapterEnd) {
        console.log(`[fetchScripture] Batching ${numChapters} chapters into chunks of ${MAX_CHAPTERS_PER_REQUEST}`);

        const batches: Promise<ScripturePassage>[] = [];
        for (let start = chapterStart; start <= chapterEnd; start += MAX_CHAPTERS_PER_REQUEST) {
            const end = Math.min(start + MAX_CHAPTERS_PER_REQUEST - 1, chapterEnd);
            // Recursive call for each batch (will use single-request path)
            batches.push(fetchScripture(book, start, end));
        }

        const results = await Promise.all(batches);

        // Combine all HTML results
        const combinedHtml = results.map(r => r.html).join('\n');

        // Cache the combined result
        if (combinedHtml && !combinedHtml.includes('Unable to load')) {
            await OfflineStorageService.saveCachedScripture(reference, combinedHtml, 'ESV');
        }

        return {
            reference,
            html: combinedHtml,
            isCached: false,
            versionId: 'ESV',
        };
    }

    // 3. Fetch from API (single request for small ranges)
    try {
        const params = new URLSearchParams({
            q: reference,
            'include-headings': 'true',
            'include-footnotes': 'false',
            'include-verse-numbers': 'true',
            'include-short-copyright': 'false',
            'include-passage-references': 'false',
            'include-chapter-numbers': 'true',
        });

        const response = await fetch(`${ESV_API_URL}?${params}`, {
            headers: {
                'Authorization': `Token ${ESV_API_KEY}`,
            },
        });

        if (!response.ok) {
            throw new Error(`ESV API error: ${response.statusText}`);
        }

        const data = await response.json();
        const html = data.passages?.[0]?.trim() || '<p>Scripture text not available</p>';

        // 4. Save to Cache with version ID
        if (html && html !== '<p>Scripture text not available</p>') {
            await OfflineStorageService.saveCachedScripture(reference, html, 'ESV');
        }

        return {
            reference,
            html,
            isCached: false,
            versionId: 'ESV',
        };
    } catch (error) {
        console.error('Error fetching scripture:', error);

        // Double check cache in case of partial failure/race condition (rare)
        const cachedFallback = await OfflineStorageService.getCachedScripture(reference, 'ESV');
        if (cachedFallback) {
            return {
                reference,
                html: cachedFallback.text,
                isCached: true,
                versionId: 'ESV',
            };
        }

        return {
            reference,
            html: '<p>Unable to load scripture text. Please check your connection.</p>',
            isCached: false,
            versionId: 'ESV',
        };
    }
}

// NEW: Fetch scripture with specific version support
export async function fetchScriptureWithVersion(
    book: string,
    chapter: number,
    version: BibleVersion | null
): Promise<ScripturePassage> {
    const reference = formatPassageReference(book, chapter);
    const versionId = version?.abbreviation || 'ESV';

    // Use ESV API for ESV (better formatting and audio support)
    if (isEsvVersion(version)) {
        return fetchScripture(book, chapter);
    }

    // For other versions, use API.Bible AND fetch ESV headings
    try {
        // Fetch both in parallel - API.Bible content + ESV for headings
        const [apiResult, esvResult] = await Promise.all([
            (async () => {
                // Check cache first
                const cached = await OfflineStorageService.getCachedScripture(reference, versionId);
                if (cached && cached.text.includes('<')) {
                    return { html: cached.text, isCached: true };
                }
                // Fetch from API.Bible
                const result = await BibleVersionsService.fetchChapter(version!.id, book, chapter);
                // Save to cache
                if (result.html && !result.html.includes('Failed to load')) {
                    await OfflineStorageService.saveCachedScripture(reference, result.html, versionId);
                }
                return { html: result.html, isCached: false };
            })(),
            // Also fetch ESV for section headings
            fetchScripture(book, chapter).catch(() => null)
        ]);

        // Extract section headings from ESV and inject into API.Bible HTML
        let finalHtml = apiResult.html;
        if (esvResult && esvResult.html) {
            finalHtml = injectEsvHeadings(apiResult.html, esvResult.html);
        }

        return {
            reference,
            html: finalHtml,
            isCached: apiResult.isCached,
            versionId,
        };
    } catch (error) {
        console.error('Error fetching scripture from API.Bible:', error);

        // Try cache fallback
        const cachedFallback = await OfflineStorageService.getCachedScripture(reference, versionId);
        if (cachedFallback) {
            return {
                reference,
                html: cachedFallback.text,
                isCached: true,
                versionId,
            };
        }

        return {
            reference,
            html: '<p>Unable to load scripture text. Please check your connection.</p>',
            isCached: false,
            versionId,
        };
    }
}

// Helper: Extract h3 headings from ESV and inject into other translation HTML
function injectEsvHeadings(targetHtml: string, esvHtml: string): string {
    // Extract headings with their associated verse positions from ESV
    // ESV format: <h3>Heading</h3> followed by verse content with chapter-num or verse-num
    const headings: { text: string; beforeVerse: number }[] = [];

    // Find all h3 tags and the verse that follows them
    const h3Regex = /<h3[^>]*>(.*?)<\/h3>/gi;
    let match;

    while ((match = h3Regex.exec(esvHtml)) !== null) {
        const headingText = match[1].replace(/<[^>]*>/g, '').trim(); // Strip any inner HTML
        const afterHeading = esvHtml.slice(match.index + match[0].length);

        // Find the next verse number after this heading
        // Look for chapter-num (first verse) or verse-num
        const chapterNumMatch = afterHeading.match(/<b[^>]*class="[^"]*chapter-num[^"]*"[^>]*>(\d+):?(\d+)?/);
        const verseNumMatch = afterHeading.match(/<b[^>]*class="[^"]*verse-num[^"]*"[^>]*>(\d+)/);

        let verseNum = 1; // Default to verse 1
        if (chapterNumMatch) {
            verseNum = chapterNumMatch[2] ? parseInt(chapterNumMatch[2], 10) : 1;
        } else if (verseNumMatch) {
            verseNum = parseInt(verseNumMatch[1], 10);
        }

        headings.push({ text: headingText, beforeVerse: verseNum });
    }

    if (headings.length === 0) {
        return targetHtml; // No headings to inject
    }

    // Inject headings into target HTML before their respective verses
    let result = targetHtml;

    // Check if we have a heading for verse 1 - if so, remove the standalone chapter header
    const hasVerse1Heading = headings.some(h => h.beforeVerse === 1);
    if (hasVerse1Heading) {
        // Remove API.Bible's standalone chapter number header (h2 with class="c")
        // This prevents showing both "Paul Accepted..." and "2" separately
        result = result.replace(/<h2[^>]*class="[^"]*c[^"]*"[^>]*>.*?<\/h2>/gi, '');
    }

    // Process headings in reverse order to avoid position shifting issues
    for (let i = headings.length - 1; i >= 0; i--) {
        const { text, beforeVerse } = headings[i];
        const headingHtml = `<h3>${text}</h3>`;

        // Find the verse marker in target HTML
        // For verse 1, look for chapter header or first verse
        let targetPattern: RegExp;
        if (beforeVerse === 1) {
            // Look for chapter number or verse 1 (we already removed h2.c above)
            targetPattern = /<(?:span[^>]*class="api-chapter"[^>]*>|b[^>]*class="[^"]*(?:chapter-num|verse-num)[^"]*"[^>]*>|span[^>]*class="verse-span"[^>]*>)/i;
        } else {
            // Look for specific verse number
            targetPattern = new RegExp(`<b[^>]*class="[^"]*verse-num[^"]*"[^>]*>${beforeVerse}\\b`, 'i');
        }

        const insertMatch = result.match(targetPattern);
        if (insertMatch && insertMatch.index !== undefined) {
            // Insert heading before the verse marker
            result = result.slice(0, insertMatch.index) + headingHtml + result.slice(insertMatch.index);
        }
    }

    return result;
}

// Fetch multiple passages at once
export async function fetchMultiplePassages(
    readings: Array<{ book: string; chapterStart: number; chapterEnd: number }>
): Promise<ScripturePassage[]> {
    const promises = readings.map(r =>
        fetchScripture(r.book, r.chapterStart, r.chapterEnd)
    );
    return Promise.all(promises);
}

// Fetch a specific verse reference (e.g., "John 3:16" or "Matthew 5:17-18")
export async function fetchVerseReference(reference: string): Promise<ScripturePassage> {
    // Check cache first
    try {
        const cached = await OfflineStorageService.getCachedScripture(reference);
        if (cached && cached.text.includes('<')) {
            return {
                reference,
                html: cached.text,
                isCached: true,
            };
        }
    } catch (err) {
        console.error('[Cache Check Error]', err);
    }

    // Fetch from API
    try {
        const params = new URLSearchParams({
            q: reference,
            'include-headings': 'false',
            'include-footnotes': 'false',
            'include-verse-numbers': 'true',
            'include-short-copyright': 'false',
            'include-passage-references': 'false',
            'include-chapter-numbers': 'false',
        });

        const response = await fetch(`${ESV_API_URL}?${params}`, {
            headers: {
                'Authorization': `Token ${ESV_API_KEY}`,
            },
        });

        if (!response.ok) {
            throw new Error(`ESV API error: ${response.statusText}`);
        }

        const data = await response.json();
        const html = data.passages?.[0]?.trim() || '<p>Scripture text not available</p>';

        // Cache for next time
        if (html && html !== '<p>Scripture text not available</p>') {
            await OfflineStorageService.saveCachedScripture(reference, html);
        }

        return {
            reference,
            html,
            isCached: false,
        };
    } catch (error) {
        console.error('Error fetching verse reference:', error);
        return {
            reference,
            html: '<p>Unable to load scripture text. Please check your connection.</p>',
            isCached: false,
        };
    }
}

// Get audio URL for a passage (ESV API)
export function getAudioUrl(book: string, chapter: number): string {
    const reference = `${book} ${chapter}`;
    // The ESV API returns a redirect to the MP3 file
    // We need to include the API key in the URL for the Audio element to work
    return `https://api.esv.org/v3/passage/audio/?q=${encodeURIComponent(reference)}`;
}

// Get the ESV API key for audio authorization header
export function getEsvApiKey(): string {
    return ESV_API_KEY;
}
