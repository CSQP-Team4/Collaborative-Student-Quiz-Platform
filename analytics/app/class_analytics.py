"""Instructor class analytics (CSQP-28 / CSQP-F-041, SAD 3.3).

For each quiz: average score, participation rate and the most-missed
questions. Express sends the graded attempts (correct/incorrect per
question, never the answer keys); this module aggregates them with pandas.

Rules (so totals can be checked by hand, TC-Perf-02):
- Each student counts once per quiz, using their LATEST submitted attempt,
  so retakes do not skew the class average.
- Participation rate = students with a submitted attempt / students in the class.
- A question's correct rate = students who got it right / students who saw it.
"""

from __future__ import annotations

from datetime import datetime

import pandas as pd
from pydantic import BaseModel, Field

MOST_MISSED_LIMIT = 5


class GradedQuestion(BaseModel):
    questionId: str
    text: str = ""
    topic: str = "General"
    correct: bool


class ClassAttempt(BaseModel):
    studentId: str
    quizId: str
    submittedAt: datetime
    score: int = Field(ge=0)
    totalQuestions: int = Field(ge=0)
    questions: list[GradedQuestion] = []


class QuizInfo(BaseModel):
    quizId: str
    title: str = "Quiz"
    subject: str = ""
    questionCount: int = Field(default=0, ge=0)


class ClassSummaryRequest(BaseModel):
    totalStudents: int = Field(ge=0)
    quizzes: list[QuizInfo] = []
    attempts: list[ClassAttempt] = []


def _empty_quiz(quiz: QuizInfo, total_students: int) -> dict:
    return {
        "quizId": quiz.quizId,
        "title": quiz.title,
        "subject": quiz.subject,
        "questionCount": quiz.questionCount,
        "totalStudents": total_students,
        "participants": 0,
        "participationRate": 0.0,
        "totalAttempts": 0,
        "averageScore": None,
        "highestScore": None,
        "lowestScore": None,
        "mostMissedQuestions": [],
    }


def build_class_summary(req: ClassSummaryRequest) -> dict:
    """Return one summary per quiz, in the order the quizzes were given."""
    by_quiz: dict[str, list[ClassAttempt]] = {}
    for a in req.attempts:
        by_quiz.setdefault(a.quizId, []).append(a)

    results = []
    for quiz in req.quizzes:
        summary = _empty_quiz(quiz, req.totalStudents)
        attempts = by_quiz.get(quiz.quizId, [])
        if not attempts:
            results.append(summary)
            continue

        frame = pd.DataFrame(
            [
                {
                    "idx": i,
                    "studentId": a.studentId,
                    "submittedAt": pd.Timestamp(a.submittedAt),
                    "percentage": (a.score * 100 / a.totalQuestions) if a.totalQuestions else 0.0,
                }
                for i, a in enumerate(attempts)
            ]
        )
        latest = frame.sort_values("submittedAt", kind="stable").groupby("studentId").tail(1)
        participants = int(len(latest))

        rows = [
            {
                "questionId": q.questionId,
                "text": q.text,
                "topic": q.topic,
                "correct": int(q.correct),
            }
            for i in latest["idx"]
            for q in attempts[int(i)].questions
        ]
        most_missed: list[dict] = []
        if rows:
            per_q = (
                pd.DataFrame(rows)
                .groupby("questionId")
                .agg(text=("text", "first"), topic=("topic", "first"),
                     attempted=("correct", "count"), correctCount=("correct", "sum"))
                .reset_index()
            )
            per_q["correctRate"] = (per_q["correctCount"] / per_q["attempted"]).round(2)
            per_q = per_q[per_q["correctCount"] < per_q["attempted"]]  # only questions someone missed
            per_q = per_q.sort_values(["correctRate", "attempted", "questionId"],
                                      ascending=[True, False, True]).head(MOST_MISSED_LIMIT)
            most_missed = [
                {
                    "questionId": r.questionId,
                    "text": r.text,
                    "topic": r.topic,
                    "attempted": int(r.attempted),
                    "missed": int(r.attempted - r.correctCount),
                    "correctRate": float(r.correctRate),
                }
                for r in per_q.itertuples()
            ]

        summary.update(
            {
                "participants": participants,
                "participationRate": (
                    round(min(participants / req.totalStudents, 1.0), 2) if req.totalStudents else 0.0
                ),
                "totalAttempts": len(attempts),
                "averageScore": round(float(latest["percentage"].mean()), 1),
                "highestScore": round(float(latest["percentage"].max()), 1),
                "lowestScore": round(float(latest["percentage"].min()), 1),
                "mostMissedQuestions": most_missed,
            }
        )
        results.append(summary)

    return {"totalStudents": req.totalStudents, "quizzes": results}
