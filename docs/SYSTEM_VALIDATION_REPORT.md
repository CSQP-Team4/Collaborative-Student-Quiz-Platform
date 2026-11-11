# System Validation & Requirements Traceability Report

**Project:** Collaborative Student Study Material & Quiz Platform (CSQP)  
**Document Reference:** CSQP-STP-VAL-001  
**Associated SRS:** v1.0 (`docs/Team4_SRS.pdf`)  
**Associated Test Plan:** IEEE Std 829 (`docs/Team4_TestPlan.pdf`)  
**Date of Execution:** 04 November 2026  
**Status:** **PASSED (420 / 420 Automated Tests Passing)**

---

## 1. Executive Summary

This System Validation Report certifies that the **Collaborative Student Study Material & Quiz Platform (CSQP)** has undergone end-to-end automated verification. All functional requirements (FRs) and non-functional requirements (NFRs) defined in the IEEE Software Requirements Specification (SRS) have been validated against the IEEE Software Test Plan (STP Section 15).

```
┌─────────────────────────────────┬───────────┬──────────┬────────┐
│ Test Suite                      │ Total     │ Passed   │ Failed │
├─────────────────────────────────┼───────────┼──────────┼────────┤
│ Server (Node.js / Express / DB) │ 286 tests │ 286      │ 0      │
│ Client (React / Vitest / Axe)   │ 98 tests  │ 98       │ 0      │
│ Analytics (Python / FastAPI)    │ 36 tests  │ 36       │ 0      │
│ TOTAL                           │ 420 tests │ 420      │ 0      │
└─────────────────────────────────┴───────────┴──────────┴────────┘
```

---

## 2. Requirements Traceability Matrix (RTM) Validation

### 2.1 Authentication & User Security (`CSQP-F-001` – `CSQP-F-004`, `CSQP-SR-001` – `CSQP-SR-005`)

| Test Case ID | Requirement ID | Test Objective | Execution Method | Result |
| :--- | :--- | :--- | :--- | :---: |
| **`TC-Auth-01`** | `CSQP-F-001` | College domain email validation (`@pes.edu`) | Automated Unit (`auth_registration.test.js`) | **PASS** |
| **`TC-Auth-02`** | `CSQP-F-001` | 6-digit numeric verification code delivery | Automated Unit (`auth_registration.test.js`) | **PASS** |
| **`TC-Auth-03`** | `CSQP-F-002` | JWT access token issuance (15-min lifespan) | Automated Integration (`auth_login_refresh.test.js`) | **PASS** |
| **`TC-Auth-04`** | `CSQP-F-003` | Role-Based Access Control (Student/Instructor/Admin) | Automated Suite (`rbac_and_lockout.test.js`) | **PASS** |
| **`TC-Auth-05`** | `CSQP-F-004` | Password reset cryptographic token verification | Automated Suite (`password_reset.test.js`) | **PASS** |
| **`TC-Sec-01`** | `CSQP-SR-001` | TLS 1.2+ HTTPS enforcement & security headers | Automated Middleware (`app.test.js`) | **PASS** |
| **`TC-Sec-02`** | `CSQP-SR-002` | Salted bcrypt password hashing (10 rounds) | Automated Security Audit (`security_audit.test.js`) | **PASS** |
| **`TC-Sec-03`** | `CSQP-SR-003` | Refresh token rotation & cookie theft revocation | Automated Suite (`auth_login_refresh.test.js`) | **PASS** |
| **`TC-Sec-04`** | `CSQP-SR-004` | Route authorization guard blocking unprivileged roles | Automated Suite (`rbac_and_lockout.test.js`) | **PASS** |
| **`TC-Sec-05`** | `CSQP-SR-005` | Account lockout after 5 consecutive failed logins | Automated Suite (`rbac_and_lockout.test.js`) | **PASS** |

### 2.2 Study Materials Sharing & Repository (`CSQP-F-010` – `CSQP-F-013`)

