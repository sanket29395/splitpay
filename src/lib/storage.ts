import { MAX_PARTS, MAX_TOTAL_PAISE, validUpiId } from './payments.ts'
import type { Bill, Merchant } from './payments'

const BILLS_KEY = 'splitpay.bills.v1'
const MERCHANT_KEY = 'splitpay.merchant.v1'
const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_TOTAL_PAISE
const isDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))

function isMerchant(value: unknown): value is Merchant {
  if (!value || typeof value !== 'object') return false
  const merchant = value as Merchant
  return (
    typeof merchant.name === 'string' &&
    merchant.name.length >= 2 &&
    merchant.name.length <= 80 &&
    typeof merchant.upiId === 'string' &&
    validUpiId(merchant.upiId)
  )
}

export function isBill(value: unknown): value is Bill {
  if (!value || typeof value !== 'object') return false
  const bill = value as Bill
  return (
    typeof bill.id === 'string' &&
    /^SP[A-F0-9]{16}$/.test(bill.id) &&
    isDate(bill.createdAt) &&
    isMerchant(bill.merchant) &&
    typeof bill.note === 'string' &&
    bill.note.length <= 80 &&
    isAmount(bill.total) &&
    isAmount(bill.cap) &&
    ['cap', 'even'].includes(bill.mode) &&
    Array.isArray(bill.parts) &&
    bill.parts.length > 0 &&
    bill.parts.length <= MAX_PARTS &&
    bill.parts.every(
      (part, index) =>
        part &&
        part.id === `${bill.id}P${index + 1}` &&
        isAmount(part.amount) &&
        part.amount <= bill.cap &&
        (part.receivedAt === undefined || isDate(part.receivedAt)) &&
        (part.reference === undefined ||
          (typeof part.reference === 'string' && part.reference.length <= 60)),
    ) &&
    bill.parts.reduce((sum, part) => sum + part.amount, 0) === bill.total
  )
}

export function readBills(): Bill[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(BILLS_KEY) || '[]')
    return Array.isArray(stored) ? stored.filter(isBill).slice(0, 100) : []
  } catch {
    return []
  }
}

export function readMerchant(): Merchant | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(MERCHANT_KEY) || 'null')
    return isMerchant(stored) ? stored : null
  } catch {
    return null
  }
}

export function saveBills(bills: Bill[]): boolean {
  try {
    localStorage.setItem(BILLS_KEY, JSON.stringify(bills.slice(0, 100)))
    return true
  } catch {
    return false
  }
}

export function saveMerchant(merchant: Merchant | null): boolean {
  try {
    if (merchant) localStorage.setItem(MERCHANT_KEY, JSON.stringify(merchant))
    else localStorage.removeItem(MERCHANT_KEY)
    return true
  } catch {
    return false
  }
}
