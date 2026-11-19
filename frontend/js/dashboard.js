/* ==========================================================================
   SEWERWATCH — DASHBOARD ARCHITECTURE & TELEMETRY CONTROLLER
   Next-Generation IoT Early-Warning & Digital Twin Orchestrator
   ========================================================================== */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const nodes = {
  "M-01": { name: "Canteen kitchen line", level: 50, pipe: 4.8, flow: 2.0, turbidity: 92, methane: 310, co: 8, temp: 28.4, humidity: 65, particle: 18, battery: 91 },
  "M-02": { name: "Toilet block line", level: 44, pipe: 5.2, flow: 1.8, turbidity: 105, methane: 280, co: 7, temp: 29.1, humidity: 68, particle: 21, battery: 94 },
  "M-03": { name: "Block B sewage line", level: 62, pipe: 4.5, flow: 1.2, turbidity: 138, methane: 320, co: 9, temp: 28.4, humidity: 63, particle: 16, battery: 87 }
};

let selectedNode = "M-01", simulation = true, homeChart, reportChart;

let alerts = [
  { node: "M-03", level: "Moderate", title: "Flow below baseline", detail: "Flow is 40% below the 2.0 L/s demo baseline.", time: "Today · 06:42" },
  { node: "M-03", level: "Info", title: "Water level rising", detail: "Water level increased in the current simulation.", time: "Today · 06:40" }
];

const sensorMeta = [
  ["Water level", "water_level_cm", "cm", "Ultrasonic level sensor · Distance to surface"],
  ["Pipe distance", "pipe_distance_m", "m", "Ultrasonic pipe echo (optional)"],
  ["Flow", "flow_lps", "L/s", "Flow sensor pulse frequency (optional)"],
  ["Turbidity", "turbidity_raw", "raw", "Raw ADC counts · optical turbidity calibration required"],
  ["Methane", "methane_raw", "ADC", "MQ-4 raw analog reading · not ppm · uncalibrated"],
  ["Carbon monoxide", "co_raw", "ADC", "MQ-7 raw analog reading · not ppm · uncalibrated"],
  ["Temperature", "temperature_c", "°C", "DHT22 ambient sewer temperature"],
  ["Humidity", "humidity_pct", "%", "DHT22 relative humidity"],
  ["Particle distance", "particle_distance_cm", "cm", "Ultrasonic 1 · obstruction distance"],
  ["Node battery", "battery_pct", "%", "Power telemetry · optional battery monitor"]
];

function statusFor(n) {
  if (n.level >= 85 || n.methane >= 5000 || n.co >= 100) return "Major";
  if (n.level >= 70 || n.flow <= 1.4 || n.turbidity >= 150) return "Moderate";
  return "Normal";
}

function current() {
  return nodes[selectedNode];
}

