const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const nodes = {
 "M-01": {name:"Canteen kitchen line", level:50, pipe:4.8, flow:2.0, turbidity:92, methane:310, co:8, temp:28.4, humidity:65, particle:18, battery:91},
 "M-02": {name:"Toilet block line", level:44, pipe:5.2, flow:1.8, turbidity:105, methane:280, co:7, temp:29.1, humidity:68, particle:21, battery:94},
 "M-03": {name:"Block B sewage line", level:62, pipe:4.5, flow:1.2, turbidity:138, methane:320, co:9, temp:28.4, humidity:63, particle:16, battery:87}
};
let selectedNode = "M-01", simulation = true, homeChart, reportChart;
let alerts = [
 {node:"M-03",level:"Moderate",title:"Flow below baseline",detail:"Flow is 40% below the 2.0 L/s demo baseline.",time:"Today · 06:42"},
 {node:"M-03",level:"Info",title:"Water level rising",detail:"Water level increased in the current simulation.",time:"Today · 06:40"}
];
const sensorMeta = [
 ["Water level","water_level_cm","cm","Ultrasonic level sensor"],
 ["Pipe distance","pipe_distance_m","m","Ultrasonic pipe echo (optional)"],
 ["Flow","flow_lps","L/s","Flow sensor (optional)"],
 ["Turbidity","turbidity_raw","raw","Raw ADC · calibration required"],
 ["Methane","methane_raw","ADC","MQ-4 raw analog reading · not ppm"],
 ["Carbon monoxide","co_raw","ADC","MQ-7 raw analog reading · not ppm"],
 ["Temperature","temperature_c","°C","DHT22 temperature"],
 ["Humidity","humidity_pct","%","DHT22 relative humidity"],
 ["Particle distance","particle_distance_cm","cm","Ultrasonic 1 · obstruction distance"],
 ["Node battery","battery_pct","%","Power monitor · optional"]
];
function statusFor(n){ if(n.level>=85 || n.methane>=5000 || n.co>=100) return "Major"; if(n.level>=70 || n.flow<=1.4 || n.turbidity>=150) return "Moderate"; return "Normal"; }
function current(){return nodes[selectedNode]}
function render(){
 const n=current(), status=statusFor(n);
 $("#overall-status").textContent=status; $("#hero-level").innerHTML=`${n.level} <small>cm</small>`;
 $("#hero-flow").innerHTML=`${n.flow.toFixed(1)} <small>L/s</small>`;
 $("#hero-turbidity").innerHTML=`${n.turbidity} <small>raw</small>`;
 $("#hero-methane").innerHTML=`${n.methane} <small>ADC</small>`;
 $("#status-description").textContent=status==="Normal"?"Everything on this line is within the prototype limits. No action needed.":status==="Moderate"?"A parameter has crossed a prototype warning threshold. Inspect this line.":"A critical prototype threshold has been crossed. Verify readings and inspect immediately.";
 $("#hero-dot").className="dot "+(status==="Normal"?"green":"amber");
 $("#problem-summary").textContent=`${status==="Normal"?0:1} problems · ${status==="Normal"?4:3} normal · ${simulation?"demo data":"live data"}`;
 $("#methane-value").textContent=n.methane+" ADC"; $("#co-value").textContent=n.co+" ADC";
 $("#overflow-value").textContent=`${n.level} of 100 cm`; $("#level-fill").style.width=n.level+"%";
 $("#overflow-status").textContent=n.level>=70?"Moderate":"Normal"; $("#overflow-status").className="status-badge "+(n.level>=70?"warn":"good");
 $("#overflow-description").textContent=n.level>=70?"Water level has crossed the prototype moderate threshold.":"Water level is within the prototype warning threshold.";
 $("#battery-value").textContent=n.battery+"%";
 $("#blockage-status").textContent=(n.flow<=1.4||n.level>=70)?"Moderate":"Normal";
 $("#blockage-status").className="status-badge "+((n.flow<=1.4||n.level>=70)?"warn":"good");
 $("#blockage-count").textContent=(n.flow<=1.4||n.level>=70?"2":"0")+" of 4 checks flagged";
 $("#online-text").textContent=`${selectedNode} online · ${simulation?"demo":"live"}`;
 $$(".node-chip").forEach(b=>b.classList.toggle("selected",b.dataset.node===selectedNode));
 renderSensors(); renderAlerts(); renderReportStats(); updateCharts();
}
function renderSensors(){
 const n=current();
 const values=[n.level,n.pipe,n.flow,n.turbidity,n.methane,n.co,n.temp,n.humidity,n.particle,n.battery];

 $("#sensor-grid").innerHTML=sensorMeta.map((m,i)=>`
  <article class="sensor-card"
   data-sensor-index="${i}"
   role="button"
   tabindex="0"
   title="Click to view sensor details">

   <div class="card-head">
    <h3>${m[0]}</h3>
    <span class="status-badge ${i===1||(i===2&&n.flow<1.5)?"warn":"good"}">
     ${i===1||(i===2&&n.flow<1.5)?"Check":"Available"}
    </span>
   </div>

   <div class="sensor-value">
    ${values[i]} <small>${m[2]}</small>
   </div>

   <p>${m[3]}</p>

   <div class="sensor-foot">
    <span>${simulation?"Simulation":"ESP32 data"}</span>
    <span>Node ${selectedNode}</span>
   </div>

   <div class="sensor-open-hint">VIEW DETAILS ↗</div>
  </article>
 `).join("");
}


