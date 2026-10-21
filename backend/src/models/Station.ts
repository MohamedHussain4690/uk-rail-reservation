import { Schema, model, Document } from 'mongoose';

export interface IStation extends Document {
  name: string;
  code: string;
  region: string;
}

const stationSchema = new Schema<IStation>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    region: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const Station = model<IStation>('Station', stationSchema);

/** National Rail CRS station database — used to bootstrap an empty collection. */
export const STATION_SEED: Array<Pick<IStation, 'name' | 'code' | 'region'>> = [
  { name: 'London Euston', code: 'EUS', region: 'London & South East' },
  { name: 'Manchester Piccadilly', code: 'MAN', region: 'North West' },
  { name: "London King's Cross", code: 'KGX', region: 'London & South East' },
  { name: 'Edinburgh Waverley', code: 'EDB', region: 'Scotland' },
  { name: 'Birmingham New Street', code: 'BHM', region: 'West Midlands' },
  { name: 'London Paddington', code: 'PAD', region: 'London & South East' },
  { name: 'Bristol Temple Meads', code: 'BRI', region: 'South West' },
  { name: 'Glasgow Central', code: 'GLC', region: 'Scotland' },
  { name: 'York', code: 'YRK', region: 'Yorkshire & Humber' },
  { name: 'Leeds', code: 'LDS', region: 'Yorkshire & Humber' },
];
