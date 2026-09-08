/* ==========================================================================
   ICT Service Request Management System - Supabase Integration Module
   Handles Supabase Client setup, credential management, and mock fallback engine.
   ========================================================================== */

// Default configuration constants (Students/Reviewers can update these or use the Config UI)
const DEFAULT_SUPABASE_URL = "https://kfbolysjloxvauqrxtye.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_QRRGM5APc7vR1tU4i_LZQA_VblMrHgV";

// LocalStorage Keys
const STORAGE_KEY_URL = "sad_supabase_url";
const STORAGE_KEY_ANON = "sad_supabase_key";
const STORAGE_KEY_MODE = "sad_use_mock_mode";
const STORAGE_KEY_DATA = "sad_service_requests_db";
const STORAGE_KEY_AUTH = "sad_auth_session";

let supabaseClient = null;
let isMockBackend = false;

/**
 * Retrieves the active Supabase Configuration from LocalStorage or defaults
 */
function getSupabaseCredentials() {
  const customUrl = localStorage.getItem(STORAGE_KEY_URL);
  const customKey = localStorage.getItem(STORAGE_KEY_ANON);
  const forceMock = localStorage.getItem(STORAGE_KEY_MODE) === "true";

  const url = customUrl || DEFAULT_SUPABASE_URL;
  const key = customKey || DEFAULT_SUPABASE_KEY;

  const isConfigured = url && key && url !== "https://your-project.supabase.co" && key !== "your-publishable-key";

  return { url, key, isConfigured, forceMock };
}

/**
 * Initializes the Supabase Client or LocalStorage Fallback
 */
function initSupabase() {
  const { url, key, isConfigured, forceMock } = getSupabaseCredentials();

  if (forceMock || !isConfigured || typeof window.supabase === "undefined") {
    console.log("ℹ️ Initializing LocalStorage Supabase Engine (Demo Mode)");
    isMockBackend = true;
    supabaseClient = createMockSupabaseClient();
  } else {
    try {
      console.log("⚡ Initializing Real Supabase Client:", url);
      isMockBackend = false;
      supabaseClient = window.supabase.createClient(url, key);
    } catch (err) {
      console.warn("⚠️ Failed to initialize Supabase client. Falling back to local storage engine:", err);
      isMockBackend = true;
      supabaseClient = createMockSupabaseClient();
    }
  }

  // Initial seed data for Mock Mode if empty
  if (isMockBackend) {
    seedMockDataIfEmpty();
  }

  // Update Status Badge in DOM if element exists
  setTimeout(updateBackendStatusBadge, 100);

  return supabaseClient;
}

/**
 * Updates navbar status badge to inform user whether they are using Real Supabase Cloud or Local Demo Mode
 */
function updateBackendStatusBadge() {
  const badgeElem = document.getElementById('backend-status-badge');
  if (!badgeElem) return;

  if (isMockBackend) {
    badgeElem.innerHTML = `
      <span class="badge" style="background: rgba(251, 191, 36, 0.2); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.4); cursor: pointer;" onclick="switchToRealSupabase()" title="Currently in Local Demo Mode. Click to switch to Real Supabase Cloud.">
        💾 Local Demo Mode (Click to Switch to Real Supabase)
      </span>
    `;
  } else {
    badgeElem.innerHTML = `
      <span class="badge" style="background: rgba(52, 211, 153, 0.2); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.4);" title="Connected to live Supabase PostgreSQL Cloud">
        ⚡ Supabase Cloud Connected
      </span>
    `;
  }
}

/**
 * Force switch to Real Supabase Cloud by clearing local mock toggle
 */
function switchToRealSupabase() {
  localStorage.removeItem(STORAGE_KEY_MODE);
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_ANON);
  window.location.reload();
}

/**
 * Saves custom Supabase credentials to LocalStorage
 */
function saveSupabaseCredentials(url, key) {
  if (url && key) {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_ANON, key.trim());
    localStorage.setItem(STORAGE_KEY_MODE, "false");
  } else {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_ANON);
    localStorage.removeItem(STORAGE_KEY_MODE);
  }
  window.location.reload();
}

/**
 * Toggles Demo / Mock Mode
 */
function setDemoMode(enable) {
  localStorage.setItem(STORAGE_KEY_MODE, enable ? "true" : "false");
  window.location.reload();
}

