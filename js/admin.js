import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// CLOUDINARY CONFIG (USER MUST FILL THIS)
const CLOUD_NAME = "dc1avvowu"; // Ganti dengan Cloud Name kamu
const UPLOAD_PRESET = "TIDIDI_PORTO"; // Ganti dengan Upload Preset (Unsigned)

// DOM Elements
const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("btn-logout");
const addProjectForm = document.getElementById("add-project-form");
const projectList = document.getElementById("admin-project-list");
const loginMsg = document.getElementById("login-msg");
const loader = document.getElementById("upload-loader");

// --- AUTHENTICATION ---

// Monitor Auth State
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        console.log("Logged in as:", user.email);
        loginPanel.style.display = "none";
        dashboard.style.display = "block";
        
        // Start Listening to Projects
        subscribeToProjects();
    } else {
        // User is signed out
        loginPanel.style.display = "block";
        dashboard.style.display = "none";
    }
});

// Login Function
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    
    loginMsg.textContent = "AUTHENTICATING...";
    loginMsg.className = "status-msg";

    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginMsg.textContent = "ACCESS GRANTED";
        loginMsg.className = "status-msg success";
    } catch (error) {
        console.error("Login Error:", error);
        loginMsg.textContent = "ACCESS DENIED: " + error.code;
        loginMsg.className = "status-msg error";
    }
});

// Logout Function
logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        console.log("Logged out");
    } catch (error) {
        console.error("Logout Error:", error);
    }
});

// --- TAB NAVIGATION ---
document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        // Remove active class
        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".admin-section").forEach(s => s.style.display = "none");
        
        // Add active state
        btn.classList.add("active");
        document.getElementById(btn.dataset.target).style.display = "block";

        // Lazy Load Data based on Tab
        if(btn.dataset.target === "section-stack") loadStack();
    });
});

// --- DATABASE OPERATIONS ---

// 1. PROJECTS LISTENER
let unsubscribeProjects;
function subscribeToProjects() {
    if (unsubscribeProjects) unsubscribeProjects();
    const q = query(collection(db, "projects"), orderBy("created_at", "desc"));
    unsubscribeProjects = onSnapshot(q, (snapshot) => {
        projectList.innerHTML = "";
        if (snapshot.empty) {
            projectList.innerHTML = "<p style='text-align:center; color:#555;'>/// DATABASE_EMPTY</p>";
            return;
        }
        snapshot.forEach((doc) => {
            renderProjectItem(doc.id, doc.data());
        });
    });
}

function renderProjectItem(id, data) {
    const item = document.createElement("div");
    item.className = "project-item";
    // Modified structure to allow stacking the edit form below
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
    
    // Attach Inline Edit Listener
    item.querySelector(".btn-edit-project").addEventListener("click", () => {
        toggleEditProject(id, data);
    });

    projectList.appendChild(item);
}

