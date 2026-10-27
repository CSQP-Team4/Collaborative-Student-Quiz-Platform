import { useAuth } from '../../auth/AuthContext';
import DashboardLayout from './DashboardLayout';

const TILES = [
  {
    title: 'Users & roles',
    description: 'Manage accounts and assign Instructor or Admin roles.',
  },
  {
    title: 'Audit log',
    description: 'Logins, lockouts and approval actions with user, IP and time.',
  },
  {
    title: 'System health',
    description: 'API, database and analytics service status.',
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
