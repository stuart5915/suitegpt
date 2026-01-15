import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Platform, Modal, Animated, FlatList, useWindowDimensions, Share, Alert, KeyboardAvoidingView, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Typography } from '../components/ui/Typography';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BottomNav } from '../components/ui/BottomNav';
import { useScrollToTop } from '../components/ui/ScrollToTopButton';
import { ReflectionModal } from '../components/ui/ReflectionModal';
import { Colors, Spacing, BorderRadius, FontSizes, FontFamilies } from '../constants/theme';
import {
    getCurrentPlan, getPlanById, saveJournalEntry, getJournalEntry, saveDailyProgress, updateStreak, type DailyReading, saveVerseHighlight, getVerseHighlights, deleteVerseHighlight, type VerseHighlight, getPlanCompletionStatus,
    getJournalEntriesForDay, updatePlanProgress,
    type ReadingPlan,
    type JournalEntry
} from '../services/database';
import { generateReadingPlan, PlanType } from '../services/planGenerator';
import { fetchScripture, fetchScriptureWithVersion, getAudioUrl, getEsvApiKey, type ScripturePassage } from '../services/bibleApi';
import { BibleVersionsService, POPULAR_VERSIONS, type BibleVersion } from '../services/bibleVersions';
import { generateReflectionPrompts, generateTLDR, generateExpandedTLDR, generateNuancePrompts, generateNuanceDeepDive, type NuancePrompt } from '../services/geminiService';
import { getCachedTLDR, cacheTLDR, getCachedNuance, cacheNuance, getCachedExpandedTLDR, cacheExpandedTLDR } from '../services/aiCache';
import { publishReflection } from '../services/feedService';
import { useTheme } from '../contexts/ThemeContext';
import RenderHTML from 'react-native-render-html';
import { Audio } from 'expo-av';

// --- Highlight Colors ---
const HIGHLIGHT_COLORS = [
    { name: 'Yellow', hex: '#FFE082' }, // Amber 200
    { name: 'Green', hex: '#A5D6A7' },  // Green 200
    { name: 'Blue', hex: '#90CAF9' },   // Blue 200
    { name: 'Pink', hex: '#F48FB1' },   // Pink 200
    { name: 'Purple', hex: '#CE93D8' }, // Purple 200
];

// HTML Tag Styles for RenderHTML (Scripture Display)
const scriptureTagStyles = {
    body: {
        fontFamily: FontFamilies.serif,
        color: Colors.charcoal,
    },
    h2: {
        fontFamily: FontFamilies.serifBold,
        fontSize: 22,
        color: Colors.gold,
        textAlign: 'center',
        marginTop: 24,
        marginBottom: 12,
    },
    h3: {
        fontFamily: FontFamilies.serifBold,
        fontSize: 18,
        color: Colors.gold,
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 8,
        fontStyle: 'italic',
    },
    p: {
        marginBottom: 8,
    },
    // Verse numbers are typically in <span class="verse-num"> or <b class="verse-num">

    b: {
        fontWeight: 'bold',
    },
};

const scriptureClassesStyles = {
    'chapter-num': {
        fontSize: 32,
        lineHeight: 40,
        fontFamily: FontFamilies.serifBold,
        color: Colors.gold,
        marginTop: 24,
        marginRight: 4,
        display: 'block' as any, // Force block layout for reliable onLayout
    },
    'verse-num': {
        fontSize: 12,
        color: Colors.mediumGray,
        fontWeight: 'bold' as any,
        paddingRight: 4,
    },
    'chapter-block': {
        height: 1,
        marginTop: 20,
    }
};

