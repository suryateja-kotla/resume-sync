import os
import datetime
from google.cloud import storage

GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "sync-folio-resumes")
GCS_RESUME_PREFIX = "employee-resumes"

# Lazily constructed — importing this module (e.g. transitively via
# db_service) must not require GCS credentials to be present. Only actually
# touching a resume (upload/delete/sign) needs them.
_bucket = None


def _get_bucket():
    global _bucket
    if _bucket is None:
        _bucket = storage.Client().bucket(GCS_BUCKET_NAME)
    return _bucket


def build_blob_name(employee_id: str, filename: str) -> str:
    return f"{GCS_RESUME_PREFIX}/{employee_id}/{filename}"


def upload_resume(local_path: str, employee_id: str, filename: str) -> str:
    """Uploads a locally-generated resume file to GCS and returns its blob name.
    The blob name (not a URL) is what gets stored in resume_store.resume_path —
    URLs are generated on demand via get_signed_url() so access stays short-lived."""
    blob_name = build_blob_name(employee_id, filename)
    blob = _get_bucket().blob(blob_name)
    blob.upload_from_filename(local_path)
    return blob_name


def delete_resume(blob_name: str) -> None:
    """Deletes a resume blob if it exists. Safe to call on a stale/missing blob."""
    blob = _get_bucket().blob(blob_name)
    if blob.exists():
        blob.delete()


def get_signed_url(blob_name: str, expires_in_minutes: int = 60) -> str:
    """Short-lived signed URL so HR's Excel export can link to a private
    resume file without the bucket ever needing to be publicly readable.
    Requires the caller's credentials to include a private key (a service
    account) — plain user ADC tokens can't sign. Use download_resume_bytes()
    instead when only object read access is available."""
    blob = _get_bucket().blob(blob_name)
    return blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(minutes=expires_in_minutes),
        method="GET",
    )


def download_resume_bytes(blob_name: str) -> bytes:
    """Reads a resume blob's bytes directly — used to proxy the file through
    our own backend for preview, since that only needs object read access
    (not the signing-key permission generate_signed_url requires)."""
    return _get_bucket().blob(blob_name).download_as_bytes()
