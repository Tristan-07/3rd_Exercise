/* ==========================================================================
   ICT Service Request Management System - Core Application Logic
   Handles CRUD operations, Search, Filtering, Dashboard, Analytics, & Modals.
   ========================================================================== */

let allRequests = [];
let activeEditId = null;
let activeDeleteId = null;

// Initialize App on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  // Enforce session check
  const user = await checkAuthSession();
  
  // If on index.html and authenticated, initialize data & events
  if (document.getElementById('service-requests-body')) {
    setupEventListeners();
    await fetchServiceRequests();
  }
});

/**
 * Attaches DOM event listeners for search, filters, forms, and modals
 */
function setupEventListeners() {
  // Search & Filter listeners
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('filter-status');
  const priorityFilter = document.getElementById('filter-priority');

  if (searchInput) searchInput.addEventListener('input', renderFilteredRequests);
  if (statusFilter) statusFilter.addEventListener('change', renderFilteredRequests);
  if (priorityFilter) priorityFilter.addEventListener('change', renderFilteredRequests);

  // New Request Form Submit
  const requestForm = document.getElementById('request-form');
  if (requestForm) {
    requestForm.addEventListener('submit', handleSaveRequest);
  }

  // Confirm Delete Button
  const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
  }

  // Supabase Key Config Form Submit
  const configForm = document.getElementById('config-form');
  if (configForm) {
    configForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const url = document.getElementById('config-url').value;
      const key = document.getElementById('config-key').value;
      saveSupabaseCredentials(url, key);
    });
  }
}

/**
 * READ Operation: Fetches all service requests from Supabase PostgreSQL
 */
async function fetchServiceRequests() {
  const tableBody = document.getElementById('service-requests-body');
  if (!tableBody) return;

  try {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div class="pulse-dot" style="margin-bottom: 0.5rem;"></div>
          <p>Loading service requests from database...</p>
        </td>
      </tr>
    `;

    const { data, error } = await supabaseClient
      .from('service_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    allRequests = data || [];
    renderFilteredRequests();
  } catch (err) {
    console.error("Error fetching requests:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
          <p class="empty-title">Failed to load requests</p>
          <p>${err.message || 'Please check your database connection or RLS policies.'}</p>
        </td>
      </tr>
    `;
    showToast("Failed to fetch records from backend.", "error");
  }
}

/**
 * Renders table records based on combined Search and Filter criteria (Section VI)
 */
