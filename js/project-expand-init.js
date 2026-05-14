// Initialize project expand/collapse functionality
// This script patches the existing loadProjects function

import { initProjectExpand, getProjectLimit, updateProjectControls, resetExpandState } from "./project-expand.js";

// Store original loadProjects function
let originalLoadProjects = null;
let cachedProjectsData = null;

// Override the global loadProjects if it exists
function patchLoadProjects() {
    // Wait for script_v3.js to load
    const checkInterval = setInterval(() => {
        if (window.loadProjectsOriginal || document.getElementById('projects-container')) {
            clearInterval(checkInterval);
            
            // Initialize expand buttons
            initProjectExpand();
            
            // Listen for expand/collapse events
            window.addEventListener('projectExpandChange', (e) => {
                // Trigger filter change to reload projects
                const filterSelect = document.getElementById('project-filter');
                if (filterSelect) {
                    filterSelect.dispatchEvent(new Event('change'));
                }
            });
            
            // Patch filter listener to reset expand state
            const filterSelect = document.getElementById('project-filter');
            if (filterSelect) {
                filterSelect.addEventListener('change', () => {
                    resetExpandState();
                });
            }
        }
    }, 100);
    
    // Clear interval after 5 seconds to prevent infinite loop
    setTimeout(() => clearInterval(checkInterval), 5000);
}

// Run patch on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchLoadProjects);
} else {
    patchLoadProjects();
}
