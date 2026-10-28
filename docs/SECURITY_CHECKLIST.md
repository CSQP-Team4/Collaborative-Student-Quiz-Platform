# Security Audit & Compliance Checklist (CSQP-NF-003)

**Project:** Collaborative Student Study Material & Quiz Platform (CSQP)  
**Security & Performance QA Lead:** John S Thomas (`PES2UG24CS207`)  
**Standard / Baseline:** IEEE 829 / SADS v1.0 Section 3.9 (STRIDE Threat Model) / STP v1.0 Section 5.1  
**Status:** COMPLETED & VERIFIED  

---

## 1. Executive Summary

This Security Checklist and Audit Report certifies that the **Collaborative Student Study Material & Quiz Platform (CSQP)** fulfills requirement **`CSQP-NF-003` (Personal Data & Quiz Content Protection)** alongside all security-specific functional and non-functional requirements (`CSQP-SR-001` through `CSQP-SR-005`, `CSQP-F-032`, and `CSQP-F-033`).

All controls have been implemented at both architecture and code layers and validated through continuous automated unit, integration, and security regression test suites (`security_audit.test.js`, `anti_cheat_quiz.test.js`, `rbac_and_lockout.test.js`, `auth_login_refresh.test.js`, and `QuizAntiCheat.test.jsx`).

---

## 2. STRIDE Threat Model Matrix & Verified Mitigations

| STRIDE Category | Threat Scenario in CSQP | Architectural Mitigation Applied (SAD 3.9) | Verification Method | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Spoofing** | Attacker impersonating student or instructor to submit tests or manipulate grades. | Signed JWT access tokens ($1\text{h}$ expiry), rotating HttpOnly refresh cookies, email OTP college verification. | `auth_login_refresh.test.js`, `security_audit.test.js` (Control 4) | **PASS** |
| **Tampering** | Intercepting/modifying quiz answers, file uploads, or rating payloads in transit. | Enforced TLS 1.2+ encryption for all traffic; server-side payload validation and checksum verification. | `https.test.js`, `security_audit.test.js` (Control 4) | **PASS** |
| **Repudiation** | User denying taking an exam or instructor denying question review/action. | Immutable `AuditLog` collection capturing user ID, IP address, action, and timestamp. | `security_audit.test.js` (Control 6), `rbac_and_lockout.test.js` | **PASS** |
| **Information Disclosure** | Leaking exam answer keys or exposing student personal academic records / passwords. | Correct answer keys stripped from quiz delivery payloads; passwords hashed via salted bcrypt (`select: false`). | `anti_cheat_quiz.test.js`, `security_audit.test.js` (Control 1 & 2) | **PASS** |
| **Denial of Service (DoS)** | Flooding login or quiz submission endpoints to crash server during active exam windows. | IP-level rate limiting on auth routes; 15-minute account lockout after 5 consecutive failed logins. | `security_audit.test.js` (Control 5), `rbac_and_lockout.test.js` | **PASS** |
| **Elevation of Privilege** | Student attempting to approve questions, create quizzes, or view class-wide analytics. | API-level RBAC route middleware verifying token role claims; unauthorized actions return HTTP 403. | `security_audit.test.js` (Control 3), `rbac_and_lockout.test.js` | **PASS** |

---

## 3. Detailed Security Control Specifications

### 3.1 Personal Data & Credential Protection (`CSQP-SR-002`)
- [x] **Salted Bcrypt Hashing:** Passwords stored using bcrypt with $\ge 10$ salt rounds. Plain-text passwords are never saved.
- [x] **Database Projection Isolation (`select: false`):** The `password`, `verificationToken`, `verificationCode`, `resetPasswordToken`, and `resetPasswordExpires` fields are strictly excluded from default MongoDB query projections.
- [x] **Log Sanitization:** Sensitive credentials, authorization bearer tokens, and passwords are fully excluded from console and audit logs.
- [x] **Anti-Enumeration Responses:** Authentication and password reset endpoints return unified, generic success/failure messages to avoid username/email enumeration.

