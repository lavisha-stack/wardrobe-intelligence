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


# =========================================================
# BASIC ROUTES
# =========================================================

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


# =========================================================
# GEMINI TEST
# =========================================================

@app.get("/test-gemini")
def gemini_test():

    return {
        "response": test_gemini()
    }


# =========================================================
# CLOTHING ANALYSIS
# =========================================================

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

        download_time = (
            time.time() - download_start
        )

        print(
            f"STEP 1 COMPLETE: "
            f"IMAGE DOWNLOAD {download_time:.2f}s"
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

        gemini_time = (
            time.time() - gemini_start
        )

        print(
            f"STEP 2 COMPLETE: "
            f"GEMINI ANALYSIS {gemini_time:.2f}s"
        )

        total_time = (
            time.time() - start_time
        )

        print("")
        print(
            f"TOTAL ANALYSIS TIME: "
            f"{total_time:.2f}s"
        )

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


# =========================================================
# TEST SUPABASE
# =========================================================

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
                f"CUTOUT GENERATION FAILED FOR ITEM "
                f"{item_id}: {repr(error)}"
            )
            continue


# =========================================================
# AI ASSIST
# =========================================================

def normalize_ai_user_id(value):
    """
    Normalize the user_id received from the mobile client.

    The normal client payload contains a UUID string. This also
    safely accepts an accidental {"id": "<uuid>"} object so that
    a JavaScript object can never reach Postgres as [object Object].
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
        normalized = str(uuid.UUID(value))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=400,
            detail={
                "message": "user_id is not a valid UUID",
            },
        )

    return normalized


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

    # -----------------------------------------------------
    # GET USER PROFILE
    # -----------------------------------------------------

    profile_response = (
        supabase
        .table("profiles")
        .select(
            "id, name, style_tags"
        )
        .eq(
            "id",
            user_id
        )
        .single()
        .execute()
    )

    profile = (
        profile_response.data
        or {}
    )

    print("")
    print("PROFILE SENT TO AI:")
    print(profile)

    # -----------------------------------------------------
    # GET USER WARDROBE
    # -----------------------------------------------------

    wardrobe = get_user_wardrobe(
        user_id
    )

    print(
        f"WARDROBE ITEMS SENT TO AI: "
        f"{len(wardrobe)}"
    )

    # -----------------------------------------------------
    # ASK GEMINI
    # -----------------------------------------------------

    result = ai_assist(
        user_message=user_message,
        conversation_history=conversation_history,
        profile=profile,
        wardrobe=wardrobe,
    )

    print("")
    print("AI ASSIST RESULT:")
    print(result)

    # -----------------------------------------------------
    # GENERATE/CACHE CUTOUTS FOR SELECTED OUTFIT ITEMS
    # -----------------------------------------------------

    if (
        result.get("type") == "outfits"
        and isinstance(
            result.get("outfits"),
            list
        )
    ):

        outfit_item_ids = [
            item_id
            for outfit in result["outfits"]
            for item_id in outfit.get(
                "items",
                []
            )
        ]

        unique_item_ids = list(
            dict.fromkeys(
                outfit_item_ids
            )
        )

        if unique_item_ids:

            print(
                f"ENSURING CUTOUTS FOR "
                f"{len(unique_item_ids)} OUTFIT ITEM(S)"
            )

            ensure_outfit_item_cutouts(
                user_id,
                unique_item_ids,
                wardrobe,
            )

    return result
