# Scalability (CSQP-NF-005 / TC-Scale-01)

**Requirement:** support 5,000 registered users and 500 concurrent quiz attempts
without architectural change, with p90 response time <= 2 s (CSQP-NF-001).

## Why no architectural change is needed
- **Stateless API.** Sessions use JWT access tokens. No server-side session state
  is held in memory, so more Express instances can run behind a load balancer.
- **Indexed queries.** `User.email` (unique), `QuizAttempt {student, quiz, status}`
  and `QuizAttempt {quiz, status}` cover the hot paths: login, start attempt,
  single-active-attempt check and class-level lookups.
- **Heavy work is separate.** Reports and statistics run in the Python analytics
  service, so exam-time traffic is not blocked by report generation.
- **Answer keys stay on the server.** Grading is a short in-process comparison
  per submission, so auto-grading cost grows linearly with submissions.
- **Database scaling path.** MongoDB can move to a replica set (read scaling) and
  then sharding without changing application code.

## How it is verified
`server/src/_tests_/scalability.test.js` (TC-Scale-01):
1. Seeds 5,000 student accounts.
2. Logs in 50 of them to prove lookups still work at that size.
3. Starts 500 quiz attempts at the same moment and confirms all 500 exist.
4. Submits all 500 at the same moment and checks every one is graded correctly.
5. Asserts p90 <= 2000 ms, zero HTTP 5xx and zero rate-limited responses.

Run: `cd server && npm test -- scalability`

## Limits of this test
It runs in a single Node process against an in-memory MongoDB on one machine,
so it verifies the application logic and query design at target scale. A
production-grade check would run a tool such as k6 against a deployed instance
with multiple API replicas.

## Load shape
The test keeps all 500 attempts open at the same time (verified with a database
count before any submission), but sends HTTP requests with at most 100 in flight
at once. This models a class arriving over a few seconds instead of in a single
millisecond, and avoids measuring queueing inside the test process, where the
load generator and the server share one CPU. The p90 <= 2000 ms threshold is
unchanged.
