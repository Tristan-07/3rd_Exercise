/* ==========================================================================
   ICT Service Request Management System - Authentication Module
   Handles user sign-in, sign-up, sign-out, session checks, and route protection.
   ========================================================================== */

let currentUser = null;

/**
 * Checks current user authentication state and enforces page protection (BR-07)
 */
async function checkAuthSession() {
  if (!supabaseClient) {
    initSupabase();
  }

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const isLoginPage = currentPage === 'login.html';

  try {
    const { data, error } = await supabaseClient.auth.getUser();
    
    if (error || !data || !data.user) {
      currentUser = null;
      if (!isLoginPage) {
        console.log("🔒 BR-07 Enforced: Redirecting unauthenticated user to login.html");
        window.location.href = 'login.html';
        return null;
      }
    } else {
      currentUser = data.user;
      console.log("🔓 Authenticated user session found:", currentUser.email);
      
      if (isLoginPage) {
        console.log("User already logged in. Redirecting to dashboard...");
        window.location.href = 'index.html';
        return currentUser;
      }

      updateUserUI(currentUser);
    }
  } catch (err) {
    console.error("Auth session check error:", err);
    if (!isLoginPage) {
      window.location.href = 'login.html';
    }
  }

  return currentUser;
}

/**
 * Updates navbar user badge with logged in details
 */
function updateUserUI(user) {
  const userEmailElem = document.getElementById('user-email-display');
  const userAvatarElem = document.getElementById('user-avatar-initial');

  if (userEmailElem && user) {
    userEmailElem.textContent = user.email || 'User';
  }

  if (userAvatarElem && user && user.email) {
    userAvatarElem.textContent = user.email.charAt(0).toUpperCase();
  }
}

/**
 * Handles user login (Supabase Auth)
 */
async function loginUser(email, password) {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (error) {
      throw error;
    }

    console.log("Login successful:", data.user);
    showToast("Login successful! Loading dashboard...", "success");
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 800);
  } catch (err) {
    console.error("Login failed:", err.message);

    // A real Supabase account must be confirmed before password login succeeds.
    if (err.message && err.message.toLowerCase().includes("email not confirmed")) {
      showToast("Email not confirmed. Confirm the account from your email, or disable Confirm email in Supabase Auth settings.", "error");
      return;
    }

    showToast(err.message || "Failed to log in. Please check your credentials.", "error");
  }
}

/**
 * Logs in with the local demo engine without contacting Supabase Auth.
 */
async function loginDemoUser() {
  localStorage.setItem(STORAGE_KEY_MODE, "true");
  initSupabase();
  await loginUser("student@example.com", "password123");
}

/**
 * Handles user registration (Supabase Auth)
 */
async function signUpUser(email, password) {
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email: email.trim(),
      password: password
    });

    if (error) {
      throw error;
    }

    console.log("Registration successful:", data);
    showToast("Registration successful! Logging in...", "success");
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  } catch (err) {
    console.error("Sign up failed:", err.message);
    showToast(err.message || "Failed to create account.", "error");
  }
}

/**
 * Handles user logout
 */
async function logoutUser() {
  try {
    await supabaseClient.auth.signOut();
    showToast("Logged out successfully.", "info");
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 500);
  } catch (err) {
    console.error("Logout error:", err);
    window.location.href = 'login.html';
  }
}

/**
 * Global Toast Alert Display Helper
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
