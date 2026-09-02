# Fairshake — Milestone Escrow & Dispute Resolution Platform

> **Guaranteed payment protection for local services and gig contracts.**  
> Fairshake locks project funds in escrow before work begins, releasing payments milestone-by-milestone upon verified proof of completion, backed by impartial human arbitration.

---

## 🏆 Problem & Solution

| The Problem | The Fairshake Solution |
| :--- | :--- |
| **Payment Risk for Providers**: Service providers often face non-payment or endless delays after completing work. | **100% Upfront Escrow**: Clients fund milestones in advance via Razorpay before work begins, guaranteeing available funds. |
| **Quality Risk for Clients**: Clients fear paying large advance deposits only to receive shoddy work or abandonment. | **Milestone-by-Milestone Release**: Funds are released sequentially only after client review and approval of deliverables. |
| **Disputes & Deadlocks**: When disagreements arise, both parties are stranded with no neutral recourse. | **Built-in Support Mediation**: Neutral mediators review evidence, chat directly with both parties, and resolve disputes or request revisions. |
| **Freelancer Quoting Friction**: Rigid pricing prevents negotiation on custom service requirements. | **Interactive Proposal & Quoting**: Providers submit custom quotes and proposals with verified contact details. |

---

## 📋 Table of Contents
1. [3-Minute Judge Testing Walkthrough](#-3-minute-judge-testing-walkthrough)
2. [Default Test Accounts](#-default-test-accounts)
3. [Key Architectural Features](#-key-architectural-features)
4. [Milestone Finite State Machine](#-milestone-finite-state-machine)
5. [Tech Stack](#-tech-stack)
6. [Local Installation & Setup](#-local-installation--setup)
7. [Automated Test Suite](#-automated-test-suite)

---

## ⚡ 3-Minute Judge Testing Walkthrough

Follow these simple steps to test the end-to-end platform in under 3 minutes:

```mermaid
sequenceDiagram
    autonumber
    actor Client as 👤 Client
    participant App as 🛡️ Fairshake Platform
    actor Provider as 🔧 Service Provider
    actor Mediator as ⚖️ Support Mediator

    Client->>App: 1. Create Request & Fund Escrow (Razorpay)
    App-->>Provider: 2. Request appears in Open Feed
    Provider->>App: 3. Submit Proposal / Accept Request
    Client->>App: 4. Accept Provider Application
    Provider->>App: 5. Upload Work Deliverables (Photos/Docs)
    alt Happy Path
        Client->>App: 6a. Approve & Release Milestone Payment
    else Dispute & Revision Path
        Client->>App: 6b. Report Issue / Dispute Milestone
        Mediator->>App: 7. Review Evidence & Request Revision
        Provider->>App: 8. Re-upload Corrected Deliverables
        Mediator->>App: 9. Approve Submission & Release Funds
    end
    Client->>App: 10. Rate Provider (5-Star Flipkart-style Review)
```

### Scenario 1: The Complete Happy Path
1. **Sign In as Client**:
   - Go to `/login` and enter `client@fairshake.com` / `password123`.
   - Click **"+ Post a Request"**. Enter a title (e.g. *"Kitchen Cabinet Installation"*), choose a category, set milestone splits (e.g. ₹5,000 + ₹5,000 = ₹10,000 total).
   - Click **"Secure Payment with Razorpay"** on the request page to fund the escrow.
2. **Sign In as Provider**:
   - Open an incognito tab or log out, then sign in with `provider@fairshake.com` / `password123`.
   - On the **Provider Dashboard**, find the new open request.
   - Click **"Submit Proposal"** or accept the request.
3. **Accept Proposal & Complete Milestones**:
   - Switch back to the Client window, click **"Accept Application"** to start the job.
   - As Provider, click **"Submit Deliverable"** on Milestone #1, upload photos/evidence, and submit.
   - As Client, review the deliverables and click **"Approve & Release Payment"**.
   - Repeat for remaining milestones. Once all milestones are released, the project automatically marks as **COMPLETED**.
4. **Submit Rating**:
   - As Client, leave a 5-star review and feedback.

### Scenario 2: Dispute Mediation & Revision Loop
1. When a provider submits a deliverable, the client clicks **"Report an Issue / Dispute"** and enters an explanation.
2. Sign in as Support Mediator (`mediator@fairshake.com` / `password123`).
3. Under **Disputed Milestones**, click **"Mediate"**.
4. Review the timeline, inspect the uploaded deliverables, and message the client/provider in the **Case Conversation**.
5. Click **"Request Revision"** with mediator notes $\rightarrow$ the milestone resets to `REVISION_REQUESTED`.
6. Provider uploads updated files $\rightarrow$ Mediator clicks **"Approve Submission"** $\rightarrow$ Funds are released.

### Scenario 3: Project Cancellation & Unreleased Funds Refund
1. On an active project, the Client clicks **"Request Cancellation & Refund"** and submits a reason.
2. As Mediator, navigate to the **"Cancellation & Refund Requests"** queue.
3. Click **"Approve Refund"** $\rightarrow$ Fairshake automatically refunds all unreleased milestone funds back to the client's original payment method via Razorpay.

---

## 🎭 Default Test Accounts

All accounts use password: `password123`

| Role | Email | Password | Purpose & Capabilities |
| :--- | :--- | :--- | :--- |
| **Client** | `client@fairshake.com` | `password123` | Posts requests, deposits escrow, reviews deliverables, releases payouts, rates providers. |
| **Provider** | `provider@fairshake.com` | `password123` | Browses open jobs by category/distance, submits proposals, uploads work proofs, tracks earnings. |
| **Support Mediator** | `mediator@fairshake.com` | `password123` | Arbitrates reported disputes, chats with parties, requests revisions, approves refunds (Admin ID: `ADM001`). |

> **Mediator Sign-Up Whitelisting**: New mediator accounts can be created at `/register` by selecting "Fairshake Support" and entering an unused Admin Whitelist code: `ADM002`, `ADM003`, `ADM004`, `ADM005`, `ADM006`, `ADM007`, `ADM008`, `ADM009`, `ADM010`.

---

## 🚀 Key Architectural Features

1. **Upfront Milestone-Escrow Security**:
   - Mathematical sum verification: Client milestone amounts must exactly match project total.
   - Real-time test-mode payments powered by Razorpay Orders & HMAC-SHA256 signature verification.
2. **Dynamic Provider Matching & Open Pool**:
   - Distance radius filters (5km, 15km, 25km, 50km, Anywhere) calculated using geospatial Haversine formula.
   - Category filtering across 10 trades (Plumber, Electrician, Carpenter, Painter, Interior Designer, Mason / Construction, Appliance Repair, Cleaning, Landscaping, Other).
3. **Multi-File Proof of Work Submissions**:
   - Providers can attach multiple deliverable photos or inspection documents per milestone.
   - SHA-256 integrity hashing recorded for auditability.
4. **Two-Way Support & Case Communication**:
   - Integrated live messaging channels for dispute resolution and client-provider coordination.
5. **Verified Flipkart-style 5-Star Reviews**:
   - Only clients with completed, paid contracts can submit ratings and reviews.
6. **Dark & Light Mode**:
   - High-contrast accessible design system with persistent theme toggling.
7. **Security & Data Privacy**:
   - Role-based JWT authentication.
   - Sensitive financial references, transaction IDs, and cryptographic hashes are kept strictly server-side.

---

## 🔄 Milestone Finite State Machine

```
   [ PENDING ] ─────────► (Provider Submits Work)
        │
        ▼
  [ SUBMITTED ] ────────► (Client Approves) ─────────► [ RELEASED ] (Terminal)
        │
        ▼ (Client Reports Issue)
  [ DISPUTED ]
        │
        ▼ (Mediator Enters)
 [ IN_MEDIATION ]
        │
        ├───► (Mediator Approves) ───────────────────► [ RELEASED ] (Terminal)
        │
        └───► (Mediator Requests Revision)
                    │
                    ▼
          [ REVISION_REQUESTED ]
                    │
                    ▼ (Provider Re-uploads)
              [ SUBMITTED ] ──► (Loop Continues)
```

---

## 💻 Tech Stack

- **Frontend**:
  - [Next.js 14](https://nextjs.org/) (App Router, Server Components & Client Hooks)
  - Pure Vanilla CSS Design System with CSS variables, Glassmorphism, and responsive grid tokens
  - [Lucide React](https://lucide.dev/) Icons
- **Backend**:
  - [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
  - [PostgreSQL](https://www.postgresql.org/) / [Supabase](https://supabase.com/) (`pg` connection pool with SSL)
  - [Razorpay Node SDK](https://razorpay.com/) (Orders API, HMAC verification, Refunds)
  - [JSON Web Tokens (JWT)](https://jwt.io/) & [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- **Deployment**:
  - Frontend: [Vercel](https://vercel.com/)
  - Backend: [Render](https://render.com/)
  - Database: [Supabase Managed PostgreSQL](https://supabase.com/)

---

## 🛠️ Local Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/Tamizholiyan/FairShake.git
cd FairShake
```

### 2. Configure Environment Variables

**Backend (`backend/.env`)**:
```env
PORT=5000
DATABASE_URL=postgres://postgres.yjmparxanihpycnmzqgm:Fairshake%40teamragnarok@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
JWT_SECRET=fairshake-super-secret-production-key-2026
RAZORPAY_KEY_ID=rzp_test_YourKeyHere
RAZORPAY_KEY_SECRET=YourSecretHere
```

**Frontend (`frontend/.env.local`)**:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_YourKeyHere
```

### 3. Run Migrations & Seed Database
```bash
cd backend
npm install
node src/scripts/ensure-schema.js
```

### 4. Start the Application

**Start Backend (Terminal 1)**:
```bash
cd backend
npm run dev
# Server running on http://localhost:5000
```

**Start Frontend (Terminal 2)**:
```bash
cd frontend
npm install
npm run dev
# App running on http://localhost:3000
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Automated Test Suite

Fairshake includes an automated test runner validating the core business logic, finite state machine, Razorpay HMAC signatures, and database constraints:

```bash
cd backend
npm run test
```

### Test Coverage (19/19 Tests Passing — 100%):
- ✅ **Milestone State Machine Transitions** (`PENDING` $\rightarrow$ `SUBMITTED` $\rightarrow$ `RELEASED`)
- ✅ **Dispute & Revision Re-upload Loop** (`IN_MEDIATION` $\rightarrow$ `REVISION_REQUESTED` $\rightarrow$ `SUBMITTED` $\rightarrow$ `RELEASED`)
- ✅ **Admin ID Whitelist Regex Validation** (`^ADM\d{3}$`)
- ✅ **Razorpay HMAC-SHA256 Webhook & Signature Verification**
- ✅ **Automatic Project Completion on Final Milestone Release**
- ✅ **Database Schema Integrity & Foreign Key Cascades**

---

## 👥 Team Ragnarok
- **Fairshake**: Bringing trust, transparency, and certainty to local service commerce.
