const STORAGE_KEY = "powerhousegym_token_v1";

// 🔥 AUTO-DETECT BASE URL (works for localhost + Render)
const BASE_URL = window.location.origin;

// ==========================
// TOKEN HANDLING
// ==========================
export function getToken() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function setToken(token) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
}

// ==========================
// API CALL FUNCTION
// ==========================
export async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = {
    "Content-Type": "application/json"
  };

  // 🔐 Attach token if needed
  if (auth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    let data = null;

    try {
      data = await res.json();
    } catch {
      // ignore JSON parse error
    }

    if (!res.ok) {
      const msg = data?.error || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;

  } catch (err) {
    console.error("API ERROR:", err);
    throw err;
  }
}

// ==========================
// SESSION CHECK
// ==========================
export async function requireSession() {
  const token = getToken();

  if (!token) {
    window.location.href = "/login.html";
    return null;
  }

  try {
    const me = await api("/api/me");
    return me.user;
  } catch (err) {
    console.warn("Session expired or invalid");
    clearToken();
    window.location.href = "/login.html";
    return null;
  }
}

// ==========================
// SIDEBAR NAVIGATION
// ==========================
export function mountSidebar(activeKey) {
  const links = document.querySelectorAll("[data-nav]");

  for (const a of links) {
    if (a.dataset.nav === activeKey) {
      a.classList.add("active");
    }
  }

  const btn = document.querySelector("#logoutBtn");

  if (btn) {
    btn.addEventListener("click", () => {
      clearToken();
      window.location.href = "/login.html";
    });
  }
}

// ==========================
// FORMAT HELPERS
// ==========================
export function formatPeso(amount) {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP"
    }).format(amount);
  } catch {
    return `₱${Number(amount).toFixed(2)}`;
  }
}

export function humanTime(iso) {
  if (!iso) return "";

  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);

  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} mins ago`;

  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;

  const days = Math.round(hrs / 24);
  return `${days} days ago`;
}