function render() {
  const n = current(), status = statusFor(n);

  // Status Kickers & Descriptions
  $("#overall-status").textContent = status;
  $("#hero-level").innerHTML = `${n.level} <small>cm</small>`;
  $("#hero-flow").innerHTML = `${n.flow.toFixed(1)} <small>L/s</small>`;
  $("#hero-turbidity").innerHTML = `${n.turbidity} <small>raw</small>`;
  $("#hero-methane").innerHTML = `${n.methane} <small>ADC</small>`;

  $("#status-description").textContent = status === "Normal"
    ? "Everything on this line is within the prototype limits. No action needed."
    : status === "Moderate"
      ? "A parameter has crossed a prototype warning threshold. Inspect this line."
      : "A critical prototype threshold has been crossed. Verify readings and inspect immediately.";

  // Status Indicator Dot & Severity Matrix
  $("#hero-dot").className = "dot " + (status === "Normal" ? "green" : status === "Moderate" ? "amber" : "red");
  
  const sevSpans = $$(".severity span");
  if (sevSpans.length >= 3) {
    sevSpans[0].className = "sev-normal " + (status === "Normal" || status === "Moderate" || status === "Major" ? "active" : "");
    sevSpans[1].className = "sev-moderate " + (status === "Moderate" || status === "Major" ? "active" : "");
    sevSpans[2].className = "sev-major " + (status === "Major" ? "active" : "");
  }

  $("#problem-summary").textContent = `${status === "Normal" ? 0 : 1} problems · ${status === "Normal" ? 4 : 3} normal · ${simulation ? "demo data" : "live data"}`;

  // Problem Diagnostic Cards
  $("#methane-value").textContent = n.methane + " ADC";
  $("#co-value").textContent = n.co + " ADC";

  $("#overflow-value").textContent = `${n.level} of 100 cm`;
  $("#level-fill").style.width = Math.min(100, Math.max(0, n.level)) + "%";
  $("#overflow-status").textContent = n.level >= 70 ? "Moderate" : "Normal";
  $("#overflow-status").className = "status-badge " + (n.level >= 70 ? "warn" : "good");
  $("#overflow-description").textContent = n.level >= 70
    ? "Water level has crossed the prototype moderate threshold."
    : "Water level is within the prototype warning threshold.";

  $("#battery-value").textContent = (n.battery != null ? n.battery : 87) + "%";

  const isBlockageWarn = (n.flow <= 1.4 || n.level >= 70);
  $("#blockage-status").textContent = isBlockageWarn ? "Moderate" : "Normal";
  $("#blockage-status").className = "status-badge " + (isBlockageWarn ? "warn" : "good");
  $("#blockage-count").textContent = (isBlockageWarn ? "2" : "0") + " of 4 checks flagged";

  $("#online-text").textContent = `${selectedNode} online · ${simulation ? "demo" : "live"}`;

  // Active Node Selector Chips
  $$(".node-chip").forEach(b => b.classList.toggle("selected", b.dataset.node === selectedNode));

  // 3D Digital Twin Visual updates
  const pipeFluid = $("#pipe-fluid-level");
  if (pipeFluid) {
    pipeFluid.style.height = Math.min(95, Math.max(10, n.level)) + "%";
  }
  const twinHeadspace = $("#twin-headspace");
  if (twinHeadspace) {
    twinHeadspace.textContent = Math.max(0, 100 - Math.round(n.level)) + " cm";
  }
  const twinFlowVector = $("#twin-flow-vector");
  if (twinFlowVector) {
    twinFlowVector.textContent = n.flow > 1.4 ? "LAMINAR (" + n.flow.toFixed(1) + " L/s)" : "RESTRICTED / SLOW";
  }

  renderSensors();
  renderAlerts();
  renderReportStats();
  updateCharts();
}

function renderSensors() {
  const n = current();
  const values = [n.level, n.pipe, n.flow, n.turbidity, n.methane, n.co, n.temp, n.humidity, n.particle, n.battery];

  $("#sensor-grid").innerHTML = sensorMeta.map((m, i) => {
    const isWarn = (i === 1 || (i === 2 && n.flow < 1.5) || (i === 0 && n.level >= 70));
    return `
      <article class="sensor-card card-3d-tilt"
        data-sensor-index="${i}"
        role="button"
        tabindex="0"
        title="Click to view sensor details">

        <div class="card-head">
          <h3>${m[0]}</h3>
          <span class="status-badge ${isWarn ? "warn" : "good"}">
            ${isWarn ? "Check" : "Available"}
          </span>
        </div>

        <div class="sensor-value">
          ${values[i] != null ? values[i] : "--"} <small>${m[2]}</small>
        </div>

        <p>${m[3]}</p>

        <div class="sensor-foot">
          <span>${simulation ? "Simulation" : "ESP32 data"}</span>
          <span>Node ${selectedNode}</span>
        </div>

        <div class="sensor-open-hint">DIAGNOSTIC VIEW ↗</div>
      </article>
    `;
  }).join("");

  attachTiltEffect();
}

function renderAlerts() {
  $("#alert-count").textContent = alerts.length;
  $("#alerts-list").innerHTML = alerts.length ? alerts.map(a => `
    <article class="event">
      <div>
        <b>${a.title} · ${a.node}</b>
        <p>${a.detail}</p>
        <small class="muted">${a.time}</small>
      </div>
      <span class="status-badge ${a.level === "Moderate" ? "warn" : "good"}">${a.level}</span>
    </article>
  `).join("") : `<article class="panel">No active demo alerts. System operating within normal baseline.</article>`;
}

function renderReportStats() {
  const n = current();
  $("#report-stats").innerHTML = `
    <div class="stat-box card-3d-tilt">
      <small>Current water level</small>
      <b>${n.level} cm</b>
    </div>
    <div class="stat-box card-3d-tilt">
      <small>Current flow rate</small>
      <b>${n.flow.toFixed(1)} L/s</b>
    </div>
    <div class="stat-box card-3d-tilt">
      <small>Node battery health</small>
      <b>${n.battery != null ? n.battery : 87}%</b>
    </div>
  `;
  attachTiltEffect();
}

