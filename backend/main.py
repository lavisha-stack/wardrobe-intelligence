# backend/main.py

from fastapi import FastAPI, HTTPException
import time
import uuid

from app.models.clothing import ClothingAnalysisRequest

from app.services.image_service import (
    download_image,
    normalize_clothing_image,
)

from app.services.gemini_service import (
    analyze_clothing,
    test_gemini,
    ai_assist,
)

from app.services.supabase_service import (
    get_user_wardrobe,
    upload_normalized_image,
    save_normalized_image_url,
    supabase,
)


app = FastAPI(
    title="Wardrobe Intelligence API",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "Wardrobe Intelligence Backend is running!"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.get("/test-gemini")
def gemini_test():
    return {
        "response": test_gemini()
    }


@app.post("/analyze-clothing")
def analyze_clothing_endpoint(
    request: ClothingAnalysisRequest
):
    print("")
    print("#################################################")
    print("ANALYZE-CLOTHING ENDPOINT REACHED")
    print("IMAGE URL RECEIVED:")
    print(request.image_url)
    print("#################################################")

    start_time = time.time()

    try:
        print("")
        print("STEP 1: DOWNLOADING IMAGE")
        download_start = time.time()

        image_bytes = download_image(
            request.image_url
        )

        download_time = time.time() - download_start

        print(
            f"STEP 1 COMPLETE: IMAGE DOWNLOAD {download_time:.2f}s"
        )
        print(
            "DOWNLOADED IMAGE SIZE:",
            len(image_bytes),
            "bytes"
        )

        print("")
        print("STEP 2: GEMINI CLOTHING ANALYSIS")
        gemini_start = time.time()

        result = analyze_clothing(
            image_bytes
        )

        gemini_time = time.time() - gemini_start

        print(
            f"STEP 2 COMPLETE: GEMINI ANALYSIS {gemini_time:.2f}s"
        )

        total_time = time.time() - start_time

        print("")
        print(f"TOTAL ANALYSIS TIME: {total_time:.2f}s")
        print("")
        print("AI RESULT:")
        print(result)
        print("")
        print("#################################################")
        print("ANALYZE-CLOTHING COMPLETE")
        print("#################################################")
        print("")

        return result

    except Exception as error:
        print("")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print("ANALYZE-CLOTHING FAILED")
        print("ERROR:", repr(error))
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print("")
        raise


@app.get("/test-supabase/{user_id}")
def test_supabase(
    user_id: str
):
    wardrobe = get_user_wardrobe(
        user_id
    )

    return {
        "count": len(wardrobe),
        "items": wardrobe,
    }


# =========================================================
# ENSURE CUTOUTS EXIST FOR OUTFIT ITEMS
# =========================================================

def ensure_outfit_item_cutouts(
    user_id: str,
    item_ids: list[str],
    wardrobe: list[dict],
):
    wardrobe_by_id = {
        item["id"]: item
        for item in wardrobe
    }

    for item_id in item_ids:
        item = wardrobe_by_id.get(
            item_id
        )

        if not item:
            continue

        if item.get(
            "normalized_image_url"
        ):
            continue

        try:
            print(
                f"GENERATING CUTOUT FOR ITEM: {item_id}"
            )

            original_bytes = download_image(
                item["image_url"]
            )

            cutout_bytes = normalize_clothing_image(
                original_bytes
            )

            cutout_url = upload_normalized_image(
                user_id,
                cutout_bytes
            )

            save_normalized_image_url(
                item_id,
                cutout_url
            )

            print(
                f"CUTOUT SAVED FOR ITEM: {item_id}"
            )

        except Exception as error:
            print(
                f"CUTOUT GENERATION FAILED FOR ITEM {item_id}: {repr(error)}"
            )
            continue


# =========================================================
# AI ASSIST USER ID VALIDATION
# =========================================================

def normalize_ai_user_id(value):
    """
    Normalize and validate the authenticated user's UUID.
    """
    original_type = type(value).__name__

    if isinstance(value, dict):
        value = value.get("id") or value.get("user_id")

    if not isinstance(value, str):
        raise HTTPException(
            status_code=400,
            detail={
                "message": "user_id must be a UUID string",
                "received_type": original_type,
            },
        )

    value = value.strip()

    try:
        return str(uuid.UUID(value))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=400,
            detail={
                "message": "user_id is not a valid UUID",
            },
        )


