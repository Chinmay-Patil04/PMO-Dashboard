# ISP Project Management Dashboard

Professional **Power BI–style portfolio analytics** for an ISP/Telecom delivery organization (SD-WAN, MPLS, VSAT, ATM connectivity rollouts). Built as a resume-ready artifact with live web demo + raw Excel data for native Power BI Desktop.

**Author:** [Chinmay Kaluram Patil](https://github.com/Chinmay-Patil04)

## Live Demo

**GitHub Pages:** https://chinmay-patil04.github.io/PMO-Dashboard/

Local preview:

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

## What's Included

| Asset | Description |
|-------|-------------|
| `data/Isp_Pm_RawData_PowerBI.xlsx` | 10 related tables (~6,700 rows) — star schema ready |
| `data/dashboard-data.json` | Pre-aggregated metrics for the web dashboard |
| `index.html` + `css/` + `js/` | Interactive 5-page dashboard (Chart.js) |
| `POWERBI_BUILD_GUIDE.md` | Step-by-step native Power BI Desktop build |

## Dashboard Pages

1. **Executive Overview** — KPIs, project portfolio table, RAG, spend, weekly trend
2. **Sites & Milestones** — 3,500+ site-level records, SLA tracking, regional breakdown
3. **Tasks & WBS** — Phase-wise progress matrix (Survey → Go-Live)
4. **RAID & SLA Governance** — Open risks/issues, SLA target vs achieved
5. **Resources & Cost** — Utilization, budget vs actual, cost categories

## Data Model (Star Schema)

```
Client_Master ──< Projects ──< Sites_Milestones
                    │
                    ├──< Tasks_WBS
                    ├──< RAID_Log
                    ├──< Budget_Costs
                    ├──< SLA_Governance
                    └──< Weekly_Status_Log

Date_Dimension (standalone, relate on date columns)
```

**Join keys:** `ClientID`, `ProjectID`, date fields → `Date_Dimension[Date]`

## Clients in Dataset

Hitachi Payment Services, Axis Bank, SBI, Bajaj Finance, HDFC, ICICI, Tata Motors, Reliance Retail

## Resume Bullet (copy-paste)

> Built an end-to-end ISP project portfolio analytics solution covering 39 enterprise rollout programs (SD-WAN/MPLS/VSAT) across 3,600+ sites. Designed star-schema data model in Excel, developed interactive executive dashboard with cross-filtering slicers, and documented full Power BI implementation including DAX measures for SLA compliance, budget variance, and RAG health scoring.

## Tech Stack

- **Data:** Python (openpyxl, Faker), Excel
- **Web Dashboard:** HTML5, CSS3, Chart.js (zero build step)
- **Power BI:** Import mode, DAX, star schema

## Regenerate Data

```bash
pip install openpyxl faker
python3 data/generate_data.py
```

## Author

Chinmay — ISP/Telecom Project Management & Analytics Portfolio