// INLINE EDIT FUNCTION
function toggleEditProject(id, data) {
    const slot = document.getElementById(`edit-slot-${id}`);
    if (slot.style.display === "block") {
        slot.style.display = "none";
        slot.innerHTML = ""; // Clear to save memory
        return;
    }

    slot.style.display = "block";
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
                     <select class="edit-p-type" style="height:50px; width:100%; background:#050505; border:1px solid var(--text-dim); color:white;">
                        <option value="Game" ${data.type === 'Game' ? 'selected' : ''}>Game</option>
                        <option value="Model" ${data.type === 'Model' ? 'selected' : ''}>Model</option>
                        <option value="Project" ${data.type === 'Project' ? 'selected' : ''}>Project</option>
                     </select>
                </div>
                 <div>
                     <label>STATUS</label>
                     <select class="edit-p-status" style="height:50px; width:100%; background:#050505; border:1px solid var(--text-dim); color:white;">
                        <option value="Working" ${data.status === 'Working' ? 'selected' : ''}>Working</option>
                        <option value="Completed" ${data.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Discontinue" ${data.status === 'Discontinue' ? 'selected' : ''}>Discontinue</option>
                     </select>
                </div>
            </div>

            <label>DESCRIPTION</label>
            <textarea class="edit-p-desc" rows="3" required>${data.description}</textarea>

            <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
                <div>
                    <label>ICON (CHANGE?)</label>
                    <input type="text" class="edit-p-icon" value="${data.icon_url || ''}" placeholder="https://...">
                    <input type="file" class="edit-p-icon-file" accept="image/*" style="font-size: 0.8rem;">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <label>TECH STACK</label>
                    <input type="text" class="edit-p-stack" value="${data.stack.join(", ")}" required>
                </div>
                <div>
                    <label>LINK / URL</label>
                    <input type="text" class="edit-p-link" value="${data.link}" required>
                </div>
            </div>
            
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button type="submit" class="btn-brutal" style="flex:1;">SAVE CHANGES</button>
                <button type="button" class="btn-brutal outline" style="flex:1;" onclick="document.getElementById('edit-slot-${id}').style.display='none'">CANCEL</button>
            </div>
        </form>
    `;

    // Attach Submit Handler for THIS specific form
    const form = slot.querySelector("form");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type='submit']");
        btn.innerText = "SAVING...";
        btn.disabled = true;

        try {
            // Check for new file upload
            const iconFile = form.querySelector(".edit-p-icon-file").files[0];
            let iconUrl = form.querySelector(".edit-p-icon").value;

            if (iconFile) {
                btn.innerText = "UPLOADING...";
                iconUrl = await uploadToCloudinary(iconFile);
            }

            const updates = {
                title: form.querySelector(".edit-p-title").value,
                type: form.querySelector(".edit-p-type").value,
                status: form.querySelector(".edit-p-status").value,
                description: form.querySelector(".edit-p-desc").value,
                stack: form.querySelector(".edit-p-stack").value.split(",").map(s => s.trim().toUpperCase()),
                link: form.querySelector(".edit-p-link").value,
                icon_url: iconUrl
            };

            await setDoc(doc(db, "projects", id), updates, { merge: true });
            
            alert("PROJECT UPDATED");
            slot.style.display = "none";
            slot.innerHTML = "";
        } catch (err) {
            alert("ERROR: " + err.message);
            console.error(err);
        }
        btn.disabled = false;
        btn.innerText = "SAVE CHANGES";
    });
}

// 2. TECH STACK
function loadStack() {
    const list = document.getElementById("admin-stack-list");
    if(!list) return;

    const q = query(collection(db, "tech_stack"), orderBy("category"));
    
    onSnapshot(q, (snapshot) => {
        list.innerHTML = "";
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            renderStackItem(docSnap.id, data, list);
        });
    });
}

function renderStackItem(id, data, list) {
    const item = document.createElement("div");
    item.className = "project-item";
    item.style.flexDirection = "column";
    item.style.alignItems = "stretch";
    
    item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h3>// ${data.name}</h3>
                <p>${data.category} | READY</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-edit-stack btn-edit" data-id="${id}">EDIT</button>
                <button class="btn-delete" data-id="${id}" data-col="tech_stack">DELETE</button>
            </div>
        </div>
        <div class="edit-slot" id="edit-slot-stack-${id}" style="display:none; margin-top:20px; border-top:1px dashed #333; padding-top:20px;"></div>
    `;
    item.querySelector(".btn-delete").addEventListener("click", () => deleteItem("tech_stack", id));
    
    // Attach Inline Edit Listener
    item.querySelector(".btn-edit-stack").addEventListener("click", () => {
        toggleEditStack(id, data);
    });
    
    list.appendChild(item);
}

function toggleEditStack(id, data) {
    const slot = document.getElementById(`edit-slot-stack-${id}`);
    if (slot.style.display === "block") {
        slot.style.display = "none";
        slot.innerHTML = "";
        return;
    }

    slot.style.display = "block";
    slot.innerHTML = `
         <form class="inline-edit-form">
            <h4 style="color:var(--accent); margin-bottom:15px;">/// MODIFY MODULE</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <label>TECH NAME</label>
                    <input type="text" class="edit-s-name" value="${data.name}" required>
                </div>
                <div>
                    <label>CATEGORY</label>
                    <select class="edit-s-cat" style="height: 50px; width:100%; background:#050505; color:white; border:1px solid #333; padding:10px;">
                        <option value="ENGINES" ${data.category === 'ENGINES' ? 'selected' : ''}>ENGINES</option>
                        <option value="LANGUAGES" ${data.category === 'LANGUAGES' ? 'selected' : ''}>LANGUAGES</option>
                        <option value="TOOLS" ${data.category === 'TOOLS' ? 'selected' : ''}>TOOLS</option>
                    </select>
                </div>
            </div>
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button type="submit" class="btn-brutal" style="flex:1;">UPDATE MODULE</button>
                <button type="button" class="btn-brutal outline" style="flex:1;" onclick="document.getElementById('edit-slot-stack-${id}').style.display='none'">CANCEL</button>
            </div>
        </form>
    `;
    
    const form = slot.querySelector("form");
    form.addEventListener("submit", async(e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type='submit']");
        btn.innerText = "UPDATING...";
        btn.disabled = true;
        try {
            await setDoc(doc(db, "tech_stack", id), {
                name: form.querySelector(".edit-s-name").value.toUpperCase(),
                category: form.querySelector(".edit-s-cat").value
            }, { merge: true });
            alert("MODULE UPDATED");
            slot.style.display = "none";
        } catch (e) { alert("ERROR: " + e.message); }
        btn.disabled = false;
        btn.innerText = "UPDATE MODULE";
    });
}

