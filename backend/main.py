
import os
from datetime import datetime, timezone
from typing import Optional, List
from pymongo import MongoClient, DESCENDING
from pymongo.errors import PyMongoError
from bson import ObjectId
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, Header, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import connect, Error
from pathlib import Path
from dotenv import load_dotenv

ENV_FILE = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_FILE, override=True)

app = FastAPI(
    title="ParcelHub API",
    version="1.1.0",
    description="Smart Parcel & Locker Management System API with Role-Based Access Control (RBAC) and Parcel Pickup Workflow."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------
# Database Connections
# ---------------------------------------------------------------------
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

try:
    incidents_collection.create_index([("parcel_tracking_code", 1)])
    incidents_collection.create_index([("status", 1), ("created_at", DESCENDING)])
except Exception:
    pass


def get_connection():
    return connect(
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "parcelhub"),
    )


def ensure_schema():
    """Ensure required columns such as parcels.picked_up_at exist."""
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute("SHOW COLUMNS FROM parcels LIKE 'picked_up_at'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE parcels ADD COLUMN picked_up_at TIMESTAMP NULL DEFAULT NULL")
            connection.commit()
        cursor.close()
        connection.close()
    except Exception:
        pass


@app.on_event("startup")
def startup_event():
    ensure_schema()


# ---------------------------------------------------------------------
# Role-Based Access Control (RBAC)
# ---------------------------------------------------------------------
VALID_ROLES = {"admin", "security", "courier", "employee"}

DEMO_USERS_BY_ROLE = {
    "admin": {
        "user_id": 1,
        "full_name": "Aarav Sharma",
        "email": "aarav.admin@example.com",
        "role": "admin",
        "account_status": "active"
    },
    "security": {
        "user_id": 2,
        "full_name": "Meera Nair",
        "email": "meera.security@example.com",
        "role": "security",
        "account_status": "active"
    },
    "courier": {
        "user_id": 3,
        "full_name": "Kiran Rao",
        "email": "kiran.courier@example.com",
        "role": "courier",
        "account_status": "active"
    },
    "employee": {
        "user_id": 4,
        "full_name": "Ananya Iyer",
        "email": "ananya.employee@example.com",
        "role": "employee",
        "account_status": "active"
    },
}


def get_current_user(
    x_user_role: Optional[str] = Header(None, description="User role: admin, security, courier, employee"),
    x_user_email: Optional[str] = Header(None, description="User email (e.g. aarav.admin@example.com)"),
    authorization: Optional[str] = Header(None, description="Bearer token or role string"),
    role: Optional[str] = Query(None, description="Role parameter (convenience for demo/testing)"),
    email: Optional[str] = Query(None, description="Email parameter (convenience for demo/testing)"),
) -> dict:
    """
    Identifies and authenticates the requesting user.
    Extracts role/email from headers, query parameters, or Authorization token.
    Enforces that valid credentials/roles must be provided for protected endpoints.
    """
    resolved_role = (role or x_user_role or "").strip().lower()
    resolved_email = (email or x_user_email or "").strip().lower()

    if not resolved_role and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1].strip().lower()
            if token in VALID_ROLES:
                resolved_role = token
            elif "@" in token:
                resolved_email = token

    # Check for authentication credentials
    if not resolved_role and not resolved_email:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Provide 'X-User-Role' header or '?role=' parameter (admin, security, courier, employee)."
        )

    # 1. If email is provided, find user in MySQL database first
    if resolved_email:
        try:
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                "SELECT user_id, full_name, email, role, account_status FROM users WHERE LOWER(email) = %s",
                (resolved_email,)
            )
            user_record = cursor.fetchone()
            cursor.close()
            conn.close()
            if user_record:
                return user_record
        except Exception:
            pass

        # Fallback to demo users map by email
        for demo_u in DEMO_USERS_BY_ROLE.values():
            if demo_u["email"].lower() == resolved_email:
                return demo_u

    # 2. If role is provided, validate role
    if resolved_role:
        if resolved_role not in VALID_ROLES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role '{resolved_role}'. Allowed roles: {', '.join(sorted(VALID_ROLES))}"
            )

        # Look up first active user with this role from database
        try:
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                "SELECT user_id, full_name, email, role, account_status FROM users WHERE role = %s AND account_status = 'active' ORDER BY user_id LIMIT 1",
                (resolved_role,)
            )
            db_user = cursor.fetchone()
            cursor.close()
            conn.close()
            if db_user:
                return db_user
        except Exception:
            pass

        # Fallback to seeded demo user
        return DEMO_USERS_BY_ROLE.get(resolved_role, {
            "user_id": 0,
            "full_name": resolved_role.capitalize(),
            "email": f"{resolved_role}@example.com",
            "role": resolved_role,
            "account_status": "active"
        })

    raise HTTPException(status_code=401, detail="Unable to authenticate user")


