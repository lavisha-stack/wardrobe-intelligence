import json
from pathlib import Path
import os
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types


# =========================================================
# ENVIRONMENT
# =========================================================

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


# =========================================================
# CLOTHING ANALYSIS PROMPT
# =========================================================

def load_prompt() -> str:
    prompt_path = (
        Path(__file__).parent.parent
        / "prompts"
        / "clothing_analysis_prompt.txt"
    )

    with open(
        prompt_path,
        "r",
        encoding="utf-8"
    ) as file:
        return file.read()


# =========================================================
# CLOTHING ANALYSIS
# =========================================================

def analyze_clothing(image_bytes: bytes):

    prompt = load_prompt()

    image_part = types.Part.from_bytes(
        data=image_bytes,
        mime_type="image/jpeg"
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            prompt,
            image_part
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        ),
    )

    text = response.text.strip()

    # -----------------------------------------------------
    # REMOVE POSSIBLE MARKDOWN CODE FENCES
    # -----------------------------------------------------

    if text.startswith("```json"):

        text = text.replace(
            "```json",
            "",
            1
        )

        text = text.replace(
            "```",
            "",
            1
        )

    elif text.startswith("```"):

        text = text.replace(
            "```",
            "",
            1
        )

    text = text.strip()

    # -----------------------------------------------------
    # PARSE JSON
    # -----------------------------------------------------

    try:

        result = json.loads(text)

    except json.JSONDecodeError as error:

        print(
            "GEMINI RETURNED INVALID JSON:"
        )

        print(text)

        raise RuntimeError(
            "Gemini did not return valid JSON."
        ) from error

    # -----------------------------------------------------
    # BASIC VALIDATION
    # -----------------------------------------------------

    if not isinstance(result, dict):

        raise RuntimeError(
            "Gemini returned an unexpected response format."
        )

    # -----------------------------------------------------
    # CONFIDENCE
    # -----------------------------------------------------

    confidence = result.get(
        "confidence",
        0
    )

    try:

        confidence = float(
            confidence
        )

    except (
        TypeError,
        ValueError
    ):

        confidence = 0

    confidence = max(
        0,
        min(
            1,
            confidence
        )
    )

    result["confidence"] = confidence

    # -----------------------------------------------------
    # WARNINGS
    # -----------------------------------------------------

    warnings = result.get(
        "warnings",
        []
    )

    if not isinstance(
        warnings,
        list
    ):

        warnings = []

    result["warnings"] = warnings

    # -----------------------------------------------------
    # LOG RESULT
    # -----------------------------------------------------

    structured_attributes = result.get(
        "structured_attributes",
        {}
    )

    print(
        "GEMINI CLOTHING ANALYSIS:"
    )

    print(
        "Category:",
        structured_attributes.get(
            "category",
            "unknown"
        )
    )

    print(
        "Subcategory:",
        structured_attributes.get(
            "subcategory",
            "unknown"
        )
    )

    print(
        "Confidence:",
        confidence
    )

    print(
        "Warnings:",
        warnings
    )

    return result


# =========================================================
# GEMINI CONNECTION TEST
# =========================================================

def test_gemini():

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Reply with exactly: Gemini Connected"
    )

    return response.text


# =========================================================
# AI ASSIST PROMPT
# =========================================================

def load_ai_assist_prompt() -> str:

    prompt_path = (
        Path(__file__).parent.parent
        / "prompts"
        / "ai_assist_prompt.txt"
    )

    with open(
        prompt_path,
        "r",
        encoding="utf-8"
    ) as file:

        return file.read()


# =========================================================
# AI ASSIST
# =========================================================

def ai_assist(
    user_message: str,
    conversation_history: list[dict[str, str]],
    profile: dict[str, Any],
    wardrobe: list[dict[str, Any]],
):

    system_prompt = load_ai_assist_prompt()

    full_prompt = f"""
{system_prompt}

CURRENT USER PROFILE:
{json.dumps(
    profile,
    ensure_ascii=False,
    indent=2
)}

CURRENT USER WARDROBE:
{json.dumps(
    wardrobe,
    ensure_ascii=False,
    indent=2
)}

CONVERSATION HISTORY:
{json.dumps(
    conversation_history,
    ensure_ascii=False,
    indent=2
)}

CURRENT USER MESSAGE:
{user_message}

IMPORTANT:

You may ONLY use clothing/accessory items from CURRENT USER WARDROBE.

Every item you recommend MUST use the exact "id" of an item
from the provided wardrobe.

Never invent an item that does not exist in the wardrobe.

If the user's request lacks information that is genuinely necessary
for a useful recommendation, ask ONE concise follow-up question.

Otherwise, return exactly TWO outfit recommendations.

Return ONLY valid JSON.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=full_prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        ),
    )

    text = response.text.strip()

    # -----------------------------------------------------
    # REMOVE POSSIBLE MARKDOWN CODE FENCES
    # -----------------------------------------------------

    if text.startswith("```json"):

        text = text.replace(
            "```json",
            "",
            1
        )

        text = text.replace(
            "```",
            "",
            1
        )

    elif text.startswith("```"):

        text = text.replace(
            "```",
            "",
            1
        )

    text = text.strip()

    # -----------------------------------------------------
    # PARSE JSON
    # -----------------------------------------------------

    try:

        return json.loads(text)

    except json.JSONDecodeError as error:

        print(
            "AI ASSIST RETURNED INVALID JSON:"
        )

        print(text)

        raise RuntimeError(
            "AI Assist did not return valid JSON."
        ) from error