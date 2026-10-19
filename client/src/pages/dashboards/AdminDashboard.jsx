import { useAuth } from '../../auth/AuthContext';
import DashboardLayout from './DashboardLayout';

const TILES = [
  {
    title: 'Users & roles',
    description: 'Manage accounts and assign Instructor or Admin roles.',
    story: 'Planned · SRS 2.3',
  },
  {
    title: 'Audit log',
    description: 'Logins, lockouts and approval actions with user, IP and time.',
    story: 'Sprint 1 · CSQP-11',
  },
  {
    title: 'System health',
    description: 'API, database and analytics service status.',
    story: 'Sprint 1 · CSQP-1 · Sprint 2 · CSQP-35',
  },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  return (
    <DashboardLayout
      title={`Welcome, ${user?.name?.split(' ')[0] || 'admin'}`}
      intro="Your admin dashboard."
      tiles={TILES}
    />
  );
}
