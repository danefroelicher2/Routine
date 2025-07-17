// ============================================
// AI SERVICE - SAVE AS src/services/aiService.ts
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
        this.apiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || '';
    }

    /**
     * Test connection to DeepSeek API
     */
    async testConnection(): Promise<boolean> {
        try {
            const response = await this.sendMessage([
                { role: 'user', content: 'Respond with just "OK"' }
            ]);
            return response.toLowerCase().includes('ok');
        } catch (error) {
            console.error('AI connection test failed:', error);
            return false;
        }
    }

    /**
     * Send message to AI with user context
     */
    async sendMessage(
        messages: AIMessage[],
        scheduleContext?: ScheduleContext
    ): Promise<string> {
        if (!this.apiKey) {
            throw new Error('API key not configured. Please add EXPO_PUBLIC_DEEPSEEK_API_KEY to your .env file.');
        }

        try {
            // Build system message with user context
            const systemMessage = this.buildSystemMessage(scheduleContext);

            // Prepare messages with system context
            const fullMessages = [
                { role: 'system' as const, content: systemMessage },
                ...messages
            ];

            console.log('🤖 Sending to DeepSeek:', {
                messageCount: fullMessages.length,
                hasContext: !!scheduleContext
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
                    max_tokens: 2000,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            if (data.choices && data.choices[0]?.message?.content) {
                return data.choices[0].message.content;
            } else {
                throw new Error('Invalid response format from AI');
            }

        } catch (error) {
            console.error('AI API error:', error);
            throw new Error(`Failed to get AI response: ${error.message}`);
        }
    }

    /**
     * Build system message with user's routine context
     */
    private buildSystemMessage(scheduleContext?: ScheduleContext): string {
        let systemMessage = `You are an AI assistant integrated into a routine management app. You help users optimize their daily and weekly routines for better productivity and goal achievement.

Your capabilities:
- Analyze user routines and suggest improvements
- Recommend schedule optimizations
- Provide motivational advice based on streaks and progress
- Help users stay on track with their goals
- Answer questions about productivity and habit formation

Guidelines:
- Be encouraging and supportive
- Provide actionable, specific advice
- Consider the user's current routine when making suggestions
- Keep responses concise but helpful (2-3 paragraphs max)
- Focus on sustainable improvements rather than dramatic changes`;

        if (scheduleContext) {
            systemMessage += `\n\nCurrent User Context:
- Display Name: ${scheduleContext.user_profile.display_name}
- Current Streak: ${scheduleContext.user_profile.current_streak} days
- Longest Streak: ${scheduleContext.user_profile.longest_streak} days`;

            if (scheduleContext.routines && scheduleContext.routines.length > 0) {
                systemMessage += `\n\nUser's Active Routines:`;

                scheduleContext.routines.forEach((routine, index) => {
                    systemMessage += `\n${index + 1}. ${routine.name}`;
                    if (routine.description) {
                        systemMessage += ` - ${routine.description}`;
                    }

                    if (routine.is_daily && routine.scheduled_days.length > 0) {
                        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                        const scheduledDayNames = routine.scheduled_days.map(day => dayNames[day]).join(', ');
                        systemMessage += ` (Scheduled: ${scheduledDayNames})`;
                    } else if (routine.is_weekly) {
                        systemMessage += ` (Weekly routine)`;
                    }

                    if (routine.target_value && routine.target_unit) {
                        systemMessage += ` [Target: ${routine.target_value} ${routine.target_unit}]`;
                    }
                });
            } else {
                systemMessage += `\n\nThe user hasn't set up any routines yet. Encourage them to start with 1-2 simple daily habits.`;
            }

            if (scheduleContext.target_day !== null) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                systemMessage += `\n\nCurrently focused on: ${dayNames[scheduleContext.target_day]} schedule`;
            }
        }

        return systemMessage;
    }

    /**
     * Update API key
     */
    updateApiKey(apiKey: string) {
        this.apiKey = apiKey;
    }
}

// Export singleton instance
export const aiService = new AIService();