import io

import httpx
from PIL import Image, ImageOps
from rembg import remove


# =========================================================
# DOWNLOAD IMAGE
# =========================================================

def download_image(image_url: str) -> bytes:
    """
    Downloads the original clothing image from Supabase Storage.
    """

    print("IMAGE URL:", image_url)

    response = httpx.get(
        image_url,
        timeout=30.0,
        follow_redirects=True,
    )

    print("STATUS CODE:", response.status_code)
    print(
        "CONTENT TYPE:",
        response.headers.get("content-type")
    )
    print(
        "CONTENT LENGTH:",
        response.headers.get("content-length")
    )

    response.raise_for_status()

    image_bytes = response.content

    if not image_bytes:
        raise ValueError(
            "Downloaded image is empty."
        )

    return image_bytes


# =========================================================
# EXIF ORIENTATION
# =========================================================

def correct_exif_orientation(
    image_bytes: bytes
) -> bytes:
    """
    Corrects camera EXIF orientation without trying to
    detect clothing rotation.

    This is normal image metadata handling, not AI rotation
    detection.
    """

    image = Image.open(
        io.BytesIO(image_bytes)
    )

    image = ImageOps.exif_transpose(
        image
    )

    output = io.BytesIO()

    image.save(
        output,
        format="PNG"
    )

    return output.getvalue()


# =========================================================
# REMOVE BACKGROUND
# =========================================================

def remove_background(
    image_bytes: bytes
) -> bytes:
    """
    Removes the background using rembg.

    This does NOT use Gemini.
    """

    print(
        "Removing background..."
    )

    return remove(
        image_bytes
    )


# =========================================================
# CROP TRANSPARENT SPACE
# =========================================================

def crop_transparent_space(
    image_bytes: bytes
) -> bytes:
    """
    Crops empty transparent space around the clothing item.
    """

    print(
        "Cropping transparent space..."
    )

    image = Image.open(
        io.BytesIO(image_bytes)
    ).convert("RGBA")

    alpha = image.getchannel("A")

    bbox = alpha.getbbox()

    if bbox is None:
        print(
            "No transparent bounding box found."
        )

        return image_bytes

    cropped = image.crop(
        bbox
    )

    print(
        "Cropped size:",
        cropped.width,
        "x",
        cropped.height
    )

    output = io.BytesIO()

    cropped.save(
        output,
        format="PNG"
    )

    return output.getvalue()


# =========================================================
# NORMALIZE CLOTHING IMAGE
# =========================================================

def normalize_clothing_image(
    image_bytes: bytes
) -> bytes:
    """
    Creates a reusable clothing cutout.

    Pipeline:

    Original image
        ↓
    EXIF correction
        ↓
    Background removal
        ↓
    Transparent-space cropping
        ↓
    PNG cutout

    IMPORTANT:
    No Gemini call happens here.
    No AI rotation detection happens here.
    """

    image_bytes = correct_exif_orientation(
        image_bytes
    )

    image_bytes = remove_background(
        image_bytes
    )

    image_bytes = crop_transparent_space(
        image_bytes
    )

    return image_bytes