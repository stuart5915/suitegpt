// Bible structure: 66 books, 1,189 chapters total
export interface Book {
    name: string;
    chapters: number;
    testament: 'OT' | 'NT';
}

export const BIBLE_BOOKS: Book[] = [
    // Old Testament (929 chapters)
    { name: 'Genesis', chapters: 50, testament: 'OT' },
    { name: 'Exodus', chapters: 40, testament: 'OT' },
    { name: 'Leviticus', chapters: 27, testament: 'OT' },
    { name: 'Numbers', chapters: 36, testament: 'OT' },
    { name: 'Deuteronomy', chapters: 34, testament: 'OT' },
    { name: 'Joshua', chapters: 24, testament: 'OT' },
    { name: 'Judges', chapters: 21, testament: 'OT' },
    { name: 'Ruth', chapters: 4, testament: 'OT' },
    { name: '1 Samuel', chapters: 31, testament: 'OT' },
    { name: '2 Samuel', chapters: 24, testament: 'OT' },
    { name: '1 Kings', chapters: 22, testament: 'OT' },
    { name: '2 Kings', chapters: 25, testament: 'OT' },
    { name: '1 Chronicles', chapters: 29, testament: 'OT' },
    { name: '2 Chronicles', chapters: 36, testament: 'OT' },
    { name: 'Ezra', chapters: 10, testament: 'OT' },
    { name: 'Nehemiah', chapters: 13, testament: 'OT' },
    { name: 'Esther', chapters: 10, testament: 'OT' },
    { name: 'Job', chapters: 42, testament: 'OT' },
    { name: 'Psalms', chapters: 150, testament: 'OT' },
    { name: 'Proverbs', chapters: 31, testament: 'OT' },
    { name: 'Ecclesiastes', chapters: 12, testament: 'OT' },
    { name: 'Song of Solomon', chapters: 8, testament: 'OT' },
    { name: 'Isaiah', chapters: 66, testament: 'OT' },
    { name: 'Jeremiah', chapters: 52, testament: 'OT' },
    { name: 'Lamentations', chapters: 5, testament: 'OT' },
    { name: 'Ezekiel', chapters: 48, testament: 'OT' },
    { name: 'Daniel', chapters: 12, testament: 'OT' },
    { name: 'Hosea', chapters: 14, testament: 'OT' },
    { name: 'Joel', chapters: 3, testament: 'OT' },
    { name: 'Amos', chapters: 9, testament: 'OT' },
    { name: 'Obadiah', chapters: 1, testament: 'OT' },
    { name: 'Jonah', chapters: 4, testament: 'OT' },
    { name: 'Micah', chapters: 7, testament: 'OT' },
    { name: 'Nahum', chapters: 3, testament: 'OT' },
    { name: 'Habakkuk', chapters: 3, testament: 'OT' },
    { name: 'Zephaniah', chapters: 3, testament: 'OT' },
    { name: 'Haggai', chapters: 2, testament: 'OT' },
    { name: 'Zechariah', chapters: 14, testament: 'OT' },
    { name: 'Malachi', chapters: 4, testament: 'OT' },
    // New Testament (260 chapters)
    { name: 'Matthew', chapters: 28, testament: 'NT' },
    { name: 'Mark', chapters: 16, testament: 'NT' },
    { name: 'Luke', chapters: 24, testament: 'NT' },
    { name: 'John', chapters: 21, testament: 'NT' },
    { name: 'Acts', chapters: 28, testament: 'NT' },
    { name: 'Romans', chapters: 16, testament: 'NT' },
    { name: '1 Corinthians', chapters: 16, testament: 'NT' },
    { name: '2 Corinthians', chapters: 13, testament: 'NT' },
    { name: 'Galatians', chapters: 6, testament: 'NT' },
    { name: 'Ephesians', chapters: 6, testament: 'NT' },
    { name: 'Philippians', chapters: 4, testament: 'NT' },
    { name: 'Colossians', chapters: 4, testament: 'NT' },
    { name: '1 Thessalonians', chapters: 5, testament: 'NT' },
    { name: '2 Thessalonians', chapters: 3, testament: 'NT' },
    { name: '1 Timothy', chapters: 6, testament: 'NT' },
    { name: '2 Timothy', chapters: 4, testament: 'NT' },
    { name: 'Titus', chapters: 3, testament: 'NT' },
    { name: 'Philemon', chapters: 1, testament: 'NT' },
    { name: 'Hebrews', chapters: 13, testament: 'NT' },
    { name: 'James', chapters: 5, testament: 'NT' },
    { name: '1 Peter', chapters: 5, testament: 'NT' },
    { name: '2 Peter', chapters: 3, testament: 'NT' },
    { name: '1 John', chapters: 5, testament: 'NT' },
    { name: '2 John', chapters: 1, testament: 'NT' },
    { name: '3 John', chapters: 1, testament: 'NT' },
    { name: 'Jude', chapters: 1, testament: 'NT' },
    { name: 'Revelation', chapters: 22, testament: 'NT' },
];

