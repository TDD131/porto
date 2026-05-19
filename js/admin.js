import { auth, db, storage } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, setDoc, Timestamp, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// CLOUDINARY CONFIG - Will be loaded from Firestore per user
let CLOUDINARY_CLOUD_NAME = '';
let CLOUDINARY_API_KEY = '';
let CLOUDINARY_API_SECRET = '';

// API Keys - Will be loaded from Firestore per user
let GEMINI_API_KEY = '';
let SKETCHFAB_API_TOKEN = '';

// GitHub Config - Will be loaded from Firestore per user
let GITHUB_TOKEN = '';
let GITHUB_OWNER = '';
let GITHUB_REPO = '';
let GITHUB_RELEASE_TAG = '';

// Current user ID
let currentUserId = null;

// DOM Elements
const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("btn-logout");
const addProjectForm = document.getElementById("add-project-form");
const projectList = document.getElementById("admin-project-list");
const statsForm = document.getElementById("stats-form");
const statsList = document.getElementById("admin-stats-list");
const logListContainer = document.getElementById("admin-log-list");
const loginMsg = document.getElementById("login-msg");
const loader = document.getElementById("upload-loader");
const aiBtn = document.getElementById("btn-ai-desc");
const aiStatus = document.getElementById("ai-desc-status");

let logStackPickerInitialized = false;
let logStackUnsubscribe = null;

// --- FIRESTORE SETTINGS MANAGEMENT ---
async function loadUserSettings(userId) {
    try {
        const settingsRef = doc(db, 'admin_settings', userId);
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            GEMINI_API_KEY = data.gemini_key || '';
            SKETCHFAB_API_TOKEN = data.sketchfab_token || '';
            CLOUDINARY_CLOUD_NAME = data.cloudinary_cloud_name || '';
            CLOUDINARY_API_KEY = data.cloudinary_api_key || '';
            CLOUDINARY_API_SECRET = data.cloudinary_api_secret || '';
            GITHUB_TOKEN = data.github_token || '';
            GITHUB_OWNER = data.github_owner || '';
            GITHUB_REPO = data.github_repo || '';
            GITHUB_RELEASE_TAG = data.github_release_tag || '';
            
            console.log('Settings loaded from Firestore for user:', userId);
            return true;
        } else {
            console.log('No settings found for user:', userId);
            return false;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        return false;
    }
}

