import { api, clearToken, getToken } from "/assets/js/app.js";

const el = id => document.getElementById(id);

async function requireSession(){
  const token = getToken();
  if(!token){ window.location.href="/memberLogin.html"; return null; }
  try{ const res = await api("/api/member/me"); return res.member || res.user; }
  catch(e){ clearToken(); window.location.href="/memberLogin.html"; return null; }
}

function setMsg(id,msg){ const e = el(id); if(e) e.textContent = msg||""; }

function renderAttendance(rows){
  const tbody = el("attTbody"); tbody.innerHTML="";
  for(const r of rows){
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${r.check_in_at||"-"}</td><td>${r.check_out_at||"-"}</td><td>${r.check_out_at?"Completed":"Checked in"}</td>`;
    tbody.appendChild(tr);
  }
}

async function refresh(){
  try{
    const me = await api("/api/member/me");
    el("memberName").textContent = me.member?.full_name || me.user?.username || "Member";
    el("memberAvatar").src = me.member?.profile_picture || "";
    const att = await api("/api/member/attendance");
    renderAttendance(att.attendance);
  } catch(e){ clearToken(); window.location.href="/memberLogin.html"; }
}

async function checkIn(){ try{ await api("/api/member/check-in",{method:"POST"}); await refresh(); setMsg("checkMsg","Checked in"); }catch(e){setMsg("checkMsg",e.message);} }
async function checkOut(){ try{ await api("/api/member/check-out",{method:"POST"}); await refresh(); setMsg("checkMsg","Checked out"); }catch(e){setMsg("checkMsg",e.message);} }

async function main(){
  const user = await requireSession(); if(!user) return;
  const logoutBtn = el("memberLogoutBtn"); if(logoutBtn) logoutBtn.addEventListener("click",()=>{ clearToken(); window.location.href="/memberLogin.html"; });
  const checkInBtn = el("checkInBtn"); if(checkInBtn) checkInBtn.addEventListener("click",checkIn);
  const checkOutBtn = el("checkOutBtn"); if(checkOutBtn) checkOutBtn.addEventListener("click",checkOut);
  await refresh();
}

main();