# Clix Sales System

Sales Management System for **Clix Digital Works** — covering authentication, inventory, POS, purchases, transfers, expenses, car wash, and reporting across multiple branches.

Production URL: `https://sales.clixworks.co.tz`

## Documentation

Start here before touching any code:

- [`prompt/MASTER_PROMPT.md`](prompt/MASTER_PROMPT.md) — the full product/engineering specification
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — as-built architecture, core reusable patterns, module dependency graph
- [`docs/DATABASE.md`](docs/DATABASE.md) — as-built schema reference
- [`docs/API.md`](docs/API.md) — as-built REST API reference
- [`docs/SECURITY.md`](docs/SECURITY.md) — security measures implemented and known limitations
- [`docs/TESTING.md`](docs/TESTING.md) — verification methodology (no live DB existed during development)
- [`docs/CODING-STANDARDS.md`](docs/CODING-STANDARDS.md) — conventions to follow for any future change
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Contabo VPS production setup
- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) — original architecture decisions and phase plan
- [`docs/TODO.md`](docs/TODO.md) — the live task list, updated after every change
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — record of every implemented change, phase by phase

## Tech Stack

**Frontend:** React 19 + Vite, React Router DOM 7, Axios, React Hook Form, Framer Motion, React Icons, Chart.js + react-chartjs-2, html5-qrcode, pure CSS (no UI framework).

**Backend:** Node.js + Express 5, MySQL (mysql2), JWT auth, express-validator, Helmet, express-rate-limit, Multer, node-cron, Nodemailer, pdfkit, qrcode, Winston.

## Getting Started

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for production setup on the Contabo VPS.