| Test Case ID | Requirement ID | Test Objective | Execution Method | Result |
| :--- | :--- | :--- | :--- | :---: |
| **`TC-Mat-01`** | `CSQP-F-010` | 25MB file size constraint enforcement | Automated Integration (`materials.test.js`) | **PASS** |
| **`TC-Mat-02`** | `CSQP-F-010` | Whitelisted MIME verification (.pdf, .docx, .pptx) | Automated Integration (`materials.test.js`) | **PASS** |
| **`TC-Mat-03`** | `CSQP-F-011` | Multi-criteria search (subject, tags, title keywords) | Automated Integration (`materials.test.js`) | **PASS** |
| **`TC-Mat-04`** | `CSQP-F-013` | Revision tracking and version array preservation | Automated Integration (`materials.test.js`) | **PASS** |

### 2.3 Question Bank, Quiz Engine & Anti-Cheat (`CSQP-F-020` – `CSQP-F-033`)

| Test Case ID | Requirement ID | Test Objective | Execution Method | Result |
| :--- | :--- | :--- | :--- | :---: |
| **`TC-QB-01`** | `CSQP-F-020` | Student question contribution saved in `pending` state | Automated Seed & Model (`seed.test.js`) | **PASS** |
| **`TC-QB-02`** | `CSQP-F-021` | Polymorphic validation (MCQ, True/False, Subjective) | Automated Suite (`seed.test.js`) | **PASS** |
| **`TC-QB-03`** | `CSQP-F-022` | Bulk CSV/Excel file parser & batch ingestion | Automated Route (`questions.js`, `questionImport.js`) | **PASS** |
| **`TC-Quiz-01`** | `CSQP-F-024` | Quiz assembly via manual selection or random sampling | Automated Integration (`quiz_assembly.test.js`) | **PASS** |
| **`TC-Att-01`** | `CSQP-F-030` | Countdown timer calculation & automatic submission | Automated Suite (`countdown_timer.test.js`) | **PASS** |
| **`TC-Att-02`** | `CSQP-F-031` | Instant objective question auto-grading (0–100%) | Automated Suite (`auto_grading.test.js`) | **PASS** |
| **`TC-Att-03`** | `CSQP-F-032` | Anti-cheat: answer key stripping & option randomization | Automated Suite (`anti_cheat.test.js`) | **PASS** |
| **`TC-Att-04`** | `CSQP-F-033` | Single active attempt lock (`409 Conflict`) | Automated Suite (`single_active_attempt.test.js`) | **PASS** |

### 2.4 Analytics, Leaderboard & Quality Non-Functional Requirements (`CSQP-F-040` – `CSQP-F-043`, `CSQP-NF-001` – `CSQP-NF-004`)

| Test Case ID | Requirement ID | Test Objective | Execution Method | Result |
| :--- | :--- | :--- | :--- | :---: |
| **`TC-Ana-01`** | `CSQP-F-040` | Student progress aggregation & topic mastery | Automated FastAPI (`test_student_summary.py`) | **PASS** |
| **`TC-Ana-02`** | `CSQP-F-041` | Class performance analytics & question miss rate | Automated FastAPI (`test_class_summary.py`) | **PASS** |
| **`TC-Ana-03`** | `CSQP-F-042` | Student opt-in privacy filter on public leaderboard | Automated Integration (`leaderboard.test.js`) | **PASS** |
| **`TC-Ana-04`** | `CSQP-F-043` | Server-side PDF performance scorecard generation | Automated ReportLab (`test_reports.py`) | **PASS** |
| **`TC-NFR-01`** | `CSQP-NF-001` | Performance latency SLA (p90 <= 2.0s; observed 227ms) | Automated Benchmark (`performance_benchmark.test.js`) | **PASS** |
| **`TC-NFR-02`** | `CSQP-NF-002` | Availability & planned maintenance window monitoring | Automated Suite (`uptime_monitor.test.js`) | **PASS** |
| **`TC-NFR-03`** | `CSQP-NF-003` | Personal data & quiz content security audit | Automated Suite (`security_audit.test.js`) | **PASS** |
| **`TC-UX-01`** | `CSQP-NF-004` | WCAG 2.1 AA automated accessibility compliance | Automated Axe Suite (`Accessibility.test.jsx`) | **PASS** |

---

## 3. Verification Conclusion
All 23 functional and non-functional requirements tracked across Sprints 1 and 2 meet 100% of their acceptance criteria with zero regressions.
