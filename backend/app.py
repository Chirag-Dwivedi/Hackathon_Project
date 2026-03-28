import json
import os
import re
import secrets
import urllib.error
import urllib.request

import pymysql
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from projectDB import create_tables, get_connection

load_dotenv()


app = Flask(__name__)

auth_tokens = {}
schema_ready = False
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


def ensure_schema_ready():
    global schema_ready
    if schema_ready:
        return
    create_tables()
    schema_ready = True


def json_error(message, status=400, details=None):
    payload = {"error": message}
    if details:
        payload["details"] = details
    return jsonify(payload), status


def validate_signup_payload(payload):
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if len(name) < 2:
        return None, json_error("Name must be at least 2 characters.", 400)
    if not EMAIL_RE.match(email):
        return None, json_error("Enter a valid email address.", 400)
    if len(password) < 8 or not re.search(r"[A-Z]", password) or not re.search(r"\d", password):
        return None, json_error(
            "Password must be at least 8 characters and include an uppercase letter and a number.",
            400,
        )

    return {"name": name, "email": email, "password": password}, None


def validate_login_payload(payload):
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or not password:
        return None, json_error("Email and password are required.", 400)

    return {"email": email, "password": password}, None


def validate_moodboard_payload(payload):
    title = (payload.get("title") or "").strip()
    items = payload.get("items") or []
    outfits = payload.get("outfits") or []
    selected_outfit_id = payload.get("selectedOutfitId")

    if len(title) < 2:
        return None, json_error("Moodboard name must be at least 2 characters.", 400)
    if not isinstance(items, list):
        return None, json_error("Moodboard items must be a list.", 400)
    if not isinstance(outfits, list):
        return None, json_error("Moodboard outfits must be a list.", 400)

    sanitized_items = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            return None, json_error("Each moodboard item must be an object.", 400)

        item_id = str(item.get("id") or "").strip()
        image_url = item.get("imageUrl") or item.get("preview") or ""
        title_value = (item.get("title") or "Untitled piece").strip()
        category = (item.get("category") or "Piece").strip()[:80]

        if not item_id or not image_url:
            return None, json_error("Each moodboard item must include an id and image.", 400)

        sanitized_items.append(
            {
                "id": item_id,
                "title": title_value[:120],
                "category": category,
                "image_url": image_url,
                "x": int(item.get("x", 0)),
                "y": int(item.get("y", 0)),
                "display_order": index,
            }
        )

    valid_item_ids = {item["id"] for item in sanitized_items}
    sanitized_outfits = []
    for outfit in outfits:
        if not isinstance(outfit, dict):
            continue

        outfit_item_ids = [str(value) for value in outfit.get("itemIds") or [] if str(value) in valid_item_ids]
        if len(outfit_item_ids) < 2:
            continue

        outfit_links = []
        for link in outfit.get("links") or []:
            if not isinstance(link, dict):
                continue
            from_id = str(link.get("from") or "")
            to_id = str(link.get("to") or "")
            if from_id in valid_item_ids and to_id in valid_item_ids and from_id != to_id:
                outfit_links.append(
                    {
                        "id": str(link.get("id") or f"{from_id}-{to_id}"),
                        "from": from_id,
                        "to": to_id,
                    }
                )

        sanitized_outfits.append(
            {
                "id": str(outfit.get("id") or ""),
                "name": (outfit.get("name") or "Saved Look").strip()[:120],
                "itemIds": outfit_item_ids,
                "links": outfit_links,
            }
        )

    if selected_outfit_id is not None:
        selected_outfit_id = str(selected_outfit_id)

    return {
        "title": title[:120],
        "items": sanitized_items,
        "outfits": sanitized_outfits,
        "selected_outfit_id": selected_outfit_id,
        "cover_image_url": payload.get("coverImageUrl") or (sanitized_items[0]["image_url"] if sanitized_items else None),
    }, None


