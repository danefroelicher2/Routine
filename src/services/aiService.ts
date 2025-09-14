// ============================================
// AI SERVICE - EMERGENCY TOKEN LEAK FIX
// Replace your existing src/services/aiService.ts with this
// ============================================

import { ScheduleContext } from '../types/database';

interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export class AIService {
    private apiKey: string;
    private apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    private model = 'deepseek-chat';

    constructor() {
        // 🚨 CRITICAL FIX: Remove hardcoded API key completely
        this.apiKey = '';

        // Load from environment only if available (will be empty in production)
        const envKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY;
        if (envKey && envKey !== 'your_deepseek_api_key_here') {
            this.apiKey = envKey;
        }
    }

    /**
     * Update API key - called from settings screen
     */
    updateApiKey(newKey: string) {
        this.apiKey = newKey.trim();
    }

    /**
     * Check if API key is configured
     */
    isConfigured(): boolean {
        return this.apiKey.length > 0 && this.apiKey.startsWith('sk-');
    }

    /**
     * 🚨 FIXED: Lightweight connection test that doesn't waste tokens
     * Only uses ~10 tokens instead of hundreds
     */
    async testConnection(): Promise<boolean> {
        if (!this.isConfigured()) {
            console.warn('AI API key not configured');
            return false;
        }

        try {
            console.log('🔍 Testing AI connection (minimal tokens)...');

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'user', content: 'Hi' } // Minimal test - only ~5 tokens
                    ],
                    temperature: 0,
                    max_tokens: 5, // 🚨 CRITICAL: Limit response to 5 tokens max
                }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ AI connection test successful (minimal cost)');
                return data.choices && data.choices[0]?.message?.content;
            } else {
                console.error('❌ AI connection test failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ AI connection test error:', error);
            return false;
        }
    }

    async sendMessage(
        messages: AIMessage[],
        scheduleContext?: ScheduleContext,
        userId?: string
    ): Promise<string> {
        // For premium users, use backend proxy
        if (userId) {
            try {
                const response = await fetch('https://routine-payments-v4-m0v469p3g-dane-froelichers-projects.vercel.app/api/ai-chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId,
                        messages,
                        scheduleContext
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Backend AI service failed');
                }

                const data = await response.json();
                return data.message;
            } catch (error) {
                console.error('❌ Backend AI error:', error);
                // Fallback to direct API if backend fails
                console.log('🔄 Falling back to direct API...');
            }
        }

        // Fallback to direct DeepSeek API (for users with their own keys)
        if (!this.isConfigured()) {
            throw new Error('AI not configured. Please set up your API key in AI Settings or upgrade to Premium.');
        }

        try {
            // Build system message with user context
            const systemMessage = this.buildSystemMessage(scheduleContext);

            // Prepare messages with system context
            const fullMessages = [
                { role: 'system' as const, content: systemMessage },
                ...messages
            ];

            // 🚨 CRITICAL: Log exactly what we're sending to track usage
            const totalInputTokens = this.estimateTokens(fullMessages);
            console.log('🤖 Sending to DeepSeek (direct):', {
                messageCount: fullMessages.length,
                estimatedInputTokens: totalInputTokens,
                hasContext: !!scheduleContext,
                timestamp: new Date().toISOString()
            });

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: fullMessages,
                    temperature: 0.7,
                    max_tokens: 1000,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ DeepSeek API error:', response.status, errorText);
                throw new Error(`AI API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            // 🚨 CRITICAL: Log token usage from response
            if (data.usage) {
                console.log('💰 Token usage:', {
                    prompt_tokens: data.usage.prompt_tokens,
                    completion_tokens: data.usage.completion_tokens,
                    total_tokens: data.usage.total_tokens,
                    estimated_cost_usd: (data.usage.total_tokens * 0.00014 / 1000).toFixed(4)
                });
            }

            if (data.choices && data.choices[0]?.message?.content) {
                return data.choices[0].message.content;
            } else {
                throw new Error('Invalid response format from AI');
            }

        } catch (error) {
            console.error('❌ AI API error:', error);
            throw new Error(`Failed to get AI response: ${error.message}`);
        }
    }
    /**
     * 🆕 NEW: Estimate token count to prevent surprises
     */
    private estimateTokens(messages: AIMessage[]): number {
        // Rough estimation: ~4 characters per token
        const totalText = messages.map(m => m.content).join(' ');
        return Math.ceil(totalText.length / 4);
    }

    /**
     * Build system message with user's routine context
     * 🚨 FIXED: Reduced context size to save tokens
     */
    private buildSystemMessage(scheduleContext?: ScheduleContext): string {
        let systemMessage = `You are an AI assistant for a routine management app. Help users optimize their daily routines with concise, actionable advice.`;

        if (scheduleContext) {
            const user = scheduleContext.user_profile;
            const routines = scheduleContext.routines;

            // 🚨 REDUCED: Shorter context to save tokens
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

            if (scheduleContext.target_day) {
                systemMessage += `\nFocus day: ${scheduleContext.target_day}`;
            }

            systemMessage += `\n\nKeep responses helpful but concise.`;
        }

        return systemMessage;
    }
}

// Export singleton instance
export const aiService = new AIService();