async function saveUserSettings(userId) {
    try {
        const settingsRef = doc(db, 'admin_settings', userId);
        await setDoc(settingsRef, {
            gemini_key: GEMINI_API_KEY,
            sketchfab_token: SKETCHFAB_API_TOKEN,
            cloudinary_cloud_name: CLOUDINARY_CLOUD_NAME,
            cloudinary_api_key: CLOUDINARY_API_KEY,
            cloudinary_api_secret: CLOUDINARY_API_SECRET,
            github_token: GITHUB_TOKEN,
            github_owner: GITHUB_OWNER,
            github_repo: GITHUB_REPO,
            github_release_tag: GITHUB_RELEASE_TAG,
            updated_at: serverTimestamp()
        }, { merge: true });
        
        console.log('Settings saved to Firestore for user:', userId);
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

function updateUIWithSettings() {
    const keyInput = document.getElementById('gemini-api-key');
    const sfKeyInput = document.getElementById('sketchfab-api-token');
    const cloudNameInput = document.getElementById('cloudinary-cloud-name');
    const cloudKeyInput = document.getElementById('cloudinary-api-key');
    const csecretInput = document.getElementById('cloudinary-api-secret');
    const ghTokenInput = document.getElementById('github-token');
    const ghOwnerInput = document.getElementById('github-owner');
    const ghRepoInput = document.getElementById('github-repo');
    const ghTagInput = document.getElementById('github-release-tag');
    
    if (keyInput) keyInput.value = GEMINI_API_KEY;
    if (sfKeyInput) sfKeyInput.value = SKETCHFAB_API_TOKEN;
    if (cloudNameInput) cloudNameInput.value = CLOUDINARY_CLOUD_NAME;
    if (cloudKeyInput) cloudKeyInput.value = CLOUDINARY_API_KEY;
    if (csecretInput) csecretInput.value = CLOUDINARY_API_SECRET;
    if (ghTokenInput) ghTokenInput.value = GITHUB_TOKEN;
    if (ghOwnerInput) ghOwnerInput.value = GITHUB_OWNER;
    if (ghRepoInput) ghRepoInput.value = GITHUB_REPO;
    if (ghTagInput) ghTagInput.value = GITHUB_RELEASE_TAG;
    
    // Clear validation status on load
    document.getElementById('gemini-status').innerHTML = '';
    document.getElementById('sketchfab-status').innerHTML = '';
    document.getElementById('cloudinary-secret-status').innerHTML = '';
    document.getElementById('github-token-status').innerHTML = '';
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const keyInput = document.getElementById('gemini-api-key');
    const sfKeyInput = document.getElementById('sketchfab-api-token');
    const cloudNameInput = document.getElementById('cloudinary-cloud-name');
    const cloudKeyInput = document.getElementById('cloudinary-api-key');
    const csecretInput = document.getElementById('cloudinary-api-secret');
    
    // Auto-save on input
    keyInput?.addEventListener('input', async (e) => {
        GEMINI_API_KEY = e.target.value;
        if (currentUserId) {
            await saveUserSettings(currentUserId);
        }
        // Clear validation status
        document.getElementById('gemini-status').innerHTML = '';
        const configItem = e.target.closest('.config-item');
        const existingError = configItem?.querySelector('.api-error-msg');
        if (existingError) existingError.remove();
    });

    sfKeyInput?.addEventListener('input', async (e) => {
        SKETCHFAB_API_TOKEN = e.target.value;
        if (currentUserId) {
            await saveUserSettings(currentUserId);
        }
        // Clear validation status
        document.getElementById('sketchfab-status').innerHTML = '';
        const configItem = e.target.closest('.config-item');
        const existingError = configItem?.querySelector('.api-error-msg');
        if (existingError) existingError.remove();
    });

    cloudNameInput?.addEventListener('input', async (e) => {
        CLOUDINARY_CLOUD_NAME = e.target.value;
        if (currentUserId) {
            await saveUserSettings(currentUserId);
        }
    });

    cloudKeyInput?.addEventListener('input', async (e) => {
        CLOUDINARY_API_KEY = e.target.value;
        if (currentUserId) {
            await saveUserSettings(currentUserId);
        }
    });

    csecretInput?.addEventListener('input', async (e) => {
        CLOUDINARY_API_SECRET = e.target.value;
        if (currentUserId) {
            await saveUserSettings(currentUserId);
        }
        // Clear validation status
        document.getElementById('cloudinary-secret-status').innerHTML = '';
        const configItem = e.target.closest('.config-item');
        const existingError = configItem?.querySelector('.api-error-msg');
        if (existingError) existingError.remove();
    });

    // GitHub settings auto-save
    const ghTokenInput = document.getElementById('github-token');
    const ghOwnerInput = document.getElementById('github-owner');
    const ghRepoInput = document.getElementById('github-repo');
    const ghTagInput = document.getElementById('github-release-tag');

    ghTokenInput?.addEventListener('input', async (e) => {
        GITHUB_TOKEN = e.target.value;
        if (currentUserId) await saveUserSettings(currentUserId);
        document.getElementById('github-token-status').innerHTML = '';
        const configItem = e.target.closest('.config-item');
        const existingError = configItem?.querySelector('.api-error-msg');
        if (existingError) existingError.remove();
    });

    ghOwnerInput?.addEventListener('input', async (e) => {
        GITHUB_OWNER = e.target.value;
        if (currentUserId) await saveUserSettings(currentUserId);
    });

    ghRepoInput?.addEventListener('input', async (e) => {
        GITHUB_REPO = e.target.value;
        if (currentUserId) await saveUserSettings(currentUserId);
    });

    ghTagInput?.addEventListener('input', async (e) => {
        GITHUB_RELEASE_TAG = e.target.value;
        if (currentUserId) await saveUserSettings(currentUserId);
    });

    // Initialize the type-switch and per-slot upload logic after DOM is ready.
    setupTypeSwitch();
    initModelViewSlots();
    initStandardIconUpload();
    initBlendUpload();
    initSoftwarePreviewSlots();
});

// 2b. STATS LISTENER
function subscribeToStats() {
    if (!statsList) return;
    const q = query(collection(db, "stats"), orderBy("order"));
    onSnapshot(q, (snapshot) => {
        statsList.innerHTML = "";
        if (snapshot.empty) {
            statsList.innerHTML = `<div class="empty-state">NO STAT CARDS</div>`;
            return;
        }
        snapshot.forEach(docSnap => renderStatItem(docSnap.id, docSnap.data()));
    });
}

function renderStatItem(id, data) {
    if (!statsList) return;
    const orderValue = typeof data.order === "number" ? data.order : 0;
    const label = (data.label || "").toUpperCase();
    const value = data.value || "-";

    const item = document.createElement("div");
    item.className = "project-item";
    item.style.flexDirection = "column";
    item.style.alignItems = "stretch";
    item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div>
                <h3>${value}</h3>
                <p style="color: var(--text-dim); margin: 4px 0 0;">${label}</p>
                <small style="color: var(--text-dim);">ORDER: ${orderValue}</small>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-edit-stat btn-edit" data-id="${id}">EDIT</button>
                <button class="btn-delete" data-id="${id}">DELETE</button>
            </div>
        </div>
        <div class="edit-slot" id="edit-stat-slot-${id}" style="display:none; margin-top:20px; border-top:1px dashed #333; padding-top:20px;"></div>
    `;

    item.querySelector(".btn-delete").addEventListener("click", () => deleteItem("stats", id));
    item.querySelector(".btn-edit-stat").addEventListener("click", () => toggleEditStat(id, data));
    statsList.appendChild(item);
}

function toggleEditStat(id, data) {
    const slot = document.getElementById(`edit-stat-slot-${id}`);
    if (!slot) return;

    if (slot.style.display === "block") {
        slot.style.display = "none";
        slot.innerHTML = "";
        return;
    }

    slot.style.display = "block";
    slot.innerHTML = `
        <form class="inline-edit-form" data-id="${id}">
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                <div>
                    <label>VALUE</label>
                    <input type="text" class="edit-stat-value" value="${data.value || ''}" required>
                </div>
                <div>
                    <label>LABEL</label>
                    <input type="text" class="edit-stat-label" value="${(data.label || '').toUpperCase()}" required>
                </div>
                <div>
                    <label>ORDER</label>
                    <input type="number" class="edit-stat-order" value="${typeof data.order === 'number' ? data.order : 0}" min="0" step="1">
                </div>
            </div>
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button type="submit" class="btn-brutal" style="flex:1;">SAVE CHANGES</button>
                <button type="button" class="btn-brutal outline" style="flex:1;" onclick="document.getElementById('edit-stat-slot-${id}').style.display='none'">CANCEL</button>
            </div>
        </form>
    `;

    const form = slot.querySelector("form");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type='submit']");
        btn.disabled = true;
        btn.innerText = "SAVING...";

        try {
            const updates = {
                value: form.querySelector(".edit-stat-value").value.trim(),
                label: form.querySelector(".edit-stat-label").value.trim().toUpperCase(),
                order: Number(form.querySelector(".edit-stat-order").value) || 0
            };
            await setDoc(doc(db, "stats", id), updates, { merge: true });
            alert("STAT UPDATED");
            slot.style.display = "none";
        } catch (err) {
            alert("ERROR: " + err.message);
        }

        btn.disabled = false;
        btn.innerText = "SAVE CHANGES";
    });
}

// --- TYPE SWITCH: Shows/hides asset panels based on project category ---
function handleTypeSwitch() {
    const is3D = this.value === '3D Model';
    const isSoftware = this.value === 'Software';
    const stdPanel = document.getElementById('standard-asset-panel');
    const mdlPanel = document.getElementById('model3d-asset-panel');
    const swPanel = document.getElementById('software-asset-panel');
    const iconInput = document.getElementById('p-icon');
    const linkInput = document.getElementById('p-link');

    // Hide all panels first
    if (stdPanel) stdPanel.style.display = 'none';
    if (mdlPanel) mdlPanel.style.display = 'none';
    if (swPanel) swPanel.style.display = 'none';

    // Show the relevant panel
    if (is3D) {
        if (mdlPanel) mdlPanel.style.display = 'block';
    } else if (isSoftware) {
        if (swPanel) swPanel.style.display = 'block';
    } else {
        if (stdPanel) stdPanel.style.display = 'block';
    }

    // Toggle required attrs to prevent HTML5 validation from blocking hidden fields.
    if (iconInput) iconInput.required = false;
    if (linkInput) linkInput.required = (!is3D && !isSoftware);
}

function setupTypeSwitch() {
    const typeSelect = document.getElementById('p-type');
    if (!typeSelect) return;

    // Restore previously selected category from localStorage (survives page refresh).
    const savedType = localStorage.getItem('admin_selected_category');
    if (savedType && [...typeSelect.options].some(o => o.value === savedType)) {
        typeSelect.value = savedType;
    }

    typeSelect.addEventListener('change', function () {
        localStorage.setItem('admin_selected_category', this.value);
        handleTypeSwitch.call(this);
    });
    // Run once on init to set correct panel state based on current value.
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
        } else {
            status.innerHTML = '<span style="color: #ff4444;">✗ INVALID</span>';
            
            // Add error message below input
            const errorDiv = document.createElement('div');
            errorDiv.className = 'api-error-msg';
            errorDiv.style.cssText = 'color: #ff4444; font-size: 0.75rem; margin-top: 5px;';
            errorDiv.textContent = 'Invalid token or insufficient permissions.';
            configItem.appendChild(errorDiv);
        }
    } catch (e) { 
        status.innerHTML = '<span style="color: #ff4444;">ERROR</span>'; 
        
        // Add error message below input
        const errorDiv = document.createElement('div');
        errorDiv.className = 'api-error-msg';
        errorDiv.style.cssText = 'color: #ff4444; font-size: 0.75rem; margin-top: 5px;';
        errorDiv.textContent = 'Connection error. Check your network.';
        configItem.appendChild(errorDiv);
    }
}

window.validateCloudinarySecret = async function() {
    const status = document.getElementById('cloudinary-secret-status');
    const secret = CLOUDINARY_API_SECRET;
    const inputRow = document.getElementById('cloudinary-api-secret').parentElement;
    const configItem = inputRow.closest('.config-item') || inputRow;
    
    // Remove existing error message
    const existingError = configItem.querySelector('.api-error-msg');
    if (existingError) existingError.remove();
    
    if (!secret) { 
        status.innerHTML = ''; 
        return; 
    }
    
    status.innerHTML = '<span style="color: #555;">CHECKING...</span>';
    
    try {
        // Validate by checking format and length
        // Cloudinary API Secret is typically 32 characters alphanumeric
        const secretPattern = /^[a-zA-Z0-9_-]{20,}$/;
        
        if (secretPattern.test(secret)) {
            status.innerHTML = '<span style="color: #00ff88; font-weight: bold;">✓ VALID FORMAT</span>';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'api-error-msg';
            infoDiv.style.cssText = 'color: #f5a623; font-size: 0.75rem; margin-top: 5px;';
            infoDiv.textContent = 'Secret format valid. Full validation happens on actual upload.';
            configItem.appendChild(infoDiv);
        } else {
            status.innerHTML = '<span style="color: #ff4444;">✗ INVALID FORMAT</span>';
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'api-error-msg';
            errorDiv.style.cssText = 'color: #ff4444; font-size: 0.75rem; margin-top: 5px;';
            errorDiv.textContent = 'API Secret should be at least 20 alphanumeric characters.';
            configItem.appendChild(errorDiv);
        }
    } catch (e) { 
        console.error("Cloudinary Secret Validation Error:", e);
        status.innerHTML = '<span style="color: #ff4444;">ERROR</span>'; 
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'api-error-msg';
        errorDiv.style.cssText = 'color: #ff4444; font-size: 0.75rem; margin-top: 5px;';
        errorDiv.textContent = 'Validation error. Check your connection.';
        configItem.appendChild(errorDiv);
    }
}

// --- GITHUB TOKEN VALIDATION ---
window.validateGithubToken = async function() {
    const status = document.getElementById('github-token-status');
    const inputRow = document.getElementById('github-token').parentElement;
    const configItem = inputRow.closest('.config-item') || inputRow;
    
    const existingError = configItem.querySelector('.api-error-msg');
    if (existingError) existingError.remove();
    
    if (!GITHUB_TOKEN) { status.innerHTML = ''; return; }
    status.innerHTML = '<span style="color: #555;">CHECKING...</span>';
    
    try {
        const resp = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github+json'
            }
        });
        
        if (resp.ok) {
            const user = await resp.json();
            status.innerHTML = `<span style="color: #00ff88; font-weight: bold;">✓ ${user.login}</span>`;
        } else {
            status.innerHTML = '<span style="color: #ff4444;">✗ INVALID</span>';
            const errorDiv = document.createElement('div');
            errorDiv.className = 'api-error-msg';
            errorDiv.style.cssText = 'color: #ff4444; font-size: 0.75rem; margin-top: 5px;';
            errorDiv.textContent = 'Invalid token or expired. Generate a new one.';
            configItem.appendChild(errorDiv);
        }
    } catch (e) {
        status.innerHTML = '<span style="color: #ff4444;">ERROR</span>';
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
 * and updates the cover image if this angle's star is active.
 * @param {string} angleKey - One of: front, back, left, right, top, bottom
 */
function setupModelViewSlot(angleKey) {
    const fileInput   = document.getElementById(`file-${angleKey}`);
    const urlInput    = document.getElementById(`url-${angleKey}`);
    const statusEl   = document.getElementById(`status-${angleKey}`);
    const previewEl  = document.getElementById(`preview-${angleKey}`);
    if (!fileInput || !urlInput) return;

    // Only show local preview on file selection — actual upload happens on form submit.
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        previewEl.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="preview">`;
        statusEl.textContent = 'READY TO UPLOAD';
        statusEl.className   = 'slot-status';
        // Clear any previously uploaded URL so submit knows to re-upload
        urlInput.value = '';
    });
}

function initModelViewSlots() {
    ['front', 'back', 'left', 'right', 'top', 'bottom'].forEach(setupModelViewSlot);
}

