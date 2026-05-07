import { auth, db, storage } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// CLOUDINARY CONFIG - Session Storage
let CLOUD_NAME = sessionStorage.getItem('cloudinary_name') || '';
let UPLOAD_PRESET = sessionStorage.getItem('cloudinary_preset') || '';

// API Keys - Session Storage
let GEMINI_API_KEY = sessionStorage.getItem('gemini_key') || '';
let SKETCHFAB_API_TOKEN = sessionStorage.getItem('sketchfab_key') || '';

// DOM Elements
const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("btn-logout");
const addProjectForm = document.getElementById("add-project-form");
const projectList = document.getElementById("admin-project-list");
const loginMsg = document.getElementById("login-msg");
const loader = document.getElementById("upload-loader");
const aiBtn = document.getElementById("btn-ai-desc");
const aiStatus = document.getElementById("ai-desc-status");

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const keyInput = document.getElementById('gemini-api-key');
    const sfKeyInput = document.getElementById('sketchfab-api-token');
    const cnameInput = document.getElementById('cloudinary-name');
    const cpresetInput = document.getElementById('cloudinary-preset');
    
    if (keyInput && GEMINI_API_KEY) {
        keyInput.value = GEMINI_API_KEY;
        // Check cached validation status instead of re-validating
        const cachedStatus = sessionStorage.getItem('gemini_key_valid');
        const statusEl = document.getElementById('gemini-status');
        if (cachedStatus === 'valid') {
            statusEl.innerHTML = '<span style="color: #00ff88; font-weight: bold;">✓ VALID (cached)</span>';
        } else if (cachedStatus === 'invalid') {
            statusEl.innerHTML = '<span style="color: #ff4444;">✗ INVALID (cached)</span>';
        }
    }
    
    if (sfKeyInput && SKETCHFAB_API_TOKEN) {
        sfKeyInput.value = SKETCHFAB_API_TOKEN;
        // Check cached validation status instead of re-validating
        const cachedStatus = sessionStorage.getItem('sketchfab_key_valid');
        const statusEl = document.getElementById('sketchfab-status');
        if (cachedStatus === 'valid') {
            statusEl.innerHTML = '<span style="color: #00ff88; font-weight: bold;">✓ VALID (cached)</span>';
        } else if (cachedStatus === 'invalid') {
            statusEl.innerHTML = '<span style="color: #ff4444;">✗ INVALID (cached)</span>';
        }
    }
    
    if (cnameInput && CLOUD_NAME) cnameInput.value = CLOUD_NAME;
    if (cpresetInput && UPLOAD_PRESET) cpresetInput.value = UPLOAD_PRESET;

    // Auto-save on input (no validation)
    keyInput?.addEventListener('input', (e) => {
        GEMINI_API_KEY = e.target.value;
        sessionStorage.setItem('gemini_key', GEMINI_API_KEY);
        // Clear cached validation when key changes
        sessionStorage.removeItem('gemini_key_valid');
        document.getElementById('gemini-status').innerHTML = '';
        // Remove error message if exists
        const configItem = e.target.closest('.config-item');
        const existingError = configItem?.querySelector('.api-error-msg');
        if (existingError) existingError.remove();
    });

    sfKeyInput?.addEventListener('input', (e) => {
        SKETCHFAB_API_TOKEN = e.target.value;
        sessionStorage.setItem('sketchfab_key', SKETCHFAB_API_TOKEN);
        // Clear cached validation when key changes
        sessionStorage.removeItem('sketchfab_key_valid');
        document.getElementById('sketchfab-status').innerHTML = '';
        // Remove error message if exists
        const configItem = e.target.closest('.config-item');
        const existingError = configItem?.querySelector('.api-error-msg');
        if (existingError) existingError.remove();
    });

    cnameInput?.addEventListener('input', (e) => {
        CLOUD_NAME = e.target.value;
        sessionStorage.setItem('cloudinary_name', CLOUD_NAME);
    });

    cpresetInput?.addEventListener('input', (e) => {
        UPLOAD_PRESET = e.target.value;
        sessionStorage.setItem('cloudinary_preset', UPLOAD_PRESET);
    });

    // Initialize the type-switch and per-slot upload logic after DOM is ready.
    setupTypeSwitch();
    initModelViewSlots();
});

// --- TYPE SWITCH: Shows/hides asset panels based on project category ---
function handleTypeSwitch() {
    const is3D = this.value === '3D Model';
    const stdPanel = document.getElementById('standard-asset-panel');
    const mdlPanel = document.getElementById('model3d-asset-panel');
    const iconInput = document.getElementById('p-icon');
    const linkInput = document.getElementById('p-link');

    if (stdPanel) stdPanel.style.display = is3D ? 'none' : 'block';
    if (mdlPanel) mdlPanel.style.display = is3D ? 'block' : 'none';

    // Toggle required attrs to prevent HTML5 validation from blocking hidden fields.
    if (iconInput) iconInput.required = false;
    if (linkInput) linkInput.required = !is3D;
}

function setupTypeSwitch() {
    const typeSelect = document.getElementById('p-type');
    if (!typeSelect) return;
    typeSelect.addEventListener('change', handleTypeSwitch);
    // Run once on init to set correct panel state based on default value.
    handleTypeSwitch.call(typeSelect);
}

