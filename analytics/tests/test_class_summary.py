"""Tests for instructor class analytics (CSQP-28 / TC-Perf-02).

Expected numbers are worked out by hand in the comments, as the AC asks
("match manually verified totals").
"""

from fastapi.testclient import TestClient

from app import config
from app.main import app

client = TestClient(app)


def graded(*marks):
    """marks: tuples of (questionId, correct)."""
    return [{"questionId": q, "text": f"Question {q}", "topic": "Trees" if q in ("q1", "q2") else "Graphs",
             "correct": c} for q, c in marks]


def att(student, quiz, when, marks):
    qs = graded(*marks)
    return {"studentId": student, "quizId": quiz, "submittedAt": when,
            "score": sum(1 for q in qs if q["correct"]), "totalQuestions": len(qs), "questions": qs}


QUIZZES = [
    {"quizId": "quiz-a", "title": "Trees and Graphs", "subject": "DSA", "questionCount": 4},
    {"quizId": "quiz-b", "title": "Unattempted quiz", "subject": "DSA", "questionCount": 3},
]

ATTEMPTS = [
    # s1 retakes: first try 1/4 (ignored), latest 3/4 -> 75%
    att("s1", "quiz-a", "2026-10-20T10:00:00Z", [("q1", True), ("q2", False), ("q3", False), ("q4", False)]),
    att("s1", "quiz-a", "2026-10-22T10:00:00Z", [("q1", True), ("q2", True), ("q3", True), ("q4", False)]),
    # s2: 2/4 -> 50%
    att("s2", "quiz-a", "2026-10-21T10:00:00Z", [("q1", True), ("q2", True), ("q3", False), ("q4", False)]),
    # s3: 4/4 -> 100%
    att("s3", "quiz-a", "2026-10-21T11:00:00Z", [("q1", True), ("q2", True), ("q3", True), ("q4", True)]),
]


def summary(total_students=5, quizzes=QUIZZES, attempts=ATTEMPTS):
    res = client.post("/api/quizzes/class-summary",
                      json={"totalStudents": total_students, "quizzes": quizzes, "attempts": attempts})
    assert res.status_code == 200, res.text
    return res.json()


def test_totals_match_manual_calculation():
    quiz = summary()["quizzes"][0]
    assert quiz["quizId"] == "quiz-a"
    # 3 of 5 students took it
    assert quiz["participants"] == 3
    assert quiz["participationRate"] == 0.6
    assert quiz["totalAttempts"] == 4
    # latest attempts only: (75 + 50 + 100) / 3 = 75.0
    assert quiz["averageScore"] == 75.0
    assert quiz["highestScore"] == 100.0
    assert quiz["lowestScore"] == 50.0


def test_most_missed_questions():
    missed = summary()["quizzes"][0]["mostMissedQuestions"]
    # Latest attempts: q4 right 1/3, q3 right 2/3, q1 and q2 right 3/3 (never missed -> not listed)
    assert [m["questionId"] for m in missed] == ["q4", "q3"]
    assert missed[0] == {"questionId": "q4", "text": "Question q4", "topic": "Graphs",
                         "attempted": 3, "missed": 2, "correctRate": 0.33}
    assert missed[1]["correctRate"] == 0.67 and missed[1]["missed"] == 1


def test_quiz_with_no_attempts():
    quiz = summary()["quizzes"][1]
    assert quiz["title"] == "Unattempted quiz"
    assert quiz["participants"] == 0 and quiz["participationRate"] == 0.0
    assert quiz["averageScore"] is None
    assert quiz["mostMissedQuestions"] == []


def test_recomputes_after_a_new_submission():
    before = summary()["quizzes"][0]
    new = att("s4", "quiz-a", "2026-10-23T09:00:00Z", [("q1", False), ("q2", False), ("q3", False), ("q4", False)])
    after = summary(attempts=ATTEMPTS + [new])["quizzes"][0]
    assert before["participants"] == 3 and after["participants"] == 4
    # (75 + 50 + 100 + 0) / 4 = 56.25 -> 56.2 (round half to even)
    assert after["averageScore"] == 56.2
    assert after["participationRate"] == 0.8


def test_no_students_does_not_divide_by_zero():
    body = summary(total_students=0)
    assert body["quizzes"][0]["participationRate"] == 0.0


def test_most_missed_is_capped_at_five():
    marks = [(f"x{i}", False) for i in range(8)]
    body = summary(quizzes=[{"quizId": "big", "title": "Big"}], attempts=[att("s1", "big", "2026-10-20T10:00:00Z", marks)])
    assert len(body["quizzes"][0]["mostMissedQuestions"]) == 5


def test_requires_internal_token_when_configured(monkeypatch):
    monkeypatch.setattr(config, "INTERNAL_API_TOKEN", "secret-123")
    payload = {"totalStudents": 0}
    assert client.post("/api/quizzes/class-summary", json=payload).status_code == 401
    ok = client.post("/api/quizzes/class-summary", json=payload, headers={"X-Internal-Token": "secret-123"})
    assert ok.status_code == 200
