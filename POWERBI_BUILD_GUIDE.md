# Power BI Desktop Build Guide — ISP PM Dashboard

Complete step-by-step guide to recreate this dashboard as a native `.pbix` file in Power BI Desktop. Estimated build time: **3–4 hours**.

---

## 1. Import Data

1. Open **Power BI Desktop**
2. **Home → Get Data → Excel** → select `data/Isp_Pm_RawData_PowerBI.xlsx`
3. Import all 10 sheets:
   - `Client_Master`
   - `Projects`
   - `Sites_Milestones`
   - `Tasks_WBS`
   - `RAID_Log`
   - `Resources`
   - `Budget_Costs`
   - `SLA_Governance`
   - `Weekly_Status_Log`
   - `Date_Dimension`
4. Click **Transform Data** → verify date columns are `Date` type:
   - Projects: `StartDate`, `PlannedEndDate`
   - Sites: `SurveyDate`, `InstallPlanned`, `InstallActual`, `GoLivePlanned`, `GoLiveActual`
   - Tasks: `PlannedStart`, `PlannedEnd`
   - RAID: `DueDate`
   - Weekly: `WeekEnding`
   - Date_Dimension: `Date`
5. Close & Apply

---

## 2. Data Model (Relationships)

Open **Model view** and create these relationships:

| From (Many) | Column | To (One) | Column | Cross-filter |
|-------------|--------|----------|--------|--------------|
| Projects | ClientID | Client_Master | ClientID | Single |
| Sites_Milestones | ProjectID | Projects | ProjectID | Single |
| Sites_Milestones | ClientID | Client_Master | ClientID | Single |
| Tasks_WBS | ProjectID | Projects | ProjectID | Single |
| RAID_Log | ProjectID | Projects | ProjectID | Single |
| Budget_Costs | ProjectID | Projects | ProjectID | Single |
| SLA_Governance | ProjectID | Projects | ProjectID | Single |
| Weekly_Status_Log | ProjectID | Projects | ProjectID | Single |
| Projects | StartDate | Date_Dimension | Date | Single |
| Sites_Milestones | InstallPlanned | Date_Dimension | Date | Single |
| Weekly_Status_Log | WeekEnding | Date_Dimension | Date | Single |

Mark `Date_Dimension` as **Date Table** (right-click → Mark as date table → `Date`).

Hide unnecessary keys from report view: `ClientID`, `ProjectID` on fact tables (right-click → Hide in report view).

---

## 3. DAX Measures

Create a **Metrics** table: **Modeling → New Table**:

```dax
Metrics = ROW("Placeholder", 0)
```

Hide the Placeholder column. Add these measures:

### Portfolio KPIs

```dax
Total Projects = DISTINCTCOUNT(Projects[ProjectID])

Total Sites = COUNTROWS(Sites_Milestones)

Sites Live =
CALCULATE(
    COUNTROWS(Sites_Milestones),
    Sites_Milestones[SiteStatus] = "Live"
)

Sites Live % = DIVIDE([Sites Live], [Total Sites], 0)

Avg Completion % = AVERAGE(Projects[PctComplete])

Total Budget (Cr) = SUM(Projects[Budget_Cr])

Total Actual Spend (Cr) = SUM(Projects[ActualSpend_Cr])

Budget Variance % =
DIVIDE(
    [Total Actual Spend (Cr)] - [Total Budget (Cr)],
    [Total Budget (Cr)],
    0
)

Open Issues =
CALCULATE(
    COUNTROWS(RAID_Log),
    RAID_Log[Type] = "Issue",
    RAID_Log[Status] IN {"Open", "Escalated"}
)

Open Risks =
CALCULATE(
    COUNTROWS(RAID_Log),
    RAID_Log[Type] = "Risk",
    RAID_Log[Status] IN {"Open", "Escalated"}
)
```

### SLA Measures

```dax
SLA Met Sites =
CALCULATE(COUNTROWS(Sites_Milestones), Sites_Milestones[SLAStatus] = "Met")

SLA Breached Sites =
CALCULATE(COUNTROWS(Sites_Milestones), Sites_Milestones[SLAStatus] = "Breached")

SLA Breach % = DIVIDE([SLA Breached Sites], [Total Sites], 0)

Avg Site Delay = AVERAGE(Sites_Milestones[DelayDays])

SLA Achievement % = AVERAGE(SLA_Governance[Achieved_Pct])
```

### Resource & Cost

```dax
Avg Utilization % = AVERAGE(Resources[Utilization_Pct])

Total Planned Cost =
SUM(Budget_Costs[Planned_INR]) / 10000000

Total Actual Cost =
SUM(Budget_Costs[Actual_INR]) / 10000000

Cost Variance % =
DIVIDE(
    SUM(Budget_Costs[Actual_INR]) - SUM(Budget_Costs[Planned_INR]),
    SUM(Budget_Costs[Planned_INR]),
    0
)
```

### RAG Health

```dax
Green Projects =
CALCULATE(COUNTROWS(Projects), Projects[RAGStatus] = "Green")

Amber Projects =
CALCULATE(COUNTROWS(Projects), Projects[RAGStatus] = "Amber")

Red Projects =
CALCULATE(COUNTROWS(Projects), Projects[RAGStatus] = "Red")
```

### Conditional Formatting Helper