// --- API VALIDATION ---
// Make functions globally accessible for inline onclick handlers
window.validateGemini = async function(key) {
    const status = document.getElementById('gemini-status');
    const inputRow = document.getElementById('gemini-api-key').parentElement;
    const configItem = inputRow.closest('.config-item') || inputRow;
    
    // Remove existing error message
    const existingError = configItem.querySelector('.api-error-msg');
    if (existingError) existingError.remove();
    
    if (!key) { status.innerHTML = ''; return; }
    status.innerHTML = '<span style="color: #555;">CHECKING...</span>';
    
    try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': key 
            },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] })
        });
        
        if (resp.ok) {
            status.innerHTML = '<span style="color: #00ff88; font-weight: bold;">✓ VALID</span>';
            sessionStorage.setItem('gemini_key_valid', 'valid');
        } else {
            const errBody = await resp.json().catch(() => ({}));
            console.error("Gemini Validation Error Details:", JSON.stringify(errBody, null, 2));
            
            let errorMsg = 'Invalid API key';
            if (resp.status === 429) {
                errorMsg = 'Rate limit exceeded. Try again later or check your quota.';
            } else if (errBody.error?.message) {
                errorMsg = errBody.error.message;
            }
            
            status.innerHTML = `<span style="color: #ff4444;">✗ INVALID (${resp.status})</span>`;
            sessionStorage.setItem('gemini_key_valid', 'invalid');
            
            // Add error message below input
            const errorDiv = document.createElement('div');
            errorDiv.className = 'api-error-msg';
            errorDiv.style.cssText = 'color: #ff4444; font-size: 0.75rem; margin-top: 5px;';
            errorDiv.textContent = errorMsg;
            configItem.appendChild(errorDiv);
        }
    } catch (e) { 
        console.error("Gemini Connection Error:", e);
        status.innerHTML = '<span style="color: #ff4444;">ERROR</span>';
        sessionStorage.setItem('gemini_key_valid', 'invalid');
        
        // Add error message below input
        const errorDiv = document.createElement('div');
        errorDiv.className = 'api-error-msg';
        errorDiv.style.cssText = 'color: #ff4444; font-size: 0.75rem; margin-top: 5px;';
        errorDiv.textContent = 'Connection error. Check your network.';
        configItem.appendChild(errorDiv);
    }
}

window.validateSketchfab = async function(token) {
    const status = document.getElementById('sketchfab-status');
    const inputRow = document.getElementById('sketchfab-api-token').parentElement;
    const configItem = inputRow.closest('.config-item') || inputRow;
    
    // Remove existing error message
    const existingError = configItem.querySelector('.api-error-msg');
    if (existingError) existingError.remove();
    
    if (!token) { status.innerHTML = ''; return; }
    status.innerHTML = '<span style="color: #555;">CHECKING...</span>';
    
    try {
        const resp = await fetch('https://api.sketchfab.com/v3/me', {
            headers: { 'Authorization': `Token ${token}` }
        });
        if (resp.ok) {
            status.innerHTML = '<span style="color: #00ff88; font-weight: bold;">✓ VALID</span>';
            sessionStorage.setItem('sketchfab_key_valid', 'valid');
        } else {
            status.innerHTML = '<span style="color: #ff4444;">✗ INVALID</span>';
            sessionStorage.setItem('sketchfab_key_valid', 'invalid');
            
            // Add error message below input
            const errorDiv = document.createElement('div');
            errorDiv.className = 'api-error-msg';
            errorDiv.style.cssText = 'color: #ff4444; font-size: 0.75rem; margin-top: 5px;';
            errorDiv.textContent = 'Invalid token or insufficient permissions.';
            configItem.appendChild(errorDiv);
        }
    } catch (e) { 
        status.innerHTML = '<span style="color: #ff4444;">ERROR</span>'; 
        sessionStorage.setItem('sketchfab_key_valid', 'invalid');
        
        // Add error message below input
        const errorDiv = document.createElement('div');
        errorDiv.className = 'api-error-msg';
        errorDiv.style.cssText = 'color: #ff4444; font-size: 0.75rem; margin-top: 5px;';
        errorDiv.textContent = 'Connection error. Check your network.';
        configItem.appendChild(errorDiv);
    }
}

// --- PER-SLOT IMAGE UPLOAD: Wires a single view-angle slot to auto-upload on file selection ---
/**
 * Sets up a single view angle upload slot.
 * On file change: shows local preview immediately, uploads to Cloudinary, auto-fills URL input,
 * and if this is the 'front' slot, also auto-fills the hidden p-icon field for Firestore.
 * @param {string} angleKey - One of: front, back, left, right, top, bottom
 */
