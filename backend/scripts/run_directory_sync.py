"""
Run the Entra directory sync on demand.

    cd backend && python scripts/run_directory_sync.py            # no invites
    cd backend && python scripts/run_directory_sync.py --invites  # send invites

Invites are OFF by default, and that default matters for the first run: an
intern only counts as "converted" if we previously had them on record as an
intern. On a first sync nobody is on record, so nothing fires — but once the
baseline exists, a later run with --invites will correctly catch real
conversions. Running with invites on a database in an unknown state risks
emailing people who did not just convert.

Safe to run repeatedly; the sync is idempotent.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.directory_sync import run_directory_sync  # noqa: E402


async def main() -> int:
    send_invites = "--invites" in sys.argv

    print("\nEntra directory sync")
    print("=" * 60)
    print(f"  invites: {'ENABLED' if send_invites else 'disabled (use --invites to enable)'}")
    print()

    summary = await run_directory_sync(send_invites=send_invites)

    if summary.get("aborted"):
        print(f"  ABORTED: {summary['aborted']}")
        print("  Nothing was written.")
        return 1

    print(f"  directory users   {summary['total_directory']:>5}")
    print(f"  upserted          {summary['upserted']:>5}")
    print(f"  can sign in       {summary['can_sign_in']:>5}")
    print(f"  deactivated       {summary['deactivated']:>5}")
    print(f"  intern conversions{summary['converted']:>5}")
    print(f"  invites sent      {summary['invites_sent']:>5}")
    print(f"  errors            {summary['errors']:>5}")
    print(f"  duration          {summary['duration_seconds']:>5}s")

    conflicts = summary.get("conflicts") or []
    duplicates = summary.get("duplicate_employee_ids") or []

    if conflicts:
        print()
        print("  IDENTITY CONFLICTS — not synced, needs an HR data fix")
        print("  " + "-" * 58)
        for c in conflicts:
            print(f"    {c['name']} ({c['email']})")
            print(f"       Entra says employeeId = {c['entra_employee_id']}")
            print(f"       app  holds employeeId = {c['app_employee_id']}")
            print("       Their profile and resume stay under the app's id.")

    if duplicates:
        print()
        print("  DUPLICATE EMPLOYEE IDs — two accounts share one app identity")
        print("  " + "-" * 58)
        for d in duplicates:
            print(f"    {d['employee_id']}:")
            for addr in d["accounts"]:
                print(f"       {addr}")

    print()
    # Conflicts and duplicates are data problems, not sync failures — the run
    # itself succeeded. Exit non-zero only on unexpected errors, so a cron
    # wrapper does not alarm every night over a known-bad record.
    unexpected = summary["errors"] - len(conflicts)
    return 1 if unexpected > 0 else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
