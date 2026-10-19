// User Data & Resume Submission App (Connected to Supabase)

const API_BASE = '/api/v1';
let selectedFile = null;

document.addEventListener('DOMContentLoaded', () => {
  checkSupabaseStatus();
  setupDropzone();
  loadSubmissions();
});

// ============================================================================
// 1. SUPABASE STATUS CHECK
// ============================================================================
async function checkSupabaseStatus() {
  const statusPill = document.getElementById('supabase-status-pill');
  const statusText = document.getElementById('supabase-status-text');

  try {
    const res = await fetch(`${API_BASE}/supabase/status`);
    const data = await res.json();

    if (data.connected) {
      statusPill.className = 'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800';
      statusText.innerText = 'Supabase Online';
    } else {
      statusPill.className = 'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono bg-amber-950/80 text-amber-400 border border-amber-800';
      statusText.innerText = 'Supabase Connecting...';
    }
  } catch (error) {
    statusPill.className = 'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono bg-rose-950/80 text-rose-400 border border-rose-800';
    statusText.innerText = 'Offline';
  }
}

// ============================================================================
// 2. FILE DRAG & DROP HANDLERS
// ============================================================================
function setupDropzone() {
  const dropzone = document.getElementById('resume-dropzone');
  const fileInput = document.getElementById('input-resume');

  dropzone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') {
      fileInput.click();
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-cyan-400', 'bg-cyan-950/20');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-cyan-400', 'bg-cyan-950/20');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-cyan-400', 'bg-cyan-950/20');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      applySelectedFile(e.dataTransfer.files[0]);
    }
  });
}

function handleFileChange(input) {
  if (input.files && input.files.length > 0) {
    applySelectedFile(input.files[0]);
  }
}

function applySelectedFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    showToast('File size exceeds the 10MB limit.', 'error');
    return;
  }

  selectedFile = file;
  document.getElementById('dropzone-prompt').classList.add('hidden');
  const infoEl = document.getElementById('selected-file-info');
  infoEl.classList.remove('hidden');

  document.getElementById('selected-filename').innerText = file.name;
  document.getElementById('selected-filesize').innerText = `(${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
}

function clearSelectedFile(e) {
  if (e) e.stopPropagation();
  selectedFile = null;
  document.getElementById('input-resume').value = '';
  document.getElementById('selected-file-info').classList.add('hidden');
  document.getElementById('dropzone-prompt').classList.remove('hidden');
}

// ============================================================================
// 3. FORM SUBMISSION TO SUPABASE
// ============================================================================
async function handleFormSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('input-name').value.trim();
  const email = document.getElementById('input-email').value.trim();
  const phone = document.getElementById('input-phone').value.trim();
  const role = document.getElementById('input-role').value.trim();
  const skills = document.getElementById('input-skills').value.trim();
  const notes = document.getElementById('input-notes').value.trim();

  if (!name || !email) {
    showToast('Please provide your Full Name and Email Address.', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <span class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
    <span>Saving to Supabase...</span>
  `;

  try {
    const formData = new FormData();
    formData.append('fullName', name);
    formData.append('email', email);
    formData.append('phone', phone);
    formData.append('targetRole', role);
    formData.append('skills', skills);
    formData.append('notes', notes);

    if (selectedFile) {
      formData.append('resume', selectedFile);
    }

    const res = await fetch(`${API_BASE}/supabase/submit`, {
      method: 'POST',
      body: formData,
    });

    const result = await res.json();
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <span>Save My Data & Resume to Supabase</span>
      <span>➔</span>
    `;

    if (!res.ok) {
      showToast(result.error || 'Failed to save data', 'error');
      return;
    }

    showToast('🎉 Data and Resume saved successfully to Supabase!', 'success');

    // Reset Form
    document.getElementById('submission-form').reset();
    clearSelectedFile();

    // Reload Submissions Stream
    await loadSubmissions();
  } catch (error) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <span>Save My Data & Resume to Supabase</span>
      <span>➔</span>
    `;
    showToast('Network error while connecting to server.', 'error');
    console.error(error);
  }
}

// ============================================================================
// 4. LOAD RECENT SUBMISSIONS
// ============================================================================
async function loadSubmissions() {
  const container = document.getElementById('submissions-list');

  try {
    const res = await fetch(`${API_BASE}/supabase/submissions`);
    const data = await res.json();

    if (!res.ok || !data.submissions || data.submissions.length === 0) {
      container.innerHTML = `
        <div class="py-8 text-center text-slate-500 text-xs">
          No user data submitted yet. Fill out the form above to submit your first record!
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    data.submissions.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'p-4 rounded-2xl bg-surface-900 border border-surface-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs';

      const resumeBadge = item.resume_file_name
        ? `<span class="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono border border-cyan-800">📄 ${item.resume_file_name}</span>`
        : `<span class="text-slate-500">No Resume</span>`;

      card.innerHTML = `
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <span class="font-bold text-sm text-slate-100">${item.full_name || 'Anonymous'}</span>
            <span class="text-slate-400 font-mono text-[11px]">${item.email || ''}</span>
            ${item.phone ? `<span class="text-slate-500 text-[11px] font-mono">• ${item.phone}</span>` : ''}
          </div>
          <div class="flex items-center space-x-2 text-slate-400">
            <span>Target: <strong class="text-slate-200">${item.target_role || 'Not specified'}</strong></span>
            ${item.skills ? `<span>• Skills: <span class="text-slate-300">${item.skills}</span></span>` : ''}
          </div>
        </div>

        <div class="flex items-center space-x-3 self-end sm:self-auto">
          ${resumeBadge}
          <span class="text-[10px] text-slate-500 font-mono">${new Date(item.created_at).toLocaleDateString()}</span>
        </div>
      `;

      container.appendChild(card);
    });
  } catch (error) {
    container.innerHTML = `<p class="text-xs text-rose-400 text-center py-4">Error loading submissions.</p>`;
  }
}

// ============================================================================
// 5. SQL MODAL & COPY HELPER
// ============================================================================
function openSqlModal() {
  document.getElementById('sql-modal').classList.remove('hidden');
}

function closeSqlModal() {
  document.getElementById('sql-modal').classList.add('hidden');
}

function copySql() {
  const code = document.getElementById('sql-code').innerText;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('btn-copy-sql');
    btn.innerText = 'Copied!';
    setTimeout(() => {
      btn.innerText = 'Copy SQL';
    }, 2000);
  });
}

// ============================================================================
// 6. TOAST NOTIFICATIONS
// ============================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');

  const bgTypes = {
    success: 'bg-emerald-950 border-emerald-800 text-emerald-300',
    error: 'bg-rose-950 border-rose-800 text-rose-300',
    warning: 'bg-amber-950 border-amber-800 text-amber-300',
    info: 'bg-surface-800 border-surface-700 text-slate-200',
  };

  const icons = {
    success: '✔',
    error: '✖',
    warning: '⚠',
    info: 'ℹ',
  };

  toast.className = `toast pointer-events-auto flex items-center space-x-2.5 px-4 py-3 rounded-2xl border shadow-2xl text-xs font-medium max-w-sm ${bgTypes[type] || bgTypes.info}`;
  toast.innerHTML = `
    <span class="font-bold">${icons[type] || 'ℹ'}</span>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
