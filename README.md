# Lendingplate Payment Portal

A responsive UPI payment-request demo with a Node/Express API, MongoDB/Mongoose models, QR generation, admin screen, and verified-webhook status flow. Branding and the separate sample destination are illustrative.

## Requirements and startup

Use Node.js 18+ and MongoDB 6+ (local MongoDB or an Atlas connection string).

```sh
cp .env.example .env
npm install
npm run seed
npm start
```

Open `http://localhost:3000`. Set `MONGODB_URI`, `JWT_SECRET`, and a non-default `ADMIN_PASSWORD` in `.env` first. `npm run dev` starts the server with nodemon. `npm test` runs the basic validation and state-flow tests.

## MongoDB

Start a local MongoDB service, then keep `MONGODB_URI=mongodb://127.0.0.1:27017/clearpay_portal`, or paste an Atlas connection string into the private `.env`. The seed script adds one inactive local test destination. Add and authorize a destination in the admin dashboard before accepting payments.

## Payment provider setup

The app creates pending requests and UPI intent links/QR codes. It does not claim that opening an app or scanning a QR completed payment. To enable automatic confirmation, connect an authorized provider that supports merchant collection and server notifications. Configure its webhook secret in `WEBHOOK_SECRET`; adapt `/api/webhooks/payment` signature verification to the provider's documented raw-body signing scheme and map its authenticated event IDs, transaction references, provider IDs, and terminal states. The current demo verifies an HMAC-SHA256 over the parsed JSON serialization and is only suitable for a matching test integration. Without a provider, requests remain pending. Manually typing a UTR cannot authenticate a payment, so the admin UI does not offer manual success marking.

If an earlier version already marked payments successful through manual UTR entry, deploy the updated code and run `npm run cleanup:unverified` once against the same MongoDB database. It returns those records to pending, retains their history, and rebuilds destination counts using provider-verified successes only.

Never collect a UPI PIN, OTP, or banking password. Do not activate a destination unless you control it and have authority to accept payments there. Admin credentials are environment based; use a strong password, random JWT secret, HTTPS, and a separate admin access policy before deployment. Customer status lookup exposes only a transaction reference's non-sensitive payment details; mobile numbers are admin-only.

## Rotation behavior

Only a valid signed `successful` webhook that transitions a payment from pending increments the successful count. Event IDs are stored to deduplicate repeats. On reaching the configured threshold (3 or 4), the current destination changes to the next active and authorized destination for subsequent requests. Existing payments retain their original destination. A single MongoDB deployment is sufficient for the compare-and-swap settings updates; for production-grade provider processing, run webhook handling on a replica set with transactional outbox/retry monitoring and configure provider-specific idempotency.

Admin: open `/admin.html`, sign in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Additions default to test destinations and require explicit authorization and activation in the dashboard. Payment history is not shown in the admin dashboard.

## API summary

- `POST /api/payments` body `{ "mobileNumber": "9876543210", "amount": 250 }`
- `GET /api/payments/:reference`
- `POST /api/webhooks/payment` signed provider event
- `POST /api/admin/login`
- `GET /api/admin/destinations`
- `POST /api/admin/destinations`, `PATCH /api/admin/destinations/:id`, `DELETE /api/admin/destinations/:id`
- `PATCH /api/admin/settings/rotation` body `{ "rotationThreshold": 4 }`

The frontend and API are served by the same Express process at `http://localhost:3000`; there is no separate frontend server to run.
# payment
# payment
