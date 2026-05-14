const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_FALLBACK = path.join(__dirname, 'public');
const STATIC_DIR = fs.existsSync(PUBLIC_FALLBACK) ? PUBLIC_FALLBACK : __dirname;

// Multer setup for file uploads (memory storage)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB max (practical limit for memory-based upload)
});

const BLOCKED_PATHS = [
    /^\/admin_creds/i,
    /^\/\.git/i,
    /^\/\.env/i,
    /^\/firebase\.[^/]+$/i,
    /^\/storage\.rules$/i,
    /^\/cors\.json$/i
];

app.use((req, res, next) => {
    if (BLOCKED_PATHS.some((pattern) => pattern.test(req.path))) {
        return res.status(404).end();
    }
    next();
});

// Parse JSON bodies
app.use(express.json());

// CORS middleware for API endpoints
app.use('/api', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.static(STATIC_DIR, { dotfiles: 'ignore' }));

// Cloudinary upload endpoint
app.post('/api/upload-cloudinary', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { cloudName, apiKey, apiSecret } = req.body;

        if (!cloudName || !apiKey || !apiSecret) {
            return res.status(400).json({ error: 'Missing Cloudinary credentials' });
        }

        // Create form data for Cloudinary
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });
        formData.append('api_key', apiKey);
        
        // Generate timestamp
        const timestamp = Math.round(Date.now() / 1000);
        formData.append('timestamp', timestamp);

        // Generate signature
        const crypto = require('crypto');
        const signatureString = `timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash('sha1').update(signatureString).digest('hex');
        formData.append('signature', signature);

        // Upload to Cloudinary
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || 'Upload failed' });
        }

        res.json({ secure_url: data.secure_url });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GitHub Releases upload endpoint (for .blend files)
app.post('/api/upload-github', upload.single('file'), async (req, res) => {
    try {
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

        // Return the direct download URL
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
});

// Rewrite rule: /model/id=xyz -> /model.html?id=xyz
app.get('/model/id=:id', (req, res) => {
    const { id } = req.params;
    res.redirect(`/model.html?id=${encodeURIComponent(id)}`);
});

// Graceful fallback for unknown routes
app.use((req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Access model viewer at: http://localhost:${PORT}/model/id=YOUR_PROJECT_ID`);
});