/**
 * Shows a local preview for the standard icon file on selection.
 * Actual upload to Cloudinary happens on form submit.
 */
function initStandardIconUpload() {
    const fileInput = document.getElementById('p-icon-file');
    const urlInput = document.getElementById('p-icon');
    if (!fileInput || !urlInput) return;

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        // Clear any old URL so submit knows to upload the new file
        urlInput.value = '';
        urlInput.placeholder = file.name;
    });
}

/**
 * Uploads FormData to a URL using XHR so we can track progress.
 * Returns a Promise that resolves with the parsed JSON response.
 * @param {string} url - endpoint
 * @param {FormData} formData
 * @param {function(number):void} onProgress - called with 0-100 percent
 */
function uploadWithProgress(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });

        xhr.addEventListener('load', () => {
            try {
                const data = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(data);
                } else {
                    reject(new Error(data.error || `HTTP ${xhr.status}`));
                }
            } catch (e) {
                reject(new Error('Invalid server response'));
            }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
        xhr.send(formData);
    });
}

/**
 * Renders a progress bar + percentage inside statusEl.
 * Returns an update function: updateBar(percent).
 */
function createProgressBar(statusEl) {
    statusEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; margin-top:4px;">
            <div style="flex:1; height:4px; background:rgba(255,255,255,0.08); border-radius:999px; overflow:hidden;">
                <div id="glb-progress-bar" style="height:100%; width:0%; background:var(--text-primary); border-radius:999px; transition:width 0.2s ease;"></div>
            </div>
            <span id="glb-progress-pct" style="font-family:var(--font-code); font-size:0.7rem; color:var(--text-dim); min-width:32px; text-align:right;">0%</span>
        </div>
        <div style="font-family:var(--font-code); font-size:0.72rem; color:var(--accent); margin-top:4px;">Uploading to server...</div>
    `;
    const bar = statusEl.querySelector('#glb-progress-bar');
    const pct = statusEl.querySelector('#glb-progress-pct');
    return (percent) => {
        if (bar) bar.style.width = percent + '%';
        if (pct) pct.textContent = percent + '%';
    };
}

/**
 * Handles .glb/.gltf file upload to GitHub Releases via server proxy.
 */
function initBlendUpload() {
    const uploadBtn = document.getElementById('btn-upload-blend');
    const fileInput = document.getElementById('p-blend-file');
    const urlInput = document.getElementById('p-blend-url');
    const statusEl = document.getElementById('blend-upload-status');
    if (!uploadBtn || !fileInput) return;

    uploadBtn.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) {
            alert('Please select a .glb or .gltf file first.');
            return;
        }

        if (!file.name.toLowerCase().match(/\.(glb|gltf)$/)) {
            alert('Only .glb and .gltf files are allowed.');
            return;
        }

        if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !GITHUB_RELEASE_TAG) {
            alert('GitHub configuration incomplete. Check the config section above.');
            return;
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = 'UPLOADING...';
        const updateBar = createProgressBar(statusEl);

        try {
            // Upload via server proxy to avoid CORS — browser cannot POST directly to uploads.github.com.
            const formData = new FormData();
            formData.append('file', file);
            formData.append('githubToken', GITHUB_TOKEN);
            formData.append('githubOwner', GITHUB_OWNER);
            formData.append('githubRepo', GITHUB_REPO);
            formData.append('githubTag', GITHUB_RELEASE_TAG);

            const data = await uploadWithProgress('/api/upload-github', formData, (pct) => {
                updateBar(pct);
                uploadBtn.textContent = `UPLOADING ${pct}%`;
            });

            const downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${GITHUB_RELEASE_TAG}/${encodeURIComponent(file.name)}`;
            urlInput.value = data.download_url || downloadUrl;
            const sizeMB = ((data.size || file.size) / (1024 * 1024)).toFixed(2);
            statusEl.innerHTML = `<span style="color: #00ff88;">✓ UPLOADED (${sizeMB} MB) — ${data.name || file.name}</span>`;
        } catch (err) {
            console.error('GLB upload error:', err);
            statusEl.innerHTML = `<span style="color: #ff4444;">✗ FAILED: ${err.message}</span>`;
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'UPLOAD .GLB';
        }
    });
}

// --- SOFTWARE PREVIEW IMAGES ---
const MAX_PREVIEW_IMAGES = 15;
let softwarePreviewCount = 0;
const SW_PREVIEW_STORAGE_KEY = 'admin_sw_previews';

