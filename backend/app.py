from dotenv import load_dotenv
from flask import Flask, jsonify

from projectDB import get_connection

load_dotenv()


app = Flask(__name__)


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


if __name__ == "__main__":
  app.run(debug=True)
