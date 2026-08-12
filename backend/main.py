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


# =========================================================
# OUTFIT COMPOSITION SAFETY CHECK
# =========================================================

def _placement(item: dict) -> str:
    """Classify a wardrobe item using its stored wardrobe metadata."""
    text = " ".join(
        str(item.get(field) or "")
        for field in ("category", "subcategory", "description")
    ).lower()

    if any(word in text for word in (
        "dress", "jumpsuit", "romper", "gown", "saree", "sari"
    )):
        return "full"

    if any(word in text for word in (
        "shoe", "sneaker", "heel", "sandal", "boot", "flat", "loafer", "footwear"
    )):
        return "shoes"

    if any(word in text for word in (
        "pant", "trouser", "jean", "skirt", "short", "legging",
        "palazzo", "culotte", "bottom"
    )):
        return "bottom"

    if any(word in text for word in (
        "shirt", "top", "blouse", "tee", "t-shirt", "sweater", "jumper",
        "hoodie", "jacket", "coat", "blazer", "cardigan", "kurta", "kurti",
        "tunic", "camisole", "tank"
    )):
        return "top"

    return "other"


def _choose_fallback_bottom(
    top: dict,
    wardrobe: list[dict],
    already_selected: set[str],
):
    """Choose a sensible wardrobe bottom only when Gemini omitted one."""
    candidates = [
        item for item in wardrobe
        if item.get("id") not in already_selected
        and _placement(item) == "bottom"
    ]

    if not candidates:
        return None

    top_seasons = {
        str(value).lower()
        for value in (top.get("season") if isinstance(top.get("season"), list) else [top.get("season")])
        if value
    }
    top_occasions = {
        str(value).lower()
        for value in (top.get("occasion") if isinstance(top.get("occasion"), list) else [top.get("occasion")])
        if value
    }

    def score(item):
        score_value = 0
        item_seasons = {
            str(value).lower()
            for value in (item.get("season") if isinstance(item.get("season"), list) else [item.get("season")])
            if value
        }
        item_occasions = {
            str(value).lower()
            for value in (item.get("occasion") if isinstance(item.get("occasion"), list) else [item.get("occasion")])
            if value
        }

        score_value += 3 * len(top_seasons & item_seasons)
        score_value += 3 * len(top_occasions & item_occasions)

        # Neutral bottoms are generally the safest fallback when the AI
        # failed to choose one, while still leaving Gemini in control whenever
        # it supplied a valid bottom itself.
        color = str(item.get("primary_color") or "").lower()
        if any(neutral in color for neutral in ("black", "white", "grey", "gray", "beige", "cream", "navy")):
            score_value += 1

        return score_value

    return max(candidates, key=score)


def enforce_outfit_composition(
    result: dict,
    wardrobe: list[dict],
):
    """
    Final server-side guardrail for outfit structure.

    Gemini chooses the styling. This function only repairs a structurally
    invalid response. In particular, a TOP—including a kurti—cannot be
    returned with footwear alone. If Gemini omits the required bottom, a
    compatible bottom already present in the user's wardrobe is added.
    """
    if result.get("type") != "outfits":
        return result

    wardrobe_by_id = {
        str(item.get("id")): item
        for item in wardrobe
        if item.get("id")
    }

    repaired_outfits = []

    for outfit in result.get("outfits", [])[:2]:
        item_ids = list(dict.fromkeys(outfit.get("items", [])))
        selected_items = [
            wardrobe_by_id[item_id]
            for item_id in item_ids
            if item_id in wardrobe_by_id
        ]

        has_full = any(_placement(item) == "full" for item in selected_items)
        has_top = any(_placement(item) == "top" for item in selected_items)
        has_bottom = any(_placement(item) == "bottom" for item in selected_items)
        has_shoes = any(_placement(item) == "shoes" for item in selected_items)

        # A full-body garment does not need a bottom. A top always does.
        if has_top and not has_full and not has_bottom:
            top = next(item for item in selected_items if _placement(item) == "top")
            fallback_bottom = _choose_fallback_bottom(
                top,
                wardrobe,
                set(item_ids),
            )

            if fallback_bottom:
                item_ids.insert(1, str(fallback_bottom["id"]))
                print(
                    "OUTFIT COMPOSITION REPAIR: added bottom",
                    fallback_bottom["id"],
                    "for top",
                    top["id"],
                )
            else:
                raise RuntimeError(
                    "AI Assist selected a top but the wardrobe contains no compatible bottom."
                )

        # Footwear is mandatory for every outfit. Gemini normally supplies it,
        # but keep the response structurally valid if it forgets.
        if not has_shoes:
            shoe_candidates = [
                item for item in wardrobe
                if item.get("id") not in item_ids
                and _placement(item) == "shoes"
            ]
            if shoe_candidates:
                item_ids.append(str(shoe_candidates[0]["id"]))
                print(
                    "OUTFIT COMPOSITION REPAIR: added footwear",
                    shoe_candidates[0]["id"],
                )
            else:
                raise RuntimeError(
                    "AI Assist did not select footwear and the wardrobe contains no footwear item."
                )

        repaired_outfits.append({
            **outfit,
            "items": item_ids,
        })

    return {
        **result,
        "outfits": repaired_outfits,
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

    result = enforce_outfit_composition(
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
