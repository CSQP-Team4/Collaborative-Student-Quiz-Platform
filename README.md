# Collaborative Study Material & Quiz Platform (CSQP)

[![Repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/CSQP-Team4/Collaborative-Student-Quiz-Platform)
[![Stack](https://img.shields.io/badge/Stack-MERN%20%2B%20Python-green)](#tech-stack)
[![SRS Version](https://img.shields.io/badge/SRS-v1.0-orange)](docs/)

A full-stack collaborative learning and assessment platform designed for students and educators. CSQP allows students to share, version, and review study materials, contribute questions to a centralized question bank, attempt timed and anti-cheat protected quizzes, and gain actionable learning insights through performance analytics.

---

## 📌 Team 4 - Member Profiles & Jira Task Ownership

| Member | SRN | Primary Role | Jira Stories Owned | Sprint 1 Focus | Sprint 2 Focus |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **John S Thomas** | `PES2UG24CS207` | Security & Performance QA / Auth Lead | **11** | Email registration, JWT login, refresh tokens, RBAC middleware, account lockout | Anti-cheat engine, single active attempt, password reset, latency p90 <= 2s, WCAG 2.1 AA, security checklist |
| **Krishna Manoj** | `PES2UG24CS236` | Test Engineer / Core Engine Dev | **8** | Project scaffolding, Mongoose schemas, error handling/logging, TLS 1.2+ HTTPS | Bulk question import (CSV/Excel), quiz assembly, countdown timer, instant auto-grading |
| **Harshith R Reddy** | `PES2UG24CS188` | QA Lead / CI & Analytics Dev | **9** | GitHub Actions CI, test seed fixtures, Python analytics skeleton, Auth UI | Student dashboard, instructor class analytics, opt-in leaderboard, report export, 99.5% uptime |
| **Kritika Mahapatra** | `PES2UG24CS239` | Test Engineer / Content & UI Dev | **9** | Material upload & limits, material search/filter, version history | Question types (MCQ/TF/Short), question contribution, instructor approval queue, subjective grading queue, ratings & comments, 5K user scale |

---

## 🎯 Agile Project Management (Jira + GitHub Workflow)

The team manages requirements, sprints, and story tracking through **Jira Software**, fully integrated with this GitHub repository via smart commits and pull requests.

- **Jira Workspace**: [CSQP Jira Project](https://harshithrreddy006.atlassian.net) (Key: `CSQP`)
- **Total Tracked Stories**: 37 stories across Practice Sprint, Sprint 1, and Sprint 2.
- **Workflow Automation**: Every feature branch and commit starts with the Jira issue key (e.g. `CSQP-7-registration`, `CSQP-7 add registration API`), automatically linking GitHub pull requests, commits, and reviews directly to the corresponding Jira story.

### 🗓️ Sprint Schedule & Roadmap

```text
 12 Oct – 16 Oct             19 Oct – 23 Oct             26 Oct – 30 Oct
 [Practice Sprint] ────────► [Sprint 1 Execution] ─────► [Sprint 2 Execution]
 • Project Scaffolding       • Auth & Security Stack     • Timed Quiz & Anti-Cheat
 • GitHub Actions CI         • Study Material Sharing    • Class Analytics & NFRs
                             • 1-Min Demo Video          • 2-Min Demo Video
```

#### 1. Practice Sprint (12 Oct 2026 – 16 Oct 2026)
* **Goal**: Technical foundation, dev environment alignment, and automated CI pipeline.
* **Key Deliverables**:
  - `CSQP-1`: Full-stack scaffolding (React SPA, Express API, MongoDB connection, health check) — *Krishna Manoj*
  - `CSQP-4`: GitHub Actions CI pipeline with automated linting and unit test execution — *Harshith R Reddy*

#### 2. Sprint 1 (19 Oct 2026 – 23 Oct 2026)
* **Goal**: Working login-to-upload vertical slice: complete authentication & RBAC, study material upload, search, and versioning.
* **Stories in Scope (16 stories)**:
  - **Auth & Security Stack (John)**: `CSQP-7` (Email registration & verification), `CSQP-8` (JWT login), `CSQP-9` (Refresh-token rotation), `CSQP-10` (RBAC middleware), `CSQP-11` (Account lockout & audit logging).
  - **Core Backend & Scaffolding (Krishna)**: `CSQP-1` (Scaffolding), `CSQP-2` (Mongoose collection schemas), `CSQP-3` (Centralized error handler & logger), `CSQP-34` (TLS 1.2+ HTTPS enforcement).
  - **CI, Testing & Analytics Skeleton (Harshith)**: `CSQP-4` (CI pipeline), `CSQP-5` (Test fixtures & seeds), `CSQP-6` (Python analytics skeleton), `CSQP-12` (Auth UI & role dashboard shell).
  - **Study Materials Engine (Kritika)**: `CSQP-13` (Material upload with size/type checks), `CSQP-14` (Multi-criteria search & filtering), `CSQP-15` (Material revision history).
* **Deliverable**: Sprint 1 Demo Video (1 minute).

#### 3. Sprint 2 (26 Oct 2026 – 30 Oct 2026)
* **Goal**: Curated question bank, timed anti-cheat quizzes with auto-grading, analytics dashboards, and non-functional requirement (NFR) validation.
* **Stories in Scope (21 stories)**:
  - **Anti-Cheat, Latency & Security Hardening (John)**: `CSQP-23` (Anti-cheat: clipboard lock & key stripping), `CSQP-24` (Single active attempt), `CSQP-31` (Password reset), `CSQP-32` (P90 latency <= 2s), `CSQP-33` (WCAG 2.1 AA compliance), `CSQP-36` (Data protection & security audit checklist).
  - **Quiz Assembly & Auto-Grading (Krishna)**: `CSQP-19` (Bulk question import via CSV/Excel), `CSQP-20` (Quiz assembly & random sampling), `CSQP-21` (Countdown timer with auto-submit), `CSQP-22` (Instant objective auto-grading).
  - **Analytics Dashboards & Reports (Harshith)**: `CSQP-27` (Student performance dashboard), `CSQP-28` (Instructor class analytics), `CSQP-29` (Opt-in leaderboard), `CSQP-30` (PDF/CSV report export), `CSQP-35` (99.5% uptime monitoring).
  - **Question Bank & Peer Review (Kritika)**: `CSQP-16` (MCQ, True/False, Short Answer types), `CSQP-17` (Student question submission), `CSQP-18` (Instructor approval queue), `CSQP-25` (Subjective answer grading queue), `CSQP-26` (Ratings & comments on materials), `CSQP-37` (5,000 user / 500 concurrent load validation).
* **Deliverable**: Sprint 2 Final Demo Video (2 minutes) + Part-2 Final Package.

---

## - Project Overview

CSQP is a standalone web application built to bridge peer-to-peer study sharing and formative self-assessment:
- **Collaborative Knowledge Sharing**: Upload, search, rate, comment on, and version study materials (PDF, DOCX, PPTX, images).
- **Curated Question Bank**: Support for MCQ, True/False, and Short-Answer questions with a student contribution & instructor approval workflow.
- **Fair & Adaptive Quizzes**: Timed quizzes with question/option randomization, copy-paste prevention, single active attempt enforcement, and instant auto-grading for objective questions.
- **Actionable Analytics**: Real-time personal progress dashboards for students, topic-wise strengths/weaknesses, and class-level analytics & exportable reports (PDF/CSV) for instructors.

---

## - Key Features

### 1. Authentication & Role-Based Access Control (RBAC)
- University email verification via time-limited OTP/link.
- Secure JWT-based session management with rotating refresh tokens (1-hour access expiry).
- Granular permissions for **Student**, **Instructor**, and **Admin** roles.
- Brute-force protection: 15-minute account lockout after 5 consecutive failed login attempts.
- Password hashing using `bcrypt` / `Argon2` with per-user salt.

### 2. Study Material Sharing & Version Control
- Multi-format file uploads (up to 25MB) categorized with subject and topic tags.
- Full-text search and multi-criteria filtering (subject, topic, uploader, rating).
- Peer review via 1–5 star ratings and interactive comments.
- Material version history retention allowing access to historical revisions.

### 3. Question Bank & Quiz Assembly
- Shared question repository tagged by subject, topic, and difficulty level.
- Bulk import/export via CSV and Excel with row-level validation.
- Peer submission workflow: student-submitted questions require instructor approval before inclusion.
- Flexible quiz generator supporting manual selection or randomized question sampling.

### 4. Quiz Attempt & Anti-Cheating Engine
- Real-time countdown timer with guaranteed auto-submission at `00:00`.
- Anti-cheating controls: randomized question and option order per attempt, disabled copy-paste, and single active session restriction.
- Instant auto-grading for objective questions (MCQ, True/False); grading queue for subjective answers.

### 5. Analytics & Reporting Engine
- **Student Dashboard**: Historical score trends, completion rates, topic mastery, and opt-in leaderboards.
- **Instructor Dashboard**: Class averages, item analysis (most-missed questions), and participation metrics.
- Report export functionality for PDF and CSV formats.

---

## - Tech Stack

- **Frontend**: React.js (Single-Page Application, Responsive Design, WCAG 2.1 AA accessible)
- **Backend API**: Node.js & Express.js (RESTful architecture, API-level RBAC, input validation)
- **Database**: MongoDB & Mongoose ODM (Document store with indexing for fast search)
- **Analytics Service**: Python (Statistical computations, data processing & report generation)
- **Security & Storage**: TLS 1.2+, JWT Auth, Bcrypt, Multer / Cloud Object Storage

---

## 📂 Repository Structure

```text
Collaborative-Student-Quiz-Platform/
├── .github/
│   ├── pull_request_template.md # Standardized PR template with Jira story & checklist
│   └── workflows/
│       ├── ci.yml              # Multi-tier CI (Node API, React SPA, Python Analytics)
│       └── pr-checks.yml       # Enforces Jira issue key format on PR titles & branches
├── client/                     # Frontend Single-Page Application (React 18 + Vite)
│   ├── public/                 # Static SVG icons and favicon
│   ├── src/
│   │   ├── api/                # Axios HTTP client configuration
│   │   ├── auth/               # AuthContext, AuthProvider, ProtectedRoute, role helpers
│   │   ├── components/         # Shared UI components (AuthLayout, FormField)
│   │   ├── hooks/              # Custom React hooks (useFocusFirstError)
│   │   ├── pages/              # Login, Register, VerifyEmail, Health, 404
│   │   │   └── dashboards/     # Role-based dashboard views (Student, Instructor, Admin)
│   │   ├── test/               # Vitest render helpers and mock auth setup
│   │   └── utils/              # Client-side form validators & college email checks
│   ├── package.json
│   └── vite.config.js
├── server/                     # Backend REST API Service (Node.js & Express 5)
│   ├── src/
│   │   ├── controllers/        # Request handlers (authController: register, verify, login, refresh)
│   │   ├── middleware/         # RBAC role authorization & IP rate limiter
│   │   ├── models/             # Mongoose schemas (User, Material, Question, Quiz, Attempt, AuditLog)
│   │   ├── routes/             # Express routers (/api/health, /api/auth, /api/users)
│   │   ├── seed/               # Initial seed dataset (questions, demo users)
│   │   ├── utils/              # Transactional mailer service (Gmail SMTP OTP & links)
│   │   ├── test-utils/         # In-memory test DB fixtures
│   │   ├── _tests_/            # Jest/Supertest automated test suites
│   │   ├── app.js              # Express app definition & middleware pipeline
│   │   ├── db.js               # MongoDB connection logic
│   │   ├── errorHandler.js     # Centralized error handler
│   │   ├── middleware.js       # Request ID & structured JSON request logger
│   │   └── server.js           # Server HTTP entrypoint
│   └── package.json
├── analytics/                  # Python Statistical & Analytics Service (FastAPI)
│   ├── app/
│   │   ├── config.py           # Configuration & internal RPC token verification
│   │   ├── main.py             # FastAPI app with /health and mock analytics endpoints
│   │   └── mock_data.py        # Student performance and class-level summary mock fixtures
│   ├── tests/                  # Pytest test suite
│   ├── pytest.ini
│   └── requirements.txt
├── docs/                       # Part-1 Specifications and Architecture Diagrams
│   ├── Team4_SAD.pdf           # Software Architecture & Design Document
│   ├── Team4_TestPlan.pdf      # Software Test Plan (STP)
│   ├── component_diagram.png   # System component architecture diagram
│   ├── sequence_diagram_approval.png
│   └── sequence_diagram_quiz.png
├── .gitignore                  # Global git ignore configuration
└── README.md                   # Project overview, agile sprint tracking & directory structure
```

---

## - Getting Started (Development Setup)

### Prerequisites
- Node.js (v18+ recommended) & npm / yarn
- Python 3.10+
- MongoDB instance (local or MongoDB Atlas)
