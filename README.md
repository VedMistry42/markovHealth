# MarkovHealth: Empathy-Optimized Clinical Recruitment

MarkovHealth is a precision-logistics platform designed to bridge the gap between breakthrough clinical research and the patients who need it most. By combining **Large Language Models (LLMs)** for trial matching with **Reinforcement Learning (RL)** for transport optimization, we bring the trial directly to the patient’s doorstep.

---

## 🚀 The Vision
Clinical trial dropout rates exceed 30%, often due to geographic and logistical burdens. MarkovHealth solves this by treating clinical recruitment as a **Logistics Optimization Problem**. 

We don't just find patients; we find the most empathetic way to deliver care—whether that’s via a mobile unit, a local clinic referral, or coordinated flight transport.

---

## 🛠️ How we built this

### 1. The Intelligence Layer (Matching & Extraction)
- **AI Matching**: We use **Google Gemini** (via Prisma-integrated hooks) to analyze complex trial protocols and patient medical records.
- **Privacy First**: Our pipeline includes a **Zero-Knowledge De-identification** layer. PHI (Personal Health Information) is stripped locally before any data reaches our LLM nodes.
- **Criteria Parsing**: We extract structured inclusion/exclusion criteria from unstructured PDFs, allowing for high-accuracy patient screening in seconds.

### 2. The RL Logistics Engine
- **Bellman Optimization**: Built on a **FastAPI** backend, our Reinforcement Learning engine solves the Markov Decision Process (MDP) for every match.
- **Reward Function**: $R(s,a) = \alpha \cdot M - \beta \cdot d \cdot F - \gamma \cdot C$
  - $M$: Match Confidence
  - $d$: Distance
  - $F$: Patient Fragility (extracted from ECOG status)
  - $C$: Logistics Cost
- **Real-time Routing**: The engine determines the optimal "Action" (e.g., Dispatching a Mobile Unit vs. Hub Flight) based on real-time traffic, patient fragility, and trial urgency.

### 3. The Tech Stack
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Framer Motion for micro-animations.
- **Visualization**: **Mapbox GL** for real-time tracking of mobile units and patient distribution.
- **Database**: **Supabase (Postgres)** with **Prisma ORM** for high-integrity schema management and real-time portal synchronization.
- **Deployment**: Optimized for speed with a distributed Next.js architecture.

---

## 🔑 Key Features
- **Researcher Map View**: A real-time command center showing prospective recruits, unit locations, and empathy scores.
- **Patient Dashboard**: Simplified clinical profile management with direct-to-coordinator messaging.
- **Encrypted Contact Reveal**: Patient privacy is protected until a high-confidence match is confirmed, at which point secure contact info is revealed to both parties.
- **Automated Kit Request**: Patients can trigger logistics kits (shipping, meds, transport) with a single click.

---

## 🏁 Getting Started

### Demo Credentials
- **Patient Portal**: `patient@demo.com` / `demo1234`
- **Clinician Portal**: `researcher@demo.com` / `demo1234`

### Local Development
1. Clone the repository.
2. Install dependencies: `npm install`
3. Set up your `.env` with Supabase and Google AI credentials.
4. Run the database sync: `npx prisma db push`
5. Start the engine: `npm run dev`

---

Built with ❤️ for a future where care follows the patient, not the other way around.