function setupModelViewSlot(angleKey) {
    const fileInput   = document.getElementById(`file-${angleKey}`);
    const urlInput    = document.getElementById(`url-${angleKey}`);
    const statusEl   = document.getElementById(`status-${angleKey}`);
    const previewEl  = document.getElementById(`preview-${angleKey}`);
    if (!fileInput || !urlInput) return;

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;

        // Immediately show local blob preview before upload completes.
        previewEl.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="preview">`;
        statusEl.textContent  = 'UPLOADING...';
        statusEl.className    = 'slot-status uploading';
        fileInput.disabled    = true;

        try {
            const cloudUrl = await uploadToCloudinary(file);
            urlInput.value        = cloudUrl;
            // Replace blob preview with stable Cloudinary URL.
            previewEl.innerHTML = `<img src="${cloudUrl}" alt="preview">`;
            statusEl.textContent  = 'UPLOADED';
            statusEl.className    = 'slot-status done';

            // Auto-set icon_url from front view for Firestore thumbnail.
            if (angleKey === 'front') {
                const iconInput = document.getElementById('p-icon');
                if (iconInput) iconInput.value = cloudUrl;
            }
        } catch (err) {
            statusEl.textContent = 'FAILED: ' + err.message;
            statusEl.className   = 'slot-status error';
        } finally {
            fileInput.disabled = false;
        }
    });
}

function initModelViewSlots() {
    ['front', 'back', 'left', 'right', 'top', 'bottom'].forEach(setupModelViewSlot);
}

// --- AI GENERATION ---
async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

aiBtn?.addEventListener("click", async () => {
    if (!GEMINI_API_KEY) {
        alert("Gemini API Key is required!");
        return;
    }

    const title    = document.getElementById("p-title").value;
    const type     = document.getElementById("p-type").value;
    // Read stack from pill picker; fall back to hidden input for edge cases.
    const stackArr = getSelectedStack();
    const stack    = stackArr.length > 0 ? stackArr.join(", ") : "Unknown";
    // For 3D Model, use the front-view file for image analysis; otherwise use icon file.
    const iconFile = type === "3D Model"
        ? document.getElementById("file-front")?.files[0]
        : document.getElementById("p-icon-file").files[0];

    if (!title) {
        alert("Please enter a project title first!");
        return;
    }

    aiBtn.disabled = true;
    aiStatus.textContent = "AI IS THINKING...";
    aiStatus.className = "ai-status-msg";

    try {
        let prompt = `Write a professional, concise, and engaging description for a portfolio project.
Title: ${title}
Category: ${type}
Tech Stack: ${stack}

The description should be briefly highlighting the core features and your role. Use professional tone. Output ONLY the description text, no markdown, no quotes.`;

        if (type === "3D Model") {
            prompt += "\nFocus on the visual style, geometry, and craftsmanship of the 3D model.";
        }

        const contents = [{
            parts: [{ text: prompt }]
        }];

        if (iconFile) {
            aiStatus.textContent = "AI IS ANALYZING IMAGE...";
            const base64Data = await fileToBase64(iconFile);
            contents[0].parts.push({
                inline_data: {
                    mime_type: iconFile.type,
                    data: base64Data
                }
            });
            prompt += "\nBased on the attached image, describe the visual style accurately.";
            contents[0].parts[0].text = prompt; // Update text part with more context
        }

        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY
            },
            body: JSON.stringify({ contents })
        });

        const data = await resp.json();
        const aiText = data.candidates[0].content.parts[0].text;

        document.getElementById("p-desc").value = aiText.trim();
        aiStatus.textContent = "DONE ✓";
        aiStatus.className = "ai-status-msg success";
    } catch (err) {
        console.error("AI Error:", err);
        aiStatus.textContent = "AI FAILED";
        aiStatus.className = "ai-status-msg error";
    } finally {
        aiBtn.disabled = false;
    }
});

// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginPanel.style.display = "none";
        dashboard.style.display = "block";
        subscribeToProjects();
        subscribeToExperience();
        subscribeToLogs();
        populateStackPicker(); // Populate tech stack pills from DB on login.
    } else {
        loginPanel.style.display = "block";
        dashboard.style.display = "none";
    }
});

// --- STACK PICKER: Multi-select dropdown with checkboxes ---
/**
 * Populates the multi-select dropdown with tech stack options
 */
function populateStackPicker() {
    const dropdown = document.getElementById('p-stack-dropdown');
    const trigger = document.getElementById('p-stack-trigger');
    const optionsContainer = document.getElementById('p-stack-options');
    const countDisplay = document.getElementById('p-stack-selected-count');
    
    if (!dropdown || !trigger || !optionsContainer || !countDisplay) return;

    // Toggle dropdown open/close
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
        optionsContainer.style.display = dropdown.classList.contains('open') ? 'block' : 'none';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
            optionsContainer.style.display = 'none';
        }
    });

    // Populate options from Firestore
    const q = query(collection(db, 'tech_stack'), orderBy('name'));
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            optionsContainer.innerHTML = '<div class="dropdown-option" style="cursor: default;">No modules available</div>';
            return;
        }

        // Get currently selected items
        const selectedItems = getSelectedStack();

        optionsContainer.innerHTML = '';
        snapshot.forEach(docSnap => {
            const techName = docSnap.data().name;
            const isSelected = selectedItems.includes(techName);

            const option = document.createElement('div');
            option.className = 'dropdown-option' + (isSelected ? ' selected' : '');
            option.innerHTML = `
                <input type="checkbox" ${isSelected ? 'checked' : ''} value="${techName}">
                <span>${techName}</span>
            `;

            // Handle checkbox click
            const checkbox = option.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
                updateSelectedCount();
            });

            // Handle option click (toggle checkbox)
            option.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    if (checkbox.checked) {
                        option.classList.add('selected');
                    } else {
                        option.classList.remove('selected');
                    }
                    updateSelectedCount();
                }
            });

            optionsContainer.appendChild(option);
        });
    });

    function updateSelectedCount() {
        const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]:checked');
        const count = checkboxes.length;
        countDisplay.textContent = count === 0 ? '0 selected' : `${count} selected`;
    }
}

/**
 * Reads all currently-selected checkboxes from the multi-select dropdown
 * @returns {string[]} Array of selected tech stack names
 */
function getSelectedStack() {
    const optionsContainer = document.getElementById('p-stack-options');
    if (!optionsContainer) return [];
    
    const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * Populates multi-select dropdown for edit form with pre-selected state
 * @param {string} projectId - The project ID for unique selector
 * @param {string[]} selectedStack - Array of already selected tech stack items
 */
function populateEditStackPicker(projectId, selectedStack) {
    const dropdown = document.getElementById(`edit-stack-dropdown-${projectId}`);
    const trigger = document.getElementById(`edit-stack-trigger-${projectId}`);
    const optionsContainer = document.getElementById(`edit-stack-options-${projectId}`);
    const countDisplay = document.getElementById(`edit-stack-selected-count-${projectId}`);
    
    if (!dropdown || !trigger || !optionsContainer || !countDisplay) return;

    // Toggle dropdown open/close
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
        optionsContainer.style.display = dropdown.classList.contains('open') ? 'block' : 'none';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
            optionsContainer.style.display = 'none';
        }
    });

    // Populate options from Firestore
    const q = query(collection(db, 'tech_stack'), orderBy('name'));
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            optionsContainer.innerHTML = '<div class="dropdown-option" style="cursor: default;">No modules available</div>';
            return;
        }

        optionsContainer.innerHTML = '';
        snapshot.forEach(docSnap => {
            const techName = docSnap.data().name;
            const isSelected = selectedStack.includes(techName);

            const option = document.createElement('div');
            option.className = 'dropdown-option' + (isSelected ? ' selected' : '');
            option.innerHTML = `
                <input type="checkbox" ${isSelected ? 'checked' : ''} value="${techName}">
                <span>${techName}</span>
            `;

            // Handle checkbox click
            const checkbox = option.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
                updateSelectedCount();
            });

            // Handle option click (toggle checkbox)
            option.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    if (checkbox.checked) {
                        option.classList.add('selected');
                    } else {
                        option.classList.remove('selected');
                    }
                    updateSelectedCount();
                }
            });

            optionsContainer.appendChild(option);
        });

        // Initial count update
        updateSelectedCount();
    });

    function updateSelectedCount() {
        const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]:checked');
        const count = checkboxes.length;
        countDisplay.textContent = count === 0 ? '0 selected' : `${count} selected`;
    }
}

/**
 * Gets selected checkboxes from edit form multi-select dropdown
 * @param {string} projectId - The project ID for unique selector
 * @returns {string[]} Array of selected tech stack names
 */
function getSelectedEditStack(projectId) {
    const optionsContainer = document.getElementById(`edit-stack-options-${projectId}`);
    if (!optionsContainer) return [];
    
    const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    loginMsg.textContent = "AUTHENTICATING...";
    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginMsg.textContent = "ACCESS GRANTED";
    } catch (error) {
        loginMsg.textContent = "ACCESS DENIED: " + error.code;
    }
});

logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
});

// --- TAB NAVIGATION ---
document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".admin-section").forEach(s => s.style.display = "none");
        btn.classList.add("active");
        document.getElementById(btn.dataset.target).style.display = "block";
        if(btn.dataset.target === "section-stack") loadStack();
    });
});

// --- SKETCHFAB UPLOAD CORE ---
async function handleSketchfabUpload(file, modelName, description) {
    console.log('=== SKETCHFAB UPLOAD DEBUG ===');
    console.log('Token exists:', !!SKETCHFAB_API_TOKEN);
    console.log('Token length:', SKETCHFAB_API_TOKEN?.length);
    console.log('File:', file);
    console.log('File name:', file?.name);
    console.log('File size:', file?.size, 'bytes');
    console.log('File type:', file?.type);
    console.log('Model name:', modelName);
    console.log('Description:', description);

    if (!SKETCHFAB_API_TOKEN) throw new Error("Sketchfab Token is missing!");
    
    const formData = new FormData();
    formData.append('modelFile', file);
    formData.append('name', modelName);
    formData.append('description', description);
    formData.append('isPublished', true);

    console.log('FormData entries:');
    for (let [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value);
    }

    console.log('Sending request to Sketchfab API...');
    const response = await fetch('https://api.sketchfab.com/v3/models', {
        method: 'POST',
        headers: { 'Authorization': `Token ${SKETCHFAB_API_TOKEN}` },
        body: formData
    });

    console.log('Response status:', response.status);
    console.log('Response OK:', response.ok);

    if (!response.ok) {
        const errData = await response.json();
        console.log('Error data from Sketchfab:', errData);
        
        // Sketchfab API errors can have multiple formats
        let errorMsg = 'Unknown Sketchfab error';
        if (errData.detail) {
            errorMsg = errData.detail;
        } else if (errData.errors && Array.isArray(errData.errors)) {
            errorMsg = errData.errors.map(e => e.message || e).join(', ');
        } else if (typeof errData === 'object') {
            errorMsg = JSON.stringify(errData);
        }
        console.error('Final error message:', errorMsg);
        throw new Error(`Sketchfab Error (${response.status}): ${errorMsg}`);
    }

    const data = await response.json();
    console.log('Success! Model UID:', data.uid);
    console.log('=== END SKETCHFAB UPLOAD DEBUG ===');
    return data.uid; // Return the model UID
}

// --- DATABASE OPERATIONS ---

function subscribeToProjects() {
    const q = query(collection(db, "projects"), orderBy("created_at", "desc"));
    onSnapshot(q, (snapshot) => {
        projectList.innerHTML = "";
        snapshot.forEach((doc) => renderProjectItem(doc.id, doc.data()));
    });
}

function renderProjectItem(id, data) {
    const item = document.createElement("div");
    item.className = "project-item";
    item.style.flexDirection = "column"; 
    item.style.alignItems = "stretch";

    item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:15px;">
                ${data.icon_url ? `<img src="${data.icon_url}" style="width:40px; height:40px; object-fit:cover; border:1px solid #333;">` : ''}
                <div>
                    <h3>${data.title}</h3>
                    <p>${data.type} // ${data.stack.join(", ")}</p>
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-edit-project btn-edit" data-id="${id}">EDIT</button>
                <button class="btn-delete" data-id="${id}" data-col="projects">DELETE</button>
            </div>
        </div>
        <div class="edit-slot" id="edit-slot-${id}" style="display:none; margin-top:20px; border-top:1px dashed #333; padding-top:20px;"></div>
    `;

    item.querySelector(".btn-delete").addEventListener("click", () => deleteItem("projects", id));
    item.querySelector(".btn-edit-project").addEventListener("click", () => toggleEditProject(id, data));
    projectList.appendChild(item);
}