function renderAlerts(){
 $("#alert-count").textContent=alerts.length;
 $("#alerts-list").innerHTML=alerts.length?alerts.map(a=>`<article class="event"><div><b>${a.title} · ${a.node}</b><p>${a.detail}</p><small class="muted">${a.time}</small></div><span class="status-badge ${a.level==="Moderate"?"warn":"good"}">${a.level}</span></article>`).join(""):`<article class="panel">No active demo alerts.</article>`;
}
function renderReportStats(){
 const n=current(); $("#report-stats").innerHTML=`<div class="stat-box"><small>Current water level</small><b>${n.level} cm</b></div><div class="stat-box"><small>Current flow</small><b>${n.flow.toFixed(1)} L/s</b></div><div class="stat-box"><small>Node battery</small><b>${n.battery}%</b></div>`;
}
function chartData(){const n=current();return [n.level-7,n.level-6,n.level-8,n.level-5,n.level-6,n.level-2,n.level]}
function chartConfig(){return {type:"line",data:{labels:["-60m","-50m","-40m","-30m","-20m","-10m","Now"],datasets:[{label:"Water level (cm)",data:chartData(),borderColor:"#6559e8",backgroundColor:"#6559e822",fill:true,tension:.35,pointRadius:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:"rgba(130,140,160,.14)"}},x:{grid:{display:false}}}}}}
function updateCharts(){
 if(!window.Chart)return;
 if(!homeChart){homeChart=new Chart($("#home-chart"),chartConfig())}else{homeChart.data.datasets[0].data=chartData();homeChart.update()}
 if(!reportChart){reportChart=new Chart($("#report-chart"),chartConfig())}else{reportChart.data.datasets[0].data=chartData();reportChart.update()}
}

$("#sensor-grid").addEventListener("click", e => {
 const card = e.target.closest("[data-sensor-index]");
if (!card) return;

const i = Number(card.dataset.sensorIndex);
 const n = current();
 const m = sensorMeta[i];
 const values = [
  n.level, n.pipe, n.flow, n.turbidity,
  n.methane, n.co, n.temp, n.battery
 ];

 const old = $("#sensor-detail");
 if (old) old.remove();

 const popup = document.createElement("div");
 popup.id = "sensor-detail";
 popup.className = "sensor-detail-overlay";

 popup.innerHTML = `
  <div class="sensor-detail-box">
   <button class="detail-close" aria-label="Close">×</button>
   <small>SEWERWATCH / SENSOR DETAILS</small>
   <h2>${m[0]}</h2>
   <div class="detail-reading">${values[i]} <span>${m[2]}</span></div>
   <p>${m[3]}</p>
   <hr>
   <p><b>Node:</b> ${selectedNode}</p>
   <p><b>Data source:</b> ${simulation ? "Simulation" : "ESP32 data"}</p>
   <p><b>Sensor field:</b> ${m[1]}</p>
   <p class="detail-note">Prototype reading. Calibration may be required.</p>
  </div>
 `;

 document.body.appendChild(popup);

 popup.addEventListener("click", e => {
  if (e.target === popup || e.target.closest(".detail-close")) {
   popup.remove();
  }
 });
});

