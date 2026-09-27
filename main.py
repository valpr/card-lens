import base64
import binascii
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from chrome_lens_py import LensAPI, LensAPIError, LensImageError
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cardlens")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI app: initialize and close LensAPI client."""
    logger.info("Initializing LensAPI client...")
    lens = LensAPI()
    app.state.lens = lens
    yield
    logger.info("Closing LensAPI client...")
    try:
        await lens.aclose()
    except Exception as e:
        logger.warning(f"Error closing LensAPI: {e}")


app = FastAPI(
    title="CardLens",
    description="FastAPI OCR backend and PWA server for CardLens (instant image-to-Anki card miner)",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for mobile/cross-origin local requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class OCRRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded image string or data URI")
    language: Optional[str] = Field("ja", description="Target OCR language (default 'ja')")


class OCRResponse(BaseModel):
    text: str
    detected_language: Optional[str] = None


@app.get("/health")
async def health_check():
    """Health check endpoint to verify server is running."""
    return {"status": "ok", "app": "CardLens"}


@app.post("/ocr", response_model=OCRResponse)
async def ocr_endpoint(request: OCRRequest):
    """
    Process image using Google Lens OCR via chrome-lens-py.
    Accepts raw Base64 or Data URI format ('data:image/...;base64,...').
    """
    image_str = request.image.strip()
    if not image_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image data must not be empty.",
        )

    # Strip Data URI prefix if present (e.g. 'data:image/jpeg;base64,...')
    if "," in image_str:
        header, _, image_str = image_str.partition(",")
        image_str = image_str.strip()

    # Decode Base64
    try:
        image_bytes = base64.b64decode(image_str, validate=True)
    except (binascii.Error, ValueError) as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Base64 encoding: {str(err)}",
        )

    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decoded image payload is empty.",
        )

    # Acquire LensAPI client instance
    lens: Optional[LensAPI] = getattr(app.state, "lens", None)
    own_lens = False
    if lens is None:
        lens = LensAPI()
        own_lens = True

    try:
        result = await lens.process_image(
            image_bytes,
            ocr_language=request.language or "ja",
            output_format="full_text",
        )
    except LensImageError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image format: {str(err)}",
        )
    except LensAPIError as err:
        logger.error(f"Lens API error: {err}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream OCR service error: {str(err)}",
        )
    except Exception as err:
        logger.exception(f"Unexpected error during OCR processing: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal OCR error: {str(err)}",
        )
    finally:
        if own_lens:
            await lens.aclose()

    ocr_text = result.get("ocr_text", "")
    detected_lang = result.get("detected_language")

    return OCRResponse(
        text=ocr_text.strip() if ocr_text else "",
        detected_language=detected_lang,
    )


# Mount static files for PWA frontend
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
