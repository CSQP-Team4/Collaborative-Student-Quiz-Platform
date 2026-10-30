"""Opt-in leaderboard (CSQP-29 / CSQP-F-042).

Express only ever sends attempts of students who opted in, so students who
opted out cannot appear here. Ranking rules:

- Per quiz: each student's BEST percentage on that quiz.
- Per subject: the average of each student's best percentage on every quiz
  they took in that subject.
- Ties share a rank (1, 1, 3) and are listed alphabetically.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

import pandas as pd
from pydantic import BaseModel, Field


class LeaderboardAttempt(BaseModel):
    studentId: str
    studentName: str = "Student"
    quizId: str
    submittedAt: datetime
    score: int = Field(ge=0)
    totalQuestions: int = Field(ge=0)


class LeaderboardRequest(BaseModel):
    scope: Literal["quiz", "subject"] = "quiz"
    label: str = ""
    attempts: list[LeaderboardAttempt] = []


def build_leaderboard(req: LeaderboardRequest) -> dict:
    result = {"scope": req.scope, "label": req.label, "entries": []}
    if not req.attempts:
        return result

    frame = pd.DataFrame(
        [
            {
                "studentId": a.studentId,
                "studentName": a.studentName,
                "quizId": a.quizId,
                "percentage": (a.score * 100 / a.totalQuestions) if a.totalQuestions else 0.0,
            }
            for a in req.attempts
        ]
    )

    best_per_quiz = (
        frame.groupby(["studentId", "quizId"])
        .agg(studentName=("studentName", "first"), best=("percentage", "max"), attempts=("percentage", "count"))
        .reset_index()
    )
    per_student = (
        best_per_quiz.groupby("studentId")
        .agg(studentName=("studentName", "first"), score=("best", "mean"),
             quizzes=("quizId", "nunique"), attempts=("attempts", "sum"))
        .reset_index()
    )
    per_student["score"] = per_student["score"].round(1)
    per_student = per_student.sort_values(["score", "studentName"], ascending=[False, True], kind="stable")
    per_student["rank"] = per_student["score"].rank(method="min", ascending=False).astype(int)

    result["entries"] = [
        {
            "rank": int(r.rank),
            "studentId": r.studentId,
            "name": r.studentName,
            "score": float(r.score),
            "quizzes": int(r.quizzes),
            "attempts": int(r.attempts),
        }
        for r in per_student.itertuples()
    ]
    return result
