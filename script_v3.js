import { db } from "./js/firebase-config.js";
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import Lenis from "https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/+esm";

/* ... (Lenis and Canvas code remains same) ... */

function normalizeStack(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
        return value
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
    }
    return [];
}

function normalizeLogTags(raw) {
    let tags = [];
    if (Array.isArray(raw)) {
        tags = raw.map(tag => tag.trim()).filter(Boolean);
    } else if (typeof raw === "string") {
        tags = raw.split(",").map(tag => tag.trim()).filter(Boolean);
    }
    return tags.length ? tags : ["SYSTEM"];
}

// 4. DEV LOGS
async function loadDevLogs() {
    const container = document.getElementById("devlogs-container");
    if (!container) return;

    try {
        const q = query(collection(db, "dev_logs"), orderBy("created_at", "desc"), limit(6));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = `<div class="devlog-empty">// NOTHING DEPLOYED YET</div>`;
            return;
        }

        const html = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const tags = normalizeLogTags(data.tags);
            const createdLabel = formatLogTimestamp(data.created_at);
            const updatedLabel = data.updated_at ? formatLogTimestamp(data.updated_at) : null;

            return `
                <article class="devlog-card">
                    <div class="devlog-meta">
                        <div class="devlog-timeblock">
                            <span class="devlog-time">${escapeHtml(createdLabel)}</span>
                            ${updatedLabel ? `<span class="devlog-updated">Edited ${escapeHtml(updatedLabel)}</span>` : ""}
                        </div>
                        <div class="devlog-tags">
                            ${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}
                        </div>
                    </div>
                    <p class="devlog-message">${escapeHtml(data.message || "Untitled update")}</p>
                </article>
            `;
        }).join("");

        container.innerHTML = html;
    } catch (error) {
        console.error("Dev Logs Error", error);
        container.innerHTML = `<div class="devlog-empty">// FAILED_TO_LOAD_LOGS</div>`;
    }
}

