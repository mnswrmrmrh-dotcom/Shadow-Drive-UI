// =========================================================
// 🦾 Shadow Drive - الواجهة الأمامية
// =========================================================

// ⚠️ هام جداً: ضع هنا رابط تطبيق Google Apps Script الخاص بك بعد نشره
const API_URL = 'https://script.google.com/macros/s/AKfycbx0TlziqpBtdbQtMQEgxbMZwMi1SUO9uwNe0ryIGIly9FtRJ8b8T_evFD68ENqDN6r6/exec'; 
let ADMIN_KEY = localStorage.getItem('shadow_admin_key') || '';
let currentFolder = 'root';
let pendingFiles = [];

// ---------- المصادقة ----------
function authenticate() {
    const key = document.getElementById('adminKey').value.trim();
    if (!key) return alert('أدخل المفتاح!');
    ADMIN_KEY = key;
    localStorage.setItem('shadow_admin_key', key);
    document.getElementById('authModal').style.display = 'none';
    refreshFiles();
}

window.onload = function() {
    if (ADMIN_KEY) { document.getElementById('authModal').style.display = 'none'; refreshFiles(); }
    else { document.getElementById('authModal').style.display = 'flex'; }
    setupDragDrop();
};

// ---------- الاتصال بالخادم ----------
async function callAPI(action, payload = {}) {
    const params = new URLSearchParams({ action, adminId: ADMIN_KEY, ...payload });
    const url = `${API_URL}?${params.toString()}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        return data.result || data;
    } catch (e) {
        console.error('API Error:', e);
        alert('❌ خطأ في الاتصال بالخادم: ' + e.message);
        return null;
    }
}

// ---------- جلب وعرض الملفات ----------
async function refreshFiles() {
    const grid = document.getElementById('fileGrid');
    grid.innerHTML = '<div class="loading">⏳ تحميل...</div>';
    const result = await callAPI('getFiles', { folder: currentFolder });
    if (!result) return grid.innerHTML = '<div class="loading">❌ فشل التحميل</div>';
    if (result.length === 0) return grid.innerHTML = '<div class="loading">📂 فارغ</div>';
    grid.innerHTML = '';
    result.forEach(file => {
        const card = document.createElement('div');
        card.className = 'file-card';
        let icon = 'fa-file';
        if (file.mimeType.includes('folder')) icon = 'fa-folder';
        else if (file.mimeType.includes('image')) icon = 'fa-image';
        else if (file.mimeType.includes('pdf')) icon = 'fa-file-pdf';
        else if (file.mimeType.includes('video')) icon = 'fa-video';
        else if (file.mimeType.includes('audio')) icon = 'fa-music';
        const isFolder = file.mimeType.includes('folder');
        card.innerHTML = `
            <i class="fas ${icon}" style="color: ${isFolder ? '#fbbc04' : '#1a73e8'}"></i>
            <div class="file-name">${file.name}</div>
            <div class="file-meta">${isFolder ? 'مجلد' : (file.size/1024).toFixed(1)+' KB'}</div>
            <button class="delete-btn" onclick="deleteFile('${file.id}', event)"><i class="fas fa-trash"></i></button>
        `;
        if (isFolder) {
            card.onclick = () => { currentFolder = file.id; document.getElementById('currentPath').innerText = `📂 ${file.name}`; refreshFiles(); };
        } else {
            card.onclick = () => window.open(`https://drive.google.com/uc?id=${file.id}`, '_blank');
        }
        grid.appendChild(card);
    });
}

// ---------- السحب والإفلات ----------
function setupDragDrop() {
    const dropZone = document.getElementById('dropZone');
    ['dragenter','dragover'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
    dropZone.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleDroppedFiles(e.dataTransfer.files); });
    dropZone.addEventListener('click', () => document.getElementById('fileUpload').click());
}

function handleDroppedFiles(files) {
    for (let file of files) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => addPreviewItem(file.name, e.target.result);
            reader.readAsDataURL(file);
        } else {
            addPreviewItem(file.name, null);
        }
        pendingFiles.push(file);
    }
    uploadPendingFiles();
}

function addPreviewItem(name, dataUrl) {
    const container = document.getElementById('previewContainer');
    const div = document.createElement('div');
    div.className = 'preview-item';
    if (dataUrl) { const img = document.createElement('img'); img.src = dataUrl; div.appendChild(img); } 
    else { const icon = document.createElement('i'); icon.className = 'fas fa-file'; icon.style.cssText = 'font-size:40px;color:#ff0055;'; div.appendChild(icon); }
    const label = document.createElement('div'); label.className = 'file-name-preview'; label.innerText = name.length > 15 ? name.substr(0,12)+'...' : name; div.appendChild(label);
    const btn = document.createElement('button'); btn.className = 'remove-preview'; btn.innerText = '✕'; btn.onclick = () => { div.remove(); pendingFiles = pendingFiles.filter(f => f.name !== name); }; div.appendChild(btn);
    container.appendChild(div);
}

function handleUploadInput(files) { if (files.length) handleDroppedFiles(files); }

async function uploadPendingFiles() {
    if (!pendingFiles.length) return;
    const files = [...pendingFiles];
    pendingFiles = [];
    for (let file of files) await uploadFileWithBackup(file);
}

async function uploadFileWithBackup(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64 = e.target.result.split(',')[1];
        const payload = { fileName: file.name, mimeType: file.type || 'application/octet-stream', base64: base64, folder: currentFolder, backup: true };
        const result = await callAPI('uploadFile', payload);
        if (result?.status === 'success') {
            // تحديث المعاينة بعلامة نجاح
            document.querySelectorAll('.preview-item').forEach(el => {
                if (el.querySelector('.file-name-preview')?.innerText.includes(file.name.substr(0,12))) {
                    el.style.border = '2px solid #00ffcc';
                    const done = document.createElement('div');
                    done.style.cssText = 'position:absolute;top:5px;left:5px;background:#00ffcc;color:#000;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:12px;';
                    done.innerText = '✓';
                    if (!el.querySelector('.done-mark')) { done.className = 'done-mark'; el.appendChild(done); }
                }
            });
            refreshFiles();
        } else alert(`❌ فشل رفع: ${file.name}`);
    };
    reader.readAsDataURL(file);
}

// ---------- أوامر أخرى ----------
async function deleteFile(fileId, event) {
    event.stopPropagation();
    if (!confirm('حذف؟')) return;
    const result = await callAPI('deleteFile', { fileId });
    if (result?.status === 'success') { alert('🗑️ تم الحذف'); refreshFiles(); }
}

async function createFolder() {
    const name = prompt('اسم المجلد:');
    if (!name) return;
    const result = await callAPI('createFolder', { folderName: name, parent: currentFolder });
    if (result?.status === 'success') { alert('✅ تم'); refreshFiles(); }
}

async function searchFiles() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return refreshFiles();
    const result = await callAPI('searchFiles', { query });
    alert(`🔍 تم العثور على ${result?.length || 0} نتيجة.`);
    // لعرضها بشكل مبسط، نعيد تحميل الجذر
    currentFolder = 'root';
    document.getElementById('currentPath').innerText = '📂 الجذر';
    refreshFiles();
}

function logout() { localStorage.removeItem('shadow_admin_key'); location.reload(); }