export const TOTAL_CHAPTERS = 1189;

// Chronological reading order (approximate)
export const CHRONOLOGICAL_ORDER = [
    'Genesis', 'Job', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
    '1 Samuel', '2 Samuel', 'Psalms', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
    'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Hosea', 'Joel', 'Amos',
    'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Jeremiah', 'Lamentations',
    'Ezekiel', 'Daniel', 'Esther', 'Ezra', 'Nehemiah', 'Haggai', 'Zechariah', 'Malachi',
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'James', 'Galatians', '1 Thessalonians',
    '2 Thessalonians', '1 Corinthians', '2 Corinthians', 'Romans', 'Ephesians', 'Philippians',
    'Colossians', 'Philemon', '1 Timothy', 'Titus', '2 Timothy', '1 Peter', '2 Peter',
    'Hebrews', 'Jude', '1 John', '2 John', '3 John', 'Revelation',
];

// NT in 90 Days includes all NT books (260 chapters)
export const NT_BOOKS = BIBLE_BOOKS.filter(book => book.testament === 'NT');

// Wisdom literature: Psalms (150) + Proverbs (31) = 181 chapters
export const WISDOM_BOOKS = BIBLE_BOOKS.filter(book =>
    book.name === 'Psalms' || book.name === 'Proverbs'
);

// Who is Jesus? - Curated key passages about Jesus (30 readings)
export const JESUS_PASSAGES = [
    // Birth & Early Life
    { book: 'Luke', chapterStart: 1, chapterEnd: 2 },          // Birth narrative
    { book: 'Matthew', chapterStart: 1, chapterEnd: 2 },       // Birth & Magi

    // Beginning of Ministry
    { book: 'Mark', chapterStart: 1, chapterEnd: 1 },          // Baptism & calling
    { book: 'John', chapterStart: 1, chapterEnd: 1 },          // The Word became flesh
    { book: 'Luke', chapterStart: 4, chapterEnd: 4 },          // Nazareth declaration

    // Key Teachings
    { book: 'Matthew', chapterStart: 5, chapterEnd: 7 },       // Sermon on the Mount
    { book: 'John', chapterStart: 3, chapterEnd: 3 },          // Born again, John 3:16
    { book: 'John', chapterStart: 10, chapterEnd: 10 },        // Good Shepherd
    { book: 'John', chapterStart: 14, chapterEnd: 14 },        // I am the Way
    { book: 'John', chapterStart: 15, chapterEnd: 15 },        // True Vine

    // Miracles & Power
    { book: 'Mark', chapterStart: 4, chapterEnd: 5 },          // Storms & demons
    { book: 'John', chapterStart: 6, chapterEnd: 6 },          // Bread of Life
    { book: 'John', chapterStart: 9, chapterEnd: 9 },          // Healing the blind
    { book: 'John', chapterStart: 11, chapterEnd: 11 },        // Raising Lazarus

    // Identity Revealed
    { book: 'Matthew', chapterStart: 16, chapterEnd: 17 },     // Peter's confession, Transfiguration
    { book: 'John', chapterStart: 8, chapterEnd: 8 },          // Before Abraham, I AM

    // Last Week
    { book: 'John', chapterStart: 12, chapterEnd: 12 },        // Triumphal entry
    { book: 'John', chapterStart: 13, chapterEnd: 13 },        // Washing feet
    { book: 'Matthew', chapterStart: 26, chapterEnd: 26 },     // Last Supper, Gethsemane
    { book: 'John', chapterStart: 17, chapterEnd: 17 },        // High Priestly Prayer

    // Crucifixion
    { book: 'Matthew', chapterStart: 27, chapterEnd: 27 },     // Trial & Crucifixion
    { book: 'John', chapterStart: 18, chapterEnd: 19 },        // Cross from John

    // Resurrection & Appearances
    { book: 'Matthew', chapterStart: 28, chapterEnd: 28 },     // Resurrection
    { book: 'John', chapterStart: 20, chapterEnd: 21 },        // Appearances & commission
    { book: 'Luke', chapterStart: 24, chapterEnd: 24 },        // Road to Emmaus

    // Who Jesus Is
    { book: 'Colossians', chapterStart: 1, chapterEnd: 1 },    // Supremacy of Christ
    { book: 'Hebrews', chapterStart: 1, chapterEnd: 2 },       // Superior to angels
    { book: 'Philippians', chapterStart: 2, chapterEnd: 2 },   // Christ's humility
    { book: 'Revelation', chapterStart: 1, chapterEnd: 1 },    // Jesus glorified
    { book: 'Revelation', chapterStart: 21, chapterEnd: 22 },  // New creation
];
