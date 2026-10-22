
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import connect, Error
from pathlib import Path
from dotenv import load_dotenv

ENV_FILE = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_FILE, override=True)

app = FastAPI(title="ParcelHub API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

def get_connection():
    return connect(
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "parcelhub"),
    )


@app.get("/")
def home():
    return {"message": "ParcelHub API is running"}


@app.get("/health")
def health():
    try:
        connection = get_connection()
        connection.close()
        return {"api": "ok", "mysql": "connected"}
    except Error as exc:
        raise HTTPException(
            status_code=503,
            detail=f"MySQL connection failed: {exc}"
        ) from exc


@app.get("/api/users")
def get_users():
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT user_id, full_name, email, role, account_status "
            "FROM users ORDER BY user_id"
        )
        result = cursor.fetchall()
        cursor.close()
        connection.close()
        return result
    except Error as exc:
        raise HTTPException(status_code=503, detail="Unable to retrieve users") from exc


@app.get("/api/parcels")
def get_parcels():
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT p.parcel_id, p.tracking_code, p.description,
                   p.parcel_status, p.received_at,
                   u.full_name AS recipient_name,
                   u.email AS recipient_email
            FROM parcels p
            JOIN users u ON u.user_id = p.recipient_user_id
            ORDER BY p.parcel_id DESC
        """)
        result = cursor.fetchall()
        cursor.close()
        connection.close()
        return result
    except Error as exc:
        raise HTTPException(status_code=503, detail="Unable to retrieve parcels") from exc


@app.get("/api/lockers")
def get_lockers():
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT locker_id, locker_code, location, locker_size, locker_status
            FROM lockers
            ORDER BY locker_id
        """)
        result = cursor.fetchall()
        cursor.close()
        connection.close()
        return result
    except Error as exc:
        raise HTTPException(status_code=503, detail="Unable to retrieve lockers") from exc

