// Optional demo data (frontend redesign, CSQP-33):  cd server && npm run seed:demo
//
// Run AFTER `npm run seed`. Adds four more published quizzes (Operating
// Systems, DBMS, Computer Networks, Software Engineering) from the approved
// seed questions, and one submitted attempt per student per quiz, so the
// Quizzes page, My progress, Class analytics and the Leaderboard have data
// to show in a demo. Safe to run more than once: existing quizzes and
// attempts are skipped. It does not change anyone's leaderboard opt-in.
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');

const EXTRA_QUIZZES = [
  { title: 'Operating Systems Fundamentals', subject: 'Operating Systems', duration: 15, description: 'Processes, memory management, scheduling and file systems.' },
  { title: 'Database Management Systems Practice', subject: 'Database Management Systems', duration: 15, description: 'Relational algebra, SQL, indexing and ACID transactions.' },
  { title: 'Computer Networks Essentials', subject: 'Computer Networks', duration: 15, description: 'OSI layers, TCP/UDP, routing and network protocols.' },
  { title: 'Software Engineering & Clean Architecture', subject: 'Software Engineering', duration: 10, description: 'Agile, testing, design patterns and CI/CD.' },
];

async function enrichDatabase({ log = console.log } = {}) {
  const instructor = await User.findOne({ role: 'instructor' });
  if (!instructor) throw new Error('No instructor account found. Run `npm run seed` first.');
  const students = await User.find({ role: 'student' }).sort({ createdAt: 1 });

  const created = { quizzes: 0, attempts: 0 };

  for (const q of EXTRA_QUIZZES) {
    if (await Quiz.exists({ title: q.title })) continue;
    const questions = await Question.find({ subject: q.subject, status: 'approved', type: { $ne: 'SUBJECTIVE' } }).limit(5);
    if (!questions.length) continue;
    await Quiz.create({ ...q, questions: questions.map((x) => x._id), createdBy: instructor._id, isPublished: true });
    created.quizzes += 1;
    log(`Created quiz "${q.title}" with ${questions.length} questions.`);
  }

  // One graded attempt per student per published quiz, with varied scores.
  const quizzes = await Quiz.find({ isPublished: true }).sort({ createdAt: 1 });
  for (const [quizIdx, quiz] of quizzes.entries()) {
    const questions = await Question.find({ _id: { $in: quiz.questions } }).select('+answer');
    if (!questions.length) continue;

    for (let i = 0; i < students.length; i += 1) {
      const student = students[i];
      if (await QuizAttempt.exists({ student: student._id, quiz: quiz._id })) continue;

      const responses = questions.map((question, qIdx) => {
        // Varies by student, quiz and question, so trends and rankings are not flat.
        const correct = (i * 2 + quizIdx + qIdx * (quizIdx + 1)) % 4 !== 0;
        const wrong = question.options.find((opt) => opt !== question.answer) || 'none';
        return { question: question._id, answer: correct ? question.answer : wrong };
      });
      const score = responses.filter((r, idx) => r.answer === questions[idx].answer).length;
      // Older quizzes first, so the score trend reads left to right.
      const startedAt = new Date(Date.now() - ((quizzes.length - quizIdx) * 24 + i) * 3600 * 1000);

      await QuizAttempt.create({
        student: student._id,
        quiz: quiz._id,
        status: 'submitted',
        shuffledQuestions: questions.map((q) => ({
          question: q._id, text: q.text, type: q.type, options: q.options, subject: q.subject, topic: q.topic || 'General',
        })),
        responses,
        score,
        startedAt,
        submittedAt: new Date(startedAt.getTime() + 8 * 60 * 1000),
      });
      created.attempts += 1;
      log(`Recorded attempt for ${student.name} on "${quiz.title}": ${score}/${questions.length}`);
    }
  }
  return created;
}

if (require.main === module) {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/csqp';
  mongoose
    .connect(uri)
    .then(() => enrichDatabase())
    .then((c) => console.log(`Demo data added: ${c.quizzes} quizzes, ${c.attempts} attempts.`))
    .catch((err) => {
      console.error('Demo data failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = enrichDatabase;
