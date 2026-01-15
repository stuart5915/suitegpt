/**
 * WorkConductor - Supabase Client
 * Handles persistence of goals, sessions, and feedback
 */

const SupabaseClient = (function () {
    // Supabase configuration (uses existing SUITE project)
    const SUPABASE_URL = 'https://bwxytovgbhtwyjjpvjsr.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3eHl0b3ZnYmh0d3lqanB2anNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIzOTU3ODMsImV4cCI6MjA0Nzk3MTc4M30.WPCi2O5oMrA0ll_hJHj-q04j7u-AKLDejk8-y8Tkp0M';

    // User ID (stored locally for simplicity - in production would use auth)
    function getUserId() {
        let userId = localStorage.getItem('conductor_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('conductor_user_id', userId);
        }
        return userId;
    }

    /**
     * Make authenticated request to Supabase
     */
    async function supabaseRequest(endpoint, options = {}) {
        const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;

        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation'
        };

        const response = await fetch(url, {
            ...options,
            headers: { ...headers, ...options.headers }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Supabase error: ${response.status}`);
        }

        // Handle empty responses
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    // ============================================
    // GOALS MANAGEMENT
    // ============================================

    /**
     * Save or update user's telos/goals
     */
    async function saveTelos(telosText) {
        const userId = getUserId();

        try {
            // Try to update existing
            const existing = await supabaseRequest(
                `conductor_goals?user_id=eq.${userId}&is_active=eq.true&select=id`,
                { method: 'GET' }
            );

            if (existing && existing.length > 0) {
                // Update existing
                await supabaseRequest(
                    `conductor_goals?id=eq.${existing[0].id}`,
                    {
                        method: 'PATCH',
                        body: JSON.stringify({
                            description: telosText,
                            updated_at: new Date().toISOString()
                        })
                    }
                );
            } else {
                // Create new
                await supabaseRequest('conductor_goals', {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: userId,
                        title: 'Primary Goals',
                        description: telosText,
                        is_active: true
                    })
                });
            }

            // Also store locally for offline access
            localStorage.setItem('conductor_telos', telosText);
            return true;
        } catch (error) {
            console.error('Error saving telos to Supabase:', error);
            // Store locally as fallback
            localStorage.setItem('conductor_telos', telosText);
            return true;
        }
    }

    /**
     * Load user's telos/goals
     */
    async function loadTelos() {
        const userId = getUserId();

        try {
            const result = await supabaseRequest(
                `conductor_goals?user_id=eq.${userId}&is_active=eq.true&select=description&order=updated_at.desc&limit=1`,
                { method: 'GET' }
            );

            if (result && result.length > 0) {
                localStorage.setItem('conductor_telos', result[0].description);
                return result[0].description;
            }
        } catch (error) {
            console.error('Error loading telos from Supabase:', error);
        }

        // Fall back to local storage
        return localStorage.getItem('conductor_telos') || '';
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    /**
     * Create a new work session
     */
    async function createSession(sessionPlan, focus) {
        const userId = getUserId();
        const sessionData = {
            user_id: userId,
            session_plan: sessionPlan,
            focus: focus,
            status: 'active',
            started_at: new Date().toISOString()
        };

        try {
            const result = await supabaseRequest('conductor_sessions', {
                method: 'POST',
                body: JSON.stringify(sessionData)
            });

            if (result && result.length > 0) {
                // Also store locally
                localStorage.setItem('conductor_current_session', JSON.stringify(result[0]));
                return result[0];
            }
        } catch (error) {
            console.error('Error creating session in Supabase:', error);
        }

        // Fall back to local storage
        const localSession = {
            id: 'local_' + Date.now(),
            ...sessionData
        };
        localStorage.setItem('conductor_current_session', JSON.stringify(localSession));
        return localSession;
    }

    /**
     * Update session status
     */
    async function updateSession(sessionId, updates) {
        try {
            if (sessionId.startsWith('local_')) {
                // Local session - just update local storage
                const stored = JSON.parse(localStorage.getItem('conductor_current_session') || '{}');
                const updated = { ...stored, ...updates };
                localStorage.setItem('conductor_current_session', JSON.stringify(updated));
                return updated;
            }

            await supabaseRequest(
                `conductor_sessions?id=eq.${sessionId}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({
                        ...updates,
                        updated_at: new Date().toISOString()
                    })
                }
            );
            return true;
        } catch (error) {
            console.error('Error updating session:', error);
            return false;
        }
    }

    /**
     * Complete a session
     */
    async function completeSession(sessionId, feedback = null) {
        return updateSession(sessionId, {
            status: 'completed',
            ended_at: new Date().toISOString(),
            feedback: feedback
        });
    }

    /**
     * Abandon a session
     */
    async function abandonSession(sessionId, reason = null) {
        return updateSession(sessionId, {
            status: 'abandoned',
            ended_at: new Date().toISOString(),
            feedback: reason
        });
    }

    /**
     * Get recent sessions
     */
    async function getRecentSessions(limit = 5) {
        const userId = getUserId();

        try {
            const result = await supabaseRequest(
                `conductor_sessions?user_id=eq.${userId}&select=id,focus,status,started_at,ended_at,feedback&order=started_at.desc&limit=${limit}`,
                { method: 'GET' }
            );

            return result || [];
        } catch (error) {
            console.error('Error fetching sessions:', error);
            return [];
        }
    }

    /**
     * Get current active session
     */
    function getCurrentSession() {
        const stored = localStorage.getItem('conductor_current_session');
        if (!stored) return null;

        const session = JSON.parse(stored);
        if (session.status === 'active') {
            return session;
        }
        return null;
    }

    /**
     * Clear current session
     */
    function clearCurrentSession() {
        localStorage.removeItem('conductor_current_session');
    }

    // ============================================
    // FEEDBACK MANAGEMENT
    // ============================================

    /**
     * Save feedback for learning
     */
    async function saveFeedback(sessionId, feedbackType, details, aiResponse) {
        const userId = getUserId();

        try {
            await supabaseRequest('conductor_feedback', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId,
                    session_id: sessionId,
                    feedback_type: feedbackType,
                    details: details,
                    ai_response: aiResponse
                })
            });
            return true;
        } catch (error) {
            console.error('Error saving feedback:', error);
            // Store locally as fallback
            const localFeedback = JSON.parse(localStorage.getItem('conductor_feedback') || '[]');
            localFeedback.push({
                session_id: sessionId,
                feedback_type: feedbackType,
                details: details,
                ai_response: aiResponse,
                created_at: new Date().toISOString()
            });
            localStorage.setItem('conductor_feedback', JSON.stringify(localFeedback));
            return true;
        }
    }

    /**
     * Get recent feedback for context
     */
    async function getRecentFeedback(limit = 3) {
        const userId = getUserId();

        try {
            const result = await supabaseRequest(
                `conductor_feedback?user_id=eq.${userId}&select=feedback_type,details,ai_response,created_at&order=created_at.desc&limit=${limit}`,
                { method: 'GET' }
            );

            return result || [];
        } catch (error) {
            console.error('Error fetching feedback:', error);
            return [];
        }
    }

    // ============================================
    // LOCAL STORAGE HELPERS
    // ============================================

    /**
     * Check if user has completed setup
     */
    function hasCompletedSetup() {
        return !!localStorage.getItem('conductor_api_key') && !!localStorage.getItem('conductor_telos');
    }

    /**
     * Clear all local data
     */
    function clearAllLocalData() {
        const keysToRemove = [
            'conductor_api_key',
            'conductor_telos',
            'conductor_user_id',
            'conductor_current_session',
            'conductor_feedback',
            'conductor_rate_limits'
        ];
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    // Public API
    return {
        getUserId,
        saveTelos,
        loadTelos,
        createSession,
        updateSession,
        completeSession,
        abandonSession,
        getRecentSessions,
        getCurrentSession,
        clearCurrentSession,
        saveFeedback,
        getRecentFeedback,
        hasCompletedSetup,
        clearAllLocalData
    };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.SupabaseClient = SupabaseClient;
}
