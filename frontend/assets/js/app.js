const STORAGE_KEY = "powerhousegym_token_v1";
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
// API
// ==========================
export async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (auth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  return data;
}

// ==========================
// AUTH GUARDS
// ==========================
export async function requireSession() {
  const token = getToken();

  if (!token) {
    window.location.href = "/login.html";
    return null;
  }

  try {
    const res = await api("/api/me");
    return res.user;
  } catch {
    clearToken();
    window.location.href = "/login.html";
    return null;
  }
}

export async function requireRole(role) {
  const user = await requireSession();
  if (!user) return null;

  if (user.role !== role) {
    window.location.href =
      user.role === "admin"
        ? "/adminDashboard.html"
        : "/memberDashboard.html";
    return null;
  }

  return user;
}