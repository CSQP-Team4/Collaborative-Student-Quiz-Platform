"""Service settings, read from environment variables."""

import os

SERVICE_NAME = "csqp-analytics"

# Port the service listens on. The Express API calls http://localhost:<PORT>.
PORT = int(os.getenv("ANALYTICS_PORT", "8001"))

# Optional shared secret for internal calls from the Express API.
# When set, every /api/* request must send header: X-Internal-Token: <value>.
# Leave unset in local development.
INTERNAL_API_TOKEN = os.getenv("ANALYTICS_INTERNAL_TOKEN", "")
