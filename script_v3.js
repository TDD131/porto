import { db } from "./js/firebase-config.js";
import { collection, getDocs, query, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import Lenis from "https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/+esm";

/* ... (Lenis and Canvas code remains same) ... */

// --- FIREBASE DATA FETCHING ---

// 1. PROJECTS
// CACHE
let cachedProjects = null;

async function loadProjects(filterType = "ALL") {
    const container = document.getElementById("projects-container");
    if (!container) return; // Silent fail if not found

    try {
        // FETCH ONLY ONCE
        if (!cachedProjects) {
            const q = query(collection(db, "projects"), orderBy("created_at", "desc"));
            const querySnapshot = await getDocs(q);
            cachedProjects = [];
            querySnapshot.forEach((doc) => {
                cachedProjects.push({ id: doc.id, ...doc.data() });
            });
        }

        // FILTER
        const displayData = filterType === "ALL" 
            ? cachedProjects 
            : cachedProjects.filter(p => p.type === filterType);

        // RENDER
        if (displayData.length === 0) {
            container.innerHTML = `<div class="terminal-text" style="color:red; text-align:center;">> SYSTEM_EMPTY: NO_DATA_FOUND</div>`;
            return;
        }

        let html = "";
        displayData.forEach(data => {
            const stackHtml = (data.stack || []).map(tech => `<span class="tech-tag">${tech}</span>`).join("");
            
            html += `
                <div class="project-row">
                    <!-- ICON -->
                    <div class="project-icon-container">
                        ${data.icon_url ? `<img src="${data.icon_url}" class="project-icon" alt="${data.title}">` : '<div style="color:#333;">NO_IMG</div>'}
                    </div>

                      <!-- CONTENT -->
                    <div class="project-content">
                        <!-- HEADER ROW 1: Title & Status -->
                        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:5px;">
                            <h3 class="project-title" style="margin:0; line-height:1;">${data.title}</h3>
                            ${data.status ? `<span class="status-badge ${data.status.toLowerCase()}">${data.status}</span>` : ''}
                        </div>

                        <!-- HEADER ROW 2: Type & Stack -->
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px dashed #333; padding-bottom:15px; margin-bottom:15px;">
                            <span class="project-type" style="margin:0;">${data.type}</span>
                            <span style="font-family:var(--font-code); font-size:0.9rem; color:var(--text-dim); text-align:right;">${(Array.isArray(data.stack) ? data.stack : []).join(", ")}</span>
                        </div>
                        
                        <div class="project-body">
                            <p class="project-desc">${data.description}</p>
                        </div>
                    </div>

                    <!-- ACTION (FAR RIGHT) -->
                    <div class="project-action">
                        <a href="${data.link}" target="_blank" class="btn-access" style="width:100%; text-align:center;">ACCESS ></a>
                    </div>
                </div>
            `;
            // The original code had `index++` here, but `index` was not defined.
            // Assuming it was a leftover or intended for a different purpose,
            // and not directly related to the requested change, it's removed
            // to maintain consistency with the provided snippet and avoid errors.
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading projects:", error);
        container.innerHTML = `<div class="terminal-text" style="color:red; text-align:center;">> ERROR: CONNECTION_LOST</div>`;
    }
}

// Attach Filter Listener
document.addEventListener("DOMContentLoaded", () => {
    const filter = document.getElementById("project-filter");
    if(filter) {
        filter.addEventListener("change", (e) => loadProjects(e.target.value));
    }
});

// 2. TECH STACK
async function loadTechStack() {
    const container = document.getElementById("stack-grid");
    if(!container) return; // Fail silently

    try {
        const q = query(collection(db, "tech_stack"), orderBy("category"));
        const snapshot = await getDocs(q);
        if(snapshot.empty) return; 

        container.innerHTML = ""; 
        const groups = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            let cat = data.category ? data.category.toUpperCase() : "OTHERS";
            
            // AUTO-MIGRATE OLD/SINGULAR TO PLURAL LAYOUT
            if (cat === "CORE" || cat === "ENGINE") cat = "ENGINES";
            if (cat === "FRONTEND" || cat === "LANGUAGE") cat = "LANGUAGES";
            if (cat === "BACKEND") cat = "TOOLS";

            if(!groups[cat]) groups[cat] = [];
            groups[cat].push(data.name);
        });

        // DEFINED ORDER
        const sortOrder = ["ENGINES", "LANGUAGES", "TOOLS"];
        
        // Sort keys based on defined order, then append others
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            const indexA = sortOrder.indexOf(a);
            const indexB = sortOrder.indexOf(b);
            
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });

        for (const category of sortedKeys) {
            const items = groups[category];
            const html = `
                <div class="stack-card">
                    <div class="card-header">// ${category}</div>
                    <ul>
                        ${items.map(item => `<li><span>${item}</span><span style="color: var(--accent);">READY</span></li>`).join("")}
                    </ul>
                </div>
            `;
            container.innerHTML += html;
        }
    } catch (e) { console.log("Stack Error:", e); }
}

