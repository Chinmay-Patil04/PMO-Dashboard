# Power BI Desktop — Complete Build Guide
## ISP Project Management Professional Dashboard
### Tata Nelco Limited — Pan-India Network Delivery

---

## PART 1: DATA MODEL SETUP

### Step 1 — Import All Sheets

1. Open Power BI Desktop → **Get Data → Excel**
2. Select `ISP_PM_RawData_PowerBI.xlsx`
3. Check ALL 10 tables:
   - ✅ Projects
   - ✅ Sites_Milestones
   - ✅ Tasks_WBS
   - ✅ RAID_Log
   - ✅ Resources
   - ✅ Budget_Costs
   - ✅ SLA_Governance
   - ✅ Client_Master
   - ✅ Weekly_Status_Log
   - ✅ Date_Dimension
4. Click **Transform Data** (DO NOT click Load yet)

### Step 2 — Power Query Transformations

For **Projects** table:
- Change `StartDate`, `PlannedEndDate`, `ActualEndDate` → Date type
- Change `BudgetINR`, `ActualCostINR`, `ContractValueINR` → Whole Number
- Change `PercentComplete` → Decimal Number

For **Sites_Milestones** table:
- Change `PlannedInstallDate`, `ActualInstallDate` → Date type
- Change `DelayDays`, `InstallationCostINR`, `MonthlyRecurringChargeINR` → Whole Number
- Replace empty string in `DelayDays` → null

For **Budget_Costs** table:
- Split `Month` column (format YYYY-MM) → add `BudgetYear` and `BudgetMonth` columns
- Change `PlannedCostINR`, `ActualCostINR` → Whole Number

For **Date_Dimension** table:
- Change `Date` → Date type
- Mark as **Date Table** (Table Tools → Mark as Date Table → Date column)

Click **Close & Apply**.

---

### Step 3 — Build Relationships (Model View)

Go to **Model View** (left sidebar icon). Create these relationships:

| From Table | From Column | To Table | To Column | Cardinality | Direction |
|---|---|---|---|---|---|
| Projects | ProjectID | Sites_Milestones | ProjectID | 1:Many | Single |
| Projects | ProjectID | Tasks_WBS | ProjectID | 1:Many | Single |
| Projects | ProjectID | RAID_Log | ProjectID | 1:Many | Single |
| Projects | ProjectID | Resources | ProjectID | 1:Many | Single |
| Projects | ProjectID | Budget_Costs | ProjectID | 1:Many | Single |
| Projects | ProjectID | SLA_Governance | ProjectID | 1:Many | Single |
| Projects | ProjectID | Weekly_Status_Log | ProjectID | 1:Many | Single |
| Client_Master | ClientID | Projects | ClientID | 1:Many | Single |
| Client_Master | ClientID | Sites_Milestones | ClientID | 1:Many | Single |
| Date_Dimension | Date | Projects | StartDate | 1:Many | Single |

**Result:** Star schema with Projects at center.

---

## PART 2: ALL DAX MEASURES

Create a dedicated **`_Measures`** table: Home → Enter Data → name it `_Measures`, load it (leave it empty).

### 2.1 — Core KPI Measures

```dax
Total Projects = COUNTROWS(Projects)

Active Projects = CALCULATE(COUNTROWS(Projects), Projects[Status] = "In Progress")

Completed Projects = CALCULATE(COUNTROWS(Projects), Projects[Status] = "Completed")

At Risk Projects = 
CALCULATE(
    COUNTROWS(Projects),
    Projects[HealthRAG] IN {"Red", "Yellow"}
)

Total Sites = COUNTROWS(Sites_Milestones)

Live Sites = 
CALCULATE(
    COUNTROWS(Sites_Milestones),
    Sites_Milestones[SiteStatus] = "Live - Operational"
)

Rollout % = 
DIVIDE([Live Sites], [Total Sites], 0)

Delayed Sites = 
CALCULATE(
    COUNTROWS(Sites_Milestones),
    Sites_Milestones[SiteStatus] = "Delayed - Vendor Issue"
)

SLA Breached Sites = 
CALCULATE(
    COUNTROWS(Sites_Milestones),
    Sites_Milestones[SLAStatus] = "Breached"
)

SLA Compliance % = 
DIVIDE(
    CALCULATE(COUNTROWS(Sites_Milestones), Sites_Milestones[SLAStatus] IN {"Met","On Track"}),
    [Total Sites],
    0
)
```