/**
 * Seeds initial demonstration records into localStorage if empty
 */
function seedMockDataIfEmpty() {
  const existing = localStorage.getItem(STORAGE_KEY_DATA);
  if (!existing || JSON.parse(existing).length === 0) {
    const defaultData = [
      {
        id: 1,
        requester_name: "Juan Dela Cruz",
        department: "Registrar",
        category: "Internet/network problem",
        description: "Computer cannot connect to university Wi-Fi in Admin Bldg room 102.",
        priority: "High",
        status: "Pending",
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        user_id: "demo-user-uuid-12345"
      },
      {
        id: 2,
        requester_name: "Ana Santos",
        department: "Human Resources",
        category: "Printer problem",
        description: "Paper jam issue and offline status on HP LaserJet printer.",
        priority: "Medium",
        status: "Completed",
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        user_id: "demo-user-uuid-12345"
      },
      {
        id: 3,
        requester_name: "Dr. Maria Clara",
        department: "College of Computer Studies",
        category: "Software installation",
        description: "Requesting installation of SPSS 28 and VS Code for lab instruction.",
        priority: "Low",
        status: "In Progress",
        created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
        user_id: "demo-user-uuid-67890"
      },
      {
        id: 4,
        requester_name: "Pedro Penduko",
        department: "Library Services",
        category: "Computer repair",
        description: "Desktop computer auto shutdowns after 10 minutes of usage.",
        priority: "High",
        status: "Pending",
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        user_id: "demo-user-uuid-12345"
      }
    ];
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(defaultData));
  }
}

/**
 * Mock Supabase Engine simulating postgreSQL table queries and auth operations
 */
function createMockSupabaseClient() {
  const getStoredRecords = () => JSON.parse(localStorage.getItem(STORAGE_KEY_DATA) || "[]");
  const saveStoredRecords = (arr) => localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(arr));

  return {
    isMock: true,
    auth: {
      async getUser() {
        const sessionStr = localStorage.getItem(STORAGE_KEY_AUTH);
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          return { data: { user: session.user }, error: null };
        }
        return { data: { user: null }, error: null };
      },
      async signUp({ email, password }) {
        const mockUser = { id: "user-" + Date.now(), email };
        const session = { user: mockUser, access_token: "mock-jwt-token" };
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(session));
        return { data: { user: mockUser, session }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const mockUser = { id: "user-demo-123", email };
        const session = { user: mockUser, access_token: "mock-jwt-token" };
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(session));
        return { data: { user: mockUser, session }, error: null };
      },
      async signOut() {
        localStorage.removeItem(STORAGE_KEY_AUTH);
        return { error: null };
      }
    },
    from(tableName) {
      return {
        select() {
          return {
            async order(field, { ascending = true } = {}) {
              const data = getStoredRecords();
              data.sort((a, b) => {
                const valA = a[field];
                const valB = b[field];
                return ascending ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
              });
              return { data, error: null };
            },
            then(resolve) {
              const data = getStoredRecords();
              resolve({ data, error: null });
            }
          };
        },
        insert(rows) {
          const current = getStoredRecords();
          const nextId = current.length > 0 ? Math.max(...current.map(r => r.id)) + 1 : 1;
          const insertedRows = rows.map((r, idx) => ({
            id: nextId + idx,
            created_at: new Date().toISOString(),
            status: r.status || "Pending",
            ...r
          }));
          const updated = [...current, ...insertedRows];
          saveStoredRecords(updated);
          return Promise.resolve({ data: insertedRows, error: null });
        },
        update(updates) {
          return {
            eq(field, val) {
              const current = getStoredRecords();
              const updated = current.map(row => {
                if (String(row[field]) === String(val)) {
                  return { ...row, ...updates };
                }
                return row;
              });
              saveStoredRecords(updated);
              return Promise.resolve({ data: updates, error: null });
            }
          };
        },
        delete() {
          return {
            eq(field, val) {
              const current = getStoredRecords();
              const updated = current.filter(row => String(row[field]) !== String(val));
              saveStoredRecords(updated);
              return Promise.resolve({ data: true, error: null });
            }
          };
        }
      };
    }
  };
}

// Auto-initialize client on load
initSupabase();
