import { useAuth } from '../../auth/AuthContext';
import DashboardLayout from './DashboardLayout';

const TILES = [
  {
    title: 'Question approvals',
    description: 'Review student-submitted questions before they enter quizzes.',
  },
  {
    title: 'Question bank',
    description: 'Add questions or bulk-import them from CSV/Excel.',
  },
  {
    title: 'Create quiz',
    description: 'Pick or randomly sample questions; set time and attempt limits.',
  },
  {
    title: 'Class analytics',
    description: 'Averages, most-missed questions and participation per quiz.',
    to: '/instructor/analytics',
  },
  {
    title: 'Leaderboard',
    description: 'Rankings of students who opted in, per quiz or subject.',
    to: '/leaderboard',
  },
];

export default function InstructorDashboard() {
  const { user } = useAuth();
  return (
    <DashboardLayout
      title={`Welcome, ${user?.name?.split(' ')[0] || 'instructor'}`}
      intro="Your instructor dashboard."
      tiles={TILES}
    />
  );
}
