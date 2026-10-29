# UK National Rail Reservation

A full-stack UK rail booking and catering management system built with Express, MongoDB, and React (Vite).

> 🌐 **Live Demo:** [https://uk-rail-reservation.onrender.com/](https://uk-rail-reservation.onrender.com/)  
> Deployed on **Render** with a cloud **MongoDB Atlas** cluster.

```
UK_Rail_Reservation/
├── backend/     Express API, Mongoose models, session auth  (port 5000)
└── frontend/    React + TypeScript + Tailwind UI            (port 5174)
```

In development the browser talks to the frontend (port 5174);
Vite proxies every `/api` request to the backend. In production the backend serves the
built frontend from its own port, so the app runs single-origin on **port 5000** (deployed live on Render).

---

## Prerequisites

- **Node.js 20+** (developed against v24)
- **MongoDB** running locally on `127.0.0.1:27017`

The backend exits with a clear message if Mongo is unreachable — start the Windows
service (`net start MongoDB`) or point it elsewhere:

```powershell
$env:MONGODB_URI = "mongodb://127.0.0.1:27017/uk_rail"
```

No build tools are required: passwords are hashed with Node's built-in `crypto.scrypt`
rather than a native module like `bcrypt`.

---

## First-time setup

```powershell
# backend
cd backend
npm install
npm run seed      # creates the station list, demo passenger and two passes

# frontend (separate terminal)
cd frontend
npm install
```

## Running in development

```powershell
cd backend;  npm run dev     # API on port 5000
cd frontend; npm run dev     # UI  on port 5174
```

### Demo account

The live deployment comes pre-seeded with a demo passenger and sample tickets:

| Email | Password |
| --- | --- |
| `arthur.pendelton@gmail.com` | `railway2026` |

> **Quick Sign-in:** On the live sign-in screen, click the **"Click to Autofill"** badge to instantly populate the credentials.

Seeded with a 16-25 Railcard (34% off) and two confirmed passes in the wallet. New passenger accounts can also be created from the **Create Account** tab.

### Passenger identity rules

Two details are validated on both registration and profile updates:

- **Email must be a Gmail address.** The `@gmail.com` domain is required exactly, so
  `user@googlemail.com`, `user@yahoo.com` and `user@gmail.co.uk` are all rejected.
  Addresses are trimmed and lowercased before being stored.
- **Phone must be an Indian mobile number** — 10 digits beginning 6–9. Input is
  accepted as `9876543210`, `09876543210`, `+91 98765 43210` or `91-98765-43210`, and
  is always stored in the canonical form `+91 98765 43210`. The field is optional;
  leaving it blank stores an empty string.

The rules live in `backend/src/lib/validation.ts`, with a mirrored copy in
`frontend/src/lib/validation.ts` so the forms can reject bad input without a round
trip. The backend remains the authority, and the Mongoose schema in
`backend/src/models/User.ts` enforces the same rules at the data layer.

### Group bookings and pricing

A booking covers **one to four travellers**. Each traveller gets their own name and
reserved seat, held in a `passengers` array on the booking:

    passengers: [
      { name: 'Arthur Pendelton', coach: 'Coach B (Standard / Luggage Stacks)', seat: '14A' },
      { name: 'Eleanor Pendelton', coach: 'Coach B (Standard / Luggage Stacks)', seat: '14B' }
    ]

The seat picker allocates one seat per traveller and will not continue until every
seat is chosen and every guest name is entered.

Seat availability is enforced by the **server**, not the UI. A reservation is unique
per **departure (travel date + departure time), coach and seat**, so two passengers
can never hold the same seat on the same train:

- `GET /api/bookings/seats?date=&time=` lists what is already sold, and the picker
  greys those seats out.
- `POST /api/bookings` re-checks before inserting and answers `409` if a seat was
  taken while the passenger was choosing.
- Cancelling a pass releases its seats immediately.

**Prices are never taken from the browser.** `POST /api/bookings` accepts the route,
fare category and traveller list; the server looks the fare up in
`backend/src/lib/fares.ts`, applies the railcard discount stored on the account, and
writes `unitPrice` plus `price = unitPrice × passengers.length`. The planner shows the
same figures because it reads them from `GET /api/fares`, so a tampered request cannot
change what is charged.

The e-ticket prints as a **single A4 sheet** regardless of party size: one pass with a
passenger manifest listing every traveller and their seat.

### Cancellations

Cancelling a pass stamps `cancelledAt` on the booking. It stays in the wallet — greyed
out, marked `CANCELLED`, with a live countdown — for **three hours**, then clears itself
out. The cut-off is applied server-side in `GET /api/bookings`, so the pass cannot be
resurrected by reloading the page, and `DELETE /api/bookings/:id` refuses a second
cancellation so the window cannot be extended.

    CANCELLATION_VISIBILITY_HOURS = 3     // backend/src/models/Booking.ts

The record is then **purged from MongoDB**, not just hidden:

    bookingSchema.index({ cancelledAt: 1 }, { expireAfterSeconds: 10800 })

A TTL index on `cancelledAt` has the TTL monitor delete the document once the
cancellation is three hours old, so a cancelled PNR is gone for good. Live passes never
carry `cancelledAt`, and a TTL index ignores documents whose indexed field is missing, so
confirmed bookings are never collected.

The monitor sweeps about once a minute, so the exact three-hour boundary is enforced by
`hasVanished` on the way out of `GET /api/bookings`, with the physical delete following
moments later.

## Production & Cloud Deployment

### Local Production Build (Single Port)

```powershell
cd frontend; npm run build
cd backend;  npm run build
cd backend;  npm start      # UI + API together on port 5000
```

The backend auto-detects `frontend/dist` and serves it with an SPA fallback.

### Live Cloud Deployment (Render + MongoDB Atlas)

The project is hosted live on **Render** backed by a **MongoDB Atlas** M0 cluster:
- **Live URL:** [https://uk-rail-reservation.onrender.com/](https://uk-rail-reservation.onrender.com/)
- **Build Command:** `cd frontend && npm install && npm run build && cd ../backend && npm install && npm run build`
- **Start Command:** `cd backend && npm start`
- **Environment Variable:** `MONGODB_URI` pointing to the cloud MongoDB Atlas connection string.
- On initial startup, the backend automatically seeds the National Rail station database, demo passenger (`arthur.pendelton@gmail.com`), and sample wallet tickets.

---

## Authentication

Session-based, using an **httpOnly, SameSite=Lax cookie** (`ukr_session`) — no tokens in
`localStorage`, so the session is not readable from JavaScript. Sessions are persisted in
the `sessions` collection with a **TTL index**, so MongoDB expires them automatically.

Passwords are stored as `scrypt` hashes in the format `<saltHex>:<derivedKeyHex>` and
compared with `crypto.timingSafeEqual`.

## API

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | Service status |
| `GET` | `/api/stations` | — | Station database (seeded on first request) |
| `POST` | `/api/auth/register` | — | Create an account and start a session |
| `POST` | `/api/auth/login` | — | Sign in |
| `POST` | `/api/auth/logout` | — | Destroy the session |
| `GET` | `/api/auth/me` | ✔ | Current passenger |
| `PATCH` | `/api/auth/me` | ✔ | Update name, phone, seat preference, railcard |
| `GET` | `/api/fares` | ✔ | Server-priced fares for a route, discounted with the account's railcard |
| `POST` | `/api/bookings` | ✔ | Book one to four passengers; the server prices the fare and returns a unique PNR |
| `GET` | `/api/bookings/seats` | ✔ | Seats already sold on a departure (`date`, `time`) |
| `GET` | `/api/bookings` | ✔ | The passenger's ticket wallet |
| `DELETE` | `/api/bookings/:id` | ✔ | Cancel a booking; the pass clears from the wallet and is purged 3 hours later |
| `POST` | `/api/catering/order` | ✔ | Attach one or more passenger pantry orders to a reservation (single `$push` with `$each`) |

All errors are returned as JSON. `401` means no valid session; `403`-style ownership is
enforced by scoping every booking query to `userId`.

A catering order batch is addressed by `bookingReference` (the PNR). The
`passengerOrders[]` array carries one entry per traveller:

```json
{
  "bookingReference": "UKR-2268-4178",
  "deliveryMilestone": "Post-Rugby Transit (09:15 - 09:35)",
  "passengerOrders": [
    {
      "passengerId": "arthur-12a",
      "passengerName": "Arthur Pendelton",
      "assignedCoach": "Coach B",
      "assignedSeat": "12A",
      "items": [{ "itemId": "camden-hells-lager", "name": "Camden Hells Lager", "quantity": 2, "unitPrice": 4.8 }],
      "subtotal": 9.6
    }
  ]
}
```

Each entry is matched to a seat held on that reservation, so an order can never
be attached to a seat the traveller does not hold. The whole batch lands in one
`$push` with `$each`, and the response is `{ success: true, updatedOrders }`
containing the reservation's complete `cateringOrders` array. A declared
`subtotal` is checked against the lines; a forged figure is rejected with the
expected amount.

The earlier single-seat shape is still accepted for the one-passenger checkout
and for callers that only know a seat: `assignedCoach`, `assignedSeat`, `items`
and `totalAmount` are validated as before, with `passengerId` treated as a seat
label fallback. That path returns the older `orderId` / `totalAmount` /
`updatedReservation` response.

First Class Advance reservations receive a 10% at-seat concession. The server derives
it from the stored fare (never from the browser), subtracts it from the line total,
stores it as `cateringOrders[].concession`, and returns the accepted `totalAmount`
alongside the order id.

On the board, checkout is a slide-over sheet in
`frontend/src/components/PantryCartDrawer.tsx`: it confirms the seat and fare, offers
the trolley runs scheduled from the bound departure, shows the subtotal and any
concession, and POSTs the order. The cart itself lives in
`frontend/src/context/PantryContext.tsx`, which tags every line with the passenger
and seat it belongs to: it ingests the whole party from the bound reservation, exposes
`activePassengerId` / `setActivePassenger`, `getPassengerItems` / `getPassengerTotal`
and a `combinedTotal`, and scopes `removeFromCart` / `updateQuantity` by both item and
passenger. The sheet groups the lines by traveller, sends one `passengerOrders` entry
per passenger in a single POST, and keeps each `orderId` on the board until dismissed.
A failure leaves the cart intact and prints the API message in the sheet; a success
closes the sheet and empties the cart.

The confirmed e-ticket in `frontend/src/components/TicketSummary.tsx` carries the latest
order as a dining coupon directly below the Aztec pass. The coupon shows the catering
reference, delivery seat, service milestone and a four-step transit stepper (`Order
Logged → Galley Prep → In Transit → Delivered to Seat`) driven by the stored
`deliveryStatus`. It reads `cateringOrders` back from `GET /api/bookings` for the PNR, so
the coupon appears after ordering on the Dining tab and survives a switch back to the
planner; it prints as part of the single-page ticket.

## Data model

| Collection | Key fields | Notes |
| --- | --- | --- |
| `users` | `email` (unique), `name`, `phone`, `passwordHash`, `railcard`, `seatPreference` | `railcard.discountPercent` drives fare pricing |
| `sessions` | `sid` (unique), `userId`, `expiresAt` | TTL index removes expired rows |
| `bookings` | `userId`, `pnr` (unique), route, `date`, `time`, fare, `unitPrice`, `price`, `passengers[]`, `cateringOrders[]`, `status`, `cancelledAt` | `price = unitPrice × passengers.length`; each catering order stores `passengerId`, `passengerName`, `subtotal`, `concession` and a `totalAmount` net of it; `cateringOrders.orderId` is uniquely indexed; TTL index purges cancelled passes 3 hours after `cancelledAt` |
| `stations` | `name`, `code` (unique), `region` | Auto-bootstrapped from `STATION_SEED` |

## Useful scripts

| Location | Command | Description |
| --- | --- | --- |
| `backend` | `npm run dev` | API with watch mode |
| `backend` | `npm run seed` | Reset stations, demo passenger and sample passes |
| `backend` | `npm run build` / `npm start` | Compile to `dist/` and run |
| `frontend` | `npm run dev` | Vite dev server with `/api` proxy |
| `frontend` | `npm run build` | Type-check and build to `dist/` |
