import { test, expect } from '@playwright/test'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'

test('merchant creates, downloads, records, and reopens a bill with valid QR amounts', async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('One bill. Smaller payments.')
  await page.screenshot({ path: testInfo.outputPath('create-bill.png'), fullPage: true })

  await page.getByRole('button', { name: 'Generate payment QRs' }).click()
  await expect(page.getByText('Enter a valid UPI ID, such as yourstore@okaxis.')).toBeVisible()
  await page.getByLabel('Total bill amount').fill('5500.55')
  await page.getByLabel('Merchant name').fill('Test Counter & Café')
  await page.getByLabel('Merchant UPI ID').fill('qa-store@examplebank')
  await page.getByLabel('Bill reference').fill('Invoice QA 1042')
  await page.getByRole('button', { name: 'Generate payment QRs' }).click()

  await expect(page.getByRole('heading', { name: 'Your payment QRs' })).toBeVisible()
  await expect(page.locator('.payment-card')).toHaveCount(3)
  await expect(page.locator('.payment-card h3')).toHaveText(['₹1,999', '₹1,999', '₹1,502.55'])
  await expect(page.getByRole('button', { name: 'Print QRs' })).toBeEnabled()

  const codes = await page
    .locator('.payment-card img')
    .evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src))
  const references = new Set<string>()
  for (const [index, data] of codes.entries()) {
    const png = PNG.sync.read(Buffer.from(data.split(',')[1], 'base64'))
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
    expect(decoded).not.toBeNull()
    const url = new URL(decoded!.data)
    expect(url.protocol).toBe('upi:')
    expect(url.searchParams.get('pa')).toBe('qa-store@examplebank')
    expect(url.searchParams.get('pn')).toBe('Test Counter & Café')
    expect(url.searchParams.get('am')).toBe(['1999.00', '1999.00', '1502.55'][index])
    expect(url.searchParams.get('cu')).toBe('INR')
    references.add(url.searchParams.get('tr')!)
    await expect(page.locator('.payment-card').nth(index).getByRole('link')).toHaveAttribute(
      'href',
      decoded!.data,
    )
  }
  expect(references.size).toBe(3)
  await page.screenshot({ path: testInfo.outputPath('generated-payments.png'), fullPage: true })

  const qrDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download QR for payment 1', exact: true }).click()
  expect((await qrDownload).suggestedFilename()).toMatch(/INR-1999.00.png$/)
  const billDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download bill as text' }).click()
  expect((await billDownload).suggestedFilename()).toMatch(/^SP.+\.txt$/)

  await page.getByRole('button', { name: 'Enlarge QR for payment 1', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Next payment' }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toHaveText(
    'Payment 2 of 3',
  )
  await page.getByRole('button', { name: 'Close dialog' }).click()

  await page.getByRole('button', { name: 'Mark received', exact: true }).first().click()
  await page.getByLabel('Bank reference / UTR').fill('QA-REFERENCE-001')
  await page.getByRole('button', { name: 'I checked — record received' }).click()
  await expect(page.locator('.payment-card').first()).toContainText('Recorded received')
  await expect(page.locator('.collection-progress')).toContainText('₹3,501.55')

  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.print-sheet')).toBeVisible()
  await expect(page.locator('.print-payment')).toHaveCount(3)
  await expect(page.locator('.site-header')).toBeHidden()
  await page.screenshot({ path: testInfo.outputPath('print-layout.png'), fullPage: true })
  await page.emulateMedia({ media: 'screen' })

  await page.reload()
  await expect(page.getByLabel('Merchant UPI ID')).toHaveValue('qa-store@examplebank')
  await page.getByRole('button', { name: /Bill history/ }).click()
  await page.getByLabel('Search bills').fill('1042')
  await expect(page.locator('.history-row')).toHaveCount(1)
  await page.locator('.history-row').click()
  await expect(page.locator('.payment-card').first()).toContainText('QA-REFERENCE-001')
  await page
    .getByRole('button', { name: 'Undo received status for payment 1', exact: true })
    .click()
  await page.getByRole('button', { name: 'Mark awaiting payment' }).click()
  await expect(page.getByRole('button', { name: 'Mark received', exact: true })).toHaveCount(3)

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  expect(pageErrors).toEqual([])
})

test('even split, excessive counts, and the single-payment boundary', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Total bill amount').fill('5500')
  await page.getByLabel('Split evenly').check()
  await expect(page.locator('.receipt-list strong')).toHaveText([
    '₹1,833.34',
    '₹1,833.33',
    '₹1,833.33',
  ])
  await page.getByLabel('Maximum per payment').fill('0.01')
  await page.getByLabel('Merchant name').fill('Boundary Test')
  await page.getByLabel('Merchant UPI ID').fill('qa-store@examplebank')
  await page.getByRole('button', { name: 'Generate payment QRs' }).click()
  await expect(page.locator('#cap-error')).toContainText('100 or fewer')
  await page.getByLabel('Total bill amount').fill('0.01')
  await page.getByRole('button', { name: 'Generate payment QRs' }).click()
  await expect(page.locator('.payment-card')).toHaveCount(1)
  await expect(page.locator('.payment-card h3')).toHaveText('₹0.01')
})
