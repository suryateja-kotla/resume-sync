import os
import base64
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

LANGFUSE_PUBLIC_KEY = os.environ["LANGFUSE_PUBLIC_KEY"]
LANGFUSE_SECRET_KEY = os.environ["LANGFUSE_SECRET_KEY"]
LANGFUSE_HOST = os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com")


def init_tracing():
    """Initialize OpenTelemetry with Langfuse exporter."""

    # Langfuse expects Basic Auth: base64(public:secret)
    auth = base64.b64encode(
        f"{LANGFUSE_PUBLIC_KEY}:{LANGFUSE_SECRET_KEY}".encode()
    ).decode()

    exporter = OTLPSpanExporter(
        endpoint=f"{LANGFUSE_HOST}/api/public/otel/v1/traces",
        headers={"Authorization": f"Basic {auth}"},
    )

    provider = TracerProvider()
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    print("✅ Langfuse tracing initialized")
    return trace.get_tracer("resume_management_system")