### 3.2 Quiz Content & Academic Integrity (`CSQP-F-032`, `CSQP-F-033`)
- [x] **Strict Answer-Key Stripping (SAD 3.7):** Correct answers (`answer`, `correctAnswer`, `solution`) are excluded from `GET /api/quizzes`, `GET /api/quizzes/:id`, and `POST /api/quizzes/:id/attempts`. Answers are only inspected server-side upon final submission.
- [x] **Fisher-Yates Randomization:** Question sequence and multiple-choice option arrangements are shuffled per attempt so no two students receive the identical order.
- [x] **Single Active Attempt Lock (AC-CSQP-F-033):** Students cannot run concurrent sessions. Starting a parallel session yields `409 Conflict` (`ACTIVE_ATTEMPT_EXISTS`).
- [x] **Client-Side Proctoring:** Text selection is locked (`user-select: none`), clipboard events (`copy`, `cut`, `paste`) and context menus are blocked, and tab switches / window blur events dispatch telemetry violations to `/api/attempts/:id/anti-cheat`. 3 violations flag the attempt for instructor review.
- [x] **Attempt Isolation:** Students cannot access, inspect, or submit attempts owned by another student account (`403 / 404`).

### 3.3 Session Management & Token Rotation (`CSQP-SR-003`)
- [x] **Short-Lived Access Tokens:** JWT access tokens expire in 15–60 minutes.
- [x] **HttpOnly Cookie for Refresh Tokens:** Refresh tokens reside in HttpOnly cookies with `SameSite=Lax` and `Path=/api/auth`, protected from XSS theft.
- [x] **Refresh Token Rotation & Invalidation:** Refresh tokens rotate on every renewal. Reusing an old token revokes all active refresh tokens for that user session.

### 3.4 Role-Based Access Control (`CSQP-SR-004`)
- [x] **Role Hierarchy:** Enforces separation among `student`, `instructor`, and `admin` roles.
- [x] **Middleware Gatekeepers:** Restricted endpoints verify JWT payload roles and reject unauthorized requests with HTTP `403 Forbidden` (`FORBIDDEN`).

### 3.5 Account Lockout & Audit Trails (`CSQP-SR-005`)
- [x] **15-Minute Lockout:** 5 consecutive failed logins trigger temporary account lockout for 15 minutes.
- [x] **Non-Repudiation Audit Logging:** Sensitive security events (lockouts, password resets, anti-cheat violations) create immutable audit logs recording `{ user, action, resource, ipAddress, timestamp, details }`.

---

## 4. Verification & Automated Test Evidence

Automated security test runs confirm 100% compliance:

```bash
PASS src/_tests_/security_audit.test.js
  CSQP-36: Personal Data & Quiz Content Protection Security Audit (CSQP-NF-003 / STRIDE Model)
    Control 1: Personal Data Protection & Credential Isolation (STRIDE: Information Disclosure)
      ✓ ensures passwords in database are hashed with unique salt rounds and excluded by default (304 ms)
      ✓ ensures auth responses never leak password hash, salt, or verification tokens (217 ms)
    Control 2: Quiz Content Protection & Answer-Key Stripping (STRIDE: Information Disclosure)
      ✓ strictly omits answer keys and solutions when fetching quiz catalog and details (108 ms)
      ✓ strictly omits answer keys when student begins an active quiz attempt (101 ms)
      ✓ enforces isolation: students cannot access attempts belonging to other students (102 ms)
    Control 3: Role-Based Access Control & Privilege Escalation Guard (STRIDE: Elevation of Privilege)
      ✓ blocks student token from accessing instructor-only endpoints with 403 Forbidden (93 ms)
      ✓ blocks student and instructor tokens from accessing admin-only management routes (95 ms)
    Control 4: Token Signature & Tamper Resistance (STRIDE: Tampering & Spoofing)
      ✓ rejects forged JWT tokens with invalid signatures or altered roles (92 ms)
      ✓ rejects expired JWT access tokens (94 ms)
    Control 5: Brute-Force & Denial-of-Service Mitigation (STRIDE: Denial of Service)
      ✓ locks account for 15 minutes after 5 consecutive failed logins and records audit log (539 ms)
    Control 6: Audit Logging & Non-Repudiation (STRIDE: Repudiation)
      ✓ creates immutable audit trail on security-sensitive actions (93 ms)

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
Snapshots:   0 total
Time:        2.28 s
```

---

## 5. Formal Sign-Off

| Field | Detail |
| :--- | :--- |
| **Auditor Name:** | John S Thomas |
| **Student Roll No:** | `PES2UG24CS207` |
| **Team Role:** | Security & Performance QA / Auth Lead (Team 4) |
| **Audit Result:** | **100% COMPLIANT / PASS** |
| **Date:** | 28-10-2026 |
