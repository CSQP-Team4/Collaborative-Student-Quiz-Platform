import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="simple-page">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Go to the home page</Link>
      </p>
    </main>
  );
}
