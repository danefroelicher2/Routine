export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    // Simple test - no imports, no dependencies
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    
    const sig = req.headers["stripe-signature"];
    
    if (!sig) {
        return res.status(400).json({ 
            error: "Missing stripe-signature header",
            headers: Object.keys(req.headers),
            method: req.method
        });
    }
    
    return res.status(200).json({ message: "Webhook received" });
}