// 2. TECH STACK (Already implemented in previous step, ensuring consistency)
// The loadStack function is assumed to be correct from previous edits.

// 3. EXPERIENCE LISTENER
const expList = document.getElementById("admin-exp-list");
subscribeToExperience();

function subscribeToExperience() {
    const q = query(collection(db, "experience"), orderBy("created_at", "desc"));
    onSnapshot(q, (snapshot) => {
        expList.innerHTML = "";
        snapshot.forEach((doc) => {
            renderExpItem(doc.id, doc.data());
        });
    });
}

function renderExpItem(id, data) {
    const item = document.createElement("div");
    item.className = "project-item";
    item.style.flexDirection = "column"; 
    item.style.alignItems = "stretch";

    item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h3>${data.role} @ ${data.company}</h3>
                <p style="color: var(--accent);">${data.period}</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-edit-exp btn-edit" data-id="${id}">EDIT</button>
                <button class="btn-delete" data-id="${id}">DELETE</button>
            </div>
        </div>
        <div class="edit-slot" id="edit-slot-exp-${id}" style="display:none; margin-top:20px; border-top:1px dashed #333; padding-top:20px;"></div>
    `;
    item.querySelector(".btn-delete").addEventListener("click", () => deleteItem("experience", id));
    
    // Attach Edit Listener
    item.querySelector(".btn-edit-exp").addEventListener("click", () => {
        toggleEditExp(id, data);
    });

    expList.appendChild(item);
}

function toggleEditExp(id, data) {
    const slot = document.getElementById(`edit-slot-exp-${id}`);
    if (slot.style.display === "block") {
        slot.style.display = "none";
        slot.innerHTML = "";
        return;
    }
    slot.style.display = "block";
    slot.innerHTML = `
         <form class="inline-edit-form">
            <h4 style="color:var(--accent); margin-bottom:15px;">/// EDIT HISTORY</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <label>ROLE</label>
                    <input type="text" class="edit-e-role" value="${data.role}" required>
                </div>
                <div>
                    <label>COMPANY</label>
                    <input type="text" class="edit-e-company" value="${data.company}" required>
                </div>
            </div>
            <div style="margin-top:10px;">
                 <label>PERIOD</label>
                 <input type="text" class="edit-e-period" value="${data.period}" required>
            </div>
            
            <div style="margin-top:15px;">
                 <label>FOCUS</label>
                 <input type="text" class="edit-e-focus" value="${data.focus || ''}" placeholder="FOCUS AREA">
            </div>

             <div style="margin-top:10px;">
                 <label>DESCRIPTION</label>
                 <textarea class="edit-e-desc" rows="3" required>${data.description}</textarea>
            </div>
            
            <div style="margin-top:15px;">
                <label>CONTRIBUTIONS</label>
                <textarea class="edit-e-contrib" style="height:100px;" placeholder="One per line">${data.contributions || ''}</textarea>
            </div>

            <div style="margin-top:20px; display:flex; gap:10px;">
                <button type="submit" class="btn-brutal" style="flex:1;">UPDATE HISTORY</button>
                <button type="button" class="btn-brutal outline" style="flex:1;" onclick="document.getElementById('edit-slot-exp-${id}').style.display='none'">CANCEL</button>
            </div>
        </form>
    `;
    
    const form = slot.querySelector("form");
    form.addEventListener("submit", async(e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type='submit']");
        btn.disabled = true;
        try {
            await setDoc(doc(db, "experience", id), {
                role: form.querySelector(".edit-e-role").value.toUpperCase(),
                company: form.querySelector(".edit-e-company").value.toUpperCase(),
                period: form.querySelector(".edit-e-period").value.toUpperCase(),
                focus: form.querySelector(".edit-e-focus").value,
                description: form.querySelector(".edit-e-desc").value,
                contributions: form.querySelector(".edit-e-contrib").value
            }, { merge: true });
            alert("HISTORY UPDATED");
            slot.style.display = "none";
        } catch (e) { alert("ERROR: " + e.message); }
        btn.disabled = false;
    });
}

// 4. DEV LOGS LISTENER
const logList = document.getElementById("admin-log-list");
subscribeToLogs();

function subscribeToLogs() {
    const q = query(collection(db, "dev_logs"), orderBy("created_at", "desc"));
    onSnapshot(q, (snapshot) => {
        logList.innerHTML = "";
        snapshot.forEach((doc) => {
            renderLogItem(doc.id, doc.data());
        });
    });
}

function renderLogItem(id, data) {
    const item = document.createElement("div");
    item.className = "project-item";
    item.style.flexDirection = "column"; 
    item.style.alignItems = "stretch";

    item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
             <div>
                <h3>// ${data.message}</h3>
                <p style="color: var(--text-dim); font-size: 0.8rem;">[${data.tags || "SYSTEM"}]</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-edit-log btn-edit" data-id="${id}">EDIT</button>
                <button class="btn-delete" data-id="${id}">DELETE</button>
            </div>
        </div>
         <div class="edit-slot" id="edit-slot-log-${id}" style="display:none; margin-top:20px; border-top:1px dashed #333; padding-top:20px;"></div>
    `;
    item.querySelector(".btn-delete").addEventListener("click", () => deleteItem("dev_logs", id));
    
    // Attach Edit Listener
    item.querySelector(".btn-edit-log").addEventListener("click", () => {
         toggleEditLog(id, data);
    });

    logList.appendChild(item);
}

