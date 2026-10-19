import { useLocation } from 'react-router-dom';

// Test helper: prints the current route so tests can assert redirects.
export default function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}
