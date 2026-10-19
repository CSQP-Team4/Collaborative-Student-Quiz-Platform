import { useAuth } from '../../auth/AuthContext';
import DashboardLayout from './DashboardLayout';

const TILES = [
  {
    title: 'Question approvals',
    description: 'Review student-submitted questions before they enter quizzes.',
    story: 'Sprint 2 · CSQP-18',
  },
  {
    title: 'Question bank',
    description: 'Add questions or bulk-import them from CSV/Excel.',
    story: 'Sprint 2 · CSQP-16, CSQP-19',
  },
  {
    title: 'Create quiz',
    description: 'Pick or randomly sample questions; set time and attempt limits.',
    story: 'Sprint 2 · CSQP-20',
  },
  {
    title: 'Class analytics',
    description: 'Averages, most-missed questions and participation per quiz.',
    story: 'Sprint 2 · CSQP-28',
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
