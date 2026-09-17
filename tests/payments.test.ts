import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  billText,
  createBill,
  decimalAmount,
  MAX_TOTAL_PAISE,
  parseMoney,
  paymentUri,
  splitAmount,
  validUpiId,
} from '../src/lib/payments.ts'
import { isBill } from '../src/lib/storage.ts'

test('parses money exactly to paise and rejects ambiguous or unsupported input', () => {
  for (const [input, expected] of [
    ['0.01', 1],
    ['1999', 199900],
    ['5500.55', 550055],
    [' 10.1 ', 1010],
    ['1000000', MAX_TOTAL_PAISE],
  ] as const) {
    assert.equal(parseMoney(input), expected)
  }
  for (const input of [
    '',
    '0',
    '-1',
    '.05',
    '1.001',
    'NaN',
    'Infinity',
    '1e3',
    '1,999',
    '₹100',
    '1000000.01',
    '9007199254740991',
  ]) {
    assert.equal(parseMoney(input), null, input)
  }
  assert.equal(decimalAmount(1), '0.01')
  assert.equal(decimalAmount(123456), '1234.56')
})

test('handles cap boundaries, a final paisa, exact multiples, and small bills', () => {
  assert.deepEqual(splitAmount(550000, 199900), [199900, 199900, 150200])
  assert.deepEqual(splitAmount(399800, 199900), [199900, 199900])
  assert.deepEqual(splitAmount(399801, 199900), [199900, 199900, 1])
  assert.deepEqual(splitAmount(199900, 199900), [199900])
  assert.deepEqual(splitAmount(1, 199900), [1])
  assert.deepEqual(splitAmount(550000, 199900, 'even'), [183334, 183333, 183333])
  assert.deepEqual(splitAmount(3, 2, 'even'), [2, 1])
})

test('both split modes preserve the total and cap across 4,000 generated cases', () => {
  let seed = 91211
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  for (let index = 0; index < 2000; index++) {
    const total = Math.floor(random() * MAX_TOTAL_PAISE) + 1
    const cap = Math.ceil(total / 100) + Math.floor(random() * 200000)
    for (const mode of ['cap', 'even'] as const) {
      const parts = splitAmount(total, cap, mode)
      assert.equal(
        parts.reduce((sum, part) => sum + part, 0),
        total,
      )
      assert.equal(parts.length, Math.ceil(total / cap))
      assert.ok(parts.every((part) => Number.isSafeInteger(part) && part > 0 && part <= cap))
      if (mode === 'even') assert.ok(Math.max(...parts) - Math.min(...parts) <= 1)
    }
  }
})

test('rejects excessive counts and invalid values without generating parts', () => {
  for (const [total, cap] of [
    [0, 100],
    [100, 0],
    [-1, 100],
    [1.5, 100],
    [100, NaN],
    [MAX_TOTAL_PAISE + 1, 100],
  ]) {
    assert.throws(() => splitAmount(total, cap))
  }
  assert.equal(splitAmount(100, 1).length, 100)
  assert.throws(() => splitAmount(101, 1), /100 or fewer/)
})

test('UPI links encode recipient and note, include precise amounts and unique references', () => {
  const bill = createBill(
    { name: 'Chai & Snacks + More', upiId: 'qa-store@examplebank' },
    550055,
    199900,
    'cap',
    'Table 4 & 5 # lunch',
  )
  assert.ok(validUpiId(bill.merchant.upiId))
  const refs = new Set()
  for (const part of bill.parts) {
    const url = new URL(paymentUri(bill, part))
    assert.equal(url.protocol, 'upi:')
    assert.equal(url.hostname, 'pay')
    assert.equal(url.searchParams.get('pa'), bill.merchant.upiId)
    assert.equal(url.searchParams.get('pn'), bill.merchant.name)
    assert.equal(url.searchParams.get('am'), decimalAmount(part.amount))
    assert.equal(url.searchParams.get('cu'), 'INR')
    assert.ok(url.searchParams.get('tn')!.includes('Table 4 & 5 # lunch'))
    refs.add(url.searchParams.get('tr'))
  }
  assert.equal(refs.size, bill.parts.length)
  assert.match(billText(bill), /Approve each payment separately/)
  assert.match(billText(bill), /1502.55/)
  assert.ok(isBill(JSON.parse(JSON.stringify(bill))))
  assert.equal(isBill({ ...bill, total: 100 }), false)
  assert.equal(isBill({ ...bill, parts: [null] }), false)
  assert.equal(isBill({ ...bill, merchant: { name: 'Bad', upiId: 'javascript:alert(1)' } }), false)
  assert.equal(
    isBill({ ...bill, parts: bill.parts.map((part) => ({ ...part, receivedAt: 'bad-date' })) }),
    false,
  )
})

test('requires a usable merchant format and trims input', () => {
  for (const upiId of [
    'bad',
    'store@',
    '@bank',
    'store@bank?am=100',
    'store @bank',
    'x'.repeat(100) + '@bank',
  ])
    assert.equal(validUpiId(upiId), false)
  assert.throws(() => createBill({ name: '', upiId: 'shop@bank' }, 100, 50, 'cap', ''))
  assert.throws(() => createBill({ name: 'Shop', upiId: 'invalid' }, 100, 50, 'cap', ''))
  const bill = createBill(
    { name: '  Test Store  ', upiId: '  shop@examplebank  ' },
    100,
    50,
    'cap',
    '  Test  ',
  )
  assert.equal(bill.merchant.name, 'Test Store')
  assert.equal(bill.merchant.upiId, 'shop@examplebank')
  assert.equal(bill.note, 'Test')
  assert.equal(bill.parts[0].receivedAt, undefined)
})