function toggleEditProject(id, data) {
    const slot = document.getElementById(`edit-slot-${id}`);
    if (slot.style.display === "block") {
        slot.style.display = "none";
        slot.innerHTML = "";
        return;
    }

    slot.style.display = "block";

    // Build view angle slots HTML from existing model_views data
    const modelViews = data.model_views || {};
    const viewAngles = ['front', 'back', 'left', 'right', 'top', 'bottom'];
    const requiredViews = ['front', 'back', 'left', 'right'];
    let viewSlotsHtml = '';
    viewAngles.forEach(angle => {
        const isReq = requiredViews.includes(angle);
        const url = modelViews[angle] || '';
        viewSlotsHtml += `
        <div class="view-slot">
            <div class="slot-header"><span class="slot-label">${angle.toUpperCase()}</span><span class="slot-tag ${isReq ? 'req' : 'opt'}">${isReq ? 'REQUIRED' : 'OPTIONAL'}</span></div>
            <div class="slot-preview" id="edit-preview-${angle}-${id}">${url ? `<img src="${url}" alt="preview">` : '<div class="slot-empty">NO IMAGE</div>'}</div>
            <input type="file" id="edit-file-${angle}-${id}" accept="image/*" class="view-file-input">
            <input type="text" id="edit-url-${angle}-${id}" class="view-url-input" value="${url}" placeholder="URL auto-filled">
            <div class="slot-status" id="edit-status-${angle}-${id}"></div>
        </div>`;
    });

    const is3D = data.type === '3D Model';

    slot.innerHTML = `
        <form class="inline-edit-form" data-id="${id}">
            <h4 style="color:var(--accent); margin-bottom:15px;">/// EDIT_MODE</h4>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <label>PROJECT TITLE</label>
                    <input type="text" class="edit-p-title" value="${data.title}" required>
                </div>
                <div>
                    <label>TYPE / CATEGORY</label>
                    <select class="edit-p-type" id="edit-p-type-${id}" style="height:50px; width:100%; background:#050505; border:1px solid var(--text-dim); color:white;">
                        <option value="Game" ${data.type === 'Game' ? 'selected' : ''}>Game</option>
                        <option value="3D Model" ${data.type === '3D Model' ? 'selected' : ''}>3D Model</option>
                        <option value="Web" ${data.type === 'Web' ? 'selected' : ''}>Web</option>
                    </select>
                </div>
            </div>

            <label>DESCRIPTION</label>
            <textarea class="edit-p-desc" id="edit-p-desc-${id}" rows="3" required>${data.description}</textarea>
            <div style="margin-bottom: 20px; display: flex; align-items: center;">
                <button type="button" id="edit-btn-ai-${id}" class="btn-ai">AI GENERATE</button>
                <span id="edit-ai-status-${id}" class="ai-status-msg"></span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <label>TECH STACK <span style="color: var(--text-dim); font-weight: 400;">(Multi-select dropdown)</span></label>
                    <div class="multi-select-dropdown" id="edit-stack-dropdown-${id}">
                        <div class="dropdown-trigger" id="edit-stack-trigger-${id}">
                            <span id="edit-stack-selected-count-${id}">0 selected</span>
                            <span class="dropdown-arrow">▼</span>
                        </div>
                        <div class="dropdown-options" id="edit-stack-options-${id}" style="display: none;"></div>
                    </div>
                    <input type="text" class="edit-p-stack" style="display:none;" value="${(data.stack || []).join(',')}" required>
                </div>
            </div>

            <!-- Standard Asset Panel (Game/Web) -->
            <div id="edit-standard-panel-${id}" style="${is3D ? 'display:none;' : ''}">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <label>ICON URL</label>
                        <input type="text" class="edit-p-icon" value="${data.icon_url || ''}" placeholder="https://...">
                    </div>
                    <div>
                        <label>LINK / URL</label>
                        <input type="text" class="edit-p-link" value="${data.link || '#'}" placeholder="https://...">
                    </div>
                </div>
            </div>

            <!-- 3D Model Asset Panel -->
            <div id="edit-model3d-panel-${id}" style="${is3D ? '' : 'display:none;'}">
                <div class="admin-subpanel">
                    <h4 style="color:var(--accent); margin:0 0 6px; font-family:var(--font-code); font-size:0.85rem;">/// VIEW ANGLE RENDERS</h4>
                    <p style="color:var(--text-dim); font-size:0.72rem; margin:0 0 12px; font-family:var(--font-code);">Min. 4 required. Front view auto-becomes thumbnail.</p>
                    <div class="view-angles-grid">
                        ${viewSlotsHtml}
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <label>3D MODEL FILE <span style="color: var(--text-dim); font-weight: 400;">(FBX, OBJ, DAE, BLEND, STL - Max 100MB)</span></label>
                        <input type="file" id="edit-p-model-file-${id}" accept=".fbx,.obj,.dae,.blend,.stl" class="view-file-input">
                    </div>
                    <div>
                        <label>SKETCHFAB UID (Manual Override)</label>
                        <input type="text" class="edit-p-sfuid" value="${data.sketchfab_uid || ''}" placeholder="uid from sketchfab.com">
                    </div>
                </div>
            </div>

            <div style="margin-top:20px; display:flex; gap:10px;">
                <button type="submit" class="btn-brutal" style="flex:1;">SAVE CHANGES</button>
                <button type="button" class="btn-brutal outline" style="flex:1;" onclick="document.getElementById('edit-slot-${id}').style.display='none'">CANCEL</button>
            </div>
        </form>
    `;

    // Initialize type switch, view slot uploads, AI button, and stack picker for edit form
    setupEditTypeSwitch(id);
    setupEditModelViewSlots(id);
    setupEditAiButton(id);
    populateEditStackPicker(id, data.stack || []);

    const form = slot.querySelector("form");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type='submit']");
        btn.innerText = "SAVING...";
        btn.disabled = true;

        try {
            const type = form.querySelector(".edit-p-type").value;
            const updates = {
                title: form.querySelector(".edit-p-title").value,
                type: type,
                description: form.querySelector(".edit-p-desc").value,
                stack: getSelectedEditStack(id),
                icon_url: form.querySelector(".edit-p-icon")?.value || "",
                link: form.querySelector(".edit-p-link")?.value || "",
                sketchfab_uid: form.querySelector(".edit-p-sfuid")?.value || ""
            };

            // For 3D Model, collect view angles and override icon_url + link from front view
            if (type === "3D Model") {
                const requiredViews = ["front", "back", "left", "right"];
                for (const view of requiredViews) {
                    const urlInput = document.getElementById(`edit-url-${view}-${id}`);
                    if (!urlInput || !urlInput.value.trim()) {
                        alert(`ERROR: ${view.toUpperCase()} view image is required.`);
                        btn.disabled = false;
                        btn.innerText = "SAVE CHANGES";
                        return;
                    }
                }

                const model_views = {};
                ["front", "back", "left", "right", "top", "bottom"].forEach(k => {
                    const urlInput = document.getElementById(`edit-url-${k}-${id}`);
                    model_views[k] = urlInput ? urlInput.value.trim() || null : null;
                });
                updates.model_views = model_views;
                updates.icon_url = model_views.front || updates.icon_url;
                updates.link = model_views.front || "";
            }

            // Handle 3D model file re-upload to Sketchfab if a new file is selected
            const modelFile = document.getElementById(`edit-p-model-file-${id}`)?.files[0];
            if (type === "3D Model" && modelFile && !updates.sketchfab_uid) {
                btn.innerText = "UPLOADING TO SKETCHFAB...";
                const sfUid = await handleSketchfabUpload(modelFile, updates.title, updates.description);
                updates.sketchfab_uid = sfUid;
            }

            await setDoc(doc(db, "projects", id), updates, { merge: true });
            alert("PROJECT UPDATED");
            slot.style.display = "none";
        } catch (err) { alert("ERROR: " + err.message); }
        btn.disabled = false;
        btn.innerText = "SAVE CHANGES";
    });
}