function toggleEditLog(id, data) {
    const slot = document.getElementById(`edit-slot-log-${id}`);
    if (slot.style.display === "block") {
        slot.style.display = "none";
        slot.innerHTML = "";
        return;
    }
    slot.style.display = "block";
    slot.innerHTML = `
         <form class="inline-edit-form">
            <h4 style="color:var(--accent); margin-bottom:15px;">/// EDIT LOG</h4>
            <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
                <div>
                    <label>MESSAGE</label>
                    <input type="text" class="edit-l-msg" value="${data.message}" required>
                </div>
                <div>
                    <label>TAGS</label>
                    <input type="text" class="edit-l-tags" value="${data.tags || ''}" required>
                </div>
            </div>

            <div style="margin-top:20px; display:flex; gap:10px;">
                <button type="submit" class="btn-brutal" style="flex:1;">UPDATE LOG</button>
                <button type="button" class="btn-brutal outline" style="flex:1;" onclick="document.getElementById('edit-slot-log-${id}').style.display='none'">CANCEL</button>
            </div>
        </form>
    `;
    
    const form = slot.querySelector("form");
    form.addEventListener("submit", async(e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type='submit']");
        btn.disabled = true;
        try {
            await setDoc(doc(db, "dev_logs", id), {
                message: form.querySelector(".edit-l-msg").value,
                tags: form.querySelector(".edit-l-tags").value.toUpperCase()
            }, { merge: true });
            alert("LOG UPDATED");
            slot.style.display = "none";
        } catch (e) { alert("ERROR: " + e.message); }
        btn.disabled = false;
    });
}


