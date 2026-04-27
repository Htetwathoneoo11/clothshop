# Playwright E2E

These browser tests target the admin boards workflow.

## Prerequisites

1. Start the app (Laravel + frontend) so it is reachable at:
`PLAYWRIGHT_BASE_URL` (default: `http://127.0.0.1:8000/clothshop`)
2. Provide admin credentials:
`E2E_ADMIN_USERNAME`
`E2E_ADMIN_PASSWORD`

## Run

```bash
npm run test:e2e
```

Optional headed mode:

```bash
npm run test:e2e:headed
```