function renderFilteredRequests() {
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('filter-status');
  const priorityFilter = document.getElementById('filter-priority');
  const tableBody = document.getElementById('service-requests-body');

  if (!tableBody) return;

  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const selectedStatus = statusFilter ? statusFilter.value : 'All';
  const selectedPriority = priorityFilter ? priorityFilter.value : 'All';

  // Apply Search & Filter criteria
  const filtered = allRequests.filter(req => {
    // Search Rule: Requester Name, Category, OR Description
    const matchesSearch = !searchQuery || 
      (req.requester_name && req.requester_name.toLowerCase().includes(searchQuery)) ||
      (req.category && req.category.toLowerCase().includes(searchQuery)) ||
      (req.description && req.description.toLowerCase().includes(searchQuery));

    // Status Filter Rule
    const matchesStatus = (selectedStatus === 'All') || (req.status === selectedStatus);

    // Priority Filter Rule
    const matchesPriority = (selectedPriority === 'All') || (req.priority === selectedPriority);

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Update Dashboard Summary Counters & Analytics
  updateDashboardCounters(allRequests);
  updateRequestAnalytics(allRequests);

  // Render Rows
  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">No service requests found</div>
          <p>No records match your search or filter selection.</p>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(req => {
    const formattedId = String(req.id).padStart(3, '0');
    const dateStr = req.created_at ? new Date(req.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'N/A';

    return `
      <tr>
        <td><span class="req-id">#${formattedId}</span></td>
        <td>
          <div class="requester-info">
            <span class="requester-name">${escapeHTML(req.requester_name)}</span>
            <span class="requester-dept">${escapeHTML(req.department)}</span>
          </div>
        </td>
        <td>${escapeHTML(req.category)}</td>
        <td><span class="badge ${getPriorityBadgeClass(req.priority)}">${escapeHTML(req.priority)}</span></td>
        <td>
          <span class="badge ${getStatusBadgeClass(req.status)}">
            <span class="badge-dot"></span>
            ${escapeHTML(req.status)}
          </span>
        </td>
        <td style="max-width: 250px; font-size: 0.825rem; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${escapeHTML(req.description)}">
          ${escapeHTML(req.description)}
        </td>
        <td style="font-size: 0.8rem; color: var(--text-dim);">${dateStr}</td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-secondary btn-icon" onclick="openEditModal(${req.id})" title="Edit Request">
              ✏️ Edit
            </button>
            <button class="btn btn-danger btn-icon" onclick="openDeleteModal(${req.id})" title="Delete Request">
              🗑️ Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Updates Dashboard Summary Cards (Section IV)
 */
function updateDashboardCounters(requests) {
  const totalElem = document.getElementById('stat-total-count');
  const pendingElem = document.getElementById('stat-pending-count');
  const inProgressElem = document.getElementById('stat-inprogress-count');
  const completedElem = document.getElementById('stat-completed-count');

  const total = requests.length;
  const pending = requests.filter(r => r.status === 'Pending').length;
  const inProgress = requests.filter(r => r.status === 'In Progress').length;
  const completed = requests.filter(r => r.status === 'Completed').length;

  if (totalElem) totalElem.textContent = total;
  if (pendingElem) pendingElem.textContent = pending;
  if (inProgressElem) inProgressElem.textContent = inProgress;
  if (completedElem) completedElem.textContent = completed;
}

/**
 * Updates Intermediate Challenge: Request Analytics Breakdown (Section XXIV)
 */
function updateRequestAnalytics(requests) {
  const categoryBarsElem = document.getElementById('category-analytics-bars');
  const priorityBarsElem = document.getElementById('priority-analytics-bars');

  if (!categoryBarsElem || !priorityBarsElem) return;

  const total = requests.length || 1;

  // Category counts
  const categories = [
    'Computer repair', 'Software installation', 'Internet/network problem',
    'Printer problem', 'Account/access concern', 'Other ICT-related concerns'
  ];
  
  const categoryCounts = {};
  categories.forEach(cat => categoryCounts[cat] = 0);
  requests.forEach(r => {
    if (categoryCounts[r.category] !== undefined) {
      categoryCounts[r.category]++;
    } else {
      categoryCounts['Other ICT-related concerns'] = (categoryCounts['Other ICT-related concerns'] || 0) + 1;
    }
  });

  categoryBarsElem.innerHTML = Object.entries(categoryCounts).map(([cat, count]) => {
    const pct = Math.round((count / total) * 100);
    return `
      <div class="analytics-bar-item">
        <span class="bar-label" title="${escapeHTML(cat)}">${escapeHTML(cat)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%;"></div>
        </div>
        <span class="bar-value">${count}</span>
      </div>
    `;
  }).join('');

  // Priority counts
  const priorities = ['High', 'Medium', 'Low'];
  const priorityCounts = { High: 0, Medium: 0, Low: 0 };
  requests.forEach(r => {
    if (priorityCounts[r.priority] !== undefined) {
      priorityCounts[r.priority]++;
    }
  });

  priorityBarsElem.innerHTML = priorities.map(prio => {
    const count = priorityCounts[prio];
    const pct = Math.round((count / total) * 100);
    let colorClass = 'var(--primary)';
    if (prio === 'High') colorClass = 'var(--priority-high)';
    if (prio === 'Medium') colorClass = 'var(--priority-medium)';
    if (prio === 'Low') colorClass = 'var(--priority-low)';

    return `
      <div class="analytics-bar-item">
        <span class="bar-label">${prio} Priority</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background: ${colorClass};"></div>
        </div>
        <span class="bar-value">${count}</span>
      </div>
    `;
  }).join('');
}

/**
 * CREATE & UPDATE Handler: Validates rules BR-01 to BR-06 and saves record
 */
async function handleSaveRequest(e) {
  e.preventDefault();

  const requesterName = document.getElementById('form-requester').value.trim();
  const department = document.getElementById('form-department').value.trim();
  const category = document.getElementById('form-category').value;
  const description = document.getElementById('form-description').value.trim();
  const priority = document.getElementById('form-priority').value;
  const status = document.getElementById('form-status').value || 'Pending';

  // Enforce Business Rules (BR-01 to BR-05)
  if (!requesterName) {
    showToast("BR-01 Violation: Requester name cannot be empty.", "error");
    return;
  }
  if (!department) {
    showToast("BR-02 Violation: Department must be provided.", "error");
    return;
  }
  if (!category) {
    showToast("BR-03 Violation: Category must be selected.", "error");
    return;
  }
  if (!description || description.length < 5) {
    showToast("BR-04 Violation: Description must contain sufficient detail (at least 5 characters).", "error");
    return;
  }
  if (!['Low', 'Medium', 'High'].includes(priority)) {
    showToast("BR-05 Violation: Priority must be Low, Medium, or High.", "error");
    return;
  }

  const payload = {
    requester_name: requesterName,
    department: department,
    category: category,
    description: description,
    priority: priority,
    status: status,
    user_id: currentUser ? currentUser.id : 'demo-user-uuid-12345'
  };

  try {
    if (activeEditId) {
      // UPDATE Operation
      const { error } = await supabaseClient
        .from('service_requests')
        .update(payload)
        .eq('id', activeEditId);

      if (error) throw error;
      showToast("Service request updated successfully!", "success");
    } else {
      // CREATE Operation (BR-06: Automatically receives Pending status if new)
      payload.status = 'Pending';
      const { error } = await supabaseClient
        .from('service_requests')
        .insert([payload]);

      if (error) throw error;
      showToast("New service request submitted successfully!", "success");
    }

    closeModal('modal-request');
    await fetchServiceRequests();
  } catch (err) {
    console.error("Save request error:", err);
    showToast(err.message || "Failed to save service request.", "error");
  }
}

/**
 * DELETE Handler (BR-08: Confirmation guard before deletion)
 */
async function handleConfirmDelete() {
  if (!activeDeleteId) return;

  try {
    const { error } = await supabaseClient
      .from('service_requests')
      .delete()
      .eq('id', activeDeleteId);

    if (error) throw error;

    showToast("Request record successfully deleted.", "info");
    closeModal('modal-delete');
    activeDeleteId = null;
    await fetchServiceRequests();
  } catch (err) {
    console.error("Delete request error:", err);
    showToast(err.message || "Failed to delete request record.", "error");
  }
}

/* Modal Openers */
function openNewRequestModal() {
  activeEditId = null;
  document.getElementById('modal-request-title').textContent = "Submit New Service Request";
  document.getElementById('request-form').reset();
  
  // Hide status selector for new requests (BR-06 auto-pending)
  const statusGroup = document.getElementById('form-status-group');
  if (statusGroup) statusGroup.style.display = 'none';

  openModal('modal-request');
}

function openEditModal(id) {
  const req = allRequests.find(r => r.id === id);
  if (!req) return;

  activeEditId = id;
  document.getElementById('modal-request-title').textContent = `Edit Service Request #${String(id).padStart(3, '0')}`;
  
  document.getElementById('form-requester').value = req.requester_name;
  document.getElementById('form-department').value = req.department;
  document.getElementById('form-category').value = req.category;
  document.getElementById('form-description').value = req.description;
  document.getElementById('form-priority').value = req.priority;
  document.getElementById('form-status').value = req.status;

  // Show status selector for editing
  const statusGroup = document.getElementById('form-status-group');
  if (statusGroup) statusGroup.style.display = 'flex';

  openModal('modal-request');
}

function openDeleteModal(id) {
  activeDeleteId = id;
  const req = allRequests.find(r => r.id === id);
  const infoElem = document.getElementById('delete-target-info');
  if (infoElem && req) {
    infoElem.textContent = `Request #${String(id).padStart(3, '0')} (${req.requester_name} - ${req.category})`;
  }
  openModal('modal-delete');
}

function openConfigModal() {
  const { url, key, forceMock } = getSupabaseCredentials();
  document.getElementById('config-url').value = url || '';
  document.getElementById('config-key').value = key || '';
  openModal('modal-config');
}

/* Helper Utilities */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function getStatusBadgeClass(status) {
  if (status === 'Pending') return 'badge-pending';
  if (status === 'In Progress') return 'badge-inprogress';
  if (status === 'Completed') return 'badge-completed';
  return 'badge-pending';
}

function getPriorityBadgeClass(priority) {
  if (priority === 'High') return 'badge-high';
  if (priority === 'Medium') return 'badge-medium';
  if (priority === 'Low') return 'badge-low';
  return 'badge-medium';
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
