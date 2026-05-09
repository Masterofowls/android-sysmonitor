import {
  Chart,
  DoughnutController,
  LineController,
  ArcElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
} from "chart.js";

Chart.register(
  DoughnutController,
  LineController,
  ArcElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler
);

const { invoke } = window.__TAURI__.core;

const HISTORY_LEN = 10;
const cpuHistory = Array(HISTORY_LEN).fill(0);
let cpuGauge, cpuSpark;
let refreshTimer = null;

function formatMB(mb) {
  if (mb >= 1024) return (mb / 1024).toFixed(1) + " GB";
  return mb.toFixed(0) + " MB";
}

function setLevel(el, pct) {
  el.classList.remove("good", "warn", "danger");
  if (pct < 60) el.classList.add("good");
  else if (pct < 85) el.classList.add("warn");
  else el.classList.add("danger");
}

function initCharts() {
  const gaugeCtx = document.getElementById("cpu-gauge").getContext("2d");
  cpuGauge = new Chart(gaugeCtx, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [0, 100],
        backgroundColor: ["#4fc3f7", "#22263a"],
        borderWidth: 0,
        circumference: 260,
        rotation: -130,
      }],
    },
    options: {
      responsive: false,
      cutout: "78%",
      animation: { duration: 500 },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    },
  });

  const sparkCtx = document.getElementById("cpu-spark").getContext("2d");
  cpuSpark = new Chart(sparkCtx, {
    type: "line",
    data: {
      labels: Array(HISTORY_LEN).fill(""),
      datasets: [{
        data: [...cpuHistory],
        borderColor: "#4fc3f7",
        backgroundColor: "rgba(79,195,247,0.12)",
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.4,
      }],
    },
    options: {
      responsive: false,
      animation: { duration: 300 },
      scales: {
        x: { display: false },
        y: { display: false, min: 0, max: 100 },
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    },
  });
}

function updateUI(stats) {
  const cpu = stats.cpu_usage_percent;
  const temp = stats.cpu_temp_celsius;
  const memUsed = stats.mem_used_mb;
  const memAvail = stats.mem_available_mb;
  const memTotal = stats.mem_total_mb;
  const memExt = stats.mem_extended_mb;

  // CPU gauge
  if (cpu >= 0) {
    const pct = Math.min(100, Math.max(0, cpu));
    cpuGauge.data.datasets[0].data = [pct, 100 - pct];
    cpuGauge.update();
    document.getElementById("cpu-pct").textContent = pct.toFixed(0) + "%";
    cpuHistory.push(pct);
    cpuHistory.shift();
    cpuSpark.data.datasets[0].data = [...cpuHistory];
    cpuSpark.update();
    const badge = document.getElementById("cpu-badge");
    badge.textContent = pct.toFixed(0) + "%";
    setLevel(badge, pct);
    document.getElementById("cpu-status").textContent =
      pct < 60 ? "Normal" : pct < 85 ? "Elevated" : "High";
  } else {
    document.getElementById("cpu-pct").textContent = "N/A";
    document.getElementById("cpu-badge").textContent = "N/A";
    document.getElementById("cpu-status").textContent = "Unavailable";
  }

  // CPU temp
  document.getElementById("cpu-temp").textContent =
    temp >= 0 ? temp.toFixed(1) + "°C" : "N/A";

  // Memory
  const memPct = memTotal > 0 ? ((memUsed / memTotal) * 100) : 0;
  document.getElementById("mem-bar").style.width = memPct.toFixed(1) + "%";
  document.getElementById("mem-pct").textContent = memPct.toFixed(0) + "%";
  document.getElementById("mem-used").textContent = formatMB(memUsed);
  document.getElementById("mem-avail").textContent = formatMB(memAvail);
  document.getElementById("mem-total").textContent = formatMB(memTotal);

  const memBadge = document.getElementById("mem-badge");
  memBadge.textContent = memPct.toFixed(0) + "%";
  setLevel(memBadge, memPct);

  // Extended memory (virtual RAM)
  const extCell = document.getElementById("ext-mem-cell");
  if (memExt > 0) {
    extCell.style.display = "block";
    document.getElementById("mem-ext").textContent = formatMB(memExt);
  } else {
    extCell.style.display = "none";
  }

  document.getElementById("last-time").textContent = new Date().toLocaleTimeString();
}

async function refresh() {
  try {
    const stats = await invoke("get_system_stats");
    updateUI(stats);
  } catch (e) {
    console.error("Stats error:", e);
  }
}

function startTimer() {
  if (refreshTimer) return;
  refreshTimer = setInterval(refresh, 60_000);
  refresh();
}

function stopTimer() {
  clearInterval(refreshTimer);
  refreshTimer = null;
}

document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  startTimer();

  const fab = document.getElementById("fab-refresh");
  fab.addEventListener("click", () => {
    fab.classList.add("spinning");
    refresh().finally(() => {
      setTimeout(() => fab.classList.remove("spinning"), 600);
    });
  });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopTimer();
  else startTimer();
});
