import os
import uuid
from urllib.parse import urlparse

from dotenv import load_dotenv
from supabase import create_client, Client


# =========================================================
# LOAD ENVIRONMENT
# =========================================================

load_dotenv()

SUPABASE_URL = os.getenv(
    "SUPABASE_URL"
)

SUPABASE_KEY = os.getenv(
    "SUPABASE_KEY"
)

if not SUPABASE_URL:
    raise ValueError(
        "SUPABASE_URL is missing from .env"
    )

if not SUPABASE_KEY:
    raise ValueError(
        "SUPABASE_KEY is missing from .env"
    )

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_KEY,
)


# =========================================================
# GET USER WARDROBE
# =========================================================

def get_user_wardrobe(
    user_id: str
):
    response = (
        supabase
        .table("clothing_items")
        .select(
            """
            id,
            image_url,
            normalized_image_url,
            category,
            subcategory,
            primary_color,
            secondary_color,
            pattern,
            material,
            fit,
            neckline,
            sleeve_length,
            length,
            season,
            occasion,
            description
            """
        )
        .eq(
            "user_id",
            user_id
        )
        .execute()
    )

    return response.data or []


# =========================================================
# GET USER ID FROM IMAGE URL
# =========================================================

def get_user_id_from_image_url(
    image_url: str
) -> str:
    """
    Extracts the user folder from a Supabase Storage URL.

    Expected:

    /storage/v1/object/public/
    clothing-images/{user_id}/{file}
    """

    parsed = urlparse(
        image_url
    )

    parts = [
        part
        for part in parsed.path.split("/")
        if part
    ]

    try:
        public_index = parts.index(
            "public"
        )

        bucket_index = (
            public_index + 1
        )

        user_index = (
            public_index + 2
        )

        if (
            bucket_index >= len(parts)
            or user_index >= len(parts)
            or parts[bucket_index]
            != "clothing-images"
        ):
            raise ValueError

        user_id = parts[user_index]

        if not user_id:
            raise ValueError

        return user_id

    except (
        ValueError,
        IndexError
    ):
        raise ValueError(
            "Could not determine the user ID from the Supabase image URL."
        )


# =========================================================
# UPLOAD NORMALIZED IMAGE
# =========================================================

def upload_normalized_image(
    user_id: str,
    image_bytes: bytes
) -> str:
    """
    Uploads a processed clothing cutout.

    The cutout is stored separately from the original photo.
    """

    file_name = (
        f"{user_id}/normalized/"
        f"{uuid.uuid4()}.png"
    )

    print(
        "Uploading normalized image..."
    )

    (
        supabase
        .storage
        .from_("clothing-images")
        .upload(
            file_name,
            image_bytes,
            {
                "content-type": "image/png",
                "upsert": "true",
            }
        )
    )

    public_url = (
        supabase
        .storage
        .from_("clothing-images")
        .get_public_url(
            file_name
        )
    )

    print(
        "NORMALIZED IMAGE URL:",
        public_url
    )

    return public_url


# =========================================================
# SAVE NORMALIZED IMAGE URL
# =========================================================

def save_normalized_image_url(
    clothing_item_id: str,
    normalized_image_url: str
):
    """
    Saves the cached cutout URL against the wardrobe item.
    """

    response = (
        supabase
        .table("clothing_items")
        .update(
            {
                "normalized_image_url":
                    normalized_image_url
            }
        )
        .eq(
            "id",
            clothing_item_id
        )
        .execute()
    )

    return response.data