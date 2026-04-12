// dashboard.js

async function loadDashboard() {
  try {
    // MEMBERS
    const membersRes = await fetch("/api/members");
    const members = await membersRes.json();

    document.getElementById("kpiMembers").textContent = members.length;

    // TRAINERS
    const trainersRes = await fetch("/api/trainers");
    const trainers = await trainersRes.json();

    document.getElementById("kpiTrainers").textContent = trainers.length;

    // ATTENDANCE
    const attendanceRes = await fetch("/api/attendance");
    const attendance = await attendanceRes.json();

    // Show recent activity
    const recentList = document.getElementById("recentList");
    recentList.innerHTML = "";

    attendance.slice(-5).reverse().forEach(a => {
      const li = document.createElement("li");
      li.textContent = `Member #${a.member_id} checked in at ${a.check_in_at}`;
      recentList.appendChild(li);
    });

    // PAYMENTS
    const paymentsRes = await fetch("/api/payments");
    const payments = await paymentsRes.json();

    let totalRevenue = 0;
    payments.forEach(p => totalRevenue += Number(p.amount));

    document.getElementById("kpiRevenue").textContent = "₱ " + totalRevenue;

  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

loadDashboard();