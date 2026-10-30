"""Exportable reports (CSQP-30 / CSQP-F-043, SAD 3.6).

PDF is generated with reportlab and CSV with pandas. Every report is built
from the same summary functions that feed the dashboards (CSQP-27, CSQP-28),
so the exported file always matches the on-screen data at export time.
"""

from __future__ import annotations

import io
from datetime import datetime, timezone

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ACCENT = colors.HexColor("#3446c8")
MUTED = colors.HexColor("#5d6273")
GRID = colors.HexColor("#d9dce3")
STATUS_LABEL = {"strength": "Strength", "average": "Getting there", "weakness": "Needs work"}


def _fmt_pct(value) -> str:
    return "-" if value is None else f"{value:g}%"


def _fmt_date(iso: str) -> str:
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%d %b %Y %H:%M")


def _generated_at() -> str:
    return datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")


# ---------------- CSV (pandas) ----------------

def _sections_to_csv(sections: list[tuple[str, pd.DataFrame]]) -> bytes:
    """Several titled tables in one CSV file, separated by a blank line."""
    out = io.StringIO()
    for i, (title, frame) in enumerate(sections):
        if i:
            out.write("\n")
        out.write(f"{title}\n")
        frame.to_csv(out, index=False)
    # UTF-8 BOM so Excel opens non-ASCII text correctly
    return ("﻿" + out.getvalue()).encode("utf-8")


def student_report_csv(summary: dict, student_name: str) -> bytes:
    overview = pd.DataFrame(
        [
            {"Student": student_name, "Quizzes completed": summary["attemptsCompleted"],
             "Average score (%)": summary["averageScore"], "Best score (%)": summary["bestScore"],
             "Latest score (%)": summary["latestScore"]}
        ]
    )
    history = pd.DataFrame(
        [
            {"Quiz": h["quizTitle"], "Subject": h["subject"], "Submitted (UTC)": _fmt_date(h["submittedAt"]),
             "Score": h["score"], "Total questions": h["totalQuestions"], "Percentage": h["percentage"]}
            for h in summary["history"]
        ],
        columns=["Quiz", "Subject", "Submitted (UTC)", "Score", "Total questions", "Percentage"],
    )
    topics = pd.DataFrame(
        [
            {"Topic": t["topic"], "Correct": t["correct"], "Answered": t["answered"],
             "Mastery (%)": round(t["mastery"] * 100), "Status": STATUS_LABEL[t["status"]]}
            for t in summary["topics"]
        ],
        columns=["Topic", "Correct", "Answered", "Mastery (%)", "Status"],
    )
    return _sections_to_csv([("Summary", overview), ("Quiz history", history), ("Topics", topics)])


def class_report_csv(summary: dict) -> bytes:
    overview = pd.DataFrame(
        [
            {"Quiz": q["title"], "Subject": q["subject"], "Questions": q["questionCount"],
             "Participants": q["participants"], "Students": q["totalStudents"],
             "Participation (%)": round(q["participationRate"] * 100),
             "Average score (%)": q["averageScore"], "Highest (%)": q["highestScore"],
             "Lowest (%)": q["lowestScore"], "Total attempts": q["totalAttempts"]}
            for q in summary["quizzes"]
        ],
        columns=["Quiz", "Subject", "Questions", "Participants", "Students", "Participation (%)",
                 "Average score (%)", "Highest (%)", "Lowest (%)", "Total attempts"],
    )
    missed = pd.DataFrame(
        [
            {"Quiz": q["title"], "Question": m["text"], "Topic": m["topic"], "Missed": m["missed"],
             "Attempted": m["attempted"], "Correct (%)": round(m["correctRate"] * 100)}
            for q in summary["quizzes"]
            for m in q["mostMissedQuestions"]
        ],
        columns=["Quiz", "Question", "Topic", "Missed", "Attempted", "Correct (%)"],
    )
    return _sections_to_csv([("Quizzes", overview), ("Most-missed questions", missed)])


# ---------------- PDF (reportlab) ----------------

