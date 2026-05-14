const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { githubToken, githubOwner, githubRepo, githubTag, fileName } = req.body;

        if (!githubToken || !githubOwner || !githubRepo || !githubTag || !fileName) {
            return res.status(400).json({ error: 'Missing GitHub configuration or fileName.' });
        }

        // Step 1: Get the release by tag
        const releaseResp = await fetch(
            `https://api.github.com/repos/${githubOwner}/${githubRepo}/releases/tags/${githubTag}`,
            {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            }
        );

        if (!releaseResp.ok) {
            const errData = await releaseResp.json().catch(() => ({}));
            if (releaseResp.status === 404) {
                return res.status(404).json({ error: `Release with tag "${githubTag}" not found. Create it on GitHub first.` });
            }
            return res.status(releaseResp.status).json({ error: errData.message || 'Failed to get release' });
        }

        const release = await releaseResp.json();
        const releaseId = release.id;

        // Step 2: Delete existing asset with same name if it exists
        const existingAsset = release.assets?.find(a => a.name === fileName);
        if (existingAsset) {
            await fetch(
                `https://api.github.com/repos/${githubOwner}/${githubRepo}/releases/assets/${existingAsset.id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                }
            );
        }

        // Step 3: Return the upload URL and download URL for the client to use directly
        const uploadUrl = `https://uploads.github.com/repos/${githubOwner}/${githubRepo}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`;
        const downloadUrl = `https://github.com/${githubOwner}/${githubRepo}/releases/download/${githubTag}/${encodeURIComponent(fileName)}`;

        res.json({
            uploadUrl,
            downloadUrl,
            token: githubToken // Pass back so client can use it in the direct upload
        });
    } catch (error) {
        console.error('GitHub URL prep error:', error);
        res.status(500).json({ error: error.message });
    }
};