function showPage(page){
 $$(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));
 $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 const titles={home:["Home","Live visibility into sewer-line conditions"],sensors:["Sensors","Current readings and sensor health"],alerts:["Alerts","Warnings, events and status changes"],report:["Report","Historical trends and downloadable data"],inspection:["Inspection","Maintenance schedule and physical checks"]};
 $("#page-title").textContent=titles[page][0];$("#page-subtitle").textContent=titles[page][1];
 if(page==="report")setTimeout(updateCharts,50);
}
$("#nav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)showPage(b.dataset.page)});
document.addEventListener("click",e=>{const b=e.target.closest("[data-go]");if(b)showPage(b.dataset.go)});
$$(".node-chip").forEach(b=>b.addEventListener("click",()=>{selectedNode=b.dataset.node;render()}));
$("#theme-toggle").addEventListener("click",()=>{const dark=document.documentElement.dataset.theme!=="dark";document.documentElement.dataset.theme=dark?"dark":"light";localStorage.setItem("sw-theme",dark?"dark":"light");$("#theme-toggle").textContent=dark?"☀ Light mode":"☾ Dark mode";});
const savedTheme=localStorage.getItem("sw-theme")||"light";document.documentElement.dataset.theme=savedTheme;$("#theme-toggle").textContent=savedTheme==="dark"?"☀ Light mode":"☾ Dark mode";
$("#simulation-toggle").addEventListener("change",e=>{simulation=e.target.checked;$("#mode-note").textContent=simulation?"Sample data. Real readings replace it once the ESP32 is connected.":"Live mode selected. Waiting for an ESP32 reading; demo values remain visible until received.";$("#connection-label").textContent=simulation?"Demo simulation":"Waiting for hardware";render()});
$("#refresh-btn").addEventListener("click",()=>{if(simulation){Object.values(nodes).forEach(n=>{n.level=Math.max(25,Math.min(92,n.level+(Math.random()*4-1.5)));});render()}else{fetchLatest()}});
async function fetchLatest(){try{const r=await fetch(`https://sewer-watch.onrender.com/api/latest?node_id=${encodeURIComponent(selectedNode)}`, {cache:"no-store"});const d=await r.json();if(d){nodes[selectedNode]={...current(),level:d.water_level_cm??current().level,pipe:d.pipe_distance_m??current().pipe,flow:d.flow_lps??current().flow,turbidity:d.turbidity_raw??current().turbidity,methane:d.methane_raw??current().methane,co:d.co_raw??current().co,temp:d.temperature_c??current().temp,humidity:d.humidity_pct??current().humidity,particle:d.particle_distance_cm??current().particle,battery:d.battery_pct??current().battery};render()}}catch(err){$("#connection-label").textContent="Backend unavailable"}}
$("#clear-alerts").addEventListener("click",()=>{alerts=[];renderAlerts()});
$("#download-report").addEventListener("click",()=>{const n=current(), rows=[["Node","Metric","Value","Unit"],[selectedNode,"Water level",n.level,"cm"],[selectedNode,"Pipe distance",n.pipe,"m"],[selectedNode,"Flow",n.flow,"L/s"],[selectedNode,"Turbidity",n.turbidity,"raw ADC"],[selectedNode,"Methane",n.methane,"raw ADC"],[selectedNode,"CO",n.co,"raw ADC"],[selectedNode,"Temperature",n.temp,"C"],[selectedNode,"Battery",n.battery,"%"]];const csv=rows.map(r=>r.join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`sewerwatch-${selectedNode}-report.csv`;a.click();URL.revokeObjectURL(a.href)});
const checklist=["Check manhole cover and surrounding area","Inspect visible pipe inlet and outlet","Check sensor mounting and cable condition","Compare sensor reading with a manual observation","Record any smell, leakage or visible blockage"];
$("#inspection-checklist").innerHTML=checklist.map((x,i)=>`<label class="inspection-item"><input type="checkbox"><span>${x}</span></label>`).join("");
let inspectionCount=0;function addInspection(){inspectionCount++;const item=document.createElement("article");item.className="event";item.innerHTML=`<div><b>Inspection record #${inspectionCount}</b><p>${selectedNode} · Checklist started · ${new Date().toLocaleString()}</p></div><span class="status-badge good">Recorded</span>`;$("#inspection-history").prepend(item)}
$("#add-inspection").addEventListener("click",addInspection);
render();showPage("home");setInterval(()=>{if(!simulation)fetchLatest()},5000);


// SEWERWATCH LIVE HARDWARE MODE: use real backend telemetry by default.
simulation = false;
$("#simulation-toggle").checked = false;
$("#mode-note").textContent = "Live mode. Waiting for ESP32 telemetry.";
$("#connection-label").textContent = "Waiting for ESP32";
const originalFetchLatest = fetchLatest;
fetchLatest = async function () {
  try {
    const response = await fetch('https://sewer-watch.onrender.com/api/latest?node_id=' + encodeURIComponent(selectedNode), {cache:'no-store'});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const d = await response.json();
    if (!d) {
      $("#connection-label").textContent = "Waiting for first ESP32 reading";
      $("#online-text").textContent = selectedNode + " · no readings yet";
      return;
    }
    nodes[selectedNode] = {
      ...current(),
      level:d.water_level_cm,
      pipe:d.pipe_distance_m,
      flow:d.flow_lps,
      turbidity:d.turbidity_raw,
      methane:d.methane_raw,
      co:d.co_raw,
      temp:d.temperature_c,
      humidity:d.humidity_pct,
      particle:d.particle_distance_cm,
      battery:d.battery_pct
    };
    $("#connection-label").textContent = "ESP32 connected · last reading " + new Date(d.timestamp).toLocaleTimeString();
    $("#online-text").textContent = selectedNode + " · live hardware";
    render();
  } catch (err) {
    $("#connection-label").textContent = "Backend unavailable";
  }
};
fetchLatest();