def require_roles(allowed_roles: List[str]):
    """FastAPI dependency to enforce Role-Based Access Control."""
    def role_verifier(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get("role", "").lower()
        if user_role not in [r.lower() for r in allowed_roles]:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: role '{user_role}' is not authorized. Required: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_verifier


# ---------------------------------------------------------------------
# Authentication & Identity Endpoints
# ---------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = None


@app.post("/api/auth/login")
def login(payload: LoginRequest):
    """Authenticate a user by email and return their profile with role."""
    email = payload.email.strip().lower()
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT user_id, full_name, email, role, account_status FROM users WHERE LOWER(email) = %s",
            (email,)
        )
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if not user:
            # Check demo users fallback
            for demo_u in DEMO_USERS_BY_ROLE.values():
                if demo_u["email"].lower() == email:
                    user = demo_u
                    break

        if not user:
            raise HTTPException(status_code=404, detail="User with this email not found")

        if user.get("account_status") != "active":
            raise HTTPException(status_code=403, detail="User account is inactive")

        return {
            "user_id": user["user_id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
            "token": f"bearer-{user['role']}-{user['user_id']}"
        }
    except Error as exc:
        raise HTTPException(status_code=503, detail="Database connection error") from exc


@app.get("/api/auth/me")
def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Return the profile and permissions of the currently authenticated user."""
    role = current_user.get("role")
    return {
        "user": current_user,
        "permissions": {
            "can_view_users": role == "admin",
            "can_view_all_parcels": role in ["admin", "security", "courier"],
            "can_pickup_parcels": role in ["admin", "security", "employee"],
            "can_manage_incidents": role in ["admin", "security"],
            "can_view_lockers": role in ["admin", "security", "courier", "employee"]
        }
    }


# ---------------------------------------------------------------------
# Core Health & Information Endpoints
# ---------------------------------------------------------------------
@app.get("/")
def home():
    return {
        "message": "ParcelHub API is running",
        "version": "1.1.0",
        "features": ["RBAC", "Parcel Pickup Workflow", "Smart Lockers", "Incidents"]
    }


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


# ---------------------------------------------------------------------
# User Management (Restricted to Admin)
# ---------------------------------------------------------------------
@app.get("/api/users")
def get_users(current_user: dict = Depends(require_roles(["admin"]))):
    """Retrieve system users. Restricted to Admin role only."""
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


# ---------------------------------------------------------------------
# Parcel Management & Pickup Workflow
# ---------------------------------------------------------------------
@app.get("/api/parcels")
def get_parcels(
    include_all: bool = Query(False, description="Admins/Security can force retrieval of all parcels"),
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve parcels based on user role:
    - Admin, Security, Courier: View all parcels.
    - Employee: Views parcels addressed to them (unless include_all is allowed).
    """
    ensure_schema()
    role = current_user.get("role")
    user_id = current_user.get("user_id")

    query = """
        SELECT p.parcel_id, p.tracking_code, p.description,
               p.parcel_status, p.received_at, p.picked_up_at,
               p.recipient_user_id,
               u.full_name AS recipient_name,
               u.email AS recipient_email,
               l.locker_id,
               l.locker_code,
               l.location AS locker_location,
               la.assignment_id
        FROM parcels p
        JOIN users u ON u.user_id = p.recipient_user_id
        LEFT JOIN locker_assignments la ON la.parcel_id = p.parcel_id AND la.released_at IS NULL
        LEFT JOIN lockers l ON l.locker_id = la.locker_id
    """
    params = []

    # If the user is an employee and hasn't requested include_all (or is not staff), filter by recipient
    if role == "employee" and not include_all:
        query += " WHERE p.recipient_user_id = %s OR LOWER(u.email) = %s "
        params.extend([user_id, current_user.get("email", "").lower()])

    query += " ORDER BY p.parcel_id DESC"

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, tuple(params))
        result = cursor.fetchall()
        cursor.close()
        connection.close()
        return result
    except Error as exc:
        raise HTTPException(status_code=503, detail=f"Unable to retrieve parcels: {exc}") from exc


