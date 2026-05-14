// Project Expand/Collapse Logic
let isProjectExpanded = false;
const INITIAL_PROJECT_LIMIT = 3;
const EXPANDED_PROJECT_LIMIT = 6;

export function initProjectExpand() {
    const expandBtn = document.getElementById("expand-btn");
    const collapseBtn = document.getElementById("collapse-btn");
    
    if (expandBtn) {
        expandBtn.addEventListener("click", () => {
            isProjectExpanded = true;
            const currentFilter = document.getElementById("project-filter")?.value || "ALL";
            // Trigger reload with expanded state
            window.dispatchEvent(new CustomEvent('projectExpandChange', { 
                detail: { expanded: true, filter: currentFilter } 
            }));
        });
    }

    if (collapseBtn) {
        collapseBtn.addEventListener("click", () => {
            isProjectExpanded = false;
            const currentFilter = document.getElementById("project-filter")?.value || "ALL";
            // Trigger reload with collapsed state
            window.dispatchEvent(new CustomEvent('projectExpandChange', { 
                detail: { expanded: false, filter: currentFilter } 
            }));
            
            // Scroll to projects section
            const projectsSection = document.getElementById("projects");
            if (projectsSection) {
                projectsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
}

export function getProjectLimit() {
    return isProjectExpanded ? EXPANDED_PROJECT_LIMIT : INITIAL_PROJECT_LIMIT;
}

export function getInitialLimit() {
    return INITIAL_PROJECT_LIMIT;
}

export function updateProjectControls(showing, total) {
    const controls = document.getElementById("project-controls");
    const expandBtn = document.getElementById("expand-btn");
    const expandedControls = document.getElementById("expanded-controls");
    
    if (!controls || !expandBtn || !expandedControls) return;

    // Show controls only if there are more than INITIAL_LIMIT projects
    if (total > INITIAL_PROJECT_LIMIT) {
        controls.style.display = "flex";
        
        if (isProjectExpanded) {
            expandBtn.style.display = "none";
            expandedControls.style.display = "flex";
        } else {
            expandBtn.style.display = "block";
            expandedControls.style.display = "none";
        }
    } else {
        controls.style.display = "none";
    }
}

export function resetExpandState() {
    isProjectExpanded = false;
}
