import os
import json
from PIL import Image, ImageOps
from rembg import remove
from google import genai
from google.genai import types
from dotenv import load_dotenv


# =========================================================
# SETTINGS
# =========================================================

INPUT_PATH = r"C:\Users\jay39\Downloads\test_skirt.jpeg"

OUTPUT_PATH = r"C:\Users\jay39\Downloads\test_skirt_normalized.png"

MODEL = "gemini-2.5-flash"


# =========================================================
# LOAD API KEY
# =========================================================

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError(
        "GEMINI_API_KEY was not found in the .env file."
    )

client = genai.Client(api_key=api_key)


# =========================================================
# OPEN IMAGE
# =========================================================

print("Opening image...")

image = Image.open(INPUT_PATH)

print(
    f"Original size: {image.width} x {image.height}"
)


# =========================================================
# FIX CAMERA / EXIF ORIENTATION
# =========================================================

print("Checking camera orientation...")

image = ImageOps.exif_transpose(image)

print(
    f"After EXIF correction: "
    f"{image.width} x {image.height}"
)


# =========================================================
# ASK GEMINI FOR CLOTHING ORIENTATION
# =========================================================

print("Analyzing clothing orientation with Gemini...")


with open(INPUT_PATH, "rb") as f:
    image_bytes = f.read()


prompt = """
You are analyzing a photograph of a clothing item.

Determine whether the clothing item is displayed upright
or rotated sideways/upside down.

The goal is to rotate the clothing item so that it appears
in the natural orientation that a person would normally see
it when wearing it.

Look ONLY at the clothing item itself.

Do not use the background, bed, floor, furniture, or camera
orientation as evidence.

Use clothing-specific structure such as:
- neckline
- collar
- waistband
- sleeves
- hem
- legs
- shoe opening
- straps
- buttons
- garment shape

Return ONLY valid JSON in exactly this format:

{
  "category": "shirt",
  "rotation_needed": 0,
  "confidence": 0.95
}

rotation_needed must be exactly one of:

0
90
180
270

Meaning:

0 = already upright
90 = rotate clockwise 90 degrees
180 = rotate 180 degrees
270 = rotate clockwise 270 degrees

The rotation_needed value must describe the clockwise
rotation required to make the clothing item naturally upright.

Confidence must be between 0 and 1.
"""


response = client.models.generate_content(
    model=MODEL,
    contents=[
        prompt,
        types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/jpeg",
        ),
    ],
)


# =========================================================
# READ GEMINI RESULT
# =========================================================

raw_response = response.text.strip()

print()
print("Gemini response:")
print(raw_response)
print()


# Remove possible markdown code fences
if raw_response.startswith("```"):
    raw_response = raw_response.replace("```json", "")
    raw_response = raw_response.replace("```", "")
    raw_response = raw_response.strip()


try:
    result = json.loads(raw_response)

except json.JSONDecodeError:
    raise RuntimeError(
        "Gemini did not return valid JSON."
    )


category = result.get(
    "category",
    "unknown"
)

rotation = result.get(
    "rotation_needed",
    0
)

confidence = result.get(
    "confidence",
    0
)


print("Detected category:", category)
print("Detected rotation:", rotation)
print("Confidence:", confidence)


# =========================================================
# VALIDATE ROTATION
# =========================================================

valid_rotations = [0, 90, 180, 270]

if rotation not in valid_rotations:
    raise RuntimeError(
        f"Invalid rotation returned: {rotation}"
    )


# =========================================================
# REMOVE BACKGROUND
# =========================================================

print()
print("Removing background...")

cutout = remove(image)


# =========================================================
# ROTATE CUTOUT
# =========================================================

print(
    f"Applying rotation: {rotation} degrees..."
)


if rotation == 90:

    cutout = cutout.rotate(
        -90,
        expand=True,
    )

elif rotation == 180:

    cutout = cutout.rotate(
        180,
        expand=True,
    )

elif rotation == 270:

    cutout = cutout.rotate(
        90,
        expand=True,
    )


# =========================================================
# CROP TRANSPARENT SPACE
# =========================================================

print("Cropping transparent space...")

bbox = cutout.getbbox()

if bbox:

    cutout = cutout.crop(bbox)


# =========================================================
# SAVE
# =========================================================

cutout.save(
    OUTPUT_PATH,
    "PNG"
)


# =========================================================
# DONE
# =========================================================

print()
print("=" * 50)
print("NORMALIZATION COMPLETE")
print("=" * 50)

print()
print("Category:", category)
print("Rotation:", rotation)
print("Confidence:", confidence)

print()
print("Saved to:")
print(OUTPUT_PATH)