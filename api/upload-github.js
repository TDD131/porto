const multer = require('multer');
const fetch = require('node-fetch');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB
});

// Wrap multer for serverless usage
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            resolve(result);
        });
    });
}

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        await runMiddleware(req, res, upload.single('file'));

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { githubToken, githubOwner, githubRepo, githubTag } = req.body;

        if (!githubToken || !githubOwner || !githubRepo || !githubTag) {
            return res.status(400).json({ error: 'Missing GitHub configuration. Check settings.' });
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

        // Step 2: Check if asset with same name already exists and delete it
        const fileName = req.file.originalname;
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

        // Step 3: Upload the file as a release asset
        const uploadUrl = `https://uploads.github.com/repos/${githubOwner}/${githubRepo}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`;

        const uploadResp = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/octet-stream',
                'Content-Length': req.file.size
            },
            body: req.file.buffer
        });

        if (!uploadResp.ok) {
            const errData = await uploadResp.json().catch(() => ({}));
            return res.status(uploadResp.status).json({ error: errData.message || 'Upload to GitHub failed' });
        }

        const assetData = await uploadResp.json();
        const downloadUrl = `https://github.com/${githubOwner}/${githubRepo}/releases/download/${githubTag}/${encodeURIComponent(fileName)}`;

        res.json({
            download_url: downloadUrl,
            browser_download_url: assetData.browser_download_url,
            size: assetData.size,
            name: assetData.name
        });
    } catch (error) {
        console.error('GitHub upload error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Vercel config: disable body parser so multer can handle multipart
module.exports.config = {
    api: {
        bodyParser: false,
    },
};
