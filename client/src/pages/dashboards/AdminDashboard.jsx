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
    title: 'Uptime report',
    description: 'Monthly availability vs the 99.5% target, incidents and planned maintenance.',
    to: '/admin/uptime',
  },
  {
    title: 'Leaderboard',
    description: 'Rankings of students who opted in, per quiz or subject.',
    to: '/leaderboard',
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
