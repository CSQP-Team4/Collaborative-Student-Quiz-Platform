// Seed accounts (CSQP-5). One per role plus extra students for analytics
// and leaderboard tests. Same emails as the client's demo mode (CSQP-12).
// Passwords are hashed by seed.js before saving (CSQP-SR-002).

const SEED_USERS = [
  { key: 'admin', name: 'Demo Admin', email: 'admin@pes.edu', role: 'admin' },
  { key: 'instructor', name: 'Demo Instructor', email: 'instructor@pes.edu', role: 'instructor' },
  // Demo Student starts hidden so the opt-in toggle can be demoed (CSQP-29).
  { key: 'student', name: 'Demo Student', email: 'student@pes.edu', role: 'student', usn: '1PE22CS001', department: 'Computer Science & Engineering', semester: 5, bio: 'Aspiring software engineer interested in distributed systems.' },
  { key: 'student2', name: 'Rahul Nair', email: 'student2@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS042', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student3', name: 'Priya Sharma', email: 'student3@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS088', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student4', name: 'Aarav Patel', email: 'student4@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS010', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student5', name: 'Ananya Deshmukh', email: 'student5@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS015', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student6', name: 'Vikramaditya Hegde', email: 'student6@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS021', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student7', name: 'Sanjana Rao', email: 'student7@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS029', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student8', name: 'Rohan Kulkarni', email: 'student8@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS034', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student9', name: 'Meera Iyer', email: 'student9@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS045', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student10', name: 'Kavya Murthy', email: 'student10@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS052', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student11', name: 'Arjun Prasad', email: 'student11@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS058', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student12', name: 'Tanvi Bhat', email: 'student12@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS063', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student13', name: 'Aditya Shenoy', email: 'student13@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS070', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student14', name: 'Nikhil Verma', email: 'student14@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS077', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student15', name: 'Pooja Reddy', email: 'student15@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS082', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student16', name: 'Deepak Gowda', email: 'student16@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS091', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student17', name: 'Sneha Pai', email: 'student17@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS099', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student18', name: 'Varun Kamath', email: 'student18@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS105', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student19', name: 'Divya Menon', email: 'student19@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS112', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student20', name: 'Harish Kumar', email: 'student20@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS119', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student21', name: 'Ishita Sen', email: 'student21@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS125', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student22', name: 'Gautam Nayak', email: 'student22@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS130', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student23', name: 'Lavanya Suresh', email: 'student23@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS138', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student24', name: 'Manoj Nambiar', email: 'student24@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS144', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student25', name: 'Keerthi Swamy', email: 'student25@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS150', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student26', name: 'Shreya Joshi', email: 'student26@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS156', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student27', name: 'Tarun Acharya', email: 'student27@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS162', department: 'Computer Science & Engineering', semester: 5 },
  { key: 'student28', name: 'Pranav Deshpande', email: 'student28@pes.edu', role: 'student', leaderboardOptIn: true, usn: '1PE22CS170', department: 'Computer Science & Engineering', semester: 5 },
];

module.exports = { SEED_USERS };
