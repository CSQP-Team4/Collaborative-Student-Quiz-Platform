import { useAuth } from '../../auth/AuthContext';
import DashboardLayout from './DashboardLayout';

const TILES = [
  {
    title: 'Study materials',
    description: 'Upload, search and download notes shared by classmates.',
  },
  {
    title: 'Contribute questions',
    description: 'Submit questions to the shared bank for instructor approval.',
  },
  {
    title: 'Quizzes',
    description: 'Take timed quizzes and get instant scores.',
  },
  {
    title: 'My progress',
    description: 'Score trends and topic-wise strengths and weaknesses.',
    to: '/student/progress',
  },
  {
    title: 'Leaderboard',
    description: 'See how you rank per quiz or subject (only if you opt in).',
    to: '/leaderboard',
  },
  {
    title: 'Profile settings',
    description: 'Choose whether you appear on the leaderboard.',
    to: '/student/settings',
  },
];

export default function StudentDashboard() {
  const { user } = useAuth();
  return (
    <DashboardLayout
      title={`Welcome, ${user?.name?.split(' ')[0] || 'student'}`}
      intro="Your student dashboard."
      tiles={TILES}
    />
  );
}
