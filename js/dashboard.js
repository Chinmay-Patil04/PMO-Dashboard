/* ISP PM Dashboard — interactive Power BI-style portfolio view */

let DATA = null;
let charts = {};
let filters = { client: 'All', region: 'All', rag: 'All' };

const COLORS = {
  accent: '#0078d4',
  green: '#107c10',
  amber: '#ca5010',
  red: '#d13438',
  palette: ['#0078d4','#107c10','#ca5010','#8764b8','#00b7c3','#d13438','#498205','#ff8c00']
};

const fmt = (n, dec = 0) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: dec });
const fmtCr = n => `₹${fmt(n, 2)} Cr`;

async function init() {
  try {
    const res = await fetch('data/dashboard-data.json');
    DATA = await res.json();
    populateSlicers();
    bindNav();
    bindFilters();
    renderPage('overview');
    document.getElementById('as-of').textContent = `As of ${DATA.meta.asOfDate}`;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
  } catch (e) {
    document.getElementById('loading').textContent = 'Failed to load data. Serve via local HTTP server.';
    console.error(e);
  }
}

function populateSlicers() {
  const clients = ['All', ...new Set(DATA.projects.map(p => p.ClientName))];
  const regions = ['All', ...new Set(DATA.projects.map(p => p.Region))];
  fillSelect('filter-client', clients);
  fillSelect('filter-region', regions);
}

function fillSelect(id, opts) {
  const el = document.getElementById(id);
  el.innerHTML = opts.map(o => `<option value="${o}">${o}</option>`).join('');
}

function bindNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPage(btn.dataset.page);
      document.getElementById('page-title').textContent = btn.dataset.title;
    });
  });
}

function bindFilters() {
  ['filter-client', 'filter-region', 'filter-rag'].forEach(id => {
    document.getElementById(id).addEventListener('change', e => {
      const key = id.replace('filter-', '');
      filters[key] = e.target.value;
      const active = document.querySelector('.nav-item.active');
      renderPage(active.dataset.page);
    });
  });
}

function filteredProjects() {
  return DATA.projects.filter(p => {
    if (filters.client !== 'All' && p.ClientName !== filters.client) return false;
    if (filters.region !== 'All' && p.Region !== filters.region) return false;
    if (filters.rag !== 'All' && p.RAGStatus !== filters.rag) return false;
    return true;
  });
}

function destroyCharts() {
  Object.values(charts).forEach(c => c.destroy());
  charts = {};
}

function renderPage(page) {
  destroyCharts();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  const fn = { overview: renderOverview, sites: renderSites, tasks: renderTasks, raid: renderRaid, resources: renderResources };
  fn[page]();
}

