const STORAGE_KEY = "powerhousegym_member_token_v1";

export function getMemberToken() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function setMemberToken(token) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearMemberToken() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function memberApi(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getMemberToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) {
    const fieldHint = (() => {
      const fieldErrors = data?.details?.fieldErrors;
      if (!fieldErrors) return "";
      const firstKey = Object.keys(fieldErrors)[0];
      const firstMsg = fieldErrors?.[firstKey]?.[0];
      if (!firstKey || !firstMsg) return "";
      return ` (${firstKey}: ${firstMsg})`;
    })();
    const msg = (data?.error || `Request failed (${res.status})`) + fieldHint;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function requireMemberSession() {
  const token = getMemberToken();
  if (!token) {
    window.location.href = "/memberLogin.html";
    return null;
  }
  try {
    const me = await memberApi("/api/member/me");
    return me;
  } catch {
    clearMemberToken();
    window.location.href = "/memberLogin.html";
    return null;
  }
}

