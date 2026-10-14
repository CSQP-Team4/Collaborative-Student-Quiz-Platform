"""Canned responses for the mock endpoints.

The Test Plan (STP 10) says to mock the analytics endpoints during API
functional testing so the Node API can be tested without real computations.
These shapes match what the real endpoints will return in Sprint 2
(CSQP-F-040 student dashboard, CSQP-F-041 class analytics).
"""


def student_summary(student_id: str) -> dict:
    return {
        "studentId": student_id,
        "mock": True,
        "attemptsCompleted": 4,
        "averageScore": 72.5,
        "scoreTrend": [
            {"quizId": "q1", "date": "2026-10-19", "score": 60.0},
            {"quizId": "q2", "date": "2026-10-21", "score": 70.0},
            {"quizId": "q3", "date": "2026-10-23", "score": 75.0},
            {"quizId": "q4", "date": "2026-10-26", "score": 85.0},
        ],
        "topics": [
            {"topic": "Trees", "mastery": 0.82, "status": "strength"},
            {"topic": "Graphs", "mastery": 0.48, "status": "weakness"},
            {"topic": "Sorting", "mastery": 0.70, "status": "average"},
        ],
    }


def class_summary(quiz_id: str) -> dict:
    return {
        "quizId": quiz_id,
        "mock": True,
        "averageScore": 68.4,
        "participationRate": 0.85,
        "mostMissedQuestions": [
            {"questionId": "qn-12", "correctRate": 0.21},
            {"questionId": "qn-07", "correctRate": 0.34},
            {"questionId": "qn-03", "correctRate": 0.40},
        ],
    }