// 2b. STATS GRID
async function loadStats() {
    const grid = document.getElementById("stats-grid");
    if (!grid) return;

    const fallback = [
        { value: "1+", label: "YEARS EXP" },
        { value: "C#", label: "CORE LANGS" },
        { value: "6+", label: "SHIPS" }
    ];

    try {
        const q = query(collection(db, "stats"), orderBy("order"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            grid.innerHTML = ""; // No stats configured, show nothing
            return;
        }

        const statsData = snapshot.docs.map(docSnap => ({
            value: docSnap.data().value || "-",
            label: (docSnap.data().label || "").toUpperCase()
        }));

        grid.innerHTML = statsData.map(stat => `
            <div class="stat-box">
                <h3>${escapeHtml(stat.value)}</h3>
                <p>${escapeHtml(stat.label)}</p>
            </div>
        `).join("");
    } catch (error) {
        console.error("Failed to load stats", error);
        grid.innerHTML = fallback.map(stat => `
            <div class="stat-box">
                <h3>${escapeHtml(stat.value)}</h3>
                <p>${escapeHtml(stat.label)}</p>
            </div>
        `).join("");
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatLogTimestamp(timestamp) {
    if (!timestamp) return "Just now";
    let date;
    try {
        date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    } catch (error) {
        date = new Date();
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function setupProjectDescriptionToggles(container) {
    if (!container) return;

    container.querySelectorAll(".project-body").forEach(body => {
        const desc = body.querySelector(".project-desc");
        const toggle = body.querySelector(".project-desc-toggle");
        if (!desc || !toggle) return;

        desc.classList.remove("collapsible", "expanded");
        toggle.classList.remove("visible");
        toggle.textContent = "MORE";
        toggle.setAttribute("aria-expanded", "false");

        requestAnimationFrame(() => {
            const needsToggle = desc.scrollHeight > desc.clientHeight + 4 || desc.textContent.length > 180;
            if (!needsToggle) return;

            desc.classList.add("collapsible");
            toggle.classList.add("visible");
        });

        toggle.addEventListener("click", () => {
            const isExpanded = desc.classList.toggle("expanded");
            desc.classList.toggle("collapsible", !isExpanded);
            toggle.textContent = isExpanded ? "LESS" : "MORE";
            toggle.setAttribute("aria-expanded", String(isExpanded));
        });

        desc.addEventListener("wheel", (event) => {
            if (!desc.classList.contains("expanded")) return;
            event.stopPropagation();
        }, { passive: true });

        desc.addEventListener("touchmove", (event) => {
            if (!desc.classList.contains("expanded")) return;
            event.stopPropagation();
        }, { passive: true });
    });
}

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
            container.innerHTML = `<div class="terminal-text" style="text-align:center;">No projects found.</div>`;
            return;
        }

        let html = "";
        displayData.forEach(data => {
            const stack = normalizeStack(data.stack);
            const stackHtml = stack.map(tech => `<span class="tech-tag">${tech}</span>`).join("");
            
            html += `
                <div class="project-row">
                    <!-- ICON -->
                    <div class="project-icon-container">
                        ${data.icon_url ? `<img src="${data.icon_url}" class="project-icon" alt="${data.title}">` : '<div style="color:#333;">NO_IMG</div>'}
                    </div>

                      <!-- CONTENT -->
                    <div class="project-content">
                        <h3 class="project-title">${data.title}</h3>
                        <div class="project-meta">
                            <span class="project-type">${data.type || ""}</span>
                            <div class="project-tags">${stackHtml}</div>
                        </div>
                        
                        <div class="project-body">
                            <p class="project-desc">${escapeHtml(data.description || "")}</p>
                            <button class="project-desc-toggle" type="button" aria-expanded="false">MORE</button>
                        </div>
                    </div>

                    <!-- ACTION (FAR RIGHT) -->
                    <div class="project-action">
                        ${(() => {
                            let targetLink = data.link || "#";
                            let targetTarget = "_blank";
                            
                            if (data.type === "3D Model" || data.type === "Model") {
                                targetLink = `model/id=${data.id}`;
                                targetTarget = "_self"; // Open in same tab
                            }
                            
                            return `<a href="${targetLink}" target="${targetTarget}" class="btn-access" style="width:100%; text-align:center;">Open</a>`;
                        })()}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        setupProjectDescriptionToggles(container);

    } catch (error) {
        console.error("Error loading projects:", error);
        container.innerHTML = `<div class="terminal-text" style="text-align:center;">Couldn’t load projects.</div>`;
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
                        ${items.map(item => `<li><span>${item}</span></li>`).join("")}
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
                        <h3>${data.role}</h3>
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

// --- DOM ELEMENTS ---
// INIT
document.addEventListener("DOMContentLoaded", async () => {
    const toggle = document.getElementById("theme-toggle");
    if (toggle) {
        const prefersReducedMotion = () => {
            try {
                return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            } catch (e) {
                return false;
            }
        };

        const getNextTheme = () => {
            const isLight = document.documentElement.getAttribute("data-theme") === "light";
            return isLight ? "dark" : "light";
        };

        const applyTheme = (theme) => {
            if (theme === "light") {
                document.documentElement.setAttribute("data-theme", "light");
                try { localStorage.setItem("theme", "light"); } catch (e) {}
                return;
            }

            document.documentElement.removeAttribute("data-theme");
            try { localStorage.setItem("theme", "dark"); } catch (e) {}
        };

        const runThemeWipe = async (theme) => {
            if (!document.startViewTransition || prefersReducedMotion()) {
                applyTheme(theme);
                return;
            }

            const rect = toggle.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const maxX = Math.max(x, window.innerWidth - x);
            const maxY = Math.max(y, window.innerHeight - y);
            const radius = Math.ceil(Math.hypot(maxX, maxY));

            const transition = document.startViewTransition(() => {
                applyTheme(theme);
            });

            await transition.ready;

            const clipPath = [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${radius}px at ${x}px ${y}px)`,
            ];

            document.documentElement.animate(
                {
                    clipPath: clipPath,
                },
                {
                    duration: 650,
                    easing: "cubic-bezier(0.25, 1, 0.5, 1)",
                    pseudoElement: "::view-transition-new(root)",
                }
            );
        };

        const renderToggle = () => {
            const isLight = document.documentElement.getAttribute("data-theme") === "light";
            toggle.setAttribute("aria-pressed", isLight ? "true" : "false");
            toggle.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
            toggle.innerHTML = `<div class="icon-wrapper">${isLight
                ? '<iconify-icon icon="lucide:moon" aria-hidden="true"></iconify-icon>'
                : '<iconify-icon icon="lucide:sun" aria-hidden="true"></iconify-icon>'}</div>`;
        };

        renderToggle();

        toggle.addEventListener("click", async () => {
            const next = getNextTheme();
            await runThemeWipe(next);
            renderToggle();
        });
    }

    loadStats();
    loadTechStack();
    loadProjects();
    loadExperience();
    loadDevLogs();
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

// Glitch effect disabled for minimal theme.