### 2.2 — Budget & Cost Measures

```dax
Total Budget = SUMX(Projects, Projects[BudgetINR])

Total Actual Cost = SUMX(Projects, Projects[ActualCostINR])

Budget Variance = [Total Actual Cost] - [Total Budget]

Budget Variance % = DIVIDE([Budget Variance], [Total Budget], 0)

Contract Value = SUMX(Projects, Projects[ContractValueINR])

Monthly Planned Spend = SUM(Budget_Costs[PlannedCostINR])

Monthly Actual Spend = SUM(Budget_Costs[ActualCostINR])

Monthly Variance = [Monthly Actual Spend] - [Monthly Planned Spend]

Cost at Completion (EAC) = 
DIVIDE([Total Actual Cost], DIVIDE([Avg % Complete]/100, 1), 0)
```

### 2.3 — Schedule & Progress Measures

```dax
Avg % Complete = AVERAGE(Projects[PercentComplete])

Avg Site Delay Days = 
AVERAGEX(
    FILTER(Sites_Milestones, Sites_Milestones[DelayDays] > 0),
    Sites_Milestones[DelayDays]
)

Tasks Completed = 
CALCULATE(COUNTROWS(Tasks_WBS), Tasks_WBS[TaskStatus] = "Completed")

Tasks Delayed = 
CALCULATE(COUNTROWS(Tasks_WBS), Tasks_WBS[TaskStatus] = "Delayed")

WBS Completion % = 
DIVIDE([Tasks Completed], COUNTROWS(Tasks_WBS), 0)
```

### 2.4 — RAID Measures

```dax
Open Risks = 
CALCULATE(
    COUNTROWS(RAID_Log),
    RAID_Log[Type] = "Risk",
    RAID_Log[Status] <> "Closed"
)

Open Issues = 
CALCULATE(
    COUNTROWS(RAID_Log),
    RAID_Log[Type] = "Issue",
    RAID_Log[Status] <> "Closed"
)

Critical Open Items = 
CALCULATE(
    COUNTROWS(RAID_Log),
    RAID_Log[Severity] = "Critical",
    RAID_Log[Status] <> "Closed"
)

Total Schedule Impact Days = SUM(RAID_Log[ImpactOnSchedule_Days])

Total Cost Impact = SUM(RAID_Log[ImpactOnCost_INR])

Penalty Exposure = SUM(SLA_Governance[PenaltyApplicableINR])
```

### 2.5 — Resource Measures

```dax
Active Resources = 
CALCULATE(COUNTROWS(Resources), Resources[Status] = "Active")

Avg Allocation % = AVERAGE(Resources[AllocationPercent])

PMP Certified Count = 
CALCULATE(
    COUNTROWS(Resources),
    SEARCH("PMP", Resources[Certification], 1, 0) > 0
)
```

### 2.6 — Conditional Color Measures (for KPI formatting)

```dax
Health Color = 
SWITCH(
    MAX(Projects[HealthRAG]),
    "Green", "#2ECC71",
    "Yellow", "#F5A623",
    "Red", "#E63946",
    "#64748B"
)

SLA Color = 
IF([SLA Compliance %] >= 0.95, "#2ECC71",
IF([SLA Compliance %] >= 0.85, "#F5A623", "#E63946"))

Budget Status = 
IF(
    [Budget Variance %] < -0.1, "Under Budget ⬇",
    IF([Budget Variance %] > 0.1, "Over Budget ⬆", "On Budget ✓")
)
```

---

## PART 3: PAGE-BY-PAGE BUILD INSTRUCTIONS

### REPORT THEME

Before building pages, apply a custom dark theme:
1. View → Themes → Customize current theme
2. Set colors: Background `#0F2744`, Card `#112A4A`, Font `Inter`
3. OR download and import the theme JSON from:
   `https://raw.githubusercontent.com/microsoft/PowerBI-ThemeGallery`

---

### PAGE 1: Executive Overview

**Canvas:** 1280 × 720px | Background: `#0A1628`

**Top KPI Bar (5 cards in a row):**
| Card | Measure | Conditional Format |
|---|---|---|
| Total Projects | `[Total Projects]` | Blue accent |
| Active Projects | `[Active Projects]` | Teal accent |
| At Risk | `[At Risk Projects]` | Amber if >5 |
| Contract Value | `[Contract Value]` | Green |
| Budget Variance % | `[Budget Variance %]` | Red if positive |

