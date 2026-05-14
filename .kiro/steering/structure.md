# Project Structure

```
/                         # Root — also the static file directory served by Express
├── index.html            # Main portfolio homepage
├── works.html            # Full project gallery page
├── model.html            # 3D model viewer page (Sketchfab embed + image fallback)
├── admin.html            # Admin CMS panel (Firebase Auth protected)
├── style.css             # Single global stylesheet (all pages share this)
├── script_v3.js          # Main homepage JS module (Firebase data loading, Lenis, theme toggle)
├── server.js             # Express dev server + API proxy endpoints
├── package.json          # Node dependencies (express, multer, node-fetch, firebase-tools)
├── vercel.json           # Vercel hosting config (rewrites, redirects)
├── firebase.json         # Firebase hosting config
├── storage.rules         # Firebase Storage security rules
├── cors.json             # CORS config for Firebase Storage
├── Z-StartServer.cmd     # Windows batch file to start dev server
│
├── js/                   # JavaScript modules
│   ├── firebase-config.js    # Firebase app initialization + exports (auth, db, storage)
│   ├── admin.js              # Admin panel logic (CRUD, uploads, API validation)
│   ├── project-expand.js     # Project list expand/collapse logic
│   ├── project-expand-init.js # Project expand initialization
│   ├── fuzzy-text.js         # Fuzzy text animation effect
│   ├── particles.js          # Particle background effect (disabled)
│   └── target-cursor.js      # Custom cursor effect
│
├── .firebase/            # Firebase cache
├── .vercel/              # Vercel project config
└── node_modules/         # npm dependencies (server-side only)
```

## Architecture Notes

- **No SPA router** — each page is a separate HTML file with its own inline scripts + module imports
- **Shared CSS** — `style.css` contains styles for all pages; page-specific styles are in `<style>` blocks (model.html)
- **Firebase config** is centralized in `js/firebase-config.js` and imported by all modules
- **Server** serves static files from root directory and provides API proxy endpoints for Cloudinary and GitHub uploads
- **Blocked paths** — server.js blocks access to sensitive files (admin_creds, .git, .env, firebase config, storage rules)

## Firestore Collections

- `projects` — portfolio projects (title, type, description, stack, icon_url, link, model_views, sketchfab_uid, pinned)
- `experience` — work experience timeline entries
- `tech_stack` — services/skills cards (category + name)
- `stats` — stat boxes on homepage (value + label + order)
- `dev_logs` — dev log entries (message, tags, timestamps)
- `admin_settings` — per-user API keys and config (Cloudinary, GitHub, Gemini, Sketchfab)