def validate_ai_payload(payload):
    prompt = (payload.get("prompt") or "").strip()
    items = payload.get("items") or []
    outfits = payload.get("outfits") or []
    preferences = payload.get("preferences") or []
    board_title = (payload.get("boardTitle") or "").strip()

    if len(prompt) < 3:
        return None, json_error("Prompt must be at least 3 characters.", 400)
    if not isinstance(items, list):
        return None, json_error("Items must be a list.", 400)
    if not isinstance(outfits, list):
        return None, json_error("Outfits must be a list.", 400)
    if not isinstance(preferences, list):
        return None, json_error("Preferences must be a list.", 400)

    normalized_items = []
    for item in items[:8]:
        if not isinstance(item, dict):
            continue

        normalized_items.append(
            {
                "id": str(item.get("id") or ""),
                "title": (item.get("title") or "Untitled piece").strip()[:120],
                "category": (item.get("category") or "Piece").strip()[:80],
                "image_url": item.get("imageUrl") or item.get("preview") or "",
            }
        )

    normalized_outfits = []
    valid_item_ids = {item["id"] for item in normalized_items if item["id"]}
    for outfit in outfits[:10]:
        if not isinstance(outfit, dict):
            continue

        normalized_outfits.append(
            {
                "id": str(outfit.get("id") or ""),
                "name": (outfit.get("name") or "Look").strip()[:120],
                "itemIds": [str(item_id) for item_id in (outfit.get("itemIds") or []) if str(item_id) in valid_item_ids],
            }
        )

    return (
        {
            "prompt": prompt,
            "items": normalized_items,
            "outfits": normalized_outfits,
            "preferences": [str(value).strip()[:120] for value in preferences[:12] if str(value).strip()],
            "board_title": board_title[:120],
        },
        None,
    )


def make_user_response(user_row):
    return {
        "id": user_row["id"],
        "name": user_row["username"],
        "email": user_row["email"],
    }


def create_auth_token(user):
    token = secrets.token_urlsafe(32)
    auth_tokens[token] = user
    return token


def get_bearer_token():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    return header.split(" ", 1)[1].strip() or None


def get_authenticated_user():
    token = get_bearer_token()
    if not token:
        return None, None
    return token, auth_tokens.get(token)


def require_authenticated_user():
    _token, user = get_authenticated_user()
    if user is None:
        return None, json_error("Unauthorized.", 401)
    return user, None


def password_matches(raw_password, stored_password):
    return stored_password == raw_password or check_password_hash(stored_password, raw_password)


def format_timestamp(value):
    return value.isoformat() if value is not None else None


def data_url_to_gemini_part(data_url):
    if not isinstance(data_url, str) or not data_url.startswith("data:") or ";base64," not in data_url:
        return None

    header, encoded = data_url.split(",", 1)
    mime_type = header[5:].split(";")[0] or "image/png"
    if not mime_type.startswith("image/"):
        return None

    return {
        "inline_data": {
            "mime_type": mime_type,
            "data": encoded,
        }
    }


def strip_code_fences(text):
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z0-9_-]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    return cleaned.strip()


def normalize_ai_response(payload):
    return {
        "answer": payload.get("answer") or payload.get("styleSummary") or "",
        "styleSummary": payload.get("styleSummary") or "",
        "whyItWorks": payload.get("whyItWorks") or "",
        "suggestedAddition": payload.get("suggestedAddition") or "",
        "closetManagement": payload.get("closetManagement") or "",
        "recommendations": payload.get("recommendations") or [],
        "itemCareDetails": payload.get("itemCareDetails") or [],
        "styleSuggestions": payload.get("styleSuggestions") or [],
        "outfitCompletion": payload.get("outfitCompletion") or "",
        "similarItemSearch": payload.get("similarItemSearch") or [],
    }


def get_gemini_models_to_try():
    configured_model = (os.getenv("GEMINI_MODEL") or DEFAULT_GEMINI_MODEL).strip()
    models = [configured_model]
    fallbacks = {
        "gemini-1.5-flash": DEFAULT_GEMINI_MODEL,
        "gemini-1.5-flash-001": DEFAULT_GEMINI_MODEL,
    }
    fallback_model = fallbacks.get(configured_model)
    if fallback_model and fallback_model not in models:
        models.append(fallback_model)
    return models


