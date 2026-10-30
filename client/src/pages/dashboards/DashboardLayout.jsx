import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_LABEL } from '../../auth/roles';

// Shell shared by the Student, Instructor and Admin dashboards (CSQP-12).
// Pages render their own content as children; dashboards pass `tiles`.
// A tile with `to` becomes a link to that page.
export default function DashboardLayout({ title, intro, tiles = [], children }) {
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
        {tiles.length > 0 && (
          <ul className="tile-grid">
            {tiles.map((tile) => (
              <li key={tile.title} className={tile.to ? 'tile tile-link' : 'tile'}>
                <h2>{tile.to ? <Link to={tile.to}>{tile.title}</Link> : tile.title}</h2>
                <p>{tile.description}</p>
              </li>
            ))}
          </ul>
        )}
        {children}
      </main>
    </div>
  );
}
