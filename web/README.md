# MarkovHealth Web Dashboard

The frontend and API orchestration layer for the MarkovHealth platform. Built with **Next.js 14**, this application serves as the interface between the clinical RL engine and the end-users.

## 🏗️ Architecture Overview

The web application acts as a central hub, orchestrating the following pipelines:

1. **Ingestion Pipeline**: 
   - Uses `pdf-parse` for client-side and server-side text extraction.
   - Implements a de-identification utility to ensure data privacy.
2. **Matching Engine**: 
   - Connects to Google Gemini via specialized `lib/gemini.ts` hooks.
   - Evaluates patient summaries against trial protocols.
3. **Logistics Dispatch**: 
   - Interfaces via HMAC-signed requests to the **FastAPI Logistics Engine**.
   - Triggers the RL solver to determine optimal transport actions.
4. **Real-time Map**: 
   - Integrated with **Mapbox GL** for geo-spatial visualization of matches and mobility units.

## 🚀 Deployment & Local Setup

### Environment Variables
Required keys in `.env`:
```bash
NEXTAUTH_SECRET=...
DATABASE_URL=...
GOOGLE_AI_API_KEY=...
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=...
NEXT_PUBLIC_FASTAPI_URL=...
```

### Commands
- `npm run dev`: Start the dev server.
- `npx prisma db push`: Sync schema to Supabase.
- `npx prisma generate`: Update the local client.

## 🔒 Security Posture
- **JWT-based Sessions**: Powered by NextAuth for secure multi-tenant access.
- **Role-Based Access Control (RBAC)**: Strict isolation between Patient and Researcher portals.
- **Audit Logging**: Every match request and logistics dispatch is audited in the internal `AuditRecord` log.

---
Built by [DeepMind / Advanced Agentic Coding Team] for MarkovHealth.