function chartData() {
  const n = current();
  return [n.level - 7, n.level - 6, n.level - 8, n.level - 5, n.level - 6, n.level - 2, n.level];
}

function chartConfig() {
  const isDark = document.documentElement.dataset.theme !== "light";
  const primaryColor = isDark ? "#00f0ff" : "#0284c7";
  const gridColor = isDark ? "rgba(0, 240, 255, 0.08)" : "rgba(148, 163, 184, 0.15)";
  const textColor = isDark ? "#8fa0bd" : "#64748b";

  return {
    type: "line",
    data: {
      labels: ["-60m", "-50m", "-40m", "-30m", "-20m", "-10m", "Now"],
      datasets: [{
        label: "Water level (cm)",
        data: chartData(),
        borderColor: primaryColor,
        borderWidth: 2.5,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return "rgba(0, 240, 255, 0.1)";
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, isDark ? "rgba(0, 240, 255, 0.35)" : "rgba(2, 132, 199, 0.25)");
          gradient.addColorStop(0.7, isDark ? "rgba(0, 240, 255, 0.05)" : "rgba(2, 132, 199, 0.03)");
          gradient.addColorStop(1, "rgba(0, 240, 255, 0)");
          return gradient;
        },
        fill: true,
        tension: 0.38,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: primaryColor,
        pointBorderColor: "#ffffff",
        pointBorderWidth: 1.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? "rgba(14, 23, 40, 0.95)" : "rgba(255, 255, 255, 0.95)",
          titleColor: isDark ? "#ffffff" : "#0f172a",
          bodyColor: isDark ? "#00f0ff" : "#0284c7",
          borderColor: isDark ? "rgba(0, 240, 255, 0.3)" : "rgba(2, 132, 199, 0.3)",
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          titleFont: { family: "Inter", weight: 600 },
          bodyFont: { family: "JetBrains Mono", weight: 700 },
          displayColors: false,
          callbacks: {
            label: (ctx) => `Level: ${ctx.parsed.y} cm`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 100,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: "JetBrains Mono", size: 10 },
            callback: (val) => val + " cm"
          }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { family: "JetBrains Mono", size: 10 }
          }
        }
      }
    }
  };
}

function updateCharts() {
  if (!window.Chart) return;
  if (!homeChart) {
    homeChart = new Chart($("#home-chart"), chartConfig());
  } else {
    homeChart.data.datasets[0].data = chartData();
    homeChart.update();
  }
  if (!reportChart) {
    reportChart = new Chart($("#report-chart"), chartConfig());
  } else {
    reportChart.data.datasets[0].data = chartData();
    reportChart.update();
  }
}

// Sensor Modal Inspection Handler
$("#sensor-grid").addEventListener("click", e => {
  const card = e.target.closest("[data-sensor-index]");
  if (!card) return;

  const i = Number(card.dataset.sensorIndex);
  const n = current();
  const m = sensorMeta[i];
  const values = [
    n.level, n.pipe, n.flow, n.turbidity,
    n.methane, n.co, n.temp, n.humidity,
    n.particle, n.battery
  ];

  const old = $("#sensor-detail");
  if (old) old.remove();

  const popup = document.createElement("div");
  popup.id = "sensor-detail";
  popup.className = "sensor-detail-overlay";

  popup.innerHTML = `
    <div class="sensor-detail-box card-3d-tilt">
      <button class="detail-close" aria-label="Close">×</button>
      <small>SEWERWATCH / TELEMETRY DIAGNOSTIC</small>
      <h2>${m[0]}</h2>
      <div class="detail-reading">${values[i] != null ? values[i] : "--"} <span>${m[2]}</span></div>
      <p>${m[3]}</p>
      <hr>
      <p><b>Node:</b> ${selectedNode}</p>
      <p><b>Data source:</b> ${simulation ? "Simulation" : "ESP32 Hardware Stream"}</p>
      <p><b>Sensor field:</b> ${m[1]}</p>
      <p class="detail-note">Prototype reading. Calibration may be required. MQ-4, MQ-7 and Turbidity are raw ADC values; Ultrasonic is distance, not calibrated depth.</p>
    </div>
  `;

  document.body.appendChild(popup);

  popup.addEventListener("click", e => {
    if (e.target === popup || e.target.closest(".detail-close")) {
      popup.remove();
    }
  });
});

