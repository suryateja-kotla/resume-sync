"""
Entra SSO preflight check.

Run after pasting credentials, and any time sign-in misbehaves:

    cd backend && python scripts/verify_entra.py

Checks four things in order, stopping at the first failure:

  1. Config is present and internally consistent.
  2. The tenant resolves via OIDC discovery.
  3. client_id + client_secret actually authenticate (client-credentials grant).
  4. The app-only token can read the directory and see `employeeId`, which is
     the field the whole identity mapping depends on.

Never prints the secret. Failures print the Entra error code, because those
codes (AADSTS...) are the fastest route to a fix.
"""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1]))

from config.entra_config import settings  # noqa: E402

OK, BAD = "  [OK]  ", "  [FAIL]"


def _post_form(url: str, form: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(form).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def _get_json(url: str, token: str | None = None) -> dict:
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def main() -> int:
    print("\nEntra SSO preflight\n" + "=" * 60)

    # 1 ── config -----------------------------------------------------------
    print("\n1. Configuration")
    try:
        settings.validate()
    except RuntimeError as exc:
        print(BAD, exc)
        return 1
    secret_len = len(settings.entra_client_secret)
    print(OK, f"tenant / client / secret present (secret is {secret_len} chars)")
    if secret_len < 40:
        print(
            "        note: Azure normally issues 40-character secret Values. A shorter"
        )
        print(
            "        one usually means a character was lost copying it from the portal."
        )
    print(OK, f"admins: {', '.join(settings.admin_email_list)}")
    print(OK, f"redirect_uri: {settings.entra_redirect_uri}")

    # 2 ── tenant discovery -------------------------------------------------
    print("\n2. Tenant reachability")
    try:
        doc = _get_json(f"{settings.authority}/v2.0/.well-known/openid-configuration")
    except Exception as exc:
        print(BAD, f"OIDC discovery failed: {exc}")
        print("        Check ENTRA_TENANT_ID is the Directory (tenant) ID.")
        return 1
    if doc["issuer"] != settings.issuer:
        print(BAD, f"issuer mismatch: {doc['issuer']} != {settings.issuer}")
        return 1
    print(OK, f"issuer verified: {doc['issuer']}")

    # 3 ── credentials ------------------------------------------------------
    print("\n3. Client credentials")
    try:
        token_response = _post_form(
            settings.token_endpoint,
            {
                "client_id": settings.entra_client_id,
                "client_secret": settings.entra_client_secret,
                "scope": settings.graph_app_scope,
                "grant_type": "client_credentials",
            },
        )
    except urllib.error.HTTPError as exc:
        detail = json.loads(exc.read().decode())
        code = detail.get("error_description", "").split(":")[0]
        print(BAD, f"{detail.get('error')} — {code}")
        if "7000215" in code:
            print("        The secret is wrong. Generate a NEW client secret and copy")
            print("        the Value column with the copy icon, not by selecting text.")
        elif "7000222" in code:
            print("        The secret has expired. Generate a new one.")
        elif "700016" in code:
            print("        The client_id is not an app in this tenant.")
        return 1
    app_token = token_response["access_token"]
    print(OK, f"app-only token acquired (expires in {token_response['expires_in']}s)")

    # 4 ── directory read ---------------------------------------------------
    print("\n4. Directory access (User.Read.All)")
    fields = "id,displayName,mail,employeeId,employeeType,jobTitle,department,accountEnabled,userType"
    try:
        page = _get_json(
            f"https://graph.microsoft.com/v1.0/users?$select={fields}&$top=25",
            app_token,
        )
    except urllib.error.HTTPError as exc:
        detail = json.loads(exc.read().decode()).get("error", {})
        print(BAD, f"{detail.get('code')}: {detail.get('message', '')[:160]}")
        print("        Confirm User.Read.All (Application) has admin consent granted.")
        return 1

    users = page.get("value", [])
    with_id = [u for u in users if u.get("employeeId")]
    print(OK, f"read {len(users)} users; {len(with_id)} have employeeId populated")

    if not with_id:
        print("        WARNING: no employeeId in this sample. Identity mapping relies")
        print("        on it — check whether HR populates it for all staff.")
    else:
        sample = with_id[0]
        print(
            f"        sample: {sample['employeeId']} | "
            f"{sample.get('department') or '-'} | {sample.get('jobTitle') or '-'}"
        )

    print("\n" + "=" * 60)
    print("All checks passed. Entra SSO is ready to wire up.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
