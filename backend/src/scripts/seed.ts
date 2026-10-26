import { connectDb, mongoose } from '../db';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { Station, STATION_SEED } from '../models/Station';
import { Session } from '../models/Session';
import { hashPassword } from '../auth/password';

export const DEMO_EMAIL = 'arthur.pendelton@gmail.com';
export const DEMO_PASSWORD = 'railway2026';

/**
 * Bootstrap stations and demo account.
 * When force=false (default on server startup), it only creates the demo user
 * if they do not exist yet, preserving any live changes.
 */
export async function seedDemoData(force = false): Promise<void> {
  for (const station of STATION_SEED) {
    await Station.updateOne({ code: station.code }, { $set: station }, { upsert: true });
  }

  const existing = await User.findOne({ email: DEMO_EMAIL });

  if (existing && !force) {
    return;
  }

  if (existing && force) {
    await Session.deleteMany({ userId: existing._id });
    await Booking.deleteMany({ userId: existing._id });
    await User.deleteOne({ _id: existing._id });
    console.log('Removed previous demo passenger.');
  }

  const user = await User.create({
    email: DEMO_EMAIL,
    name: 'Arthur Pendelton',
    phone: '+91 98765 43210',
    passwordHash: await hashPassword(DEMO_PASSWORD),
    railcard: {
      type: '16-25',
      number: 'RC-8849-2026-UK',
      expiresAt: new Date('2027-08-14'),
      discountPercent: 34,
    },
    seatPreference: 'Window Seat (Forward)',
  });

  console.log(`Demo passenger ready: ${user.email} / ${DEMO_PASSWORD}`);

  await Booking.create([
    {
      userId: user._id,
      pnr: 'UKR-9042-1182',
      origin: 'London Euston',
      originCode: 'EUS',
      destination: 'Manchester Piccadilly',
      destinationCode: 'MAN',
      date: '2026-10-15',
      time: '08:30',
      fareType: 'Advance',
      fareName: 'Advance Single',
      unitPrice: 36.47,
      price: 36.47,
      passengers: [
        { name: 'Arthur Pendelton', coach: 'Coach B (Standard / Luggage Stacks)', seat: '14A' },
      ],
      status: 'CONFIRMED',
    },
    {
      userId: user._id,
      pnr: 'UKR-4912-3310',
      origin: "London King's Cross",
      originCode: 'KGX',
      destination: 'Edinburgh Waverley',
      destinationCode: 'EDB',
      date: '2026-10-18',
      time: '09:00',
      fareType: 'Off-Peak',
      fareName: 'Off-Peak Single',
      unitPrice: 82.9,
      price: 165.8,
      passengers: [
        { name: 'Arthur Pendelton', coach: 'Coach E (Standard)', seat: '12' },
        { name: 'Eleanor Pendelton', coach: 'Coach E (Standard)', seat: '13' },
      ],
      status: 'CONFIRMED',
    },
  ]);

  console.log(`Demo bookings seeded for ${user.email}`);
}

async function runStandaloneSeed() {
  await connectDb();
  await seedDemoData(true);
  console.log('Standalone seed complete.');
  await mongoose.disconnect();
}

// Run standalone if executed directly
if (process.argv[1]?.includes('seed')) {
  runStandaloneSeed().catch(async (err) => {
    console.error('Seed failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  });
}
