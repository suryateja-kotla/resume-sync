#!/usr/bin/env bash
#
# One-time setup of production secrets in GCP Secret Manager.
#
#   bash docs/deployment/setup_production_secrets.sh
#
# Run this ONCE from your own machine, not from CI. It prompts for each secret
# so nothing is ever typed on a command line (where it would land in your shell
# history) or committed to the repo.
#
# Re-running is safe: it adds a new version to an existing secret rather than
# failing, which is also how you rotate a value later.
#
# The pipeline then references these by name via --set-secrets, so CI never
# holds the values themselves — only permission to mount them.

set -euo pipefail

PROJECT="sync-folio"
RUNTIME_SA="sync-folio-backend@${PROJECT}.iam.gserviceaccount.com"

# name:prompt
SECRETS=(
  "entra-client-secret:Entra client secret VALUE (not the Secret ID)"
  "smtp-password:Password for Sync-Folio@sailssoftware.com"
  "mongo-uri:Full MongoDB/Firestore connection URI"
  "langfuse-secret-key:Langfuse secret key (blank to skip)"
)

echo
echo "Setting up secrets in project: ${PROJECT}"
echo "Runtime service account:       ${RUNTIME_SA}"
echo

gcloud services enable secretmanager.googleapis.com --project="${PROJECT}" --quiet

for entry in "${SECRETS[@]}"; do
  name="${entry%%:*}"
  prompt="${entry#*:}"

  echo "──────────────────────────────────────────────────────────────"
  # -s hides the input; the value never appears on screen or in history.
  read -rsp "  ${prompt}: " value
  echo

  if [[ -z "${value}" ]]; then
    echo "  skipped (empty)"
    continue
  fi

  if gcloud secrets describe "${name}" --project="${PROJECT}" >/dev/null 2>&1; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" \
      --data-file=- --project="${PROJECT}" --quiet
    echo "  updated — new version added"
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" \
      --data-file=- --replication-policy=automatic \
      --project="${PROJECT}" --quiet
    echo "  created"
  fi

  # The Cloud Run runtime identity needs to read it at container start.
  gcloud secrets add-iam-policy-binding "${name}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role=roles/secretmanager.secretAccessor \
    --project="${PROJECT}" --quiet >/dev/null
  echo "  access granted to ${RUNTIME_SA}"

  unset value
done

echo
echo "──────────────────────────────────────────────────────────────"
echo "Done. Verify with:"
echo "   gcloud secrets list --project=${PROJECT}"
echo
echo "The pipeline mounts these by name; it never sees the values."