**Row 2 KPIs (5 cards):**
Total Sites | Live Sites | Rollout % | SLA Breached | Open Risks

**Visuals (bottom half):**

| Visual | Type | X-axis | Y-axis/Value | Legend |
|---|---|---|---|---|
| Project Status | Donut Chart | — | Count of ProjectID | Status |
| Sites by Technology | Donut Chart | — | Count of SiteID | Technology |
| Region Rollout | Bar Chart (clustered) | Region | Live Sites, Total Sites | — |
| Budget vs Actual Trend | Line Chart | Date (Month) | Planned, Actual | — |
| Portfolio RAG | Bar Chart | HealthRAG | Count of Projects | HealthRAG (conditional color) |

**Slicers:** Client (dropdown), Technology (list), Region (list), Date Range

**Project Table:**
- Visual: Table
- Columns: ProjectID, ProjectName, Client, PM, Status, HealthRAG, PercentComplete (bar), Sites, Budget, Actual, Priority
- Conditional formatting on HealthRAG column background

---

### PAGE 2: Site Tracker

**Top 5 KPIs:** Live Sites | In-Progress | Delayed | On Hold | Avg Delay Days

**Visuals:**

| Visual | Type | Config |
|---|---|---|
| Site Status Breakdown | Donut | SiteStatus → Count |
| Milestone Funnel | Funnel Chart | CurrentMilestone → Count |
| SLA Compliance Pie | Pie | SLAStatus → Count |
| Region Live vs Total | Stacked Bar | Region → Live Sites (green) + Remaining (grey) |
| Top States | Bar (horizontal) | State → Count of Sites |
| India Map | Filled Map | State field → Count of Sites (bubble size) |

**Slicers:** SiteStatus, Technology, Region, Client

**Detail Table:** SiteID, City, State, Technology, Status, Milestone, SLA, Delay Days, Bandwidth, Cost

---

### PAGE 3: Tasks / WBS

**4 KPI Cards:** Completed | In Progress | Delayed | Not Started

**Visuals:**

| Visual | Type | Config |
|---|---|---|
| Task Status | Donut | TaskStatus → Count |
| WBS Phase Progress | Horizontal Bar | WBSPhase → Avg PercentComplete |
| Gantt Chart | Gantt (Custom Visual from AppSource: "Gantt" by Microsoft) | Task → PlannedStartDate, PlannedFinishDate, PercentComplete |
| Task Owner Workload | Bar | Owner → Task Count |

**Gantt Chart Setup:**
1. Get "Gantt" visual from Power BI AppSource
2. Task = TaskName, Start Date = PlannedStartDate, Duration = DurationDays
3. % Complete = PercentComplete, Legend = TaskStatus
4. Color by Status: Completed=Green, In Progress=Teal, Delayed=Red

**Task Table:** All columns with status badge conditional formatting

---

### PAGE 4: RAID & SLA

**5 KPIs:** Open Risks | Open Issues | Closed Items | SLA Breached | Penalty Exposure

**Visuals:**

| Visual | Type | Config |
|---|---|---|
| RAID by Type | Donut | Type → Count (Red/Amber/Blue/Green) |
| Risk Category | Horizontal Bar | Category → Count |
| RAID Status | Donut | Status → Count |
| SLA Metric Performance | Column Chart | SLAMetric → Avg AchievedPercent (ref line at 95%) |
| SLA Compliance by Client | Bar | ClientID → Compliance % |
| Penalty by Client | Bar | ClientID → Sum PenaltyApplicableINR |

**Reference Lines:**
- On SLA chart: Add constant line at 95% (dotted, red)
- Label as "SLA Target"

**RAID Table:** RAIDID, Type, Category, Severity, Status, Owner, Raised Date, Schedule Impact, Cost Impact
- Conditional format: Severity column (Critical=Red bg, High=Amber, Medium=Yellow, Low=Grey)

---

### PAGE 5: Resources & Cost

**4 KPIs:** Total Resources | Active | Avg Allocation % | Total Budget

**Visuals:**

