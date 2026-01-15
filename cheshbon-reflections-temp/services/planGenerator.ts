import { BIBLE_BOOKS, CHRONOLOGICAL_ORDER, NT_BOOKS, WISDOM_BOOKS, TOTAL_CHAPTERS, JESUS_PASSAGES } from '../constants/bibleData';
import type { DailyReading } from './database';

export type PlanType = 'canonical' | 'chronological' | 'nt90' | 'wisdom' | 'jesus' | 'custom';

export interface GeneratedPlan {
    dailyReadings: DailyReading[][];
    chaptersPerDay: number;
    minutesPerDay: number;
    totalDays: number;
}

const AVG_READING_TIME_PER_CHAPTER = 4; // minutes

// Generates a reading plan based on type and duration
export function generateReadingPlan(type: PlanType, customDays?: number): GeneratedPlan {
    switch (type) {
        case 'canonical':
            return generateCanonicalPlan(customDays);
        case 'chronological':
            return generateChronologicalPlan(customDays);
        case 'nt90':
            return generateNT90Plan(customDays);
        case 'wisdom':
            return generateWisdomPlan(customDays);
        case 'jesus':
            return generateJesusPlan(customDays);
        case 'custom':
            return generateCustomPlan(customDays || 365);
        default:
            return generateCanonicalPlan(customDays);
    }
}

// Canonical order (Genesis to Revelation)
function generateCanonicalPlan(days: number = 365): GeneratedPlan {
    return distributeChapters(BIBLE_BOOKS.map(b => b.name), days);
}

// Chronological order
function generateChronologicalPlan(days: number = 365): GeneratedPlan {
    return distributeChapters(CHRONOLOGICAL_ORDER, days);
}

// New Testament
function generateNT90Plan(days: number = 90): GeneratedPlan {
    return distributeChapters(NT_BOOKS.map(b => b.name), days);
}

// Psalms & Proverbs (181 chapters over ~60 days = ~3 chapters/day)
function generateWisdomPlan(days: number = 60): GeneratedPlan {
    return distributeChapters(WISDOM_BOOKS.map(b => b.name), days);
}

// Who is Jesus? - Curated passages about Jesus
function generateJesusPlan(days: number = 30): GeneratedPlan {
    const dailyReadings: DailyReading[][] = [];
    const totalPassages = JESUS_PASSAGES.length;
    const passagesPerDay = Math.ceil(totalPassages / days);

    for (let day = 0; day < days; day++) {
        const startIdx = day * passagesPerDay;
        const endIdx = Math.min(startIdx + passagesPerDay, totalPassages);
        const dayReadings: DailyReading[] = [];

        for (let i = startIdx; i < endIdx; i++) {
            if (JESUS_PASSAGES[i]) {
                dayReadings.push(JESUS_PASSAGES[i]);
            }
        }

        if (dayReadings.length > 0) {
            dailyReadings.push(dayReadings);
        }
    }

    // Remove any empty days
    const filteredReadings = dailyReadings.filter(day => day.length > 0);

    return {
        dailyReadings: filteredReadings,
        chaptersPerDay: Math.round((totalPassages / filteredReadings.length) * 10) / 10,
        minutesPerDay: Math.round((totalPassages / filteredReadings.length) * AVG_READING_TIME_PER_CHAPTER),
        totalDays: filteredReadings.length,
    };
}

// Custom duration plan
function generateCustomPlan(days: number): GeneratedPlan {
    return distributeChapters(BIBLE_BOOKS.map(b => b.name), days);
}

// Core algorithm: distributes Bible chapters across given days
// Keeps chapters of the same book together as much as possible
function distributeChapters(bookOrder: string[], totalDays: number): GeneratedPlan {
    const dailyReadings: DailyReading[][] = Array.from({ length: totalDays }, () => []);

    // Get books in specified order
    const booksToRead = bookOrder
        .map(name => BIBLE_BOOKS.find(b => b.name === name))
        .filter(Boolean) as typeof BIBLE_BOOKS;

    const totalChapters = booksToRead.reduce((sum, book) => sum + book.chapters, 0);
    const baseChaptersPerDay = Math.floor(totalChapters / totalDays);
    const extraChapters = totalChapters % totalDays;

    let currentDay = 0;
    let remainingChaptersForDay = currentDay < extraChapters
        ? baseChaptersPerDay + 1
        : baseChaptersPerDay;

    for (const book of booksToRead) {
        let bookChaptersRemaining = book.chapters;
        let currentChapterInBook = 1;

        while (bookChaptersRemaining > 0) {
            // If we can fit remaining chapters of this book in current day
            if (bookChaptersRemaining <= remainingChaptersForDay) {
                dailyReadings[currentDay].push({
                    book: book.name,
                    chapterStart: currentChapterInBook,
                    chapterEnd: currentChapterInBook + bookChaptersRemaining - 1,
                });

                remainingChaptersForDay -= bookChaptersRemaining;
                bookChaptersRemaining = 0;

                // Move to next day if current day is full
                if (remainingChaptersForDay === 0 && currentDay < totalDays - 1) {
                    currentDay++;
                    remainingChaptersForDay = currentDay < extraChapters
                        ? baseChaptersPerDay + 1
                        : baseChaptersPerDay;
                }
            } else {
                // Fill current day and continue book on next day
                dailyReadings[currentDay].push({
                    book: book.name,
                    chapterStart: currentChapterInBook,
                    chapterEnd: currentChapterInBook + remainingChaptersForDay - 1,
                });

                currentChapterInBook += remainingChaptersForDay;
                bookChaptersRemaining -= remainingChaptersForDay;

                if (currentDay < totalDays - 1) {
                    currentDay++;
                    remainingChaptersForDay = currentDay < extraChapters
                        ? baseChaptersPerDay + 1
                        : baseChaptersPerDay;
                } else {
                    break; // Safety check
                }
            }
        }
    }

    const avgChaptersPerDay = totalChapters / totalDays;
    const avgMinutesPerDay = avgChaptersPerDay * AVG_READING_TIME_PER_CHAPTER;

    return {
        dailyReadings,
        chaptersPerDay: Math.round(avgChaptersPerDay * 10) / 10,
        minutesPerDay: Math.round(avgMinutesPerDay),
        totalDays,
    };
}

// Calculate daily commitment for a custom duration
export function calculateDailyCommitment(days: number): { chapters: number; minutes: number } {
    const chapters = TOTAL_CHAPTERS / days;
    const minutes = chapters * AVG_READING_TIME_PER_CHAPTER;

    return {
        chapters: Math.round(chapters * 10) / 10,
        minutes: Math.round(minutes),
    };
}
