import { Schema, model, Document, Types } from 'mongoose';
import { isGmailAddress, isStoredIndianPhone } from '../lib/validation';

export interface IRailcard {
  type: string;
  number: string;
  expiresAt: Date | null;
  discountPercent: number;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  name: string;
  phone: string;
  passwordHash: string;
  railcard: IRailcard;
  seatPreference: string;
  createdAt: Date;
  updatedAt: Date;
}

const railcardSchema = new Schema<IRailcard>(
  {
    type: { type: String, default: 'None', trim: true },
    number: { type: String, default: '', trim: true },
    expiresAt: { type: Date, default: null },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // Guards the rule at the data layer too, so it holds even for writes
      // that bypass the HTTP routes (seed scripts, future admin tooling).
      validate: {
        validator: (value: string) => isGmailAddress(value),
        message: 'Email must be a Gmail address ending in @gmail.com.',
      },
    },
    name: { type: String, required: true, trim: true },
    phone: {
      type: String,
      default: '',
      trim: true,
      // Blank is allowed; anything present must be "+91 XXXXX XXXXX".
      validate: {
        validator: (value: string) => value === '' || isStoredIndianPhone(value),
        message: 'Phone must be an Indian mobile number in the form +91 98765 43210.',
      },
    },
    // Stored as "<salt>:<derivedKey>" — never the raw password.
    passwordHash: { type: String, required: true },
    railcard: { type: railcardSchema, default: () => ({}) },
    seatPreference: { type: String, default: 'Window Seat (Forward)', trim: true },
  },
  { timestamps: true }
);

/** Shape safe to send to the browser — never includes password material. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  railcard: IRailcard;
  seatPreference: string;
  createdAt: Date;
}

export function toPublicUser(user: IUser): PublicUser {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    phone: user.phone,
    railcard: user.railcard,
    seatPreference: user.seatPreference,
    createdAt: user.createdAt,
  };
}

export const User = model<IUser>('User', userSchema);
