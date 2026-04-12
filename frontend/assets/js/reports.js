import { api, formatPeso, mountSidebar, requireSession } from "/assets/js/app.js";

let methodChart = null;

function printReports() {
  window.print();
}

async function main() {
  mountSidebar("reports");
  const user = await requireSession();
  if (!user) return;
  document.getElementById("userLabel").textContent = user.username;

  document.getElementById("printReportsBtn").addEventListener("click", printReports);

  const data = await api("/api/reports/overview");

  const tbody = document.getElementById("topTbody");
  tbody.innerHTML = "";
  for (const r of data.topMembers) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><b>${r.full_name}</b></td><td>${r.checkins}</td>`;
    tbody.appendChild(tr);
  }

  const labels = data.paymentByMethod.map((x) => x.method);
  const values = data.paymentByMethod.map((x) => x.total);

  methodChart?.destroy();
  methodChart = new Chart(document.getElementById("methodChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total",
          data: values,
          backgroundColor: "#ef4444",
          borderRadius: 6
        }
      ]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatPeso(ctx.raw)
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(0,0,0,.05)" } }
      }
    }
  });
}

main();