function saveSoftwarePreviewsToStorage() {
    const container = document.getElementById('software-preview-slots');
    if (!container) return;
    const slots = container.querySelectorAll('.sw-preview-slot');
    const data = [];
    slots.forEach(slot => {
        const img = slot.querySelector('.sw-preview-img img');
        const urlInput = slot.querySelector('.sw-url-input');
        data.push({
            dataUrl: img ? img.src : null,
            uploadedUrl: urlInput?.value || ''
        });
    });
    try {
        localStorage.setItem(SW_PREVIEW_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('Could not save previews to localStorage (quota exceeded?):', e);
    }
}

function loadSoftwarePreviewsFromStorage() {
    try {
        const raw = localStorage.getItem(SW_PREVIEW_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function initSoftwarePreviewSlots() {
    const addBtn = document.getElementById('btn-add-preview');
    if (!addBtn) return;

    addBtn.addEventListener('click', () => {
        if (softwarePreviewCount >= MAX_PREVIEW_IMAGES) {
            alert(`Maximum ${MAX_PREVIEW_IMAGES} preview images allowed.`);
            return;
        }
        addSoftwarePreviewSlot();
        saveSoftwarePreviewsToStorage();
    });

    // Restore from localStorage or add first empty slot
    const saved = loadSoftwarePreviewsFromStorage();
    if (saved && saved.length > 0) {
        saved.forEach(item => {
            addSoftwarePreviewSlot(item.dataUrl, item.uploadedUrl);
        });
    } else {
        addSoftwarePreviewSlot();
    }
}

function addSoftwarePreviewSlot(savedDataUrl, savedUploadedUrl) {
    const container = document.getElementById('software-preview-slots');
    if (!container) return;

    softwarePreviewCount++;
    const index = softwarePreviewCount;

    const slot = document.createElement('div');
    slot.className = 'sw-preview-slot';
    slot.dataset.index = index;
    slot.innerHTML = `
        <button type="button" class="btn-remove-preview" title="Remove">✕</button>
        <div class="sw-preview-img" id="sw-preview-img-${index}">
            <span class="slot-empty">${index}</span>
        </div>
        <input type="file" accept="image/*" class="sw-file-input view-file-input" data-index="${index}" style="font-size: 0.6rem;">
        <input type="hidden" class="sw-url-input" data-index="${index}">
    `;

    // Restore saved preview if available
    if (savedDataUrl) {
        const previewEl = slot.querySelector('.sw-preview-img');
        previewEl.innerHTML = `<img src="${savedDataUrl}" alt="preview ${index}">`;
    }
    if (savedUploadedUrl) {
        slot.querySelector('.sw-url-input').value = savedUploadedUrl;
    }

    // File change handler — show local preview and save to localStorage as base64
    const fileInput = slot.querySelector('.sw-file-input');
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        const previewEl = slot.querySelector('.sw-preview-img');

        // Read as base64 for localStorage persistence
        const reader = new FileReader();
        reader.onload = (e) => {
            previewEl.innerHTML = `<img src="${e.target.result}" alt="preview ${index}">`;
            saveSoftwarePreviewsToStorage();
        };
        reader.readAsDataURL(file);
    });

    // Remove button handler
    const removeBtn = slot.querySelector('.btn-remove-preview');
    removeBtn.addEventListener('click', () => {
        slot.remove();
        softwarePreviewCount--;
        updatePreviewSlotNumbers();
        saveSoftwarePreviewsToStorage();
    });

    container.appendChild(slot);
}

function updatePreviewSlotNumbers() {
    const container = document.getElementById('software-preview-slots');
    if (!container) return;
    const slots = container.querySelectorAll('.sw-preview-slot');
    slots.forEach((slot, i) => {
        slot.dataset.index = i + 1;
        const emptyLabel = slot.querySelector('.slot-empty');
        if (emptyLabel) emptyLabel.textContent = i + 1;
    });
}

/**
 * Uploads all software preview images that have files selected.
 * For slots without a file (restored from localStorage), uses the stored dataUrl
 * to create a Blob and upload that instead.
 * Returns an array of Cloudinary URLs.
 */
async function uploadSoftwarePreviewImages(submitBtn) {
    const container = document.getElementById('software-preview-slots');
    if (!container) return [];

    const slots = container.querySelectorAll('.sw-preview-slot');
    const urls = [];

    for (const slot of slots) {
        const fileInput = slot.querySelector('.sw-file-input');
        const urlInput = slot.querySelector('.sw-url-input');
        const previewImg = slot.querySelector('.sw-preview-img img');
        const file = fileInput?.files[0];

        if (urlInput.value.trim()) {
            // Already uploaded
            urls.push(urlInput.value.trim());
        } else if (file) {
            // Has a file selected — upload it
            const idx = slot.dataset.index;
            submitBtn.innerText = `UPLOADING PREVIEW ${idx}/${slots.length}...`;
            try {
                const cloudUrl = await uploadToCloudinary(file);
                urlInput.value = cloudUrl;
                urls.push(cloudUrl);
            } catch (err) {
                throw new Error(`Failed to upload preview image ${idx}: ${err.message}`);
            }
        } else if (previewImg && previewImg.src.startsWith('data:')) {
            // Restored from localStorage — convert base64 to Blob and upload
            const idx = slot.dataset.index;
            submitBtn.innerText = `UPLOADING PREVIEW ${idx}/${slots.length}...`;
            try {
                const blob = await fetch(previewImg.src).then(r => r.blob());
                const fileName = `preview_${idx}.${blob.type.split('/')[1] || 'png'}`;
                const fileFromBlob = new File([blob], fileName, { type: blob.type });
                const cloudUrl = await uploadToCloudinary(fileFromBlob);
                urlInput.value = cloudUrl;
                urls.push(cloudUrl);
            } catch (err) {
                throw new Error(`Failed to upload preview image ${idx}: ${err.message}`);
            }
        }
    }

    return urls;
}

function resetSoftwarePreviewSlots() {
    const container = document.getElementById('software-preview-slots');
    softwarePreviewCount = 0;
    if (container) {
        container.innerHTML = '';
        addSoftwarePreviewSlot();
    }
    localStorage.removeItem(SW_PREVIEW_STORAGE_KEY);
}

// --- COVER IMAGE SELECTION ---
/**
 * Sets the selected angle as the cover image (icon_url).
 * Only one star can be active at a time.
 * @param {string} angleKey - The angle to set as cover (front, back, left, right, top, bottom)
 */
window.setCoverImage = function(angleKey) {
    // Remove active class from all star buttons
    document.querySelectorAll('.star-cover-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    const clickedBtn = document.querySelector(`.star-cover-btn[data-angle="${angleKey}"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
    
    // Update the hidden icon input with the URL from the selected angle
    const selectedUrlInput = document.getElementById(`url-${angleKey}`);
    const iconInput = document.getElementById('p-icon');
    
    if (selectedUrlInput && iconInput) {
        iconInput.value = selectedUrlInput.value;
        console.log(`Cover image set to ${angleKey}: ${selectedUrlInput.value}`);
    }
}

/**
 * Sets the selected angle as the cover image in EDIT form.
 * Only one star can be active at a time per project.
 * @param {string} angleKey - The angle to set as cover
 * @param {string} projectId - The project ID being edited
 */
window.setEditCoverImage = function(angleKey, projectId) {
    // Remove active class from all star buttons in this edit form
    document.querySelectorAll(`.star-cover-btn[data-project-id="${projectId}"]`).forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    const clickedBtn = document.querySelector(`.star-cover-btn[data-angle="${angleKey}"][data-project-id="${projectId}"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
    
    // Update the icon input with the URL from the selected angle
    const selectedUrlInput = document.getElementById(`edit-url-${angleKey}-${projectId}`);
    const iconInput = document.querySelector(`#edit-slot-${projectId} .edit-p-icon`);
    
    if (selectedUrlInput && iconInput) {
        iconInput.value = selectedUrlInput.value;
        console.log(`Edit cover image set to ${angleKey}: ${selectedUrlInput.value}`);
    }
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
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        
        // Load user settings from Firestore
        await loadUserSettings(currentUserId);
        updateUIWithSettings();
        
        loginPanel.style.display = "none";
        dashboard.style.display = "block";
        restoreActiveSection();
        loadDashboard();
        subscribeToProjects();
        subscribeToStats();
        subscribeToExperience();
        subscribeToLogs();
        initLogStackPicker();
        populateStackPicker(); // Populate tech stack pills from DB on login.
    } else {
        currentUserId = null;
        loginPanel.style.display = "block";
        dashboard.style.display = "none";
        cleanupLogStackPicker();
        
        // Clear settings on logout
        GEMINI_API_KEY = '';
        SKETCHFAB_API_TOKEN = '';
        CLOUDINARY_CLOUD_NAME = '';
        CLOUDINARY_API_KEY = '';
        CLOUDINARY_API_SECRET = '';
        GITHUB_TOKEN = '';
        GITHUB_OWNER = '';
        GITHUB_REPO = '';
        GITHUB_RELEASE_TAG = '';
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
    const q = query(collection(db, 'tech_stack'));
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            optionsContainer.innerHTML = '<div class="dropdown-option" style="cursor: default;">No modules available</div>';
            return;
        }

        // Get currently selected items
        const selectedItems = getSelectedStack();

        optionsContainer.innerHTML = '';
        const items = [];
        snapshot.forEach(docSnap => items.push(docSnap.data().name));
        items.sort((a, b) => a.localeCompare(b));
        
        items.forEach(techName => {
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
    const q = query(collection(db, 'tech_stack'));
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            optionsContainer.innerHTML = '<div class="dropdown-option" style="cursor: default;">No modules available</div>';
            return;
        }

        optionsContainer.innerHTML = '';
        const items = [];
        snapshot.forEach(docSnap => items.push(docSnap.data().name));
        items.sort((a, b) => a.localeCompare(b));
        
        items.forEach(techName => {
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

function initLogStackPicker() {
    const dropdown = document.getElementById("log-stack-dropdown");
    const trigger = document.getElementById("log-stack-trigger");
    const optionsContainer = document.getElementById("log-stack-options");
    const countDisplay = document.getElementById("log-stack-selected-count");
    const hiddenInput = document.getElementById("log-stack-hidden");

    if (!dropdown || !trigger || !optionsContainer || !countDisplay) return;

    if (!logStackPickerInitialized) {
        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("open");
            optionsContainer.style.display = dropdown.classList.contains("open") ? "block" : "none";
        });

        document.addEventListener("click", (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove("open");
                optionsContainer.style.display = "none";
            }
        });

        logStackPickerInitialized = true;
    }

    if (logStackUnsubscribe) {
        logStackUnsubscribe();
        logStackUnsubscribe = null;
    }

    const q = query(collection(db, "tech_stack"));
    logStackUnsubscribe = onSnapshot(q, (snapshot) => {
        const previousSelection = new Set(getSelectedValuesFromContainer(optionsContainer));
        optionsContainer.innerHTML = "";

        if (snapshot.empty) {
            optionsContainer.innerHTML = '<div class="dropdown-option" style="cursor: default;">No tech stack entries</div>';
            updateSelectedState();
            return;
        }

        const items = [];
        snapshot.forEach((docSnap) => items.push(docSnap.data().name));
        items.sort((a, b) => a.localeCompare(b));

        items.forEach((techName) => {
            const isSelected = previousSelection.has(techName);
            const option = document.createElement("div");
            option.className = "dropdown-option" + (isSelected ? " selected" : "");
            option.innerHTML = `
                <input type="checkbox" ${isSelected ? "checked" : ""} value="${techName}">
                <span>${techName}</span>
            `;

            const checkbox = option.querySelector('input[type="checkbox"]');
            checkbox.addEventListener("change", () => {
                option.classList.toggle("selected", checkbox.checked);
                updateSelectedState();
            });

            option.addEventListener("click", (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    option.classList.toggle("selected", checkbox.checked);
                    updateSelectedState();
                }
            });

            optionsContainer.appendChild(option);
        });

        updateSelectedState();
    });

    function updateSelectedState() {
        const selected = getSelectedLogStack();
        countDisplay.textContent = selected.length ? `${selected.length} selected` : "Select stack";
        if (hiddenInput) {
            hiddenInput.value = selected.join(",");
        }
    }
}

function cleanupLogStackPicker() {
    if (logStackUnsubscribe) {
        logStackUnsubscribe();
        logStackUnsubscribe = null;
    }
}

function mountEditLogStackPicker(logId, selected = [], slot) {
    const dropdown = document.getElementById(`edit-log-stack-dropdown-${logId}`);
    const trigger = document.getElementById(`edit-log-stack-trigger-${logId}`);
    const optionsContainer = document.getElementById(`edit-log-stack-options-${logId}`);
    const countDisplay = document.getElementById(`edit-log-stack-selected-count-${logId}`);
    const hiddenInput = document.getElementById(`edit-log-stack-hidden-${logId}`);

    if (!dropdown || !trigger || !optionsContainer || !countDisplay) return;

    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
        optionsContainer.style.display = dropdown.classList.contains("open") ? "block" : "none";
    });

    const outsideHandler = (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove("open");
            optionsContainer.style.display = "none";
        }
    };
    document.addEventListener("click", outsideHandler);

    const q = query(collection(db, "tech_stack"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const previousSelection = new Set(getSelectedValuesFromContainer(optionsContainer));
        if (previousSelection.size === 0 && selected.length) {
            selected.forEach((item) => previousSelection.add(item));
        }

        optionsContainer.innerHTML = "";

        if (snapshot.empty) {
            optionsContainer.innerHTML = '<div class="dropdown-option" style="cursor: default;">No tech stack entries</div>';
            updateSelectedState();
            return;
        }

        const items = [];
        snapshot.forEach((docSnap) => items.push(docSnap.data().name));
        items.sort((a, b) => a.localeCompare(b));

        items.forEach((techName) => {
            const isSelected = previousSelection.has(techName);
            const option = document.createElement("div");
            option.className = "dropdown-option" + (isSelected ? " selected" : "");
            option.innerHTML = `
                <input type="checkbox" ${isSelected ? "checked" : ""} value="${techName}">
                <span>${techName}</span>
            `;

            const checkbox = option.querySelector('input[type="checkbox"]');
            checkbox.addEventListener("change", () => {
                option.classList.toggle("selected", checkbox.checked);
                updateSelectedState();
            });

            option.addEventListener("click", (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    option.classList.toggle("selected", checkbox.checked);
                    updateSelectedState();
                }
            });

            optionsContainer.appendChild(option);
        });

        updateSelectedState();
    });

    slot._logStackUnsub = unsubscribe;
    slot._logStackOutsideHandler = outsideHandler;

    function updateSelectedState() {
        const selectedValues = getSelectedValuesFromContainer(optionsContainer);
        countDisplay.textContent = selectedValues.length ? `${selectedValues.length} selected` : "Select stack";
        if (hiddenInput) {
            hiddenInput.value = selectedValues.join(",");
        }
    }
}

