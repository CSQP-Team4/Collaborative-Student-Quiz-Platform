"""Tests for the student performance dashboard data (CSQP-27 / TC-Perf-01)."""

from fastapi.testclient import TestClient

from app import config
from app.main import app

client = TestClient(app)


def attempt(attempt_id, when, score, total, questions, title="Quiz"):
    return {
        "attemptId": attempt_id,
        "quizId": f"quiz-{attempt_id}",
        "quizTitle": title,
        "subject": "Data Structures",
        "submittedAt": when,
        "score": score,
        "totalQuestions": total,
        "questions": [{"topic": t, "correct": c} for t, c in questions],
    }


ATTEMPTS = [
    # Sent out of order on purpose: the trend must be sorted by date.
    attempt("a2", "2026-10-21T10:00:00Z", 3, 4,
            [("Trees", True), ("Trees", True), ("Graphs", False), ("Sorting", True)], "Quiz 2"),
    attempt("a1", "2026-10-19T10:00:00Z", 2, 4,
            [("Trees", True), ("Graphs", False), ("Graphs", False), ("Sorting", True)], "Quiz 1"),
    attempt("a3", "2026-10-23T10:00:00Z", 4, 4,
            [("Trees", True), ("Graphs", True), ("Sorting", True), ("Sorting", False)], "Quiz 3"),
]


def summary(attempts, student_id="s-1"):
    res = client.post("/api/students/summary", json={"studentId": student_id, "attempts": attempts})
    assert res.status_code == 200, res.text
    return res.json()


def test_empty_history():
    body = summary([])
    assert body["studentId"] == "s-1"
    assert body["attemptsCompleted"] == 0
    assert body["averageScore"] is None
    assert body["history"] == [] and body["scoreTrend"] == [] and body["topics"] == []


def test_totals_match_manual_calculation():
    body = summary(ATTEMPTS)
    assert body["attemptsCompleted"] == 3
    # 50%, 75%, 100% -> mean 75.0
    assert body["averageScore"] == 75.0
    assert body["bestScore"] == 100.0
    assert body["latestScore"] == 100.0


def test_trend_is_oldest_first_and_history_newest_first():
    body = summary(ATTEMPTS)
    assert [p["attemptId"] for p in body["scoreTrend"]] == ["a1", "a2", "a3"]
    assert [p["percentage"] for p in body["scoreTrend"]] == [50.0, 75.0, 100.0]
    assert [h["attemptId"] for h in body["history"]] == ["a3", "a2", "a1"]
    assert body["history"][0]["quizTitle"] == "Quiz 3"


def test_topic_strengths_and_weaknesses():
    body = summary(ATTEMPTS)
    topics = {t["topic"]: t for t in body["topics"]}
    # Trees 4/4, Sorting 3/4 (exactly on the 75% strength boundary), Graphs 1/4
    assert topics["Trees"] == {"topic": "Trees", "answered": 4, "correct": 4,
                               "mastery": 1.0, "status": "strength"}
    assert topics["Sorting"]["mastery"] == 0.75 and topics["Sorting"]["status"] == "strength"
    assert topics["Graphs"]["mastery"] == 0.25 and topics["Graphs"]["status"] == "weakness"
    assert body["strengths"] == ["Trees", "Sorting"]
    assert body["weaknesses"] == ["Graphs"]
    # Strongest topic first
    assert body["topics"][0]["topic"] == "Trees"


def test_zero_question_attempt_does_not_divide_by_zero():
    body = summary([attempt("a1", "2026-10-19T10:00:00Z", 0, 0, [])])
    assert body["averageScore"] == 0.0
    assert body["topics"] == []


def test_rejects_invalid_payload():
    res = client.post("/api/students/summary", json={"attempts": "nope"})
    assert res.status_code == 422


def test_summary_requires_internal_token_when_configured(monkeypatch):
    monkeypatch.setattr(config, "INTERNAL_API_TOKEN", "secret-123")
    payload = {"studentId": "s-1", "attempts": []}
    assert client.post("/api/students/summary", json=payload).status_code == 401
    ok = client.post("/api/students/summary", json=payload,
                     headers={"X-Internal-Token": "secret-123"})
    assert ok.status_code == 200
