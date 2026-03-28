import re
import secrets

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


def password_matches(raw_password, stored_password):
    return stored_password == raw_password or check_password_hash(stored_password, raw_password)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
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


if __name__ == "__main__":
    app.run(debug=True, port=3001)
