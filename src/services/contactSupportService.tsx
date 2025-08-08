// ============================================
// CONTACT SUPPORT SERVICE
// Create this as src/services/contactSupportService.ts
// ============================================

import { supabase } from './supabase';

export interface ContactSupportMessage {
    id: string;
    user_id: string | null;
    name: string;
    email: string;
    message: string;
    status: 'new' | 'in_progress' | 'resolved' | 'closed';
    created_at: string;
    updated_at: string;
    user_agent?: string;
    ip_address?: string;
}

export interface ContactFormSubmission {
    name: string;
    email: string;
    message: string;
    user_id?: string | null;
}

class ContactSupportService {
    /**
     * Submit a new contact form message
     */
    async submitContactForm(formData: ContactFormSubmission): Promise<ContactSupportMessage> {
        try {
            const { data, error } = await supabase
                .from('contact_support_messages')
                .insert([{
                    user_id: formData.user_id || null,
                    name: formData.name.trim(),
                    email: formData.email.trim().toLowerCase(),
                    message: formData.message.trim(),
                    status: 'new',
                }])
                .select()
                .single();

            if (error) {
                console.error('Error submitting contact form:', error);
                throw new Error('Failed to submit contact form');
            }

            return data;
        } catch (error) {
            console.error('Contact form submission error:', error);
            throw error;
        }
    }

    /**
     * Get all contact messages (for admin view)
     * You can call this function to see all submitted messages
     */
    async getAllContactMessages(
        status?: 'new' | 'in_progress' | 'resolved' | 'closed',
        limit: number = 50,
        offset: number = 0
    ): Promise<ContactSupportMessage[]> {
        try {
            let query = supabase
                .from('contact_support_messages')
                .select('*')
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching contact messages:', error);
                throw new Error('Failed to fetch contact messages');
            }

            return data || [];
        } catch (error) {
            console.error('Get contact messages error:', error);
            throw error;
        }
    }

    /**
     * Get contact messages for a specific user
     */
    async getUserContactMessages(userId: string): Promise<ContactSupportMessage[]> {
        try {
            const { data, error } = await supabase
                .from('contact_support_messages')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching user contact messages:', error);
                throw new Error('Failed to fetch user contact messages');
            }

            return data || [];
        } catch (error) {
            console.error('Get user contact messages error:', error);
            throw error;
        }
    }

    /**
     * Update the status of a contact message
     */
    async updateContactMessageStatus(
        messageId: string,
        status: 'new' | 'in_progress' | 'resolved' | 'closed'
    ): Promise<void> {
        try {
            const { error } = await supabase
                .from('contact_support_messages')
                .update({ status })
                .eq('id', messageId);

            if (error) {
                console.error('Error updating contact message status:', error);
                throw new Error('Failed to update contact message status');
            }
        } catch (error) {
            console.error('Update contact message status error:', error);
            throw error;
        }
    }

    /**
     * Delete a contact message
     */
    async deleteContactMessage(messageId: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('contact_support_messages')
                .delete()
                .eq('id', messageId);

            if (error) {
                console.error('Error deleting contact message:', error);
                throw new Error('Failed to delete contact message');
            }
        } catch (error) {
            console.error('Delete contact message error:', error);
            throw error;
        }
    }

    /**
     * Get message statistics (for admin dashboard)
     */
    async getContactMessageStats(): Promise<{
        total: number;
        new: number;
        in_progress: number;
        resolved: number;
        closed: number;
    }> {
        try {
            const { data, error } = await supabase
                .from('contact_support_messages')
                .select('status');

            if (error) {
                console.error('Error fetching contact message stats:', error);
                throw new Error('Failed to fetch contact message stats');
            }

            const stats = {
                total: data?.length || 0,
                new: 0,
                in_progress: 0,
                resolved: 0,
                closed: 0,
            };

            data?.forEach(message => {
                stats[message.status as keyof typeof stats]++;
            });

            return stats;
        } catch (error) {
            console.error('Get contact message stats error:', error);
            throw error;
        }
    }

    /**
     * Search contact messages by email or name
     */
    async searchContactMessages(searchTerm: string): Promise<ContactSupportMessage[]> {
        try {
            const { data, error } = await supabase
                .from('contact_support_messages')
                .select('*')
                .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error searching contact messages:', error);
                throw new Error('Failed to search contact messages');
            }

            return data || [];
        } catch (error) {
            console.error('Search contact messages error:', error);
            throw error;
        }
    }
}

// Export a singleton instance
export const contactSupportService = new ContactSupportService();