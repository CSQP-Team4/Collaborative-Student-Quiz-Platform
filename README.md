# Collaborative Study Material & Quiz Platform (CSQP)

[![Repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/CSQP-Team4/Collaborative-Student-Quiz-Platform)
[![Stack](https://img.shields.io/badge/Stack-MERN%20%2B%20Python-green)](#tech-stack)
[![SRS Version](https://img.shields.io/badge/SRS-v1.0-orange)](docs/)

A full-stack collaborative learning and assessment platform designed for students and educators. CSQP allows students to share, version, and review study materials, contribute questions to a centralized question bank, attempt timed and anti-cheat protected quizzes, and gain actionable learning insights through performance analytics.

---

## - Team 4 - Contributions

| Name | SRN | Contribution Area |
| :--- | :--- | :--- |
| **Harshith R Reddy** | `PES2UG24CS188` | Introduction & External Interface Requirements |
| **Kritika Mahapatra** | `PES2UG24CS239` | Overall Description & UML Use-Case Diagrams |
| **Krishna Manoj** | `PES2UG24CS236` | System Features (Functional Requirements), Quality Attributes & Acceptance Tests |
| **John S Thomas** | `PES2UG24CS207` | Non-Functional Requirements, Security & Requirements Traceability Matrix (RTM) |

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

## - Repository Structure

```text
Collaborative-Student-Quiz-Platform/
├── client/              # React frontend application (SPA)
├── server/              # Node.js & Express REST API backend
├── analytics/           # Python analytics & report generation service
├── docs/                # Architecture diagrams, SRS specifications & API docs
├── .gitignore           # Global git ignore rules
└── README.md            # Project overview and documentation
```

---

## - Getting Started (Development Setup)

### Prerequisites
- Node.js (v18+ recommended) & npm / yarn
- Python 3.10+
- MongoDB instance (local or MongoDB Atlas)
