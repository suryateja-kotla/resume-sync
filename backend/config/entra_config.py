"""
Microsoft Entra ID (Azure AD) SSO configuration.

Holds the app-registration credentials and the rules that decide, from a
person's Entra profile, whether they may sign in at all and which persona
they get.

Two deliberate choices here:

- Nothing has a usable default. The old auth module fell back to a literal
  "change-me-in-production" JWT secret, which meant a missing env var
  produced a running-but-forgeable app instead of a failed boot. `validate()`
  is called at startup and refuses to start rather than run insecurely.

- List-shaped settings are declared as plain strings and split by the
  `*_list` properties. pydantic-settings tries to JSON-decode env values for
  `list[str]` fields, so `ADMIN_EMAILS=a@x.com,b@x.com` would raise a parse
  error. Comma-separated is what a human will actually type into Cloud Run,
  so we accept that and parse it ourselves.
"""

from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


def _split_csv(raw: str | None) -> list[str]:
    """Comma-separated env value -> normalized list. Casing and stray spaces
    are stripped because the tenant's free-text fields drift (we've seen both
    "Sails Software Inc" and "Sails software Inc")."""
    if not raw:
        return []
    return [item.strip().casefold() for item in raw.split(",") if item.strip()]


class EntraSettings(BaseSettings):
    # ── App registration (from the Azure portal) ──────────────────────────
    entra_tenant_id: str = ""
    entra_client_id: str = ""
    entra_client_secret: str = ""

    # Must exactly match a Web redirect URI on the app registration —
    # Entra string-compares this, so a trailing slash mismatch fails the
    # callback with AADSTS50011.
    entra_redirect_uri: str = "http://localhost:8000/api/auth/callback"

    # Where to send the browser once the callback completes.
    frontend_base_url: str = "http://localhost:4200"

    # ── Persona rules ─────────────────────────────────────────────────────
    # ADMIN: named Entra accounts. No shared credential exists anywhere.
    admin_emails: str = ""

    # HR: department match OR job-title match. Either one is sufficient.
    #
    # Covers the workforce functions (HR/TM/TA) plus the internal support
    # departments, all confirmed as needing the HR persona. Two notes:
    #
    #  - Misspelt departments ("Finanace") are handled by matches_any()'s
    #    typo tolerance rather than being listed here, so this stays a clean
    #    list of intended values.
    #  - "Support" and "Maternity Leave" are deliberately absent. The single
    #    Support account has no job title, and the Maternity Leave record is a
    #    Software Engineer whose department was overwritten with a leave
    #    status — neither should carry privileged access.
    hr_departments: str = (
        "HR,TM,TA,IT,Finance,Operations,"
        "Business Development,MMS,Management"
    )

    # Seniority-based HR access. VP/CBO/Account Director were added because
    # the original list granted HR to Directors while leaving the VP above
    # them — and the US-based managers — as plain employees.
    #
    # Note these are matched on title, not on the "SSUS" employee-id prefix:
    # that prefix marks US *location*, not seniority. Of 15 SSUS staff only 4
    # are managers; the other 11 are client-facing engineers who must stay
    # EMPLOYEE and keep receiving resume reminders.
    # "Delivery Manager" is listed separately from "Technical Delivery
    # Manager" — the two are the same function but the directory spells them
    # differently, and they are too far apart for typo tolerance to bridge.
    #
    # Only the two most senior architect titles are here. Architect is
    # technical seniority rather than a workforce function: Software / SDET /
    # Test Architects do not staff projects or run appraisals, so they have no
    # need to read every employee's resume and stay EMPLOYEE.
    hr_job_titles: str = (
        "Director of Technical Delivery-AI,"
        "Technical Delivery Manager,"
        "Director of Technical Delivery,"
        "VP of Technical Delivery,"
        "Delivery Manager,"
        "TM Business Partner,"
        "Account Director,"
        "Senior Account Director,"
        "Principal Architect,"
        "Senior Technical Architect,"
        "CBO,"
        "CEO"
    )

    # Departments excluded from the monthly resume-update email.
    #
    # The email chases people to keep their *technical* resume current, so the
    # non-technical support functions are suppressed. MMS is intentionally NOT
    # here — its two Technical Writers count as technical staff. Nor are the
    # client-delivery departments, which are the whole point of the exercise.
    #
    # "Maternity Leave" is suppressed for outreach only: that person keeps her
    # EMPLOYEE persona and can still sign in, she is just not chased monthly
    # while on leave. When HR restores her real department both the emails and
    # her normal treatment resume with no code change.
    email_excluded_departments: str = (
        "HR,TM,TA,IT,Finance,Operations,"
        "Business Development,Management,Support,Maternity Leave"
    )

    # Department whose members appear in the Talent Pool section.
    talent_pool_department: str = "Talent Pool"

    # Department aliases — "variant=canonical", comma separated.
    #
    # For departments IT creates under two genuinely different names, where
    # typo tolerance cannot help: "Biz Dev" and "Business Development" are not
    # one edit apart, and neither are "SpeechPandit" and "SpeechPundit"
    # (different word, not a slip). Aliasing is explicit precisely because
    # collapsing two departments is a judgement call, not something to infer.
    #
    # Applied before every department comparison and stored as
    # departmentCanonical, so HR reporting groups the variants as one team
    # while the raw Entra value is still kept for reference.
    # The canonical side is the more populated / more complete spelling, so
    # reporting settles on the name most of the team already uses.
    department_aliases: str = (
        # Different words — no edit distance could merge these safely.
        "SpeechPandit=SpeechPundit,"
        "Biz Dev=Business Development,"
        # Client prefix dropped on some records.
        "ACA=EFX-ACA,"
        "SI9=EFX-SI9,"
        "EFX-I9I=EFX-I9I-MSA,"
        "AI=AI CoE,"
        # Word split / typo that survives normalization: "paper trial" and
        # "papertrail" differ by a space *and* a transposition.
        "Paper Trial=PaperTrail,"
        "JobAlign=Job Align,"
        # Also fixed by typo tolerance, but aliased so departmentCanonical
        # groups it correctly for reporting rather than only matching for
        # access decisions.
        "Finanace=Finance"
    )

    # ── Identity reconciliation ───────────────────────────────────────────
    #
    # Maps an employeeId as Entra reports it to the id the app already holds
    # that person's data under. Applied everywhere identity is resolved — both
    # the directory sync and the sign-in callback — so a corrected person gets
    # a session under the right id and sees their own history.
    #
    # Without this, the mismatch is silent and nasty: they authenticate fine,
    # then land on an empty profile because their resume lives under another
    # key. Format: "entra_id=app_id", comma separated.
    #
    #   EFX-I9HQ -> SS471   Ashok Thota; a department name was typed into the
    #                       employeeId field in Entra
    #   SSUS11   -> SS044   Phani Sai Balantrapu; reissued a US id, but his
    #                       resume and skill history sit under SS044
    #
    # These are workarounds for directory data. Once HR corrects the Entra
    # records, remove the entry — leaving it would then silently rewrite a
    # correct id.
    employee_id_overrides: str = "EFX-I9HQ=SS471,SSUS11=SS044"

    # When two Entra accounts claim the same employeeId, this address wins and
    # the other account is skipped by the sync. Both accounts can still
    # authenticate — this only decides whose profile data is authoritative.
    #
    # The real fix is disabling the stale account in Entra; this keeps the
    # data correct until that happens.
    preferred_account_emails: str = (
        "satyasathvik.abhinay@sailssoftware.com,"
        "lakshmi.madabattula@sailssoftware.com"
    )

    # Fallback when a duplicated employeeId has no explicit preference above:
    # the account on the company's own domain wins over any external one.
    primary_email_domain: str = "sailssoftware.com"

    # ── Login gating ──────────────────────────────────────────────────────
    # Both signals must agree before someone is treated as permanent:
    # employeeType must not contain any of these, and employeeId must not
    # carry the intern prefix. Interns are synced and visible to HR but
    # cannot sign in.
    intern_type_markers: str = "intern"
    intern_id_prefix: str = "T"

    # ── Outbound email ────────────────────────────────────────────────────
    #
    # Mailbox that application mail is sent from, via Graph `Mail.Send`. Must
    # be a real mailbox in the tenant; there is no password, because app-only
    # Graph authenticates with the client secret above.
    #
    # Pinned in config rather than derived from a request: Mail.Send as an
    # application permission can send as *any* mailbox in the tenant, so the
    # sender must not be something the app can be talked into choosing.
    graph_mail_sender: str = ""

    # "graph" | "console". Console logs the message instead of sending, which
    # is what local development should use — otherwise a test run mails 280
    # real employees.
    email_delivery_mode: str = "console"

    # ── Scheduled job triggers ────────────────────────────────────────────
    #
    # Shared secret Cloud Scheduler presents in the X-Trigger-Token header to
    # run the directory sync and monthly email. Needed because the scheduler
    # has no session cookie and no browser to sign in with.
    #
    # Must be long and random — it is the only thing standing between the
    # public internet and a button that mails every employee. Generate with:
    #     python -c "import secrets; print(secrets.token_urlsafe(48))"
    #
    # Empty disables token-based triggering entirely, leaving the endpoints
    # reachable only by a signed-in ADMIN. That is the safe default: an
    # unset secret must never mean "no authentication required".
    job_trigger_token: str = ""

    # ── Session cookie ────────────────────────────────────────────────────
    # The cookie carries an opaque session id, never a token, so sessions
    # stay server-side revocable.
    session_cookie_name: str = "sf_session"
    # No csrf_cookie_name: the CSRF token used to also travel as a second,
    # JS-readable cookie, but a cookie set by the backend's origin is
    # invisible to document.cookie on the frontend's different *.run.app
    # origin — that field never worked. The token now travels inside the
    # JSON body of /auth/me instead (see auth_service.public_user).
    session_idle_minutes: int = 60
    session_absolute_hours: int = 8

    # SameSite=None is forced by the deployment shape: frontend and backend
    # sit on different *.run.app hosts, and run.app is on the Public Suffix
    # List, so the browser treats them as separate sites. None requires
    # Secure, which is why local dev over plain http needs these two
    # overridden to "lax" / false.
    session_cookie_samesite: str = "none"
    session_cookie_secure: bool = True

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # ── Derived Entra endpoints ───────────────────────────────────────────

    @property
    def authority(self) -> str:
        return f"https://login.microsoftonline.com/{self.entra_tenant_id}"

    @property
    def authorize_endpoint(self) -> str:
        return f"{self.authority}/oauth2/v2.0/authorize"

    @property
    def token_endpoint(self) -> str:
        return f"{self.authority}/oauth2/v2.0/token"

    @property
    def jwks_uri(self) -> str:
        return f"{self.authority}/discovery/v2.0/keys"

    @property
    def issuer(self) -> str:
        """Expected `iss` claim. Pinned to the tenant so a token minted by
        another tenant is rejected even though it is signed by Microsoft."""
        return f"{self.authority}/v2.0"

    @property
    def login_scopes(self) -> list[str]:
        """Delegated scopes for the sign-in flow. Matches what IT has already
        consented: openid, profile, email, User.Read."""
        return ["openid", "profile", "email", "User.Read"]

    @property
    def graph_app_scope(self) -> str:
        """Client-credentials scope for the directory sync, which runs under
        the app-only User.Read.All grant."""
        return "https://graph.microsoft.com/.default"

    # ── Parsed persona rules ──────────────────────────────────────────────

    @cached_property
    def admin_email_list(self) -> list[str]:
        return _split_csv(self.admin_emails)

    @cached_property
    def hr_department_list(self) -> list[str]:
        return _split_csv(self.hr_departments)

    @cached_property
    def hr_job_title_list(self) -> list[str]:
        return _split_csv(self.hr_job_titles)

    @cached_property
    def intern_type_marker_list(self) -> list[str]:
        return _split_csv(self.intern_type_markers)

    @cached_property
    def email_excluded_department_list(self) -> list[str]:
        return _split_csv(self.email_excluded_departments)

    @cached_property
    def employee_id_override_map(self) -> dict[str, str]:
        """{entra employeeId upper: app employeeId}. Compared case-insensitively
        because the directory's id casing is not consistent."""
        mapping: dict[str, str] = {}
        for pair in self.employee_id_overrides.split(","):
            entra_id, sep, app_id = pair.partition("=")
            if not sep:
                continue
            entra_id, app_id = entra_id.strip().upper(), app_id.strip()
            if entra_id and app_id:
                mapping[entra_id] = app_id
        return mapping

    @cached_property
    def preferred_account_email_list(self) -> list[str]:
        return _split_csv(self.preferred_account_emails)

    @cached_property
    def department_alias_map(self) -> dict[str, str]:
        """{normalized variant: normalized canonical}. Malformed entries are
        skipped rather than raising — a stray comma in an env var should not
        stop the service booting."""
        mapping: dict[str, str] = {}
        for pair in self.department_aliases.split(","):
            variant, sep, canonical = pair.partition("=")
            if not sep:
                continue
            variant, canonical = variant.strip().casefold(), canonical.strip().casefold()
            if variant and canonical:
                mapping[variant] = canonical
        return mapping

    # ── Startup validation ────────────────────────────────────────────────

    def validate(self) -> None:
        """Raises RuntimeError if SSO cannot work. Called from main.py's
        lifespan so a misconfigured deploy fails loudly at boot instead of
        serving an app nobody can log into."""
        missing = [
            name
            for name, value in (
                ("ENTRA_TENANT_ID", self.entra_tenant_id),
                ("ENTRA_CLIENT_ID", self.entra_client_id),
                ("ENTRA_CLIENT_SECRET", self.entra_client_secret),
            )
            if not value.strip()
        ]
        if missing:
            raise RuntimeError(
                "Entra SSO is not configured — missing: "
                + ", ".join(missing)
                + ". Set these in backend/.env locally, or as Cloud Run "
                "secrets in production. See docs/deployment/ENTRA_SSO_SETUP.md."
            )

        if not self.admin_email_list:
            raise RuntimeError(
                "ADMIN_EMAILS is empty — nobody would be able to administer "
                "the app. Set it to at least one Entra account email."
            )

        if self.session_cookie_samesite.casefold() == "none" and not self.session_cookie_secure:
            raise RuntimeError(
                "SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true — "
                "browsers reject SameSite=None cookies sent without Secure."
            )


settings = EntraSettings()