/**
 * Toggles standard vs 3D model asset panels in the edit form
 * when the category select is changed, mirroring the create form behavior.
 * @param {string} projectId - The project document ID for unique selectors
 */
function setupEditTypeSwitch(projectId) {
    const typeSelect = document.getElementById(`edit-p-type-${projectId}`);
    if (!typeSelect) return;
    typeSelect.addEventListener('change', () => {
        const is3D = typeSelect.value === '3D Model';
        const stdPanel = document.getElementById(`edit-standard-panel-${projectId}`);
        const mdlPanel = document.getElementById(`edit-model3d-panel-${projectId}`);
        if (stdPanel) stdPanel.style.display = is3D ? 'none' : 'block';
        if (mdlPanel) mdlPanel.style.display = is3D ? 'block' : 'none';
    });
}

/**
 * Wires per-slot file upload logic for each view angle in the edit form.
 * On file change: shows local preview, uploads to Cloudinary, auto-fills URL input.
 * If the front slot is uploaded, also auto-fills the icon_url field.
 * @param {string} projectId - The project document ID for unique selectors
 */
function setupEditModelViewSlots(projectId) {
    ['front', 'back', 'left', 'right', 'top', 'bottom'].forEach(angleKey => {
        const fileInput = document.getElementById(`edit-file-${angleKey}-${projectId}`);
        const urlInput = document.getElementById(`edit-url-${angleKey}-${projectId}`);
        const statusEl = document.getElementById(`edit-status-${angleKey}-${projectId}`);
        const previewEl = document.getElementById(`edit-preview-${angleKey}-${projectId}`);
        if (!fileInput || !urlInput) return;

        fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            if (!file) return;

            previewEl.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="preview">`;
            statusEl.textContent = 'UPLOADING...';
            statusEl.className = 'slot-status uploading';
            fileInput.disabled = true;

            try {
                const cloudUrl = await uploadToCloudinary(file);
                urlInput.value = cloudUrl;
                previewEl.innerHTML = `<img src="${cloudUrl}" alt="preview">`;
                statusEl.textContent = 'UPLOADED';
                statusEl.className = 'slot-status done';

                // Auto-set icon_url from front view for Firestore thumbnail
                if (angleKey === 'front') {
                    const iconInput = document.querySelector(`#edit-slot-${projectId} .edit-p-icon`);
                    if (iconInput) iconInput.value = cloudUrl;
                }
            } catch (err) {
                statusEl.textContent = 'FAILED: ' + err.message;
                statusEl.className = 'slot-status error';
            } finally {
                fileInput.disabled = false;
            }
        });
    });
}

