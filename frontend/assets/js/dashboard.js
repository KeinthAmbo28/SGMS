import { api, formatPeso, humanTime, mountSidebar, requireSession } from "/assets/js/app.js";

let attendanceChart = null;
let membershipChart = null;
let paymentsChart = null;

// Utility to build series for charts
function buildSeries(lastDays = 7, rows, valueKey = "c") {
  const map = new Map(rows.map(r => [r.day, r[valueKey]]));
  const days = [];
  const values = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = lastDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push(d.toLocaleDateString(undefined, { weekday: "short" }));
    values.push(map.get(iso) ?? 0);
  }

  return { labels: days, values };
}

async function main() {
  mountSidebar("dashboard");
  const user = await requireSession();
  if (!user) return;
  document.getElementById("userLabel").textContent = user.username;

  let summary;
  try {
    summary = await api("/api/dashboard/summary");
  } catch (err) {
    console.error("Failed to fetch dashboard summary:", err);
    return;
  }

  // Update KPIs
  const kpis = summary.kpis || {};
  document.getElementById("kpiMembers").textContent = kpis.members ?? 0;
  document.getElementById("kpiTrainers").textContent = kpis.trainers ?? 0;
  document.getElementById("kpiClasses").textContent = kpis.classesToday ?? 0;
  document.getElementById("kpiRevenue").textContent = formatPeso(kpis.revenue ?? 0);

  // Prepare chart data safely
  const att = buildSeries(7, summary.attendanceSeries || [], "c");
  const pay = buildSeries(7, summary.paymentSeries || [], "total");
  const memType = summary.membershipType || { annual: 0, monthly: 0 };

  const attCtx = document.getElementById("attendanceChart");
  const payCtx = document.getElementById("paymentsChart");
  const memCtx = document.getElementById("membershipChart");

  // Destroy old charts to avoid overlap
  attendanceChart?.destroy();
  paymentsChart?.destroy();
  membershipChart?.destroy();

  // Attendance Line Chart
  attendanceChart = new Chart(attCtx, {
    type: "line",
    data: {
      labels: att.labels,
      datasets: [{
        label: "Attendance",
        data: att.values,
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.12)",
        tension: 0.35,
        fill: true,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { precision: 0 } }
      }
    }
  });

  // Membership Doughnut Chart
  membershipChart = new Chart(memCtx, {
    type: "doughnut",
    data: {
      labels: ["Annual", "Monthly"],
      datasets: [{
        data: [memType.annual ?? 0, memType.monthly ?? 0],
        backgroundColor: ["#ef4444", "#94a3b8"],
        borderWidth: 0
      }]
    },
    options: { plugins: { legend: { display: false } }, cutout: "62%" }
  });

  // Payment Bar Chart
  paymentsChart = new Chart(payCtx, {
    type: "bar",
    data: {
      labels: pay.labels,
      datasets: [{
        label: "Payments",
        data: pay.values,
        backgroundColor: "#ef4444",
        borderRadius: 6
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(0,0,0,0.05)" } }
      }
    }
  });

  // Recent Activities
  const recent = document.getElementById("recentList");
  recent.innerHTML = "";
  for (const item of summary.recentActivities || []) {
    const li = document.createElement("li");
    li.innerHTML = `<div>${item.text}</div><div class="small muted">${humanTime(item.at)}</div>`;
    recent.appendChild(li);
  }
}

main();