function getCategoryColor(cat) {
    if(cat === "ENGINES" || cat === "ENGINE" || cat === "CORE") return "#ff00ff";
    if(cat === "LANGUAGES" || cat === "LANGUAGE" || cat === "FRONTEND") return "#00ffff";
    if(cat === "TOOLS" || cat === "BACKEND") return "#ffff00";
    return "#cccccc";
}

// GENERIC DELETE FUNCTION
async function deleteItem(collectionName, id) {
    if (confirm("CONFIRM DELETION?")) {
        try {
            await deleteDoc(doc(db, collectionName, id));
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Delete Failed");
        }
    }
}

// --- END OF FILE ---

async function updateProject(id, title, type, desc, stackStr, link, iconFile, iconUrl, status) {
    try {
        let finalIconUrl = iconUrl;
        
        // Handle Icon Upload if file selected
        if (iconFile) {
            finalIconUrl = await uploadToCloudinary(iconFile);
            if (!finalIconUrl) throw new Error("Image Upload Failed");
        }

        const projectRef = doc(db, "projects", id);
        
        await setDoc(projectRef, {
            title: title,
            description: desc,
            type: type,
            stack: stackStr.split(",").map(s => s.trim().toUpperCase()),
            link: link,
            icon_url: finalIconUrl,
            status: status
        }, { merge: true });
    } catch (e) {
        console.error("Error updating project:", e);
        throw e;
    }
}

// UPLOAD HELPER (CLOUDINARY)
async function uploadToCloudinary(file) {
    if (!file) return null;
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        if (data.secure_url) {
            return data.secure_url;
        } else {
            throw new Error("Cloudinary Error: " + (data.error?.message || "Unknown"));
        }
    } catch (e) {
        console.error("Upload failed:", e);
        throw e;
    }
}

// ADD / EDIT PROJECT
if(addProjectForm) {
    addProjectForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // CHECK CONFIG
        if (CLOUD_NAME === "YOUR_CLOUD_NAME" || UPLOAD_PRESET === "YOUR_UPLOAD_PRESET") {
            alert("⚠️ CONFIG ERROR: Belum set Cloudinary Cloud Name / Preset di admin.js!");
            return;
        }

        loader.style.display = "block";
        const submitBtn = addProjectForm.querySelector("button");
        const editId = addProjectForm.getAttribute("data-edit-id");
        
        submitBtn.disabled = true;
        submitBtn.innerText = editId ? "UPDATING PROJECT..." : "UPLOADING ASSETS...";

        try {
            // Handle Images
            const iconFile = document.getElementById("p-icon-file").files[0];
            let iconUrl = document.getElementById("p-icon").value;

            if (iconFile) {
                iconUrl = await uploadToCloudinary(iconFile);
            }

            const projectData = {
                title: document.getElementById("p-title").value,
                type: document.getElementById("p-type").value,
                description: document.getElementById("p-desc").value,
                stack: document.getElementById("p-stack").value.split(",").map(s => s.trim().toUpperCase()),
                link: document.getElementById("p-link").value,
                icon_url: iconUrl || "",
                status: document.getElementById("p-status").value, // Added status field
                // created_at: serverTimestamp() // Don't update timestamp on edit usually
            };

            if (editId) {
                // UPDATE
                await setDoc(doc(db, "projects", editId), projectData, { merge: true });
                alert("PROJECT UPDATED");
                addProjectForm.removeAttribute("data-edit-id");
                submitBtn.innerText = "EXECUTE UPLOAD";
            } else {
                // CREATE
                projectData.created_at = serverTimestamp();
                await addDoc(collection(db, "projects"), projectData);
                alert("PROJECT UPLOADED");
            }
            
            addProjectForm.reset();
        } catch (e) { 
            alert("ERROR: " + e.message); 
            console.error(e);
        } 
        
        loader.style.display = "none";
        submitBtn.disabled = false;
        if (!editId) submitBtn.innerText = "EXECUTE UPLOAD";
    });
}

