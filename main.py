import base64
import binascii
import logging
import os
import sys
import threading
import time
import urllib.parse
import webbrowser
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from chrome_lens_py import LensAPI, LensAPIError, LensImageError
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cardlens")


@asynccontextmanager
async def lifespan(app: Starlette):
    """Lifecycle manager for Starlette app: initialize and close LensAPI and HTTP proxy clients."""
    logger.info("Initializing LensAPI client...")
    lens = LensAPI()
    app.state.lens = lens
    http_client = httpx.AsyncClient(timeout=15.0)
    app.state.http_client = http_client

    port = os.environ.get("PORT", "5050")
    lan_ip = ""
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lan_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass
    lan_msg = f"  Network address: http://{lan_ip}:{port}\n" if lan_ip and not lan_ip.startswith("127.") else ""

    print(
        f"\n"
        f"================================================\n"
        f"  CardLens 🔍🎴 Server is running!\n"
        f"  Open in browser: http://localhost:{port}\n"
        f"  Local address:   http://127.0.0.1:{port}\n"
        f"{lan_msg}"
        f"================================================\n",
        flush=True,
    )

    yield
    logger.info("Closing LensAPI and HTTP proxy clients...")
    try:
        await lens.aclose()
    except Exception as e:
        logger.warning(f"Error closing LensAPI: {e}")
    try:
        await http_client.aclose()
    except Exception as e:
        logger.warning(f"Error closing HTTP proxy client: {e}")


async def health_check(request: Request) -> JSONResponse:
    """Health check endpoint to verify server is running."""
    return JSONResponse({"status": "ok", "app": "CardLens"})


async def ocr_endpoint(request: Request) -> JSONResponse:
    """
    Process image using Google Lens OCR via chrome-lens-py.
    Accepts raw Base64 or Data URI format ('data:image/...;base64,...').
    """
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"detail": "Invalid JSON body."}, status_code=400)

    if not isinstance(data, dict) or "image" not in data:
        return JSONResponse({"detail": "Field 'image' is required."}, status_code=422)

    image_raw = data.get("image")
    if not isinstance(image_raw, str):
        return JSONResponse({"detail": "Field 'image' must be a string."}, status_code=400)

    image_str = image_raw.strip()
    if not image_str:
        return JSONResponse({"detail": "Image data must not be empty."}, status_code=400)

    # Language parameter: if omitted, default to 'ja'. If empty string or null, pass None to enable auto-detection in Lens.
    language = "ja"
    if "language" in data:
        lang_val = data.get("language")
        if lang_val is None:
            language = None
        elif isinstance(lang_val, str):
            lang_clean = lang_val.strip()
            language = lang_clean if lang_clean else None
        else:
            language = str(lang_val).strip() or None

    # Strip Data URI prefix if present (e.g. 'data:image/jpeg;base64,...')
    if "," in image_str:
        header, _, image_str = image_str.partition(",")
        image_str = image_str.strip()

    # Decode Base64
    try:
        image_bytes = base64.b64decode(image_str, validate=True)
    except (binascii.Error, ValueError) as err:
        return JSONResponse(
            {"detail": f"Invalid Base64 encoding: {str(err)}"},
            status_code=400,
        )

    if not image_bytes:
        return JSONResponse(
            {"detail": "Decoded image payload is empty."},
            status_code=400,
        )

    # Acquire LensAPI client instance from app state
    lens: Optional[LensAPI] = getattr(request.app.state, "lens", None)
    own_lens = False
    if lens is None:
        lens = LensAPI()
        own_lens = True

    try:
        result = await lens.process_image(
            image_bytes,
            ocr_language=language,
            output_format="full_text",
        )
    except LensImageError as err:
        return JSONResponse(
            {"detail": f"Invalid image format: {str(err)}"},
            status_code=400,
        )
    except LensAPIError as err:
        logger.error(f"Lens API error: {err}")
        return JSONResponse(
            {"detail": f"Upstream OCR service error: {str(err)}"},
            status_code=502,
        )
    except Exception as err:
        logger.exception(f"Unexpected error during OCR processing: {err}")
        return JSONResponse(
            {"detail": f"Internal OCR error: {str(err)}"},
            status_code=500,
        )
    finally:
        if own_lens:
            await lens.aclose()

    ocr_text = result.get("ocr_text", "")
    detected_lang = result.get("detected_language")

    return JSONResponse({
        "text": ocr_text.strip() if ocr_text else "",
        "detected_language": detected_lang,
    })


def is_safe_local_url(url: str) -> bool:
    """Validate target URL to ensure requests only route to local or private network instances."""
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = (parsed.hostname or "").lower()
        if hostname in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            return True
        # Allow standard RFC 1918 private IPv4 addresses (LAN devices)
        if hostname.startswith("192.168.") or hostname.startswith("10.") or hostname.startswith("172."):
            return True
        return False
    except Exception:
        return False