function teardownLogStackPicker(slot) {
    if (slot && slot._logStackUnsub) {
        slot._logStackUnsub();
        slot._logStackUnsub = null;
    }
    if (slot && slot._logStackOutsideHandler) {
        document.removeEventListener("click", slot._logStackOutsideHandler);
        slot._logStackOutsideHandler = null;
    }
}

function getSelectedValuesFromContainer(container) {
    if (!container) return [];
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map((cb) => cb.value);
}

function getSelectedLogStack() {
    const container = document.getElementById("log-stack-options");
    return getSelectedValuesFromContainer(container);
}

function getSelectedEditLogStack(logId) {
    const container = document.getElementById(`edit-log-stack-options-${logId}`);
    return getSelectedValuesFromContainer(container);
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
function switchToSection(targetId) {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".admin-section").forEach(s => s.style.display = "none");
    const targetBtn = document.querySelector(`.nav-btn[data-target="${targetId}"]`);
    const targetSection = document.getElementById(targetId);
    if (targetBtn) targetBtn.classList.add("active");
    if (targetSection) targetSection.style.display = "block";
    if (targetId === "section-stack") loadStack();
    // Re-render dashboard charts when switching back — they may have been
    // rendered while the section was hidden (display:none) causing 0-size canvases.
    if (targetId === "section-dashboard") {
        const ctxType = document.getElementById('dash-chart-type');
        const ctxMonth = document.getElementById('dash-chart-month');
        if (ctxType?._chartInstance) ctxType._chartInstance.resize();
        if (ctxMonth?._chartInstance) ctxMonth._chartInstance.resize();
    }
    localStorage.setItem('admin_active_section', targetId);
}

document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        switchToSection(btn.dataset.target);
    });
});

function restoreActiveSection() {
    const saved = localStorage.getItem('admin_active_section');
    const validSections = ['section-dashboard', 'section-projects', 'section-stack', 'section-stats', 'section-experience', 'section-logs'];
    if (saved && validSections.includes(saved)) {
        switchToSection(saved);
    }
}

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
        let errData = {};
        try { errData = await response.json(); } catch (_) {}
        console.log('Error data from Sketchfab:', errData);

        let errorMsg = `HTTP ${response.status}`;
        if (typeof errData.detail === 'string') {
            errorMsg = errData.detail;
        } else if (typeof errData.detail === 'object' && errData.detail !== null) {
            errorMsg = JSON.stringify(errData.detail);
        } else if (errData.errors) {
            errorMsg = Array.isArray(errData.errors)
                ? errData.errors.map(e => (typeof e === 'string' ? e : JSON.stringify(e))).join(', ')
                : JSON.stringify(errData.errors);
        } else if (errData.message) {
            errorMsg = errData.message;
        } else if (Object.keys(errData).length > 0) {
            errorMsg = JSON.stringify(errData);
        }

        console.error('Sketchfab error:', errorMsg);
        throw new Error(`Sketchfab Error (${response.status}): ${errorMsg}`);
    }

    const data = await response.json();
    console.log('Success! Model UID:', data.uid);
    console.log('=== END SKETCHFAB UPLOAD DEBUG ===');
    return data.uid; // Return the model UID
}

// --- DATABASE OPERATIONS ---

async function loadDashboard() {
    const collections = [
        { id: 'projects',   elId: 'dash-count-projects' },
        { id: 'experience', elId: 'dash-count-exp' },
        { id: 'dev_logs',   elId: 'dash-count-logs' },
        { id: 'tech_stack', elId: 'dash-count-stack' },
        { id: 'stats',      elId: 'dash-count-stats' },
    ];

    for (const { id, elId } of collections) {
        try {
            const snap = await getDocs(collection(db, id));
            const el = document.getElementById(elId);
            if (el) el.textContent = snap.size;

            // Count pinned projects
            if (id === 'projects') {
                const pinned = snap.docs.filter(d => d.data().pinned).length;
                const pinnedEl = document.getElementById('dash-count-pinned');
                if (pinnedEl) pinnedEl.textContent = pinned;

                const allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Recent projects list
                const recentEl = document.getElementById('dash-recent-projects');
                if (recentEl) {
                    const sorted = allProjects
                        .slice()
                        .sort((a, b) => {
                            const aT = a.created_at?.toMillis?.() ?? 0;
                            const bT = b.created_at?.toMillis?.() ?? 0;
                            return bT - aT;
                        })
                        .slice(0, 5);

                    if (sorted.length === 0) {
                        recentEl.innerHTML = '<p style="color: var(--text-dim); font-family: var(--font-code); font-size: 0.8rem;">No projects yet.</p>';
                    } else {
                        recentEl.innerHTML = sorted.map(data => {
                            const date = data.created_at?.toDate?.();
                            const dateStr = date ? date.toLocaleDateString('id-ID') : '—';
                            return `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 16px; border: 1px solid var(--border-dim); border-radius: 12px; background: rgba(255,255,255,0.02);">
                                    <div>
                                        <span style="font-weight: 600; color: var(--text-primary);">${data.title || 'Untitled'}</span>
                                        <span style="font-family: var(--font-code); font-size: 0.65rem; color: var(--text-dim); margin-left: 10px;">${data.type || ''}</span>
                                        ${data.pinned ? '<span style="font-family: var(--font-code); font-size: 0.6rem; color: #f5a623; margin-left: 8px;">★ PINNED</span>' : ''}
                                    </div>
                                    <span style="font-family: var(--font-code); font-size: 0.7rem; color: var(--text-dim);">${dateStr}</span>
                                </div>
                            `;
                        }).join('');
                    }
                }

                // Most viewed projects
                const mostViewedEl = document.getElementById('dash-most-viewed');
                if (mostViewedEl) {
                    const withViews = allProjects
                        .filter(p => p.view_count != null && p.view_count > 0)
                        .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
                        .slice(0, 5);

                    if (withViews.length === 0) {
                        mostViewedEl.innerHTML = '<p style="color: var(--text-dim); font-family: var(--font-code); font-size: 0.75rem;">No view data yet.<br>Add view_count to projects.</p>';
                    } else {
                        const maxViews = withViews[0].view_count || 1;
                        mostViewedEl.innerHTML = withViews.map((p, i) => {
                            const pct = Math.round(((p.view_count || 0) / maxViews) * 100);
                            return `
                                <div>
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                        <span style="font-size:0.8rem; color:var(--text-primary); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:65%;">${p.title || 'Untitled'}</span>
                                        <span style="font-family:var(--font-code); font-size:0.7rem; color:var(--text-dim);">${(p.view_count || 0).toLocaleString()}</span>
                                    </div>
                                    <div style="height:4px; background:rgba(255,255,255,0.06); border-radius:999px; overflow:hidden;">
                                        <div style="height:100%; width:${pct}%; background:var(--text-primary); border-radius:999px; opacity:${0.4 + (0.6 * (1 - i / withViews.length))};"></div>
                                    </div>
                                </div>
                            `;
                        }).join('');
                    }
                }

                // Charts
                renderDashboardCharts(allProjects);
            }
        } catch (err) {
            console.warn(`Dashboard count failed for ${id}:`, err);
        }
    }
}

