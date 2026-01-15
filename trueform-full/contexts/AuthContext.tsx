import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, getProfile, getHealthProfile, getPainContext, HealthProfile } from '../services/supabase';

// Extended profile with health data
interface FullProfile {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    onboarding_complete: boolean;
    health_profile_complete?: boolean;
    // Health profile fields
    weight_lbs?: number;
    height_inches?: number;
    birth_year?: number;
    activity_level?: 'sedentary' | 'light' | 'moderate' | 'active';
    medical_conditions?: string[];
    health_notes?: string;
}

interface PainContext {
    pain_areas: string[];
    pain_triggers: string[];
    goals: string[];
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: FullProfile | null;
    healthProfile: HealthProfile | null;
    painContext: PainContext | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<FullProfile | null>(null);
    const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
    const [painContext, setPainContext] = useState<PainContext | null>(null);
    const [loading, setLoading] = useState(true);

    // Prevent duplicate loads during OAuth redirect
    const loadingRef = useRef(false);
    const lastLoadedUserId = useRef<string | null>(null);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                loadAllData(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('[AuthContext] Auth state changed:', event);
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    // Only reload if user changed or we haven't loaded yet
                    if (lastLoadedUserId.current !== session.user.id) {
                        if (event === 'SIGNED_IN') {
                            // During OAuth redirect, Supabase queries can hang
                            // Skip immediate load and do a delayed load instead
                            console.log('[AuthContext] SIGNED_IN event - delaying load to avoid OAuth hang');
                            setLoading(true);
                            setTimeout(async () => {
                                console.log('[AuthContext] Delayed OAuth load triggered');
                                await loadAllData(session.user.id);
                            }, 1000); // Wait 1s for OAuth redirect to fully settle
                        } else {
                            // For other events (INITIAL_SESSION, TOKEN_REFRESHED, etc.), load immediately
                            console.log('[AuthContext] Loading data for:', event);
                            await loadAllData(session.user.id);
                        }
                    }
                } else {
                    setProfile(null);
                    setHealthProfile(null);
                    setPainContext(null);
                    setLoading(false);
                    lastLoadedUserId.current = null;
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const loadAllData = async (userId: string) => {
        // Prevent duplicate concurrent loads
        if (loadingRef.current && lastLoadedUserId.current === userId) {
            console.log('[AuthContext] Already loading for this user, skipping...');
            return;
        }

        loadingRef.current = true;
        console.log('[AuthContext] Loading ALL data for user:', userId);

        try {
            // Load profile first (includes health_profile_complete)
            const { data: profileData, error: profileError } = await getProfile(userId);
            if (profileError) {
                console.error('[AuthContext] Error fetching profile:', profileError);
            } else if (profileData) {
                console.log('[AuthContext] Profile loaded:', profileData.id);
                setProfile(profileData);
            }

            // Load health profile - always set data since getHealthProfile returns default on error
            const { data: healthData, error: healthError } = await getHealthProfile(userId);
            if (healthError) {
                console.error('[AuthContext] Error fetching health profile:', healthError);
            }
            // Always set healthProfile if we have data (getHealthProfile always returns data)
            if (healthData) {
                console.log('[AuthContext] Health profile loaded, complete:', healthData.health_profile_complete, 'weight:', healthData.weight_lbs);
                setHealthProfile(healthData);
            } else {
                console.warn('[AuthContext] No health data returned, setting default');
                setHealthProfile({
                    weight_lbs: undefined,
                    height_inches: undefined,
                    birth_year: undefined,
                    activity_level: undefined,
                    medical_conditions: [],
                    health_notes: '',
                    health_profile_complete: false,
                });
            }

            // Load pain context
            const { data: painData, error: painError } = await getPainContext(userId);
            if (painError) {
                console.log('[AuthContext] No pain context found (normal for new users)');
            } else if (painData) {
                console.log('[AuthContext] Pain context loaded');
                setPainContext({
                    pain_areas: painData.pain_areas || [],
                    pain_triggers: painData.pain_triggers || [],
                    goals: painData.goals || [],
                });
            }

            lastLoadedUserId.current = userId;
        } catch (error) {
            console.error('[AuthContext] Exception loading data:', error);
        } finally {
            console.log('[AuthContext] Setting loading to false');
            loadingRef.current = false;
            setLoading(false);
        }
    };

    const refreshProfile = async () => {
        if (user) {
            lastLoadedUserId.current = null; // Force reload
            await loadAllData(user.id);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setHealthProfile(null);
        setPainContext(null);
        lastLoadedUserId.current = null;
    };

    return (
        <AuthContext.Provider
            value={{
                session,
                user,
                profile,
                healthProfile,
                painContext,
                loading,
                signOut,
                refreshProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