export default function Daily() {
    const router = useRouter();
    const params = useLocalSearchParams();
    // Allow either 'id' or 'planId' to support different navigation sources
    const planIdParam = params.id || params.planId;
    const planId = typeof planIdParam === 'string' ? planIdParam : null;
    const initialMode = params.mode === 'journey' ? 'journey' : 'daily';
    // Get day from URL params (1-indexed) and convert to 0-indexed
    const dayParam = typeof params.day === 'string' ? parseInt(params.day, 10) : null;

    const scrollViewRef = useRef<ScrollView>(null);
    const journeyListRef = useRef<FlatList>(null);
    const reflectionSectionRef = useRef<View>(null);
    const [reflectionPlaceholder, setReflectionPlaceholder] = useState('');
    const [showReflectModal, setShowReflectModal] = useState(false);
    const [modalReflection, setModalReflection] = useState('');
    const { isVisible: showScrollTop, handleScroll: baseHandleScroll, scrollToTop } = useScrollToTop(scrollViewRef);
    const [loading, setLoading] = useState(true);

    // Floating nav scroll animation
    const navOpacity = useRef(new Animated.Value(1)).current;
    const lastScrollY = useRef(0);
    const [isNavHidden, setIsNavHidden] = useState(false);
    const actionSheetBottom = useRef(new Animated.Value(90)).current; // 90 = above nav bar

    const handleScroll = (event: any) => {
        baseHandleScroll(event);
        const currentY = event.nativeEvent.contentOffset.y;
        const diff = currentY - lastScrollY.current;

        // Only trigger animation on significant scroll direction change
        if (diff > 10 && !isNavHidden && currentY > 50) {
            setIsNavHidden(true);
            Animated.parallel([
                Animated.timing(navOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                // Move action sheet down when nav hides
                Animated.timing(actionSheetBottom, { toValue: 20, duration: 200, useNativeDriver: false }),
            ]).start();
        } else if (diff < -10 && isNavHidden) {
            setIsNavHidden(false);
            Animated.parallel([
                Animated.timing(navOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                // Move action sheet up when nav shows
                Animated.timing(actionSheetBottom, { toValue: 90, duration: 200, useNativeDriver: false }),
            ]).start();
        }

        lastScrollY.current = currentY;
    };

    // View Mode State
    const [viewMode, setViewMode] = useState<'daily' | 'journey'>(initialMode);
    const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());


    const [scripture, setScripture] = useState<ScripturePassage | null>(null);
    const [prompts, setPrompts] = useState<string[]>([]);
    const [promptsLoading, setPromptsLoading] = useState(false); // New loading state
    const [reflection, setReflection] = useState(''); // Current input value
    const [dailyEntries, setDailyEntries] = useState<any[]>([]); // Past entries for this day
    const [showReflectionsTimeline, setShowReflectionsTimeline] = useState(false); // Toggle timeline view

    const [todayReadings, setTodayReadings] = useState<DailyReading[]>([]);
    const [currentDayIndex, setCurrentDayIndex] = useState(0);
    const [totalDuration, setTotalDuration] = useState(0);
    const [planCurrentDay, setPlanCurrentDay] = useState(1); // Track plan's current_day
    const [showSaved, setShowSaved] = useState(false);
    const [sharePublicly, setSharePublicly] = useState(false);
    const [tldr, setTldr] = useState<string>('');
    const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
    const [planType, setPlanType] = useState<PlanType | null>(null);

    // --- Nuance / Points of Contemplation ---
    const [nuancePrompts, setNuancePrompts] = useState<NuancePrompt[]>([]);
    const [selectedNuance, setSelectedNuance] = useState<string | null>(null);
    const [showNuanceModal, setShowNuanceModal] = useState(false);
    const [nuanceDeepDive, setNuanceDeepDive] = useState<string | null>(null);
    const [loadingDeepDive, setLoadingDeepDive] = useState(false);
    const nuanceSpinAnim = useRef(new Animated.Value(0)).current;

    // Expanded TL;DR State
    const [expandedTldr, setExpandedTldr] = useState<string | null>(null);
    const [loadingExpandedTldr, setLoadingExpandedTldr] = useState(false);
    const [showExpandedTldr, setShowExpandedTldr] = useState(false);
    const [reflectionContext, setReflectionContext] = useState(''); // Text shown in reflection modal card
    const [expandedNuanceIndex, setExpandedNuanceIndex] = useState<number | null>(null);
    const [nuanceCache, setNuanceCache] = useState<Record<string, string>>({}); // Cache for pre-fetched deep dives
    const [isTldrCollapsed, setIsTldrCollapsed] = useState(true); // TLDR starts collapsed

    // --- Audio Player State ---
    const [showAudioPlayer, setShowAudioPlayer] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [audioLoading, setAudioLoading] = useState(false);
    const [audioPosition, setAudioPosition] = useState(0); // in milliseconds
    const [audioDuration, setAudioDuration] = useState(0); // in milliseconds
    const [currentAudioChapter, setCurrentAudioChapter] = useState(1); // Which chapter is playing
    const audioPlayerAnim = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = visible
    const soundRef = useRef<Audio.Sound | null>(null);

    // --- Version Management State ---
    const [showVersionsModal, setShowVersionsModal] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<BibleVersion | null>(null);
    const [versionSearchQuery, setVersionSearchQuery] = useState('');
    const [allVersions, setAllVersions] = useState<BibleVersion[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);

    // PanResponder for swipe-down to close audio panel
    const audioPanelPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only activate for downward swipes
                return gestureState.dy > 10 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
            },
            onPanResponderMove: (_, gestureState) => {
                // Only allow downward movement
                if (gestureState.dy > 0) {
                    const dragProgress = Math.min(1, gestureState.dy / 150);
                    audioPlayerAnim.setValue(1 - dragProgress);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 80 || gestureState.vy > 0.5) {
                    // Close the panel
                    setShowAudioPlayer(false);
                    Animated.timing(audioPlayerAnim, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: false,
                    }).start();
                    // Pause audio when closing
                    if (soundRef.current) {
                        soundRef.current.pauseAsync();
                    }
                } else {
                    // Snap back to open
                    Animated.spring(audioPlayerAnim, {
                        toValue: 1,
                        useNativeDriver: false,
                        tension: 65,
                        friction: 11,
                    }).start();
                }
            },
        })
    ).current;

    // --- Linkable Verse/Chapter Logic ---
    const versePositions = useRef<{ [key: string]: number }>({});
    const chapterRefs = useRef<{ [key: number]: View | null }>({});
    const htmlContainerY = useRef(0);
    const lastSeenChapter = useRef<number>(1); // Default to 1

    const scrollToRef = (ref: string, retryCount: number = 0) => {
        // Handle comma-separated lists and clean the reference
        const cleanRef = ref.replace(/[\[\]]/g, '').split(',')[0].trim();
        // e.g. "1:2", "Gen 1:2", "1:2-3", "v.3"

        console.log(`[scrollToRef] Input: "${ref}" -> Cleaned: "${cleanRef}" (retry: ${retryCount})`);

        // Parse the reference to get chapter and verse
        let chapter: string | null = null;
        let verse: string | null = null;

        // Try to parse "Chapter:Verse" (e.g. 1:2 or 1:2-23)
        const cvMatch = cleanRef.match(/(\d+):(\d+)/);
        if (cvMatch) {
            chapter = cvMatch[1];
            verse = cvMatch[2];
        }

        // Try parsing just Chapter "Chapter 1" or "1:"
        if (!chapter) {
            const cMatch = cleanRef.match(/(\d+):/);
            if (cMatch) {
                chapter = cMatch[1];
                verse = '1'; // Default to verse 1
            }
        }

        // Try parsing "v.1" or "v1" format (legacy)
        if (!chapter && !verse) {
            const vMatch = cleanRef.match(/v\.?(\d+)/i);
            if (vMatch) {
                chapter = '1'; // Assume chapter 1
                verse = vMatch[1];
            }
        }

        console.log(`[scrollToRef] Parsed: chapter=${chapter}, verse=${verse}`);

        // On Web: Use robust DOM-based scrolling with text content search
        if (Platform.OS === 'web' && (chapter || verse)) {
            const targetVerseText = verse || '1';
            const targetChapterText = chapter || '1';

            // Helper to find element containing specific verse number text
            const findVerseElement = (): HTMLElement | null => {
                // Strategy 1: Look for nativeID/testID based elements (most reliable)
                const verseId = `verse-${targetChapterText}-${targetVerseText}`;
                const chapterId = `chapter-${targetChapterText}`;

                let element = document.getElementById(verseId) as HTMLElement;
                if (element) {
                    console.log(`[scrollToRef] Found verse by ID: ${verseId}`);
                    return element;
                }

                element = document.querySelector(`[data-testid="${verseId}"]`) as HTMLElement;
                if (element) {
                    console.log(`[scrollToRef] Found verse by testID: ${verseId}`);
                    return element;
                }

                // Strategy 2: Find chapter markers by ID pattern (from custom renderer)
                // The custom renderer creates elements with id="chapter-X"
                // First, try to find the target chapter directly by ID
                let chapterElement = document.getElementById(`chapter-${targetChapterText}`) as HTMLElement;

                if (!chapterElement) {
                    // Also try data-testid
                    chapterElement = document.querySelector(`[data-testid="chapter-${targetChapterText}"]`) as HTMLElement;
                }

                console.log(`[scrollToRef] Looking for chapter-${targetChapterText}, found: ${!!chapterElement}`);

                if (chapterElement) {
                    console.log(`[scrollToRef] Found chapter ${targetChapterText} by ID`);

                    // If looking for verse 1, the chapter marker IS the verse
                    if (targetVerseText === '1') {
                        console.log(`[scrollToRef] Target is verse 1, using chapter element`);
                        return chapterElement;
                    }

                    // Try to find the exact verse by ID first
                    const exactVerseId = `verse-${targetChapterText}-${targetVerseText}`;
                    let verseElement = document.getElementById(exactVerseId) as HTMLElement;
                    if (!verseElement) {
                        verseElement = document.querySelector(`[data-testid="${exactVerseId}"]`) as HTMLElement;
                    }

                    if (verseElement) {
                        console.log(`[scrollToRef] Found verse ${targetVerseText} by exact ID: ${exactVerseId}`);
                        return verseElement;
                    }

                    // Fallback: Find all verse elements in this chapter by position
                    console.log(`[scrollToRef] Searching for verse ${targetVerseText} by position within chapter ${targetChapterText}`);

                    // Get bounding rect of our chapter marker
                    const chapterRect = chapterElement.getBoundingClientRect();

                    // Find the next chapter marker (if any) to bound our search
                    const nextChapterNum = parseInt(targetChapterText, 10) + 1;
                    let nextChapterElement = document.getElementById(`chapter-${nextChapterNum}`) as HTMLElement;
                    if (!nextChapterElement) {
                        nextChapterElement = document.querySelector(`[data-testid="chapter-${nextChapterNum}"]`) as HTMLElement;
                    }
                    const nextChapterRect = nextChapterElement?.getBoundingClientRect();

                    // Find all verse elements by ID pattern
                    const allVerseElements = document.querySelectorAll(`[id^="verse-${targetChapterText}-"]`);
                    console.log(`[scrollToRef] Found ${allVerseElements.length} verse elements for chapter ${targetChapterText}`);

                    for (const verseEl of Array.from(allVerseElements)) {
                        // Extract verse number from id like "verse-24-29"
                        const idMatch = verseEl.id.match(/verse-\d+-(\d+)/);
                        if (idMatch && idMatch[1] === targetVerseText) {
                            console.log(`[scrollToRef] Found verse ${targetVerseText} by ID pattern`);
                            return verseEl as HTMLElement;
                        }
                    }

                    // Also try searching by text content (fallback for verse-num class elements)
                    const verseNumElements = document.querySelectorAll('[id^="verse-"]');
                    for (const verseEl of Array.from(verseNumElements)) {
                        const verseRect = verseEl.getBoundingClientRect();

                        // Check if this verse is after our chapter marker
                        if (verseRect.top < chapterRect.top) continue;

                        // Check if this verse is before the next chapter marker (if exists)
                        if (nextChapterRect && verseRect.top >= nextChapterRect.top) continue;

                        // Extract verse number from id
                        const idMatch = verseEl.id.match(/verse-\d+-(\d+)/);
                        if (idMatch && idMatch[1] === targetVerseText) {
                            console.log(`[scrollToRef] Found verse ${targetVerseText} in chapter ${targetChapterText} by position`);
                            return verseEl as HTMLElement;
                        }
                    }

                    // Verse not found in chapter, scroll to chapter start
                    console.log(`[scrollToRef] Verse ${targetVerseText} not found in chapter ${targetChapterText}, using chapter marker`);
                    return chapterElement;
                }

                console.log(`[scrollToRef] No element found for ${targetChapterText}:${targetVerseText}`);
                return null;
            };

            const element = findVerseElement();

            if (element) {
                // Find parent scrollable container and scroll
                let scrollContainer: HTMLElement | null = element.parentElement;
                while (scrollContainer && scrollContainer.tagName !== 'BODY') {
                    const style = window.getComputedStyle(scrollContainer);
                    if (style.overflowY === 'auto' || style.overflowY === 'scroll' ||
                        scrollContainer.scrollHeight > scrollContainer.clientHeight) {
                        const elRect = element.getBoundingClientRect();
                        const containerRect = scrollContainer.getBoundingClientRect();
                        const scrollAmount = elRect.top - containerRect.top - 100; // 100px offset for header
                        scrollContainer.scrollBy({ top: scrollAmount, behavior: 'smooth' });
                        console.log(`[scrollToRef] Web: scrolled to verse ${targetChapterText}:${targetVerseText}, scrollBy=${scrollAmount}`);
                        return;
                    }
                    scrollContainer = scrollContainer.parentElement;
                }

                // Fallback: use scrollIntoView
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                console.log(`[scrollToRef] Web: used scrollIntoView fallback`);
                return;
            }

            // Element not found - retry after content renders (up to 3 times)
            if (retryCount < 3) {
                console.log(`[scrollToRef] Element not found, retrying in 500ms...`);
                setTimeout(() => scrollToRef(ref, retryCount + 1), 500);
                return;
            }

            // After all retries, the reference is likely outside the current passage
            // Navigate to the Bible reader with this reference
            console.log(`[scrollToRef] Web: element not found after ${retryCount} retries - navigating to bible reader`);

            // Try to extract book name from the reference
            const bookMatch = cleanRef.match(/^([1-3]?\s?[A-Za-z]+)\s*/);
            const bookName = bookMatch ? bookMatch[1].trim() : null;

            if (bookName && chapter) {
                // Navigate to bible reader with the reference
                router.push({
                    pathname: '/bible',
                    params: { book: bookName, chapter: chapter, verse: verse || '1' }
                });
            } else if (scripture?.reference) {
                // Fallback: parse the current scripture reference to get the book name
                const currentBookMatch = scripture.reference.match(/^([1-3]?\s?[A-Za-z]+)\s*/);
                const currentBook = currentBookMatch ? currentBookMatch[1].trim() : 'Genesis';
                if (chapter) {
                    router.push({
                        pathname: '/bible',
                        params: { book: currentBook, chapter: chapter, verse: verse || '1' }
                    });
                }
            }
            return;
        }

        // Native fallback: use stored positions
        console.log(`[scrollToRef] Available positions:`, Object.keys(versePositions.current));

        let targetY: number | undefined;

        if (chapter && verse) {
            // Try exact verse first
            targetY = versePositions.current[`c${chapter}v${verse}`];

            // Try chapter-only position
            if (targetY === undefined) {
                targetY = versePositions.current[`c${chapter}`];
            }

            // Fallback: find the first available verse for this chapter
            // (handles case where verse 1 is embedded in chapter marker and not separately registered)
            if (targetY === undefined) {
                const chapterPrefix = `c${chapter}v`;
                const availableKeys = Object.keys(versePositions.current).filter(k => k.startsWith(chapterPrefix));
                if (availableKeys.length > 0) {
                    // Sort by verse number and use the first one
                    availableKeys.sort((a, b) => {
                        const verseA = parseInt(a.replace(chapterPrefix, ''), 10);
                        const verseB = parseInt(b.replace(chapterPrefix, ''), 10);
                        return verseA - verseB;
                    });
                    targetY = versePositions.current[availableKeys[0]];
                    console.log(`[scrollToRef] Using first available verse for chapter ${chapter}: ${availableKeys[0]}`);
                }
            }
        }

        if (targetY === undefined && verse) {
            targetY = versePositions.current[`v${verse}`];
        }

        console.log(`[scrollToRef] Final targetY: ${targetY}, htmlContainerY: ${htmlContainerY.current}`);

        // Check if targetY is valid (0 often means measurement failed)
        const isValidPosition = targetY !== undefined && targetY > 0;

        if (isValidPosition && scrollViewRef.current && targetY !== undefined) {
            const scrollY = htmlContainerY.current + targetY - 60;
            console.log(`[scrollToRef] Native: Scrolling to measured Y=${scrollY}`);
            scrollViewRef.current.scrollTo({ y: Math.max(0, scrollY), animated: true });
        } else if (chapter && todayReadings[0] && scrollViewRef.current) {
            // Fallback: use ratio-based scroll when positions are unreliable
            const currentReading = todayReadings[0];
            const startChapter = currentReading.chapterStart || 1;
            const endChapter = currentReading.chapterEnd || startChapter;
            const totalChapters = endChapter - startChapter + 1;
            const chapterNum = parseInt(chapter, 10);

            // Calculate position ratio (0 to 1) based on chapter in range
            // e.g., chapter 10 in range 1-10 = (10-1)/(10-1) = 1.0 (end)
            const chapterRatio = totalChapters > 1
                ? (chapterNum - startChapter) / (endChapter - startChapter)
                : 0;

            // For the last chapter (or near the end), just scroll to end - most reliable
            if (chapterRatio >= 0.9) {
                console.log(`[scrollToRef] Native: Scrolling to END for last chapter ${chapterNum}`);
                (scrollViewRef.current as any).scrollToEnd({ animated: true });
            } else {
                // For middle chapters, estimate height more generously
                // Matthew 1-10 is about 315 verses, each verse ~50-100px = 15000-30000px
                const estimatedHeight = totalChapters * 2000; // ~2000px per chapter average

                const scrollY = htmlContainerY.current + (chapterRatio * estimatedHeight);
                console.log(`[scrollToRef] Native: Using ratio-based scroll. Chapter ${chapterNum} of ${startChapter}-${endChapter}, ratio=${chapterRatio.toFixed(2)}, estimatedHeight=${estimatedHeight}, scrollY=${scrollY.toFixed(0)}`);
                scrollViewRef.current.scrollTo({ y: Math.max(0, scrollY), animated: true });
            }
        } else if (retryCount < 3) {
            // Retry on native too
            console.log(`[scrollToRef] Native: Position not found, retrying in 500ms...`);
            setTimeout(() => scrollToRef(ref, retryCount + 1), 500);
        } else {
            // After all retries, navigate to the Bible reader with this reference
            console.log(`[scrollToRef] Native: Reference ${ref} position not found after ${retryCount} retries - navigating to bible reader`);

            // Try to extract book name from the reference
            const bookMatch = cleanRef.match(/^([1-3]?\s?[A-Za-z]+)\s*/);
            const bookName = bookMatch ? bookMatch[1].trim() : null;

            if (bookName && chapter) {
                router.push({
                    pathname: '/bible',
                    params: { book: bookName, chapter: chapter, verse: verse || '1' }
                });
            } else if (scripture?.reference) {
                // Fallback: parse the current scripture reference to get the book name
                const currentBookMatch = scripture.reference.match(/^([1-3]?\s?[A-Za-z]+)\s*/);
                const currentBook = currentBookMatch ? currentBookMatch[1].trim() : 'Genesis';
                if (chapter) {
                    router.push({
                        pathname: '/bible',
                        params: { book: currentBook, chapter: chapter, verse: verse || '1' }
                    });
                }
            }
        }
    };

    // --- Highlighting State (must be before renderers) ---
    const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());
    const [highlights, setHighlights] = useState<VerseHighlight[]>([]);

    function toggleVerseSelection(verseNum: number) {
        const newSelection = new Set(selectedVerses);
        if (newSelection.has(verseNum)) {
            newSelection.delete(verseNum);
        } else {
            newSelection.add(verseNum);
        }
        setSelectedVerses(newSelection);
    }

    // Custom Renderer to capture layout & Ensure Chapter/Verse Blocks have onLayout
    // Using nativeID to enable scrolling via native scroll methods
    const renderers = useMemo(() => ({
        b: (props: any) => {
            const { TDefaultRenderer, tnode } = props;
            const isChapterNum = tnode.classes?.includes('chapter-num');
            const isVerseNum = tnode.classes?.includes('verse-num');

            // Get the text content (e.g., "4:1" for chapter, "2" for verse)
            const textContent = (tnode.init?.textNode?.data || tnode.children?.[0]?.init?.textNode?.data || '').trim();

            // Parse number - chapter-num from ESV is "4:1" format, verse-num is just "2"
            let chapterNumParsed: number | null = null;
            let verseNumParsed: number | null = null;

            if (isChapterNum) {
                // Chapter format is "4:1" - extract the chapter part
                const chapterMatch = textContent.match(/^(\d+):/);
                if (chapterMatch) {
                    chapterNumParsed = parseInt(chapterMatch[1], 10);
                } else {
                    chapterNumParsed = parseInt(textContent, 10);
                }
            } else if (isVerseNum) {
                verseNumParsed = parseInt(textContent, 10);
            }

            // For Chapter Numbers: Update context and render as View with nativeID for scrolling
            if (isChapterNum && chapterNumParsed !== null && !isNaN(chapterNumParsed)) {
                // Update chapter context synchronously
                lastSeenChapter.current = chapterNumParsed;

                // Create unique ID for this chapter
                const chapterId = `chapter-${chapterNumParsed}`;

                // Store a reference to enable native scrolling (web uses DOM querySelector)
                const onLayout = (event: any) => {
                    // For web: use pageY which is relative to document
                    if (Platform.OS === 'web') {
                        // Use setTimeout to ensure DOM is ready
                        setTimeout(() => {
                            const el = document.getElementById(chapterId);
                            if (el) {
                                // Find scroll container by walking up DOM
                                let scrollContainer: HTMLElement | null = el.parentElement;
                                while (scrollContainer) {
                                    const style = window.getComputedStyle(scrollContainer);
                                    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                                        break;
                                    }
                                    scrollContainer = scrollContainer.parentElement;
                                }

                                if (scrollContainer) {
                                    const elRect = el.getBoundingClientRect();
                                    const containerRect = scrollContainer.getBoundingClientRect();
                                    const y = scrollContainer.scrollTop + (elRect.top - containerRect.top);
                                    versePositions.current[`c${chapterNumParsed}`] = y;
                                    versePositions.current[`c${chapterNumParsed}v1`] = y;
                                    // Position stored silently
                                }
                            }
                        }, 100);
                    } else {
                        // Native: use layout.y (works correctly on native)
                        const y = event.nativeEvent.layout.y;
                        versePositions.current[`c${chapterNumParsed}`] = y;
                        versePositions.current[`c${chapterNumParsed}v1`] = y;
                        console.log(`[ChapterLayout] Chapter ${chapterNumParsed} onLayout fired, y=${y}`);
                    }
                };

                return (
                    <View
                        ref={(viewRef) => {
                            if (viewRef) {
                                chapterRefs.current[chapterNumParsed] = viewRef;
                            }
                        }}
                        onLayout={onLayout}
                        nativeID={chapterId}
                        testID={chapterId}
                        style={{ marginTop: 24, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}
                    >
                        <Text style={{
                            fontSize: 32,
                            fontFamily: FontFamilies.serifBold,
                            color: Colors.gold,
                            lineHeight: 40
                        }}>
                            {textContent}
                        </Text>
                    </View>
                );
            }

            // For Verse Numbers: Also render as View with nativeID
            if (isVerseNum && verseNumParsed !== null && !isNaN(verseNumParsed)) {
                // IMPORTANT: Capture chapter at render time, not at onLayout time (closure fix)
                const capturedChapter = lastSeenChapter.current;
                const verseId = `verse-${capturedChapter}-${verseNumParsed}`;
                const isSelected = selectedVerses.has(verseNumParsed);

                const onLayout = (event: any) => {
                    const y = event.nativeEvent.layout.y;
                    // Use captured chapter value, not current ref value
                    const chapterKey = `c${capturedChapter}v${verseNumParsed}`;
                    versePositions.current[chapterKey] = y;
                    versePositions.current[`v${verseNumParsed}`] = y;
                    // Position stored silently
                };

                // Render as inline-flex View to capture layout while keeping inline flow
                return (
                    <TouchableOpacity
                        onPress={() => toggleVerseSelection(verseNumParsed)}
                        activeOpacity={0.6}
                    >
                        <View
                            onLayout={onLayout}
                            nativeID={verseId}
                            testID={verseId}
                            style={{
                                display: 'inline-flex' as any,
                                flexDirection: 'row',
                                alignItems: 'baseline'
                            }}
                        >
                            <Text style={{
                                fontSize: 12,
                                color: isSelected ? Colors.gold : Colors.mediumGray,
                                fontWeight: 'bold',
                                paddingRight: 4,
                                textDecorationLine: isSelected ? 'underline' : 'none',
                            }}>
                                {textContent}
                            </Text>
                        </View>
                    </TouchableOpacity>
                );
            }

            // Default rendering for other <b> elements
            return <TDefaultRenderer {...props} />;
        },
        // Custom renderer for verse text spans (tappable) - same as bible.tsx
        span: (props: any) => {
            const { TDefaultRenderer, tnode } = props;
            const isVerseText = tnode.classes?.includes('verse-text');
            const isLine = tnode.classes?.includes('line');

            // Handle verse-text spans created by processScriptureHtml
            if (isVerseText) {
                const verseNumAttr = tnode.attributes?.['data-verse'];
                const verseNum = verseNumAttr ? parseInt(verseNumAttr, 10) : NaN;

                if (!isNaN(verseNum)) {
                    const isSelected = selectedVerses.has(verseNum);
                    const savedHighlight = highlights.find(h => h.verse === verseNum);
                    const highlightColor = savedHighlight?.color;

                    return (
                        <Text
                            onPress={() => {
                                console.log('[TAP] Verse text', verseNum, 'tapped!');
                                toggleVerseSelection(verseNum);
                            }}
                            style={{
                                cursor: 'pointer' as any,
                                textDecorationLine: isSelected ? 'underline' : 'none',
                                textDecorationStyle: isSelected ? 'dotted' : undefined,
                                textDecorationColor: isSelected ? '#333' : undefined,
                                backgroundColor: highlightColor
                                    ? highlightColor + '50'
                                    : 'transparent',
                            }}
                        >
                            <TDefaultRenderer {...props} />
                        </Text>
                    );
                }
            }

            // Handle line spans (in poetic books) - read data-verse from span itself
            if (isLine) {
                // data-verse is now added directly to span.line tags by processScriptureHtml
                const dataVerse = tnode.attributes?.['data-verse'];
                const verseNum = dataVerse ? parseInt(dataVerse, 10) : NaN;

                // Line span detected (logging disabled for noise reduction)

                if (!isNaN(verseNum) && verseNum > 0) {
                    const isSelected = selectedVerses.has(verseNum);
                    const savedHighlight = highlights.find(h => h.verse === verseNum);
                    const highlightColor = savedHighlight?.color;

                    return (
                        <Text
                            onPress={() => {
                                console.log('[TAP] Line in verse', verseNum, 'tapped!');
                                toggleVerseSelection(verseNum);
                            }}
                            style={{
                                cursor: 'pointer' as any,
                                textDecorationLine: isSelected ? 'underline' : 'none',
                                textDecorationStyle: isSelected ? 'dotted' : undefined,
                                textDecorationColor: isSelected ? '#333' : undefined,
                                backgroundColor: highlightColor
                                    ? highlightColor + '50'
                                    : 'transparent',
                            }}
                        >
                            <TDefaultRenderer {...props} />
                        </Text>
                    );
                }
            }

            return <TDefaultRenderer {...props} />;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [selectedVerses, highlights]);

    // Helper to process HTML - handles both prose and poetic books (unified approach from bible.tsx)
    const processScriptureHtml = (html: string) => {
        console.log('[processScriptureHtml] CALLED! HTML length:', html?.length);

        // NORMALIZE API.BIBLE HTML to match ESV format
        // 1. Transform API.Bible verses (<span class="v">1</span>) to ESV format (<b class="verse-num">1</b>)
        let processedHtml = html.replace(/<span[^>]*class="v"[^>]*>(\d+)<\/span>/gi, '<b class="verse-num">$1</b> ');

        // 2. Transform API.Bible chapters (<div class="c">1</div>) to custom class to avoid regex conflict with chapter-num
        // Use api-chapter class which has same styling but isn't picked up as a verse marker
        processedHtml = processedHtml.replace(/<(?:div|span)[^>]*class="c"[^>]*>(\d+)<\/(?:div|span)>/gi, '<span class="api-chapter">$1</span> ');

        // 3. FIRST: Transform section headers BEFORE flattening divs/p tags
        // API.Bible uses various classes for section headings: s, s1, s2, ms, ms1, etc.
        // Transform to h3 tags (which have gold/italic styling in scriptureTagStyles)
        processedHtml = processedHtml.replace(/<(?:div|span)[^>]*class="(?:s|s1|s2|ms|ms1|ms2|mr|r|d)"[^>]*>(.*?)<\/(?:div|span)>/gi, '<h3>$1</h3>');
        // NOTE: Do NOT transform h2/h3 tags - ESV uses them natively and they're already styled via scriptureTagStyles

        // 4. Transform API.Bible formatted content to be "Text-Safe" (Flatten Blocks)
        // React Native Text component cannot contain Block elements (Div/P).
        // Since we wrap verses in <a> (Inline), any <p> or <div> inside breaks the <a> tag.
        // Solution: Convert <p> and <div class="p"> to <br> breaks.

        // Replace start of paragraphs with double break
        // Replace start of paragraphs/divs with double break (Aggressive Flattening)
        processedHtml = processedHtml.replace(/<(?:p|div)[^>]*>/gi, '<br/><br/>');

        // Remove closing tags for p/div (we replaced starts with breaks)
        processedHtml = processedHtml.replace(/<\/(?:p|div)>/gi, '');

        // Remove double-double breaks/starts (cleanup)
        processedHtml = processedHtml.replace(/^(?:<br\/?>\s*)+/i, '');

        // Legacy: Transform old-style API.Bible section headers (if any remain)
        processedHtml = processedHtml.replace(/<div[^>]*class="s"[^>]*>(.*?)<\/div>/gi, '<br/><br/><b style="font-size:18px;color:#A67B5B;font-style:italic;">$1</b><br/>');

        // Use processedHtml for the rest of the function
        const htmlToUse = processedHtml;

        // Pass 1: Find all verse numbers and their positions
        // Match BOTH verse-num AND chapter-num (chapter-num contains verse 1 in format "1:1")
        const verses: { pos: number; endPos: number; verse: number; fullMatch: string }[] = [];

        // First, find chapter-num which contains verse 1 (format: "1:1" or just "1")
        const chapterPattern = /<b[^>]*class="[^"]*chapter-num[^"]*"[^>]*>(\d+):?(\d+)?[^<]*<\/b>/g;
        let chapterMatch;
        while ((chapterMatch = chapterPattern.exec(htmlToUse)) !== null) {
            // If format is "1:1", the verse is the second group (1), otherwise it's verse 1
            const verseNum = chapterMatch[2] ? parseInt(chapterMatch[2], 10) : 1;
            verses.push({
                pos: chapterMatch.index,
                endPos: chapterMatch.index + chapterMatch[0].length,
                verse: verseNum,
                fullMatch: chapterMatch[0]
            });
        }

        // Then find all verse-num elements (verses 2+)
        const versePattern = /<b[^>]*class="[^"]*verse-num[^"]*"[^>]*>(?:\d+:)?(\d+)[^<]*<\/b>/g;
        let verseMatch;
        while ((verseMatch = versePattern.exec(htmlToUse)) !== null) {
            verses.push({
                pos: verseMatch.index,
                endPos: verseMatch.index + verseMatch[0].length,
                verse: parseInt(verseMatch[1], 10),
                fullMatch: verseMatch[0]
            });
        }

        // Sort by position in HTML
        verses.sort((a, b) => a.pos - b.pos);

        console.log('[processScriptureHtml] Found', verses.length, 'verse markers');
        if (verses.length === 0) {
            return htmlToUse; // Return normalized if no verses found
        }

        // UNIFIED APPROACH: Always wrap verse text in span with data-verse attribute
        let result = '';
        let lastIndex = 0;

        for (let i = 0; i < verses.length; i++) {
            const v = verses[i];
            const verseTagEnd = v.endPos;

            // Add content before this verse number
            result += htmlToUse.slice(lastIndex, verseTagEnd);

            // Find where this verse's text ends
            const textEnd = (i < verses.length - 1) ? verses[i + 1].pos : htmlToUse.length;

            // Extract the verse text content
            const verseText = htmlToUse.slice(verseTagEnd, textEnd);

            // Wrap in span with data-verse attribute - RenderHTML handles this via span renderer
            // Use class="verse-text" for the span renderer to pick up
            result += `<span data-verse="${v.verse}" class="verse-text">${verseText}</span>`;

            lastIndex = textEnd;
        }

        result += htmlToUse.slice(lastIndex);
        console.log('[processScriptureHtml] Unified approach complete');
        return result;
    };
    function renderInteractiveText(text: string) {
        // Render verse citations as styled text (non-clickable)
        // Use the chapter quick-jump bar for navigation instead
        const parts = text.split(/(\[[A-Za-z0-9\s:,\.;-]+\])/g);

        return (
            <Text style={{ fontFamily: FontFamilies.serif, fontSize: 16, lineHeight: 24, color: Colors.charcoal }}>
                {parts.map((part, index) => {
                    // Check if it's a citation (contains brackets with numbers)
                    const isCitation = /^\[.*?\d+.*?\]$/.test(part);

                    if (isCitation) {
                        // Render as styled text (gold, bold) but non-clickable
                        return (
                            <Text
                                key={index}
                                style={{
                                    color: Colors.gold,
                                    fontWeight: 'bold',
                                    fontSize: 14,
                                }}
                            >
                                {part}
                            </Text>
                        );
                    }
                    return <Text key={index}>{part}</Text>;
                })}
            </Text>
        );
    }
    const [generatingNuance, setGeneratingNuance] = useState(false);
    const [loadingTldr, setLoadingTldr] = useState(false);

    // Auto-generate TL;DR when section is expanded and no cached version exists
    useEffect(() => {
        async function generateTldrOnExpand() {
            // Only trigger if section is expanded, no existing tldr, not already loading, and scripture is available
            if (!isTldrCollapsed && !tldr && !loadingTldr && scripture?.reference && scripture?.html) {
                setLoadingTldr(true);
                try {
                    // Check cache first
                    const cachedTldr = await getCachedTLDR(scripture.reference);
                    if (cachedTldr) {
                        setTldr(cachedTldr);
                    } else {
                        // Generate new TL;DR
                        const generated = await generateTLDR(scripture.reference, scripture.html);
                        setTldr(generated);
                        await cacheTLDR(scripture.reference, generated);
                    }
                } catch (error) {
                    console.error("Error generating TL;DR:", error);
                } finally {
                    setLoadingTldr(false);
                }
            }
        }
        generateTldrOnExpand();
    }, [isTldrCollapsed, tldr, scripture]);


    // --- Prompt Enhancements ---
    const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set());

    function togglePromptExpansion(index: number) {
        const newExpanded = new Set(expandedPrompts);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedPrompts(newExpanded);
    }

    async function handleRegeneratePrompts() {
        if (!scripture?.html) return;

        setPromptsLoading(true);
        setPrompts([]); // Clear existing
        try {
            // Generate new prompts
            const newPrompts = await generateReflectionPrompts(scripture.reference, scripture.html);
            setPrompts(newPrompts);
        } catch (error) {
            console.error('Error regenerating prompts:', error);
            alert('Failed to regenerate prompts');
        } finally {
            setPromptsLoading(false);
        }
    }

    // Ref to store the loop animation so we can stop it properly
    const nuanceSpinLoopRef = useRef<Animated.CompositeAnimation | null>(null);

    // --- Nuance Logic ---
    async function loadNuanceContent(ref: string, html: string) {
        setGeneratingNuance(true);
        setNuancePrompts([]); // Clear pills immediately so loading UI appears
        setExpandedNuanceIndex(null); // Reset expanded state

        // Start spin animation loop
        nuanceSpinAnim.setValue(0);
        nuanceSpinLoopRef.current = Animated.loop(
            Animated.timing(nuanceSpinAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: false, // Must be false for web compatibility with transforms
            })
        );
        nuanceSpinLoopRef.current.start();

        try {
            const prompts = await generateNuancePrompts(ref, html);
            setNuancePrompts(prompts);
            setGeneratingNuance(false);

            // Cache the prompts for future use
            await cacheNuance(ref, prompts);

            // Stop animation
            if (nuanceSpinLoopRef.current) {
                nuanceSpinLoopRef.current.stop();
            }
            nuanceSpinAnim.setValue(0);

            // NOTE: Removed prefetching of deep dives to save API costs
            // Deep dives are now generated on-demand when user clicks
        } catch (e) {
            console.error("Error loading nuance:", e);
            setGeneratingNuance(false);
            if (nuanceSpinLoopRef.current) {
                nuanceSpinLoopRef.current.stop();
            }
            nuanceSpinAnim.setValue(0);
        }
    }

    async function handleExpandTldr() {
        if (showExpandedTldr) {
            setShowExpandedTldr(false);
            return;
        }

        setShowExpandedTldr(true);

        // If no basic TL;DR yet, generate it on first expand
        if (!tldr && scripture?.reference && scripture?.html) {
            const cachedBasic = await getCachedTLDR(scripture.reference);
            if (cachedBasic) {
                setTldr(cachedBasic);
            } else {
                // Generate and cache basic TL;DR
                try {
                    const basic = await generateTLDR(scripture.reference, scripture.html);
                    setTldr(basic);
                    await cacheTLDR(scripture.reference, basic);
                } catch (error) {
                    console.error("Error generating TL;DR:", error);
                }
            }
        }

        // Generate expanded TL;DR if not already loaded
        if (!expandedTldr && scripture?.reference && scripture?.html) {
            // Check cache first
            const cachedExpanded = await getCachedExpandedTLDR(scripture.reference);
            if (cachedExpanded) {
                setExpandedTldr(cachedExpanded);
            } else {
                setLoadingExpandedTldr(true);
                try {
                    const expanded = await generateExpandedTLDR(scripture.reference, scripture.html);
                    setExpandedTldr(expanded);
                    await cacheExpandedTLDR(scripture.reference, expanded);
                } catch (error) {
                    console.error("Error expanding TLDR:", error);
                } finally {
                    setLoadingExpandedTldr(false);
                }
            }
        }
    }

    async function handleRegenerateNuance() {
        if (!scripture?.reference || !scripture?.html) return;
        setExpandedNuanceIndex(null);
        await loadNuanceContent(scripture.reference, scripture.html);
    }

    // --- TL;DR Action Handlers ---
    function handleTldrReflect() {
        // Open focused reflection modal
        setModalReflection('');
        setReflectionContext(tldr); // Context is TL;DR
        setShowReflectModal(true);
    }

    async function handleNuanceSelect(question: string) {
        setSelectedNuance(question);
        setNuanceDeepDive(null);
        setShowNuanceModal(true);

        // 1. Check Cache (Instant Load)
        if (nuanceCache[question]) {
            setNuanceDeepDive(nuanceCache[question]);
            setLoadingDeepDive(false);
            return;
        }

        // 2. Fetch if missing
        setLoadingDeepDive(true);
        if (scripture?.reference && scripture?.html) {
            try {
                const deepDive = await generateNuanceDeepDive(question, scripture.reference, scripture.html);
                setNuanceCache(prev => ({ ...prev, [question]: deepDive }));
                setNuanceDeepDive(deepDive);
            } catch (e) { console.error(e); }
        }
        setLoadingDeepDive(false);
    }

    function handleReflectOnNuance() {
        if (!selectedNuance || !nuanceDeepDive) return;
        setShowNuanceModal(false);
        // Pre-fill context with the deep dive
        setModalReflection('');
        setReflectionContext(nuanceDeepDive);
        setShowReflectModal(true);
    }

    async function saveModalReflection() {
        if (!modalReflection.trim() || !currentPlanId) return;

        try {
            await saveJournalEntry({
                plan_id: currentPlanId,
                day_number: currentDayIndex + 1,
                book: scripture?.reference?.split(' ')[0] || 'Unknown',
                chapter: todayReadings[0]?.chapterStart || 0,
                date: today,
                reflection: modalReflection.trim(),
            });

            // Close modal and refresh entries
            setShowReflectModal(false);
            setModalReflection('');

            // Reload entries for this day
            if (currentPlanId) {
                const entries = await getJournalEntriesForDay(currentPlanId, currentDayIndex + 1);
                setDailyEntries(entries);
            }
        } catch (error) {
            console.error('Error saving reflection:', error);
        }
    }

    async function handleTldrShare() {
        if (!tldr || !scripture?.reference) return;

        const shareText = `✨ Summary of ${scripture.reference}:\n\n"${tldr}"\n\n— via Cheshbon Reflections`;

        try {
            await Share.share({
                message: shareText,
                title: `${scripture.reference} Summary`,
            });
        } catch (error) {
            console.error('Error sharing TL;DR:', error);
        }
    }

    function handleTldrAnalyze() {
        // Save TL;DR as context point for Insights AI
        // For now, show confirmation - full implementation would save to AsyncStorage/database
        if (!tldr || !scripture?.reference) return;

        // TODO: Save to insights context storage
        // For now, show confirmation
        if (Platform.OS === 'web') {
            window.alert(`Saved to Insights! This summary of ${scripture.reference} will be available for your next Soul Analysis session.`);
        } else {
            Alert.alert(
                'Saved to Insights ✨',
                `This summary of ${scripture.reference} will be available for your next Soul Analysis session.`,
                [{ text: 'Got it!', style: 'default' }]
            );
        }
    }

    // --- Version Management Functions ---
    useEffect(() => {
        loadVersions();
    }, []);

    const loadVersions = async () => {
        // Load selected version from storage
        const selected = await BibleVersionsService.getSelectedVersion();
        setCurrentVersion(selected);
    };

    const handleVersionSelect = async (version: BibleVersion) => {
        await BibleVersionsService.setSelectedVersion(version);
        setShowVersionsModal(false);
        setCurrentVersion(version);
        // Reload scripture with the new version if we have content
        if (todayReadings.length > 0 && currentPlanId && planType) {
            loadDayContent(currentDayIndex, currentPlanId, planType, totalDuration, false);
        }
    };

    const searchVersions = async (query: string) => {
        setVersionSearchQuery(query);
        if (query.length > 0) {
            setLoadingVersions(true);
            const results = await BibleVersionsService.searchAllVersions(query);
            setAllVersions(results);
            setLoadingVersions(false);
        } else {
            setAllVersions([]);
        }
    };

    // --- Font Settings State ---
    const { colors, isDarkMode } = useTheme();
    const [showFontSettings, setShowFontSettings] = useState(false);
    const [fontSize, setFontSize] = useState<'small' | 'large'>('large');
    const [lineSpacing, setLineSpacing] = useState<0 | 1 | 2>(1); // 0=tight, 1=normal, 2=loose

    // Line spacing options
    const LINE_SPACING_VALUES = [24, 29, 36]; // tight, normal, loose
    const LINE_SPACING_ICONS = ['☰', '≡', '⫾']; // Different icons for each level
    const FONT_SIZES = { small: 16, large: 20 };

    // --- Highlighting State (selectedVerses and highlights moved before renderers) ---
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        initialSetup();
    }, [planId]);

    // Update selection mode based on selection
    useEffect(() => {
        setIsSelectionMode(selectedVerses.size > 0);
    }, [selectedVerses]);

    async function initialSetup() {
        try {
            const plan = planId ? await getPlanById(planId) : await getCurrentPlan();
            if (!plan) { router.replace('/setup'); return; }

            setCurrentPlanId(plan.id!);
            setPlanType(plan.type as PlanType);
            setTotalDuration(plan.duration);
            setPlanCurrentDay(plan.current_day); // Store the plan's current day


            // Fetch completed days for Journey Map
            const completed = await getPlanCompletionStatus(plan.id!);
            setCompletedDays(completed);

            // Use day from URL if provided, otherwise calculate from date
            let dayIndex: number;
            if (dayParam && dayParam >= 1 && dayParam <= plan.duration) {
                // URL param is 1-indexed (Day 1, Day 2, etc.), convert to 0-indexed
                dayIndex = dayParam - 1;
            } else {
                const startDate = new Date(plan.start_date);
                const todayDate = new Date();
                const daysDiff = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                dayIndex = Math.max(0, Math.min(daysDiff, plan.duration - 1));
            }

            // Load initial day
            // Do NOT force switch to daily view here, respect initial state from params
            await loadDayContent(dayIndex, plan.id!, plan.type as PlanType, plan.duration, false);
        } catch (error) {
            console.error('Error in initial setup:', error);
            setLoading(false);
        }
    }

    async function loadDayContent(dayIndex: number, planId: string, type: PlanType, duration: number, switchToDaily = true) {
        setLoading(true);
        setCurrentDayIndex(dayIndex);
        setTldr('');
        setExpandedTldr(null);
        setShowExpandedTldr(false);
        setNuancePrompts([]);
        setExpandedNuanceIndex(null);
        setNuanceDeepDive(null);

        // Clear verse positions for new content
        versePositions.current = {};
        lastSeenChapter.current = 1;
        htmlContainerY.current = 0;
        setReflectionContext('');
        setPrompts([]);
        setSelectedVerses(new Set());
        setHighlights([]);
        setReflection('');
        setScripture(null);

        // If coming from Journey Map, switch back (only if requested)
        if (switchToDaily) {
            setViewMode('daily');
        }

        try {
            // Revert to generating full plan as helper might not exist
            const fullPlan = generateReadingPlan(type as PlanType, duration);
            const readings = fullPlan.dailyReadings[dayIndex] || [];

            setTodayReadings(readings);

            if (readings.length > 0) {
                const firstReading = readings[0];

                // Fetch scripture with the selected version (or default to ESV)
                // For ESV or default, use fetchScripture which supports chapter ranges
                // For other versions, use fetchScriptureWithVersion (single chapter only for now)
                let passage;
                if (!currentVersion || currentVersion.abbreviation === 'ESV') {
                    passage = await fetchScripture(firstReading.book, firstReading.chapterStart, firstReading.chapterEnd);
                } else {
                    // For non-ESV versions, fetch each chapter and combine (if range) or just fetch single chapter
                    if (firstReading.chapterEnd && firstReading.chapterEnd > firstReading.chapterStart) {
                        // Range: fetch each chapter and combine HTML
                        const passages = await Promise.all(
                            Array.from({ length: firstReading.chapterEnd - firstReading.chapterStart + 1 }, (_, i) =>
                                fetchScriptureWithVersion(firstReading.book, firstReading.chapterStart + i, currentVersion)
                            )
                        );
                        const combinedHtml = passages.map(p => p.html).join('\n');
                        const reference = `${firstReading.book} ${firstReading.chapterStart}-${firstReading.chapterEnd}`;
                        passage = { reference, html: combinedHtml, isCached: false, versionId: currentVersion.abbreviation };
                    } else {
                        passage = await fetchScriptureWithVersion(firstReading.book, firstReading.chapterStart, currentVersion);
                    }
                }
                setScripture(passage);

                // Load saved highlights for this book/chapter
                const savedHighlights = await getVerseHighlights(firstReading.book, firstReading.chapterStart);
                setHighlights(savedHighlights);

                // Fetch all journal entries for this day
                const entries = await getJournalEntriesForDay(planId, dayIndex + 1);
                setDailyEntries(entries);

                setReflection('');

                // Load cached AI content only - don't auto-generate to save API costs
                const cachedTldr = await getCachedTLDR(passage.reference);
                if (cachedTldr) {
                    setTldr(cachedTldr);
                }
                const cachedNuance = await getCachedNuance(passage.reference);
                if (cachedNuance) {
                    setNuancePrompts(cachedNuance);
                }
                // Reflection prompts are not auto-generated anymore
                // User can click "Regenerate" to generate them


                // Save progress silently without blocking
                saveDailyProgress({
                    plan_id: planId,
                    date: today,
                    book: firstReading.book,
                    chapter_start: firstReading.chapterStart,
                    chapter_end: firstReading.chapterEnd,
                    completed: false, // Will be set to true on "Complete" button
                }).catch(console.error);
            }
        } catch (error) {
            console.error('Error loading day content:', error);
        } finally {
            setLoading(false);
            if (viewMode === 'daily') scrollToTop();
        }
    }

    // --- Navigation Handlers ---
    function handlePreviousDay() {
        if (currentDayIndex > 0 && currentPlanId && planType) {
            loadDayContent(currentDayIndex - 1, currentPlanId, planType, totalDuration);
        }
    }

    function handleNextDay() {
        if (currentDayIndex < totalDuration - 1 && currentPlanId && planType) {
            loadDayContent(currentDayIndex + 1, currentPlanId, planType, totalDuration);
        }
    }

    async function handleSaveReflection() {
        if (!reflection.trim() || !scripture) return;

        setShowSaved(false); // Reset animation if any
        try {
            const entry: JournalEntry = {
                plan_id: currentPlanId!,
                day_number: currentDayIndex + 1,
                date: today,
                book: todayReadings[0].book,
                chapter: todayReadings[0].chapterStart,
                reflection: reflection.trim(),
            };

            await saveJournalEntry(entry);

            // Add new entry to the top of the list (optimistic update or verify with returned ID)
            // Ideally saveJournalEntry returns the ID or full object. 
            // For now, let's just re-fetch or construct it.
            // Let's assume successful and add properly.
            // We need a full object including created_at if we want to sort, but let's just prepend.
            const newEntry = { ...entry, id: Date.now().toString(), created_at: new Date().toISOString() };
            setDailyEntries([newEntry, ...dailyEntries]);
            setReflection(''); // Clear input

            // Update completion status
            const newCompleted = new Set(completedDays);
            newCompleted.add(currentDayIndex + 1);
            setCompletedDays(newCompleted);

            setShowSaved(true);

            // Publish to community if toggle is on
            if (sharePublicly) {
                try {
                    await publishReflection(
                        scripture.reference,
                        '', // No specific verse text for chapter reflections
                        reflection.trim()
                    );
                } catch (pubError) {
                    console.warn('Failed to publish to community:', pubError);
                }
            }
            setSharePublicly(false);
            setTimeout(() => setShowSaved(false), 3000);

            // Auto-expand timeline
            setShowReflectionsTimeline(true);

            // Advance Plan Progress
            try {
                const plan = await getPlanById(currentPlanId!);
                // Only advance if we are completing the "current" day of the plan
                if (plan && plan.current_day <= currentDayIndex + 1) {
                    const nextDay = Math.min(currentDayIndex + 2, totalDuration);
                    if (nextDay > plan.current_day) {
                        await updatePlanProgress(currentPlanId!, nextDay);
                    }
                }
            } catch (err) {
                console.warn("Failed to advance plan progress", err);
            }

        } catch (error) {
            console.error('Error saving reflection:', error);
            alert('Failed to save reflection.');
        }
    }

    async function handleComplete() {
        try {
            // Save as completed
            await saveDailyProgress({
                plan_id: currentPlanId!,
                date: today,
                book: todayReadings[0].book,
                chapter_start: todayReadings[0].chapterStart,
                chapter_end: todayReadings[0].chapterEnd,
                completed: true,
            });

            // ALSO save an empty journal entry to mark it as "done" for the Journey Map if no reflection
            // This is a workaround since getPlanCompletionStatus currently checks journal_entries
            // Ideally we'd check both, but this ensures consistency without schema changes right now.
            if (!reflection.trim()) {
                await saveJournalEntry({
                    plan_id: currentPlanId!,
                    day_number: currentDayIndex + 1,
                    date: today,
                    book: todayReadings[0].book,
                    chapter: todayReadings[0].chapterStart,
                    reflection: 'Completed Reading', // Placeholder text
                });
            }

            // Update local state immediately
            const newCompleted = new Set(completedDays);
            newCompleted.add(currentDayIndex + 1);
            setCompletedDays(newCompleted);

            // Advance Plan Progress
            try {
                const plan = await getPlanById(currentPlanId!);
                if (plan && plan.current_day <= currentDayIndex + 1) {
                    const nextDay = Math.min(currentDayIndex + 2, totalDuration);
                    if (nextDay > plan.current_day) {
                        await updatePlanProgress(currentPlanId!, nextDay);
                    }
                }
            } catch (err) {
                console.warn("Failed to advance plan progress", err);
            }

            alert('🎉 Day Complete! Well done on your spiritual journey!');
            setTimeout(() => {
                router.back(); // Go back to profile or home
            }, 1000);
        } catch (error) {
            console.error('Error completing day:', error);
            alert('Error updating progress.');
        }
    }

    // --- Highlight Handlers (toggleVerseSelection is above, before renderers) ---

    async function applyHighlight(colorHex: string) {
        if (!todayReadings[0]) return;
        const { book, chapterStart } = todayReadings[0];

        // Immediately update local state for instant UI feedback
        const newHighlights = [...highlights];
        Array.from(selectedVerses).forEach(verseNum => {
            const existingIndex = newHighlights.findIndex(h => h.verse === verseNum);
            if (existingIndex >= 0) {
                newHighlights[existingIndex] = { ...newHighlights[existingIndex], color: colorHex };
            } else {
                newHighlights.push({ book, chapter: chapterStart, verse: verseNum, color: colorHex });
            }
        });
        setHighlights(newHighlights);
        setSelectedVerses(new Set()); // Dismiss the panel after applying highlight

        // Save to database in background (don't await)
        try {
            const promises = Array.from(selectedVerses).map(verseNum => {
                return saveVerseHighlight({
                    book,
                    chapter: chapterStart,
                    verse: verseNum,
                    color: colorHex
                });
            });
            Promise.all(promises).catch(e => {
                console.error("Failed to save highlights to DB", e);
            });
        } catch (e) {
            console.error("Failed to save highlights", e);
        }
    }

    async function removeHighlight() {
        if (!todayReadings[0]) return;
        const { book, chapterStart } = todayReadings[0];

        // Immediately update local state for instant UI feedback
        const versesToRemove = new Set(selectedVerses);
        const newHighlights = highlights.filter(h => !versesToRemove.has(h.verse));
        setHighlights(newHighlights);
        setSelectedVerses(new Set()); // Clear selection immediately

        // Delete from database in background (don't await)
        try {
            const promises = Array.from(versesToRemove).map(verseNum => {
                return deleteVerseHighlight(book, chapterStart, verseNum);
            });
            Promise.all(promises).catch(e => {
                console.error("Failed to remove highlights from DB", e);
            });
        } catch (e) {
            console.error("Failed to remove highlights", e);
        }
    }

    function handleShareSelection() {
        alert(`Coming Soon: Sharing verses ${Array.from(selectedVerses).join(', ')}`);
    }

    function handleReflectSelection() {
        if (selectedVerses.size === 0) return;

        const firstVerseNum = Array.from(selectedVerses).sort((a, b) => a - b)[0];

        // Extract actual verse text from scripture HTML
        let verseText = `Verse ${firstVerseNum}`; // fallback
        if (scripture?.html) {
            try {
                const html = scripture.html;

                // Pattern to find verse number N
                const verseStartPattern = new RegExp(
                    `<b[^>]*class="[^"]*(?:verse-num|chapter-num)[^"]*"[^>]*>(?:\\d+:)?${firstVerseNum}[^<]*</b>`,
                    'i'
                );
                const startMatch = verseStartPattern.exec(html);

                if (startMatch) {
                    const startIndex = startMatch.index + startMatch[0].length;

                    // Find the next verse number marker
                    const nextVersePattern = /<b[^>]*class="[^"]*(?:verse-num|chapter-num)[^"]*"[^>]*>(?:\d+:)?\d+[^<]*<\/b>/i;
                    const remainingHtml = html.slice(startIndex);
                    const endMatch = nextVersePattern.exec(remainingHtml);

                    const verseHtml = endMatch
                        ? remainingHtml.slice(0, endMatch.index)
                        : remainingHtml.slice(0, 500);

                    // Strip HTML tags to get plain text
                    verseText = verseHtml
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();

                    if (verseText.length > 300) {
                        verseText = verseText.slice(0, 297) + '...';
                    }
                }
            } catch (e) {
                console.error('Error extracting verse text:', e);
            }
        }

        // Set context and open modal
        const reading = todayReadings[0];
        const contextText = `${reading?.book || ''} ${reading?.chapterStart || ''}:${firstVerseNum}\n\n"${verseText}"`;
        setReflectionContext(contextText);
        setModalReflection('');
        setShowReflectModal(true);
        setSelectedVerses(new Set()); // Clear selection
    }

    // --- Actions ---
    function handleSearchPress() {
        alert('Universal Search Coming Soon');
    }

    // --- Audio Player Functions ---

    function toggleAudioPlayer() {
        const toValue = showAudioPlayer ? 0 : 1;
        setShowAudioPlayer(!showAudioPlayer);
        Animated.spring(audioPlayerAnim, {
            toValue,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
        }).start();

        // Stop and unload audio when closing
        if (showAudioPlayer && soundRef.current) {
            soundRef.current.stopAsync();
            soundRef.current.unloadAsync();
            soundRef.current = null;
            setIsPlaying(false);
            setAudioPosition(0);
            setAudioDuration(0);
        }
    }

    // Get current book and chapter from todayReadings
    function getCurrentBookChapter(): { book: string; chapter: number } {
        const reading = todayReadings[0];
        if (!reading) return { book: 'Matthew', chapter: 1 };

        // Use currentAudioChapter (starts at chapterStart of the reading)
        const startChapter = reading.chapterStart || 1;
        const chapter = currentAudioChapter || startChapter;
        return { book: reading.book, chapter };
    }

    // Get chapter range from current reading
    function getChapterRange(): { start: number; end: number } {
        const reading = todayReadings[0];
        if (!reading) return { start: 1, end: 1 };
        return { start: reading.chapterStart || 1, end: reading.chapterEnd || reading.chapterStart || 1 };
    }

    // Navigate to previous chapter
    async function goToPreviousChapter() {
        const { start } = getChapterRange();
        if (currentAudioChapter > start) {
            const newChapter = currentAudioChapter - 1;
            setCurrentAudioChapter(newChapter);
            // Reload audio with new chapter
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }
            setAudioPosition(0);
            setAudioDuration(0);
            // Auto-play the new chapter
            setTimeout(() => loadAndPlayAudio(), 100);
        }
    }

    // Navigate to next chapter
    async function goToNextChapter() {
        const { end } = getChapterRange();
        if (currentAudioChapter < end) {
            const newChapter = currentAudioChapter + 1;
            setCurrentAudioChapter(newChapter);
            // Reload audio with new chapter
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }
            setAudioPosition(0);
            setAudioDuration(0);
            // Auto-play the new chapter
            setTimeout(() => loadAndPlayAudio(), 100);
        }
    }

    async function loadAndPlayAudio() {
        try {
            setAudioLoading(true);
            const { book, chapter } = getCurrentBookChapter();

            // Unload existing sound if any
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }

            // Configure audio mode
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
            });

            // Get the audio URL
            const audioUrl = getAudioUrl(book, chapter);
            const apiKey = getEsvApiKey();

            console.log('[Audio] Loading:', audioUrl);

            // Create and load sound with auth header
            const { sound } = await Audio.Sound.createAsync(
                { uri: audioUrl, headers: { 'Authorization': `Token ${apiKey}` } },
                { shouldPlay: true, rate: playbackSpeed },
                onPlaybackStatusUpdate
            );

            soundRef.current = sound;
            setIsPlaying(true);
            setAudioLoading(false);

        } catch (error) {
            console.error('[Audio] Error loading audio:', error);
            setAudioLoading(false);
            alert('Unable to load audio. Please try again.');
        }
    }

    function onPlaybackStatusUpdate(status: any) {
        if (status.isLoaded) {
            setAudioPosition(status.positionMillis || 0);
            setAudioDuration(status.durationMillis || 0);
            setIsPlaying(status.isPlaying);

            // Auto-stop at end
            if (status.didJustFinish) {
                setIsPlaying(false);
                setAudioPosition(0);
            }
        }
    }

    async function togglePlayPause() {
        try {
            if (!soundRef.current) {
                // First time - load and play
                await loadAndPlayAudio();
            } else {
                const status = await soundRef.current.getStatusAsync();
                if (status.isLoaded) {
                    if (status.isPlaying) {
                        await soundRef.current.pauseAsync();
                    } else {
                        await soundRef.current.playAsync();
                    }
                } else {
                    // Sound exists but not loaded - reload it
                    await loadAndPlayAudio();
                }
            }
        } catch (error) {
            console.warn('[Audio] togglePlayPause error:', error);
            // Reset and try to reload
            soundRef.current = null;
            setIsPlaying(false);
        }
    }

    async function seekAudio(seconds: number) {
        if (soundRef.current) {
            const newPosition = Math.max(0, audioPosition + (seconds * 1000));
            await soundRef.current.setPositionAsync(newPosition);
        }
    }

    function cyclePlaybackSpeed() {
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const currentIndex = speeds.indexOf(playbackSpeed);
        const nextIndex = (currentIndex + 1) % speeds.length;
        const newSpeed = speeds[nextIndex];
        setPlaybackSpeed(newSpeed);

        // Apply to current sound if playing
        if (soundRef.current) {
            soundRef.current.setRateAsync(newSpeed, true);
        }
    }

    // Helper to format time
    function formatTime(ms: number): string {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // Cleanup audio when day changes
    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, [currentDayIndex]);

    function handleVolumePress() {
        toggleAudioPlayer();
    }

    // --- Render Helpers ---

    // Generate Full Plan Data for Journey Map
    // This is cheap to regenerate since it's just metadata
    const journeyData = planType ? generateReadingPlan(planType, totalDuration).dailyReadings.slice(0, totalDuration).map((readings, index) => ({
        dayNumber: index + 1,
        readings,
        isCompleted: completedDays.has(index + 1),
        isCurrent: index === currentDayIndex
    })) : [];

    const renderJourneyItem = ({ item }: { item: typeof journeyData[0] }) => {
        const reference = item.readings.length > 0
            ? `${item.readings[0].book} ${item.readings[0].chapterStart}${item.readings[0].chapterEnd !== item.readings[0].chapterStart ? '-' + item.readings[0].chapterEnd : ''}`
            : 'Rest Day';

        const isCompleted = completedDays.has(item.dayNumber);

        return (
            <TouchableOpacity
                style={[styles.journeyRow, item.isCurrent && styles.journeyRowCurrent]}
                onPress={() => {
                    loadDayContent(item.dayNumber - 1, currentPlanId!, planType!, totalDuration);
                    setViewMode('daily'); // Switch back to daily view on tap
                }}
            >
                <View style={styles.journeyRowContent}>
                    <View>
                        <Text style={[styles.journeyDayText, item.isCurrent && { color: Colors.gold, fontWeight: 'bold' }]}
                        >
                            Day {item.dayNumber}
                        </Text>
                        {/* Gold Dot if Completed/Reflected */}
                        {isCompleted && (
                            <View style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: Colors.gold,
                                marginTop: 4,
                                alignSelf: 'center'
                            }} />
                        )}
                    </View>
                    <Text style={styles.journeyRefText}>{reference}</Text>
                </View>
                {/* We removed the Checkmark on the right to focus on the dot? 
                    User requested: "add a Small Gold Dot... If the user taps...".
                    Actually user didn't say remove checkmark, but let's keep checkmark for "Done" and Dot for Reflection?
                    Wait, "completion" is now defined by "having reflected".
                    So Dot = Checkmark essentially.
                    Let's Keep the Checkmark on the right as a "Success" indicator AND the dot?
                    User said: "add a Small Gold Dot...". 
                    Let's just add the dot. It looks nice. 
                */}
                {isCompleted && (
                    <Text style={styles.journeyCheckIcon}>✓</Text>
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.gold} />
                <Typography variant="body" style={{ marginTop: Spacing.md }}>Loading...</Typography>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* New Enhanced Header with Journey Toggle */}
            <View style={styles.header}>
                <View style={styles.headerToolbar}>
                    {/* Left: Mode Toggle Pills */}
                    <View style={styles.headerPills}>
                        <TouchableOpacity
                            style={[
                                styles.headerPill,
                                { backgroundColor: viewMode === 'daily' ? Colors.gold : 'rgba(0,0,0,0.05)' }
                            ]}
                            onPress={() => {
                                // When switching to daily view, load the plan's current day
                                if (viewMode !== 'daily' && currentPlanId && planType) {
                                    const targetDayIndex = planCurrentDay - 1; // Convert 1-indexed to 0-indexed
                                    loadDayContent(targetDayIndex, currentPlanId, planType, totalDuration, true);
                                } else {
                                    setViewMode('daily');
                                }
                            }}
                        >
                            <Text style={[
                                styles.headerPillText,
                                { color: viewMode === 'daily' ? Colors.white : Colors.charcoal }
                            ]}>
                                NEXT READ
                            </Text>
                        </TouchableOpacity>

                        {/* Translation Pill */}
                        <Text style={{ color: Colors.mediumGray, marginHorizontal: 4 }}>|</Text>
                        <TouchableOpacity
                            style={[styles.headerPill, { backgroundColor: '#E8E4DF', paddingHorizontal: 10 }]}
                            onPress={() => setShowVersionsModal(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.headerPillText, { color: Colors.charcoal }]}>{currentVersion?.abbreviation || 'ESV'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.headerPill,
                                { backgroundColor: viewMode === 'journey' ? Colors.gold : 'rgba(0,0,0,0.05)' }
                            ]}
                            onPress={() => {
                                setViewMode('journey');
                                // Scroll to current day when opening map
                                setTimeout(() => {
                                    journeyListRef.current?.scrollToIndex({ index: currentDayIndex, animated: true, viewPosition: 0.5 });
                                }, 100);
                            }}
                        >
                            <Text style={[
                                styles.headerPillText,
                                { color: viewMode === 'journey' ? Colors.white : Colors.charcoal }
                            ]}>
                                JOURNEY MAP
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Right: Actions */}
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.headerIconButton} onPress={handleVolumePress}>
                            <Text style={styles.headerIcon}>🔊</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerIconButton} onPress={() => setShowFontSettings(true)}>
                            <Text style={styles.headerIcon}>Aa</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Secondary Row: Navigation Arrows & Title (Only in Daily Mode) */}
                {viewMode === 'daily' && (
                    <View style={styles.subHeaderRow}>
                        <TouchableOpacity
                            style={[styles.navArrow, currentDayIndex === 0 && styles.navButtonDisabled]}
                            onPress={handlePreviousDay}
                            disabled={currentDayIndex === 0}
                        >
                            <Text style={{ fontSize: 32, fontWeight: 'bold', color: currentDayIndex === 0 ? Colors.lightGray : Colors.gold }}>‹</Text>
                        </TouchableOpacity>

                        <View style={styles.headerTitleContainer}>
                            <Typography variant="caption" color={Colors.gold} style={{ fontWeight: 'bold' }}>DAY {currentDayIndex + 1}</Typography>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Typography variant="h2" style={styles.reference}>{scripture?.reference}</Typography>
                                {scripture?.isCached && <Typography variant="body" style={{ marginLeft: 8, color: Colors.mediumGray, fontSize: 18 }}>☁️</Typography>}
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.navArrow, currentDayIndex >= totalDuration - 1 && styles.navButtonDisabled]}
                            onPress={handleNextDay}
                            disabled={currentDayIndex >= totalDuration - 1}
                        >
                            <Text style={{ fontSize: 32, fontWeight: 'bold', color: currentDayIndex >= totalDuration - 1 ? Colors.lightGray : Colors.gold }}>›</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Content Swapper */}
            {viewMode === 'daily' ? (
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.content}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                >

                    {/* TLDR - Collapsible Section */}
                    <Card style={styles.tldrCard}>
                        <TouchableOpacity
                            onPress={() => setIsTldrCollapsed(!isTldrCollapsed)}
                            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <Typography variant="caption" color={Colors.gold} style={styles.tldrLabel}>📖 TL;DR</Typography>
                            <Typography variant="caption" color={Colors.gold} style={{ fontWeight: 'bold' }}>
                                {isTldrCollapsed ? '▾' : '▴'}
                            </Typography>
                        </TouchableOpacity>

                        {/* Content - only shown when expanded */}
                        {!isTldrCollapsed && (
                            <>
                                <View style={{ marginTop: Spacing.xs }}>
                                    {loadingTldr ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <ActivityIndicator size="small" color={Colors.gold} />
                                            <Typography variant="body" color={Colors.mediumGray} style={{ fontStyle: 'italic' }}>
                                                Generating summary...
                                            </Typography>
                                        </View>
                                    ) : (
                                        renderInteractiveText(showExpandedTldr ? (expandedTldr || 'Expanding summary...') : tldr || 'No summary available')
                                    )}
                                </View>
                                {tldr && !loadingExpandedTldr && (
                                    <TouchableOpacity onPress={handleExpandTldr} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                                        <Typography variant="caption" color={Colors.gold} style={{ fontWeight: 'bold' }}>
                                            {showExpandedTldr ? 'Show Less' : 'Expand Summary ▾'}
                                        </Typography>
                                    </TouchableOpacity>
                                )}
                                {loadingExpandedTldr && (
                                    <ActivityIndicator size="small" color={Colors.gold} style={{ alignSelf: 'flex-end', marginTop: 8 }} />
                                )}

                                {/* Reflect Button - placed after summary, before contemplation points */}
                                {tldr && (
                                    <TouchableOpacity
                                        onPress={handleTldrReflect}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            alignSelf: 'flex-end',
                                            backgroundColor: Colors.gold,
                                            paddingVertical: 6,
                                            paddingHorizontal: 12,
                                            borderRadius: 16,
                                            marginTop: 12
                                        }}
                                    >
                                        <Text style={{ fontSize: 14, marginRight: 6 }}>✍️</Text>
                                        <Typography variant="caption" color={Colors.white} style={{ fontWeight: 'bold', fontSize: 12 }}>
                                            Reflect
                                        </Typography>
                                    </TouchableOpacity>
                                )}

                                {/* Points of Contemplation (Nuance Pills) */}
                                {(nuancePrompts.length > 0 || generatingNuance) && (
                                    <View style={{ marginTop: 16, marginBottom: 8 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <Typography variant="caption" color={Colors.mediumGray} style={{ fontFamily: FontFamilies.serif, fontSize: 13, fontStyle: 'italic' }}>
                                                Points of Contemplation
                                            </Typography>
                                            <TouchableOpacity onPress={handleRegenerateNuance} disabled={generatingNuance}>
                                                <Animated.View style={{
                                                    transform: [{
                                                        rotate: nuanceSpinAnim.interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: ['0deg', '360deg']
                                                        })
                                                    }]
                                                }}>
                                                    <Typography variant="caption" color={Colors.gold} style={{ fontWeight: 'bold', fontSize: 16 }}>
                                                        ↻
                                                    </Typography>
                                                </Animated.View>
                                            </TouchableOpacity>
                                        </View>

                                        {nuancePrompts.length > 0 ? (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
                                                {nuancePrompts.map((point, idx) => {
                                                    const isExpanded = expandedNuanceIndex === idx;
                                                    return (
                                                        <TouchableOpacity
                                                            key={idx}
                                                            onPress={() => setExpandedNuanceIndex(isExpanded ? null : idx)}
                                                            activeOpacity={0.8}
                                                            style={{
                                                                backgroundColor: isExpanded ? Colors.gold : 'rgba(212, 163, 115, 0.1)',
                                                                borderColor: isExpanded ? Colors.gold : 'rgba(212, 163, 115, 0.5)',
                                                                borderWidth: 1,
                                                                borderRadius: isExpanded ? 16 : 20,
                                                                paddingHorizontal: 16,
                                                                paddingVertical: isExpanded ? 12 : 8,
                                                                maxWidth: isExpanded ? 300 : 200,
                                                                minWidth: isExpanded ? 220 : undefined,
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            <View>
                                                                {/* Title - always shown */}
                                                                <Typography
                                                                    variant="caption"
                                                                    color={isExpanded ? Colors.white : Colors.charcoal}
                                                                    style={{ fontFamily: FontFamilies.serif, fontSize: 13, fontWeight: isExpanded ? 'bold' : 'normal' }}
                                                                    numberOfLines={isExpanded ? undefined : 1}
                                                                    ellipsizeMode="tail"
                                                                >
                                                                    {point.title}
                                                                </Typography>

                                                                {/* Description - only when expanded */}
                                                                {isExpanded && (
                                                                    <Typography
                                                                        variant="caption"
                                                                        color={Colors.white}
                                                                        style={{ fontFamily: FontFamilies.serif, fontSize: 12, marginTop: 6, opacity: 0.9, lineHeight: 18 }}
                                                                    >
                                                                        {point.description}
                                                                    </Typography>
                                                                )}

                                                                {/* Action buttons when expanded */}
                                                                {isExpanded && (
                                                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                                                                        {/* Reflect on this point */}
                                                                        <TouchableOpacity
                                                                            onPress={(e) => {
                                                                                e.stopPropagation();
                                                                                // Navigate to journal with this contemplation point as the starting prompt
                                                                                router.push({
                                                                                    pathname: '/journal',
                                                                                    params: {
                                                                                        reference: scripture?.reference || '',
                                                                                        prompt: `Contemplation: ${point.title}\n\n${point.description}`,
                                                                                        planId: currentPlanId || ''
                                                                                    }
                                                                                });
                                                                            }}
                                                                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 }}
                                                                        >
                                                                            <Text style={{ fontSize: 12, marginRight: 4 }}>✍️</Text>
                                                                            <Typography variant="caption" color={Colors.white} style={{ fontWeight: 'bold', fontSize: 11 }}>
                                                                                Reflect
                                                                            </Typography>
                                                                        </TouchableOpacity>

                                                                        {/* Deep Dive */}
                                                                        <TouchableOpacity
                                                                            onPress={(e) => {
                                                                                e.stopPropagation();
                                                                                handleNuanceSelect(point.title);
                                                                            }}
                                                                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 }}
                                                                        >
                                                                            <Text style={{ fontSize: 12, marginRight: 4 }}>✨</Text>
                                                                            <Typography variant="caption" color={Colors.white} style={{ fontWeight: 'bold', fontSize: 11 }}>
                                                                                Deep Dive
                                                                            </Typography>
                                                                        </TouchableOpacity>
                                                                    </View>
                                                                )}
                                                            </View>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </ScrollView>
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 4, paddingVertical: 8 }}>
                                                <ActivityIndicator size="small" color={Colors.gold} style={{ marginRight: 8 }} />
                                                <Typography variant="caption" color={Colors.mediumGray} style={{ fontStyle: 'italic' }}>
                                                    Consulting ancient wisdom...
                                                </Typography>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </>
                        )}
                    </Card>

                    {/* Interactive Scripture - Open Style (No Card) */}
                    <View
                        style={styles.scriptureContainer}
                        onLayout={(e) => {
                            // Measure position of scripture container relative to ScrollView content
                            // Add Spacing.xl (marginTop of inner View) + 16 (marginBottom of h2) to get RenderHTML position
                            htmlContainerY.current = e.nativeEvent.layout.y + Spacing.xl + 16;
                            console.log(`[Layout] Scripture container Y: ${e.nativeEvent.layout.y}, htmlContainerY set to: ${htmlContainerY.current}`);
                        }}
                    >
                        {scripture?.html ? (
                            <View style={{ marginTop: Spacing.md }}>
                                {/* Chapter Quick-Jump Bar */}
                                {todayReadings[0] && todayReadings[0].chapterEnd > todayReadings[0].chapterStart && (
                                    <View style={{ marginBottom: Spacing.md }}>
                                        <Typography variant="caption" color={Colors.mediumGray} style={{ marginBottom: 8, textAlign: 'center' }}>
                                            Jump to Chapter
                                        </Typography>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            contentContainerStyle={{
                                                flexDirection: 'row',
                                                justifyContent: 'center',
                                                flexGrow: 1,
                                                gap: 8
                                            }}
                                        >
                                            {Array.from(
                                                { length: (todayReadings[0].chapterEnd || 1) - (todayReadings[0].chapterStart || 1) + 1 },
                                                (_, i) => (todayReadings[0].chapterStart || 1) + i
                                            ).map((chapterNum) => {
                                                const isLast = chapterNum === todayReadings[0].chapterEnd;
                                                const startChapter = todayReadings[0].chapterStart || 1;
                                                const endChapter = todayReadings[0].chapterEnd || 1;

                                                return (
                                                    <TouchableOpacity
                                                        key={chapterNum}
                                                        onPress={() => {
                                                            // Try to use chapter ref for on-demand measurement
                                                            const chapterRef = chapterRefs.current[chapterNum];

                                                            if (chapterRef && scrollViewRef.current) {
                                                                // Measure the chapter View relative to the ScrollView
                                                                (chapterRef as any).measureLayout(
                                                                    scrollViewRef.current,
                                                                    (x: number, y: number) => {
                                                                        console.log(`[ChapterJump] Chapter ${chapterNum} measured at y=${y}`);
                                                                        scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
                                                                    },
                                                                    (error: any) => {
                                                                        console.log(`[ChapterJump] measureLayout failed, using fallback`);
                                                                        // Fallback to scrollToRef
                                                                        scrollToRef(`[${chapterNum}:1]`);
                                                                    }
                                                                );
                                                            } else if (chapterNum === startChapter && scrollViewRef.current) {
                                                                // First chapter - scroll to top of scripture
                                                                console.log(`[ChapterJump] First chapter, scrolling to top`);
                                                                scrollViewRef.current.scrollTo({ y: Math.max(0, htmlContainerY.current - 80), animated: true });
                                                            } else if (chapterNum === endChapter && scrollViewRef.current) {
                                                                // Last chapter - scroll to end
                                                                console.log(`[ChapterJump] Last chapter, scrolling to end`);
                                                                (scrollViewRef.current as any).scrollToEnd({ animated: true });
                                                            } else {
                                                                console.log(`[ChapterJump] No ref found for chapter ${chapterNum}, using scrollToRef`);
                                                                scrollToRef(`[${chapterNum}:1]`);
                                                            }
                                                        }}
                                                        style={{
                                                            backgroundColor: Colors.gold,
                                                            paddingVertical: 8,
                                                            paddingHorizontal: 14,
                                                            borderRadius: 16,
                                                            minWidth: 40,
                                                            alignItems: 'center',
                                                        }}
                                                    >
                                                        <Text style={{
                                                            color: Colors.white,
                                                            fontWeight: 'bold',
                                                            fontSize: 14
                                                        }}>
                                                            {chapterNum}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                )}

                                <RenderHTML
                                    key={`scripture-${fontSize}-${lineSpacing}`}
                                    contentWidth={350}
                                    source={{ html: processScriptureHtml(scripture.html) }}
                                    classesStyles={scriptureClassesStyles}
                                    tagsStyles={scriptureTagStyles as any}
                                    renderers={renderers}
                                    baseStyle={{
                                        fontFamily: FontFamilies.serif,
                                        fontSize: FONT_SIZES[fontSize],
                                        lineHeight: LINE_SPACING_VALUES[lineSpacing],
                                        color: Colors.charcoal,
                                    }}
                                />
                            </View>
                        ) : (
                            <Typography variant="body" color={Colors.mediumGray} style={{ textAlign: 'center', marginTop: Spacing.xl }}>Scripture unavailable</Typography>
                        )}
                    </View>

                    {/* Prompts */}
                    <View style={styles.promptsSection}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
                            <Typography variant="h3">Reflection Prompts</Typography>
                            {/* Only show refresh button if prompts already exist */}
                            {prompts.length > 0 && !promptsLoading && (
                                <TouchableOpacity onPress={handleRegeneratePrompts} style={{ padding: 4 }}>
                                    <Typography variant="caption" color={Colors.gold} style={{ fontWeight: 'bold' }}>
                                        ↻ REFRESH
                                    </Typography>
                                </TouchableOpacity>
                            )}
                        </View>

                        {promptsLoading ? (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color={Colors.gold} style={{ marginBottom: 8 }} />
                                <Typography variant="body" color={colors.textSecondary} style={{ fontStyle: 'italic' }}>
                                    Thinking of new questions...
                                </Typography>
                            </View>
                        ) : prompts.length > 0 ? (
                            prompts.map((p, i) => {
                                const isExpanded = expandedPrompts.has(i);
                                return (
                                    <TouchableOpacity
                                        key={i}
                                        onPress={() => togglePromptExpansion(i)}
                                        activeOpacity={0.7}
                                    >
                                        <Card style={StyleSheet.flatten([styles.promptCard, isExpanded ? { backgroundColor: '#FFF' } : undefined])} elevated={isExpanded}>
                                            <Text numberOfLines={isExpanded ? undefined : 2} style={{ lineHeight: 24 }}>
                                                <Typography variant="body" style={{ fontWeight: 'bold', color: Colors.gold }}>{i + 1}. </Typography>
                                                <Typography variant="body">{p}</Typography>
                                            </Text>
                                            {!isExpanded && (
                                                <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: 4, fontStyle: 'italic' }}>
                                                    Tap to expand
                                                </Typography>
                                            )}
                                        </Card>
                                    </TouchableOpacity>
                                );
                            })
                        ) : (
                            <TouchableOpacity
                                onPress={handleRegeneratePrompts}
                                style={{
                                    padding: Spacing.lg,
                                    alignItems: 'center',
                                    backgroundColor: Colors.cream,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: Colors.gold,
                                    borderStyle: 'dashed',
                                }}
                            >
                                <Typography variant="body" color={Colors.gold} style={{ fontWeight: 'bold', marginBottom: 4 }}>
                                    ✨ Generate Reflection Prompts
                                </Typography>
                                <Typography variant="caption" color={Colors.mediumGray} style={{ textAlign: 'center' }}>
                                    AI-powered questions to deepen your study
                                </Typography>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Living Journal Section */}
                    <View ref={reflectionSectionRef} style={styles.section}>
                        <Typography variant="h2" style={styles.sectionTitle} color={colors.text}>
                            My Reflections
                        </Typography>

                        {
                            dailyEntries.length > 0 ? (
                                <View style={{ marginBottom: Spacing.md }}>
                                    {!showReflectionsTimeline && (
                                        <Button onPress={() => setShowReflectionsTimeline(true)} variant="secondary" style={{ marginBottom: Spacing.md }}>
                                            View Past Reflections ({dailyEntries.length})
                                        </Button>
                                    )}

                                    {showReflectionsTimeline && (
                                        <View style={{ marginBottom: Spacing.md }}>
                                            {/* Timeline Stack */}
                                            {dailyEntries.map((entry, index) => (
                                                <View key={entry.id || index} style={{
                                                    borderLeftWidth: 2,
                                                    borderLeftColor: Colors.gold,
                                                    paddingLeft: Spacing.md,
                                                    marginBottom: Spacing.md,
                                                    paddingBottom: Spacing.sm
                                                }}>
                                                    <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 4 }}>
                                                        {new Date(entry.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </Typography>
                                                    <Typography variant="body" color={colors.text}>
                                                        {entry.reflection}
                                                    </Typography>
                                                </View>
                                            ))}

                                            <TouchableOpacity onPress={() => router.push(`/journal?planId=${currentPlanId}&day=${currentDayIndex + 1}` as any)} style={{ alignSelf: 'flex-end', marginTop: Spacing.sm }}>
                                                <Typography variant="caption" color={Colors.gold} style={{ textDecorationLine: 'underline' }}>
                                                    See all in Journal
                                                </Typography>
                                            </TouchableOpacity>

                                            <TouchableOpacity onPress={() => setShowReflectionsTimeline(false)} style={{ marginTop: Spacing.sm }}>
                                                <Typography variant="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>
                                                    Collapse
                                                </Typography>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            ) : null
                        }

                        {/* Add New Thought Input */}
                        <Card style={{ padding: Spacing.md, backgroundColor: colors.surface }}>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        color: colors.text,
                                        height: dailyEntries.length > 0 ? 80 : 150, // Smaller if adding to existing
                                        minHeight: dailyEntries.length > 0 ? 80 : 150
                                    }
                                ]}
                                placeholder={reflectionPlaceholder || (dailyEntries.length > 0 ? "Add a new thought..." : "Write your thoughts...")}
                                placeholderTextColor={colors.textSecondary}
                                multiline
                                textAlignVertical="top"
                                value={reflection}
                                onChangeText={setReflection}
                                maxLength={2000}
                            />
                        </Card>
                    </View >

                    {/* Actions */}
                    < View style={styles.actions} >
                        {/* "Saved" Indicator near button */}
                        {
                            showSaved && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md }}>
                                    <Text style={{ fontSize: 18, color: Colors.gold, marginRight: 8 }}>✓</Text>
                                    <Typography variant="body" color={Colors.gold} style={{ fontWeight: 'bold' }}>Reason Captured</Typography>
                                </View>
                            )
                        }

                        {/* Share Toggle */}
                        <TouchableOpacity
                            onPress={() => setSharePublicly(!sharePublicly)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md }}
                        >
                            <View style={{
                                width: 44, height: 24, borderRadius: 12,
                                backgroundColor: sharePublicly ? Colors.gold : 'rgba(0,0,0,0.2)',
                                padding: 2, justifyContent: 'center',
                            }}>
                                <View style={{
                                    width: 20, height: 20, borderRadius: 10,
                                    backgroundColor: '#FFF',
                                    alignSelf: sharePublicly ? 'flex-end' : 'flex-start',
                                }} />
                            </View>
                            <Typography variant="caption" color={Colors.charcoal}>
                                Share to Community Feed
                            </Typography>
                        </TouchableOpacity>

                        <Button onPress={handleSaveReflection} disabled={!reflection.trim()}>
                            {sharePublicly ? "Save & Share" : (dailyEntries.length > 0 ? "Add Thought" : "Save Reflection")}
                        </Button>
                    </View >
                    <View style={{ height: 100 }} />
                </ScrollView >
            ) : (
                /* Journey Map View */
                <FlatList
                    ref={journeyListRef}
                    data={journeyData}
                    renderItem={renderJourneyItem}
                    keyExtractor={(item) => item.dayNumber.toString()}
                    style={styles.journeyList}
                    contentContainerStyle={styles.journeyContent}
                    onScrollToIndexFailed={(info) => {
                        console.warn("Scroll to index failed", info);
                    }}
                />
            )
            }

            {/* Highlight Action Sheet (Daily View Only) */}
            {
                viewMode === 'daily' && isSelectionMode && (
                    <Animated.View style={[styles.actionSheetContainer, { bottom: actionSheetBottom }]}>
                        <View style={styles.actionSheetContent}>
                            {/* Drag Handle - tap or swipe down to dismiss */}
                            <TouchableOpacity
                                style={styles.dragHandleContainer}
                                onPress={() => setSelectedVerses(new Set())}
                            >
                                <View style={styles.dragHandle} />
                            </TouchableOpacity>
                            {/* Wrapper to ensure swatches and buttons are visible */}
                            <View style={styles.swatchRow}>
                                {HIGHLIGHT_COLORS.map(color => {
                                    // Check if any selected verse has this color
                                    const firstSelectedVerse = Array.from(selectedVerses)[0];
                                    const currentHighlight = highlights.find(h => h.verse === firstSelectedVerse);
                                    const isActiveColor = currentHighlight?.color === color.hex;

                                    return (
                                        <TouchableOpacity
                                            key={color.name}
                                            style={[
                                                styles.colorSwatch,
                                                { backgroundColor: color.hex },
                                                isActiveColor && styles.colorSwatchActive
                                            ]}
                                            onPress={() => {
                                                if (isActiveColor) {
                                                    removeHighlight();
                                                } else {
                                                    applyHighlight(color.hex);
                                                }
                                            }}
                                        >
                                            {isActiveColor && (
                                                <Text style={{ fontSize: 16, color: '#fff', fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 2 }}>✕</Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <View style={styles.actionRow}>
                                <TouchableOpacity style={styles.sheetButton} onPress={handleReflectSelection}>
                                    <Typography variant="caption" color={Colors.gold} style={{ fontWeight: 'bold' }}>REFLECTION</Typography>
                                </TouchableOpacity>
                                <View style={styles.verticalDivider} />
                                <TouchableOpacity style={styles.sheetButton} onPress={handleShareSelection}>
                                    <Typography variant="caption" color={Colors.gold} style={{ fontWeight: 'bold' }}>SHARE</Typography>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animated.View>
                )
            }


            {/* Bottom floating navigation removed - using top header arrows only */}

            {/* Scroll to Top Button */}
            {showScrollTop && viewMode === 'daily' && (
                <Animated.View style={styles.scrollToTopButton}>
                    <TouchableOpacity
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: Colors.gold,
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 4,
                            elevation: 5,
                        }}
                        onPress={scrollToTop}
                        activeOpacity={0.8}
                    >
                        <Typography variant="body" style={{ fontSize: 24, color: Colors.white, fontWeight: 'bold' }}>↑</Typography>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Bible Version Selection Modal */}
            <Modal visible={showVersionsModal} animationType="slide" transparent={true} onRequestClose={() => setShowVersionsModal(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowVersionsModal(false)} activeOpacity={1} />
                    <View style={{ backgroundColor: Colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 40, paddingHorizontal: 20, maxHeight: '80%' }}>
                        <View style={{ alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ width: 40, height: 4, backgroundColor: Colors.lightGray, borderRadius: 2 }} />
                        </View>

                        {/* Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
                            <Typography variant="h3" color={Colors.charcoal}>Select Translation</Typography>
                            <TouchableOpacity onPress={() => setShowVersionsModal(false)}>
                                <Text style={{ fontSize: 24, color: Colors.mediumGray }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        <View style={{ marginBottom: Spacing.md }}>
                            <TextInput
                                style={{
                                    backgroundColor: '#E8E4DF',
                                    borderRadius: 8,
                                    padding: Spacing.sm,
                                    color: Colors.charcoal,
                                    fontSize: 16,
                                }}
                                placeholder="Search translations..."
                                placeholderTextColor={Colors.mediumGray}
                                value={versionSearchQuery}
                                onChangeText={searchVersions}
                            />
                        </View>

                        {/* Popular Versions */}
                        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                            {/* Show search results if searching, otherwise show popular versions */}
                            {versionSearchQuery.length > 0 ? (
                                <>
                                    <Typography variant="caption" color={Colors.mediumGray} style={{ marginBottom: Spacing.sm }}>
                                        Search Results
                                    </Typography>
                                    {loadingVersions ? (
                                        <ActivityIndicator size="small" color={Colors.gold} style={{ marginVertical: Spacing.lg }} />
                                    ) : allVersions.length === 0 ? (
                                        <Typography variant="body" color={Colors.mediumGray} style={{ textAlign: 'center' }}>
                                            No translations found
                                        </Typography>
                                    ) : (
                                        allVersions.map((version) => (
                                            <TouchableOpacity
                                                key={version.id}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    padding: Spacing.md,
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: '#E8E4DF',
                                                    backgroundColor: currentVersion?.id === version.id ? '#E8E4DF' : 'transparent',
                                                }}
                                                onPress={() => handleVersionSelect(version)}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        <Typography variant="body" color={Colors.charcoal} style={{ fontWeight: '600' }}>
                                                            {version.abbreviation}
                                                        </Typography>
                                                        {currentVersion?.id === version.id && (
                                                            <Text style={{ color: Colors.gold }}>✓</Text>
                                                        )}
                                                    </View>
                                                    <Typography variant="caption" color={Colors.mediumGray} numberOfLines={1}>
                                                        {version.name}
                                                    </Typography>
                                                </View>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </>
                            ) : (
                                <>
                                    <Typography variant="caption" color={Colors.mediumGray} style={{ marginBottom: Spacing.sm }}>
                                        Popular Translations
                                    </Typography>
                                    {POPULAR_VERSIONS.map((version) => (
                                        <TouchableOpacity
                                            key={version.id}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                padding: Spacing.md,
                                                borderBottomWidth: 1,
                                                borderBottomColor: '#E8E4DF',
                                                backgroundColor: currentVersion?.id === version.id ? '#E8E4DF' : 'transparent',
                                            }}
                                            onPress={() => handleVersionSelect(version)}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Typography variant="body" color={Colors.charcoal} style={{ fontWeight: '600' }}>
                                                        {version.abbreviation}
                                                    </Typography>
                                                    {version.abbreviation === 'ESV' && (
                                                        <Text style={{ fontSize: 12, color: Colors.gold }}>🔊</Text>
                                                    )}
                                                    {currentVersion?.id === version.id && (
                                                        <Text style={{ color: Colors.gold }}>✓</Text>
                                                    )}
                                                </View>
                                                <Typography variant="caption" color={Colors.mediumGray} numberOfLines={1}>
                                                    {version.name}
                                                </Typography>
                                            </View>
                                        </TouchableOpacity>
                                    ))}

                                    {/* Hint for more versions */}
                                    <View style={{ padding: Spacing.md, alignItems: 'center' }}>
                                        <Typography variant="caption" color={Colors.mediumGray} style={{ textAlign: 'center' }}>
                                            💡 Search above to find more translations
                                        </Typography>
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Font Settings Modal - Premium Design */}
            <Modal
                visible={showFontSettings}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowFontSettings(false)}
            >
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        activeOpacity={1}
                        onPress={() => setShowFontSettings(false)}
                    />
                    <View style={{
                        backgroundColor: Colors.cream,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingTop: 12,
                        paddingBottom: 40,
                        paddingHorizontal: 24,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 12,
                        elevation: 20,
                    }}>
                        {/* Drag Handle */}
                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ width: 40, height: 4, backgroundColor: Colors.mediumGray, borderRadius: 2 }} />
                        </View>

                        {/* Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <Typography variant="h3" style={{ fontFamily: FontFamilies.serif, color: Colors.charcoal }}>
                                Reading Settings
                            </Typography>
                            <TouchableOpacity onPress={() => setShowFontSettings(false)}>
                                <Text style={{ fontSize: 24, color: Colors.mediumGray }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Text Size Section */}
                        <View style={{ marginBottom: 28 }}>
                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600' }}>
                                Text Size
                            </Typography>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity
                                    onPress={() => setFontSize('small')}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 16,
                                        paddingHorizontal: 16,
                                        borderRadius: 12,
                                        backgroundColor: fontSize === 'small' ? Colors.gold : '#F5F0E8',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 2,
                                        borderColor: fontSize === 'small' ? Colors.gold : 'transparent',
                                    }}
                                >
                                    <Text style={{
                                        fontSize: 18,
                                        fontFamily: FontFamilies.serif,
                                        color: fontSize === 'small' ? Colors.white : Colors.charcoal,
                                        marginBottom: 4
                                    }}>Aa</Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: fontSize === 'small' ? Colors.white : Colors.mediumGray,
                                        fontWeight: '500'
                                    }}>Compact</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setFontSize('large')}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 16,
                                        paddingHorizontal: 16,
                                        borderRadius: 12,
                                        backgroundColor: fontSize === 'large' ? Colors.gold : '#F5F0E8',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 2,
                                        borderColor: fontSize === 'large' ? Colors.gold : 'transparent',
                                    }}
                                >
                                    <Text style={{
                                        fontSize: 24,
                                        fontFamily: FontFamilies.serif,
                                        color: fontSize === 'large' ? Colors.white : Colors.charcoal,
                                        marginBottom: 4,
                                        fontWeight: '600'
                                    }}>Aa</Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: fontSize === 'large' ? Colors.white : Colors.mediumGray,
                                        fontWeight: '500'
                                    }}>Comfortable</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Line Spacing Section */}
                        <View style={{ marginBottom: 20 }}>
                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600' }}>
                                Line Spacing
                            </Typography>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                {['Tight', 'Normal', 'Relaxed'].map((label, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        onPress={() => setLineSpacing(index as 0 | 1 | 2)}
                                        style={{
                                            flex: 1,
                                            paddingVertical: 14,
                                            paddingHorizontal: 12,
                                            borderRadius: 12,
                                            backgroundColor: lineSpacing === index ? Colors.gold : '#F5F0E8',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderWidth: 2,
                                            borderColor: lineSpacing === index ? Colors.gold : 'transparent',
                                        }}
                                    >
                                        {/* Visual representation of line spacing */}
                                        <View style={{ marginBottom: 6 }}>
                                            <View style={{ width: 24, height: 2, backgroundColor: lineSpacing === index ? Colors.white : Colors.charcoal, marginBottom: index === 0 ? 3 : index === 1 ? 5 : 7, borderRadius: 1 }} />
                                            <View style={{ width: 18, height: 2, backgroundColor: lineSpacing === index ? Colors.white : Colors.charcoal, marginBottom: index === 0 ? 3 : index === 1 ? 5 : 7, borderRadius: 1 }} />
                                            <View style={{ width: 22, height: 2, backgroundColor: lineSpacing === index ? Colors.white : Colors.charcoal, borderRadius: 1 }} />
                                        </View>
                                        <Text style={{
                                            fontSize: 11,
                                            color: lineSpacing === index ? Colors.white : Colors.mediumGray,
                                            fontWeight: '500'
                                        }}>{label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Preview Section */}
                        <View style={{
                            backgroundColor: '#F5F0E8',
                            borderRadius: 12,
                            padding: 16,
                            borderLeftWidth: 3,
                            borderLeftColor: Colors.gold,
                        }}>
                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginBottom: 8, fontWeight: '600' }}>
                                PREVIEW
                            </Typography>
                            <Text style={{
                                fontFamily: FontFamilies.serif,
                                fontSize: FONT_SIZES[fontSize],
                                lineHeight: LINE_SPACING_VALUES[lineSpacing],
                                color: Colors.charcoal,
                            }}>
                                In the beginning God created the heavens and the earth.
                            </Text>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Quick Reflection Modal - Using shared component */}
            <ReflectionModal
                visible={showReflectModal}
                onClose={() => setShowReflectModal(false)}
                onSave={saveModalReflection}
                verseNumber={reflectionContext.split(':')[1]?.split('\n')[0] || ''}
                verseText={reflectionContext.split('\n\n')[1] || ''}
                verseReference={reflectionContext.split('\n')[0] || ''}
                reflectionValue={modalReflection}
                onReflectionChange={setModalReflection}
            />

            {/* Nuance Deep Dive Modal */}
            <Modal
                visible={showNuanceModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowNuanceModal(false)}
            >
                <TouchableOpacity
                    style={styles.reflectModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowNuanceModal(false)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        style={[styles.reflectModalContent, { height: '80%', minHeight: 500 }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 }}>
                            <TouchableOpacity onPress={() => setShowNuanceModal(false)} style={{ padding: 8 }}>
                                <Text style={{ fontSize: 24, color: Colors.mediumGray }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                            <Typography variant="h3" color={Colors.gold} style={{ marginBottom: 20, textAlign: 'center', fontFamily: FontFamilies.serif, fontSize: 24, lineHeight: 32 }}>
                                {selectedNuance}
                            </Typography>

                            {loadingDeepDive ? (
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color={Colors.gold} style={{ marginBottom: 16 }} />
                                    <Typography variant="body" style={{ fontStyle: 'italic', color: Colors.mediumGray }}>
                                        Consulting the archives...
                                    </Typography>
                                </View>
                            ) : (
                                <View>
                                    <Typography variant="body" style={{ lineHeight: 28, color: colors.text, fontSize: 18, fontFamily: FontFamilies.serif }}>
                                        {nuanceDeepDive}
                                    </Typography>

                                    <View style={{ height: 1, backgroundColor: Colors.gold, opacity: 0.3, marginVertical: 30 }} />

                                    <Button onPress={handleReflectOnNuance} style={{ marginBottom: 20 }}>
                                        Reflect on this Nuance
                                    </Button>
                                </View>
                            )}
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal >


            {/* Audio Player Panel - Slides up from bottom */}
            <Animated.View
                style={[
                    styles.audioPlayerPanel,
                    {
                        // Dynamic bottom position: when scrolled (nav hidden), move to bottom edge
                        bottom: isNavHidden ? 20 : 80,
                        // Minimize padding when scrolled
                        paddingTop: isNavHidden ? 12 : 20,
                        paddingBottom: isNavHidden ? 16 : 24,
                        transform: [{
                            translateY: audioPlayerAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [300, 0]
                            })
                        }],
                        opacity: audioPlayerAnim
                    }
                ]}
                {...audioPanelPanResponder.panHandlers}
            >
                {/* Drag Handle */}
                <View style={styles.audioDragHandle}>
                    <View style={styles.audioDragIndicator} />
                </View>

                {/* Version Info - Hidden when scrolled for minimal mode */}
                {!isNavHidden && (
                    <View style={styles.audioVersionInfo}>
                        <Text style={styles.audioVersionTitle}>
                            {todayReadings[0]?.book || 'Matthew'} {getCurrentBookChapter().chapter}
                        </Text>
                        <View style={styles.audioCopyright}>
                            <Text style={styles.audioCopyrightText}>ESV Audio (David Cochran Heath) © Crossway</Text>
                            <TouchableOpacity style={styles.audioInfoIcon}>
                                <Text style={{ color: Colors.mediumGray, fontSize: 14 }}>ⓘ</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Transport Controls - Chapter Navigation */}
                <View style={styles.audioTransportControls}>
                    <TouchableOpacity
                        style={[styles.audioSecondaryButton, currentAudioChapter <= getChapterRange().start && { opacity: 0.3 }]}
                        onPress={goToPreviousChapter}
                        disabled={currentAudioChapter <= getChapterRange().start}
                    >
                        <View style={styles.audioRewindIcon}>
                            <Text style={{ color: Colors.charcoal, fontSize: 24 }}>◀◀</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.audioPlayButton} onPress={togglePlayPause}>
                        <View style={styles.audioPlayTriangle}>
                            {audioLoading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : isPlaying ? (
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    <View style={{ width: 6, height: 22, backgroundColor: '#FFFFFF', borderRadius: 2 }} />
                                    <View style={{ width: 6, height: 22, backgroundColor: '#FFFFFF', borderRadius: 2 }} />
                                </View>
                            ) : (
                                <View style={styles.playTriangle} />
                            )}
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.audioSecondaryButton, currentAudioChapter >= getChapterRange().end && { opacity: 0.3 }]}
                        onPress={goToNextChapter}
                        disabled={currentAudioChapter >= getChapterRange().end}
                    >
                        <View style={styles.audioForwardIcon}>
                            <Text style={{ color: Colors.charcoal, fontSize: 24 }}>▶▶</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Progress Bar with Speed Button */}
                <View style={styles.audioProgressContainer}>
                    <TouchableOpacity style={styles.audioSpeedButton} onPress={cyclePlaybackSpeed}>
                        <Text style={styles.audioSpeedText}>{playbackSpeed}x</Text>
                    </TouchableOpacity>
                    <View style={styles.audioProgressBar}>
                        <View style={[styles.audioProgressTrack, { width: audioDuration > 0 ? `${(audioPosition / audioDuration) * 100}%` : '0%' }]} />
                        <View style={[styles.audioProgressThumb, { left: audioDuration > 0 ? `${(audioPosition / audioDuration) * 100}%` : 0 }]} />
                    </View>
                    <Text style={[styles.audioTimeText, { textAlign: 'right' }]}>{formatTime(audioPosition)} / {formatTime(audioDuration)}</Text>
                </View>
            </Animated.View>

            <Animated.View style={[styles.bottomNavContainer, { opacity: navOpacity }]}>
                <BottomNav />
            </Animated.View>
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.cream },
    scrollView: { flex: 1 },
    content: { padding: Spacing.lg, paddingBottom: 100 },
    loadingContainer: { flex: 1, backgroundColor: Colors.cream, alignItems: 'center', justifyContent: 'center' },

    // Header Styles
    header: { paddingTop: Platform.OS === 'ios' ? 50 : 20, backgroundColor: Colors.cream, zIndex: 10 },
    headerToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, height: 44, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    headerPills: { flexDirection: 'row', alignItems: 'center' },
    headerPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginHorizontal: 4, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)' },
    headerPillText: { fontSize: 12, fontWeight: 'bold', fontFamily: FontFamilies.sans, color: Colors.charcoal },
    versionPillCompact: { paddingHorizontal: 8 },
    headerActions: { flexDirection: 'row', justifyContent: 'flex-end' },
    headerIcon: { fontSize: 22, color: Colors.charcoal },
    headerIconButton: { padding: 8 },

    subHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
    navArrow: { padding: Spacing.md, minWidth: 44, alignItems: 'center' },
    navButtonDisabled: { opacity: 0.3 },
    headerTitleContainer: { alignItems: 'center', flex: 1 },
    reference: { marginTop: 4, marginBottom: 4, textAlign: 'center' },

    tldrCard: { marginBottom: Spacing.md, backgroundColor: '#FFF9E6', borderLeftWidth: 4, borderLeftColor: Colors.gold },
    tldrLabel: { fontWeight: 'bold', marginBottom: Spacing.xs },
    tldrText: { fontStyle: 'italic', lineHeight: 22 },
    // TL;DR Action Icons
    tldrActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: Spacing.md,
        gap: 5, // 5px padding between icons
    },
    tldrActionButton: {
        padding: 4,
    },
    tldrActionIcon: {
        fontSize: 20,
        opacity: 0.8,
    },
    scriptureContainer: { marginBottom: Spacing.xl, paddingHorizontal: 0 },

    // --- Harmanized Typography ---
    scriptureTextBase: {
        fontFamily: FontFamilies.serif,
        color: Colors.charcoal,
        textAlign: 'left'
    },
    headingText: { fontSize: 22, fontWeight: 'bold', color: Colors.charcoal, fontFamily: FontFamilies.serif, textAlign: 'center' },
    verseText: {},
    verseNumber: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.gold,
        marginRight: 4,
        textAlignVertical: 'top',
        lineHeight: 20,
        position: 'relative',
        top: -2,
    },
    verseSelected: { textDecorationLine: 'underline', textDecorationStyle: 'dashed', textDecorationColor: Colors.gold },

    promptsSection: { marginBottom: Spacing.xl },
    sectionTitle: { marginBottom: Spacing.md },
    promptCard: { marginBottom: Spacing.sm, backgroundColor: Colors.lightGray },
    journalSection: { marginBottom: Spacing.lg },
    journalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    savedBadge: { backgroundColor: Colors.gold, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: 12 },
    journalInput: { borderWidth: 1, borderColor: Colors.lightGray, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.base, fontFamily: FontFamilies.sans, color: Colors.charcoal, minHeight: 150, backgroundColor: Colors.white },
    actions: { marginBottom: Spacing['2xl'] },
    scrollToTopButton: { position: 'absolute', bottom: 120, right: 20, zIndex: 100 },
    scrollButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    scrollIcon: { fontSize: 24, color: Colors.white, fontWeight: 'bold' },

    // Journey Map Styles
    journeyList: { flex: 1, backgroundColor: Colors.cream },
    journeyContent: { padding: Spacing.md, paddingBottom: 100 },
    journeyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.cream,
        marginBottom: Spacing.sm,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    journeyRowCurrent: {
        borderColor: Colors.gold,
        backgroundColor: '#FFF8E1', // Lighter gold/cream
    },
    journeyRowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    chapterBreak: {
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: FontFamilies.serif,
        color: Colors.gold,
        textAlign: 'center',
        marginVertical: Spacing.md,
        width: '100%',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    journeyDayText: {
        fontSize: 16,
        fontFamily: FontFamilies.serif,
        color: Colors.mediumGray, // Fixed from textSecondary to mediumGray
        minWidth: 60,
    },
    journeyRefText: {
        fontSize: 16,
        fontFamily: FontFamilies.serif, // Fixed from heading to serif
        color: Colors.charcoal, // Fixed from text to charcoal
    },
    journeyCheckIcon: { fontSize: 18, color: Colors.gold, fontWeight: 'bold' },

    // Action Sheet Styles
    actionSheetContainer: {
        position: 'absolute',
        bottom: 0,
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 200,
    },

    // Living Journal Styles
    section: {
        marginBottom: Spacing.xl,
    },
    input: {
        fontSize: FontSizes.base,
        fontFamily: FontFamilies.serif,
        minHeight: 120,
        textAlignVertical: 'top',
    },

    // Header Pills (Consolidated)
    actionSheetContent: {
        backgroundColor: Colors.cream,
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    dragHandleContainer: {
        alignItems: 'center',
        paddingVertical: 8,
        marginBottom: 4,
    },
    dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#CCC',
    },
    swatchRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: Spacing.md,
    },
    colorSwatch: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    colorSwatchActive: {
        borderWidth: 3,
        borderColor: 'rgba(0,0,0,0.4)',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    sheetButton: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.xs,
    },
    verticalDivider: {
        width: 1,
        height: 16,
        backgroundColor: Colors.mediumGray,
        opacity: 0.3,
    },

    // Font Settings Modal
    fontSettingsOverlay: { flex: 1, justifyContent: 'flex-end' },
    fontSettingsBackdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
    fontSettingsModal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
    fontSettingsDragHandle: { alignItems: 'center', marginBottom: 20 },
    dragHandleBar: { width: 40, height: 4, borderRadius: 2 },
    fontSettingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    fontOption: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', minWidth: 44, alignItems: 'center' },
    fontOptionActive: { borderColor: Colors.gold, backgroundColor: 'rgba(212, 163, 115, 0.1)' },

    // Missing Styles Restored
    // Missing Styles Restored
    pill: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
    },
    pillActive: {
        backgroundColor: Colors.gold,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.darkGray,
    },
    pillTextActive: {
        color: Colors.white,
    },
    // Floating Scripture Navigation
    floatingNavContainer: {
        position: 'absolute',
        bottom: 100,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        zIndex: 100,
    },
    floatingNavButtonEdge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    floatingNavButtonDisabled: {
        opacity: 0.3,
    },
    floatingPlayButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(50,50,50,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    bottomNavContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    // Reflection Modal Styles
    reflectModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    reflectModalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: Spacing.lg,
        paddingBottom: 40,
    },
    reflectModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    reflectModalContext: {
        backgroundColor: '#FFF9E6',
        padding: Spacing.md,
        borderRadius: 12,
        marginBottom: Spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: Colors.gold,
    },
    reflectModalInput: {
        flex: 1,
        minHeight: 120,
        backgroundColor: Colors.cream,
        borderRadius: 12,
        padding: Spacing.md,
        fontSize: 16,
        fontFamily: FontFamilies.serif,
        color: Colors.charcoal,
        marginBottom: Spacing.md,
    },
    reflectModalSaveButton: {
        backgroundColor: Colors.gold,
        paddingVertical: Spacing.md,
        borderRadius: 12,
        alignItems: 'center',
    },
    reflectModalSaveDisabled: {
        backgroundColor: Colors.lightGray,
    },
    // Bible-style Reflection Modal Styles - EXACT COPY FROM BIBLE.TSX
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
    reflectionModal: { backgroundColor: Colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    modalVerseScroll: { maxHeight: 100, marginBottom: Spacing.sm, backgroundColor: 'rgba(212, 163, 115, 0.1)', padding: Spacing.md, borderRadius: 8 },
    modalVerseText: { fontStyle: 'italic', color: Colors.charcoal },
    reflectionInput: { backgroundColor: Colors.white, borderRadius: 12, padding: Spacing.md, height: 120, textAlignVertical: 'top', marginTop: Spacing.md, fontSize: 16, fontFamily: FontFamilies.sans, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.lg, gap: Spacing.md },
    cancelButton: { paddingVertical: 10, paddingHorizontal: 16 },
    saveReflectionButton: { backgroundColor: Colors.gold, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
    buttonDisabled: { opacity: 0.5 },

    // Audio Player Styles
    audioPlayerPanel: {
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        backgroundColor: Colors.cream,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 20,
        paddingBottom: 24,
        paddingHorizontal: 20,
        zIndex: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 10,
        borderTopWidth: 1,
        borderTopColor: Colors.lightGray,
    },
    audioDragHandle: {
        alignItems: 'center',
        marginBottom: 12,
    },
    audioDragIndicator: {
        width: 36,
        height: 4,
        backgroundColor: Colors.mediumGray,
        borderRadius: 2,
    },
    audioVersionInfo: {
        alignItems: 'center',
        marginBottom: 20,
    },
    audioVersionTitle: {
        color: Colors.charcoal,
        fontSize: 16,
        fontFamily: FontFamilies.serif,
        fontWeight: '600',
        textAlign: 'center',
    },
    audioCopyright: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    audioCopyrightText: {
        color: Colors.mediumGray,
        fontSize: 13,
    },
    audioInfoIcon: {
        marginLeft: 4,
    },
    audioTransportControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        marginBottom: 20,
    },
    audioSecondaryButton: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    audioRewindIcon: {},
    audioForwardIcon: {},
    audioPlayButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    audioPlayTriangle: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    playTriangle: {
        width: 0,
        height: 0,
        borderLeftWidth: 16,
        borderTopWidth: 10,
        borderBottomWidth: 10,
        borderLeftColor: '#FFFFFF',
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        marginLeft: 4,
    },
    audioProgressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    audioTimeText: {
        fontSize: 12,
        color: Colors.mediumGray,
        width: 40,
    },
    audioProgressBar: {
        flex: 1,
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
        position: 'relative',
    },
    audioProgressTrack: {
        height: 4,
        backgroundColor: Colors.gold,
        borderRadius: 2,
    },
    audioProgressThumb: {
        position: 'absolute',
        top: -4,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.gold,
        marginLeft: -6,
    },
    audioBottomControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    audioSpeedButton: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: Colors.mediumGray,
        borderRadius: 4,
    },
    audioSpeedText: {
        fontSize: 14,
        color: Colors.charcoal,
        fontWeight: '600',
    },
    audioShowControlsButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    audioShowControlsText: {
        fontSize: 14,
        color: Colors.charcoal,
    },
    audioSleepButton: {
        padding: 4,
    },
});