function showPage(page) {
  $$(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + page));
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  const titles = {
    home: ["Home", "Live visibility into sewer-line conditions"],
    sensors: ["Sensors", "Current readings and sensor health telemetry"],
    alerts: ["Alerts", "Warnings, events and status changes across nodes"],
    report: ["Report", "Historical trends and downloadable telemetry data"],
    inspection: ["Inspection", "Maintenance schedule and physical checks"]
  };
  $("#page-title").textContent = titles[page][0];
  $("#page-subtitle").textContent = titles[page][1];
  if (page === "report") setTimeout(updateCharts, 50);

  // Close mobile sidebar upon navigation
  const sidebar = $("#sidebar");
  const backdrop = $("#sidebar-backdrop");
  if (sidebar && sidebar.classList.contains("mobile-open")) {
    sidebar.classList.remove("mobile-open");
    backdrop.classList.remove("mobile-open");
  }
}

$("#nav").addEventListener("click", e => {
  const b = e.target.closest("[data-page]");
  if (b) showPage(b.dataset.page);
});

document.addEventListener("click", e => {
  const b = e.target.closest("[data-go]");
  if (b) showPage(b.dataset.go);
});

$$(".node-chip").forEach(b => b.addEventListener("click", () => {
  selectedNode = b.dataset.node;
  render();
}));

// Theme switching controller
$("#theme-toggle").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  localStorage.setItem("sw-theme", dark ? "dark" : "light");
  $("#theme-toggle").textContent = dark ? "☀ Light mode" : "☾ Dark mode";
  if (homeChart) { homeChart.destroy(); homeChart = null; }
  if (reportChart) { reportChart.destroy(); reportChart = null; }
  updateCharts();
});

const savedTheme = localStorage.getItem("sw-theme") || "dark";
document.documentElement.dataset.theme = savedTheme;
$("#theme-toggle").textContent = savedTheme === "dark" ? "☀ Light mode" : "☾ Dark mode";

$("#simulation-toggle").addEventListener("change", e => {
  simulation = e.target.checked;
  $("#mode-note").textContent = simulation
    ? "Sample data. Real readings replace it once the ESP32 is connected."
    : "Live mode selected. Waiting for an ESP32 reading; demo values remain visible until received.";
  $("#connection-label").textContent = simulation ? "Demo simulation" : "Waiting for hardware";
  render();
});

$("#refresh-btn").addEventListener("click", () => {
  if (simulation) {
    Object.values(nodes).forEach(n => {
      n.level = Math.max(25, Math.min(92, n.level + (Math.random() * 4 - 1.5)));
    });
    render();
  } else {
    fetchLatest();
  }
});

async function fetchLatest() {
  try {
    const r = await fetch(`https://sewer-watch.onrender.com/api/latest?node_id=${encodeURIComponent(selectedNode)}`, { cache: "no-store" });
    const d = await r.json();
    if (d) {
      nodes[selectedNode] = {
        ...current(),
        level: d.water_level_cm ?? current().level,
        pipe: d.pipe_distance_m ?? current().pipe,
        flow: d.flow_lps ?? current().flow,
        turbidity: d.turbidity_raw ?? current().turbidity,
        methane: d.methane_raw ?? current().methane,
        co: d.co_raw ?? current().co,
        temp: d.temperature_c ?? current().temp,
        humidity: d.humidity_pct ?? current().humidity,
        particle: d.particle_distance_cm ?? current().particle,
        battery: d.battery_pct ?? current().battery
      };
      render();
    }
  } catch (err) {
    $("#connection-label").textContent = "Backend unavailable";
  }
}

$("#clear-alerts").addEventListener("click", () => {
  alerts = [];
  renderAlerts();
});

