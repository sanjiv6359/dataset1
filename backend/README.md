# AI Dataset Change Passport — Backend

A small REST API for the DataPass hackathon frontend. It uses Express, SQLite, Sequelize, JWT, bcrypt, and Multer. The server also serves the sibling `frontend/` folder, so one local server can host both the API and the existing static pages.

> This is a learning/demo project. Use HTTPS, rotate the development JWT secret, and review file access and privacy requirements before deploying it publicly.

## Requirements

- Node.js 18 or newer
- npm

## Installation and startup

From this `backend/` folder:

```bash
npm install
npm start
```

Open `http://localhost:5000/` for the frontend, or `http://localhost:5000/api/health` to check the API.

For auto-restart while developing:

```bash
npm run dev
```

Edit `.env` before using this outside a local demo. `.env.example` is the shareable template; `.env` and the generated SQLite database are ignored by Git. `DATABASE_STORAGE` is relative to the backend directory and overrides the generated path; if omitted, the database is saved as `<DATABASE_NAME>.sqlite`.

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | HTTP port | `5000` |
| `JWT_SECRET` | Secret used to sign and verify tokens; use a random value of at least 32 characters | Local development placeholder in `.env` |
| `DATABASE_NAME` | Human-readable SQLite database name | `dataset_passport` |
| `DATABASE_STORAGE` | SQLite database file, relative to this folder | `./dataset_passport.sqlite` |
| `MAX_FILE_SIZE_MB` | Maximum upload size | `25` |

## Authentication

Register or log in through `/api/auth`. Send the returned token on private requests:

```http
Authorization: Bearer <token>
```

The registration endpoint accepts either `name` (as used in the original project brief) or `fullName`. Passwords are hashed with bcrypt before storage. Tokens expire after seven days.

## API endpoints

All responses are JSON. Private routes require a valid bearer token. Uploads use `multipart/form-data` with the file field named `file`.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | No | Check that the server is running |
| `POST` | `/api/auth/register` | No | Create an account: `{ "name": "Ritik", "email": "ritik@example.com", "password": "123456" }` |
| `POST` | `/api/auth/login` | No | Log in and receive `{ "token": "...", "user": {...} }` |
| `POST` | `/api/datasets/upload` | Yes | Upload a `.csv` or `.xlsx`; fields: `file`, `datasetName`, optional `datasetId`, optional `versionNote` |
| `GET` | `/api/datasets/history` | Yes | List the current user's dataset versions |
| `GET` | `/api/datasets/passport/:id` | Yes | Get a passport by its numeric dataset ID |
| `GET` | `/api/datasets/compare/:v1/:v2` | Yes | Compare two numeric version IDs belonging to the same dataset |
| `GET` | `/api/datasets/dashboard` | Yes | Dataset/version totals and five recent uploads |
| `GET` | `/api/profile` | Yes | View profile and dataset total |
| `PATCH` | `/api/profile` | Yes | Update `name`, `fullName`, and/or `email` |

Example registration and login:

```json
{
  "name": "Ritik",
  "email": "ritik@example.com",
  "password": "123456"
}
```

Example upload using curl:

```bash
curl -X POST http://localhost:5000/api/datasets/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "datasetName=Employee Dataset" \
  -F "versionNote=Initial import" \
  -F "file=@employees.csv"
```

To add a new version, send `datasetId` instead of `datasetName`. The dataset ID is returned after the first upload.

## Dataset parsing and comparison

CSV and the first worksheet of XLSX uploads are inspected when uploaded. The API stores row count, column count, missing-cell count, and duplicate-row count alongside the version. Original files are given random server-side names and stored in `uploads/`; their filesystem paths are not returned by the API.

Comparison currently reports changes in total row and column counts. Added/removed rows are calculated from the difference in counts, so this simple demo cannot identify which specific records or fields changed.

Passport IDs are derived from the numeric dataset ID, for example `DSP000001`. The passport route expects that numeric ID (`/api/datasets/passport/1`).

## Frontend connection

The server serves the existing static site from the sibling `frontend/` directory. Open it at `http://localhost:5000/` to use it with the API. The login and registration forms call the auth endpoints, the upload form sends CSV/XLSX files, and the history, passport, comparison, dashboard, and profile screens use the signed-in API. The frontend stores the JWT in browser `localStorage` and sends it in the `Authorization` header. Opening the pages with `file://` also points API requests to `http://localhost:5000`, but using the server-served pages is recommended.

## Folder structure

```text
backend/
├── config/
│   └── database.js
├── controllers/
│   ├── authController.js
│   ├── datasetController.js
│   └── profileController.js
├── middleware/
│   ├── authMiddleware.js
│   └── uploadMiddleware.js
├── models/
│   ├── Dataset.js
│   ├── DatasetVersion.js
│   ├── User.js
│   └── index.js
├── routes/
│   ├── authRoutes.js
│   ├── datasetRoutes.js
│   └── profileRoutes.js
├── uploads/
├── .env
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```
