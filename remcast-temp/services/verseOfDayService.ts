import { supabase } from './supabase';

export interface DailyVerse {
    id?: string;
    date: string;
    verse_reference: string;
    verse_text: string;
    created_at?: string;
}

// Fallback verses for when API is unavailable
const fallbackVerses: DailyVerse[] = [
    {
        date: '',
        verse_reference: 'Jeremiah 29:11',
        verse_text: '"For I know the plans I have for you," declares the Lord, "plans to prosper you and not to harm you, plans to give you hope and a future."',
    },
    {
        date: '',
        verse_reference: 'Philippians 4:13',
        verse_text: 'I can do all this through him who gives me strength.',
    },
    {
        date: '',
        verse_reference: 'Psalm 23:1',
        verse_text: 'The Lord is my shepherd, I lack nothing.',
    },
    {
        date: '',
        verse_reference: 'Proverbs 3:5-6',
        verse_text: 'Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.',
    },
    {
        date: '',
        verse_reference: 'Romans 8:28',
        verse_text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.',
    },
    {
        date: '',
        verse_reference: 'Isaiah 41:10',
        verse_text: 'So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.',
    },
    {
        date: '',
        verse_reference: 'Matthew 11:28',
        verse_text: 'Come to me, all you who are weary and burdened, and I will give you rest.',
    },
    {
        date: '',
        verse_reference: 'Psalm 46:10',
        verse_text: 'He says, "Be still, and know that I am God; I will be exalted among the nations, I will be exalted in the earth."',
    },
    {
        date: '',
        verse_reference: 'Joshua 1:9',
        verse_text: 'Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.',
    },
    {
        date: '',
        verse_reference: 'John 3:16',
        verse_text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
    },
];

/**
 * Fetch verse from external API
 */
async function fetchVerseFromAPI(): Promise<{ reference: string; text: string } | null> {
    try {
        // Try DailyVerses.net API (free, no auth required)
        const response = await fetch('https://beta.ourmanna.com/api/v1/get?format=json&order=daily');

        if (response.ok) {
            const data = await response.json();
            if (data.verse?.details?.text && data.verse?.details?.reference) {
                return {
                    reference: data.verse.details.reference,
                    text: data.verse.details.text,
                };
            }
        }
    } catch (error) {
        console.error('Error fetching from OurManna API:', error);
    }

    // Fallback: try Bible API
    try {
        const response = await fetch('https://labs.bible.org/api/?passage=votd&type=json');
        if (response.ok) {
            const data = await response.json();
            if (data[0]) {
                return {
                    reference: `${data[0].bookname} ${data[0].chapter}:${data[0].verse}`,
                    text: data[0].text.replace(/<[^>]*>/g, ''), // Strip HTML tags
                };
            }
        }
    } catch (error) {
        console.error('Error fetching from Bible.org API:', error);
    }

    return null;
}

/**
 * Get a deterministic fallback verse based on date
 */
function getFallbackVerse(date: string): DailyVerse {
    // Use date to pick a consistent fallback verse
    const dayOfYear = Math.floor(
        (new Date(date).getTime() - new Date(new Date(date).getFullYear(), 0, 0).getTime()) / 86400000
    );
    const index = dayOfYear % fallbackVerses.length;
    return { ...fallbackVerses[index], date };
}

/**
 * Get today's verse from cache or API
 */
export async function getTodaysVerse(): Promise<DailyVerse> {
    const today = new Date().toISOString().split('T')[0];

    // Check cache first
    const { data: cached, error } = await supabase
        .from('daily_verses')
        .select('*')
        .eq('date', today)
        .single();

    if (cached && !error) {
        return cached;
    }

    // Fetch from API
    const apiVerse = await fetchVerseFromAPI();

    if (apiVerse) {
        const newVerse: DailyVerse = {
            date: today,
            verse_reference: apiVerse.reference,
            verse_text: apiVerse.text,
        };

        // Save to cache
        const { error: insertError } = await supabase
            .from('daily_verses')
            .insert(newVerse);

        if (insertError) {
            console.error('Error caching verse:', insertError);
        }

        return newVerse;
    }

    // Use fallback
    return getFallbackVerse(today);
}

/**
 * Force refresh today's verse (for manual refresh button)
 */
export async function refreshTodaysVerse(): Promise<DailyVerse> {
    const today = new Date().toISOString().split('T')[0];

    // Fetch new verse from API
    const apiVerse = await fetchVerseFromAPI();

    if (apiVerse) {
        const newVerse: DailyVerse = {
            date: today,
            verse_reference: apiVerse.reference,
            verse_text: apiVerse.text,
        };

        // Upsert (update if exists, insert if not)
        const { error } = await supabase
            .from('daily_verses')
            .upsert(newVerse, { onConflict: 'date' });

        if (error) {
            console.error('Error updating verse:', error);
        }

        return newVerse;
    }

    // Return cached or fallback
    return getTodaysVerse();
}
