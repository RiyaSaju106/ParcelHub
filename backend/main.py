
import os
from datetime import datetime, timezone
from pymongo import MongoClient, DESCENDING
from pymongo.errors import PyMongoError
from bson import ObjectId
from pydantic import BaseModel, Field
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
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
# MongoDB connection for parcel incident reports
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://127.0.0.1:27017"
)

mongo_client = MongoClient(
    MONGO_URI,
    serverSelectionTimeoutMS=3000
)

mongo_db = mongo_client["parcelhub"]
incidents_collection = mongo_db["incidents"]

# Indexes support faster incident searches
incidents_collection.create_index(
    [("parcel_tracking_code", 1)]
)
incidents_collection.create_index(
    [("status", 1), ("created_at", DESCENDING)]
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
class IncidentCreate(BaseModel):
    parcel_tracking_code: str = Field(min_length=1, max_length=50)
    incident_type: str
    description: str = Field(min_length=1, max_length=2000)
    reported_by: str = Field(default="security.desk", max_length=100)
    severity: str = "medium"


ALLOWED_INCIDENT_TYPES = {
    "damaged_parcel",
    "delivery_exception",
    "missing_parcel",
    "security_observation",
    "other",
}

ALLOWED_SEVERITIES = {"low", "medium", "high"}


def serialize_incident(incident):
    incident["_id"] = str(incident["_id"])
    incident["created_at"] = incident["created_at"].isoformat()
    return incident


@app.get("/api/incidents")
def get_incidents():
    try:
        incidents = incidents_collection.find().sort(
            "created_at", DESCENDING
        ).limit(100)

        return [serialize_incident(item) for item in incidents]
    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to retrieve incidents from MongoDB"
        ) from exc


@app.get("/api/incidents/{incident_id}")
def get_incident(incident_id: str):
    if not ObjectId.is_valid(incident_id):
        raise HTTPException(status_code=400, detail="Invalid incident ID")

    try:
        incident = incidents_collection.find_one(
            {"_id": ObjectId(incident_id)}
        )

        if incident is None:
            raise HTTPException(
                status_code=404,
                detail="Incident not found"
            )

        return serialize_incident(incident)
    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to retrieve incident from MongoDB"
        ) from exc


@app.post("/api/incidents", status_code=201)
def create_incident(payload: IncidentCreate):
    tracking_code = payload.parcel_tracking_code.strip()
    description = payload.description.strip()
    reported_by = payload.reported_by.strip()

    if not tracking_code or not description or not reported_by:
        raise HTTPException(
            status_code=422,
            detail="Tracking code, description and reporter are required"
        )

    if payload.incident_type not in ALLOWED_INCIDENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail="Invalid incident type"
        )

    if payload.severity not in ALLOWED_SEVERITIES:
        raise HTTPException(
            status_code=422,
            detail="Severity must be low, medium, or high"
        )
        # Verify that the parcel exists in MySQL
    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            "SELECT parcel_id FROM parcels WHERE tracking_code = %s",
            (tracking_code,)
        )
        parcel = cursor.fetchone()

        cursor.close()
        connection.close()

        if parcel is None:
            raise HTTPException(
                status_code=404,
                detail="Parcel tracking code does not exist"
            )

    except Error as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to validate parcel tracking code"
        ) from exc
    incident = {
        "parcel_tracking_code": tracking_code,
        "incident_type": payload.incident_type,
        "description": description,
        "reported_by": reported_by,
        "severity": payload.severity,
        "status": "open",
        "created_at": datetime.now(timezone.utc),
    }

    try:
        result = incidents_collection.insert_one(incident)
        incident["_id"] = result.inserted_id
        return serialize_incident(incident)
    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to save incident to MongoDB"
        ) from exc