/**
 * Wires the AI Generate button in the edit form to auto-fill description
 * using Gemini API, mirroring the create form's AI functionality.
 * For 3D Model category, uses the front view file for image analysis.
 * @param {string} projectId - The project document ID for unique selectors
 */
function setupEditAiButton(projectId) {
    const aiBtn = document.getElementById(`edit-btn-ai-${projectId}`);
    const aiStatus = document.getElementById(`edit-ai-status-${projectId}`);
    if (!aiBtn) return;

    aiBtn.addEventListener('click', async () => {
        if (!GEMINI_API_KEY) {
            alert("Gemini API Key is required!");
            return;
        }

        const title = document.querySelector(`#edit-slot-${projectId} .edit-p-title`).value;
        const type = document.getElementById(`edit-p-type-${projectId}`).value;
        const stackArr = getSelectedEditStack(projectId);
        const stack = stackArr.length > 0 ? stackArr.join(", ") : "Unknown";
        // For 3D Model, use the front-view file for image analysis
        const iconFile = type === "3D Model"
            ? document.getElementById(`edit-file-front-${projectId}`)?.files[0]
            : null;

        if (!title) {
            alert("Please enter a project title first!");
            return;
        }

        aiBtn.disabled = true;
        aiStatus.textContent = "AI IS THINKING...";
        aiStatus.className = "ai-status-msg";

        try {
            let prompt = `Write a professional, concise, and engaging description for a portfolio project.
Title: ${title}
Category: ${type}
Tech Stack: ${stack}

The description should be briefly highlighting the core features and your role. Use professional tone. Output ONLY the description text, no markdown, no quotes.`;

            if (type === "3D Model") {
                prompt += "\nFocus on the visual style, geometry, and craftsmanship of the 3D model.";
            }

            const contents = [{ parts: [{ text: prompt }] }];

            if (iconFile) {
                aiStatus.textContent = "AI IS ANALYZING IMAGE...";
                const base64Data = await fileToBase64(iconFile);
                contents[0].parts.push({
                    inline_data: { mime_type: iconFile.type, data: base64Data }
                });
                prompt += "\nBased on the attached image, describe the visual style accurately.";
                contents[0].parts[0].text = prompt;
            }

            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
                body: JSON.stringify({ contents })
            });

            const data = await resp.json();
            const aiText = data.candidates[0].content.parts[0].text;
            document.getElementById(`edit-p-desc-${projectId}`).value = aiText.trim();
            aiStatus.textContent = "DONE ✓";
            aiStatus.className = "ai-status-msg success";
        } catch (err) {
            console.error("AI Error:", err);
            aiStatus.textContent = "AI FAILED";
            aiStatus.className = "ai-status-msg error";
        } finally {
            aiBtn.disabled = false;
        }
    });
}

// 2. TECH STACK
function loadStack() {
    const list = document.getElementById("admin-stack-list");
    const q = query(collection(db, "tech_stack"), orderBy("category"));
    onSnapshot(q, (snapshot) => {
        list.innerHTML = "";
        snapshot.forEach(docSnap => renderStackItem(docSnap.id, docSnap.data(), list));
    });
}

