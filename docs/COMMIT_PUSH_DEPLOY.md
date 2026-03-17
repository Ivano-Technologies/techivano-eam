# Commit, Push, and Deploy (Single Vercel Project)

Use this as a Cursor prompt when you need to safely commit, run the full test pipeline, and deploy.

---

## Context

You are a senior DevOps engineer working on the Techivano EAM repository.

The system uses a **single Vercel project** with multiple domains:

- **admin.techivano.com** → Admin EAM  
- **nrcseam.techivano.com** → NRCS EAM  
- **techivano.com** → Marketing site  

All apps are deployed together; routing is handled via hostname detection in the app.

---

## Objective

Safely commit all changes, run the full test pipeline, and deploy to Vercel **only if everything passes**.

---

## Steps

### STEP 1 — Verify Git State

Run:

```bash
git status
```

If there are unstaged changes:

```bash
git add .
```

Ensure:

- No merge conflicts  
- No unintended files  

---

### STEP 2 — Run Full Test Pipeline

Run:

```bash
pnpm tsx scripts/run-e2e-auth-full.ts
```

This must pass:

- Auth tests  
- RBAC tests  
- Multi-tenant tests  
- Session + security tests  

**If ANY test fails:**

- **STOP**  
- Output the error  
- **DO NOT continue**  

---

### STEP 3 — Commit

If all tests pass:

```bash
git commit -m "feat(platform): complete enterprise auth, RBAC, MFA, audit, impersonation, session security, and unified multi-domain deployment

Implement org-scoped RBAC with permissions
Add global owner override with MFA enforcement
Add audit logging and impersonation
Add session tracking and revocation
Harden CI pipeline with deterministic seeding
Support multi-domain deployment (admin, nrcs, marketing) via host-based routing"
```

(Adjust the message as needed for the actual change.)

---

### STEP 4 — Push

Run:

```bash
git push origin main
```

Ensure push succeeds.

---

### STEP 5 — Deploy (Vercel)

With Vercel connected to the repo:

- Deployment will trigger automatically on push to `main`  
- Wait for the GitHub Actions workflow **Techivano Auto Deploy** to complete (test → deploy)  

---

### STEP 6 — Verify

Check:

- https://admin.techivano.com  
- https://nrcseam.techivano.com  
- https://techivano.com  

Ensure:

- Correct app loads per domain  
- Auth works  
- RBAC works  
- No runtime errors  

---

## Safety Rules

- **NEVER** deploy if tests fail  
- **NEVER** skip the test pipeline  
- **ALWAYS** verify domains after deploy  

---

## Success Criteria

- Tests pass  
- Code committed  
- Push successful  
- Vercel deployment succeeds  
- All domains working correctly  

Provide a summary:

- Test result  
- Commit hash  
- Deployment status  