function renderDashboardCharts(projects) {
    const textColor = 'rgba(245,242,234,0.5)';
    const gridColor = 'rgba(245,242,234,0.06)';
    const typeColors = {
        'Game':     'rgba(245,242,234,0.85)',
        '3D Model': 'rgba(245,242,234,0.55)',
        'Web':      'rgba(245,242,234,0.35)',
        'Software': 'rgba(245,242,234,0.2)',
    };

    // ── Chart 1: By Type (Doughnut) ──────────────────────────────
    const typeCounts = {};
    projects.forEach(p => {
        const t = p.type || 'Other';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    const typeLabels = Object.keys(typeCounts);
    const typeData   = typeLabels.map(k => typeCounts[k]);
    const typeColArr = typeLabels.map(k => typeColors[k] || 'rgba(245,242,234,0.15)');

    const ctxType = document.getElementById('dash-chart-type');
    if (ctxType) {
        if (ctxType._chartInstance) ctxType._chartInstance.destroy();
        ctxType._chartInstance = new Chart(ctxType, {
            type: 'doughnut',
            data: {
                labels: typeLabels,
                datasets: [{ data: typeData, backgroundColor: typeColArr, borderColor: 'rgba(11,11,13,0.8)', borderWidth: 2 }]
            },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: textColor, font: { family: 'monospace', size: 10 }, padding: 12, boxWidth: 10 } }
                }
            }
        });
    }

    // ── Chart 2: By Month (Bar) ──────────────────────────────────
    const monthCounts = {};
    projects.forEach(p => {
        const ts = p.created_at;
        if (!ts) return;
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
    });
    const monthKeys   = Object.keys(monthCounts).sort();
    const monthLabels = monthKeys.map(k => {
        const [y, m] = k.split('-');
        return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });
    const monthData = monthKeys.map(k => monthCounts[k]);

    const ctxMonth = document.getElementById('dash-chart-month');
    if (ctxMonth) {
        if (ctxMonth._chartInstance) ctxMonth._chartInstance.destroy();
        ctxMonth._chartInstance = new Chart(ctxMonth, {
            type: 'bar',
            data: {
                labels: monthLabels,
                datasets: [{
                    label: 'Projects',
                    data: monthData,
                    backgroundColor: 'rgba(245,242,234,0.15)',
                    borderColor: 'rgba(245,242,234,0.4)',
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: textColor, font: { family: 'monospace', size: 9 } }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, font: { family: 'monospace', size: 9 }, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true }
                }
            }
        });
    }
}

function subscribeToProjects() {
    const q = query(collection(db, "projects"), orderBy("created_at", "desc"));
    onSnapshot(q, (snapshot) => {
        projectList.innerHTML = "";
        // Sort: pinned first, then by created_at desc (already ordered by query)
        const docs = snapshot.docs.slice().sort((a, b) => {
            const aPinned = a.data().pinned ? 1 : 0;
            const bPinned = b.data().pinned ? 1 : 0;
            return bPinned - aPinned;
        });
        docs.forEach((doc) => renderProjectItem(doc.id, doc.data()));
    });
}

function renderProjectItem(id, data) {
    const item = document.createElement("div");
    item.className = "project-item";
    item.style.flexDirection = "column"; 
    item.style.alignItems = "stretch";

    const isPinned = data.pinned || false;

    item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:15px;">
                <button class="btn-pin${isPinned ? ' pinned' : ''}" data-id="${id}" title="${isPinned ? 'Unpin project' : 'Pin project'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="17" x2="12" y2="22"/>
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                    </svg>
                </button>
                ${data.icon_url ? `<img src="${data.icon_url}" style="width:40px; height:40px; object-fit:cover; border:1px solid #333;">` : ''}
                <div>
                    <h3>${data.title}</h3>
                    <p>${data.type} // ${data.stack.join(", ")}</p>
                </div>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
                <button class="btn-edit-project btn-edit" data-id="${id}">EDIT</button>
                <button class="btn-delete" data-id="${id}" data-col="projects">DELETE</button>
            </div>
        </div>
        <div class="edit-slot" id="edit-slot-${id}" style="display:none; margin-top:20px; border-top:1px dashed #333; padding-top:20px;"></div>
    `;

    item.querySelector(".btn-pin").addEventListener("click", () => togglePinProject(id, !isPinned));
    item.querySelector(".btn-delete").addEventListener("click", () => deleteItem("projects", id));
    item.querySelector(".btn-edit-project").addEventListener("click", () => toggleEditProject(id, data));
    projectList.appendChild(item);
}

async function togglePinProject(id, pinned) {
    try {
        await setDoc(doc(db, "projects", id), { pinned }, { merge: true });
    } catch (err) {
        console.error("Error toggling pin:", err);
        alert("Failed to pin/unpin project: " + err.message);
    }
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
    const requiredViews = ['front', 'back'];
    
    // Determine which angle is the current cover (default to front)
    const currentCover = data.icon_url ? 
        viewAngles.find(angle => modelViews[angle] === data.icon_url) || 'front' : 
        'front';
    
    let viewSlotsHtml = '';
    viewAngles.forEach(angle => {
        const isReq = requiredViews.includes(angle);
        const url = modelViews[angle] || '';
        const isActiveCover = angle === currentCover;
        viewSlotsHtml += `
        <div class="view-slot">
            <div class="slot-header">
                <span class="slot-label">
                    <button type="button" class="star-cover-btn ${isActiveCover ? 'active' : ''}" data-angle="${angle}" data-project-id="${id}" onclick="setEditCoverImage('${angle}', '${id}')">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                    </button>
                    ${angle.toUpperCase()}
                </span>
                <span class="slot-tag ${isReq ? 'req' : 'opt'}">${isReq ? 'REQUIRED' : 'OPTIONAL'}</span>
            </div>
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
                        <option value="Software" ${data.type === 'Software' ? 'selected' : ''}>Software</option>
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
                    <p style="color:var(--text-dim); font-size:0.72rem; margin:0 0 12px; font-family:var(--font-code);">Min. 2 required (Front & Back). Click ★ to set as cover image.</p>
                    <div class="view-angles-grid">
                        ${viewSlotsHtml}
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <label>3D MODEL FILE <span style="color: var(--text-dim); font-weight: 400;">(GLB, GLTF, FBX, OBJ, DAE, BLEND, STL - Max 100MB for Sketchfab)</span></label>
                        <input type="file" id="edit-p-model-file-${id}" accept=".glb,.gltf,.fbx,.obj,.dae,.blend,.stl" class="view-file-input">
                    </div>
                    <div>
                        <label>SKETCHFAB URL or UID</label>
                        <input type="text" class="edit-p-sfuid" value="${data.sketchfab_uid || ''}" placeholder="Paste URL or UID — auto-extracted">
                    </div>
                </div>
                <div class="admin-subpanel" style="margin-top: 16px;">
                    <h4 style="color:var(--accent); margin:0 0 6px; font-family:var(--font-code); font-size:0.85rem;">/// GLB / GLTF FILE DOWNLOAD</h4>
                    <p style="color:var(--text-dim); font-size:0.72rem; margin:0 0 12px; font-family:var(--font-code);">Upload .glb or .gltf file to GitHub Releases for public download.</p>
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: end;">
                        <div>
                            <label>.GLB / GLTF FILE</label>
                            <input type="file" id="edit-blend-file-${id}" accept=".glb,.gltf" class="view-file-input">
                        </div>
                        <button type="button" id="edit-btn-upload-blend-${id}" class="btn-brutal outline" style="height: 44px; white-space: nowrap;">UPLOAD .GLB</button>
                    </div>
                    <div id="edit-blend-status-${id}" style="margin-top: 8px; font-family: var(--font-code); font-size: 0.75rem;"></div>
                    <div style="margin-top: 10px;">
                        <label>GLB/GLTF DOWNLOAD URL</label>
                        <input type="text" id="edit-blend-url-${id}" value="${data.blend_download_url || ''}" placeholder="Auto-filled after upload, or paste manually" style="width: 100%;">
                    </div>
                </div>
            </div>

            <div style="margin-top:20px;">
                <label>CREATED DATE</label>
                <input type="date" id="edit-p-created-at-${id}" value="${formatDateInputValue(data.created_at)}">
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
    setupEditBlendUpload(id);

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
            };

            // Only include standard fields for non-3D types
            if (type !== "3D Model") {
                updates.icon_url = form.querySelector(".edit-p-icon")?.value || "";
                updates.link = form.querySelector(".edit-p-link")?.value || "";
            }

            // Only update sketchfab_uid if it has a value (don't overwrite with empty)
            const sfuidVal = extractSketchfabUid(form.querySelector(".edit-p-sfuid")?.value);
            if (sfuidVal) updates.sketchfab_uid = sfuidVal;

            // Update created_at if date field is filled
            const createdAtInput = document.getElementById(`edit-p-created-at-${id}`);
            const parsedDate = parseDateInput(createdAtInput?.value);
            if (parsedDate) updates.created_at = parsedDate;

            // For 3D Model, collect view angles
            if (type === "3D Model") {
                const requiredViews = ["front", "back"];
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
                
                // Use icon_url from the edit form (set by star button), fallback to front view
                const iconInput = form.querySelector(".edit-p-icon");
                updates.icon_url = iconInput?.value || model_views.front || "";
                updates.link = updates.icon_url || "";

                // Save blend download URL
                const blendUrlInput = document.getElementById(`edit-blend-url-${id}`);
                const blendUrl = blendUrlInput?.value?.trim();
                if (blendUrl) updates.blend_download_url = blendUrl;
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
 * Wires the .glb/.gltf file upload button in the edit form.
 * Uploads to GitHub Releases and auto-fills the download URL input.
 * @param {string} projectId - The project document ID for unique selectors
 */
function setupEditBlendUpload(projectId) {
    const uploadBtn = document.getElementById(`edit-btn-upload-blend-${projectId}`);
    const fileInput = document.getElementById(`edit-blend-file-${projectId}`);
    const urlInput = document.getElementById(`edit-blend-url-${projectId}`);
    const statusEl = document.getElementById(`edit-blend-status-${projectId}`);
    if (!uploadBtn || !fileInput) return;

    uploadBtn.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) { alert('Please select a .glb or .gltf file first.'); return; }
        if (!file.name.toLowerCase().match(/\.(glb|gltf)$/)) { alert('Only .glb and .gltf files are allowed.'); return; }
        if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !GITHUB_RELEASE_TAG) {
            alert('GitHub configuration incomplete. Check the config section above.');
            return;
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = 'UPLOADING...';
        const updateBar = createProgressBar(statusEl);

        try {
            // Two-step upload: get URL from server, then upload directly to GitHub
            const urlResp = await fetch('/api/upload-github-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    githubToken: GITHUB_TOKEN,
                    githubOwner: GITHUB_OWNER,
                    githubRepo: GITHUB_REPO,
                    githubTag: GITHUB_RELEASE_TAG,
                    fileName: file.name
                })
            });

            const urlData = await urlResp.json();
            if (!urlResp.ok) throw new Error(urlData.error || `HTTP ${urlResp.status}`);

            // Upload directly to GitHub
            const data = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', urlData.uploadUrl);
                xhr.setRequestHeader('Authorization', `Bearer ${urlData.token}`);
                xhr.setRequestHeader('Accept', 'application/vnd.github+json');
                xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                xhr.setRequestHeader('X-GitHub-Api-Version', '2022-11-28');

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        updateBar(pct);
                        uploadBtn.textContent = `UPLOADING ${pct}%`;
                    }
                });

                xhr.addEventListener('load', () => {
                    try {
                        const resp = JSON.parse(xhr.responseText);
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve(resp);
                        } else {
                            reject(new Error(resp.message || `GitHub upload HTTP ${xhr.status}`));
                        }
                    } catch (e) {
                        reject(new Error('Invalid GitHub response'));
                    }
                });

                xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
                xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
                xhr.send(file);
            });

            urlInput.value = urlData.downloadUrl;
            const sizeMB = (data.size / (1024 * 1024)).toFixed(2);
            statusEl.innerHTML = `<span style="color: #00ff88;">✓ UPLOADED (${sizeMB} MB) — ${data.name}</span>`;
        } catch (err) {
            statusEl.innerHTML = `<span style="color: #ff4444;">✗ FAILED: ${err.message}</span>`;
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'UPLOAD .GLB';
        }
    });
}