function renderStackItem(id, data, list) {
    const item = document.createElement("div");
    item.className = "project-item";
    item.style.flexDirection = "column";
    item.style.alignItems = "stretch";
    item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div><h3>// ${data.name}</h3><p>${data.category} | READY</p></div>
            <div style="display:flex; gap:10px;">
                <button class="btn-delete" data-id="${id}" data-col="tech_stack">DELETE</button>
            </div>
        </div>
    `;
    item.querySelector(".btn-delete").addEventListener("click", () => deleteItem("tech_stack", id));
    list.appendChild(item);
}

// 3. EXPERIENCE LISTENER
function subscribeToExperience() {
    const expList = document.getElementById("admin-exp-list");
    const q = query(collection(db, "experience"), orderBy("created_at", "desc"));
    onSnapshot(q, (snapshot) => {
        expList.innerHTML = "";
        snapshot.forEach((doc) => renderExpItem(doc.id, doc.data()));
    });
}

function renderExpItem(id, data) {
    const item = document.createElement("div");
    item.className = "project-item";
    item.style.flexDirection = "column";
    item.style.alignItems = "stretch";
    item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div><h3>${data.role} @ ${data.company}</h3><p style="color: var(--accent);">${data.period}</p></div>
            <div style="display:flex; gap:10px;">
                <button class="btn-edit-exp btn-edit" data-id="${id}">EDIT</button>
                <button class="btn-delete" data-id="${id}">DELETE</button>
            </div>
        </div>
        <div class="edit-slot" id="edit-exp-slot-${id}" style="display:none; margin-top:20px; border-top:1px dashed #333; padding-top:20px;"></div>
    `;
    item.querySelector(".btn-delete").addEventListener("click", () => deleteItem("experience", id));
    item.querySelector(".btn-edit-exp").addEventListener("click", () => toggleEditExperience(id, data));
    document.getElementById("admin-exp-list").appendChild(item);
}

function toggleEditExperience(id, data) {
    const slot = document.getElementById(`edit-exp-slot-${id}`);
    if (slot.style.display === "block") {
        slot.style.display = "none";
        slot.innerHTML = "";
        return;
    }

    slot.style.display = "block";
    slot.innerHTML = `
        <form class="inline-edit-form" data-id="${id}">
            <h4 style="color:var(--accent); margin-bottom:15px;">/// EDIT_MODE</h4>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <label>ROLE</label>
                    <input type="text" class="edit-e-role" value="${data.role}" required>
                </div>
                <div>
                    <label>COMPANY</label>
                    <input type="text" class="edit-e-company" value="${data.company}" required>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <label>PERIOD</label>
                    <input type="text" class="edit-e-period" value="${data.period}" required>
                </div>
                <div>
                    <label>FOCUS</label>
                    <input type="text" class="edit-e-focus" value="${data.focus || ''}" placeholder="Focus area...">
                </div>
            </div>

            <label>DESCRIPTION</label>
            <textarea class="edit-e-desc" rows="3" required>${data.description}</textarea>

            <label>CONTRIBUTIONS (one per line)</label>
            <textarea class="edit-e-contributions" rows="3" placeholder="Contribution 1\nContribution 2\n...">${data.contributions || ''}</textarea>
            
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button type="submit" class="btn-brutal" style="flex:1;">SAVE CHANGES</button>
                <button type="button" class="btn-brutal outline" style="flex:1;" onclick="document.getElementById('edit-exp-slot-${id}').style.display='none'">CANCEL</button>
            </div>
        </form>
    `;

    const form = slot.querySelector("form");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type='submit']");
        btn.innerText = "SAVING...";
        btn.disabled = true;

        try {
            const updates = {
                role: form.querySelector(".edit-e-role").value.toUpperCase(),
                company: form.querySelector(".edit-e-company").value.toUpperCase(),
                period: form.querySelector(".edit-e-period").value.toUpperCase(),
                focus: form.querySelector(".edit-e-focus").value,
                description: form.querySelector(".edit-e-desc").value,
                contributions: form.querySelector(".edit-e-contributions").value
            };
            await setDoc(doc(db, "experience", id), updates, { merge: true });
            alert("EXPERIENCE UPDATED");
            slot.style.display = "none";
        } catch (err) { alert("ERROR: " + err.message); }
        btn.disabled = false;
        btn.innerText = "SAVE CHANGES";
    });
}

// 4. DEV LOGS LISTENER
function subscribeToLogs() {
    const logList = document.getElementById("admin-log-list");
    const q = query(collection(db, "dev_logs"), orderBy("created_at", "desc"));
    onSnapshot(q, (snapshot) => {
        logList.innerHTML = "";
        snapshot.forEach((doc) => renderLogItem(doc.id, doc.data()));
    });
}