def call_gemini_style_assistant(payload):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured in the backend environment.")

    item_summary = [
        f'- {item["title"]} ({item["category"]})'
        for item in payload["items"]
    ] or ["- No clothing items were provided."]
    outfit_summary = [
        f'- {outfit["name"]}: {", ".join(outfit["itemIds"]) if outfit["itemIds"] else "no linked items"}'
        for outfit in payload["outfits"]
    ] or ["- No outfit groups defined yet."]
    preferences_summary = payload["preferences"] or ["No explicit style preferences provided."]

    system_prompt = f"""
You are a fashion styling assistant for an outfit planning app called Sleeves.
Respond ONLY with valid JSON and no markdown.

Use this exact JSON shape:
{{
  "answer": "short direct response to the user's request",
  "styleSummary": "2-3 sentence style read of the fit",
  "whyItWorks": "why the current combination works or doesn't",
  "suggestedAddition": "one strongest missing item or next addition",
  "closetManagement": "practical closet or wardrobe management advice",
  "recommendations": ["3 concise recommendation bullets as strings"],
  "itemCareDetails": ["up to 3 concise care notes as strings"],
  "styleSuggestions": ["up to 4 concise styling suggestions as strings"],
  "outfitCompletion": "how to finish or improve the outfit",
  "similarItemSearch": ["up to 4 search phrases for similar items"]
}}

Be specific, practical, and fashion-aware. If information is missing, say what assumption you are making.
Board title: {payload["board_title"] or "Untitled Moodboard"}
User preferences: {", ".join(preferences_summary)}
Items:
{chr(10).join(item_summary)}
Outfits:
{chr(10).join(outfit_summary)}
User request: {payload["prompt"]}
""".strip()

    base_parts = [{"text": system_prompt}]
    image_parts = []
    for item in payload["items"][:4]:
        image_part = data_url_to_gemini_part(item["image_url"])
        if image_part:
            image_parts.append({"text": f'Image reference for {item["title"]} ({item["category"]})'})
            image_parts.append(image_part)

    raw_response = None
    last_error = None

    part_variants = [base_parts + image_parts, base_parts] if image_parts else [base_parts]

    for parts in part_variants:
        using_images = parts is not base_parts

        for model_name in get_gemini_models_to_try():
            request_body = json.dumps(
                {
                    "contents": [
                        {
                            "role": "user",
                            "parts": parts,
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.7,
                        "responseMimeType": "application/json",
                    },
                }
            ).encode("utf-8")

            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model_name}:generateContent?key={api_key}"
            )
            req = urllib.request.Request(
                url,
                data=request_body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            try:
                with urllib.request.urlopen(req, timeout=45) as response:
                    raw_response = response.read().decode("utf-8")
                    break
            except urllib.error.HTTPError as exc:
                details = exc.read().decode("utf-8", errors="ignore")
                last_error = RuntimeError(f"Gemini API request failed: {details or exc.reason}")
                lower_details = details.lower()
                if exc.code == 404:
                    continue
                if using_images and exc.code == 400 and ("input image" in lower_details or "invalid_argument" in lower_details):
                    break
                raise last_error from exc
            except urllib.error.URLError as exc:
                raise RuntimeError(f"Unable to reach Gemini API: {exc.reason}") from exc

        if raw_response is not None:
            break

    if raw_response is None:
        raise last_error or RuntimeError("Gemini API request failed before a response was returned.")

    parsed = json.loads(raw_response)
    candidates = parsed.get("candidates") or []
    if not candidates:
        raise RuntimeError("Gemini returned no candidates.")

    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()
    if not text:
        raise RuntimeError("Gemini returned an empty response.")

    normalized_text = strip_code_fences(text)
    try:
        payload = json.loads(normalized_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Gemini returned invalid JSON.") from exc

    return normalize_ai_response(payload)


def save_moodboard(connection, user_id, payload, moodboard_id=None):
    layout_json = json.dumps(
        {
            "outfits": payload["outfits"],
            "selectedOutfitId": payload["selected_outfit_id"],
        }
    )

    with connection.cursor(pymysql.cursors.DictCursor) as cursor:
        if moodboard_id is None:
            cursor.execute(
                """
                INSERT INTO moodboards (user_id, title, cover_image_url, layout_json)
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, payload["title"], payload["cover_image_url"], layout_json),
            )
            moodboard_id = cursor.lastrowid
        else:
            cursor.execute(
                "SELECT id FROM moodboards WHERE id = %s AND user_id = %s",
                (moodboard_id, user_id),
            )
            if cursor.fetchone() is None:
                raise ValueError("Moodboard not found.")

            cursor.execute(
                """
                UPDATE moodboards
                SET title = %s,
                    cover_image_url = %s,
                    layout_json = %s
                WHERE id = %s AND user_id = %s
                """,
                (payload["title"], payload["cover_image_url"], layout_json, moodboard_id, user_id),
            )

            cursor.execute("DELETE FROM moodboard_items WHERE moodboard_id = %s", (moodboard_id,))

        for item in payload["items"]:
            cursor.execute(
                """
                INSERT INTO moodboard_items (
                    moodboard_id,
                    client_id,
                    title,
                    category,
                    image_url,
                    board_x,
                    board_y,
                    display_order
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    moodboard_id,
                    item["id"],
                    item["title"],
                    item["category"],
                    item["image_url"],
                    item["x"],
                    item["y"],
                    item["display_order"],
                ),
            )

        cursor.execute(
            """
            SELECT id, title, cover_image_url, updated_at
            FROM moodboards
            WHERE id = %s AND user_id = %s
            """,
            (moodboard_id, user_id),
        )
        moodboard_row = cursor.fetchone()

    return moodboard_row


def fetch_moodboard_detail(connection, user_id, moodboard_id):
    with connection.cursor(pymysql.cursors.DictCursor) as cursor:
        cursor.execute(
            """
            SELECT id, title, cover_image_url, layout_json, updated_at
            FROM moodboards
            WHERE id = %s AND user_id = %s
            """,
            (moodboard_id, user_id),
        )
        moodboard_row = cursor.fetchone()
        if moodboard_row is None:
            return None

        cursor.execute(
            """
            SELECT client_id, title, category, image_url, board_x, board_y, display_order
            FROM moodboard_items
            WHERE moodboard_id = %s
            ORDER BY display_order ASC, id ASC
            """,
            (moodboard_id,),
        )
        item_rows = cursor.fetchall()

    layout = {}
    if moodboard_row.get("layout_json"):
        try:
            layout = json.loads(moodboard_row["layout_json"])
        except json.JSONDecodeError:
            layout = {}

    return {
        "id": moodboard_row["id"],
        "title": moodboard_row["title"],
        "thumbnailUrl": moodboard_row["cover_image_url"],
        "updatedAt": format_timestamp(moodboard_row["updated_at"]),
        "selectedOutfitId": layout.get("selectedOutfitId"),
        "outfits": layout.get("outfits") or [],
        "items": [
            {
                "id": row["client_id"],
                "title": row["title"] or "Untitled piece",
                "category": row["category"] or "Piece",
                "imageUrl": row["image_url"],
                "x": row["board_x"],
                "y": row["board_y"],
            }
            for row in item_rows
        ],
    }


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS"
    return response


@app.get("/")
def home():
    return jsonify(
        {
            "message": "Backend is running.",
            "status": "ok",
            "database_engine": "mysql",
        }
    )


@app.get("/health")
def health():
    return jsonify({"status": "healthy"})


@app.get("/test-db")
def test_db():
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 AS connected")
            result = cursor.fetchone()

        return jsonify(
            {
                "status": "ok",
                "database_engine": "mysql",
                "result": result,
            }
        )
    except Exception as exc:
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Failed to connect to Aurora.",
                    "details": str(exc),
                }
            ),
            500,
        )
    finally:
        if connection is not None:
            connection.close()


