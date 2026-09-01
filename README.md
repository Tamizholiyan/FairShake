# Fairshake — Secure Milestone Payments & Support Protocol

**Team Ragnarok**

Fairshake is a market-ready escrow and dispute resolution platform designed to protect both Clients and Service Providers with upfront payment security, independent milestone releases, review & revision cycles, distance-based provider matching, and neutral dispute mediation.

---

## 🚀 Key Features in v2

1. **No Hackathon / Demo Language**: Clean, professional production copy across all screens.
2. **Direct Authentication Flow**:
   - `/login` is the direct entry point (Email + Password only). Automatically routes to the matching role dashboard (`/client`, `/provider`, `/mediator`).
   - **Two-Step Sign-Up**:
     - Step 1: Select Role (`Client`, `Service Provider`, `Fairshake Support`).
     - Step 2: Role-tailored fields (Providers choose from 10 standardized service categories; Mediators validate an authorized `ADM001` - `ADM010` whitelist code).
3. **Upfront Payment Security & Open Provider Pool**:
   - Clients define milestone splits (enforcing exact mathematical sum matches) and secure payment upfront via Razorpay.
   - Funded requests enter the `OPEN` pool visible to matching Providers based on **Category** and **Adjustable Distance Radius** (5km, 10km, 25km, 50km, 100km).
   - Providers click **"Accept Request"** to immediately assign themselves and start work.
   - Pre-acceptance **Cancellation**: If a Client withdraws an unaccepted open request, a 100% full Razorpay refund is issued instantly.
4. **Milestone Review & Revision Loop**:
   - `PENDING` $\rightarrow$ `SUBMITTED` $\rightarrow$ `RELEASED` (Payment Sent)
   - Or `SUBMITTED` $\rightarrow$ `DISPUTED` $\rightarrow$ `IN_MEDIATION` $\rightarrow$ `REVISION_REQUESTED` (Provider modifies & re-uploads deliverable) $\rightarrow$ `SUBMITTED` $\rightarrow$ `RELEASED`.
   - Full submission revision history is preserved and accessible.
5. **Two-Way Support & Dispute Messaging**:
   - Direct two-way communication channel between Fairshake Support and counterparties.
6. **Localization (i18n)**:
   - Complete support for **English (UK)** (`en-GB`), **Tamil** (`ta`), and **Hindi** (`hi`).
7. **Light & Dark Mode**:
   - Theme toggle accessible from all screens, persisted in browser storage.
8. **Technical Obfuscation**:
   - All internal cryptographic hashes, Razorpay internal transaction IDs, and state-machine codes remain server-side and are strictly hidden from frontend payloads.

---

## 🎭 Default Test Accounts

| Role | Email | Password | Access Details |
| :--- | :--- | :--- | :--- |
| **Client** | `client@fairshake.com` | `password123` | Posts requests, secures payment, reviews work |
| **Provider** | `provider@fairshake.com` | `password123` | Mason / Construction category, accepts jobs & submits deliverables |
| **Fairshake Support** | `mediator@fairshake.com` | `password123` | Whitelist Admin ID: `ADM001`, reviews reported issues |

---

## 🛠️ Running Locally

### Backend Server (Port 5000)
```powershell
cd backend
npm install
node src/scripts/migrate.js  # Runs PostgreSQL migrations on Supabase
node src/scripts/seed.js     # Seeds categories, admin codes, and default accounts
node src/scripts/test-runner.js # Runs test suite (19/19 passing)
node src/server.js
```

### Frontend Web App (Port 3000)
```powershell
cd frontend
npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.