# =========================================================
# AI ASSIST OUTFIT RESPONSE NORMALIZATION
# =========================================================

def normalize_outfit_item_ids(
    result: dict,
    wardrobe: list[dict],
):
    """
    Gemini's prompt describes outfit items as named fields
    (top, bottom, shoes, accessories, etc.), while the mobile
    client expects a flat list of wardrobe UUIDs.

    Normalize both forms here and discard anything that is not
    an actual wardrobe item ID. This prevents an object such as
    {"top": "uuid"} from ever reaching a Supabase UUID query.
    """
    if not isinstance(result, dict):
        raise RuntimeError("AI Assist returned an unexpected response format.")

    if result.get("type") != "outfits" or not isinstance(result.get("outfits"), list):
        return result

    valid_ids = {
        str(item.get("id"))
        for item in wardrobe
        if item.get("id")
    }

    normalized_outfits = []

    for outfit in result["outfits"][:2]:
        if not isinstance(outfit, dict):
            continue

        raw_items = outfit.get("items", [])
        raw_accessories = outfit.get("accessories", [])
        collected = []

        def collect(value):
            if value is None:
                return

            if isinstance(value, str):
                if value in valid_ids:
                    collected.append(value)
                return

            if isinstance(value, dict):
                # Handle accidental {"id": "uuid"} objects.
                candidate = value.get("id") or value.get("user_id")
                if isinstance(candidate, str) and candidate in valid_ids:
                    collected.append(candidate)
                return

            if isinstance(value, list):
                for nested in value:
                    collect(nested)

        if isinstance(raw_items, dict):
            for value in raw_items.values():
                collect(value)
        else:
            collect(raw_items)

        collect(raw_accessories)

        deduplicated = list(dict.fromkeys(collected))

        normalized_outfits.append({
            "title": outfit.get("title", "Outfit"),
            "items": deduplicated,
        })

    if len(normalized_outfits) != 2:
        raise RuntimeError(
            "AI Assist did not return two usable outfit recommendations from the wardrobe."
        )

    return {
        **result,
        "outfits": normalized_outfits,
    }


@app.post("/ai-assist")
def ai_assist_endpoint(
    request: dict
):
    raw_user_id = request.get(
        "user_id"
    )

    print("")
    print("=================================================")
    print("AI ASSIST ENDPOINT REACHED")
    print("RAW USER ID TYPE:", type(raw_user_id).__name__)
    print("RAW USER ID:", repr(raw_user_id))
    print("=================================================")

    user_id = normalize_ai_user_id(
        raw_user_id
    )

    user_message = request.get(
        "message"
    )

    conversation_history = request.get(
        "conversation_history",
        []
    )

    if not user_message:
        raise HTTPException(
            status_code=400,
            detail="message is required"
        )

    print("NORMALIZED USER ID:", user_id)

    profile_response = (
        supabase
        .table("profiles")
        .select("id, name, style_tags")
        .eq("id", user_id)
        .single()
        .execute()
    )

    profile = profile_response.data or {}

    print("")
    print("PROFILE SENT TO AI:")
    print(profile)

    wardrobe = get_user_wardrobe(
        user_id
    )

    print(
        f"WARDROBE ITEMS SENT TO AI: {len(wardrobe)}"
    )

    result = ai_assist(
        user_message=user_message,
        conversation_history=conversation_history,
        profile=profile,
        wardrobe=wardrobe,
    )

    result = normalize_outfit_item_ids(
        result,
        wardrobe,
    )

    print("")
    print("NORMALIZED AI ASSIST RESULT:")
    print(result)

    if (
        result.get("type") == "outfits"
        and isinstance(result.get("outfits"), list)
    ):
        outfit_item_ids = [
            item_id
            for outfit in result["outfits"]
            for item_id in outfit.get("items", [])
        ]

        unique_item_ids = list(
            dict.fromkeys(outfit_item_ids)
        )

        if unique_item_ids:
            print(
                f"ENSURING CUTOUTS FOR {len(unique_item_ids)} OUTFIT ITEM(S)"
            )

            ensure_outfit_item_cutouts(
                user_id,
                unique_item_ids,
                wardrobe,
            )

    return result
