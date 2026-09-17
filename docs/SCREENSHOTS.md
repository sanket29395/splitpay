# UI screenshots

The images in `docs/images/` show the actual production app, captured with a new browser profile and fictional merchant details.

| Image                 | Screen                                               |
| --------------------- | ---------------------------------------------------- |
| `create-bill.png`     | Bill inputs and live split preview on desktop        |
| `payment-qrs.png`     | Generated QRs, payment links, and collection summary |
| `bill-history.png`    | A saved demo bill and manually recorded progress     |
| `mobile-payments.png` | Complete mobile bill summary and payment list        |
| `mobile-qr.png`       | Enlarged QR dialog on a mobile viewport              |

## Regenerate

With dependencies and Google Chrome installed:

```sh
npm run screenshots
```

The command builds the app, serves that build on `127.0.0.1:4174`, and captures the screens with headless Chrome. The temporary browser and server are closed afterwards. No running development server is required.

The script fills forms and generates QRs through the real interface. It checks the payment count and amounts, records a fictional receipt locally, and never opens a UPI link or initiates a payment. All screenshots use `demo-store@examplebank`; these images must not be used as payment instructions.

Use `scripts/capture-screenshots.mjs` to adjust screenshot dimensions or demo content. Keep screenshots free of real merchant details, bank references, and customer information. The README links to these committed PNGs rather than ignored test artifacts.
