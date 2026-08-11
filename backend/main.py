# backend/main.py

from fastapi import FastAPI
import time

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

        # -------------------------------------------------
        # STEP 1 — DOWNLOAD ORIGINAL IMAGE
        # -------------------------------------------------

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

        # -------------------------------------------------
        # STEP 2 — GEMINI CLOTHING ANALYSIS
        # -------------------------------------------------

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

        # -------------------------------------------------
        # IMPORTANT IMAGE PIPELINE RULE
        # -------------------------------------------------
        #
        # Upload analysis deliberately does NOT:
        #
        # - detect clothing rotation
        # - rotate the uploaded image
        # - remove the background
        # - create a cutout
        #
        # The original uploaded image remains the wardrobe
        # image. The client gives the user simple guidance to
        # upload an upright photo when possible.
        #
        # Cutouts are generated separately and only when an
        # outfit visualization actually needs an item.
        # -------------------------------------------------

        # -------------------------------------------------
        # TOTAL TIME
        # -------------------------------------------------

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

        # Re-raise the error so FastAPI correctly returns
        # a 500 response to the frontend.
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
#
# Called only for items an outfit actually selected.
# Cutout generation runs locally via rembg — no Gemini
# call, no quota cost.
#
# If cutout generation fails for an item, we log it and
# move on. The client already falls back to the original
# image_url when normalized_image_url is missing, so a
# single failed item never breaks the whole outfit.
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
            # Already cached — reuse it.
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
            # Continue with other items rather than
            # failing the whole outfit response.
            continue


# =========================================================
# AI ASSIST
# =========================================================

@app.post("/ai-assist")
def ai_assist_endpoint(
    request: dict
):

    user_id = request.get(
        "user_id"
    )

    user_message = request.get(
        "message"
    )

    conversation_history = request.get(
        "conversation_history",
        []
    )

    # -----------------------------------------------------
    # BASIC VALIDATION
    # -----------------------------------------------------

    if not user_id:

        return {
            "type": "error",
            "message": "user_id is required"
        }

    if not user_message:

        return {
            "type": "error",
            "message": "message is required"
        }

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
    #
    # Only runs for items the AI actually picked — not the
    # whole wardrobe. Reuses cached cutouts when present.
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