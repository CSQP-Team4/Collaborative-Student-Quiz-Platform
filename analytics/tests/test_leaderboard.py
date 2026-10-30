"""Tests for the opt-in leaderboard ranking (CSQP-29 / TC-Perf-03)."""

from fastapi.testclient import TestClient

from app import config
from app.main import app

client = TestClient(app)


def att(student, name, quiz, score, total=4, when="2026-10-20T10:00:00Z"):
    return {"studentId": student, "studentName": name, "quizId": quiz,
            "submittedAt": when, "score": score, "totalQuestions": total}


def board(attempts, scope="quiz", label="Quiz A"):
    res = client.post("/api/leaderboard", json={"scope": scope, "label": label, "attempts": attempts})
    assert res.status_code == 200, res.text
    return res.json()


def test_empty_leaderboard():
    assert board([]) == {"scope": "quiz", "label": "Quiz A", "entries": []}


def test_per_quiz_uses_best_attempt():
    body = board([
        att("s1", "Asha", "qa", 1),  # 25%
        att("s1", "Asha", "qa", 3),  # 75% <- best
        att("s2", "Kiran", "qa", 2),  # 50%
    ])
    assert [(e["rank"], e["name"], e["score"], e["attempts"]) for e in body["entries"]] == [
        (1, "Asha", 75.0, 2),
        (2, "Kiran", 50.0, 1),
    ]


def test_ties_share_a_rank_and_sort_by_name():
    body = board([
        att("s1", "Zoya", "qa", 4),
        att("s2", "Arun", "qa", 4),
        att("s3", "Meera", "qa", 2),
    ])
    assert [(e["rank"], e["name"]) for e in body["entries"]] == [(1, "Arun"), (1, "Zoya"), (3, "Meera")]


def test_per_subject_averages_best_score_per_quiz():
    # Asha: qa best 100, qb 50 -> 75.0 over 2 quizzes; Kiran: qa 75 only -> 75.0 over 1 quiz
    body = board([
        att("s1", "Asha", "qa", 2),
        att("s1", "Asha", "qa", 4),
        att("s1", "Asha", "qb", 2),
        att("s2", "Kiran", "qa", 3),
    ], scope="subject", label="Data Structures")
    entries = {e["name"]: e for e in body["entries"]}
    assert body["scope"] == "subject" and body["label"] == "Data Structures"
    assert entries["Asha"]["score"] == 75.0 and entries["Asha"]["quizzes"] == 2
    assert entries["Kiran"]["score"] == 75.0 and entries["Kiran"]["quizzes"] == 1
    assert entries["Asha"]["rank"] == entries["Kiran"]["rank"] == 1


def test_only_students_sent_are_ranked():
    # Express filters out students who opted out; nobody else can appear.
    body = board([att("s1", "Asha", "qa", 3)])
    assert [e["studentId"] for e in body["entries"]] == ["s1"]


def test_rejects_unknown_scope():
    res = client.post("/api/leaderboard", json={"scope": "school", "attempts": []})
    assert res.status_code == 422


def test_requires_internal_token_when_configured(monkeypatch):
    monkeypatch.setattr(config, "INTERNAL_API_TOKEN", "secret-123")
    assert client.post("/api/leaderboard", json={}).status_code == 401
    assert client.post("/api/leaderboard", json={}, headers={"X-Internal-Token": "secret-123"}).status_code == 200
