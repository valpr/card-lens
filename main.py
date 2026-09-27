import base64
import binascii
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from chrome_lens_py import LensAPI, LensAPIError, LensImageError
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cardlens")


@asynccontextmanager
async def lifespan(app: Starlette):
    """Lifecycle manager for Starlette app: initialize and close LensAPI client."""
    logger.info("Initializing LensAPI client...")
    lens = LensAPI()
    app.state.lens = lens
    yield
    logger.info("Closing LensAPI client...")
    try:
        await lens.aclose()
    except Exception as e:
        logger.warning(f"Error closing LensAPI: {e}")


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

    language = data.get("language") or "ja"

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


middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
]

routes = [
    Route("/health", health_check, methods=["GET"]),
    Route("/ocr", ocr_endpoint, methods=["POST"]),
]

# Mount static files for PWA frontend
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
if os.path.isdir(frontend_dir):
    routes.append(Mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend"))

app = Starlette(
    routes=routes,
    middleware=middleware,
    lifespan=lifespan,
)