@app.post("/api/parcels/{parcel_id}/pickup")
def pickup_parcel(
    parcel_id: int,
    current_user: dict = Depends(require_roles(["admin", "security", "employee"]))
):
    """
    Parcel Pickup Workflow:
    - Updates parcel status to 'picked_up' and records pickup timestamp.
    - Releases the associated locker assignment (sets released_at timestamp).
    - Makes the locker available again (sets locker_status to 'available').
    - Updates delivery record with picked_up status and timestamp.
    - Enforces RBAC: Employees can only pick up their own parcels; Admin and Security can handle desk handovers.
    """
    ensure_schema()
    connection = None
    try:
        connection = get_connection()
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)

        # 1. Retrieve parcel details with row lock
        cursor.execute(
            """
            SELECT p.parcel_id, p.tracking_code, p.recipient_user_id,
                   p.description, p.parcel_status, p.received_at,
                   u.full_name AS recipient_name, u.email AS recipient_email
            FROM parcels p
            JOIN users u ON u.user_id = p.recipient_user_id
            WHERE p.parcel_id = %s
            FOR UPDATE
            """,
            (parcel_id,)
        )
        parcel = cursor.fetchone()

        if not parcel:
            cursor.close()
            connection.rollback()
            connection.close()
            raise HTTPException(status_code=404, detail=f"Parcel with ID {parcel_id} not found")

        # 2. Check if already picked up
        if parcel["parcel_status"] == "picked_up":
            cursor.close()
            connection.rollback()
            connection.close()
            raise HTTPException(
                status_code=400,
                detail=f"Parcel '{parcel['tracking_code']}' has already been picked up."
            )

        if parcel["parcel_status"] == "returned":
            cursor.close()
            connection.rollback()
            connection.close()
            raise HTTPException(
                status_code=400,
                detail=f"Parcel '{parcel['tracking_code']}' is marked as returned and cannot be picked up."
            )

        # 3. RBAC validation: Employee can only pick up their own parcels
        if current_user["role"] == "employee":
            emp_id = current_user.get("user_id")
            emp_email = current_user.get("email", "").lower()
            if parcel["recipient_user_id"] != emp_id and parcel["recipient_email"].lower() != emp_email:
                cursor.close()
                connection.rollback()
                connection.close()
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: Recipients can only pick up parcels addressed to them."
                )

        pickup_time = datetime.now()

        # 4. Update parcel status and pickup timestamp
        cursor.execute(
            """
            UPDATE parcels
            SET parcel_status = 'picked_up',
                picked_up_at = %s
            WHERE parcel_id = %s
            """,
            (pickup_time, parcel_id)
        )

        # 5. Update deliveries record
        cursor.execute(
            """
            UPDATE deliveries
            SET delivery_status = 'picked_up',
                picked_up_at = %s
            WHERE parcel_id = %s
            """,
            (pickup_time, parcel_id)
        )

        # 6. Locate active locker assignment
        cursor.execute(
            """
            SELECT la.assignment_id, la.locker_id, l.locker_code, l.location
            FROM locker_assignments la
            JOIN lockers l ON l.locker_id = la.locker_id
            WHERE la.parcel_id = %s AND la.released_at IS NULL
            ORDER BY la.assignment_id DESC
            LIMIT 1
            """,
            (parcel_id,)
        )
        active_assignment = cursor.fetchone()

        locker_released_info = None

        if active_assignment:
            # Release locker assignment
            cursor.execute(
                """
                UPDATE locker_assignments
                SET released_at = %s
                WHERE assignment_id = %s
                """,
                (pickup_time, active_assignment["assignment_id"])
            )

            # Make locker available again
            cursor.execute(
                """
                UPDATE lockers
                SET locker_status = 'available'
                WHERE locker_id = %s
                """,
                (active_assignment["locker_id"],)
            )

            locker_released_info = {
                "assignment_id": active_assignment["assignment_id"],
                "locker_id": active_assignment["locker_id"],
                "locker_code": active_assignment["locker_code"],
                "location": active_assignment["location"],
                "released_at": pickup_time.isoformat()
            }

        # 7. Commit transaction
        connection.commit()
        cursor.close()
        connection.close()

        return {
            "success": True,
            "message": f"Parcel '{parcel['tracking_code']}' successfully picked up.",
            "parcel": {
                "parcel_id": parcel["parcel_id"],
                "tracking_code": parcel["tracking_code"],
                "parcel_status": "picked_up",
                "picked_up_at": pickup_time.isoformat(),
                "recipient_name": parcel["recipient_name"]
            },
            "locker_released": locker_released_info,
            "picked_up_by": {
                "full_name": current_user.get("full_name"),
                "email": current_user.get("email"),
                "role": current_user.get("role")
            }
        }
    except HTTPException:
        raise
    except Error as exc:
        if connection and connection.is_connected():
            connection.rollback()
            connection.close()
        raise HTTPException(
            status_code=500,
            detail=f"Database error during pickup: {exc}"
        ) from exc


# ---------------------------------------------------------------------
# Smart Locker Management
# ---------------------------------------------------------------------
@app.get("/api/lockers")
def get_lockers(current_user: dict = Depends(require_roles(["admin", "security", "courier", "employee"]))):
    """Retrieve lockers and their current availability status."""
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


# ---------------------------------------------------------------------
# Incident Management (Restricted to Admin & Security)
# ---------------------------------------------------------------------
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
def get_incidents(current_user: dict = Depends(require_roles(["admin", "security"]))):
    """Retrieve incident reports from MongoDB. Restricted to Admin and Security."""
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
def get_incident(
    incident_id: str,
    current_user: dict = Depends(require_roles(["admin", "security"]))
):
    """Retrieve a specific incident by ID. Restricted to Admin and Security."""
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
def create_incident(
    payload: IncidentCreate,
    current_user: dict = Depends(require_roles(["admin", "security"]))
):
    """Record a new parcel incident. Restricted to Admin and Security."""
    tracking_code = payload.parcel_tracking_code.strip()
    description = payload.description.strip()
    reported_by = payload.reported_by.strip() or current_user.get("email")

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
