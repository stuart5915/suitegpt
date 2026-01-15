import { supabase } from './supabase';
import { sanitizeReflection, sanitizeUsername } from './contentSanitizer';

export interface ReadingPlan {
    id?: string;
    user_id?: string;
    type: string;
    duration: number;
    start_date: string;
    current_day: number;
    is_active: boolean;
    completed: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface JournalEntry {
    id?: string;
    user_id?: string;
    plan_id?: string;
    day_number?: number;
    date: string;
    book: string;
    chapter: number;
    reflection: string;
    created_at?: string;
    updated_at?: string;
}

export interface DailyReading {
    book: string;
    chapterStart: number;
    chapterEnd: number;
}

export interface VerseReflection {
    id?: string;
    user_id?: string;
    date: string;
    verse_reference: string;
    verse_text: string;
    reflection?: string;
    created_at?: string;
    updated_at?: string;
}

export interface PlanReflection {
    id?: string;
    user_id?: string;
    plan_id?: string;
    reflection: string;
    completed_date: string;
    created_at?: string;
    plan?: ReadingPlan; // Populated when joined
}

export interface ReflectionFilters {
    type?: 'plan' | 'verse' | 'all';
    book?: string;
    dateFrom?: string;
    dateTo?: string;
    planId?: string;
}

export interface UserProfile {
    id?: string;
    user_id?: string;
    current_streak: number;
    last_reflection_date?: string;
    created_at?: string;
    updated_at?: string;
}

// Initialize database (no-op for Supabase)
export async function initializeDatabase() {
    console.log('Using Supabase - no local initialization needed');
}

// Reading Plans
export async function saveReadingPlan(plan: ReadingPlan): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
        .from('reading_plans')
        .insert({
            user_id: user.id,
            type: plan.type,
            duration: plan.duration,
            start_date: plan.start_date,
            current_day: plan.current_day,
            is_active: plan.is_active,
            completed: plan.completed,
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving plan:', error);
        throw error;
    }

    return data.id;
}

export async function getAllActivePlans(): Promise<ReadingPlan[]> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return [];
    }

    const { data, error } = await supabase
        .from('reading_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching plans:', error);
        return [];
    }

    return data || [];
}

export async function getCurrentPlan(): Promise<ReadingPlan | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const { data, error } = await supabase
        .from('reading_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // No rows returned
            return null;
        }
        console.error('Error fetching current plan:', error);
        return null;
    }

    return data;
}

export async function getPlanById(id: string): Promise<ReadingPlan | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const { data, error } = await supabase
        .from('reading_plans')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (error) {
        console.error('Error fetching plan:', error);
        return null;
    }

    return data;
}

export async function updatePlanProgress(planId: string, currentDay: number): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    const { error } = await supabase
        .from('reading_plans')
        .update({
            current_day: currentDay,
            updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error updating plan progress:', error);
        throw error;
    }
}

// Journal Entries
export async function saveJournalEntry(entry: JournalEntry): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
        .from('journal_entries')
        .insert({
            user_id: user.id,
            plan_id: entry.plan_id,
            day_number: entry.day_number,
            date: entry.date,
            book: entry.book,
            chapter: entry.chapter,
            reflection: sanitizeReflection(entry.reflection),
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving journal entry:', error);
        throw error;
    }

    return data.id;
}

export async function getJournalEntry(planId: string, dayNumber: number): Promise<JournalEntry | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', planId)
        .eq('day_number', dayNumber)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        console.error('Error fetching journal entry:', error);
        return null;
    }

    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        console.error('Error fetching journal entry:', error);
        return null;
    }

    return data;
}

export async function getJournalEntriesForDay(planId: string, dayNumber: number): Promise<JournalEntry[]> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return [];
    }

    const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', planId)
        .eq('day_number', dayNumber)
        .order('created_at', { ascending: false }); // Newest first

    if (error) {
        console.error('Error fetching journal entries for day:', error);
        return [];
    }

    return data || [];
}

export async function getAllJournalEntries(): Promise<JournalEntry[]> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return [];
    }

    const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching journal entries:', error);
        return [];
    }

    return data || [];
}

