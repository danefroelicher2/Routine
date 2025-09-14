// src/stripe-backend/api/ai-chat.js
// AI PROXY SERVICE - Routes premium users through YOUR DeepSeek key

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    console.log('🤖 AI Chat API called');
    console.log('📦 Method:', req.method);
    console.log('📦 Body:', req.body);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { userId, messages, scheduleContext } = req.body;

        if (!userId || !messages) {
            res.status(400).json({ error: 'Missing userId or messages' });
            return;
        }

        // Check if user has premium subscription with AI access
        console.log('🔍 Checking subscription for user:', userId);

        const { data: subscription, error: subError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();

        if (subError && subError.code !== 'PGRST116') {
            console.error('❌ Database error:', subError);
            res.status(500).json({ error: 'Database query failed' });
            return;
        }

        if (!subscription) {
            console.log('❌ No active subscription found');
            res.status(403).json({ error: 'Premium subscription required' });
            return;
        }

        // Check if subscription includes AI access
        const hasAIAccess = subscription.plan_id === 'premiumAI';

        if (!hasAIAccess) {
            console.log('❌ Subscription does not include AI access');
            res.status(403).json({ error: 'AI access requires Premium AI subscription' });
            return;
        }

        console.log('✅ User has AI access, proceeding with request');

        // Build system message
        let systemMessage = `You are an AI assistant for a routine management app. Help users optimize their daily routines with concise, actionable advice.`;

        if (scheduleContext) {
            const user = scheduleContext.user_profile;
            const routines = scheduleContext.routines;

            systemMessage += `\n\nUser: ${user.display_name}`;

            if (user.current_streak > 0) {
                systemMessage += `\nCurrent streak: ${user.current_streak} days`;
            }

            if (routines && routines.length > 0) {
                systemMessage += `\nActive routines: ${routines.slice(0, 3).map(r => r.name).join(', ')}`;
                if (routines.length > 3) {
                    systemMessage += ` (+${routines.length - 3} more)`;
                }
            }

            systemMessage += `\n\nKeep responses helpful but concise.`;
        }

        // Prepare messages for DeepSeek
        const fullMessages = [
            { role: 'system', content: systemMessage },
            ...messages
        ];

        console.log('🚀 Calling DeepSeek API with YOUR key');

        // Call DeepSeek API with YOUR API key
        const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`, // YOUR API key
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: fullMessages,
                temperature: 0.7,
                max_tokens: 1000,
            }),
        });

        if (!deepseekResponse.ok) {
            const errorText = await deepseekResponse.text();
            console.error('❌ DeepSeek API error:', deepseekResponse.status, errorText);
            res.status(500).json({ error: 'AI service temporarily unavailable' });
            return;
        }

        const data = await deepseekResponse.json();

        // Log token usage for monitoring
        if (data.usage) {
            console.log('💰 Token usage for user', userId, ':', {
                prompt_tokens: data.usage.prompt_tokens,
                completion_tokens: data.usage.completion_tokens,
                total_tokens: data.usage.total_tokens,
                estimated_cost_usd: (data.usage.total_tokens * 0.00014 / 1000).toFixed(6)
            });
        }

        if (data.choices && data.choices[0]?.message?.content) {
            res.status(200).json({
                message: data.choices[0].message.content,
                usage: data.usage
            });
        } else {
            console.error('❌ Invalid DeepSeek response format');
            res.status(500).json({ error: 'Invalid AI response format' });
        }

    } catch (error) {
        console.error('❌ AI Chat API error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}