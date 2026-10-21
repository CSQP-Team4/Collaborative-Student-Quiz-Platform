# CSQP Server (Node + Express + MongoDB)

## Run

```bash
cd server
npm install
cp .env.example .env     # set MONGODB_URI
npm run dev              # http://localhost:5000, health: /api/health
```

## Seed data (CSQP-5)

```bash
npm run seed
```

Replaces **all** data in the `MONGODB_URI` database with known test data
(refuses to run when `NODE_ENV=production`):

| Data | Count | Notes |
| --- | --- | --- |
| Users | 5 | `admin@pes.edu`, `instructor@pes.edu`, `student@pes.edu`, `student2@pes.edu`, `student3@pes.edu` |
| Questions | 55 | 5 subjects, 18 topics; 19 easy / 24 medium / 12 hard; 31 MCQ / 15 True-False / 9 short answer |
| Question status | 49 / 5 / 1 | approved / pending / rejected; pending and rejected are student contributions for the approval queue (CSQP-F-023) |
| Quizzes | 1 | "Data Structures Basics", published, 5 questions, 10 minutes |

All seed accounts use the password in `SEED_PASSWORD` (default `Password1`),
stored as salted bcrypt hashes (CSQP-SR-002).

Data lives in `src/seed/` (`users.js`, `questions.js`).

## Tests

```bash
npm test
```

Tests that need data call `useSeededDatabase()` from `src/test-utils/testDb.js`,
which connects to `MONGODB_URI_TEST` and **re-seeds before each test suite**.
Each Jest worker gets its own database (`csqp_test_1`, `csqp_test_2`, ...),
and the helper refuses any database whose name doesn't contain `test`.

```js
const { useSeededDatabase } = require('../test-utils/testDb');
const db = useSeededDatabase();

it('has a student account', () => {
  expect(db.seed.users.student.email).toBe('student@pes.edu');
});
```

Running these locally needs a MongoDB server (local install or Atlas).
CI starts one automatically.

`npm test` runs Jest with `--experimental-vm-modules`, because MongoDB driver
v7 loads part of itself with a dynamic `import()` that Jest only allows with
this flag. Without it every database connection in Jest fails with
"Missing required sub-document 'driver'". The "VM Modules is an experimental
feature" warning is expected.
