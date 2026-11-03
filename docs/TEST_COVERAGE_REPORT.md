# Automated Test Coverage & Quality Report

**Project:** Collaborative Student Study Material & Quiz Platform (CSQP)  
**Requirement Reference:** CSQP-NF-001, CSQP-NF-004, CSQP-STP Section 14  
**Date of Run:** 03 November 2026  
**Test Runners:** Jest 29 (Server), Vitest 5.1 (Client), Pytest 8.3 + pytest-cov (Analytics)  
**Overall Status:** **PASSED (371 / 371 Automated Tests Passing)**

---

## 1. Test Suite Summary

```
┌──────────────────────────────────────┬─────────────┬──────────────┬────────────┐
│ Subsystem / Component                │ Framework   │ Test Suites  │ Total Tests│
├──────────────────────────────────────┼─────────────┼──────────────┼────────────┤
│ Backend API Gateway & Database       │ Jest        │ 21 Suites    │ 237 Passed │
│ Frontend Single Page App (SPA)       │ Vitest      │ 14 Suites    │ 98 Passed  │
│ Microservice Analytics Engine        │ Pytest      │ 5 Suites     │ 36 Passed  │
│ TOTAL AUTOMATED REGRESSION SUITE     │ —           │ 40 Suites    │ 371 Passed │
└──────────────────────────────────────┴─────────────┴──────────────┴────────────┘
```

---

## 2. Python Analytics Microservice Coverage (`pytest-cov`)

```
Name                                   Stmts   Miss   Branch   BrPart  Coverage
--------------------------------------------------------------------------------
analytics/app/__init__.py                  1      0        0        0      100%
analytics/app/class_analytics.py          53      0       18        0      100%
analytics/app/config.py                    4      0        0        0      100%
analytics/app/leaderboard.py              28      0       10        0      100%
analytics/app/main.py                     64      2       16        1       97%
analytics/app/mock_data.py                 4      0        0        0      100%
analytics/app/reports.py                  84      1       14        1       99%
analytics/app/student_performance.py      46      1       14        1       98%
--------------------------------------------------------------------------------
TOTAL                                    284      4       72        3     98.6%
```
* **Statements Tested:** 284
* **Statement Coverage:** **98.6%**
* **Branch Coverage:** **95.8%**

---

## 3. Server (Node.js / Express / Mongoose) Test Coverage (`Jest`)

```
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Key Test File     
-------------------|---------|----------|---------|---------|-------------------
All files          |   72.94 |    50.22 |   77.77 |   73.32 | 21 Test Suites    
 src               |   95.08 |    52.63 |     100 |   96.61 | app.test.js       
  app.js           |   93.47 |    60.00 |     100 |   95.45 | app.test.js       
  errorHandler.js  |  100.00 |    44.44 |     100 |  100.00 | error.test.js     
  middleware.js    |  100.00 |   100.00 |     100 |  100.00 | logging.test.js   
 src/controllers   |   68.43 |    47.70 |   73.56 |   68.90 |                   
  analyticsContr.  |   91.02 |    50.00 |     100 |   92.75 | class_ana.test.js 
  authController   |   89.09 |    72.22 |     100 |   89.44 | auth_login.test.js
  leaderboardContr |   92.42 |    76.08 |     100 |   94.91 | leaderbd.test.js  
  opsController    |   69.38 |    47.72 |   66.66 |   69.56 | uptime.test.js    
  quizController   |   72.89 |    47.10 |   73.68 |   72.83 | quiz_ass.test.js  
 src/middleware    |   91.13 |    77.19 |     100 |   90.90 |                   
  rateLimiter.js   |  100.00 |    70.58 |     100 |  100.00 | rbac.test.js      
  rbac.js          |   91.66 |    86.95 |     100 |   91.30 | rbac.test.js      
  upload.js        |   87.50 |    70.58 |     100 |   87.17 | materials.test.js 
 src/models        |  100.00 |   100.00 |     100 |  100.00 |                   
  AuditLog.js      |  100.00 |   100.00 |     100 |  100.00 | seed.test.js      
  Material.js      |  100.00 |   100.00 |     100 |  100.00 | materials.test.js 
  Question.js      |  100.00 |   100.00 |     100 |  100.00 | seed.test.js      
  Quiz.js          |  100.00 |   100.00 |     100 |  100.00 | seed.test.js      
  QuizAttempt.js   |  100.00 |   100.00 |     100 |  100.00 | anti_cheat.test.js
  User.js          |  100.00 |   100.00 |     100 |  100.00 | seed.test.js      
 src/seed          |   89.83 |    72.50 |   83.33 |   91.50 | demo_seed.test.js 
 src/test-utils    |   88.88 |    50.00 |   88.88 |   88.88 | testDb.js         
 src/utils         |   49.00 |    43.10 |   83.33 |   50.53 |                   
  antiCheat.js     |   85.71 |    66.66 |     100 |   94.44 | anti_cheat.test.js
-------------------|---------|----------|---------|---------|-------------------
```

---

## 4. Frontend SPA Test Coverage (`Vitest` + `v8`)

* **Test Files:** 14 files, 98 tests passing (100% pass rate).
* **WCAG 2.1 AA Axe Accessibility:** 19/19 accessibility audit tests pass with 0 violations.
* **Component Coverage:**
  * `App.jsx`, `DashboardLayout.jsx`, `StudentDashboard.jsx`, `InstructorDashboard.jsx`, `AdminDashboard.jsx`: **100% Statement Coverage**.
  * `LoginPage.jsx`: **95.4% Coverage**.
  * `RegisterPage.jsx`: **91.9% Coverage**.
  * `LeaderboardPage.jsx`: **96.9% Coverage**.
  * `ClassAnalyticsPage.jsx`: **95.4% Coverage**.
  * `UptimeReportPage.jsx`: **90.5% Coverage**.
  * `QuizAttemptPage.jsx`: **88.5% Coverage**.
  * `StudentProgressPage.jsx`: **95.0% Coverage**.

---

## 5. Non-Functional Performance & Accessibility Compliance

* **p90 Response Latency (`CSQP-NF-001`):** Target: `<= 2,000ms` | Observed: **`227.6ms`** (8.7x faster than SLA limit).
* **Automated Accessibility (`CSQP-NF-004`):** Target: `WCAG 2.1 AA` | Axe Violations: **`0`** across all signed-in and public pages.
* **High Availability Target (`CSQP-NF-002`):** Target: `>= 99.5%` uptime with automated 24-hr advance maintenance notice checks.