```dax
RAG Color =
SWITCH(
    SELECTEDVALUE(Projects[RAGStatus]),
    "Green", "#107C10",
    "Amber", "#CA5010",
    "Red",   "#D13438",
    "#605E5C"
)
```

---

## 4. Report Pages

### Page 1: Executive Overview

**Slicers (top):** `Client_Master[ClientName]`, `Projects[Region]`, `Projects[RAGStatus]`

**KPI Cards (row):**
| Card | Measure |
|------|---------|
| Active Projects | `[Total Projects]` |
| Avg Completion | `[Avg Completion %]` → format % |
| Budget | `[Total Budget (Cr)]` → ₹ Cr |
| Spend Variance | `[Budget Variance %]` → format % |
| Open Issues | `[Open Issues]` |
| Sites Live | `[Sites Live]` |

**Visuals:**
- **Table:** Projects — columns: ProjectID, ProjectName, ClientName, ProjectType, Region, PMOwner, RAGStatus, PctComplete, Budget_Cr, ActualSpend_Cr
  - Conditional formatting on RAGStatus (background color Green/Amber/Red)
  - Data bar on PctComplete
- **Donut:** RAGStatus (count of projects)
- **Bar chart (horizontal):** ProjectType → count
- **Line chart:** WeekEnding (axis) × Avg PctComplete (from Weekly_Status_Log)
- **Clustered bar:** ClientName × ActualSpend_Cr

---

### Page 2: Sites & Milestones

**KPI Cards:** Total Sites, Sites Live, SLA Breached Sites, Avg Site Delay

**Visuals:**
- **Stacked bar:** SiteStatus × Region
- **Map** (optional): City, Size = count, Color = SLAStatus
- **Donut:** SLAStatus (Met / Marginal / Breached)
- **Table:** SiteID, SiteName, ClientName, City, Region, Bandwidth_Mbps, SiteStatus, DelayDays, SLAStatus, Engineer
  - Filter: Top N by DelayDays for "at-risk" view

**Drill-through:** Set up drill-through from Projects table → Sites page filtered by ProjectID

---

### Page 3: Tasks & WBS

**Visuals:**
- **Stacked bar:** WBSPhase × Status (from Tasks_WBS)
- **Donut:** Status
- **Matrix:**
  - Rows: ProjectName
  - Columns: WBSPhase
  - Values: Avg PctComplete
  - Conditional formatting: color scale (red → green)

**Slicer:** WBSPhase, Status

---

### Page 4: RAID & SLA Governance

**KPI Cards:** Open Issues, Open Risks, SLA Achievement %

**Visuals:**
- **Donut:** RAID Type (Risk/Issue/Assumption/Dependency)
- **Bar:** Severity
- **Clustered bar:** SLA Metric × Target_Pct vs Achieved_Pct
- **Table:** RAIDID, Type, Title, ProjectID, Severity, Owner, Status, Impact, DueDate
  - Filter: Status = Open or Escalated

**Tooltip page:** Create small tooltip showing project RAG + PM when hovering RAID items

---

### Page 5: Resources & Cost

**KPI Cards:** Avg Utilization %, Team Size (COUNT Resources), Total Budget, Cost Variance %

**Visuals:**
- **Donut:** Role
- **Bar (horizontal):** Top 15 resources by Utilization_Pct
- **Line chart:** Month × Planned vs Actual (from Budget_Costs, values in Cr)
- **Treemap:** Category × Actual_INR

---

## 5. Formatting & Theme

1. **View → Themes → Customize** (or import JSON theme):
   - Primary: `#0078D4` (Power BI blue)
   - Background: `#F3F2F1`
   - Font: Segoe UI
2. Page size: **16:9**
3. Add **page navigator** (Insert → Buttons → Navigator) for 5-page nav
4. Add header text: "Nelco ISP PM — Portfolio Analytics"
5. Add "Last refreshed" card using `MAX(Date_Dimension[Date])`

---

## 6. Advanced Features (Resume Differentiators)

### Drill-through
- From Overview project table → Sites page (filter by ProjectID)
- From Sites table → RAID page

### Bookmarks
- "At Risk Only" → filter RAG = Red/Amber, SLA = Breached
- "BFSI Clients" → filter Sector = BFSI
- "Reset All" → clear all filters

### Row-Level Security (optional demo)
```dax
// Role: Regional PM — can only see their region
[Region] = USERPRINCIPALNAME()  // or custom mapping table
```

### Publish
1. **Home → Publish** → Power BI Service
2. Configure scheduled refresh (if using SharePoint/OneDrive for Excel)
3. Create **mobile layout** for KPI page

---

## 7. Validation Checklist

- [ ] All 10 tables imported, dates typed correctly
- [ ] 10 relationships active, no ambiguous paths
- [ ] 15+ DAX measures created in Metrics table
- [ ] 5 report pages with consistent theme
- [ ] Slicers cross-filter all visuals on each page
- [ ] RAG conditional formatting applied
- [ ] Drill-through configured
- [ ] File saved as `Nelco_ISP_PM_Dashboard.pbix`

---

## 8. Screenshot Tips for Resume

Capture these for your portfolio PDF/LinkedIn:
1. Executive Overview (full page with slicers + KPIs)
2. Sites page showing SLA donut + site table
3. Model view showing star schema
4. DAX measure list in Metrics table

Link your **GitHub Pages live demo** alongside the `.pbix` screenshot — recruiters can click the live version without installing Power BI.