@app.route("/api/auth/signup", methods=["POST", "OPTIONS"])
def signup():
    if request.method == "OPTIONS":
        return ("", 204)

    payload = request.get_json(silent=True) or {}
    data, error_response = validate_signup_payload(payload)
    if error_response:
        return error_response

    connection = None
    try:
        ensure_schema_ready()
        connection = get_connection()
        with connection.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(
                """
                SELECT id
                FROM users
                WHERE email = %s OR username = %s
                LIMIT 1
                """,
                (data["email"], data["name"]),
            )
            existing_user = cursor.fetchone()
            if existing_user:
                return json_error("An account with that email or name already exists.", 409)

            hashed_password = generate_password_hash(data["password"])
            cursor.execute(
                """
                INSERT INTO users (username, email, password)
                VALUES (%s, %s, %s)
                """,
                (data["name"], data["email"], hashed_password),
            )
            connection.commit()
            user_id = cursor.lastrowid

        user = {"id": user_id, "name": data["name"], "email": data["email"]}
        token = create_auth_token(user)
        return jsonify({"token": token, "user": user}), 201
    except Exception as exc:
        if connection is not None:
            connection.rollback()
        return json_error("Sign up failed.", 500, str(exc))
    finally:
        if connection is not None:
            connection.close()


@app.route("/api/auth/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return ("", 204)

    payload = request.get_json(silent=True) or {}
    data, error_response = validate_login_payload(payload)
    if error_response:
        return error_response

    connection = None
    try:
        ensure_schema_ready()
        connection = get_connection()
        with connection.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(
                """
                SELECT id, username, email, password
                FROM users
                WHERE email = %s
                LIMIT 1
                """,
                (data["email"],),
            )
            row = cursor.fetchone()

        if row is None or not password_matches(data["password"], row["password"]):
            return json_error("Invalid email or password.", 401)

        user = make_user_response(row)
        token = create_auth_token(user)
        return jsonify({"token": token, "user": user})
    except Exception as exc:
        return json_error("Login failed.", 500, str(exc))
    finally:
        if connection is not None:
            connection.close()


@app.route("/api/auth/logout", methods=["POST", "OPTIONS"])
def logout():
    if request.method == "OPTIONS":
        return ("", 204)

    token, _user = get_authenticated_user()
    if token:
        auth_tokens.pop(token, None)
    return jsonify({"status": "ok"})


@app.route("/api/auth/me", methods=["GET", "OPTIONS"])
def me():
    if request.method == "OPTIONS":
        return ("", 204)

    _token, user = get_authenticated_user()
    if user is None:
        return json_error("Unauthorized.", 401)
    return jsonify({"user": user})


@app.route("/api/moodboards", methods=["GET", "POST", "OPTIONS"])
def moodboards():
    if request.method == "OPTIONS":
        return ("", 204)

    user, auth_error = require_authenticated_user()
    if auth_error:
        return auth_error

    connection = None
    try:
        ensure_schema_ready()
        connection = get_connection()

        if request.method == "GET":
            with connection.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT
                        m.id,
                        m.title,
                        m.cover_image_url,
                        m.updated_at,
                        COUNT(mi.id) AS item_count
                    FROM moodboards m
                    LEFT JOIN moodboard_items mi ON mi.moodboard_id = m.id
                    WHERE m.user_id = %s
                    GROUP BY m.id, m.title, m.cover_image_url, m.updated_at
                    ORDER BY m.updated_at DESC, m.id DESC
                    """,
                    (user["id"],),
                )
                rows = cursor.fetchall()

            return jsonify(
                {
                    "moodboards": [
                        {
                            "id": row["id"],
                            "title": row["title"],
                            "thumbnailUrl": row["cover_image_url"],
                            "updatedAt": format_timestamp(row["updated_at"]),
                            "itemCount": int(row["item_count"]),
                        }
                        for row in rows
                    ]
                }
            )

        payload = request.get_json(silent=True) or {}
        moodboard_data, error_response = validate_moodboard_payload(payload)
        if error_response:
            return error_response

        saved_row = save_moodboard(connection, user["id"], moodboard_data)
        connection.commit()

        return (
            jsonify(
                {
                    "moodboard": {
                        "id": saved_row["id"],
                        "title": saved_row["title"],
                        "thumbnailUrl": saved_row["cover_image_url"],
                        "updatedAt": format_timestamp(saved_row["updated_at"]),
                    }
                }
            ),
            201,
        )
    except Exception as exc:
        if connection is not None:
            connection.rollback()
        return json_error("Unable to save moodboard.", 500, str(exc))
    finally:
        if connection is not None:
            connection.close()


@app.route("/api/moodboards/<int:moodboard_id>", methods=["GET", "PUT", "OPTIONS"])
def moodboard_detail(moodboard_id):
    if request.method == "OPTIONS":
        return ("", 204)

    user, auth_error = require_authenticated_user()
    if auth_error:
        return auth_error

    connection = None
    try:
        ensure_schema_ready()
        connection = get_connection()

        if request.method == "GET":
            moodboard = fetch_moodboard_detail(connection, user["id"], moodboard_id)
            if moodboard is None:
                return json_error("Moodboard not found.", 404)
            return jsonify({"moodboard": moodboard})

        payload = request.get_json(silent=True) or {}
        moodboard_data, error_response = validate_moodboard_payload(payload)
        if error_response:
            return error_response

        save_moodboard(connection, user["id"], moodboard_data, moodboard_id=moodboard_id)
        connection.commit()

        moodboard = fetch_moodboard_detail(connection, user["id"], moodboard_id)
        if moodboard is None:
            return json_error("Moodboard not found.", 404)
        return jsonify({"moodboard": moodboard})
    except ValueError as exc:
        if connection is not None:
            connection.rollback()
        return json_error(str(exc), 404)
    except Exception as exc:
        if connection is not None:
            connection.rollback()
        return json_error("Unable to update moodboard.", 500, str(exc))
    finally:
        if connection is not None:
            connection.close()


@app.route("/api/ai/style-chat", methods=["POST", "OPTIONS"])
def ai_style_chat():
    if request.method == "OPTIONS":
        return ("", 204)

    user, auth_error = require_authenticated_user()
    if auth_error:
        return auth_error

    payload = request.get_json(silent=True) or {}
    ai_data, error_response = validate_ai_payload(payload)
    if error_response:
        return error_response

    try:
        response_payload = call_gemini_style_assistant(ai_data)
        return jsonify(
            {
                "userId": user["id"],
                "response": response_payload,
            }
        )
    except Exception as exc:
        return json_error("Unable to get AI styling advice.", 500, str(exc))


if __name__ == "__main__":
    app.run(debug=True, port=3001)
