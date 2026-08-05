# Entra ID SSO — Setup Guide

How to wire SyncFolio to Microsoft Entra ID (Azure AD) so employees sign in
with their Outlook work account.

---

## 1. Collect three values from the app registration

Azure portal → **Microsoft Entra ID** → **App registrations** → your app.

On the **Overview** blade:

| Portal label | Goes into |
|---|---|
| Application (client) ID | `ENTRA_CLIENT_ID` |
| Directory (tenant) ID | `ENTRA_TENANT_ID` |

Then **Certificates & secrets** → **Client secrets**.

> ### The one trap here
>
> A client secret shows **two** columns: **Secret ID** and **Value**.
>
> - **Secret ID** is a GUID that identifies the secret. It is *not* a credential and will not authenticate anything.
> - **Value** is the actual secret. It looks like `Xy8Q~aBcD...` — longer, mixed characters, not a GUID.
>
> The Value is shown **only once**, at creation. If the page now shows it masked
> or you only wrote down the GUID, you cannot recover it — click
> **New client secret** and copy the Value immediately.

`ENTRA_CLIENT_SECRET` is the **Value**.

---

## 2. Register the redirect URI

Same app registration → **Authentication** → **Add a platform** → **Web**.

Add both, so local development and production work from one registration:

```
http://localhost:8000/api/auth/callback
https://sync-folio-backend-327366424759.us-central1.run.app/api/auth/callback
```

Entra compares this string **exactly**. A trailing slash, `http` vs `https`, or a
different port all fail the callback with `AADSTS50011: redirect_uri mismatch`.

Leave **Implicit grant** (access tokens / ID tokens) **unchecked** — this app uses
the authorization-code flow with PKCE, which does not need it. Ticking those boxes
enables a weaker legacy flow.

---

## 3. Confirm API permissions

**API permissions** should show, all with admin consent granted:

| Permission | Type | Purpose |
|---|---|---|
| `openid` | Delegated | Sign-in |
| `profile` | Delegated | Name claims |
| `email` | Delegated | Email claim |
| `User.Read` | Delegated | `/me` — job title, department, office |
| `User.Read.All` | Application | Directory sync — reads `employeeId` for everyone |
| `Mail.Send` | Application | Reserved for later; SMTP is used for now |

---

## 4. Paste the values

### Local

`backend/.env` already has the block. Fill in the three blanks:

```dotenv
ENTRA_TENANT_ID=<Directory (tenant) ID>
ENTRA_CLIENT_ID=<Application (client) ID>
ENTRA_CLIENT_SECRET=<the secret VALUE>
```

Leave the rest of the block as-is for local work — `SESSION_COOKIE_SAMESITE=lax`
and `SESSION_COOKIE_SECURE=false` are correct for plain-http localhost.

Set `ADMIN_EMAILS` to your own work email so you can reach the admin views.

`backend/.env` is gitignored. Do not commit the secret.

### Production (Cloud Run)

Store the secret in Secret Manager rather than as a plain env var, so it is not
readable from the service description:

```bash
printf '%s' '<the secret VALUE>' | \
  gcloud secrets create entra-client-secret --data-file=- --project=sync-folio

gcloud secrets add-iam-policy-binding entra-client-secret \
  --member=serviceAccount:sync-folio-backend@sync-folio.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor --project=sync-folio
```

Then on the service:

```bash
gcloud run services update sync-folio-backend --region=us-central1 \
  --set-secrets=ENTRA_CLIENT_SECRET=entra-client-secret:latest \
  --set-env-vars=\
ENTRA_TENANT_ID=<tenant>,\
ENTRA_CLIENT_ID=<client>,\
ENTRA_REDIRECT_URI=https://sync-folio-backend-327366424759.us-central1.run.app/api/auth/callback,\
FRONTEND_BASE_URL=https://sync-folio-327366424759.us-central1.run.app,\
ALLOWED_ORIGINS=https://sync-folio-327366424759.us-central1.run.app,\
SESSION_COOKIE_SAMESITE=none,\
SESSION_COOKIE_SECURE=true
```

`SAMESITE=none` is required in production because the frontend and backend are on
different `*.run.app` hosts. `run.app` is on the Public Suffix List, so browsers
treat them as separate sites and would drop a `lax` cookie on the API call.

---

## 5. Verify

```bash
cd backend && python -c "
from config.entra_config import settings as s
s.validate(); print('Entra config OK — admins:', s.admin_email_list)"
```

A `RuntimeError` naming the missing variables means the paste did not take.
The app deliberately refuses to start in that state rather than run without
working authentication.

---

## Running it locally

Two processes, and the ports matter — the redirect URI is registered against
`localhost:8000`:

```bash
cd backend  && python -m uvicorn main:app --port 8000
cd frontend && npm run dev          # serves on 4200
```

Open <http://localhost:4200>, click **Sign in with Microsoft**.

Cookies work in local development because `localhost:4200` and `localhost:8000`
are the **same site** — cookie scope ignores the port. That is why
`SESSION_COOKIE_SAMESITE=lax` is correct locally but must be `none` in
production, where the two Cloud Run hosts are genuinely different sites.

## How the frontend authenticates

There is no token anywhere in the browser.

```
1. Click "Sign in with Microsoft"
   -> full navigation to  GET {API}/auth/login
2. Backend mints state + nonce + PKCE verifier, 302 to Microsoft
3. User authenticates; Microsoft 302s back to /api/auth/callback
4. Backend exchanges the code, verifies the id_token, resolves the persona,
   creates a server-side session, sets two cookies, 302 to the frontend
5. Frontend calls GET /auth/me to learn who it is
```

| Cookie | httpOnly | Purpose |
|---|---|---|
| `sf_session` | **yes** | Opaque session id. Unreadable from JavaScript, so an XSS cannot steal it. |
| `sf_csrf` | no | Deliberately readable — the frontend echoes it in `X-CSRF-Token` on every POST/PUT/PATCH/DELETE. |

`axios.ts` sets `withCredentials: true` and attaches the CSRF header
automatically. A 401 on any call redirects to `/login`; there is no silent
refresh, because the backend slides the idle window forward on every request,
so a 401 means the session is genuinely gone.

The client is no longer the authority on its own identity — the role comes from
`/auth/me`, not from anything the browser stores.

## Persona rules

Set by env, evaluated in this order:

```
ADMIN     ADMIN_EMAILS contains the signed-in email
HR        department ∈ HR_DEPARTMENTS  OR  jobTitle ∈ HR_JOB_TITLES
EMPLOYEE  everyone else
```

HR is read-only plus Excel export. Delete-employee and the audit log are ADMIN-only.

Matching is case-insensitive and trimmed, because the tenant's free-text fields
drift in casing.

To grant someone admin rights, add their email to `ADMIN_EMAILS` and redeploy.
That is deliberate — it keeps the admin set in access-controlled deployment
config rather than in a database row anyone with Mongo access could edit.

## Login gating

Interns cannot sign in. A person is treated as permanent only when **both**
signals agree:

- `employeeType` contains none of `INTERN_TYPE_MARKERS` (default: `intern`)
- `employeeId` does not start with `INTERN_ID_PREFIX` (default: `T`)

Interns are still synced from the directory and visible to HR in the Talent Pool
section. When their record flips to permanent, the sync sends them an invite to
create their profile and upload a resume.
