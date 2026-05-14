# Product Overview

Personal portfolio website for Tristan Davin Dakara, a game developer and engineer. The site showcases projects, experience, dev logs, and services with a brutalist/cyber-interface aesthetic.

## Key Features

- **Homepage** (index.html): Hero section, about, services/tech stack, experience timeline, dev logs, project showcase with filtering and expand/collapse
- **Works page** (works.html): Full project gallery with grid/list view toggle and category filtering
- **3D Model Viewer** (model.html): Sketchfab embed viewer with multi-angle image thumbnails, lightbox, and cinematic UI
- **Admin Panel** (admin.html): Firebase-authenticated CMS for managing projects, stats, experience entries, dev logs, and API settings
- **Theme Toggle**: Dark/light mode with view-transition API circular wipe animation
- **Page Transitions**: Fade transitions between pages with reduced-motion support

## Content is Dynamic

All portfolio content (projects, experience, stats, dev logs, tech stack) is stored in Firebase Firestore and loaded client-side. The admin panel is the CMS for managing this content.

## Design Language

- Dark-first with warm cream light mode
- Brutalist/minimal aesthetic with monospace accents
- Rounded corners (border-radius: 16-18px on cards)
- Subtle borders, no heavy shadows
- Smooth micro-interactions with CSS transitions
- Respects `prefers-reduced-motion`