// ADD / EDIT STACK
const stackForm = document.getElementById("stack-form");
if(stackForm) {
    stackForm.addEventListener("submit", async(e) => {
        e.preventDefault();
        const submitBtn = stackForm.querySelector("button");
        const editId = stackForm.getAttribute("data-edit-id");

        const stackData = {
            name: document.getElementById("s-name").value.toUpperCase(),
            category: document.getElementById("s-category").value
        };

        try {
            if (editId) {
                await setDoc(doc(db, "tech_stack", editId), stackData, { merge: true });
                alert("MODULE UPDATED");
                stackForm.removeAttribute("data-edit-id");
                submitBtn.innerText = "INSTALL MODULE";
            } else {
                stackData.created_at = serverTimestamp();
                await addDoc(collection(db, "tech_stack"), stackData);
                alert("MODULE ADDED");
            }
            stackForm.reset();
        } catch (e) { alert("ERROR: " + e.message); }
    });
}

// ADD / EDIT EXPERIENCE
const expForm = document.getElementById("exp-form");
if(expForm) {
    expForm.addEventListener("submit", async(e) => {
        e.preventDefault();
        
        const submitBtn = expForm.querySelector("button");
        const editId = expForm.getAttribute("data-edit-id");

        const expData = {
            role: document.getElementById("e-role").value.toUpperCase(),
            company: document.getElementById("e-company").value.toUpperCase(),
            period: document.getElementById("e-period").value.toUpperCase(),
            focus: document.getElementById("e-focus").value,
            description: document.getElementById("e-desc").value,
            contributions: document.getElementById("e-contributions").value
        };

        try {
            if (editId) {
                await setDoc(doc(db, "experience", editId), expData, { merge: true });
                alert("HISTORY UPDATED");
                expForm.removeAttribute("data-edit-id");
                submitBtn.innerText = "LOG HISTORY";
            } else {
                expData.created_at = serverTimestamp();
                await addDoc(collection(db, "experience"), expData);
                alert("HISTORY ADDED");
            }
            expForm.reset();
        } catch (e) { alert("ERROR: " + e.message); }
    });
}

// ADD / EDIT LOGS
const logForm = document.getElementById("log-form");
if(logForm) {
    logForm.addEventListener("submit", async(e) => {
        e.preventDefault();
        
        const submitBtn = logForm.querySelector("button");
        const editId = logForm.getAttribute("data-edit-id");

        const logData = {
            message: document.getElementById("l-msg").value,
            tags: document.getElementById("l-tags").value.toUpperCase()
        };

        try {
            if (editId) {
                await setDoc(doc(db, "dev_logs", editId), logData, { merge: true });
                alert("LOG UPDATED");
                logForm.removeAttribute("data-edit-id");
                submitBtn.innerText = "COMMIT LOG";
            } else {
                logData.created_at = serverTimestamp();
                await addDoc(collection(db, "dev_logs"), logData);
                alert("LOG COMMITTED");
            }
            logForm.reset();
        } catch (e) { alert("ERROR: " + e.message); }
    });
}


