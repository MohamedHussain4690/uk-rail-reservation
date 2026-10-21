import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

import { connectDb } from './src/db';
import { attachUser } from './src/auth/session';
import authRoutes from './src/routes/auth';
import bookingRoutes from './src/routes/bookings';
import cateringRoutes from './src/routes/catering';
import fareRoutes from './src/routes/fares';
import stationRoutes from './src/routes/stations';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Resolve the signed-in passenger (if any) for every request.
app.use(attachUser);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    system: 'UK National Rail Reservation API v1.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/fares', fareRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/catering', cateringRoutes);

// Unknown API routes must answer JSON, never the HTML error page.
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `No API route for ${req.method} ${req.originalUrl}` });
});

// Central error handler — keeps malformed JSON and thrown errors in JSON shape.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);

  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, message: 'Request body is not valid JSON.' });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ---------------------------------------------------------------------------
// Single-port production mode.
// When a frontend build exists, serve it from this same server so the whole
// app runs on one origin (and one port) with no CORS involved.
// In development this silently does nothing and Vite serves the UI on 5174.
// ---------------------------------------------------------------------------

/**
 * Resolve the repository root by walking up from this file until a sibling
 * `frontend/` folder appears. This works both for `tsx server.ts`
 * (__dirname = backend/) and for the compiled `node dist/server.js`
 * (__dirname = backend/dist/).
 */
function findProjectRoot(start: string): string {
  let dir = start;
  for (let depth = 0; depth < 6; depth++) {
    if (fs.existsSync(path.join(dir, 'frontend', 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(start, '..');
}

const FRONTEND_DIST = path.join(findProjectRoot(__dirname), 'frontend', 'dist');
const FRONTEND_INDEX = path.join(FRONTEND_DIST, 'index.html');

if (fs.existsSync(FRONTEND_INDEX)) {
  app.use(express.static(FRONTEND_DIST));

  // SPA fallback — any non-API route hands back index.html so client-side
  // routing keeps working on a hard refresh.
  app.get('*', (req, res) => {
    res.sendFile(FRONTEND_INDEX);
  });

  console.log(`Serving frontend build from ${FRONTEND_DIST}`);
} else {
  console.log('No frontend build found (frontend/dist) — API-only mode.');
  console.log('Run "npm run build" in the frontend folder to enable single-port serving.');
}

async function start() {
  try {
    await connectDb();
  } catch (err) {
    console.error('Could not connect to MongoDB. Is the MongoDB service running?');
    console.error(err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`UK National Rail Backend API running on port ${PORT}`);
  });
}

start();
