# Contributing to SplitPay

Thanks for helping make small-business collections simpler. Open an issue in this repository for a reproducible bug or discuss a substantial change before implementing it.

## Development setup

Use Node.js 22.12+ and npm:

```sh
npm ci
npm run dev
```

No merchant credentials, Firebase configuration, or `.env` file is required for local development.

## Making a change

1. Create a branch for a focused change.
2. Keep money calculations in integer paise. Never use decimal floating-point arithmetic to split totals.
3. Keep payment confirmation explicit. A scan, opened link, app return, or unchecked callback must never mark a payment received.
4. Preserve mobile layouts, keyboard navigation, and printable QRs when changing UI.
5. Use fictional UPI IDs and references in tests, issue reports, and screenshots.
6. Update the README or deployment guide when behavior or setup changes.

## Checks

```sh
npm test
npm run build
```

For payment-flow or UI changes, install Google Chrome and also run:

```sh
npm run test:e2e
```

The browser tests verify desktop/mobile flows and decode QR images to validate the actual UPI payload. Do not make real payments as part of automated tests.

Use `npm run format` to apply the existing source formatting. For a visible UI change, regenerate the public screenshots with `npm run screenshots` and inspect them before including them in a pull request.

## Pull requests

Describe the problem, the changed behavior, and relevant checks. Include screenshots for visible changes. Keep generated `dist/`, dependency directories, Firebase credentials, local project aliases, and private bill exports out of commits.

## Payment integrations

The current project generates UPI payment intents and records receipts locally. A provider integration needs authenticated merchants, verified webhook signatures, idempotency, server-side amount checks, and settlement reconciliation. Discuss that architecture before adding automatic payment status.
