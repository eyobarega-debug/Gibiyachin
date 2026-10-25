README.md



ግቢያችን (Gibiyachin)
University Marketplace and Campus Services Platform

Gibiyachin is a full-stack web application designed for Ethiopian university communities. It brings campus shopping, student-to-student listings, equipment rentals, and event ticketing into one platform. The project was previously known as CampusHub.

Main Features
Campus marketplace: Store profiles, product listings, inventory, and order tracking.

Student-to-student exchange: Listings for used items and buyer-seller contact requests.

Equipment rentals: Rental listings, booking, deposits, pickup and return tracking, and late-fee rules.

Events and ticketing: Event review, ticket types, manual payment-proof review, QR ticket validation, check-in, and admission reversal.

Payments and commissions: Manual payment workflows and commission records.

Campus administration: Role-based permissions and university-scoped data.

Profiles and notifications: User profiles, privacy settings, favorites, and in-app notifications.

Some extended capabilities have shell-script or manual-check evidence rather than automated browser end-to-end tests. See Verification Status and Known Limitations below.

Technology Stack
Backend: Node.js, Express.js, PostgreSQL

Frontend: React, Vite, React Router, Axios, Tailwind CSS

Validation and security: Zod, bcryptjs, JWT, Helmet

Other tools: Sharp for image processing, html5-qrcode for QR scanning, and optional Redis support.

Repository Structure
Gibiyachin/
├── backend/                  # Express API, database schema, migrations, and tests
├── frontend/                 # React and Vite application
├── docs/                     # Project documentation
├── .gitattributes            # Git LFS configuration for MP4 files
├── .gitignore
├── package.json              # Root development and build scripts
├── package-lock.json
├── phase3-plan.md             # Multi-tenancy planning document
├── Gibiyachen Project video.mp4
└── README.md
Project Walkthrough
A recorded walkthrough is included in the repository:

Watch or open the Gibiyachin project demo video

Requirements
Install the following for local development:

Node.js 20 or later

PostgreSQL 15 or later, with the required pgcrypto extension

npm and Git

Redis is optional. If Redis is not configured or reachable, some features use in-process fallback behavior.

Windows note: Some database migration and test scripts use Bash syntax and environment-variable expansion. Git Bash or WSL is recommended for running those scripts.

Run Locally
1. Clone the repository
git clone https://github.com/eyobarega-debug/Gibiyachin.git
cd Gibiyachin
2. Configure the backend
cd backend
npm install
cp .env.example .env
In Windows PowerShell, use this command instead of cp:

Copy-Item .env.example .env
Edit backend/.env. Update DATABASE_URL to match your local PostgreSQL username, password, host, port, and database. The example configuration uses a database named campushub.

Create that database if it does not already exist:

createdb campushub
Set unique development values for JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, and TICKET_QR_SECRET. Do not use example or development secrets in a public deployment.

3. Run database migrations and seed local data
Run these commands in Git Bash or WSL, from the backend directory, so the variables in .env are available to the migration scripts:

set -a
source .env
set +a

npm run db:migrate:all
npm run db:seed
The seed command adds local sample data. Do not use development seed accounts in production.

4. Start the backend
From the backend directory:

npm run dev
The API uses port 4000 by default. Leave this terminal running.

5. Start the frontend
Open a second terminal at the repository root:

cd frontend
npm install
npm run dev
The Vite development server uses http://localhost:5173 by default.

Local Demo Accounts
The database seed script creates sample data for local evaluation. Check backend/db/seed.js for the available seed accounts. Seed credentials are for local development only. Do not use them for a public deployment or seed a production database with development accounts.

Useful Commands
Run backend commands from the backend directory.

# Start the API
npm run dev

# Apply the schema and database migrations
npm run db:migrate:all

# Add local development data
npm run db:seed

# Security tests
npm run test:security:all

# Multi-tenant tests
npm run test:tenant:all

# Smoke and tenancy scripts
npm run test:smoke
npm run test:smoke:phase2
npm run test:tenancy
npm run test:tenancy:phase2
Run frontend commands from the frontend directory.

npm run lint
npm run build
npm run preview
Some smoke tests expect a freshly seeded database and matching environment variables. Read each script before running it against a database containing data you need to keep.

Verification Status and Known Limitations
The SRS records 323 automated backend tests passing on 21 October 2026, against the commit identified in Section 15.1 of the SRS. This is a recorded test result, not a claim that those tests have been rerun for every later commit. Consult the SRS for the test breakdown and scope.

The project documentation also records these limitations:

The Chapa provider has not been validated against the live payment gateway.

SMS delivery is simulated; no live SMS gateway is connected.

The full frontend does not have browser end-to-end test coverage.

Some extended features are checked through shell scripts or manual checks rather than the recorded automated test run.

Performance targets and some operational controls still need verification before wider production use.

Before public deployment, configure strong production secrets, set the allowed browser origins, configure real email and payment services as needed, and complete appropriate security, integration, and load testing. A local demonstration is not the same as production readiness.

Documentation
See the pdf folder for the project's SRS and supporting documentation.