// Progress Tracking
export async function getProgressForDate(date: string): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const { data, error } = await supabase
        .from('daily_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        console.error('Error fetching progress:', error);
        return null;
    }

    return data;
}

export async function getPlanCompletionStatus(planId: string): Promise<Set<number>> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return new Set();
    }

    // Query 1: Journal Entries (Reflections counts as completion)
    const { data: journalData, error: journalError } = await supabase
        .from('journal_entries')
        .select('day_number')
        .eq('user_id', user.id)
        .eq('plan_id', planId);

    if (journalError) {
        console.error('Error fetching journal completion status:', journalError);
    }

    // Query 2: Daily Progress (Explicit completion button)
    // We need to map `date` to `day_number` OR assume `daily_progress` is sufficient if we can map it?
    // Actually, `daily_progress` doesn't strictly have `day_number`, it has `date`.
    // But `saveDailyProgress` is called with `date`.
    // This is tricky because `daily_progress` tracks by DATE, not plan day index.
    // BUT the prompt is: "Completed State: If a user has finished the reading...".

    // Improved Approach:
    // If we can't easily map daily_progress dates to day numbers without fetching the whole plan, 
    // we should rely on `journal_entries` which has `day_number`.
    // OR, we update `saveDailyProgress` to include `day_number` if possible? 
    // The table schema for `daily_progress` wasn't shown fully, but let's assume it might not have it.

    // HOWEVER, for now, let's Stick to Journal Entries as the source of truth for "Day X Completed",
    // AND let's ensure `handleComplete` creates a journal entry (even empty?) OR we add a new table/column?

    // WAIT! `reading_plans` has `current_day`. That's just progress pointer.

    // Let's assume the user MUST reflect or we add a "check" entry.
    // Actually, let's just use `journal_entries` for now. If the user just clicked "Complete", maybe we save a blank reflection?
    // Or better, let's stick to the current implementation but verify why it failed.
    // If the user made a reflection and it didn't show, maybe `planId` mismatch?

    // Let's TRY to fetch from `daily_progress` if `day_number` exists calling it.
    // If not, we'll just return the journal ones.

    // Let's Query `daily_progress` anyway to see if we can find anything useful?
    // No, let's stick to `journal_entries` being the primary "Checkmark" driver for "Reflections".
    // If the user wants a "Reading Only" completion, we need to track that.

    const completedDays = new Set<number>();

    journalData?.forEach((entry: any) => {
        if (entry.day_number) {
            completedDays.add(entry.day_number);
        }
    });

    return completedDays;
}

export async function saveDailyProgress(progress: any): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    const { error } = await supabase
        .from('daily_progress')
        .upsert({
            user_id: user.id,
            plan_id: progress.plan_id,
            date: progress.date,
            completed: progress.completed,
        }, {
            onConflict: 'plan_id,date'
        });

    if (error) {
        console.error('Error saving progress:', error);
        throw error;
    }
}

export async function getReflectionByPlanAndDay(planId: string, day: number): Promise<JournalEntry | null> {
    return getJournalEntry(planId, day);
}

// Verse Reflections
export async function saveVerseReflection(
    date: string,
    verseReference: string,
    verseText: string,
    reflection?: string
): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    // Use insert instead of upsert to allow multiple reflections per day
    const { error } = await supabase
        .from('verse_reflections')
        .insert({
            user_id: user.id,
            date,
            verse_reference: verseReference,
            verse_text: verseText,
            reflection: reflection ? sanitizeReflection(reflection) : null,
        });

    if (error) {
        console.error('Error saving verse reflection:', error);
        throw error;
    }
}

export async function getVerseReflection(date: string): Promise<VerseReflection | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const { data, error } = await supabase
        .from('verse_reflections')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        console.error('Error fetching verse reflection:', error);
        return null;
    }

    return data;
}

// Plan Reflections
export async function savePlanReflection(
    planId: string,
    reflection: string,
    completedDate: string
): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    const { error } = await supabase
        .from('plan_reflections')
        .upsert({
            user_id: user.id,
            plan_id: planId,
            reflection,
            completed_date: completedDate,
        }, {
            onConflict: 'user_id,plan_id'
        });

    if (error) {
        console.error('Error saving plan reflection:', error);
        throw error;
    }
}

