import { connectDb, mongoose } from '../db';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { Station, STATION_SEED } from '../models/Station';
import { Session } from '../models/Session';
import { hashPassword } from '../auth/password';

const DEMO_EMAIL = 'arthur.pendelton@gmail.com';
const DEMO_PASSWORD = 'railway2026';

async function seed() {
  await connectDb();

  console.log('Seeding National Rail station database…');
  for (const station of STATION_SEED) {
    await Station.updateOne({ code: station.code }, { $set: station }, { upsert: true });
  }
  console.log(`  stations: ${await Station.countDocuments()}`);

  const existing = await User.findOne({ email: DEMO_EMAIL });

  if (existing) {
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

  console.log(`Demo passenger created: ${user.email} / ${DEMO_PASSWORD}`);

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

  console.log(`  bookings: ${await Booking.countDocuments({ userId: user._id })}`);
  console.log('Seed complete.');

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