def _table(rows: list[list], col_widths: list[float]) -> Table:
    styles = getSampleStyleSheet()
    cell = styles["BodyText"].clone("cell", fontSize=9, leading=11)
    head = cell.clone("head", textColor=colors.white, fontName="Helvetica-Bold")
    data = [[Paragraph(str(v), head) for v in rows[0]]] + [
        [Paragraph(str(v), cell) for v in r] for r in rows[1:]
    ]
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f6f8")]),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, GRID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def _build_pdf(title: str, subtitle: str, body: list) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=title, author="CSQP",
                            leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    brand = styles["Normal"].clone("brand", textColor=ACCENT, fontName="Helvetica-Bold", fontSize=10)
    meta = styles["Normal"].clone("meta", textColor=MUTED, fontSize=9)
    story = [
        Paragraph("CSQP - Collaborative Study Material &amp; Quiz Platform", brand),
        Spacer(1, 4),
        Paragraph(title, styles["Title"]),
        Paragraph(subtitle, meta),
        Paragraph(f"Generated {_generated_at()}", meta),
        Spacer(1, 10),
        *body,
    ]
    doc.build(story)
    return buf.getvalue()


def _escape(text) -> str:
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def student_report_pdf(summary: dict, student_name: str) -> bytes:
    styles = getSampleStyleSheet()
    h2 = styles["Heading2"]
    width = A4[0] - 36 * mm
    body: list = []

    if summary["attemptsCompleted"] == 0:
        body.append(Paragraph("No quizzes completed yet.", styles["BodyText"]))
    else:
        body += [
            _table(
                [["Quizzes completed", "Average score", "Best score", "Latest score"],
                 [summary["attemptsCompleted"], _fmt_pct(summary["averageScore"]),
                  _fmt_pct(summary["bestScore"]), _fmt_pct(summary["latestScore"])]],
                [width / 4] * 4,
            ),
            Spacer(1, 12),
            Paragraph("Topics", h2),
        ]
        if summary["weaknesses"]:
            body.append(Paragraph(f"Study next: <b>{_escape(', '.join(summary['weaknesses']))}</b>",
                                  styles["BodyText"]))
            body.append(Spacer(1, 4))
        body += [
            _table(
                [["Topic", "Correct", "Mastery", "Status"]]
                + [[_escape(t["topic"]), f"{t['correct']} of {t['answered']}", f"{round(t['mastery'] * 100)}%",
                    STATUS_LABEL[t["status"]]] for t in summary["topics"]],
                [width * 0.4, width * 0.2, width * 0.15, width * 0.25],
            ),
            Spacer(1, 12),
            Paragraph("Quiz history", h2),
            _table(
                [["Quiz", "Subject", "Submitted (UTC)", "Score"]]
                + [[_escape(h["quizTitle"]), _escape(h["subject"]), _fmt_date(h["submittedAt"]),
                    f"{h['score']}/{h['totalQuestions']} ({h['percentage']:g}%)"] for h in summary["history"]],
                [width * 0.35, width * 0.25, width * 0.2, width * 0.2],
            ),
        ]
    return _build_pdf("Student performance report", _escape(student_name), body)


def class_report_pdf(summary: dict, instructor_name: str) -> bytes:
    styles = getSampleStyleSheet()
    width = A4[0] - 36 * mm
    body: list = []
    if not summary["quizzes"]:
        body.append(Paragraph("No quizzes yet.", styles["BodyText"]))
    for q in summary["quizzes"]:
        body += [
            Paragraph(_escape(q["title"]), styles["Heading2"]),
            Paragraph(f"{_escape(q['subject'])} - {q['questionCount']} questions", styles["BodyText"]),
            Spacer(1, 4),
        ]
        if q["participants"] == 0:
            body += [Paragraph("No students have submitted this quiz yet.", styles["BodyText"]), Spacer(1, 10)]
            continue
        body += [
            _table(
                [["Class average", "Participation", "Score range", "Total attempts"],
                 [_fmt_pct(q["averageScore"]),
                  f"{round(q['participationRate'] * 100)}% ({q['participants']} of {q['totalStudents']})",
                  f"{q['lowestScore']:g}-{q['highestScore']:g}%", q["totalAttempts"]]],
                [width / 4] * 4,
            ),
            Spacer(1, 8),
        ]
        if q["mostMissedQuestions"]:
            body.append(
                _table(
                    [["Most-missed question", "Topic", "Missed by", "Correct"]]
                    + [[_escape(m["text"]), _escape(m["topic"]), f"{m['missed']} of {m['attempted']}",
                        f"{round(m['correctRate'] * 100)}%"] for m in q["mostMissedQuestions"]],
                    [width * 0.55, width * 0.17, width * 0.15, width * 0.13],
                )
            )
        body.append(Spacer(1, 14))
    return _build_pdf("Class analytics report", f"Instructor: {_escape(instructor_name)}", body)
