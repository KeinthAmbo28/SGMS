const STORAGE_KEY = "powerhousegym_member_token_v1";
const BASE_URL = window.location.origin;

export function getMemberToken(){ return localStorage.getItem(STORAGE_KEY) || ""; }
export function setMemberToken(token){ localStorage.setItem(STORAGE_KEY, token); }
export function clearMemberToken(){ localStorage.removeItem(STORAGE_KEY); }

export async function memberApi(path, {method="GET", body, auth=true} = {}){
  const headers = { "Content-Type": "application/json" };
  if(auth){
    const token = getMemberToken();
    if(token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body? JSON.stringify(body) : undefined });
  let data = null;
  try{ data = await res.json(); }catch{}
  if(!res.ok){
    if(res.status===401){ clearMemberToken(); window.location.href="/memberRegister.html"; }
    const err = new Error(data?.error || `Request failed (${res.status})`);
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