| Visual | Type | Config |
|---|---|---|
| Team by Role | Horizontal Bar | Role → Count |
| Certifications | Donut | Certification → Count |
| Cost by Category | Donut | CostCategory → Sum ActualCostINR |
| Budget vs Actual (by Project) | Clustered Bar | ProjectID → Planned vs Actual |
| Monthly Spend Trend | Area Chart | Month → Planned + Actual (dual line) |
| Allocation Heatmap | Matrix | Role (rows) → Region (cols) → Count |

**Resource Table:** ResourceID, Name, Role, Project, Region, Allocation % (bar), Bill Rate, Certification, Status

---

## PART 4: INTERACTIONS & DRILL-THROUGH

### Setting Up Cross-Filtering
1. Format → Edit Interactions
2. On Project Status donut → set all other visuals to **Filter** (not Highlight)
3. On Client slicer → set to filter ALL pages

### Drill-Through Setup
1. On Sites page → right-click on Region bar → **Drill through**
2. Create a "Region Detail" page showing only that region's sites
3. On RAID page → drill through from Project to show that project's full RAID log

### Tooltips
- Enable **Report Page Tooltip** on the Project table
- Create a tooltip page (small canvas) showing quick project stats
- Assign to ProjectID column in main table

---

## PART 5: PUBLISHING & GITHUB

### Export for GitHub

1. **Screenshot export:** File → Export → Export to PDF (for README preview)
2. **Publish to Power BI Service:**
   - Home → Publish → choose your workspace
   - Copy the published URL for your README

### GitHub Repository Structure
```
isp-pm-dashboard/
├── README.md
├── data/
│   └── ISP_PM_RawData_PowerBI.xlsx
├── dashboard/
│   └── ISP_PM_Dashboard.html          ← Interactive web version (GitHub Pages)
│   └── ISP_PM_Dashboard.pbix          ← Power BI Desktop file (build yourself)
├── screenshots/
│   ├── 01_overview.png
│   ├── 02_site_tracker.png
│   ├── 03_tasks_wbs.png
│   ├── 04_raid_sla.png
│   └── 05_resources_cost.png
└── powerbi_build_guide/
    └── PowerBI_Build_Guide.md
```

### README Template
```markdown
# ISP Project Management Dashboard
### Enterprise Network Delivery Intelligence | Tata Nelco Limited

[![Live Demo](https://img.shields.io/badge/Live_Demo-Click_Here-00D4C8)](https://YOUR-USERNAME.github.io/isp-pm-dashboard/)
[![Power BI](https://img.shields.io/badge/Power_BI-Dashboard-F5A623)](https://app.powerbi.com/YOUR-LINK)

## Overview
A professional 5-page project management dashboard for ISP/Telecom enterprise delivery.
Built to track 42 projects, 3,848 sites, and 8,291 data points across 10 connected tables.

**Technologies:** Power BI Desktop, DAX, Power Query | Excel Data Model | HTML/JS (GitHub Pages version)

## Dashboard Pages
| Page | Key Metrics |
|---|---|
| Executive Overview | Portfolio RAG, Budget vs Actual, Project Status |
| Site Tracker | 3,848 sites across pan-India, SLA compliance, milestone funnel |
| Tasks / WBS | Gantt view, phase completion, 504 tasks |
| RAID & SLA | 180 risk/issue items, penalty exposure, SLA by metric |
| Resources & Cost | Team allocation, cost by category, monthly spend trend |

## Data Model
Star schema with 10 tables, 8,291 total rows.
[See full schema diagram →]

## Resume Bullet Points
- Designed and deployed Power BI dashboard tracking ₹35Cr+ ISP project portfolio (42 projects, 3,848 sites, pan-India)
- Built star schema data model with 10 connected tables and 25+ DAX measures including EAC, SLA Compliance %, and RAG health scoring
- Implemented cross-filtered drill-through reports enabling site-level SLA breach analysis and RAID log governance tracking
```

### Resume Bullet Points (Ready to Use)
- Developed enterprise Power BI dashboard for ISP network delivery portfolio (42 projects · ₹35Cr+ · 3,848 pan-India sites) with RAG health, SLA compliance, and RAID governance reporting
- Architected 10-table star schema data model with Power Query ETL transformations and 25+ DAX measures (EAC, Budget Variance %, Rollout %, SLA Compliance %)
- Delivered drill-through interactivity and cross-page filtering enabling PM team to reduce issue resolution TAT by identifying pattern clusters across region, vendor, and technology dimensions

