import { useState, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Platform, TextInput, Text, Modal, KeyboardAvoidingView, useWindowDimensions, PanResponder, Share, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Typography } from '../components/ui/Typography';
import { BottomNav } from '../components/ui/BottomNav';
import { ReflectionModal } from '../components/ui/ReflectionModal';
import { Colors, Spacing, FontFamilies } from '../constants/theme';
import { fetchScripture, fetchScriptureWithVersion, getAudioUrl, getEsvApiKey, type ScripturePassage } from '../services/bibleApi';
import { Audio } from 'expo-av';
import { useTheme } from '../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BibleVersionsService, POPULAR_VERSIONS, type BibleVersion, type UserBibleVersion } from '../services/bibleVersions';
import { saveVerseReflection, getVerseReflection, saveVerseHighlight, getVerseHighlights, deleteVerseHighlight, type VerseHighlight } from '../services/database';
import { generateTLDR, generateExpandedTLDR, generateNuancePrompts, generateNuanceDeepDive, type NuancePrompt } from '../services/geminiService';
import { getCachedTLDR, cacheTLDR, getCachedNuance, cacheNuance, getCachedExpandedTLDR, cacheExpandedTLDR } from '../services/aiCache';
import { publishReflection } from '../services/feedService';
import RenderHTML from 'react-native-render-html';

// HTML Tag Styles for RenderHTML (Scripture Display)
const scriptureTagStyles = {
    body: {
        fontFamily: FontFamilies.serif,
        color: Colors.charcoal,
    },
    h2: {
        fontFamily: FontFamilies.serifBold,
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.gold,
        textAlign: 'center',
        marginTop: 24,
        marginBottom: 12,
        fontStyle: 'italic',
    },
    h3: {
        fontFamily: FontFamilies.serifBold,
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.gold,
        textAlign: 'center',
        marginTop: 28,
        marginBottom: 16,
        fontStyle: 'italic',
    },
    p: {
        marginBottom: 2,
        marginTop: 0,
    },
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
    },
    'api-chapter': {
        fontSize: 32,
        lineHeight: 40,
        fontFamily: FontFamilies.serifBold,
        color: Colors.gold,
        marginTop: 24,
        marginBottom: 8,
    }
};

// Bible book data with chapter counts
const OLD_TESTAMENT = [
    { name: 'Genesis', chapters: 50 },
    { name: 'Exodus', chapters: 40 },
    { name: 'Leviticus', chapters: 27 },
    { name: 'Numbers', chapters: 36 },
    { name: 'Deuteronomy', chapters: 34 },
    { name: 'Joshua', chapters: 24 },
    { name: 'Judges', chapters: 21 },
    { name: 'Ruth', chapters: 4 },
    { name: '1 Samuel', chapters: 31 },
    { name: '2 Samuel', chapters: 24 },
    { name: '1 Kings', chapters: 22 },
    { name: '2 Kings', chapters: 25 },
    { name: '1 Chronicles', chapters: 29 },
    { name: '2 Chronicles', chapters: 36 },
    { name: 'Ezra', chapters: 10 },
    { name: 'Nehemiah', chapters: 13 },
    { name: 'Esther', chapters: 10 },
    { name: 'Job', chapters: 42 },
    { name: 'Psalm', chapters: 150 },
    { name: 'Proverbs', chapters: 31 },
    { name: 'Ecclesiastes', chapters: 12 },
    { name: 'Song of Solomon', chapters: 8 },
    { name: 'Isaiah', chapters: 66 },
    { name: 'Jeremiah', chapters: 52 },
    { name: 'Lamentations', chapters: 5 },
    { name: 'Ezekiel', chapters: 48 },
    { name: 'Daniel', chapters: 12 },
    { name: 'Hosea', chapters: 14 },
    { name: 'Joel', chapters: 3 },
    { name: 'Amos', chapters: 9 },
    { name: 'Obadiah', chapters: 1 },
    { name: 'Jonah', chapters: 4 },
    { name: 'Micah', chapters: 7 },
    { name: 'Nahum', chapters: 3 },
    { name: 'Habakkuk', chapters: 3 },
    { name: 'Zephaniah', chapters: 3 },
    { name: 'Haggai', chapters: 2 },
    { name: 'Zechariah', chapters: 14 },
    { name: 'Malachi', chapters: 4 },
];

const NEW_TESTAMENT = [
    { name: 'Matthew', chapters: 28 },
    { name: 'Mark', chapters: 16 },
    { name: 'Luke', chapters: 24 },
    { name: 'John', chapters: 21 },
    { name: 'Acts', chapters: 28 },
    { name: 'Romans', chapters: 16 },
    { name: '1 Corinthians', chapters: 16 },
    { name: '2 Corinthians', chapters: 13 },
    { name: 'Galatians', chapters: 6 },
    { name: 'Ephesians', chapters: 6 },
    { name: 'Philippians', chapters: 4 },
    { name: 'Colossians', chapters: 4 },
    { name: '1 Thessalonians', chapters: 5 },
    { name: '2 Thessalonians', chapters: 3 },
    { name: '1 Timothy', chapters: 6 },
    { name: '2 Timothy', chapters: 4 },
    { name: 'Titus', chapters: 3 },
    { name: 'Philemon', chapters: 1 },
    { name: 'Hebrews', chapters: 13 },
    { name: 'James', chapters: 5 },
    { name: '1 Peter', chapters: 5 },
    { name: '2 Peter', chapters: 3 },
    { name: '1 John', chapters: 5 },
    { name: '2 John', chapters: 1 },
    { name: '3 John', chapters: 1 },
    { name: 'Jude', chapters: 1 },
    { name: 'Revelation', chapters: 22 },
];

const BIBLE_BOOKS = [...OLD_TESTAMENT, ...NEW_TESTAMENT];

const STORAGE_KEY = '@bible_position';

// --- Highlight Colors ---
const HIGHLIGHT_COLORS = [
    { name: 'Yellow', hex: '#FFE082' }, // Amber 200
    { name: 'Green', hex: '#A5D6A7' },  // Green 200
    { name: 'Blue', hex: '#90CAF9' },   // Blue 200
    { name: 'Pink', hex: '#F48FB1' },   // Pink 200
    { name: 'Purple', hex: '#CE93D8' }, // Purple 200
];

