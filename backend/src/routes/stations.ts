import { Router, Request, Response } from 'express';
import { Station, STATION_SEED } from '../models/Station';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    let stations = await Station.find().sort({ name: 1 }).select('-_id name code region').lean();

    // Bootstrap an empty collection so a fresh database still works.
    if (stations.length === 0) {
      await Station.insertMany(STATION_SEED);
      stations = await Station.find().sort({ name: 1 }).select('-_id name code region').lean();
    }

    res.json(stations);
  } catch (err) {
    console.error('stations failed:', err);
    res.status(500).json({ success: false, message: 'Could not load the station database.' });
  }
});

export default router;
