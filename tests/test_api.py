import base64
import io
import unittest
from PIL import Image, ImageDraw
from starlette.testclient import TestClient
from main import app


class TestCardLensAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_check(self):
        """Milestone 2.1: Health check endpoint works"""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["app"], "CardLens")

    def test_missing_image_field_returns_422(self):
        """Milestone 2.3: Missing image field returns 422 Unprocessable Entity"""
        response = self.client.post("/ocr", json={})
        self.assertEqual(response.status_code, 422)

    def test_empty_image_returns_400(self):
        """Milestone 2.3: Empty image field returns 400 Bad Request"""
        response = self.client.post("/ocr", json={"image": ""})
        self.assertEqual(response.status_code, 400)
        self.assertIn("empty", response.json()["detail"].lower())

    def test_malformed_base64_returns_400(self):
        """Milestone 2.3: Malformed Base64 returns 400 Bad Request"""
        response = self.client.post("/ocr", json={"image": "not_valid_base64!!@@##"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("base64", response.json()["detail"].lower())

    def test_non_image_base64_returns_400(self):
        """Milestone 2.4: Non-image Base64 payload returns 400 Bad Request"""
        text_payload = base64.b64encode(b"This is just a plain text file, not an image.").decode()
        response = self.client.post("/ocr", json={"image": text_payload})
        self.assertEqual(response.status_code, 400)
        self.assertIn("invalid image format", response.json()["detail"].lower())

    def test_valid_image_ocr_returns_text(self):
        """Milestone 2.2: Valid image with text returns extracted OCR string"""
        # Create a test image with text
        img = Image.new("RGB", (300, 100), color="white")
        draw = ImageDraw.Draw(img)
        draw.text((20, 35), "CONSOLE CAPTURE TEST", fill="black")

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64_data = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"

        response = self.client.post("/ocr", json={"image": b64_data, "language": "en"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("text", data)
        self.assertTrue(len(data["text"]) > 0)
        self.assertIn("CONSOLE", data["text"].upper())

    def test_static_manifest_accessible(self):
        """Milestone 3.1 & 7.1: Static file mount serves manifest.json"""
        response = self.client.get("/manifest.json")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "CardLens")
        self.assertEqual(data["display"], "standalone")

    def test_frontend_index_accessible(self):
        """Milestone 3.1: Root URL serves index.html"""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("CardLens", response.text)
        self.assertIn("imageToCrop", response.text)

    def test_frontend_assets_accessible(self):
        """Milestone 3.1 & 7.4: App shell assets are accessible"""
        assets = [
            ("/styles.css", 200, "text/css"),
            ("/app.js", 200, None),
            ("/ankiconnect.js", 200, None),
            ("/sw.js", 200, None),
            ("/vendor/cropperjs/cropper.min.js", 200, None),
            ("/vendor/cropperjs/cropper.min.css", 200, "text/css"),
            ("/icons/icon-192.png", 200, "image/png"),
            ("/icons/icon-512.png", 200, "image/png"),
        ]
        for path, expected_status, expected_mime in assets:
            with self.subTest(path=path):
                resp = self.client.get(path)
                self.assertEqual(resp.status_code, expected_status, f"Failed for {path}")
                if expected_mime:
                    self.assertIn(expected_mime, resp.headers.get("content-type", ""))


if __name__ == "__main__":
    unittest.main()