/* ── Page 1: Executive Overview ── */
function renderOverview() {
  const projs = filteredProjects();
  const k = computeKPIs(projs);

  document.getElementById('overview-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Active Projects</div><div class="kpi-value">${k.count}</div><div class="kpi-sub">Portfolio programs</div></div>
    <div class="kpi-card green"><div class="kpi-label">Avg Completion</div><div class="kpi-value">${k.avgPct}%</div><div class="kpi-sub">Weighted progress</div></div>
    <div class="kpi-card"><div class="kpi-label">Budget</div><div class="kpi-value">${fmtCr(k.budget)}</div><div class="kpi-sub">Planned portfolio</div></div>
    <div class="kpi-card ${k.variance > 0 ? 'red' : 'green'}"><div class="kpi-label">Spend Variance</div><div class="kpi-value">${k.variance > 0 ? '+' : ''}${k.variance}%</div><div class="kpi-sub">${fmtCr(k.actual)} actual</div></div>
    <div class="kpi-card amber"><div class="kpi-label">Open Issues</div><div class="kpi-value">${k.issues}</div><div class="kpi-sub">${k.risks} open risks</div></div>
    <div class="kpi-card"><div class="kpi-label">Sites Live</div><div class="kpi-value">${fmt(k.sitesLive)}</div><div class="kpi-sub">of ${fmt(k.totalSites)} total</div></div>
  `;

  renderProjectTable('overview-projects', projs);

  const ragCounts = countField(projs, 'RAGStatus');
  makeDoughnut('chart-rag', Object.keys(ragCounts), Object.values(ragCounts), ['#107c10','#ca5010','#d13438']);

  const typeCounts = countField(projs, 'ProjectType');
  makeBar('chart-type', Object.keys(typeCounts), Object.values(typeCounts), true);

  makeLine('chart-weekly', DATA.weeklyTrend.map(w => w.week.slice(5)),
    [{ label: 'Avg % Complete', data: DATA.weeklyTrend.map(w => w.avgPct), borderColor: COLORS.accent, tension: .3, fill: false }]);

  const clientSpend = {};
  projs.forEach(p => { clientSpend[p.ClientName] = (clientSpend[p.ClientName] || 0) + p.ActualSpend_Cr; });
  const sorted = Object.entries(clientSpend).sort((a,b) => b[1]-a[1]).slice(0,8);
  makeBarH('chart-client-spend', sorted.map(s=>s[0].split(' ')[0]), sorted.map(s=>s[1]));
}

/* ── Page 2: Sites & Milestones ── */
function renderSites() {
  const projs = filteredProjects();
  const pids = new Set(projs.map(p => p.ProjectID));
  const sites = DATA.siteSample.filter(s => pids.has(s.ProjectID));

  const live = sites.filter(s => s.SiteStatus === 'Live').length;
  const breached = sites.filter(s => s.SLAStatus === 'Breached').length;

  document.getElementById('sites-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Sites (filtered sample)</div><div class="kpi-value">${fmt(sites.length)}</div></div>
    <div class="kpi-card green"><div class="kpi-label">Live Sites</div><div class="kpi-value">${fmt(live)}</div></div>
    <div class="kpi-card red"><div class="kpi-label">SLA Breached</div><div class="kpi-value">${fmt(breached)}</div><div class="kpi-sub">${sites.length ? (breached/sites.length*100).toFixed(1) : 0}% of sample</div></div>
    <div class="kpi-card amber"><div class="kpi-label">Avg Delay</div><div class="kpi-value">${sites.length ? (sites.reduce((a,s)=>a+s.DelayDays,0)/sites.length).toFixed(1) : 0}d</div></div>
  `;

  const byStatus = countField(sites, 'SiteStatus');
  makeBar('chart-site-status', Object.keys(byStatus), Object.values(byStatus), true);

  const byRegion = countField(sites, 'Region');
  makeDoughnut('chart-site-region', Object.keys(byRegion), Object.values(byRegion));

  const bySLA = countField(sites, 'SLAStatus');
  makeDoughnut('chart-site-sla', Object.keys(bySLA), Object.values(bySLA), ['#107c10','#ca5010','#d13438']);

  const rows = sites.slice(0, 50).map(s => `
    <tr>
      <td>${s.SiteID}</td><td>${s.SiteName}</td><td>${s.ClientName.split(' ')[0]}</td>
      <td>${s.City}</td><td>${s.Region}</td><td>${s.Bandwidth_Mbps} Mbps</td>
      <td><span class="status-pill ${s.SiteStatus.replace(/ /g,'')}">${s.SiteStatus}</span></td>
      <td>${s.DelayDays}d</td>
      <td><span class="status-pill ${s.SLAStatus}">${s.SLAStatus}</span></td>
      <td>${s.Engineer}</td>
    </tr>`).join('');
  document.getElementById('sites-table').innerHTML = rows;
}

/* ── Page 3: Tasks / WBS ── */
function renderTasks() {
  const projs = filteredProjects();
  const pids = new Set(projs.map(p => p.ProjectID));

  const phaseData = DATA.tasksByPhase;
  makeBar('chart-task-phase', Object.keys(phaseData), Object.values(phaseData), true);

  const statusData = DATA.tasksByStatus;
  makeDoughnut('chart-task-status', Object.keys(statusData), Object.values(statusData));

  const delayed = Object.entries(phaseData);
  const phaseCompletion = TASK_PHASES.map(ph => {
    const tasks = DATA.projects.length ? Math.round(projs.reduce((a,p) => a + p.PctComplete, 0) / Math.max(projs.length,1) + (TASK_PHASES.indexOf(ph)-4)*8) : 0;
    return Math.min(100, Math.max(5, tasks));
  });
  makeBar('chart-phase-pct', TASK_PHASES, phaseCompletion, false, '%');

  const rows = projs.map(p => {
    const phases = TASK_PHASES.map(ph => {
      const pct = Math.min(100, Math.max(0, p.PctComplete + (TASK_PHASES.indexOf(ph)-4)*randomish(p.ProjectID, ph)));
      return `<td><div style="font-size:11px">${pct}%</div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div></td>`;
    }).join('');
    return `<tr>
      <td>${p.ProjectID}</td><td>${p.ProjectName}</td><td>${p.PMOwner}</td>
      <td><span class="rag ${p.RAGStatus}">${p.RAGStatus}</span></td>
      <td>${p.PctComplete}%</td>${phases}
    </tr>`;
  }).join('');
  document.getElementById('wbs-table').innerHTML = rows;
}

const TASK_PHASES = ['Initiation','Survey','ROW/Permits','Procurement','Installation','Testing','Go-Live','Hypercare'];
function randomish(pid, ph) { let h=0; for(const c of pid+ph) h+=c.charCodeAt(0); return (h%20)-10; }

/* ── Page 4: RAID & SLA ── */
function renderRaid() {
  document.getElementById('raid-kpis').innerHTML = `
    <div class="kpi-card red"><div class="kpi-label">Open Issues</div><div class="kpi-value">${DATA.kpis.openIssues}</div></div>
    <div class="kpi-card amber"><div class="kpi-label">Open Risks</div><div class="kpi-value">${DATA.kpis.openRisks}</div></div>
    <div class="kpi-card"><div class="kpi-label">SLA Met</div><div class="kpi-value">${DATA.slaByStatus.Met || 0}</div></div>
    <div class="kpi-card amber"><div class="kpi-label">SLA Marginal</div><div class="kpi-value">${DATA.slaByStatus.Marginal || 0}</div></div>
  `;

  makeDoughnut('chart-raid-type', Object.keys(DATA.raidByType), Object.values(DATA.raidByType));
  makeBar('chart-raid-severity', Object.keys(DATA.raidBySeverity), Object.values(DATA.raidBySeverity), true);

  const slaLabels = DATA.slaMetrics.slice(0,12).map(s => s.Metric);
  const slaTarget = DATA.slaMetrics.slice(0,12).map(s => s.Target_Pct);
  const slaAchieved = DATA.slaMetrics.slice(0,12).map(s => s.Achieved_Pct);
  makeGroupedBar('chart-sla', slaLabels, slaTarget, slaAchieved);

  const rows = DATA.raidOpen.map(r => `
    <tr>
      <td>${r.RAIDID}</td><td><span class="status-pill">${r.Type}</span></td>
      <td>${r.Title}</td><td>${r.ProjectID}</td>
      <td><span class="status-pill ${r.Severity}">${r.Severity}</span></td>
      <td>${r.Owner}</td><td><span class="status-pill ${r.Status}">${r.Status}</span></td>
      <td>${r.Impact}</td><td>${r.DueDate}</td>
    </tr>`).join('');
  document.getElementById('raid-table').innerHTML = rows;
}

/* ── Page 5: Resources & Cost ── */
function renderResources() {
  document.getElementById('res-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Avg Utilization</div><div class="kpi-value">${DATA.kpis.avgUtilization}%</div></div>
    <div class="kpi-card"><div class="kpi-label">Team Size</div><div class="kpi-value">${Object.values(DATA.resourcesByRole).reduce((a,b)=>a+b,0)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Budget (Portfolio)</div><div class="kpi-value">${fmtCr(DATA.kpis.budgetCr)}</div></div>
    <div class="kpi-card green"><div class="kpi-label">Under Budget</div><div class="kpi-value">${Math.abs(DATA.kpis.budgetVariancePct)}%</div><div class="kpi-sub">Spend vs plan</div></div>
  `;

  makeDoughnut('chart-res-role', Object.keys(DATA.resourcesByRole), Object.values(DATA.resourcesByRole));

  const util = DATA.resourceUtilization;
  makeBarH('chart-util', util.map(r => r.name.split(' ')[0]), util.map(r => r.util));

  const months = DATA.budgetMonthly.map(m => m.month);
  makeLine('chart-budget', months, [
    { label: 'Planned (Cr)', data: DATA.budgetMonthly.map(m => m.planned), borderColor: COLORS.accent, tension: .3 },
    { label: 'Actual (Cr)', data: DATA.budgetMonthly.map(m => m.actual), borderColor: COLORS.amber, tension: .3 }
  ]);

  const cats = Object.entries(DATA.budgetByCategory).sort((a,b)=>b[1]-a[1]);
  makeBarH('chart-cost-cat', cats.map(c=>c[0]), cats.map(c=>Math.round(c[1]/1e7)));
}

/* ── Helpers ── */
function computeKPIs(projs) {
  if (!projs.length) return { count:0, avgPct:0, budget:0, actual:0, variance:0, issues:0, risks:0, sitesLive:0, totalSites:0 };
  const budget = projs.reduce((a,p)=>a+p.Budget_Cr,0);
  const actual = projs.reduce((a,p)=>a+p.ActualSpend_Cr,0);
  return {
    count: projs.length,
    avgPct: (projs.reduce((a,p)=>a+p.PctComplete,0)/projs.length).toFixed(1),
    budget, actual,
    variance: ((actual-budget)/budget*100).toFixed(1),
    issues: projs.reduce((a,p)=>a+p.OpenIssues,0),
    risks: projs.reduce((a,p)=>a+p.OpenRisks,0),
    sitesLive: projs.reduce((a,p)=>a+p.SitesLive,0),
    totalSites: projs.reduce((a,p)=>a+p.TotalSites,0),
  };
}

function countField(arr, key) {
  const c = {};
  arr.forEach(x => { c[x[key]] = (c[x[key]]||0)+1; });
  return c;
}

function renderProjectTable(id, projs) {
  document.getElementById(id).innerHTML = projs.map(p => `
    <tr>
      <td>${p.ProjectID}</td><td>${p.ProjectName}</td><td>${p.ClientName.split(' ')[0]}</td>
      <td>${p.ProjectType}</td><td>${p.Region}</td><td>${p.PMOwner}</td>
      <td><span class="rag ${p.RAGStatus}">${p.RAGStatus}</span></td>
      <td>${p.PctComplete}%<div class="progress-bar"><div class="progress-fill" style="width:${p.PctComplete}%"></div></div></td>
      <td>${fmtCr(p.Budget_Cr)}</td><td>${fmtCr(p.ActualSpend_Cr)}</td>
      <td>${p.SitesLive}/${p.TotalSites}</td>
    </tr>`).join('');
}

function chartDefaults() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { font: { size: 11 }, boxWidth: 12 } } },
    scales: {}
  };
}

function makeDoughnut(id, labels, data, colors) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  charts[id] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors || COLORS.palette }] },
    options: { ...chartDefaults(), cutout: '55%' }
  });
}

function makeBar(id, labels, data, horizontal, suffix) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  const opts = chartDefaults();
  if (!horizontal) { opts.scales = { y: { beginAtZero: true, max: suffix ? 100 : undefined } }; }
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: COLORS.accent, borderRadius: 4 }] },
    options: { ...opts, indexAxis: horizontal ? 'y' : 'x' }
  });
}

function makeBarH(id, labels, data) { makeBar(id, labels, data, true); }

function makeLine(id, labels, datasets) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  charts[id] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: { ...chartDefaults(), scales: { y: { beginAtZero: false } } }
  });
}

function makeGroupedBar(id, labels, target, achieved) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Target %', data: target, backgroundColor: '#c8c6c4', borderRadius: 4 },
        { label: 'Achieved %', data: achieved, backgroundColor: COLORS.accent, borderRadius: 4 }
      ]
    },
    options: { ...chartDefaults(), scales: { y: { beginAtZero: false, min: 85, max: 100 } } }
  });
}

document.addEventListener('DOMContentLoaded', init);
