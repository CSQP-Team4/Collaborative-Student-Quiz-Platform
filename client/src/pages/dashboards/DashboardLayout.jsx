import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_LABEL } from '../../auth/roles';

// Shell shared by the Student, Instructor and Admin dashboards (CSQP-12).
// Each tile names the story that will fill it in.
export default function DashboardLayout({ title, intro, tiles }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true, state: { notice: 'You have been logged out.' } });
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <p className="brand">CSQP</p>
        <div className="dashboard-user">
          <span>{user?.name}</span>
          <span className="role-badge">{ROLE_LABEL[user?.role]}</span>
          <button type="button" className="btn btn-secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <h1>{title}</h1>
        <p className="dashboard-intro">{intro}</p>
        <ul className="tile-grid">
          {tiles.map((tile) => (
            <li key={tile.title} className="tile">
              <h2>{tile.title}</h2>
              <p>{tile.description}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