export default function Bible() {
    const router = useRouter();
    const params = useLocalSearchParams<{ book?: string; chapter?: string }>();

    const scrollViewRef = useRef<ScrollView>(null);
    const { colors, isDarkMode } = useTheme();

    const [currentBook, setCurrentBook] = useState('Genesis');
    const [currentChapter, setCurrentChapter] = useState(1);
    const [positionLoaded, setPositionLoaded] = useState(false);
    const [scripture, setScripture] = useState<ScripturePassage | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPicker, setShowPicker] = useState(false);
    const [pickerStep, setPickerStep] = useState<'book' | 'chapter'>('book');
    const [selectedBook, setSelectedBook] = useState('Genesis');
    const [expandedTestament, setExpandedTestament] = useState<'ot' | 'nt' | null>(null);

    // Version Management State
    const [showVersionsModal, setShowVersionsModal] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<BibleVersion | null>(null);
    const [versionSearchQuery, setVersionSearchQuery] = useState('');
    const [allVersions, setAllVersions] = useState<BibleVersion[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);

    // Verse highlighting and reflection
    const [selectedVerse, setSelectedVerse] = useState<{ number: number; text: string } | null>(null); // For legacy modal ref
    const [showReflectionModal, setShowReflectionModal] = useState(false);
    const [verseReflection, setVerseReflection] = useState('');

    // --- New Highlighting State ---
    const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());
    const [highlights, setHighlights] = useState<VerseHighlight[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // Toast notification state
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [sharePublicly, setSharePublicly] = useState(false);
    const toastAnim = useRef(new Animated.Value(0)).current;

    // --- AI Insights State ---
    const [tldr, setTldr] = useState<string>('');
    const [nuancePrompts, setNuancePrompts] = useState<NuancePrompt[]>([]);
    const [nuanceCache, setNuanceCache] = useState<Record<string, string>>({});
    const [selectedNuance, setSelectedNuance] = useState<string | null>(null);
    const [showNuanceModal, setShowNuanceModal] = useState(false);
    const [nuanceDeepDive, setNuanceDeepDive] = useState<string | null>(null);
    const [loadingDeepDive, setLoadingDeepDive] = useState(false);
    const [expandedNuanceIndex, setExpandedNuanceIndex] = useState<number | null>(null);
    const [generatingNuance, setGeneratingNuance] = useState(false);
    const nuanceSpinAnim = useRef(new Animated.Value(0)).current;
    const nuanceSpinLoopRef = useRef<Animated.CompositeAnimation | null>(null);
    // Expanded TL;DR State
    const [expandedTldr, setExpandedTldr] = useState<string | null>(null);
    const [loadingExpandedTldr, setLoadingExpandedTldr] = useState(false);
    const [showExpandedTldr, setShowExpandedTldr] = useState(false);
    const [isTldrCollapsed, setIsTldrCollapsed] = useState(true); // TLDR starts collapsed
    const [loadingTldr, setLoadingTldr] = useState(false); // Basic TL;DR loading

    // Reflection Modal State
    const [showReflectModal, setShowReflectModal] = useState(false);
    const [modalReflection, setModalReflection] = useState('');
    const [reflectionContext, setReflectionContext] = useState('');

    // Audio Player State
    const [showAudioPlayer, setShowAudioPlayer] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [audioLoading, setAudioLoading] = useState(false);
    const [audioPosition, setAudioPosition] = useState(0); // in milliseconds
    const [audioDuration, setAudioDuration] = useState(0); // in milliseconds
    const audioPlayerAnim = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = visible
    const soundRef = useRef<Audio.Sound | null>(null);

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

    // Immersion mode animations
    const [isScrolled, setIsScrolled] = useState(false);
    const lastScrollY = useRef(0);
    const navOpacity = useRef(new Animated.Value(1)).current;
    const headerHeight = useRef(new Animated.Value(1)).current; // 1 = expanded, 0 = collapsed
    const actionSheetBottom = useRef(new Animated.Value(90)).current; // 90 = above nav bar

    // --- Linkable Verse/Chapter Logic ---
    const versePositions = useRef<{ [key: string]: number }>({});
    const htmlContainerY = useRef(0);
    const lastSeenChapter = useRef(1); // Track current chapter for verse context

    const scrollToRef = (ref: string) => {
        // Handle comma-separated lists: take the first one
        const cleanRef = ref.replace(/[\[\]]/g, '').split(/[,;]\s*/)[0].trim();
        console.log(`[scrollToRef] Original: "${ref}", Clean: "${cleanRef}"`);

        // Parse chapter:verse format (e.g., "5:3-16" or "1:2")
        const cvMatch = cleanRef.match(/(\d+):(\d+)/);
        let chapter: string | undefined;
        let verse: string | undefined;

        if (cvMatch) {
            chapter = cvMatch[1];
            verse = cvMatch[2];
            console.log(`[scrollToRef] Parsed chapter:verse - chapter=${chapter}, verse=${verse}`);
        } else {
            // Try "v.12" format (just verse number)
            const vMatch = cleanRef.match(/v\.?(\d+)/i);
            if (vMatch) {
                verse = vMatch[1];
                chapter = '1'; // Default to chapter 1 when no chapter specified
                console.log(`[scrollToRef] Parsed v.X format - verse=${verse}, defaulting chapter to 1`);
            }
        }

        // On web, use DOM scrollIntoView for reliability
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            // Try to find the verse element first, then fall back to chapter
            const verseId = (chapter && verse) ? `verse-${chapter}-${verse}` : null;
            const chapterId = chapter ? `chapter-${chapter}` : null;
            let element: HTMLElement | null = null;

            // First try verse-level scroll
            if (verseId) {
                element = document.getElementById(verseId);
                console.log(`[scrollToRef] Looking for verse element: ${verseId}, found: ${!!element}`);
            }

            // Fall back to chapter if verse not found
            if (!element && chapterId) {
                element = document.getElementById(chapterId);
                console.log(`[scrollToRef] Fallback to chapter element: ${chapterId}, found: ${!!element}`);
            }

            if (element) {
                // Use scrollIntoView which is most reliable on web
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // After a brief delay, adjust for the fixed header
                setTimeout(() => {
                    window.scrollBy({ top: -100, behavior: 'smooth' });
                }, 100);

                console.log(`[scrollToRef] Scrolled to ${verseId || chapterId}`);
                return;
            }
        }

        // Fallback: Use stored Y positions
        let targetY: number | undefined;

        if (chapter) {
            // Try chapter position
            targetY = versePositions.current[`c${chapter}`];
            console.log(`[scrollToRef] Looking for c${chapter}, found Y: ${targetY}`);
        }

        if (targetY !== undefined && scrollViewRef.current) {
            const scrollY = htmlContainerY.current + targetY - 80;
            console.log(`[scrollToRef] Scrolling to Y=${scrollY} (htmlContainerY=${htmlContainerY.current}, targetY=${targetY})`);
            scrollViewRef.current.scrollTo({ y: scrollY, animated: true });
        } else {
            console.log(`[scrollToRef] Reference ${ref} position not found. Positions:`, Object.keys(versePositions.current));
        }
    };

    // Custom Renderer to capture layout & Ensure Chapter Blocks are Views
    const renderers = useMemo(() => ({
        b: (props: any) => {
            const { TDefaultRenderer, tnode } = props;
            const isChapterNum = tnode.classes?.includes('chapter-num');
            const isVerseNum = tnode.classes?.includes('verse-num');

            // Extract the raw text content
            const rawTextContent = tnode.init?.textNode?.data || tnode.children?.[0]?.init?.textNode?.data || '';

            // Debug logging
            if (tnode.classes && tnode.classes.length > 0) {
                console.log('[Renderer] b tag with classes:', tnode.classes, 'text:', rawTextContent);
            }

            // Parse the chapter number - ESV sometimes uses "5:1" format, extract just the chapter
            const parseChapterNum = (text: string): number => {
                const trimmed = text.trim();
                // Handle "5:1" format - extract the part before the colon
                const match = trimmed.match(/^(\d+)/);
                return match ? parseInt(match[1], 10) : NaN;
            };

            const onLayout = (event: any) => {
                const y = event.nativeEvent.layout.y;
                const num = parseChapterNum(rawTextContent);

                if (!isNaN(num)) {
                    if (isChapterNum) {
                        versePositions.current[`c${num}`] = y;
                        console.log(`[Renderer] Chapter ${num} layout captured at Y=${y}`);
                    } else if (isVerseNum) {
                        versePositions.current[`v${num}`] = y;
                    }
                }
            };

            // For Chapter Numbers: FORCE A VIEW to ensure layout capture and separation
            if (isChapterNum) {
                const chapterNum = parseChapterNum(rawTextContent);
                if (!isNaN(chapterNum)) {
                    lastSeenChapter.current = chapterNum; // Track for verse context
                }
                const chapterId = !isNaN(chapterNum) ? `chapter-${chapterNum}` : `chapter-unknown`;

                return (
                    <View
                        nativeID={chapterId}
                        style={{ marginTop: 24, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}
                    >
                        <Text style={{
                            fontSize: 32,
                            fontFamily: FontFamilies.serifBold,
                            color: Colors.gold,
                            lineHeight: 40
                        }}>
                            {rawTextContent}
                        </Text>
                    </View>
                );
            }

            // For Verse Numbers: render with nativeID including chapter context
            if (isVerseNum) {
                const verseNum = parseChapterNum(rawTextContent);
                if (!isNaN(verseNum)) {
                    const chapter = lastSeenChapter.current;
                    const verseId = `verse-${chapter}-${verseNum}`;
                    const isSelected = selectedVerses.has(verseNum);

                    return (
                        <TouchableOpacity
                            onPress={() => {
                                console.log('[TAP] Verse', verseNum, 'tapped!');
                                toggleVerseSelection(verseNum);
                            }}
                            activeOpacity={0.6}
                            style={{
                                // Web-specific: ensure clickable
                                cursor: 'pointer' as any,
                                paddingVertical: 4,
                                paddingHorizontal: 2,
                            }}
                        >
                            <Text
                                nativeID={verseId}
                                style={{
                                    fontSize: 12,
                                    color: isSelected ? Colors.gold : Colors.mediumGray,
                                    fontWeight: 'bold',
                                    paddingRight: 4,
                                    textDecorationLine: isSelected ? 'underline' : 'none',
                                }}
                            >
                                {rawTextContent}
                            </Text>
                        </TouchableOpacity>
                    );
                }
            }

            return <TDefaultRenderer {...props} />;
        },
        // Helper to make ANY element with data-verse tappable
        // Custom renderer for verse text spans (tappable)
        span: (props: any) => {
            const { TDefaultRenderer, tnode } = props;

            // Get verse number from various sources:
            // 1. data-verse (ESV/our processed HTML)
            // 2. data-number (some API.Bible formats)
            // 3. data-verse-id (API.Bible format: "BOOK.CHAPTER.VERSE" e.g., "2KI.16.1")
            let verseNum = NaN;

            if (tnode.attributes?.['data-verse']) {
                verseNum = parseInt(tnode.attributes['data-verse'], 10);
            } else if (tnode.attributes?.['data-number']) {
                verseNum = parseInt(tnode.attributes['data-number'], 10);
            } else if (tnode.attributes?.['data-verse-id']) {
                // Parse "2KI.16.1" format -> extract last number (verse)
                const verseId = tnode.attributes['data-verse-id'];
                const parts = verseId.split('.');
                if (parts.length >= 3) {
                    verseNum = parseInt(parts[parts.length - 1], 10);
                }
            }

            // Also check for verse-span class (API.Bible)
            const isVerseSpan = tnode.classes?.includes('verse-span');

            // Handle ANY span with a valid verse attribute (covers verse-text, line, and nested spans)
            if (!isNaN(verseNum) && verseNum > 0) {
                const isSelected = selectedVerses.has(verseNum);
                const savedHighlight = highlights.find(h => h.verse === verseNum);
                const highlightColor = savedHighlight?.color;

                return (
                    <Text
                        onPress={() => {
                            console.log('[TAP] Span with verse', verseNum, 'tapped!');
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

            return <TDefaultRenderer {...props} />;
        },
        // Custom renderer for paragraphs with data-verse or data-number (tappable)
        p: (props: any) => {
            const { TDefaultRenderer, tnode } = props;
            const verseNumAttr = tnode.attributes?.['data-verse'] || tnode.attributes?.['data-number'];
            const verseNum = verseNumAttr ? parseInt(verseNumAttr, 10) : NaN;

            if (!isNaN(verseNum) && verseNum > 0) {
                const isSelected = selectedVerses.has(verseNum);
                const savedHighlight = highlights.find(h => h.verse === verseNum);
                const highlightColor = savedHighlight?.color;

                return (
                    <TouchableOpacity
                        onPress={() => {
                            console.log('[TAP] Paragraph with data-verse', verseNum, 'tapped!');
                            toggleVerseSelection(verseNum);
                        }}
                        activeOpacity={0.7}
                        style={{
                            backgroundColor: highlightColor
                                ? highlightColor + '50'
                                : 'transparent',
                        }}
                    >
                        <TDefaultRenderer {...props} />
                    </TouchableOpacity>
                );
            }

            return <TDefaultRenderer {...props} />;
        },
        // Custom renderer for div with data-verse or data-number (tappable)
        div: (props: any) => {
            const { TDefaultRenderer, tnode } = props;
            const verseNumAttr = tnode.attributes?.['data-verse'] || tnode.attributes?.['data-number'];
            const verseNum = verseNumAttr ? parseInt(verseNumAttr, 10) : NaN;

            if (!isNaN(verseNum) && verseNum > 0) {
                const isSelected = selectedVerses.has(verseNum);
                const savedHighlight = highlights.find(h => h.verse === verseNum);
                const highlightColor = savedHighlight?.color;

                return (
                    <TouchableOpacity
                        onPress={() => {
                            console.log('[TAP] Div with data-verse', verseNum, 'tapped!');
                            toggleVerseSelection(verseNum);
                        }}
                        activeOpacity={0.7}
                        style={{
                            backgroundColor: highlightColor
                                ? highlightColor + '50'
                                : 'transparent',
                        }}
                    >
                        <TDefaultRenderer {...props} />
                    </TouchableOpacity>
                );
            }

            return <TDefaultRenderer {...props} />;
        },
        // Custom renderer for italic elements with data-verse or data-number (tappable)
        i: (props: any) => {
            const { TDefaultRenderer, tnode } = props;
            const verseNumAttr = tnode.attributes?.['data-verse'] || tnode.attributes?.['data-number'];
            const verseNum = verseNumAttr ? parseInt(verseNumAttr, 10) : NaN;

            if (!isNaN(verseNum) && verseNum > 0) {
                const isSelected = selectedVerses.has(verseNum);
                const savedHighlight = highlights.find(h => h.verse === verseNum);
                const highlightColor = savedHighlight?.color;

                return (
                    <Text
                        onPress={() => {
                            console.log('[TAP] Italic with data-verse', verseNum, 'tapped!');
                            toggleVerseSelection(verseNum);
                        }}
                        style={{
                            cursor: 'pointer' as any,
                            fontStyle: 'italic',
                            textDecorationLine: isSelected ? 'underline' : 'none',
                            backgroundColor: highlightColor
                                ? highlightColor + '50'
                                : 'transparent',
                        }}
                    >
                        <TDefaultRenderer {...props} />
                    </Text>
                );
            }

            return <TDefaultRenderer {...props} />;
        },
        // Custom renderer for em elements with data-verse or data-number (tappable)
        em: (props: any) => {
            const { TDefaultRenderer, tnode } = props;
            const verseNumAttr = tnode.attributes?.['data-verse'] || tnode.attributes?.['data-number'];
            const verseNum = verseNumAttr ? parseInt(verseNumAttr, 10) : NaN;

            if (!isNaN(verseNum) && verseNum > 0) {
                const isSelected = selectedVerses.has(verseNum);
                const savedHighlight = highlights.find(h => h.verse === verseNum);
                const highlightColor = savedHighlight?.color;

                return (
                    <Text
                        onPress={() => {
                            console.log('[TAP] Em with data-verse', verseNum, 'tapped!');
                            toggleVerseSelection(verseNum);
                        }}
                        style={{
                            cursor: 'pointer' as any,
                            fontStyle: 'italic',
                            textDecorationLine: isSelected ? 'underline' : 'none',
                            backgroundColor: highlightColor
                                ? highlightColor + '50'
                                : 'transparent',
                        }}
                    >
                        <TDefaultRenderer {...props} />
                    </Text>
                );
            }

            return <TDefaultRenderer {...props} />;
        },
        // Custom renderer for strong elements with data-verse or data-number (tappable)
        strong: (props: any) => {
            const { TDefaultRenderer, tnode } = props;
            const verseNumAttr = tnode.attributes?.['data-verse'] || tnode.attributes?.['data-number'];
            const verseNum = verseNumAttr ? parseInt(verseNumAttr, 10) : NaN;

            if (!isNaN(verseNum) && verseNum > 0) {
                const isSelected = selectedVerses.has(verseNum);
                const savedHighlight = highlights.find(h => h.verse === verseNum);
                const highlightColor = savedHighlight?.color;

                return (
                    <Text
                        onPress={() => {
                            console.log('[TAP] Strong with data-verse', verseNum, 'tapped!');
                            toggleVerseSelection(verseNum);
                        }}
                        style={{
                            cursor: 'pointer' as any,
                            fontWeight: 'bold',
                            textDecorationLine: isSelected ? 'underline' : 'none',
                            backgroundColor: highlightColor
                                ? highlightColor + '50'
                                : 'transparent',
                        }}
                    >
                        <TDefaultRenderer {...props} />
                    </Text>
                );
            }

            return <TDefaultRenderer {...props} />;
        },
        // Custom renderer for small elements with data-verse or data-number (tappable)
        small: (props: any) => {
            const { TDefaultRenderer, tnode } = props;
            const verseNumAttr = tnode.attributes?.['data-verse'] || tnode.attributes?.['data-number'];
            const verseNum = verseNumAttr ? parseInt(verseNumAttr, 10) : NaN;

            if (!isNaN(verseNum) && verseNum > 0) {
                const isSelected = selectedVerses.has(verseNum);
                const savedHighlight = highlights.find(h => h.verse === verseNum);
                const highlightColor = savedHighlight?.color;

                return (
                    <Text
                        onPress={() => {
                            console.log('[TAP] Small with data-verse', verseNum, 'tapped!');
                            toggleVerseSelection(verseNum);
                        }}
                        style={{
                            cursor: 'pointer' as any,
                            fontSize: 12,
                            textDecorationLine: isSelected ? 'underline' : 'none',
                            backgroundColor: highlightColor
                                ? highlightColor + '50'
                                : 'transparent',
                        }}
                    >
                        <TDefaultRenderer {...props} />
                    </Text>
                );
            }

            return <TDefaultRenderer {...props} />;
        },
        // Custom renderer for anchor tags (verse links)
        a: (props: any) => {
            const { TDefaultRenderer, tnode } = props;
            const href = tnode.attributes?.href || '';

            // Debug: log every anchor tag that gets rendered
            console.log('[Renderer] Anchor tag rendered with href:', href);

            // Check if this is a verse link
            if (href.startsWith('verse://')) {
                const verseNum = parseInt(href.replace('verse://', ''), 10);
                console.log('[Renderer] Verse link detected! verse:', verseNum);

                if (!isNaN(verseNum) && verseNum > 0) {
                    const isSelected = selectedVerses.has(verseNum);
                    const savedHighlight = highlights.find(h => h.verse === verseNum);
                    const highlightColor = savedHighlight?.color;

                    return (
                        <Text
                            onPress={() => {
                                console.log('[TAP] Verse', verseNum, 'tapped via anchor!');
                                toggleVerseSelection(verseNum);
                            }}
                            style={{
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

            // For non-verse links, use default renderer
            return <TDefaultRenderer {...props} />;
        }
    }), [selectedVerses, highlights, showAudioPlayer]);

    // Helper to process HTML - handles both prose and poetic books
    const processScriptureHtml = (html: string) => {
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

        if (verses.length === 0) {
            console.warn('[processScriptureHtml] No verses found in HTML');
            return html; // Return original if fails (though unlikely with normalization)
        }

        // Check if this is a poetic book (has span.line elements)
        const hasLineSpans = /<span[^>]*\bclass="[^"]*\bline\b[^"]*"[^>]*>/i.test(htmlToUse);

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
            // Use class="verse-text" for potential styling
            result += `<span data-verse="${v.verse}" class="verse-text">${verseText}</span>`;

            lastIndex = textEnd;
        }

        result += htmlToUse.slice(lastIndex);
        return result;
    };

    function renderInteractiveText(text: string) {
        // Regex to catch [Gen 1:1], [Gen 1:1-5], [v.12], [1:1] AND [v.1; v.2]
        // Look for brackets containing digits and colons/dashes/semicolons/dots
        const parts = text.split(/(\[[A-Za-z0-9\s:,\.;-]+\])/g);

        return (
            <Text style={{ fontFamily: FontFamilies.serif, fontSize: 16, lineHeight: 24, color: Colors.charcoal }}>
                {parts.map((part, index) => {
                    // Check if it's a citation
                    const isCitation = /\[.*?\d+.*?\]/.test(part);

                    if (isCitation) {
                        return (
                            <Text
                                key={index}
                                onPress={() => scrollToRef(part)}
                                style={{
                                    color: Colors.gold,
                                    fontWeight: 'bold',
                                    fontSize: 14, // Slightly larger for readability
                                    textDecorationLine: 'underline'
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

    // Font settings state
    const [showFontSettings, setShowFontSettings] = useState(false);
    const [fontSize, setFontSize] = useState<'small' | 'large'>('large');
    const [lineSpacing, setLineSpacing] = useState<0 | 1 | 2>(1); // 0=tight, 1=normal, 2=loose
    const [fontFamily, setFontFamily] = useState<'serif' | 'sans' | 'mono'>('serif');
    const [readingTheme, setReadingTheme] = useState<'cream' | 'sepia' | 'paper' | 'mint' | 'night' | 'dark'>('cream');

    // Reading theme colors
    const READING_THEMES = {
        cream: { bg: '#FAF6F0', text: '#2C2C2C', name: 'Cream' },
        sepia: { bg: '#F5E6D3', text: '#3D2914', name: 'Sepia' },
        paper: { bg: '#FFFFFF', text: '#1A1A1A', name: 'Paper' },
        mint: { bg: '#E8F5E9', text: '#1B4332', name: 'Mint' },
        night: { bg: '#1A1A2E', text: '#E8E8E8', name: 'Night' },
        dark: { bg: '#121212', text: '#F5F5F5', name: 'Dark' },
    };

    // Line spacing options
    const LINE_SPACING_VALUES = [24, 29, 36]; // tight, normal, loose
    const LINE_SPACING_ICONS = ['☰', '≡', '⫾']; // Different icons for each level

    // Font size values
    const FONT_SIZES = { small: 16, large: 20 };

    useEffect(() => {
        async function init() {
            // Only load saved position if no URL params provided
            if (!params.book && !params.chapter) {
                await loadSavedPosition();
            } else {
                setPositionLoaded(true);
            }
            loadVersions();
        }
        init();
    }, []);

    // Update selection mode based on selection
    useEffect(() => {
        setIsSelectionMode(selectedVerses.size > 0);
    }, [selectedVerses]);

    const loadVersions = async () => {
        // Load selected version from storage
        const selected = await BibleVersionsService.getSelectedVersion();
        setCurrentVersion(selected);
    };

    const handleVersionSelect = async (version: BibleVersion) => {
        await BibleVersionsService.setSelectedVersion(version);
        setShowVersionsModal(false);
        // Set version last - this triggers the useEffect that includes currentVersion dependency
        setCurrentVersion(version);
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

    useEffect(() => {
        // If params passed (from deep link or navigation)
        if (params.book && params.chapter) {
            const chapterNum = parseInt(params.chapter, 10);
            if (!isNaN(chapterNum) && chapterNum > 0) {
                setCurrentBook(params.book);
                setCurrentChapter(chapterNum);
            }
        }
    }, [params.book, params.chapter]);

    useEffect(() => {
        if (!positionLoaded) return; // Wait until position is loaded

        // Validate that currentBook is a valid Bible book, otherwise reset to Genesis 1
        const isValidBook = BIBLE_BOOKS.some(b => b.name === currentBook);
        if (!isValidBook || !currentChapter || currentChapter < 1) {
            console.log('[Bible] Invalid book/chapter, resetting to Genesis 1:', { currentBook, currentChapter });
            setCurrentBook('Genesis');
            setCurrentChapter(1);
            return; // Will re-trigger this effect with valid values
        }

        loadScripture();
        savePosition();
    }, [currentBook, currentChapter, positionLoaded, currentVersion]);

    async function loadSavedPosition() {
        try {
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            if (saved) {
                const { book, chapter } = JSON.parse(saved);
                setCurrentBook(book);
                setCurrentChapter(chapter);
            }
        } catch (error) {
            console.error('Error loading Bible position:', error);
        } finally {
            setPositionLoaded(true);
        }
    }

    async function savePosition() {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
                book: currentBook,
                chapter: currentChapter,
            }));
        } catch (error) {
            console.error('Error saving Bible position:', error);
        }
    }

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

    async function handleNuanceSelect(question: string) {
        setSelectedNuance(question);
        setNuanceDeepDive(null);
        setShowNuanceModal(true);

        if (nuanceCache[question]) {
            setNuanceDeepDive(nuanceCache[question]);
            setLoadingDeepDive(false);
            return;
        }

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

    // Generate just the basic TL;DR (short summary)
    async function generateBasicTldr() {
        if (tldr || !scripture?.reference || !scripture?.html) return;

        const cachedBasic = await getCachedTLDR(scripture.reference);
        if (cachedBasic) {
            setTldr(cachedBasic);
            return;
        }

        // Generate and cache basic TL;DR
        setLoadingTldr(true);
        try {
            const basic = await generateTLDR(scripture.reference, scripture.html);
            setTldr(basic);
            await cacheTLDR(scripture.reference, basic);
        } catch (error) {
            console.error("Error generating TL;DR:", error);
            setTldr('Unable to generate summary. Please try again.');
        } finally {
            setLoadingTldr(false);
        }
    }

    // Expand to show the longer, detailed summary
    async function handleExpandTldr() {
        if (showExpandedTldr) {
            setShowExpandedTldr(false);
            return;
        }

        setShowExpandedTldr(true);

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

    // Show toast notification
    function showToast(message: string) {
        setToastMessage(message);
        Animated.sequence([
            Animated.timing(toastAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.delay(2500),
            Animated.timing(toastAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => setToastMessage(null));
    }

    // Open reflection modal with TL;DR as context
    function handleOpenReflectionModal() {
        const context = showExpandedTldr && expandedTldr ? expandedTldr : tldr;
        setReflectionContext(context || '');
        setModalReflection('');
        setShowReflectModal(true);
    }

    // Save reflection from modal
    async function saveReflection() {
        if (!modalReflection.trim()) return;

        try {
            const today = new Date().toISOString().split('T')[0];
            const verseRef = `${currentBook} ${currentChapter}`;
            const verseText = reflectionContext || tldr || '';

            // Save to only ONE location to avoid duplicates
            if (sharePublicly) {
                // Public only - goes to community feed
                try {
                    await publishReflection(
                        verseRef,
                        verseText,
                        modalReflection.trim()
                    );
                } catch (pubError) {
                    console.warn('Failed to publish to community:', pubError);
                }
            } else {
                // Private only - goes to personal journal
                await saveVerseReflection(
                    today,
                    verseRef,
                    verseText,
                    modalReflection.trim()
                );
            }

            setSharePublicly(false);
            setShowReflectModal(false);
            setModalReflection('');

            // Show success feedback
            showToast(sharePublicly ? '✓ Reflection shared to Community' : '✓ Reflection saved to Journal');
        } catch (error) {
            console.error('Error saving reflection:', error);
        }
    }

    async function loadScripture() {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
        setSelectedVerses(new Set());
        setTldr('');
        setExpandedTldr(null);
        setShowExpandedTldr(false);
        setIsTldrCollapsed(true); // Reset to collapsed when loading new chapter
        setNuancePrompts([]);

        const versionId = currentVersion?.abbreviation || 'ESV';

        // Cache version - increment this to bust old cached data when HTML processing changes
        const SCRIPTURE_CACHE_VERSION = 'v4'; // v4: generic API.Bible flattening & click handling
        const cacheKey = `cached_scripture_${SCRIPTURE_CACHE_VERSION}_${versionId}_${currentBook}_${currentChapter}`;

        // One-time SQLite cache clear when version changes (clears OfflineStorageService cache)
        const cacheVersionKey = 'scripture_cache_cleared_version';
        const clearedVersion = await AsyncStorage.getItem(cacheVersionKey);
        if (clearedVersion !== SCRIPTURE_CACHE_VERSION) {
            console.log('[loadScripture] Cache version changed, clearing SQLite scripture cache...');
            try {
                const { OfflineStorageService } = await import('../services/offlineStorage');
                await OfflineStorageService.clearAllCache();
                await AsyncStorage.setItem(cacheVersionKey, SCRIPTURE_CACHE_VERSION);
                console.log('[loadScripture] SQLite cache cleared successfully');
            } catch (clearError) {
                console.warn('[loadScripture] Failed to clear SQLite cache:', clearError);
            }
        }

        try {
            // Try to load cached scripture first for instant display
            const cachedScripture = await AsyncStorage.getItem(cacheKey);
            if (cachedScripture) {
                const { passage, savedHighlights } = JSON.parse(cachedScripture);
                setScripture(passage);
                setHighlights(savedHighlights || []);
                setLoading(false);

                // Check cache for TL;DR
                const cachedTldr = await getCachedTLDR(passage.reference);
                if (cachedTldr) {
                    setTldr(cachedTldr);
                }
                const cachedNuance = await getCachedNuance(passage.reference);
                if (cachedNuance) {
                    setNuancePrompts(cachedNuance);
                }
            } else {
                setLoading(true); // Only show loading if no cache
            }

            // Then refresh from API in background - use version-aware fetching
            const [passage, savedHighlights] = await Promise.all([
                fetchScriptureWithVersion(currentBook, currentChapter, currentVersion),
                getVerseHighlights(currentBook, currentChapter)
            ]);
            setScripture(passage);
            setHighlights(savedHighlights);

            // Cache for next time
            await AsyncStorage.setItem(cacheKey, JSON.stringify({ passage, savedHighlights }));

            // Save last position for restoration
            await AsyncStorage.setItem('last_bible_position', JSON.stringify({ book: currentBook, chapter: currentChapter }));

            // Check cache for TL;DR - don't auto-generate to save API costs
            const cachedTldr = await getCachedTLDR(passage.reference);
            if (cachedTldr) {
                setTldr(cachedTldr);
            }
            // Nuance prompts also from cache only
            const cachedNuance = await getCachedNuance(passage.reference);
            if (cachedNuance) {
                setNuancePrompts(cachedNuance);
            }

        } catch (error) {
            console.error('Error loading scripture or highlights:', error);
        } finally {
            setLoading(false);
        }
    }

    // --- Highlighting Logic ---
    function toggleVerseSelection(verseNum: number) {
        const newSelection = new Set(selectedVerses);
        if (newSelection.has(verseNum)) {
            newSelection.delete(verseNum);
        } else {
            newSelection.add(verseNum);

            // Close audio player when selecting a verse
            if (showAudioPlayer) {
                setShowAudioPlayer(false);
                audioPlayerAnim.setValue(0);
                // Stop audio if playing
                if (soundRef.current) {
                    soundRef.current.pauseAsync();
                }
            }
        }
        setSelectedVerses(newSelection);
    }

    async function applyHighlight(colorHex: string) {
        // Immediately update local state for instant UI feedback
        const newHighlights = [...highlights];
        Array.from(selectedVerses).forEach(verseNum => {
            const existingIndex = newHighlights.findIndex(h => h.verse === verseNum);
            if (existingIndex >= 0) {
                newHighlights[existingIndex] = { ...newHighlights[existingIndex], color: colorHex };
            } else {
                newHighlights.push({ verse: verseNum, color: colorHex, book: currentBook, chapter: currentChapter });
            }
        });
        setHighlights(newHighlights);
        setSelectedVerses(new Set()); // Dismiss the panel after applying highlight

        // Save to database in background (don't await)
        try {
            const promises = Array.from(selectedVerses).map(verseNum => {
                return saveVerseHighlight({
                    book: currentBook,
                    chapter: currentChapter,
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
        // Immediately update local state for instant UI feedback
        const versesToRemove = new Set(selectedVerses);
        const newHighlights = highlights.filter(h => !versesToRemove.has(h.verse));
        setHighlights(newHighlights);
        setSelectedVerses(new Set()); // Clear selection immediately

        // Delete from database in background (don't await)
        try {
            const promises = Array.from(versesToRemove).map(verseNum => {
                return deleteVerseHighlight(currentBook, currentChapter, verseNum);
            });
            Promise.all(promises).catch(e => {
                console.error("Failed to remove highlights from DB", e);
            });
        } catch (e) {
            console.error("Failed to remove highlights", e);
        }
    }

    function handleReflectSelection() {
        // For now, just grab the first selected verse to open the modal
        if (selectedVerses.size > 0) {
            const firstVerseNum = Array.from(selectedVerses).sort((a, b) => a - b)[0];

            // Extract actual verse text from scripture HTML
            let verseText = `Verse ${firstVerseNum}`; // fallback
            if (scripture?.html) {
                try {
                    // Find verse number markers and extract text between them
                    const html = scripture.html;

                    // Pattern to find verse number N
                    const verseStartPattern = new RegExp(
                        `<b[^>]*class="[^"]*(?:verse-num|chapter-num)[^"]*"[^>]*>(?:\\d+:)?${firstVerseNum}[^<]*</b>`,
                        'i'
                    );
                    const startMatch = verseStartPattern.exec(html);

                    if (startMatch) {
                        const startIndex = startMatch.index + startMatch[0].length;

                        // Find the next verse number marker (N+1 or any verse)
                        const nextVersePattern = /<b[^>]*class="[^"]*(?:verse-num|chapter-num)[^"]*"[^>]*>(?:\d+:)?\d+[^<]*<\/b>/i;
                        const remainingHtml = html.slice(startIndex);
                        const endMatch = nextVersePattern.exec(remainingHtml);

                        const verseHtml = endMatch
                            ? remainingHtml.slice(0, endMatch.index)
                            : remainingHtml.slice(0, 500); // Limit if last verse

                        // Strip HTML tags to get plain text
                        verseText = verseHtml
                            .replace(/<[^>]+>/g, ' ')  // Remove tags
                            .replace(/&nbsp;/g, ' ')   // Replace nbsp
                            .replace(/\s+/g, ' ')      // Normalize whitespace
                            .trim();

                        // Limit length for display
                        if (verseText.length > 300) {
                            verseText = verseText.slice(0, 297) + '...';
                        }
                    }
                } catch (e) {
                    console.error('Error extracting verse text:', e);
                }
            }

            setSelectedVerse({ number: firstVerseNum, text: verseText });
            setShowReflectionModal(true);
            setVerseReflection('');
            // Optionally clear Selection Mode
            setSelectedVerses(new Set());
        }
    }

    async function handleShareSelection() {
        if (selectedVerses.size === 0) return;

        try {
            // Get verse numbers sorted
            const verseNums = Array.from(selectedVerses).sort((a, b) => a - b);

            // Format verse reference
            let verseRef: string;
            if (verseNums.length === 1) {
                verseRef = `${currentBook} ${currentChapter}:${verseNums[0]}`;
            } else if (verseNums[verseNums.length - 1] - verseNums[0] === verseNums.length - 1) {
                // Consecutive verses
                verseRef = `${currentBook} ${currentChapter}:${verseNums[0]}-${verseNums[verseNums.length - 1]}`;
            } else {
                // Non-consecutive
                verseRef = `${currentBook} ${currentChapter}:${verseNums.join(', ')}`;
            }

            // Extract verse text from scripture HTML
            let verseText = '';
            if (scripture?.html) {
                const html = scripture.html;
                // Extract text for each selected verse
                verseNums.forEach(vNum => {
                    // Find verse text using regex - handles various ESV HTML formats
                    const versePattern = new RegExp(`data-verse="${vNum}"[^>]*>([^<]*)`, 'g');
                    let match;
                    while ((match = versePattern.exec(html)) !== null) {
                        if (match[1].trim()) {
                            verseText += match[1].trim() + ' ';
                        }
                    }
                });
            }

            // Clean up the text
            verseText = verseText.replace(/\s+/g, ' ').trim();

            // If we couldn't extract text, use a simpler message
            const shareMessage = verseText
                ? `"${verseText}"\n\n— ${verseRef} (ESV)`
                : `${verseRef} (ESV)\n\nRead this passage in Cheshbon Reflections!`;

            await Share.share({
                message: shareMessage,
            });

            // Clear selection after sharing
            setSelectedVerses(new Set());
        } catch (error) {
            console.error('Error sharing verse:', error);
        }
    }

    function handleSaveReflection() {
        // This is called from inside the modal
        if (!selectedVerse) return;

        const verseRef = `${currentBook} ${currentChapter}:${selectedVerse.number}`;
        const today = new Date().toISOString().split('T')[0];

        // Save to only ONE location to avoid duplicates
        const saveAction = sharePublicly
            ? publishReflection(verseRef, selectedVerse.text, verseReflection)
            : saveVerseReflection(today, verseRef, selectedVerse.text, verseReflection);

        saveAction.then(() => {
            showToast(sharePublicly ? '✓ Reflection shared to Community' : '✓ Reflection saved to Journal');
            setSharePublicly(false);
            setShowReflectionModal(false);
            setSelectedVerse(null);
        }).catch(err => {
            console.error(err);
            showToast('Failed to save reflection');
        });
    }

    // ... Navigation Handlers (Unchanged)
    function handlePreviousChapter() {
        const bookData = BIBLE_BOOKS.find(b => b.name === currentBook);
        const bookIndex = BIBLE_BOOKS.findIndex(b => b.name === currentBook);

        if (currentChapter > 1) {
            setCurrentChapter(currentChapter - 1);
        } else if (bookIndex > 0) {
            const prevBook = BIBLE_BOOKS[bookIndex - 1];
            setCurrentBook(prevBook.name);
            setCurrentChapter(prevBook.chapters);
        }
    }

    function handleNextChapter() {
        const bookData = BIBLE_BOOKS.find(b => b.name === currentBook);
        const bookIndex = BIBLE_BOOKS.findIndex(b => b.name === currentBook);

        if (bookData && currentChapter < bookData.chapters) {
            setCurrentChapter(currentChapter + 1);
        } else if (bookIndex < BIBLE_BOOKS.length - 1) {
            const nextBook = BIBLE_BOOKS[bookIndex + 1];
            setCurrentBook(nextBook.name);
            setCurrentChapter(1);
        }
    }

    function handleBookSelect(book: string) {
        setSelectedBook(book);
        setPickerStep('chapter');
    }

    function handleChapterSelect(chapter: number) {
        setCurrentBook(selectedBook);
        setCurrentChapter(chapter);
        setShowPicker(false);
        setPickerStep('book');
    }

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

    async function loadAndPlayAudio() {
        try {
            setAudioLoading(true);

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
            const audioUrl = getAudioUrl(currentBook, currentChapter);
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

    // Cleanup audio when chapter changes
    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, [currentBook, currentChapter]);

    function handleScroll(event: any) {
        const currentY = event.nativeEvent.contentOffset.y;
        const diff = currentY - lastScrollY.current;
        const contentHeight = event.nativeEvent.contentSize.height;
        const layoutHeight = event.nativeEvent.layoutMeasurement.height;
        const distanceFromBottom = contentHeight - layoutHeight - currentY;

        // Show nav when near bottom of content (within 50px)
        if (distanceFromBottom < 50 && isScrolled) {
            setIsScrolled(false);
            Animated.parallel([
                Animated.timing(navOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.timing(headerHeight, { toValue: 1, duration: 200, useNativeDriver: false }),
                Animated.timing(actionSheetBottom, { toValue: 90, duration: 200, useNativeDriver: false }),
            ]).start();
        } else if (diff > 10 && !isScrolled && currentY > 50 && distanceFromBottom > 100) {
            setIsScrolled(true);
            Animated.parallel([
                Animated.timing(navOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
                Animated.timing(headerHeight, { toValue: 0, duration: 250, useNativeDriver: false }),
                Animated.timing(actionSheetBottom, { toValue: 20, duration: 250, useNativeDriver: false }),
            ]).start();
        } else if (diff < -10 && isScrolled) {
            setIsScrolled(false);
            Animated.parallel([
                Animated.timing(navOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.timing(headerHeight, { toValue: 1, duration: 200, useNativeDriver: false }),
                Animated.timing(actionSheetBottom, { toValue: 90, duration: 200, useNativeDriver: false }),
            ]).start();
        }
        lastScrollY.current = currentY;
    }

    const bookData = BIBLE_BOOKS.find(b => b.name === currentBook);
    const bookIndex = BIBLE_BOOKS.findIndex(b => b.name === currentBook);
    const canGoPrevious = currentChapter > 1 || bookIndex > 0;
    const canGoNext = (bookData && currentChapter < bookData.chapters) || bookIndex < BIBLE_BOOKS.length - 1;

    // Get reading theme colors
    const currentTheme = READING_THEMES[readingTheme];
    const readerBg = currentTheme.bg;
    const readerText = currentTheme.text;

    const dynamicStyles = {
        container: { backgroundColor: readerBg },
        header: {
            backgroundColor: readerBg,
            borderBottomColor: isScrolled ? colors.gold : 'transparent',
        },
        text: { color: readerText },
        textSecondary: { color: colors.textSecondary },
        scripture: {
            fontSize: FONT_SIZES[fontSize],
            lineHeight: LINE_SPACING_VALUES[lineSpacing],
            fontFamily: fontFamily === 'serif' ? FontFamilies.serif : fontFamily === 'sans' ? FontFamilies.sans : 'monospace',
            color: readerText,
        },
    };

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <Animated.View style={[
                styles.header,
                dynamicStyles.header,
                { paddingBottom: headerHeight.interpolate({ inputRange: [0, 1], outputRange: [8, 12] }) }
            ]}>
                <View style={styles.headerToolbar}>

                    <View style={styles.headerPills}>
                        <TouchableOpacity
                            style={[styles.headerPill, { backgroundColor: isDarkMode ? '#333' : '#E8E4DF' }]}
                            onPress={() => { setShowPicker(true); setPickerStep('book'); setSelectedBook(currentBook); }}
                            activeOpacity={0.7}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.headerPillText, { color: colors.text }]}>{currentBook} {currentChapter}</Text>
                                {scripture?.isCached && <Text style={{ marginLeft: 6, fontSize: 14 }}>☁️</Text>}
                            </View>
                        </TouchableOpacity>

                        <Text style={[styles.pillDivider, { color: colors.textSecondary }]}>|</Text>

                        <TouchableOpacity
                            style={[styles.headerPill, styles.versionPillCompact, { backgroundColor: isDarkMode ? '#333' : '#E8E4DF' }]}
                            onPress={() => setShowVersionsModal(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.headerPillText, { color: colors.text }]}>{currentVersion?.abbreviation || 'ESV'}</Text>
                        </TouchableOpacity>
                    </View>

                    <Animated.View style={[styles.headerActions, { opacity: headerHeight, width: headerHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 80] }) }]}>
                        {/* Audio only available for ESV */}
                        {(currentVersion?.abbreviation === 'ESV' || !currentVersion) && (
                            <TouchableOpacity style={styles.headerIconButton} onPress={toggleAudioPlayer}>
                                <Text style={[styles.headerIcon, { color: showAudioPlayer ? Colors.gold : colors.text }]}>🔊</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.headerIconButton} onPress={() => setShowFontSettings(true)}>
                            <Text style={[styles.headerIcon, { color: colors.text }]}>Aa</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Animated.View>

            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={Colors.gold} />
                        <Typography variant="body" color={Colors.mediumGray} style={{ marginTop: Spacing.md }}>Loading scripture...</Typography>
                    </View>
                ) : scripture?.html ? (
                    <View>
                        {/* TL;DR Section - Collapsible */}
                        <View style={{ marginBottom: Spacing.xl, padding: Spacing.md, backgroundColor: '#FFF9E6', borderLeftWidth: 4, borderLeftColor: Colors.gold, borderRadius: 4 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    const wasCollapsed = isTldrCollapsed;
                                    setIsTldrCollapsed(!isTldrCollapsed);
                                    // When opening, trigger basic TL;DR generation if not cached
                                    if (wasCollapsed && !tldr) {
                                        generateBasicTldr();
                                    }
                                }}
                                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <Typography variant="caption" color={Colors.gold} style={{ fontWeight: 'bold' }}>
                                    📖 TL;DR
                                </Typography>
                                <Typography variant="caption" color={Colors.gold} style={{ fontWeight: 'bold' }}>
                                    {isTldrCollapsed ? '▾' : '▴'}
                                </Typography>
                            </TouchableOpacity>

                            {/* Content - only shown when expanded */}
                            {!isTldrCollapsed && (
                                <>
                                    {/* Basic TL;DR - always shown when section is open */}
                                    <View style={{ marginTop: Spacing.xs }}>
                                        {loadingTldr ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <ActivityIndicator size="small" color={Colors.gold} />
                                                <Typography variant="body" color={Colors.charcoal} style={{ fontStyle: 'italic' }}>
                                                    Generating summary...
                                                </Typography>
                                            </View>
                                        ) : (
                                            renderInteractiveText(tldr || 'Click to generate summary')
                                        )}
                                    </View>

                                    {/* Expand/Collapse button */}
                                    {tldr && !loadingExpandedTldr && (
                                        <TouchableOpacity onPress={handleExpandTldr} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                                            <Typography variant="caption" color={Colors.gold} style={{ fontWeight: 'bold' }}>
                                                {showExpandedTldr ? 'Show Less ▴' : 'Expand Summary ▾'}
                                            </Typography>
                                        </TouchableOpacity>
                                    )}

                                    {/* Loading indicator for expanded content - shows below short summary */}
                                    {loadingExpandedTldr && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.gold + '40' }}>
                                            <ActivityIndicator size="small" color={Colors.gold} />
                                            <Typography variant="body" color={Colors.charcoal} style={{ fontStyle: 'italic' }}>
                                                Generating deeper insights...
                                            </Typography>
                                        </View>
                                    )}

                                    {/* Expanded TL;DR - shows below short summary when expanded */}
                                    {showExpandedTldr && expandedTldr && (
                                        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.gold + '40' }}>
                                            <Typography variant="caption" color={Colors.gold} style={{ fontWeight: 'bold', marginBottom: 8 }}>
                                                📚 Deeper Dive
                                            </Typography>
                                            {renderInteractiveText(expandedTldr)}
                                        </View>
                                    )}

                                    {/* Reflect Button - placed after summary, before contemplation points */}
                                    {tldr && (
                                        <TouchableOpacity
                                            onPress={handleOpenReflectionModal}
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

                                    {/* Points of Contemplation */}
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
                                                                                    router.push({
                                                                                        pathname: '/journal',
                                                                                        params: {
                                                                                            reference: scripture?.reference || `${currentBook} ${currentChapter}`,
                                                                                            prompt: `Contemplation: ${point.title}\n\n${point.description}`,
                                                                                            planId: ''
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
                        </View>


                        <View onLayout={(e) => htmlContainerY.current = e.nativeEvent.layout.y}>
                            <RenderHTML
                                key={`scripture-${fontSize}-${lineSpacing}`}
                                contentWidth={300}
                                source={{ html: processScriptureHtml(scripture.html) }}
                                classesStyles={scriptureClassesStyles}
                                tagsStyles={scriptureTagStyles as any}
                                renderers={renderers}
                                baseStyle={{
                                    fontFamily: FontFamilies.serif,
                                    fontSize: FONT_SIZES[fontSize],
                                    lineHeight: LINE_SPACING_VALUES[lineSpacing],
                                    color: readerText,
                                }}
                            />
                        </View>
                    </View>
                ) : (
                    <Typography variant="body" color={Colors.mediumGray}>Unable to load scripture.</Typography>
                )}

                {/* Bottom spacer for tab bar */}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Highlight Action Sheet (Shows when verses are selected) */}
            {selectedVerses.size > 0 && (
                <Animated.View style={[styles.actionSheetContainer, { bottom: actionSheetBottom }]}>
                    <View style={styles.actionSheetContent}>
                        {/* Drag Handle - tap to dismiss */}
                        <TouchableOpacity
                            style={styles.dragHandleContainer}
                            onPress={() => setSelectedVerses(new Set())}
                        >
                            <View style={styles.dragHandle} />
                        </TouchableOpacity>
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
            )}


            {/* Floating Scripture Navigation - Only render when not scrolled to avoid touch blocking */}
            {!loading && selectedVerses.size === 0 && !showPicker && !isScrolled && (
                <>
                    {/* Left arrow - positioned at left edge */}
                    <Animated.View style={[{ position: 'absolute', bottom: 100, left: 16, zIndex: 100 }, { opacity: navOpacity }]}>
                        <TouchableOpacity
                            style={[styles.floatingNavButtonEdge, !canGoPrevious && styles.floatingNavButtonDisabled]}
                            onPress={handlePreviousChapter}
                            disabled={!canGoPrevious}
                        >
                            <Typography variant="h3" color={canGoPrevious ? Colors.charcoal : Colors.lightGray}>‹</Typography>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Right arrow - positioned at right edge */}
                    <Animated.View style={[{ position: 'absolute', bottom: 100, right: 16, zIndex: 100 }, { opacity: navOpacity }]}>
                        <TouchableOpacity
                            style={[styles.floatingNavButtonEdge, !canGoNext && styles.floatingNavButtonDisabled]}
                            onPress={handleNextChapter}
                            disabled={!canGoNext}
                        >
                            <Typography variant="h3" color={canGoNext ? Colors.charcoal : Colors.lightGray}>›</Typography>
                        </TouchableOpacity>
                    </Animated.View>
                </>
            )}

            {/* Audio Player Panel - Slides up from bottom, shifts down and minimizes when scrolling */}
            <Animated.View
                style={[
                    styles.audioPlayerPanel,
                    {
                        // Dynamic bottom position: when scrolled, move to bottom edge
                        bottom: isScrolled ? 20 : 80,
                        // Minimize padding when scrolled
                        paddingTop: isScrolled ? 12 : 20,
                        paddingBottom: isScrolled ? 16 : 24,
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
                {!isScrolled && (
                    <View style={styles.audioVersionInfo}>
                        <Text style={styles.audioVersionTitle}>
                            {currentBook} {currentChapter}
                        </Text>
                        <View style={styles.audioCopyright}>
                            <Text style={styles.audioCopyrightText}>ESV Audio (David Cochran Heath) © Crossway</Text>
                            <TouchableOpacity style={styles.audioInfoIcon}>
                                <Text style={{ color: Colors.mediumGray, fontSize: 14 }}>ⓘ</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Transport Controls */}
                <View style={styles.audioTransportControls}>
                    <TouchableOpacity style={styles.audioSecondaryButton} onPress={() => seekAudio(-10)}>
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

                    <TouchableOpacity style={styles.audioSecondaryButton} onPress={() => seekAudio(10)}>
                        <View style={styles.audioForwardIcon}>
                            <Text style={{ color: Colors.charcoal, fontSize: 24 }}>▶▶</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Progress Bar */}
                <View style={styles.audioProgressContainer}>
                    <Text style={styles.audioTimeText}>{formatTime(audioPosition)}</Text>
                    <View style={styles.audioProgressBar}>
                        <View style={[styles.audioProgressTrack, { width: audioDuration > 0 ? `${(audioPosition / audioDuration) * 100}%` : '0%' }]} />
                        <View style={[styles.audioProgressThumb, { left: audioDuration > 0 ? `${(audioPosition / audioDuration) * 100}%` : 0 }]} />
                    </View>
                    <Text style={[styles.audioTimeText, { textAlign: 'right' }]}>{formatTime(audioDuration)}</Text>
                </View>

                {/* Bottom Controls - Hidden when scrolled for minimal mode */}
                {!isScrolled && (
                    <View style={styles.audioBottomControls}>
                        <TouchableOpacity style={styles.audioSpeedButton} onPress={cyclePlaybackSpeed}>
                            <Text style={styles.audioSpeedText}>{playbackSpeed}x</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.audioShowControlsButton}>
                            <Text style={{ color: Colors.charcoal, fontSize: 12, marginRight: 4 }}>👁</Text>
                            <Text style={styles.audioShowControlsText}>Show Controls</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.audioSleepButton} onPress={() => alert('Sleep timer coming soon!')}>
                            <Text style={{ color: Colors.charcoal, fontSize: 20 }}>⏱</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </Animated.View>

            <Animated.View style={[styles.bottomNavContainer, { opacity: navOpacity }]}>
                <BottomNav />
            </Animated.View>


            {/* Picking Modal */}
            {showPicker && (
                <View style={styles.pickerOverlay}>
                    <TouchableOpacity style={styles.pickerBackdrop} onPress={() => { setShowPicker(false); setPickerStep('book'); }} />
                    <View style={styles.pickerContainer}>
                        <View style={styles.pickerHeader}>
                            <Typography variant="h3">{pickerStep === 'book' ? 'Select Book' : `${selectedBook} - Select Chapter`}</Typography>
                            {pickerStep === 'chapter' && <TouchableOpacity onPress={() => setPickerStep('book')}><Typography variant="body" color={Colors.gold}>← Back</Typography></TouchableOpacity>}
                        </View>
                        <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                            {pickerStep === 'book' ? (
                                <>
                                    <TouchableOpacity style={styles.testamentHeader} onPress={() => setExpandedTestament(expandedTestament === 'ot' ? null : 'ot')}>
                                        <View style={styles.testamentTitleRow}>
                                            <Typography variant="h3" color={Colors.gold}>Old Testament</Typography>
                                            <Typography variant="caption" color={Colors.mediumGray}>39 books</Typography>
                                        </View>
                                        <Typography variant="h3" color={Colors.gold}>{expandedTestament === 'ot' ? '▲' : '▼'}</Typography>
                                    </TouchableOpacity>
                                    {expandedTestament === 'ot' && <View style={styles.bookGrid}>{OLD_TESTAMENT.map((book) => (<TouchableOpacity key={book.name} style={[styles.bookButton, book.name === currentBook && styles.bookButtonActive]} onPress={() => handleBookSelect(book.name)}><Typography variant="caption" color={book.name === currentBook ? Colors.white : Colors.charcoal} style={styles.bookButtonText}>{book.name}</Typography></TouchableOpacity>))}</View>}

                                    <TouchableOpacity style={[styles.testamentHeader, { marginTop: Spacing.md }]} onPress={() => setExpandedTestament(expandedTestament === 'nt' ? null : 'nt')}>
                                        <View style={styles.testamentTitleRow}>
                                            <Typography variant="h3" color={Colors.gold}>New Testament</Typography>
                                            <Typography variant="caption" color={Colors.mediumGray}>27 books</Typography>
                                        </View>
                                        <Typography variant="h3" color={Colors.gold}>{expandedTestament === 'nt' ? '▲' : '▼'}</Typography>
                                    </TouchableOpacity>
                                    {expandedTestament === 'nt' && <View style={styles.bookGrid}>{NEW_TESTAMENT.map((book) => (<TouchableOpacity key={book.name} style={[styles.bookButton, book.name === currentBook && styles.bookButtonActive]} onPress={() => handleBookSelect(book.name)}><Typography variant="caption" color={book.name === currentBook ? Colors.white : Colors.charcoal} style={styles.bookButtonText}>{book.name}</Typography></TouchableOpacity>))}</View>}
                                </>
                            ) : (
                                <View style={styles.chapterGrid}>
                                    {Array.from({ length: BIBLE_BOOKS.find(b => b.name === selectedBook)?.chapters || 0 }, (_, i) => i + 1).map((ch) => (
                                        <TouchableOpacity key={ch} style={[styles.chapterButton, ch === currentChapter && selectedBook === currentBook && styles.chapterButtonActive]} onPress={() => handleChapterSelect(ch)}>
                                            <Typography variant="body" color={ch === currentChapter && selectedBook === currentBook ? Colors.white : Colors.charcoal}>{ch}</Typography>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            )}

            {/* Nuance Deep Dive Modal */}
            <Modal visible={showNuanceModal} transparent animationType="slide" onRequestClose={() => setShowNuanceModal(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowNuanceModal(false)} />
                    <View style={styles.reflectionModal}>
                        <View style={styles.modalHeader}>
                            <Typography variant="h3" style={{ flex: 1, marginRight: 16 }}>{selectedNuance}</Typography>
                            <TouchableOpacity onPress={() => setShowNuanceModal(false)}>
                                <Typography variant="h3" color={Colors.mediumGray}>✕</Typography>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 300, marginBottom: 16 }} showsVerticalScrollIndicator={true}>
                            {loadingDeepDive ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color={Colors.gold} />
                                    <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: 8 }}>Consulting insights...</Typography>
                                </View>
                            ) : (
                                <Typography variant="body" style={{ color: Colors.charcoal, lineHeight: 24 }}>
                                    {nuanceDeepDive || 'Unable to load insight.'}
                                </Typography>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Verse Reflection Modal - Using shared component */}
            <ReflectionModal
                visible={showReflectionModal}
                onClose={() => { setShowReflectionModal(false); setSelectedVerse(null); setSharePublicly(false); }}
                onSave={handleSaveReflection}
                verseNumber={selectedVerse?.number || ''}
                verseText={selectedVerse?.text || ''}
                verseReference={`${currentBook} ${currentChapter}:${selectedVerse?.number}`}
                reflectionValue={verseReflection}
                onReflectionChange={setVerseReflection}
                sharePublicly={sharePublicly}
                onShareChange={setSharePublicly}
            />

            {/* Font Settings Modal - Premium Design */}
            <Modal visible={showFontSettings} animationType="fade" transparent={true} onRequestClose={() => setShowFontSettings(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        activeOpacity={1}
                        onPress={() => setShowFontSettings(false)}
                    />
                    <View style={{
                        backgroundColor: isDarkMode ? '#1a1a1a' : Colors.cream,
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
                            <View style={{ width: 40, height: 4, backgroundColor: isDarkMode ? '#555' : Colors.mediumGray, borderRadius: 2 }} />
                        </View>

                        {/* Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <Typography variant="h3" style={{ fontFamily: FontFamilies.serif, color: colors.text }}>
                                Reading Settings
                            </Typography>
                            <TouchableOpacity onPress={() => setShowFontSettings(false)}>
                                <Text style={{ fontSize: 24, color: Colors.mediumGray }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Text Size Section */}
                        <View style={{ marginBottom: 24 }}>
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
                                        backgroundColor: fontSize === 'small' ? Colors.gold : (isDarkMode ? '#2a2a2a' : '#F5F0E8'),
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 2,
                                        borderColor: fontSize === 'small' ? Colors.gold : 'transparent',
                                    }}
                                >
                                    <Text style={{
                                        fontSize: 18,
                                        fontFamily: FontFamilies.serif,
                                        color: fontSize === 'small' ? Colors.white : colors.text,
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
                                        backgroundColor: fontSize === 'large' ? Colors.gold : (isDarkMode ? '#2a2a2a' : '#F5F0E8'),
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 2,
                                        borderColor: fontSize === 'large' ? Colors.gold : 'transparent',
                                    }}
                                >
                                    <Text style={{
                                        fontSize: 24,
                                        fontFamily: FontFamilies.serif,
                                        color: fontSize === 'large' ? Colors.white : colors.text,
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
                        <View style={{ marginBottom: 24 }}>
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
                                            backgroundColor: lineSpacing === index ? Colors.gold : (isDarkMode ? '#2a2a2a' : '#F5F0E8'),
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderWidth: 2,
                                            borderColor: lineSpacing === index ? Colors.gold : 'transparent',
                                        }}
                                    >
                                        <View style={{ marginBottom: 6 }}>
                                            <View style={{ width: 24, height: 2, backgroundColor: lineSpacing === index ? Colors.white : colors.text, marginBottom: index === 0 ? 3 : index === 1 ? 5 : 7, borderRadius: 1 }} />
                                            <View style={{ width: 18, height: 2, backgroundColor: lineSpacing === index ? Colors.white : colors.text, marginBottom: index === 0 ? 3 : index === 1 ? 5 : 7, borderRadius: 1 }} />
                                            <View style={{ width: 22, height: 2, backgroundColor: lineSpacing === index ? Colors.white : colors.text, borderRadius: 1 }} />
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
                            backgroundColor: isDarkMode ? '#2a2a2a' : '#F5F0E8',
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
                                color: colors.text,
                            }}>
                                In the beginning God created the heavens and the earth.
                            </Text>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Bible Version Selection Modal */}
            <Modal visible={showVersionsModal} animationType="slide" transparent={true} onRequestClose={() => setShowVersionsModal(false)}>
                <View style={styles.fontSettingsOverlay}>
                    <TouchableOpacity style={styles.fontSettingsBackdrop} onPress={() => setShowVersionsModal(false)} activeOpacity={1} />
                    <View style={[styles.fontSettingsModal, { backgroundColor: isDarkMode ? '#1E1E1E' : '#F5F5F5', maxHeight: '80%' }]}>
                        <View style={styles.fontSettingsDragHandle}>
                            <View style={[styles.dragHandleBar, { backgroundColor: isDarkMode ? '#666' : '#CCC' }]} />
                        </View>

                        {/* Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, paddingHorizontal: Spacing.md }}>
                            <Typography variant="h3" color={colors.text}>Select Translation</Typography>
                            <TouchableOpacity onPress={() => setShowVersionsModal(false)}>
                                <Text style={{ fontSize: 24, color: Colors.mediumGray }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        <View style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.md }}>
                            <TextInput
                                style={{
                                    backgroundColor: isDarkMode ? '#333' : '#E8E4DF',
                                    borderRadius: 8,
                                    padding: Spacing.sm,
                                    color: colors.text,
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
                                    <Typography variant="caption" color={Colors.mediumGray} style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.sm }}>
                                        Search Results
                                    </Typography>
                                    {loadingVersions ? (
                                        <ActivityIndicator size="small" color={Colors.gold} style={{ marginVertical: Spacing.lg }} />
                                    ) : allVersions.length === 0 ? (
                                        <Typography variant="body" color={Colors.mediumGray} style={{ paddingHorizontal: Spacing.md, textAlign: 'center' }}>
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
                                                    borderBottomColor: isDarkMode ? '#333' : '#E8E4DF',
                                                    backgroundColor: currentVersion?.id === version.id ? (isDarkMode ? '#333' : '#E8E4DF') : 'transparent',
                                                }}
                                                onPress={() => handleVersionSelect(version)}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        <Typography variant="body" color={colors.text} style={{ fontWeight: '600' }}>
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
                                    <Typography variant="caption" color={Colors.mediumGray} style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.sm }}>
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
                                                borderBottomColor: isDarkMode ? '#333' : '#E8E4DF',
                                                backgroundColor: currentVersion?.id === version.id ? (isDarkMode ? '#333' : '#E8E4DF') : 'transparent',
                                            }}
                                            onPress={() => handleVersionSelect(version)}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Typography variant="body" color={colors.text} style={{ fontWeight: '600' }}>
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

            {/* Quick Reflection Modal */}
            <Modal
                visible={showReflectModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowReflectModal(false)}
            >
                <View style={styles.reflectModalOverlay}>
                    <View style={styles.reflectModalContent}>
                        {/* Header */}
                        <View style={styles.reflectModalHeader}>
                            <Typography variant="h3" style={{ flex: 1 }}>Quick Reflection</Typography>
                            <TouchableOpacity onPress={() => setShowReflectModal(false)}>
                                <Text style={{ fontSize: 24, color: Colors.mediumGray }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Context Card */}
                        <View style={styles.reflectModalContext}>
                            <Typography variant="caption" color={Colors.gold} style={{ fontWeight: 'bold', marginBottom: 4 }}>
                                📖 {currentBook} {currentChapter}
                            </Typography>
                            <ScrollView style={{ maxHeight: 100 }} nestedScrollEnabled>
                                <Typography variant="caption" color={Colors.mediumGray} style={{ fontStyle: 'italic' }}>
                                    {reflectionContext || 'No context available'}
                                </Typography>
                            </ScrollView>
                        </View>

                        {/* Reflection Input */}
                        <TextInput
                            style={styles.reflectModalInput}
                            placeholder="What stood out to you from this summary?"
                            placeholderTextColor={Colors.mediumGray}
                            multiline
                            textAlignVertical="top"
                            value={modalReflection}
                            onChangeText={setModalReflection}
                        />

                        {/* Share Toggle */}
                        <TouchableOpacity
                            onPress={() => setSharePublicly(!sharePublicly)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.md }}
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

                        {/* Save Button */}
                        <TouchableOpacity
                            style={[
                                styles.reflectModalSaveButton,
                                !modalReflection.trim() && styles.reflectModalSaveDisabled
                            ]}
                            onPress={saveReflection}
                            disabled={!modalReflection.trim()}
                        >
                            <Typography variant="body" color={modalReflection.trim() ? Colors.white : Colors.mediumGray}>
                                {sharePublicly ? 'Save & Share' : 'Save Reflection'}
                            </Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Toast Notification */}
            {toastMessage && (
                <Animated.View
                    style={[
                        styles.toast,
                        {
                            opacity: toastAnim,
                            transform: [{
                                translateY: toastAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-50, 0]
                                })
                            }]
                        }
                    ]}
                    pointerEvents="none"
                >
                    <Text style={styles.toastText}>{toastMessage}</Text>
                </Animated.View>
            )}
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingTop: Platform.OS === 'ios' ? 50 : 20, borderBottomWidth: 1 },
    headerToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, height: 44 },
    headerPills: { flexDirection: 'row', alignItems: 'center' },
    headerPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginHorizontal: 4, flexDirection: 'row', alignItems: 'center' },
    headerPillText: { fontSize: 14, fontWeight: '600', fontFamily: FontFamilies.sans },
    pillDivider: { marginHorizontal: 4, fontSize: 16, opacity: 0.5 },
    versionPillCompact: { paddingHorizontal: 8 },
    headerIcon: { fontSize: 22 },
    headerIconButton: { padding: 8 },
    headerActions: { flexDirection: 'row', justifyContent: 'flex-end' },
    scrollView: { flex: 1, paddingTop: Platform.OS === 'ios' ? 90 : 60 },
    content: { padding: Spacing.lg, paddingBottom: 120 },
    loadingContainer: { padding: Spacing.xl, alignItems: 'center', justifyContent: 'center' },
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
    sectionHeading: { fontSize: 18, fontWeight: 'bold', fontFamily: FontFamilies.sans, textAlign: 'center', opacity: 0.8 },
    verseSelected: { textDecorationLine: 'underline', textDecorationStyle: 'dashed', textDecorationColor: Colors.gold },
    verseNumber: {
        fontSize: 10,
        fontWeight: 'bold',
        color: Colors.gold,
        marginRight: 2,
        textAlignVertical: 'top', // Android
        lineHeight: 18,
        // Hack to simulate superscript in standard Text flow
        position: 'relative',
        top: -4
    },
    verseTextInline: {},
    navArrows: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xl, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', marginTop: Spacing.xl },
    arrowButton: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
    arrowDisabled: { opacity: 0.3 },
    bottomNavContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    pickerOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 50 },
    pickerBackdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
    pickerContainer: { position: 'absolute', top: 100, bottom: 0, left: 0, right: 0, backgroundColor: Colors.cream, borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 },
    pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    pickerScroll: { flex: 1, padding: Spacing.lg },
    testamentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, backgroundColor: 'rgba(212, 163, 115, 0.1)', paddingHorizontal: Spacing.md, borderRadius: 8 },
    testamentTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    bookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: Spacing.md },
    bookButton: { width: '31%', paddingVertical: 12, paddingHorizontal: 4, borderRadius: 8, backgroundColor: Colors.white, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', alignItems: 'center' },
    bookButtonActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
    bookButtonText: { textAlign: 'center', fontWeight: '500' },
    chapterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-start' },
    chapterButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.white, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
    chapterButtonActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
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
    // Action Sheet & Highlight
    actionSheetContainer: { position: 'absolute', bottom: 100, left: 20, right: 20, alignItems: 'center', zIndex: 200 },
    actionSheetContent: { backgroundColor: Colors.cream, borderRadius: 16, padding: Spacing.md, width: '100%', maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    dragHandleContainer: { alignItems: 'center', paddingVertical: 8, marginBottom: 4 },
    dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCC' },
    swatchRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.md },
    colorSwatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
    colorSwatchActive: { borderWidth: 3, borderColor: 'rgba(0,0,0,0.4)' },
    actionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
    sheetButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
    verticalDivider: { width: 1, height: 16, backgroundColor: Colors.mediumGray, opacity: 0.3 },
    // Font Settings
    fontSettingsOverlay: { flex: 1, justifyContent: 'flex-end' },
    fontSettingsBackdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
    fontSettingsModal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
    fontSettingsDragHandle: { alignItems: 'center', marginBottom: 20 },
    dragHandleBar: { width: 40, height: 4, borderRadius: 2 },
    fontSettingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    fontOption: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', minWidth: 44, alignItems: 'center' },
    fontOptionActive: { borderColor: Colors.gold, backgroundColor: 'rgba(212, 163, 115, 0.1)' },
    themeCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#DDD' },
    themeCircleActive: { borderColor: Colors.gold, borderWidth: 2 },
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
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.cream,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: Colors.gold,
        paddingBottom: 2, // Adjust to center arrow visually
    },
    floatingNavButtonDisabled: {
        opacity: 0.4,
    },
    floatingPlayButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    playTriangle: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 14,
        borderTopWidth: 9,
        borderBottomWidth: 9,
        borderLeftColor: '#FFFFFF',
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        marginLeft: 4, // Offset slightly to center visually
    },
    // Audio Drag Handle Styles
    audioDragHandle: {
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 12,
    },
    audioDragIndicator: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.lightGray,
    },
    // Toast Notification Styles
    toast: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 20,
        right: 20,
        backgroundColor: Colors.charcoal,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        zIndex: 9999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
    },
    toastText: {
        color: Colors.white,
        fontSize: 15,
        fontFamily: FontFamilies.sans,
        fontWeight: '500',
        textAlign: 'center',
    },
    // Reflection Modal Styles
    reflectModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    reflectModalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: Spacing.lg,
        maxHeight: '85%',
    },
    reflectModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    reflectModalContext: {
        backgroundColor: '#FFF9E6',
        padding: Spacing.md,
        borderRadius: 8,
        marginBottom: Spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: Colors.gold,
    },
    reflectModalInput: {
        borderWidth: 1,
        borderColor: Colors.lightGray,
        borderRadius: 12,
        padding: Spacing.md,
        minHeight: 120,
        fontSize: 16,
        fontFamily: FontFamilies.sans,
        color: Colors.charcoal,
        marginBottom: Spacing.md,
    },
    reflectModalSaveButton: {
        backgroundColor: Colors.gold,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    reflectModalSaveDisabled: {
        backgroundColor: Colors.lightGray,
    },
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
        fontFamily: FontFamilies.sans,
    },
    audioInfoIcon: {
        marginLeft: 6,
    },
    audioTransportControls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 32,
        marginBottom: 20,
    },
    audioSecondaryButton: {
        padding: 8,
    },
    audioRewindIcon: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioForwardIcon: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioPlayButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.gold,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.gold,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 5,
    },
    audioPlayTriangle: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioProgressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    audioTimeText: {
        color: Colors.mediumGray,
        fontSize: 12,
        fontFamily: FontFamilies.sans,
        width: 40,
    },
    audioProgressBar: {
        flex: 1,
        height: 4,
        backgroundColor: Colors.lightGray,
        borderRadius: 2,
        marginLeft: 8,
        position: 'relative',
    },
    audioProgressTrack: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '0%',
        backgroundColor: Colors.gold,
        borderRadius: 2,
    },
    audioProgressThumb: {
        position: 'absolute',
        left: 0,
        top: -4,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.gold,
    },
    audioBottomControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    audioSpeedButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: Colors.lightGray,
        backgroundColor: Colors.white,
    },
    audioSpeedText: {
        color: Colors.charcoal,
        fontSize: 14,
        fontFamily: FontFamilies.sans,
        fontWeight: '600',
    },
    audioShowControlsButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    audioShowControlsText: {
        color: Colors.charcoal,
        fontSize: 14,
        fontFamily: FontFamilies.sans,
    },
    audioSleepButton: {
        padding: 8,
    },
});
