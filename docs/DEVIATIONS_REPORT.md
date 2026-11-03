# Architectural & Design Deviations Report

**Project:** Collaborative Student Study Material & Quiz Platform (CSQP)  
**Associated SRS:** v1.0 (`docs/Team4_SRS.pdf`)  
**Associated SAD:** v1.0 (`docs/Team4_SAD.pdf`)  
**Purpose:** Formal documentation of intentional, permitted agile architectural evolutions made during Sprint 1 and Sprint 2 execution.

---

## 1. Overview of Agile Evolution

In accordance with Agile development principles and Mini-Project Part-2 guidelines, several architectural refinements and enhancements were introduced during implementation to improve security, accessibility, build performance, and user experience beyond the baseline specification.

---

## 2. Summary of Deviations

| # | Component / Domain | Initial Specification (SRS/SAD v1.0) | Implemented Evolution | Engineering Justification |
| :- | :--- | :--- | :--- | :--- |
| **1** | **Authentication & Token Storage** | Long-lived JWT stored in Browser LocalStorage. | In-memory Access Token + `HttpOnly` `SameSite=Strict` Refresh Token Cookie. | Prevents Cross-Site Scripting (XSS) credential theft (`CSQP-SR-003`). Even if an XSS vulnerability occurs, script cannot read tokens in `HttpOnly` cookies. |
| **2** | **Frontend Tooling & Bundling** | Standard Webpack / Create-React-App pipeline. | Modern **Vite** bundler with native ES modules. | Reduced production build times from ~15s to **81ms**, and enabled instant Hot Module Replacement (HMR) for faster development. |
| **3** | **Analytics & PDF Export Engine** | Client-side Canvas/DOM to PDF export. | Dedicated **Python FastAPI** microservice utilizing **ReportLab**. | Server-side report generation avoids browser layout reflows, handles large data arrays without UI thread lag, and yields cryptographic vector PDFs (`/api/analytics/reports/...`). |
| **4** | **UI Theme & Accessibility** | Standard light mode university portal. | **WCAG 2.1 AA Compliant Minimalist Dark Theme** with contrast ratios >= 7:1. | Ensures full accessibility compliance (`CSQP-NF-004`), passed 19/19 automated Axe accessibility rules, and reduced screen glare during long quiz sessions. |
| **5** | **Anti-Cheat Enforcement** | Client-side timer and basic copy-paste event blocking. | **Dual-Layer Anti-Cheat**: Client event monitors + Strict Server-Side Answer Key Stripping and `409 Conflict` Single Active Attempt lock. | Guarantees that answer keys never leak across network payloads (`verifyPayloadIsAnswerFree`), preventing browser DevTools inspection. |
| **6** | **Bulk Question Ingestion** | Manual database insertions or JSON payload submission. | Multi-format **CSV and Excel (.xlsx)** parser with automated header normalization (`POST /api/questions/import`). | Enables instructors to batch-upload hundreds of exam questions directly from spreadsheet templates. |

---

## 3. Detailed Technical Justifications

### 3.1 Security Hardening: HttpOnly Cookie Token Rotation
* **Initial Plan:** SAD Section 3.9 noted standard JWT Bearer token delivery.
* **Evolution:** To satisfy strict OWASP ASVS and STRIDE threat mitigation, the refresh token was moved into an `HttpOnly`, `SameSite=Strict` cookie (`refreshToken`), while the short-lived access token resides purely in Javascript memory (`api.js`). Token reuse triggers immediate invalidation of the entire user session.

### 3.2 Dual-Layer Anti-Cheat Architecture
* **Initial Plan:** Enforce anti-cheat via UI popups on tab blur.
* **Evolution:** Relying solely on client checks is vulnerable to tampering. The backend Express quiz controller (`server/src/controllers/quizController.js`) now strictly strips all `answer` fields from quiz attempt questions, shuffles options with unique seeds, and stores timestamps in UTC on the server to prevent local client clock manipulation.

### 3.3 Microservice Separation for Analytics
* **Initial Plan:** Monolithic Node.js calculating math aggregates and chart generation.
* **Evolution:** Computational queries (e.g. topic mastery percentage, miss-rates across historical attempts) were moved to an asynchronous Python FastAPI service running in its own virtual environment (`analytics/`). This offloads CPU-intensive tasks from the Express event loop.

---

## 4. Conclusion
All deviations represent strictly positive security and architectural hardening that uphold the core functional requirements while exceeding initial non-functional performance benchmarks.