function renderLogItem(id, data) {
    const item = document.createElement("div");
    item.className = "project-item";
    item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div><h3>// ${data.message}</h3><p style="color: var(--text-dim); font-size: 0.8rem;">[${data.tags || "SYSTEM"}]</p></div>
            <button class="btn-delete" data-id="${id}">DELETE</button>
        </div>
    `;
    item.querySelector(".btn-delete").addEventListener("click", () => deleteItem("dev_logs", id));
    document.getElementById("admin-log-list").appendChild(item);
}

// GENERIC DELETE FUNCTION
async function deleteItem(collectionName, id) {
    if (confirm("CONFIRM DELETION?")) {
        try { await deleteDoc(doc(db, collectionName, id)); } 
        catch (error) { alert("Delete Failed"); }
    }
}

// UPLOAD HELPER (CLOUDINARY)
async function uploadToCloudinary(file) {
    const cloudName = sessionStorage.getItem('cloudinary_name');
    const uploadPreset = sessionStorage.getItem('cloudinary_preset');
    
    if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary configuration missing. Please check the config section.");
    }
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData });
    const data = await response.json();
    return data.secure_url || null;
}

// ADD PROJECT FORM HANDLER
if(addProjectForm) {
    addProjectForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const type = document.getElementById("p-type").value;
        const title = document.getElementById("p-title").value;
        const desc = document.getElementById("p-desc").value;
        const submitBtn = addProjectForm.querySelector("button[type='submit']");

        loader.style.display = "block";
        submitBtn.disabled = true;
        submitBtn.innerText = "PROCESSING...";

        try {
            let iconUrl = document.getElementById("p-icon").value;
            const iconFile = document.getElementById("p-icon-file").files[0];
            const modelFile = document.getElementById("p-model-file-input")?.files[0];

            // Upload standard icon only for Game/Web projects.
            if (iconFile && type !== "3D Model") {
                submitBtn.innerText = "UPLOADING_ICON...";
                iconUrl = await uploadToCloudinary(iconFile);
            }

            let sketchfabUid = document.getElementById("p-sketchfab-uid")?.value || "";
            if (type === "3D Model" && modelFile && !sketchfabUid) {
                // Validate 3D model file
                const allowedExtensions = ['.fbx', '.obj', '.dae', '.blend', '.stl'];
                const maxSizeBytes = 100 * 1024 * 1024; // 100MB
                
                const fileName = modelFile.name.toLowerCase();
                const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
                const fileSize = modelFile.size;
                
                console.log('3D Model Validation:', {
                    fileName: fileName,
                    extension: fileExtension,
                    size: fileSize,
                    sizeMB: (fileSize / (1024 * 1024)).toFixed(2) + 'MB'
                });
                
                if (!allowedExtensions.includes(fileExtension)) {
                    alert(`ERROR: Invalid file format!\n\nAllowed formats: ${allowedExtensions.join(', ').toUpperCase()}\nYour file: ${fileExtension.toUpperCase()}`);
                    loader.style.display = "none";
                    submitBtn.disabled = false;
                    submitBtn.innerText = "EXECUTE UPLOAD";
                    return;
                }
                
                if (fileSize > maxSizeBytes) {
                    const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
                    alert(`ERROR: File too large!\n\nMaximum size: 100MB\nYour file: ${sizeMB}MB`);
                    loader.style.display = "none";
                    submitBtn.disabled = false;
                    submitBtn.innerText = "EXECUTE UPLOAD";
                    return;
                }
                
                submitBtn.innerText = "UPLOADING TO SKETCHFAB...";
                sketchfabUid = await handleSketchfabUpload(modelFile, title, desc);
            }

            // Validate that at least one tech stack item has been selected.
            const selectedStack = getSelectedStack();
            if (selectedStack.length === 0) {
                alert("Please select at least one Tech Stack module.");
                loader.style.display = "none";
                submitBtn.disabled = false;
                submitBtn.innerText = "EXECUTE UPLOAD";
                return;
            }

            const projectData = {
                title: title,
                type: type,
                description: desc,
                stack: selectedStack,
                link: document.getElementById("p-link").value || "",
                icon_url: iconUrl || "",
                sketchfab_uid: sketchfabUid,
                created_at: serverTimestamp()
            };

            // For 3D Model, collect view angles and override icon_url + link.
            if (type === "3D Model") {
                const requiredViews = ["front", "back", "left", "right"];
                for (const view of requiredViews) {
                    if (!document.getElementById(`url-${view}`).value.trim()) {
                        alert(`ERROR: ${view.toUpperCase()} view image is required.`);
                        loader.style.display = "none";
                        submitBtn.disabled = false;
                        submitBtn.innerText = "EXECUTE UPLOAD";
                        return;
                    }
                }

                const model_views = {};
                ["front", "back", "left", "right", "top", "bottom"].forEach(k => {
                    model_views[k] = document.getElementById(`url-${k}`).value.trim() || null;
                });

                projectData.model_views = model_views;
                // Auto-set icon_url and link from front view.
                projectData.icon_url = model_views.front || iconUrl;
                projectData.link     = model_views.front || "";
            }

            await addDoc(collection(db, "projects"), projectData);
            alert("PROJECT UPLOADED SUCCESSFULLY");
            addProjectForm.reset();
            // Clear all stack checkboxes after form reset (reset() doesn't affect custom elements).
            const optionsContainer = document.getElementById('p-stack-options');
            const countDisplay = document.getElementById('p-stack-selected-count');
            if (optionsContainer) {
                const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => {
                    cb.checked = false;
                    cb.parentElement.classList.remove('selected');
                });
            }
            if (countDisplay) {
                countDisplay.textContent = '0 selected';
            }
            // Clear all slot previews after reset.
            ["front","back","left","right","top","bottom"].forEach(k => {
                const p = document.getElementById(`preview-${k}`);
                if (p) p.innerHTML = '<div class="slot-empty">NO IMAGE</div>';
                const s = document.getElementById(`status-${k}`);
                if (s) { s.textContent = ""; s.className = "slot-status"; }
            });
        } catch (e) { alert("ERROR: " + e.message); console.error(e); } 
        
        loader.style.display = "none";
        submitBtn.disabled = false;
        submitBtn.innerText = "EXECUTE UPLOAD";
    });
}

// ADD STACK FORM
document.getElementById("stack-form")?.addEventListener("submit", async(e) => {
    e.preventDefault();
    const data = { name: document.getElementById("s-name").value.toUpperCase(), category: document.getElementById("s-category").value, created_at: serverTimestamp() };
    await addDoc(collection(db, "tech_stack"), data);
    e.target.reset();
});

// ADD EXP FORM
document.getElementById("exp-form")?.addEventListener("submit", async(e) => {
    e.preventDefault();
    const data = {
        role: document.getElementById("e-role").value.toUpperCase(),
        company: document.getElementById("e-company").value.toUpperCase(),
        period: document.getElementById("e-period").value.toUpperCase(),
        focus: document.getElementById("e-focus").value,
        description: document.getElementById("e-desc").value,
        contributions: document.getElementById("e-contributions").value,
        created_at: serverTimestamp()
    };
    await addDoc(collection(db, "experience"), data);
    e.target.reset();
});

// ADD LOG FORM
document.getElementById("log-form")?.addEventListener("submit", async(e) => {
    e.preventDefault();
    const data = { message: document.getElementById("l-msg").value, tags: document.getElementById("l-tags").value.toUpperCase(), created_at: serverTimestamp() };
    await addDoc(collection(db, "dev_logs"), data);
    e.target.reset();
});