// 3. EXPERIENCE TIMELINE
async function loadExperience() {
    const container = document.getElementById("experience-container");
    if(!container) return;

    try {
        console.log("Loading Experience...");
        const q = query(collection(db, "experience"), orderBy("created_at", "desc"));
        const snapshot = await getDocs(q);
        
        console.log("Experience Docs:", snapshot.size);

        if (snapshot.empty) {
            container.innerHTML = `<div class="timeline-item"><div class="time-content"><h3>NO DATA FOUND</h3></div></div>`;
            return;
        }

        let fullHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Format Contributions
            let contribHTML = "";
            if(data.contributions) {
                const listItems = data.contributions.split('\n').map(line => `<li>${line}</li>`).join('');
                contribHTML = `
                    <div class="log-contrib">
                         <h4>Key Contributions:</h4>
                        <ul>${listItems}</ul>
                    </div>
                `;
            }

            fullHTML += `
                <div class="timeline-item">
                    <div class="time-marker">${data.period}</div>
                    <div class="time-content">
                        <h3>${data.role} @ <span style="color:var(--accent)">${data.company}</span></h3>
                        ${data.focus ? `<p class="log-focus"><strong>Focus:</strong> ${data.focus}</p>` : ''}
                        <p class="description">${data.description}</p>
                        ${contribHTML}
                    </div>
                </div>
            `;
        });
        container.innerHTML = fullHTML;

    } catch(e) { 
        console.error("Exp Error:", e);
        container.innerHTML = `<div class="timeline-item"><div class="time-content"><h3 style="color:red">ERROR LOADING: ${e.message}</h3></div></div>`;
    }
}

import { FuzzyText } from "./js/fuzzy-text.js";
import { Particles } from "./js/particles.js";
import { TargetCursor } from "./js/target-cursor.js";

// --- DOM ELEMENTS ---
// INIT
document.addEventListener("DOMContentLoaded", async () => {
    // -1. INIT CUSTOM CURSOR
    new TargetCursor({
        targetSelector: 'a, button, .btn-brutal, .nav-links a, input, .clickable'
    });
    
    // Force Hide Default Cursor globally
    const style = document.createElement('style');
    style.innerHTML = '* { cursor: none !important; }';
    document.head.appendChild(style);

    // 0. INIT PARTICLES BACKGROUND
    const particlesContainer = document.getElementById("particles-container");
    if(particlesContainer) {
        new Particles(particlesContainer, {
            particleCount: 200,
            particleSpread: 10,
            speed: 0.1,
            particleColors: ['#ffffff', '#ffffff', '#888888'],
            moveParticlesOnHover: true,
            particleHoverFactor: 1,
            particleBaseSize: 50,
            sizeRandomness: 1,
            pixelRatio: window.devicePixelRatio || 1
        });
    }

    // 1. INIT TEXT SCRAMBLE
    const titleElements = document.querySelectorAll(".hero-title"); 
    
    // REPLACE HERO TITLE "PROGRAMMER" WITH FUZZY TEXT
    // Target the specific element for "PROGRAMMER"
    const programmerTitle = document.querySelector(".hero-title.layer2");
    
    if(programmerTitle) {
        // We want to apply the effect TO this element.
        // The FuzzyText class appends a canvas to the element.
        // We should ensure the element is visible and has dimensions.
        
        new FuzzyText(programmerTitle, {
            fontSize: 'inherit', // Will take from CSS
            fontWeight: 900,
            fontFamily: 'inherit',
            color: '#ffffff',
            enableHover: true,
            baseIntensity: 0,   // INTENSITAS DIAM (0 = Clean, 0.1 = Noise dikit)
            hoverIntensity: 0.6,// INTENSITAS HOVER (0.5 = Sedang, 0.9 = Rusak Parah)
            fuzzRange: 10,      // JARAK GESER PIXEL (makin besar makin ambyar)
            direction: 'horizontal' 
        });
    }

    loadTechStack();
    loadProjects();
    loadExperience();
});

/* 
   Script V3 - Canvas Effects & Interactive Elements
   NOW WITH: Heavy Momentum Scroll (Lenis) & Realtime Firebase Data
*/

// Initialize Lenis with EXACT Reference Configuration
const lenis = new Lenis({
    duration: 2.0, // EXACT VALUE from research (creates the "heavy" feel)
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Custom ExpoOut easing
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1, // Reset to standard to match reference
    smoothTouch: false, // Ref site disables smooth touch for native feel
    touchMultiplier: 2,
});

function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Resize handling (Canvas Background)
const canvas = document.getElementById('bg-canvas');
// Check if canvas exists (might be missing in some views)
if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();
}

// FPS Counter Simulator
const fpsEl = document.getElementById('fps-counter');
if (fpsEl) {
    setInterval(() => {
        const fps = Math.floor(Math.random() * (61 - 58) + 58); 
        fpsEl.innerText = fps;
    }, 1000); 
}

// Glitch effect (Super Optimized)
const glitchHeaders = document.querySelectorAll('.cyber-glitch'); // Updated selector

function triggerGlitch() {
    if (Math.random() > 0.85) { 
        const header = glitchHeaders[Math.floor(Math.random() * glitchHeaders.length)];
        // Safety check if element exists
        if (!header) return;

        const x = Math.random() * 6 - 3;
        const y = Math.random() * 4 - 2;
        
        requestAnimationFrame(() => {
            header.style.transform = `translate(${x}px, ${y}px)`;
            setTimeout(() => {
                header.style.transform = 'translate(0, 0)';
            }, 60);
        });
    }
}

// Check for glitches less frequently
setInterval(triggerGlitch, 500);