export async function getPlanReflections(): Promise<PlanReflection[]> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return [];
    }

    const { data, error } = await supabase
        .from('plan_reflections')
        .select(`
            *,
            plan:reading_plans(*)
        `)
        .eq('user_id', user.id)
        .order('completed_date', { ascending: false });

    if (error) {
        console.error('Error fetching plan reflections:', error);
        return [];
    }

    return data || [];
}

// Get all reflections with filtering
export async function getAllReflectionsFiltered(filters: ReflectionFilters = {}): Promise<(JournalEntry | VerseReflection)[]> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return [];
    }

    const results: (JournalEntry | VerseReflection)[] = [];

    // Fetch journal entries (plan readings)
    if (!filters.type || filters.type === 'plan' || filters.type === 'all') {
        let query = supabase
            .from('journal_entries')
            .select('*')
            .eq('user_id', user.id);

        if (filters.book) {
            query = query.eq('book', filters.book);
        }
        if (filters.dateFrom) {
            query = query.gte('date', filters.dateFrom);
        }
        if (filters.dateTo) {
            query = query.lte('date', filters.dateTo);
        }
        if (filters.planId) {
            query = query.eq('plan_id', filters.planId);
        }

        const { data, error } = await query.order('date', { ascending: false });

        if (!error && data) {
            results.push(...data);
        }
    }

    // Fetch verse reflections
    if (!filters.type || filters.type === 'verse' || filters.type === 'all') {
        let query = supabase
            .from('verse_reflections')
            .select('*')
            .eq('user_id', user.id);

        if (filters.dateFrom) {
            query = query.gte('date', filters.dateFrom);
        }
        if (filters.dateTo) {
            query = query.lte('date', filters.dateTo);
        }

        const { data, error } = await query.order('date', { ascending: false });

        if (!error && data) {
            results.push(...data);
        }
    }

    // Fetch user's PUBLIC reflections (posts on the community feed)
    if (!filters.type || filters.type === 'public' || filters.type === 'all') {
        const { data, error } = await supabase
            .from('public_reflections')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            // Transform to match the expected format, adding a type marker
            // Note: public_reflections already has 'reflection' field, no need to remap
            const publicEntries = data.map((r: any) => ({
                ...r,
                date: r.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                // reflection field already exists from spread, don't overwrite it
                _type: 'public_reflection' as const, // Mark the type for display differentiation
            }));
            results.push(...publicEntries);
        }
    }

    // Fetch user's REPLIES (comments on other posts)
    if (!filters.type || filters.type === 'reply' || filters.type === 'all') {
        const { data, error } = await supabase
            .from('unified_replies')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            // Transform to match the expected format
            // unified_replies has 'reply_text' field for the content
            const replyEntries = data.map((r: any) => ({
                ...r,
                date: r.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                reflection: r.reply_text || r.content || r.reflection, // Support multiple column names
                _type: 'reply' as const, // Mark as reply for display differentiation
            }));
            results.push(...replyEntries);
        }
    }

    // Sort all results by created_at timestamp (newest first)
    results.sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());

    return results;
}

// Streak Functions
export async function getStreak(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return 0;
    }

    const { data, error } = await supabase
        .from('user_profiles')
        .select('current_streak')
        .eq('user_id', user.id)
        .single();

    if (error || !data) {
        return 0;
    }

    return data.current_streak;
}

