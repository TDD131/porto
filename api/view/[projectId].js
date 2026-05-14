const crypto = require('crypto');

// In-memory store (resets on cold start — acceptable for rate limiting)
const VIEW_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const viewerStore = {};

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.socket?.remoteAddress || 'unknown';
}

function hashIp(ip) {
    return crypto.createHash('sha256').update(ip + 'portfolio_salt_v1').digest('hex').slice(0, 16);
}

module.exports = function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { projectId } = req.query;

    if (!projectId || !/^[\w-]{1,128}$/.test(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
    }

    const ip = getClientIp(req);
    const ipHash = hashIp(ip);
    const now = Date.now();

    if (!viewerStore[projectId]) viewerStore[projectId] = {};

    const lastSeen = viewerStore[projectId][ipHash];
    const cooldownActive = lastSeen && (now - lastSeen < VIEW_COOLDOWN_MS);

    if (cooldownActive) {
        return res.json({ counted: false });
    }

    viewerStore[projectId][ipHash] = now;
    return res.json({ counted: true });
};
