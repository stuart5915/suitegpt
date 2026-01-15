
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// API.Bible Key - TODO: Move to .env
const BIBLE_API_KEY = 'yq2zB4TNCZQ62T0Y5VU96';
const BASE_URL = 'https://rest.api.bible/v1';

const STORAGE_KEYS = {
    ADDED_VERSIONS: 'user_bible_versions',
    SELECTED_VERSION: 'selected_bible_version'
};

// Popular Bible versions with their API.Bible IDs
export const POPULAR_VERSIONS: BibleVersion[] = [
    {
        id: 'de4e12af7f28f599-02',
        abbreviation: 'ESV',
        name: 'English Standard Version',
        description: 'The ESV is an essentially literal translation that seeks to capture the precise wording of the original text.',
        language: { id: 'eng', name: 'English' },
        audio: true,
    },
    {
        id: '06125adad2d5898a-01',
        abbreviation: 'ASV',
        name: 'American Standard Version',
        description: 'A revision of the King James Version published in 1901.',
        language: { id: 'eng', name: 'English' },
        audio: false,
    },
    {
        id: 'de4e12af7f28f599-01',
        abbreviation: 'KJV',
        name: 'King James Version',
        description: 'The King James Version, commissioned in 1604 and completed in 1611.',
        language: { id: 'eng', name: 'English' },
        audio: true,
    },
    {
        id: '592420522e16049f-01',
        abbreviation: 'WEB',
        name: 'World English Bible',
        description: 'An update of the American Standard Version, in modern English.',
        language: { id: 'eng', name: 'English' },
        audio: false,
    },
    {
        id: '9879dbb7cfe39e4d-04',
        abbreviation: 'WEBBE',
        name: 'World English Bible British Edition',
        description: 'World English Bible in British English spelling.',
        language: { id: 'eng', name: 'English' },
        audio: false,
    },
    {
        id: '55212e3cf5d04d49-01',
        abbreviation: 'DARBY',
        name: 'Darby Translation',
        description: 'John Nelson Darby\'s translation of the Bible.',
        language: { id: 'eng', name: 'English' },
        audio: false,
    },
];

// Book name to API.Bible book ID mapping
export const BOOK_ID_MAP: Record<string, string> = {
    'Genesis': 'GEN', 'Exodus': 'EXO', 'Leviticus': 'LEV', 'Numbers': 'NUM', 'Deuteronomy': 'DEU',
    'Joshua': 'JOS', 'Judges': 'JDG', 'Ruth': 'RUT', '1 Samuel': '1SA', '2 Samuel': '2SA',
    '1 Kings': '1KI', '2 Kings': '2KI', '1 Chronicles': '1CH', '2 Chronicles': '2CH',
    'Ezra': 'EZR', 'Nehemiah': 'NEH', 'Esther': 'EST', 'Job': 'JOB', 'Psalm': 'PSA', 'Psalms': 'PSA',
    'Proverbs': 'PRO', 'Ecclesiastes': 'ECC', 'Song of Solomon': 'SNG', 'Isaiah': 'ISA',
    'Jeremiah': 'JER', 'Lamentations': 'LAM', 'Ezekiel': 'EZK', 'Daniel': 'DAN',
    'Hosea': 'HOS', 'Joel': 'JOL', 'Amos': 'AMO', 'Obadiah': 'OBA', 'Jonah': 'JON',
    'Micah': 'MIC', 'Nahum': 'NAM', 'Habakkuk': 'HAB', 'Zephaniah': 'ZEP', 'Haggai': 'HAG',
    'Zechariah': 'ZEC', 'Malachi': 'MAL',
    'Matthew': 'MAT', 'Mark': 'MRK', 'Luke': 'LUK', 'John': 'JHN', 'Acts': 'ACT',
    'Romans': 'ROM', '1 Corinthians': '1CO', '2 Corinthians': '2CO', 'Galatians': 'GAL',
    'Ephesians': 'EPH', 'Philippians': 'PHP', 'Colossians': 'COL', '1 Thessalonians': '1TH',
    '2 Thessalonians': '2TH', '1 Timothy': '1TI', '2 Timothy': '2TI', 'Titus': 'TIT',
    'Philemon': 'PHM', 'Hebrews': 'HEB', 'James': 'JAS', '1 Peter': '1PE', '2 Peter': '2PE',
    '1 John': '1JN', '2 John': '2JN', '3 John': '3JN', 'Jude': 'JUD', 'Revelation': 'REV',
};

export interface BibleVersion {
    id: string;
    abbreviation: string;
    name: string;
    description: string;
    language: {
        id: string;
        name: string;
    };
    copyright?: string;
    contactUrl?: string;
    audio: boolean;
}