$("#download-report").addEventListener("click", () => {
  const n = current(), rows = [
    ["Node", "Metric", "Value", "Unit"],
    [selectedNode, "Water level", n.level, "cm"],
    [selectedNode, "Pipe distance", n.pipe, "m"],
    [selectedNode, "Flow", n.flow, "L/s"],
    [selectedNode, "Turbidity", n.turbidity, "raw ADC"],
    [selectedNode, "Methane", n.methane, "raw ADC"],
    [selectedNode, "CO", n.co, "raw ADC"],
    [selectedNode, "Temperature", n.temp, "C"],
    [selectedNode, "Humidity", n.humidity, "%"],
    [selectedNode, "Particle distance", n.particle, "cm"],
    [selectedNode, "Battery", n.battery, "%"]
  ];
  const csv = rows.map(r => r.join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `sewerwatch-${selectedNode}-report.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

const checklist = [
  "Check manhole cover and surrounding area",
  "Inspect visible pipe inlet and outlet",
  "Check sensor mounting and cable condition",
  "Compare sensor reading with a manual observation",
  "Record any smell, leakage or visible blockage"
];

$("#inspection-checklist").innerHTML = checklist.map((x, i) => `
  <label class="inspection-item">
    <input type="checkbox">
    <span>${x}</span>
  </label>
`).join("");

let inspectionCount = 0;
function addInspection() {
  inspectionCount++;
  const item = document.createElement("article");
  item.className = "event";
  item.innerHTML = `
    <div>
      <b>Inspection record #${inspectionCount}</b>
      <p>${selectedNode} · Checklist started · ${new Date().toLocaleString()}</p>
    </div>
    <span class="status-badge good">Recorded</span>
  `;
  $("#inspection-history").prepend(item);
}
$("#add-inspection").addEventListener("click", addInspection);

// Mobile Sidebar Drawer Navigation
const mobileTrigger = $("#mobile-menu-trigger");
const mobileClose = $("#mobile-close-btn");
const sidebar = $("#sidebar");
const backdrop = $("#sidebar-backdrop");

if (mobileTrigger) {
  mobileTrigger.addEventListener("click", () => {
    sidebar.classList.add("mobile-open");
    backdrop.classList.add("mobile-open");
  });
}

if (mobileClose) {
  mobileClose.addEventListener("click", () => {
    sidebar.classList.remove("mobile-open");
    backdrop.classList.remove("mobile-open");
  });
}

if (backdrop) {
  backdrop.addEventListener("click", () => {
    sidebar.classList.remove("mobile-open");
    backdrop.classList.remove("mobile-open");
  });
}

// Chart Range Tabs Interaction
$$(".range-tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".range-tabs button").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    const range = btn.dataset.range || btn.textContent.trim();
    if (homeChart) {
      if (range === "1h") {
        homeChart.data.labels = ["-60m", "-50m", "-40m", "-30m", "-20m", "-10m", "Now"];
      } else if (range === "6h") {
        homeChart.data.labels = ["-6h", "-5h", "-4h", "-3h", "-2h", "-1h", "Now"];
      } else if (range === "24h") {
        homeChart.data.labels = ["-24h", "-20h", "-16h", "-12h", "-8h", "-4h", "Now"];
      }
      homeChart.update();
    }
  });
});

// Interactive 3D Card Tilt Functionality
function attachTiltEffect() {
  const cards = $$(".card-3d-tilt");
  cards.forEach(card => {
    if (card._hasTilt) return;
    card._hasTilt = true;

    card.addEventListener("mousemove", e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;

      card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-2px)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

// Initialize Application State
render();
showPage("home");
attachTiltEffect();
setInterval(() => {
  if (!simulation) fetchLatest();
}, 5000);

// SEWERWATCH LIVE HARDWARE MODE: Real backend telemetry handler
simulation = false;
$("#simulation-toggle").checked = false;
$("#mode-note").textContent = "Live mode. Waiting for ESP32 telemetry.";
$("#connection-label").textContent = "Waiting for ESP32";

const originalFetchLatest = fetchLatest;
fetchLatest = async function () {
  try {
    const response = await fetch('https://sewer-watch.onrender.com/api/latest?node_id=' + encodeURIComponent(selectedNode), { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const d = await response.json();
    if (!d) {
      $("#connection-label").textContent = "Waiting for first ESP32 reading";
      $("#online-text").textContent = selectedNode + " · no readings yet";
      return;
    }
    nodes[selectedNode] = {
      ...current(),
      level: d.water_level_cm ?? current().level,
      pipe: d.pipe_distance_m ?? current().pipe,
      flow: d.flow_lps ?? current().flow,
      turbidity: d.turbidity_raw ?? current().turbidity,
      methane: d.methane_raw ?? current().methane,
      co: d.co_raw ?? current().co,
      temp: d.temperature_c ?? current().temp,
      humidity: d.humidity_pct ?? current().humidity,
      particle: d.particle_distance_cm ?? current().particle,
      battery: d.battery_pct ?? current().battery
    };
    $("#connection-label").textContent = "ESP32 connected · last reading " + new Date(d.timestamp).toLocaleTimeString();
    $("#online-text").textContent = selectedNode + " · live hardware";
    render();
  } catch (err) {
    $("#connection-label").textContent = "Backend unavailable";
  }
};

fetchLatest();