export async function updateStreak(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return 0;
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Get or create user profile
    let { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error || !profile) {
        // Create new profile with streak of 1
        const { data: newProfile, error: insertError } = await supabase
            .from('user_profiles')
            .insert({
                user_id: user.id,
                current_streak: 1,
                last_reflection_date: today,
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error creating user profile:', insertError);
            return 0;
        }
        return 1;
    }

    const lastDate = profile.last_reflection_date;
    let newStreak = profile.current_streak;

    if (lastDate === today) {
        // Already reflected today, do nothing
        return newStreak;
    } else if (lastDate === yesterday) {
        // Reflected yesterday, increment streak
        newStreak += 1;
    } else {
        // Missed a day (or first time), reset to 1
        newStreak = 1;
    }

    // Update profile
    const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
            current_streak: newStreak,
            last_reflection_date: today,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

    if (updateError) {
        console.error('Error updating streak:', updateError);
        return profile.current_streak;
    }

    return newStreak;
}

export interface VerseHighlight {
    id?: string;
    user_id?: string;
    book: string;
    chapter: number;
    verse: number;
    color: string;
    created_at?: string;
}

// Verse Highlights
export async function saveVerseHighlight(highlight: VerseHighlight): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    const { error } = await supabase
        .from('verse_highlights')
        .upsert({
            user_id: user.id,
            book: highlight.book,
            chapter: highlight.chapter,
            verse: highlight.verse,
            color: highlight.color,
            created_at: new Date().toISOString(),
        }, {
            onConflict: 'user_id,book,chapter,verse'
        });

    if (error) {
        console.error('Error saving highlight:', error);
        throw error;
    }
}

export async function getVerseHighlights(book: string, chapter: number): Promise<VerseHighlight[]> {
    // Guard against invalid inputs
    if (!book || !chapter || isNaN(chapter)) {
        console.log('[getVerseHighlights] Invalid inputs, returning empty:', { book, chapter });
        return [];
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return [];
    }

    const { data, error } = await supabase
        .from('verse_highlights')
        .select('*')
        .eq('user_id', user.id)
        .eq('book', book)
        .eq('chapter', chapter);

    if (error) {
        console.error('Error fetching highlights:', error);
        return [];
    }

    return data || [];
}

export async function deleteVerseHighlight(book: string, chapter: number, verse: number): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
        .from('verse_highlights')
        .delete()
        .eq('user_id', user.id)
        .eq('book', book)
        .eq('chapter', chapter)
        .eq('verse', verse);

    if (error) {
        console.error('Error deleting highlight:', error);
        throw error;
    }
}

// Delete a reading plan and all associated progress
export async function deletePlan(planId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('User not authenticated');

    // Delete associated journal entries first
    await supabase
        .from('journal_entries')
        .delete()
        .eq('user_id', user.id)
        .eq('plan_id', planId);

    // Delete associated daily progress
    await supabase
        .from('daily_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('plan_id', planId);

    // Delete the plan itself
    const { error } = await supabase
        .from('reading_plans')
        .delete()
        .eq('user_id', user.id)
        .eq('id', planId);

    if (error) {
        console.error('Error deleting plan:', error);
        throw error;
    }
}

// Delete a journal entry by ID
export async function deleteJournalEntry(entryId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('user_id', user.id)
        .eq('id', entryId);

    if (error) {
        console.error('Error deleting journal entry:', error);
        throw error;
    }
}

// Delete a verse reflection by ID
export async function deleteVerseReflection(reflectionId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
        .from('verse_reflections')
        .delete()
        .eq('user_id', user.id)
        .eq('id', reflectionId);

    if (error) {
        console.error('Error deleting verse reflection:', error);
        throw error;
    }
}

// Username Functions

export async function checkUsernameAvailability(username: string): Promise<{ available: boolean; error?: string }> {
    const result = sanitizeUsername(username);
    if (!result.valid) {
        return { available: false, error: result.error };
    }

    const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('username', result.username)
        .single();

    if (error && error.code === 'PGRST116') {
        // No row found = username is available
        return { available: true };
    }

    if (data) {
        return { available: false, error: 'Username is already taken' };
    }

    return { available: true };
}

export async function setUsername(username: string): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { success: false, error: 'User not authenticated' };
    }

    const result = sanitizeUsername(username);
    if (!result.valid) {
        return { success: false, error: result.error };
    }

    // Use upsert to create row if it doesn't exist
    const { error } = await supabase
        .from('user_profiles')
        .upsert({
            user_id: user.id,
            username: result.username,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id'
        });

    if (error) {
        if (error.code === '23505') {
            // Unique constraint violation on username
            return { success: false, error: 'Username is already taken' };
        }
        console.error('Error setting username:', error);
        return { success: false, error: 'Failed to set username' };
    }

    return { success: true };
}

export async function getUsername(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('user_id', user.id)
        .single();

    if (error || !data) return null;
    return data.username;
}

