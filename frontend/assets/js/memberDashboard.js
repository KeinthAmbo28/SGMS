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
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.check_in_at||"-"}</td><td>${r.check_out_at||"-"}</td><td>${r.check_out_at?"Completed":"Checked in"}</td>`;
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
    const trainersData = await api("/api/trainers");
    const select = el("trainerSelect");
    if(select){
      select.innerHTML=`<option value="">- Select -</option>`;
      for(const t of trainersData.trainers){
        const option = document.createElement("option");
        option.value=t.id;
        option.textContent=t.full_name;
        select.appendChild(option);
      }
    }
  } catch(e){ clearToken(); window.location.href="/memberLogin.html"; }
}

async function checkIn(){ try{ await api("/api/member/check-in",{method:"POST"}); await refresh(); setMsg("checkMsg","Checked in"); }catch(e){ setMsg("checkMsg",e.message); } }
async function checkOut(){ try{ await api("/api/member/check-out",{method:"POST"}); await refresh(); setMsg("checkMsg","Checked out"); }catch(e){ setMsg("checkMsg",e.message); } }

async function saveTrainer(){
  const trainerId = el("trainerSelect")?.value;
  if(!trainerId) return setMsg("trainerMsg","Select a trainer");
  try{ await api("/api/member/assign-trainer",{method:"POST", body:{trainer_id:trainerId}}); setMsg("trainerMsg","Trainer saved"); }
  catch(e){ setMsg("trainerMsg",e.message); }
}

async function main(){
  const user = await requireSession(); if(!user) return;
  el("memberLogoutBtn")?.addEventListener("click",()=>{ clearToken(); window.location.href="/memberLogin.html"; });
  el("checkInBtn")?.addEventListener("click",checkIn);
  el("checkOutBtn")?.addEventListener("click",checkOut);
  el("saveTrainerBtn")?.addEventListener("click",saveTrainer);
  await refresh();
}

main();