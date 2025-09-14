// src/stripe-backend/api/ai-chat.js
export default async function handler(req, res) {
    // Verify user has premium subscription
    const { userId, messages, context } = req.body;

    // Check if user is premium
    const isPremium = await checkUserPremiumStatus(userId);
    if (!isPremium) {
        return res.status(403).json({ error: 'Premium subscription required' });
    }

    // Make request to DeepSeek with YOUR API key
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages })
    });

    return res.json(await response.json());
}