async def client_info_endpoint(request: Request) -> JSONResponse:
    """
    Return caller's client IP, remote connection status, and suggested AnkiConnect target URL.
    Used by the frontend to detect if running on a remote/customer device (e.g. phone accessing Termux server)
    and automatically configure AnkiConnect to target this phone.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    is_local = client_ip in ("127.0.0.1", "localhost", "::1", "testclient")
    suggested_anki_url = f"http://{client_ip}:8765" if not is_local else "http://localhost:8765"
    return JSONResponse({
        "client_ip": client_ip,
        "is_remote": not is_local,
        "suggested_anki_url": suggested_anki_url,
    })


async def ankiconnect_proxy_endpoint(request: Request) -> JSONResponse:
    """
    Transparent proxy endpoint for AnkiConnect requests.
    Eliminates CORS origin blocking on PC desktop browsers (where AnkiConnect rejects localhost:5050).
    When accessed by a remote client (e.g. customer phone accessing Termux server), automatically
    falls back to routing requests to AnkiConnect on the client's device if localhost is unreachable on server.
    """
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON payload."}, status_code=400)

    if not isinstance(data, dict):
        return JSONResponse({"error": "JSON payload must be an object."}, status_code=400)

    client_host = request.client.host if request.client else "127.0.0.1"
    is_remote_client = client_host not in ("127.0.0.1", "localhost", "::1", "testclient") and is_safe_local_url(f"http://{client_host}:8765")

    # Determine destination URL (from header or payload)
    target_url = request.headers.get("X-Anki-Url") or data.get("ankiUrl") or "http://127.0.0.1:8765"
    if not isinstance(target_url, str):
        return JSONResponse({"error": "Target URL must be a string."}, status_code=400)

    # Support special @client or client host alias
    try:
        parsed_target = urllib.parse.urlparse(target_url)
        if parsed_target.hostname in ("@client", "client") and is_remote_client:
            port = parsed_target.port or 8765
            target_url = f"http://{client_host}:{port}"
    except Exception:
        pass

    if not is_safe_local_url(target_url):
        return JSONResponse({"error": f"Invalid or disallowed target URL: {target_url}"}, status_code=400)

    # Clean payload for AnkiConnect
    payload = {k: v for k, v in data.items() if k != "ankiUrl"}

    client: Optional[httpx.AsyncClient] = getattr(request.app.state, "http_client", None)
    own_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=15.0)
        own_client = True

    try:
        try:
            resp = await client.post(target_url, json=payload)
            resp_data = resp.json()
            return JSONResponse(resp_data, status_code=resp.status_code)
        except httpx.ConnectError:
            # If target was localhost/127.0.0.1 on the server and connection was refused,
            # but the caller is a remote LAN device (e.g. customer phone accessing Termux server):
            # Automatically fall back to trying AnkiConnect on the caller's phone!
            parsed = urllib.parse.urlparse(target_url)
            if is_remote_client and (parsed.hostname or "").lower() in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
                port = parsed.port or 8765
                fallback_url = f"http://{client_host}:{port}"
                logger.info(
                    f"AnkiConnect unreachable on server localhost; auto-routing to client device at {fallback_url}"
                )
                try:
                    resp = await client.post(fallback_url, json=payload)
                    resp_data = resp.json()
                    return JSONResponse(resp_data, status_code=resp.status_code)
                except httpx.ConnectError:
                    return JSONResponse(
                        {
                            "error": (
                                f"Cannot connect to AnkiConnect on server ({target_url}) or device ({fallback_url}). "
                                "If on phone: ensure AnkiConnect Android is started. "
                                "If on PC: ensure 'webBindAddress': '0.0.0.0' is set in AnkiConnect add-on config and Anki is open."
                            )
                        },
                        status_code=502,
                    )
            return JSONResponse(
                {"error": f"Cannot connect to AnkiConnect at {target_url}. Connection refused."},
                status_code=502,
            )
    except httpx.TimeoutException:
        return JSONResponse(
            {"error": f"Connection to AnkiConnect at {target_url} timed out."},
            status_code=504,
        )
    except Exception as err:
        return JSONResponse(
            {"error": f"AnkiConnect proxy error: {str(err)}"},
            status_code=502,
        )
    finally:
        if own_client:
            await client.aclose()


class NoCacheStaticMiddleware(BaseHTTPMiddleware):
    """Ensure HTML, JS, CSS, and manifest files are never served stale by aggressive browser caches."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path.endswith((".html", ".js", ".css", ".json", "/")) or path == "":
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response


middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    ),
    Middleware(NoCacheStaticMiddleware),
]

routes = [
    Route("/health", health_check, methods=["GET"]),
    Route("/ocr", ocr_endpoint, methods=["POST"]),
    Route("/api/client-info", client_info_endpoint, methods=["GET"]),
    Route("/client-info", client_info_endpoint, methods=["GET"]),
    Route("/api/ankiconnect", ankiconnect_proxy_endpoint, methods=["POST"]),
    Route("/ankiconnect", ankiconnect_proxy_endpoint, methods=["POST"]),
]

# Mount static files for PWA frontend (supports PyInstaller bundle extraction)
base_dir = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
frontend_dir = os.path.join(base_dir, "frontend")
if os.path.isdir(frontend_dir):
    routes.append(Mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend"))

app = Starlette(
    routes=routes,
    middleware=middleware,
    lifespan=lifespan,
)


def cli():
    """Command-line entrypoint for CardLens."""
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="CardLens Server")
    parser.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"), help="Host to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "5050")), help="Port to bind (default: 5050)")
    parser.add_argument("--open-browser", action="store_true", help="Open browser on startup")
    parser.add_argument("--no-browser", action="store_true", help="Do not open browser on startup")
    args = parser.parse_args()

    is_frozen = getattr(sys, "frozen", False)
    should_open = (is_frozen or args.open_browser or os.environ.get("CARDLENS_OPEN_BROWSER") == "1") and not (
        args.no_browser or os.environ.get("CARDLENS_NO_BROWSER") == "1"
    )

    if should_open:
        def _open():
            time.sleep(1.0)
            webbrowser.open(f"http://localhost:{args.port}")

        threading.Thread(target=_open, daemon=True).start()

    # Pass app object directly to support PyInstaller frozen executables
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        reload=False,
    )


if __name__ == "__main__":
    cli()