/**
 * Wires per-slot file upload logic for each view angle in the edit form.
 * On file change: shows local preview, uploads to Cloudinary, auto-fills URL input.
 * If the angle's star is active, also auto-fills the icon_url field.
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

                // If this angle's star is active, update the icon_url
                const starBtn = document.querySelector(`.star-cover-btn[data-angle="${angleKey}"][data-project-id="${projectId}"]`);
                if (starBtn && starBtn.classList.contains('active')) {
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
    const q = query(collection(db, "tech_stack"));
    onSnapshot(q, (snapshot) => {
        list.innerHTML = "";
        const items = [];
        snapshot.forEach(docSnap => items.push({ id: docSnap.id, data: docSnap.data() }));
        items.sort((a, b) => (a.data.name || "").localeCompare(b.data.name || ""));
        items.forEach(item => renderStackItem(item.id, item.data, list));
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
    if (!logListContainer) return;
    const q = query(collection(db, "dev_logs"), orderBy("created_at", "desc"));
    onSnapshot(q, (snapshot) => {
        logListContainer.innerHTML = "";
        if (snapshot.empty) {
            logListContainer.innerHTML = `<div class="empty-state">NO LOG ENTRIES</div>`;
            return;
        }
        snapshot.forEach((docSnap) => renderLogItem(docSnap.id, docSnap.data()));
    });
}

function renderLogItem(id, data = {}) {
    if (!logListContainer) return;
    const item = document.createElement("div");
    item.className = "project-item";
    item.style.flexDirection = "column";
    item.style.alignItems = "stretch";

    const createdLabel = formatAdminTimestamp(data.created_at);
    const updatedLabel = data.updated_at ? formatAdminTimestamp(data.updated_at) : null;
    const tagList = normalizeLogTags(data.tags);
    const tagsLabel = (tagList.length ? tagList.join(", ") : "SYSTEM").toUpperCase();

    item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%; gap:20px;">
            <div>
                <h3>// ${data.message || ""}</h3>
                <p style="color: var(--text-dim); font-size: 0.8rem;">[${tagsLabel}]</p>
                <small style="color: var(--text-dim); font-size: 0.75rem;">CREATED: ${createdLabel}${updatedLabel ? ` · EDITED: ${updatedLabel}` : ""}</small>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-edit btn-edit-log" data-id="${id}">EDIT</button>
                <button class="btn-delete" data-id="${id}">DELETE</button>
            </div>
        </div>
        <div class="edit-slot" id="edit-log-slot-${id}" style="display:none; margin-top:20px; border-top:1px dashed #333; padding-top:20px;"></div>
    `;

    item.querySelector(".btn-delete").addEventListener("click", () => deleteItem("dev_logs", id));
    item.querySelector(".btn-edit-log").addEventListener("click", () => toggleEditLog(id, data));
    logListContainer.appendChild(item);
}

function toggleEditLog(id, data = {}) {
    const slot = document.getElementById(`edit-log-slot-${id}`);
    if (!slot) return;

    if (slot.style.display === "block") {
        teardownLogStackPicker(slot);
        slot.style.display = "none";
        slot.innerHTML = "";
        return;
    }

    slot.style.display = "block";
    slot.innerHTML = `
        <form class="inline-edit-form" data-id="${id}">
            <div style="display:grid; gap:16px;">
                <div>
                    <label>MESSAGE</label>
                    <textarea class="edit-log-message" rows="3" required></textarea>
                </div>
                <div>
                    <label>TECH STACK <span style="color: var(--text-dim); font-weight: 400;">(Multi-select dropdown)</span></label>
                    <div class="multi-select-dropdown" id="edit-log-stack-dropdown-${id}">
                        <div class="dropdown-trigger" id="edit-log-stack-trigger-${id}">
                            <span id="edit-log-stack-selected-count-${id}">Select stack</span>
                            <span class="dropdown-arrow">▼</span>
                        </div>
                        <div class="dropdown-options" id="edit-log-stack-options-${id}" style="display:none;"></div>
                    </div>
                    <input type="text" id="edit-log-stack-hidden-${id}" style="display:none;" value="">
                </div>
                <div style="display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:16px;">
                    <div>
                        <label>CREATED AT</label>
                        <input type="date" class="edit-log-created">
                    </div>
                    <div>
                        <label>UPDATED AT</label>
                        <input type="date" class="edit-log-updated">
                    </div>
                </div>
            </div>
            <div style="margin-top:16px; display:flex; gap:10px;">
                <button type="submit" class="btn-brutal" style="flex:1;">SAVE LOG</button>
                <button type="button" class="btn-brutal outline btn-cancel-log" style="flex:1;">CANCEL</button>
            </div>
        </form>
    `;

    const form = slot.querySelector("form");
    const msgInput = slot.querySelector(".edit-log-message");
    const createdInput = slot.querySelector(".edit-log-created");
    const updatedInput = slot.querySelector(".edit-log-updated");
    const cancelBtn = slot.querySelector(".btn-cancel-log");

    msgInput.value = data.message || "";
    createdInput.value = formatDateInputValue(data.created_at);
    updatedInput.value = formatDateInputValue(data.updated_at);

    mountEditLogStackPicker(id, normalizeLogTags(data.tags), slot);

    cancelBtn.addEventListener("click", () => {
        teardownLogStackPicker(slot);
        slot.style.display = "none";
        slot.innerHTML = "";
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector("button[type='submit']");
        submitBtn.disabled = true;
        submitBtn.textContent = "SAVING...";

        try {
            const payload = {
                message: msgInput.value.trim(),
                tags: (() => {
                    const selection = getSelectedEditLogStack(id);
                    return selection.length ? selection : ["SYSTEM"];
                })(),
                created_at: parseDateInput(createdInput.value) || data.created_at || serverTimestamp(),
                updated_at: parseDateInput(updatedInput.value) || serverTimestamp()
            };
            await setDoc(doc(db, "dev_logs", id), payload, { merge: true });
            alert("LOG UPDATED");
            teardownLogStackPicker(slot);
            slot.style.display = "none";
            slot.innerHTML = "";
        } catch (error) {
            alert("ERROR: " + error.message);
        }

        submitBtn.disabled = false;
        submitBtn.textContent = "SAVE LOG";
    });
}

function formatAdminTimestamp(timestamp) {
    if (!timestamp) return "—";
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (error) {
        return "—";
    }
}

function normalizeLogTags(raw) {
    if (Array.isArray(raw)) {
        return raw.map(tag => tag.trim()).filter(Boolean);
    }
    if (typeof raw === "string") {
        return raw.split(",").map(tag => tag.trim()).filter(Boolean);
    }
    return [];
}

/**
 * Extracts a Sketchfab model UID from either a full URL or a bare UID string.
 * Handles formats:
 *   - https://sketchfab.com/3d-models/name-UID
 *   - https://sketchfab.com/models/UID
 *   - bare UID (32-char hex)
 * Returns the UID string, or empty string if nothing found.
 */
