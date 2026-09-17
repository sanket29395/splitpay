import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { preview } from 'vite'

// Capture the real production app using a fresh, disposable browser profile.
// All merchant details are fictional. No UPI link is ever opened.
const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'docs', 'images')
await mkdir(output, { recursive: true })

const server = await preview({
  root,
  preview: { host: '127.0.0.1', port: 4174, strictPort: true, open: false },
})
let browser

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:4174')
  await page.evaluate(() => document.fonts.ready)
  await page.getByLabel('Total bill amount').fill('5500')
  await page.getByLabel('Merchant name').fill('The Daily Brew · Demo')
  await page.getByLabel('Merchant UPI ID').fill('demo-store@examplebank')
  await page.getByLabel('Bill reference').fill('Table 08 · Example bill')
  await page.screenshot({
    path: path.join(output, 'create-bill.png'),
    fullPage: true,
    animations: 'disabled',
  })

  await page.getByRole('button', { name: 'Generate payment QRs' }).click()
  await expect(page.getByRole('button', { name: 'Print QRs' })).toBeEnabled()
  await expect(page.locator('.payment-card')).toHaveCount(3)
  await expect(page.locator('.payment-card h3')).toHaveText(['₹1,999', '₹1,999', '₹1,502'])
  await page.getByRole('button', { name: 'Dismiss notification' }).click()
  await page.screenshot({
    path: path.join(output, 'payment-qrs.png'),
    fullPage: true,
    animations: 'disabled',
  })

  await page.getByRole('button', { name: 'Mark received', exact: true }).first().click()
  await page.getByLabel('Bank reference / UTR').fill('DEMO-REFERENCE-001')
  await page.getByRole('button', { name: 'I checked — record received' }).click()
  await page.getByRole('button', { name: 'Dismiss notification' }).click()
  await page.getByRole('button', { name: /Bill history/ }).click()
  await expect(page.locator('.history-row')).toHaveCount(1)
  await page.screenshot({
    path: path.join(output, 'bill-history.png'),
    fullPage: true,
    animations: 'disabled',
  })

  await page.locator('.history-row').click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Print QRs' })).toBeEnabled()
  await page.screenshot({
    path: path.join(output, 'mobile-payments.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Enlarge QR for payment 2', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Payment 2 of 3' })).toBeVisible()
  await page.screenshot({ path: path.join(output, 'mobile-qr.png'), animations: 'disabled' })

  expect(errors).toEqual([])
  console.log('Saved 5 UI screenshots to docs/images using fictional merchant details.')
} finally {
  await browser?.close()
  await server.close()
}
