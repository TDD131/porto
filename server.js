const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_FALLBACK = path.join(__dirname, 'public');
const STATIC_DIR = fs.existsSync(PUBLIC_FALLBACK) ? PUBLIC_FALLBACK : __dirname;

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

app.use(express.static(STATIC_DIR, { dotfiles: 'ignore' }));

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
