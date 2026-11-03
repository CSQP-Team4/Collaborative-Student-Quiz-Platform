import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_LABEL, homeFor } from '../../auth/roles';

// App shell shared by every signed-in page (frontend redesign, CSQP-33):
// a 48px top bar, a 220px sidebar with the role's pages, and the main
// workspace. Dashboards pass `tiles`; other pages render children.
// A tile with `to` links to that page; a tile without one is marked "Coming soon".

const NAV = {
  student: [
    { label: 'Quizzes', path: '/quizzes' },
    { label: 'My progress', path: '/student/progress' },
    { label: 'Leaderboard', path: '/leaderboard' },
    { label: 'Profile settings', path: '/student/settings' },
  ],
  instructor: [
    { label: 'Class analytics', path: '/instructor/analytics' },
    { label: 'Leaderboard', path: '/leaderboard' },
  ],
  admin: [
    { label: 'Uptime report', path: '/admin/uptime' },
    { label: 'Class analytics', path: '/instructor/analytics' },
    { label: 'Leaderboard', path: '/leaderboard' },
  ],
};

function TileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export default function DashboardLayout({ title, intro, tiles = [], children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true, state: { notice: 'You have been logged out.' } });
  }

  const homePath = homeFor(user);
  const navItems = [{ label: 'Home', path: homePath, exact: true }, ...(NAV[user?.role] || [])];
  const isActive = (item) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="top-navbar">
        <div className="top-navbar-left">
          <Link to={homePath} className="brand-logo" aria-label="CSQP home">
            <span className="brand-badge">CSQP</span>
          </Link>
        </div>
        <div className="top-navbar-right">
          <div className="user-profile">
            <span className="user-name">{user?.name}</span>
            <span className="role-tag">{ROLE_LABEL[user?.role] || user?.role}</span>
          </div>
          <button type="button" className="btn btn-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="shell-body">
        <nav className="sidebar" aria-label="Main">
          <span className="sidebar-group-title" aria-hidden="true">
            WORKSPACE
          </span>
          <ul className="sidebar-nav">
            {navItems.map((item) => {
              const active = isActive(item);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`sidebar-link ${active ? 'active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="workspace-main" id="main-content" tabIndex={-1}>
          <div className="workspace-header">
            <h1>{title}</h1>
            {intro && <p className="workspace-intro">{intro}</p>}
          </div>

          {tiles.length > 0 && (
            <section className="portal-grid-section" aria-labelledby="workspace-label">
              <div className="section-label-row">
                <h2 className="section-label" id="workspace-label">
                  Your workspace
                </h2>
              </div>
              <ul className="card-grid">
                {tiles.map((tile) => (
                  <li key={tile.title} className={tile.to ? 'card-item' : 'card-item card-item-soon'}>
                    <div className="card-header">
                      <div className="card-icon-box" aria-hidden="true">
                        <TileIcon />
                      </div>
                      <h3 className="card-title">
                        {tile.to ? <Link to={tile.to}>{tile.title}</Link> : tile.title}
                      </h3>
                    </div>
                    <p className="card-description">{tile.description}</p>
                    <div className="card-footer">
                      {tile.to ? (
                        <span className="card-action-link" aria-hidden="true">
                          Open →
                        </span>
                      ) : (
                        <span className="card-action-muted">Coming soon</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
