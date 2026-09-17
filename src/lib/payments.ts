export const MAX_TOTAL_PAISE = 100_000_000
export const MAX_PARTS = 100
export type SplitMode = 'cap' | 'even'
export type Merchant = { name: string; upiId: string }
export type PaymentPart = { id: string; amount: number; receivedAt?: string; reference?: string }
export type Bill = {
  id: string
  createdAt: string
  merchant: Merchant
  note: string
  total: number
  cap: number
  mode: SplitMode
  parts: PaymentPart[]
}

/** All calculations use integer paise; decimal input never uses floating point arithmetic. */
export function parseMoney(input: string): number | null {
  const value = input.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null
  const [rupees, paise = ''] = value.split('.')
  const amount = Number(rupees) * 100 + Number(paise.padEnd(2, '0'))
  return Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_TOTAL_PAISE ? amount : null
}

export function decimalAmount(paise: number): string {
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`
}

export function formatMoney(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100)
}

export function validUpiId(value: string): boolean {
  return value.length <= 100 && /^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9][a-zA-Z0-9.-]{1,}$/.test(value)
}

export function splitAmount(total: number, cap: number, mode: SplitMode = 'cap'): number[] {
  if (![total, cap].every((n) => Number.isSafeInteger(n) && n > 0 && n <= MAX_TOTAL_PAISE)) {
    throw new Error('Enter a valid total and payment cap.')
  }
  const count = Math.ceil(total / cap)
  if (count > MAX_PARTS)
    throw new Error(
      `This bill needs ${count} payments. Increase the cap to make ${MAX_PARTS} or fewer.`,
    )
  if (mode === 'even') {
    const base = Math.floor(total / count)
    const remainder = total % count
    return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
  }
  return Array.from({ length: count }, (_, index) => Math.min(cap, total - index * cap))
}

export function createBill(
  merchant: Merchant,
  total: number,
  cap: number,
  mode: SplitMode,
  note: string,
): Bill {
  const normalized = { name: merchant.name.trim(), upiId: merchant.upiId.trim() }
  if (normalized.name.length < 2 || normalized.name.length > 80)
    throw new Error('Enter a merchant name between 2 and 80 characters.')
  if (!validUpiId(normalized.upiId))
    throw new Error('Enter a valid UPI ID, such as yourstore@okaxis.')
  if (note.trim().length > 80) throw new Error('Keep the bill note under 81 characters.')
  const amounts = splitAmount(total, cap, mode)
  const id = `SP${Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  )
    .join('')
    .toUpperCase()}`
  return {
    id,
    createdAt: new Date().toISOString(),
    merchant: normalized,
    total,
    cap,
    mode,
    note: note.trim(),
    parts: amounts.map((amount, index) => ({ id: `${id}P${index + 1}`, amount })),
  }
}

export function paymentUri(bill: Bill, part: PaymentPart): string {
  const index = bill.parts.findIndex((item) => item.id === part.id)
  const params: Record<string, string> = {
    pa: bill.merchant.upiId,
    pn: bill.merchant.name,
    am: decimalAmount(part.amount),
    cu: 'INR',
    tr: part.id,
    tn: `${bill.note.slice(0, 38) || 'Bill'} - ${index + 1}/${bill.parts.length}`,
  }
  return `upi://pay?${Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')}`
}

export function billText(bill: Bill): string {
  return [
    `${bill.merchant.name} · ${bill.id}`,
    bill.note,
    `Bill total: ${formatMoney(bill.total)}`,
    `Pay to: ${bill.merchant.upiId}`,
    'Approve each payment separately in your UPI app.',
    '',
    ...bill.parts.flatMap((part, index) => [
      `Payment ${index + 1}/${bill.parts.length}: ${formatMoney(part.amount)}${part.receivedAt ? ' (recorded received by merchant)' : ''}`,
      paymentUri(bill, part),
      '',
    ]),
  ]
    .filter((line) => line !== undefined)
    .join('\n')
}
