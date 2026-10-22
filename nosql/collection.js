// MongoDB collection setup.
// Run with mongosh against the ParcelHub database.

db = db.getSiblingDB("parcelhub");

db.createCollection("incidents", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "parcel_tracking_code",
        "incident_type",
        "description",
        "status",
        "created_at"
      ],
      properties: {
        parcel_tracking_code: { bsonType: "string" },
        incident_type: {
          enum: [
            "damaged_parcel",
            "delivery_exception",
            "missing_parcel",
            "security_observation",
            "other"
          ]
        },
        description: { bsonType: "string" },
        reported_by: { bsonType: "string" },
        severity: { enum: ["low", "medium", "high"] },
        status: { enum: ["open", "investigating", "resolved"] },
        created_at: { bsonType: "date" }
      }
    }
  }
});
