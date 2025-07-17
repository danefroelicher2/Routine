// ============================================
// CHAT SERVICE - SAVE AS src/services/chatService.ts
// ============================================

import { supabase } from './supabase';
import { ChatSession, ChatMessage, ScheduleContext } from '../types/database';

export class ChatService {
    /**
     * Create a new chat session
     */
    async createChatSession(userId: string, title: string = 'New Chat'): Promise<ChatSession> {
        const { data, error } = await supabase
            .from('chat_sessions')
            .insert({
                user_id: userId,
                title,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating chat session:', error);
            throw new Error('Failed to create chat session');
        }

        return data;
    }

    /**
     * Get all chat sessions for a user
     */
    async getChatSessions(userId: string): Promise<ChatSession[]> {
        const { data, error } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching chat sessions:', error);
            throw new Error('Failed to fetch chat sessions');
        }

        return data || [];
    }

    /**
     * Get messages for a specific chat session
     */
    async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching chat messages:', error);
            throw new Error('Failed to fetch chat messages');
        }

        return data || [];
    }

    /**
     * Add a message to a chat session
     */
    async addMessage(
        sessionId: string,
        userId: string,
        role: 'user' | 'assistant' | 'system',
        content: string,
        metadata: Record<string, any> = {}
    ): Promise<ChatMessage> {
        const { data, error } = await supabase
            .from('chat_messages')
            .insert({
                session_id: sessionId,
                user_id: userId,
                role,
                content,
                metadata,
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding chat message:', error);
            throw new Error('Failed to add chat message');
        }

        return data;
    }

    /**
     * Update chat session title
     */
    async updateChatSessionTitle(sessionId: string, title: string): Promise<void> {
        const { error } = await supabase
            .from('chat_sessions')
            .update({ title })
            .eq('id', sessionId);

        if (error) {
            console.error('Error updating chat session title:', error);
            throw new Error('Failed to update chat session title');
        }
    }

    /**
     * Delete a chat session (soft delete)
     */
    async deleteChatSession(sessionId: string): Promise<void> {
        const { error } = await supabase
            .from('chat_sessions')
            .update({ is_active: false })
            .eq('id', sessionId);

        if (error) {
            console.error('Error deleting chat session:', error);
            throw new Error('Failed to delete chat session');
        }
    }

    /**
     * Get user's schedule context for AI
     */
    async getUserScheduleContext(userId: string, targetDay?: number): Promise<ScheduleContext> {
        try {
            const { data, error } = await supabase.rpc('get_user_schedule_context', {
                target_user_id: userId,
                target_day: targetDay,
            });

            if (error) {
                console.error('Error fetching user schedule context:', error);
                return this.getBasicUserContext(userId);
            }

            return data || this.getBasicUserContext(userId);
        } catch (error) {
            console.error('Error in getUserScheduleContext:', error);
            return this.getBasicUserContext(userId);
        }
    }

    /**
     * Fallback method to get basic user context
     */
    private async getBasicUserContext(userId: string): Promise<ScheduleContext> {
        try {
            // Get user profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('display_name, full_name, current_streak, longest_streak')
                .eq('id', userId)
                .single();

            // Get user routines
            const { data: routines } = await supabase
                .from('user_routines')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true);

            // Get day assignments
            const { data: dayAssignments } = await supabase
                .from('user_day_routines')
                .select('routine_id, day_of_week')
                .eq('user_id', userId);

            return {
                user_profile: {
                    display_name: profile?.display_name || profile?.full_name || 'User',
                    current_streak: profile?.current_streak || 0,
                    longest_streak: profile?.longest_streak || 0,
                },
                routines: (routines || []).map(routine => {
                    const scheduledDays = (dayAssignments || [])
                        .filter(da => da.routine_id === routine.id)
                        .map(da => da.day_of_week);

                    return {
                        name: routine.name,
                        description: routine.description || '',
                        icon: routine.icon || '',
                        is_daily: routine.is_daily || false,
                        is_weekly: routine.is_weekly || false,
                        target_value: routine.target_value || 1,
                        target_unit: routine.target_unit || '',
                        scheduled_days: scheduledDays,
                    };
                }),
                target_day: null,
                generated_at: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Error building basic user context:', error);
            return {
                user_profile: {
                    display_name: 'User',
                    current_streak: 0,
                    longest_streak: 0,
                },
                routines: [],
                target_day: null,
                generated_at: new Date().toISOString(),
            };
        }
    }

    /**
     * Generate a smart title for a chat session
     */
    generateChatTitle(firstMessage: string): string {
        const message = firstMessage.toLowerCase();

        if (message.includes('monday') || message.includes('tuesday') ||
            message.includes('wednesday') || message.includes('thursday') ||
            message.includes('friday') || message.includes('saturday') ||
            message.includes('sunday')) {
            return 'Daily Schedule Discussion';
        }

        if (message.includes('routine') || message.includes('habit')) {
            return 'Routine Optimization';
        }

        if (message.includes('productive') || message.includes('efficiency')) {
            return 'Productivity Discussion';
        }

        if (message.includes('motivat') || message.includes('streak')) {
            return 'Motivation & Progress';
        }

        if (message.includes('improve') || message.includes('better')) {
            return 'Improvement Strategies';
        }

        // Fallback: use first few words
        const words = firstMessage.trim().split(' ').slice(0, 4).join(' ');
        return words.length > 20 ? words.substring(0, 20) + '...' : words || 'New Chat';
    }
}

// Export singleton instance
export const chatService = new ChatService();