function extractSketchfabUid(input) {
    if (!input) return '';
    const trimmed = input.trim();
    // Try to extract from URL: last path segment after last '-' or last '/'
    try {
        const url = new URL(trimmed);
        if (url.hostname.includes('sketchfab.com')) {
            const parts = url.pathname.split('/').filter(Boolean);
            const last = parts[parts.length - 1];
            // 3d-models/slug-UID: UID is the last hyphen-separated segment (32 hex chars)
            const hexMatch = last.match(/([0-9a-f]{32})$/i);
            if (hexMatch) return hexMatch[1];
            // /models/UID format
            if (last.match(/^[0-9a-f-]{32,36}$/i)) return last;
        }
    } catch (_) {
        // Not a URL — treat as bare UID
    }
    // Already a bare UID (32 hex chars, optionally with hyphens)
    if (trimmed.match(/^[0-9a-f-]{32,36}$/i)) return trimmed;
    return trimmed; // Return as-is if we can't parse it
}

function formatDateInputValue(timestamp) {
    if (!timestamp) return "";
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const pad = (num) => String(num).padStart(2, "0");
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        return `${year}-${month}-${day}`;
    } catch (error) {
        return "";
    }
}

function parseDateInput(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Timestamp.fromDate(date);
}

// GENERIC DELETE FUNCTION
async function deleteItem(collectionName, id) {
    if (confirm("CONFIRM DELETION?")) {
        try { await deleteDoc(doc(db, collectionName, id)); } 
        catch (error) { alert("Delete Failed"); }
    }
}

// UPLOAD HELPER (CLOUDINARY) - Server-side upload with API Secret
async function uploadToCloudinary(file) {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        throw new Error("Cloudinary configuration missing. Please check the config section.");
    }
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("cloudName", CLOUDINARY_CLOUD_NAME);
    formData.append("apiKey", CLOUDINARY_API_KEY);
    formData.append("apiSecret", CLOUDINARY_API_SECRET);
    
    const response = await fetch("/api/upload-cloudinary", { 
        method: "POST", 
        body: formData 
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
    }
    
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

            // Upload standard icon if a file is selected and no URL is already set
            if (iconFile && type !== "3D Model" && type !== "Software" && !iconUrl) {
                submitBtn.innerText = "UPLOADING ICON...";
                iconUrl = await uploadToCloudinary(iconFile);
            }

            let sketchfabUid = extractSketchfabUid(document.getElementById("p-sketchfab-uid")?.value || "");
            if (type === "3D Model" && modelFile && !sketchfabUid) {
                // Validate 3D model file format only — Sketchfab handles size limits
                const allowedExtensions = ['.glb', '.gltf', '.fbx', '.obj', '.dae', '.stl', '.blend'];
                const fileName = modelFile.name.toLowerCase();
                const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

                if (!allowedExtensions.includes(fileExtension)) {
                    alert(`ERROR: Invalid file format!\n\nAllowed formats: ${allowedExtensions.join(', ').toUpperCase()}\nYour file: ${fileExtension.toUpperCase()}`);
                    loader.style.display = "none";
                    submitBtn.disabled = false;
                    submitBtn.innerText = "EXECUTE UPLOAD";
                    return;
                }

                submitBtn.innerText = "UPLOADING TO SKETCHFAB...";
                sketchfabUid = await handleSketchfabUpload(modelFile, title, desc);
            }

            // For 3D Model: upload all view angle images that have a file selected but no URL yet
            if (type === "3D Model") {
                const angles = ["front", "back", "left", "right", "top", "bottom"];
                for (const angle of angles) {
                    const file = document.getElementById(`file-${angle}`)?.files[0];
                    const urlInput = document.getElementById(`url-${angle}`);
                    const statusEl = document.getElementById(`status-${angle}`);
                    if (file && urlInput && !urlInput.value.trim()) {
                        if (statusEl) { statusEl.textContent = 'UPLOADING...'; statusEl.className = 'slot-status uploading'; }
                        submitBtn.innerText = `UPLOADING ${angle.toUpperCase()} VIEW...`;
                        try {
                            const cloudUrl = await uploadToCloudinary(file);
                            urlInput.value = cloudUrl;
                            if (statusEl) { statusEl.textContent = 'UPLOADED'; statusEl.className = 'slot-status done'; }
                            // If this angle's star is active, set as cover
                            const starBtn = document.querySelector(`.star-cover-btn[data-angle="${angle}"]`);
                            if (starBtn?.classList.contains('active')) {
                                const iconInput = document.getElementById('p-icon');
                                if (iconInput) iconInput.value = cloudUrl;
                                iconUrl = cloudUrl;
                            }
                        } catch (err) {
                            if (statusEl) { statusEl.textContent = 'FAILED: ' + err.message; statusEl.className = 'slot-status error'; }
                            throw new Error(`Failed to upload ${angle} view: ${err.message}`);
                        }
                    }
                }
                submitBtn.innerText = "PROCESSING...";
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
                link: (type === 'Software') ? (document.getElementById("p-sw-link")?.value || "") : (document.getElementById("p-link").value || ""),
                icon_url: iconUrl || "",
                sketchfab_uid: sketchfabUid,
                created_at: parseDateInput(document.getElementById("p-created-at")?.value) || serverTimestamp()
            };

            // For Software: upload preview images and set icon/link
            if (type === "Software") {
                // Upload icon file if selected
                const swIconFile = document.getElementById('p-sw-icon-file')?.files[0];
                const swIconUrl = document.getElementById('p-sw-icon')?.value?.trim();
                if (swIconFile && !swIconUrl) {
                    submitBtn.innerText = "UPLOADING ICON...";
                    const uploadedIconUrl = await uploadToCloudinary(swIconFile);
                    document.getElementById('p-sw-icon').value = uploadedIconUrl;
                }

                const previewUrls = await uploadSoftwarePreviewImages(submitBtn);
                if (previewUrls.length > 0) {
                    projectData.preview_images = previewUrls;
                }
                // Use icon override, or first preview as icon
                const swIconOverride = document.getElementById('p-sw-icon')?.value?.trim();
                projectData.icon_url = swIconOverride || (previewUrls.length > 0 ? previewUrls[0] : "") || "";
                
                const swLink = document.getElementById('p-sw-link')?.value?.trim();
                if (swLink) projectData.link = swLink;
                const swGithub = document.getElementById('p-sw-github')?.value?.trim();
                if (swGithub) projectData.github_url = swGithub;
                submitBtn.innerText = "PROCESSING...";
            }

            // For 3D Model, collect view angles
            if (type === "3D Model") {
                const requiredViews = ["front", "back"];
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
                // Use icon_url from p-icon input (set by star button), fallback to front view
                projectData.icon_url = iconUrl || model_views.front || "";
                projectData.link = projectData.icon_url || "";

                // Add .blend download URL if uploaded
                const blendUrl = document.getElementById("p-blend-url")?.value?.trim();
                if (blendUrl) {
                    projectData.blend_download_url = blendUrl;
                }
            }

            await addDoc(collection(db, "projects"), projectData);
            alert("PROJECT UPLOADED SUCCESSFULLY");
            addProjectForm.reset();
            // Restore icon placeholder after reset
            const iconUrlInput = document.getElementById('p-icon');
            if (iconUrlInput) iconUrlInput.placeholder = 'assets/images/...';
            localStorage.removeItem('admin_selected_category');
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
            // Clear blend upload status
            const blendStatus = document.getElementById('blend-upload-status');
            if (blendStatus) blendStatus.innerHTML = '';
            // Reset software preview slots
            resetSoftwarePreviewSlots();
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
    document.getElementById("stack-form").reset();
});

statsForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const valueInput = document.getElementById("stat-value");
    const labelInput = document.getElementById("stat-label");
    const orderInput = document.getElementById("stat-order");
    const submitBtn = statsForm.querySelector("button[type='submit']");

    submitBtn.disabled = true;
    submitBtn.textContent = "PUBLISHING...";

    try {
        const docData = {
            value: valueInput.value.trim(),
            label: labelInput.value.trim().toUpperCase(),
            order: Number(orderInput.value) || 0,
            created_at: serverTimestamp()
        };
        await addDoc(collection(db, "stats"), docData);
        statsForm.reset();
        orderInput.value = docData.order;
    } catch (error) {
        alert("FAILED TO ADD STAT: " + error.message);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = "PUBLISH CARD";
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
    const messageEl = document.getElementById("l-msg");
    const createdEl = document.getElementById("l-created-at");
    const updatedEl = document.getElementById("l-updated-at");
    const nowTimestamp = serverTimestamp();
    const stackSelection = getSelectedLogStack();
    const data = {
        message: messageEl.value.trim(),
        tags: stackSelection.length ? stackSelection : ["SYSTEM"],
        created_at: parseDateInput(createdEl?.value) || nowTimestamp,
        updated_at: parseDateInput(updatedEl?.value) || nowTimestamp
    };
    await addDoc(collection(db, "dev_logs"), data);
    e.target.reset();
    resetLogStackPickerSelection();
});

function resetLogStackPickerSelection() {
    const container = document.getElementById("log-stack-options");
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = false;
    });
    container.querySelectorAll('.dropdown-option').forEach((option) => option.classList.remove('selected'));
    const countDisplay = document.getElementById("log-stack-selected-count");
    if (countDisplay) countDisplay.textContent = "Select stack";
    const hiddenInput = document.getElementById("log-stack-hidden");
    if (hiddenInput) hiddenInput.value = "";
}
