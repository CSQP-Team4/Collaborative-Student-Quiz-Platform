"""Student performance dashboard data (CSQP-27 / CSQP-F-040, SAD 3.4).

The Express API sends this service a student's completed attempts, already
graded per question (Express owns the answer keys, which never leave it).
This module turns them into quiz history, a score trend and topic-wise
strengths and weaknesses using pandas.
"""

from __future__ import annotations

from datetime import datetime

import pandas as pd
from pydantic import BaseModel, Field

# A topic counts as a strength at >= 75% correct and a weakness below 50%.
STRENGTH_THRESHOLD = 0.75
WEAKNESS_THRESHOLD = 0.50


class QuestionResult(BaseModel):
    topic: str = "General"
    correct: bool


class AttemptIn(BaseModel):
    attemptId: str
    quizId: str
    quizTitle: str = "Quiz"
    subject: str = ""
    submittedAt: datetime
    score: int = Field(ge=0)
    totalQuestions: int = Field(ge=0)
    questions: list[QuestionResult] = []


class StudentSummaryRequest(BaseModel):
    studentId: str
    attempts: list[AttemptIn] = []


def _percentage(score: int, total: int) -> float:
    return round(score * 100 / total, 1) if total else 0.0


def _topic_status(mastery: float) -> str:
    if mastery >= STRENGTH_THRESHOLD:
        return "strength"
    if mastery < WEAKNESS_THRESHOLD:
        return "weakness"
    return "average"


def build_student_summary(req: StudentSummaryRequest) -> dict:
    """Return the payload shown on the student performance dashboard."""
    empty = {
        "studentId": req.studentId,
        "attemptsCompleted": 0,
        "averageScore": None,
        "bestScore": None,
        "latestScore": None,
        "history": [],
        "scoreTrend": [],
        "topics": [],
        "strengths": [],
        "weaknesses": [],
    }
    if not req.attempts:
        return empty

    attempts = pd.DataFrame(
        [
            {
                "attemptId": a.attemptId,
                "quizId": a.quizId,
                "quizTitle": a.quizTitle,
                "subject": a.subject,
                "submittedAt": pd.Timestamp(a.submittedAt),
                "score": a.score,
                "totalQuestions": a.totalQuestions,
                "percentage": _percentage(a.score, a.totalQuestions),
            }
            for a in req.attempts
        ]
    ).sort_values("submittedAt", kind="stable")

    def to_iso(ts: pd.Timestamp) -> str:
        return ts.isoformat()

    trend = [
        {
            "attemptId": row.attemptId,
            "quizTitle": row.quizTitle,
            "date": to_iso(row.submittedAt),
            "percentage": float(row.percentage),
        }
        for row in attempts.itertuples()
    ]

    history = [
        {
            "attemptId": row.attemptId,
            "quizId": row.quizId,
            "quizTitle": row.quizTitle,
            "subject": row.subject,
            "submittedAt": to_iso(row.submittedAt),
            "score": int(row.score),
            "totalQuestions": int(row.totalQuestions),
            "percentage": float(row.percentage),
        }
        for row in attempts.iloc[::-1].itertuples()  # newest first
    ]

    topics: list[dict] = []
    rows = [
        {"topic": (q.topic or "General").strip() or "General", "correct": int(q.correct)}
        for a in req.attempts
        for q in a.questions
    ]
    if rows:
        per_topic = (
            pd.DataFrame(rows)
            .groupby("topic")["correct"]
            .agg(answered="count", correct="sum")
            .reset_index()
        )
        per_topic["mastery"] = (per_topic["correct"] / per_topic["answered"]).round(2)
        per_topic = per_topic.sort_values(["mastery", "topic"], ascending=[False, True])
        topics = [
            {
                "topic": row.topic,
                "answered": int(row.answered),
                "correct": int(row.correct),
                "mastery": float(row.mastery),
                "status": _topic_status(float(row.mastery)),
            }
            for row in per_topic.itertuples()
        ]

    return {
        **empty,
        "attemptsCompleted": int(len(attempts)),
        "averageScore": round(float(attempts["percentage"].mean()), 1),
        "bestScore": float(attempts["percentage"].max()),
        "latestScore": float(attempts["percentage"].iloc[-1]),
        "history": history,
        "scoreTrend": trend,
        "topics": topics,
        "strengths": [t["topic"] for t in topics if t["status"] == "strength"],
        "weaknesses": [t["topic"] for t in topics if t["status"] == "weakness"],
    }
