import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Better-auth required fields
    id: {
      type: String,
      unique: true,
      sparse: true, // Allow MongoDB to use _id if id is not set
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
    },
    // Legacy fields - keep for compatibility
    password: {
      type: String,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    resetPasswordToken: String,
    resetPasswordExpiresAt: Date,
  },
  {
    timestamps: true,
    collection: 'user' // Use better-auth collection name (singular)
  }
);

export const User = mongoose.model("User", userSchema);

