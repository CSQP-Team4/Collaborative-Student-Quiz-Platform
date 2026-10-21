import { useAuth } from '../../auth/AuthContext';
import DashboardLayout from './DashboardLayout';

const TILES = [
  {
    title: 'Study materials',
    description: 'Upload, search and download notes shared by classmates.',
    story: 'Sprint 1 · CSQP-13, CSQP-14, CSQP-15',
  },
  {
    title: 'Contribute questions',
    description: 'Submit questions to the shared bank for instructor approval.',
    story: 'Sprint 2 · CSQP-17',
  },
  {
    title: 'Quizzes',
    description: 'Take timed quizzes and get instant scores.',
    story: 'Sprint 2 · CSQP-21, CSQP-22',
  },
  {
    title: 'My progress',
    description: 'Score trends and topic-wise strengths and weaknesses.',
    story: 'Sprint 2 · CSQP-27',
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
