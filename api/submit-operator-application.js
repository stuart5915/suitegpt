// Submit App Operator Application API
// POST /api/submit-operator-application
// Handles new operator applications from the become-operator page

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role key for admin access
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://getsuite.app',
    'https://www.getsuite.app',
    'http://localhost:3000',
    'http://localhost:5500'
];

// Validate email format
function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
    // CORS headers
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            discord_id,
            discord_username,
            telegram_id,
            email,
            preferred_app_slug,
            motivation,
            experience,
            hours_per_week,
            referral_source,
            wallet_address
        } = req.body;

        // Validation
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }

        if (!preferred_app_slug) {
            return res.status(400).json({ error: 'Please select an app to operate' });
        }

        if (!motivation || motivation.trim().length < 20) {
            return res.status(400).json({ error: 'Please provide a motivation (at least 20 characters)' });
        }

        // Check if user has already applied for this app
        if (discord_id || telegram_id) {
            const { data: existingApp } = await supabase
                .from('app_operator_applications')
                .select('id, status')
                .eq('preferred_app_slug', preferred_app_slug)
                .or(`discord_id.eq.${discord_id || 'null'},telegram_id.eq.${telegram_id || 'null'}`)
                .in('status', ['pending', 'under_review', 'accepted'])
                .single();

            if (existingApp) {
                return res.status(400).json({
                    error: 'You already have an active application for this app',
                    existingStatus: existingApp.status
                });
            }
        }

        // Check if app already has an active operator
        const { data: existingOperator } = await supabase
            .from('app_operators')
            .select('id')
            .eq('app_slug', preferred_app_slug)
            .eq('status', 'active')
            .single();

        if (existingOperator) {
            return res.status(400).json({
                error: 'This app already has an operator. Please select a different app.'
            });
        }

        // Insert application
        const { data: application, error: insertError } = await supabase
            .from('app_operator_applications')
            .insert({
                discord_id: discord_id || null,
                discord_username: discord_username || null,
                telegram_id: telegram_id || null,
                email: email.toLowerCase().trim(),
                wallet_address: wallet_address || null,
                preferred_app_slug,
                motivation: motivation.trim(),
                experience: experience?.trim() || null,
                hours_per_week: hours_per_week || 10,
                referral_source: referral_source || null,
                status: 'pending'
            })
            .select()
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);

            // Check for duplicate constraint
            if (insertError.code === '23505') {
                return res.status(400).json({
                    error: 'You have already submitted an application'
                });
            }

            return res.status(500).json({ error: 'Failed to submit application' });
        }

        console.log('New operator application:', application.id, 'for app:', preferred_app_slug);

        // Optional: Send notification to Discord/Slack webhook
        // await notifyNewApplication(application);

        return res.status(200).json({
            success: true,
            applicationId: application.id,
            message: 'Application submitted successfully'
        });

    } catch (error) {
        console.error('Submit application error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
