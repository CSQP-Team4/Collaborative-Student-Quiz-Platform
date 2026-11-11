# Engineering Documentation & Quality Reports

**Project:** Collaborative Student Study Material & Quiz Platform (CSQP)  
**Team:** Team 4  
**Date:** November 2026  

This directory contains the formal engineering specifications, architectural models, test plans, and automated verification reports for the CSQP platform.

---

## 1. Master Documentation Index

| Document Category | Document Title | File Path / Format | Status | Description |
| :--- | :--- | :--- | :---: | :--- |
| **Requirements Specification** | **Software Requirements Specification (SRS)** | [`Team4_SRS.pdf`](file:///Users/bane/Developer/Personal/Collaborative-Student-Quiz-Platform/docs/Team4_SRS.pdf) | **Complete** | IEEE-formatted specification detailing all functional (`CSQP-F-001..043`) and non-functional (`CSQP-NF-001..005`) requirements. |
| **System Architecture / Design** | **Software Architecture Document (SAD / SED)** | [`Team4_SAD.pdf`](file:///Users/bane/Developer/Personal/Collaborative-Student-Quiz-Platform/docs/Team4_SAD.pdf) | **Complete** | High-level system architecture, tier diagrams, data schemas, deployment topologies, and microservice interfaces. |
| **Test Planning** | **Software Test Plan (STP)** | [`Team4_TestPlan.pdf`](file:///Users/bane/Developer/Personal/Collaborative-Student-Quiz-Platform/docs/Team4_TestPlan.pdf) | **Complete** | IEEE Std 829 test plan outlining test strategy, pass/fail criteria, test environments, and test case specifications (`TC-Auth`, `TC-Mat`, `TC-QB`, `TC-Quiz`, `TC-Ana`, `TC-Scale`). |
| **Unit Testing** | **Unit Test Report** | [`UNIT_TEST_REPORT.md`](file:///Users/bane/Developer/Personal/Collaborative-Student-Quiz-Platform/docs/UNIT_TEST_REPORT.md) | **100% Passed** (164/164 tests) | Comprehensive breakdown of isolated unit tests covering regex validation, question schemas, math formulas, error handlers, and state reducers. |
| **System Testing** | **System Test Report** | [`SYSTEM_TEST_REPORT.md`](file:///Users/bane/Developer/Personal/Collaborative-Student-Quiz-Platform/docs/SYSTEM_TEST_REPORT.md) | **100% Passed** (58/58 tests) | Verification of system-wide NFRs: latency SLA ($p_{90} < 200\text{ms}$), high concurrency (5,000 users / 500 attempts), 99.5% uptime, TLS, and anti-cheat enforcement. |
| **System Validation** | **System Validation & Traceability Report** | [`SYSTEM_VALIDATION_REPORT.md`](file:///Users/bane/Developer/Personal/Collaborative-Student-Quiz-Platform/docs/SYSTEM_VALIDATION_REPORT.md) | **100% Passed** (420/420 tests) | Full Requirements Traceability Matrix (RTM) linking all 23+ functional and non-functional requirements to automated test suites. |
| **Code Coverage & Quality** | **Automated Test Coverage & Quality Report** | [`TEST_COVERAGE_REPORT.md`](file:///Users/bane/Developer/Personal/Collaborative-Student-Quiz-Platform/docs/TEST_COVERAGE_REPORT.md) | **100% Passed** (420/420 tests) | Master 4-level testing taxonomy (Unit, Integration, System, Acceptance), code coverage percentages, and complete inventory of all 47 test suites. |
| **Accessibility Audit** | **Accessibility Audit Report (WCAG 2.1 AA)** | [`ACCESSIBILITY_AUDIT.md`](file:///Users/bane/Developer/Personal/Collaborative-Student-Quiz-Platform/docs/ACCESSIBILITY_AUDIT.md) | **0 Violations** | Automated and manual accessibility evaluation across all client routes ensuring WCAG 2.1 Level AA compliance. |
| **Security Audit** | **Security & OWASP Verification Checklist** | [`SECURITY_CHECKLIST.md`](file:///Users/bane/Developer/Personal/Collaborative-Student-Quiz-Platform/docs/SECURITY_CHECKLIST.md) | **Complete** | Security assessment covering JWT rotation, bcrypt hashing, rate limiting, brute-force lockout, and input sanitization. |

---

## 2. Automated Testing Execution Quick Reference

```bash
# Run All Backend Tests (Jest - 286 tests)
npm --prefix server test -- --runInBand

# Run All Frontend Tests (Vitest - 98 tests)
npm --prefix client test -- --run

# Run All Analytics Microservice Tests (Pytest - 36 tests)
analytics/.venv/bin/pytest analytics/tests

# Check Analytics Microservice Coverage (98.6% statement coverage)
analytics/.venv/bin/pytest analytics/tests --cov=app --cov-report=term-missing
```