export interface UserBibleVersion extends BibleVersion {
    addedAt: string;
    isDownloaded: boolean;
}

export const BibleVersionsService = {
    // API Call to search versions
    async searchVersions(query: string = '', languageStart: string = 'eng'): Promise<BibleVersion[]> {
        try {
            const url = `${BASE_URL}/bibles?language=${languageStart}&name=${query}`;
            const response = await fetch(url, {
                headers: {
                    'api-key': BIBLE_API_KEY,
                },
            });
            const data = await response.json();

            if (data.data) {
                return data.data.map((b: any) => ({
                    id: b.id,
                    abbreviation: b.abbreviation,
                    name: b.name,
                    description: b.description,
                    language: {
                        id: b.language.id,
                        name: b.language.name,
                    },
                    copyright: b.copyright,
                    audio: !!b.audioBibles?.length,
                }));
            }
            return [];
        } catch (error) {
            console.error('Error fetching Bible versions:', error);
            return [];
        }
    },

    // Get a specific version details
    async getVersion(id: string): Promise<BibleVersion | null> {
        try {
            const response = await fetch(`${BASE_URL}/bibles/${id}`, {
                headers: {
                    'api-key': BIBLE_API_KEY,
                },
            });
            const data = await response.json();
            if (data.data) {
                const b = data.data;
                return {
                    id: b.id,
                    abbreviation: b.abbreviation,
                    name: b.name,
                    description: b.description,
                    language: {
                        id: b.language.id,
                        name: b.language.name,
                    },
                    copyright: b.copyright,
                    audio: !!b.audioBibles?.length,
                };
            }
            return null;
        } catch (error) {
            console.error(`Error fetching version ${id}:`, error);
            return null;
        }
    },

    // --- User Library Management (Hybrid: Supabase + Local Storage) ---

    // Get list of added versions (synced with Supabase if logged in)
    async getAddedVersions(): Promise<UserBibleVersion[]> {
        try {
            // 1. Try fetching from Supabase if logged in
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                const { data, error } = await supabase
                    .from('user_bible_versions')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    // Map Supabase data to UserBibleVersion
                    const onlineVersions: UserBibleVersion[] = data.map((row: any) => ({
                        id: row.version_id,
                        name: row.name || 'Unknown Version',
                        abbreviation: row.abbreviation || 'UNK',
                        description: '', // Not stored in DB to save space
                        language: {
                            id: 'unk',
                            name: row.language || (row.language_code === 'eng' ? 'English' : 'Unknown')
                        },
                        audio: false, // Assuming audio status is not stored in Supabase for simplicity
                        addedAt: row.created_at,
                        isDownloaded: row.is_downloaded
                    }));

                    // Update local cache to match server truth
                    await AsyncStorage.setItem(STORAGE_KEYS.ADDED_VERSIONS, JSON.stringify(onlineVersions));
                    return onlineVersions;
                }
            }
        } catch (error) {
            console.warn('Failed to sync versions with Supabase, using local.', error);
        }

        // 2. Fallback to local storage (Offline or Auth failure)
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.ADDED_VERSIONS);
            if (jsonValue != null) {
                return JSON.parse(jsonValue);
            }

            // Default to ESV if nothing stored and no cloud data
            const defaultESV: UserBibleVersion = {
                id: '06125adad2d58000-01',
                abbreviation: 'ESV',
                name: 'English Standard Version',
                description: 'The English Standard Version (ESV) stands in the classic stream of English Bible translations.',
                language: { id: 'eng', name: 'English' },
                audio: true,
                addedAt: new Date().toISOString(),
                isDownloaded: true,
            };
            await this.saveAddedVersions([defaultESV]);
            return [defaultESV];
        } catch (e) {
            console.error('Failed to load bible versions locally', e);
            return [];
        }
    },

    // Helper to save to local storage
    async saveAddedVersions(versions: UserBibleVersion[]): Promise<void> {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.ADDED_VERSIONS, JSON.stringify(versions));
        } catch (error) {
            console.error('Error saving versions locally:', error);
        }
    },

    // Add a version to library
    async addVersion(version: BibleVersion): Promise<void> {
        try {
            const userVersion: UserBibleVersion = {
                ...version,
                addedAt: new Date().toISOString(),
                isDownloaded: true // Simulating download
            };

            // 1. Update Local Storage immediately (Optimistic UI)
            const currentVersions = await this.getAddedVersions();
            if (!currentVersions.find(v => v.id === version.id)) {
                const updatedVersions = [...currentVersions, userVersion];
                await AsyncStorage.setItem(STORAGE_KEYS.ADDED_VERSIONS, JSON.stringify(updatedVersions));
            }

            // 2. Sync with Supabase (Background)
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await supabase.from('user_bible_versions').upsert({
                    user_id: session.user.id,
                    version_id: version.id,
                    name: version.name,
                    abbreviation: version.abbreviation,
                    language: version.language.name,
                    is_downloaded: true,
                    created_at: new Date().toISOString(),
                }, { onConflict: 'user_id, version_id' });
            }

        } catch (e) {
            console.error('Failed to add bible version', e);
            throw e;
        }
    },

    // Remove a version
    async removeVersion(versionId: string): Promise<void> {
        try {
            // 1. Update Local Storage
            const currentVersions = await this.getAddedVersions();
            const updatedVersions = currentVersions.filter(v => v.id !== versionId);
            await AsyncStorage.setItem(STORAGE_KEYS.ADDED_VERSIONS, JSON.stringify(updatedVersions));

            // 2. Sync with Supabase
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await supabase
                    .from('user_bible_versions')
                    .delete()
                    .eq('user_id', session.user.id)
                    .eq('version_id', versionId);
            }
        } catch (e) {
            console.error('Failed to remove bible version', e);
            throw e;
        }
    },

    async toggleDownloadStatus(id: string, isDownloaded: boolean): Promise<void> {
        const current = await this.getAddedVersions();
        const updated = current.map(v =>
            v.id === id ? { ...v, isDownloaded } : v
        );
        await this.saveAddedVersions(updated);

        // Sync status to Supabase if possible
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            await supabase
                .from('user_bible_versions')
                .update({ is_downloaded: isDownloaded })
                .eq('user_id', session.user.id)
                .eq('version_id', id);
        }
    },

    // Get the currently selected version
    async getSelectedVersion(): Promise<BibleVersion> {
        try {
            const json = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_VERSION);
            if (json) {
                return JSON.parse(json);
            }
        } catch (e) {
            console.error('Error loading selected version:', e);
        }
        // Default to ESV
        return POPULAR_VERSIONS[0];
    },

    // Set the selected version
    async setSelectedVersion(version: BibleVersion): Promise<void> {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_VERSION, JSON.stringify(version));
        } catch (e) {
            console.error('Error saving selected version:', e);
        }
    },

    // Fetch chapter content from API.Bible
    async fetchChapter(versionId: string, book: string, chapter: number): Promise<{ html: string; copyright?: string }> {
        const bookId = BOOK_ID_MAP[book];
        if (!bookId) {
            console.error(`[fetchChapter] Unknown book: ${book}`);
            return { html: '<p>Unknown book</p>' };
        }

        const chapterId = `${bookId}.${chapter}`;

        try {
            const response = await fetch(`${BASE_URL}/bibles/${versionId}/chapters/${chapterId}?content-type=html&include-notes=false&include-titles=true&include-chapter-numbers=true&include-verse-numbers=true&include-verse-spans=true`, {
                headers: {
                    'api-key': BIBLE_API_KEY,
                },
            });

            if (!response.ok) {
                throw new Error(`API.Bible error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.data?.content) {
                return {
                    html: data.data.content,
                    copyright: data.meta?.fumsId ? undefined : data.data.copyright,
                };
            }

            return { html: '<p>No content available for this chapter</p>' };
        } catch (error) {
            console.error('[fetchChapter] Error:', error);
            return { html: '<p>Failed to load chapter. Please try again.</p>' };
        }
    },

    // Search all versions from API.Bible
    async searchAllVersions(query: string = ''): Promise<BibleVersion[]> {
        try {
            const url = `${BASE_URL}/bibles?language=eng`;
            const response = await fetch(url, {
                headers: {
                    'api-key': BIBLE_API_KEY,
                },
            });
            const data = await response.json();

            if (data.data) {
                let versions = data.data.map((b: any) => ({
                    id: b.id,
                    abbreviation: b.abbreviation || b.abbreviationLocal,
                    name: b.name || b.nameLocal,
                    description: b.description || '',
                    language: {
                        id: b.language?.id || 'eng',
                        name: b.language?.name || 'English',
                    },
                    copyright: b.copyright,
                    audio: !!b.audioBibles?.length,
                }));

                // Filter by query if provided
                if (query) {
                    const lowerQuery = query.toLowerCase();
                    versions = versions.filter((v: BibleVersion) =>
                        v.name.toLowerCase().includes(lowerQuery) ||
                        v.abbreviation.toLowerCase().includes(lowerQuery)
                    );
                }

                return versions;
            }
            return [];
        } catch (error) {
            console.error('Error searching Bible versions:', error);
            return [];
        }
    },
};
