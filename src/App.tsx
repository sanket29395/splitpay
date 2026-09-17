import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  History,
  IndianRupee,
  Info,
  Layers2,
  LockKeyhole,
  Plus,
  QrCode,
  ReceiptText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
  Wallet,
  X,
} from 'lucide-react'
import { Collection, Modal } from './components'
import { createBill, formatMoney, parseMoney, splitAmount, validUpiId } from './lib/payments'
import type { Bill, Merchant, PaymentPart, SplitMode } from './lib/payments'
import { readBills, readMerchant, saveBills, saveMerchant } from './lib/storage'

type View = 'create' | 'history'
const sourceUrl = 'https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2310586&lang=1&reg=3'
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))

export default function App() {
  const [bills, setBills] = useState<Bill[]>(readBills)
  const [merchant, setMerchant] = useState<Merchant>(
    () => readMerchant() || { name: '', upiId: '' },
  )
  const [remember, setRemember] = useState(true)
  const [total, setTotal] = useState('')
  const [cap, setCap] = useState('1999')
  const [mode, setMode] = useState<SplitMode>('cap')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [view, setView] = useState<View>('create')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [help, setHelp] = useState(false)
  const [toast, setToast] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [recording, setRecording] = useState<{ part: PaymentPart; undo: boolean } | null>(null)
  const [reference, setReference] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const active = bills.find((bill) => bill.id === activeId)
  const actualTotal = parseMoney(total)
  const actualCap = parseMoney(cap)
  const preview = useMemo(() => {
    try {
      return splitAmount(actualTotal || 550_000, actualCap || 199_900, mode)
    } catch {
      return []
    }
  }, [actualTotal, actualCap, mode])
  const received =
    active?.parts.reduce((sum, part) => sum + (part.receivedAt ? part.amount : 0), 0) || 0
  const receivedCount = active?.parts.filter((part) => part.receivedAt).length || 0

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (activeId && view === 'create')
      document.getElementById('collection-title')?.focus({ preventScroll: true })
  }, [activeId, view])

  function persist(next: Bill[]) {
    setBills(next)
    setStorageError(!saveBills(next))
  }

  function newBill() {
    setActiveId(null)
    setView('create')
    setTotal('')
    setNote('')
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function generate(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!actualTotal) nextErrors.total = 'Enter ₹0.01 to ₹10,00,000, with up to 2 decimal places.'
    if (!actualCap)
      nextErrors.cap = 'Enter a positive cap up to ₹10,00,000, with up to 2 decimal places.'
    if (merchant.name.trim().length < 2)
      nextErrors.name = 'Enter your shop or business name (at least 2 characters).'
    if (!validUpiId(merchant.upiId.trim()))
      nextErrors.upi = 'Enter a valid UPI ID, such as yourstore@okaxis.'
    if (actualTotal && actualCap) {
      try {
        splitAmount(actualTotal, actualCap, mode)
      } catch (error) {
        nextErrors.cap = (error as Error).message
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      const fields: Record<string, string> = {
        total: 'bill-total',
        cap: 'payment-cap',
        name: 'merchant-name',
        upi: 'upi-id',
      }
      document.getElementById(fields[Object.keys(nextErrors)[0]])?.focus()
      return
    }
    try {
      const bill = createBill(merchant, actualTotal!, actualCap!, mode, note)
      persist([bill, ...bills].slice(0, 100))
      if (!saveMerchant(remember ? bill.merchant : null)) setStorageError(true)
      setActiveId(bill.id)
      setToast(
        bills.length >= 100
          ? 'Bill created. History keeps your latest 100 bills.'
          : `${bill.parts.length} payment${bill.parts.length === 1 ? '' : 's'} ready to collect`,
      )
    } catch (error) {
      setErrors({ form: (error as Error).message })
    }
  }

  function record(event: FormEvent) {
    event.preventDefault()
    if (!active || !recording) return
    persist(
      bills.map((bill) =>
        bill.id !== active.id
          ? bill
          : {
              ...bill,
              parts: bill.parts.map((part) =>
                part.id !== recording.part.id
                  ? part
                  : recording.undo
                    ? { id: part.id, amount: part.amount }
                    : {
                        ...part,
                        receivedAt: new Date().toISOString(),
                        reference: reference.trim() || undefined,
                      },
              ),
            },
      ),
    )
    setToast(
      recording.undo
        ? 'Payment marked as awaiting payment'
        : `${formatMoney(recording.part.amount)} recorded as received`,
    )
    setRecording(null)
    setReference('')
  }

  function openBill(bill: Bill) {
    setActiveId(bill.id)
    setView('create')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const filteredBills = bills.filter((bill) => {
    const complete = bill.parts.every((part) => part.receivedAt)
    return (
      (filter === 'all' || (filter === 'complete' ? complete : !complete)) &&
      `${bill.id} ${bill.note} ${bill.merchant.name} ${bill.merchant.upiId}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
  })

  return (
    <>
      <div className="app-shell">
        <header className="site-header">
          <div className="header-inner">
            <button className="brand" onClick={() => setView('create')} aria-label="SplitPay home">
              <span className="brand-mark">
                <Layers2 size={24} strokeWidth={2.2} />
              </span>
              <span>
                split<span className="brand-accent">pay</span>
                <span className="brand-dot">.</span>
              </span>
            </button>
            <nav aria-label="Main navigation">
              <button
                className={view === 'create' ? 'nav-item active' : 'nav-item'}
                onClick={() => (activeId ? newBill() : setView('create'))}
              >
                <Plus size={16} /> Create bill
              </button>
              <button
                className={view === 'history' ? 'nav-item active' : 'nav-item'}
                onClick={() => setView('history')}
              >
                <History size={16} /> Bill history{' '}
                {bills.length > 0 && <span className="nav-count">{bills.length}</span>}
              </button>
            </nav>
            <button className="help-button" onClick={() => setHelp(true)}>
              <CircleHelp size={17} />
              <span>How it works</span>
            </button>
          </div>
        </header>

        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow page-eyebrow">
                <span /> YOUR EVERYDAY PAYMENT COMPANION
              </div>
              <h1>
                {view === 'history' ? (
                  <>
                    Your bills, <span>all together.</span>
                  </>
                ) : active ? (
                  <>
                    Ready, set, <span>collect.</span>
                  </>
                ) : (
                  <>
                    One bill. <span>Smaller payments.</span>
                  </>
                )}
              </h1>
              <p>
                {view === 'history'
                  ? 'Pick up where you left off and keep every payment in view.'
                  : active
                    ? 'A separate QR for every part. A little simpler for everyone.'
                    : 'Split a bill into capped UPI payments. Simple for you. Easy for your customers.'}
              </p>
            </div>
            <div className="local-badge">
              <span className="local-icon">
                <LockKeyhole size={17} />
              </span>
              <div>
                Yours, on this device<small>No sign-up needed</small>
              </div>
            </div>
          </div>

          {storageError && (
            <div className="storage-warning" role="alert">
              <Info size={18} /> This browser couldn’t save your changes. Keep this tab open and
              download your bill before leaving.
            </div>
          )}

          {view === 'create' && (
            <>
              <div className="steps">
                <div className={active ? 'step done' : 'step current'}>
                  <span>{active ? <Check size={13} /> : '1'}</span>Enter bill details
                </div>
                <ChevronRight size={15} />
                <div className={active ? 'step done' : 'step'}>
                  <span>{active ? <Check size={13} /> : '2'}</span>Generate payment QRs
                </div>
                <ChevronRight size={15} />
                <div className={active ? 'step current' : 'step'}>
                  <span>3</span>Collect payments
                </div>
              </div>
              <div className="workspace">
                <div className="form-column">
                  {!active ? (
                    <section className="panel bill-form-panel">
                      <div className="panel-heading">
                        <div className="heading-with-icon">
                          <span className="section-icon">
                            <ReceiptText size={19} />
                          </span>
                          <h2>Bill details</h2>
                        </div>
                        <span className="subtle-badge">NEW BILL</span>
                      </div>
                      <form onSubmit={generate} noValidate>
                        <div className="field">
                          <label htmlFor="bill-total">
                            Total bill amount <span>*</span>
                          </label>
                          <div
                            className={`money-input total-input ${errors.total ? 'invalid' : ''}`}
                          >
                            <span>₹</span>
                            <input
                              id="bill-total"
                              inputMode="decimal"
                              placeholder="5,500"
                              autoComplete="off"
                              value={total}
                              onChange={(event) => setTotal(event.target.value)}
                              aria-invalid={!!errors.total}
                              aria-describedby={errors.total ? 'total-error' : undefined}
                            />
                            <span className="currency">INR</span>
                          </div>
                          {errors.total && (
                            <p className="field-error" id="total-error">
                              {errors.total}
                            </p>
                          )}
                        </div>
                        <div className="field">
                          <div className="label-row">
                            <label htmlFor="payment-cap">
                              Maximum per payment <span>*</span>
                            </label>
                            <SlidersHorizontal size={14} />
                          </div>
                          <div className={`money-input ${errors.cap ? 'invalid' : ''}`}>
                            <span>₹</span>
                            <input
                              id="payment-cap"
                              inputMode="decimal"
                              value={cap}
                              onChange={(event) => setCap(event.target.value)}
                              aria-invalid={!!errors.cap}
                              aria-describedby={errors.cap ? 'cap-error' : 'cap-hint'}
                            />
                          </div>
                          <div className="presets">
                            {['500', '1000', '1999'].map((value) => (
                              <button
                                type="button"
                                key={value}
                                aria-pressed={cap === value}
                                className={cap === value ? 'selected' : ''}
                                onClick={() => setCap(value)}
                              >
                                {formatMoney(Number(value) * 100)}
                                {value === '1999' && <Sparkles size={12} />}
                              </button>
                            ))}
                            <span>or enter your own</span>
                          </div>
                          <p className="field-hint" id="cap-hint">
                            Every payment will be at or below this amount.
                          </p>
                          {errors.cap && (
                            <p className="field-error" id="cap-error">
                              {errors.cap}
                            </p>
                          )}
                        </div>
                        <fieldset className="split-mode">
                          <legend>How would you like to split?</legend>
                          <div>
                            <label className={mode === 'cap' ? 'selected' : ''}>
                              <input
                                type="radio"
                                name="split-mode"
                                value="cap"
                                checked={mode === 'cap'}
                                onChange={() => setMode('cap')}
                              />
                              <Layers2 size={15} /> Fill to cap
                            </label>
                            <label className={mode === 'even' ? 'selected' : ''}>
                              <input
                                type="radio"
                                name="split-mode"
                                value="even"
                                checked={mode === 'even'}
                                onChange={() => setMode('even')}
                              />
                              <SlidersHorizontal size={15} /> Split evenly
                            </label>
                          </div>
                        </fieldset>
                        <div className="form-divider">
                          <span>PAYMENT DESTINATION</span>
                          <Store size={14} />
                        </div>
                        <div className="field">
                          <label htmlFor="merchant-name">
                            Merchant name <span>*</span>
                          </label>
                          <input
                            className={errors.name ? 'invalid' : ''}
                            id="merchant-name"
                            placeholder="Your shop or business name"
                            maxLength={80}
                            autoComplete="organization"
                            value={merchant.name}
                            onChange={(event) =>
                              setMerchant({ ...merchant, name: event.target.value })
                            }
                            aria-invalid={!!errors.name}
                            aria-describedby={errors.name ? 'name-error' : undefined}
                          />
                          {errors.name && (
                            <p className="field-error" id="name-error">
                              {errors.name}
                            </p>
                          )}
                        </div>
                        <div className="field">
                          <label htmlFor="upi-id">
                            Merchant UPI ID <span>*</span>
                          </label>
                          <div className={`upi-input ${errors.upi ? 'invalid' : ''}`}>
                            <span>@</span>
                            <input
                              id="upi-id"
                              placeholder="yourstore@okaxis"
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              maxLength={100}
                              value={merchant.upiId}
                              onChange={(event) =>
                                setMerchant({ ...merchant, upiId: event.target.value })
                              }
                              aria-invalid={!!errors.upi}
                              aria-describedby={errors.upi ? 'upi-error' : 'upi-hint'}
                            />
                          </div>
                          <p className="field-hint" id="upi-hint">
                            Payments go directly to this UPI ID. Double-check it.
                          </p>
                          {errors.upi && (
                            <p className="field-error" id="upi-error">
                              {errors.upi}
                            </p>
                          )}
                        </div>
                        <div className="field">
                          <label htmlFor="bill-note">
                            Bill reference <span className="optional">Optional</span>
                          </label>
                          <input
                            id="bill-note"
                            placeholder="e.g. Invoice 1042 or Table 08"
                            maxLength={80}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                          />
                        </div>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={remember}
                            onChange={(event) => {
                              setRemember(event.target.checked)
                              if (!event.target.checked && !saveMerchant(null))
                                setStorageError(true)
                            }}
                          />{' '}
                          Remember merchant details on this device
                        </label>
                        {errors.form && (
                          <p className="field-error" role="alert">
                            {errors.form}
                          </p>
                        )}
                        <button className="button primary generate-button" type="submit">
                          <QrCode size={19} /> Generate payment QRs <ArrowRight size={18} />
                        </button>
                        <p className="form-footer">
                          <ShieldCheck size={14} /> Your money goes straight to your account
                        </p>
                      </form>
                    </section>
                  ) : (
                    <section className="panel bill-summary">
                      <div className="panel-heading">
                        <div className="heading-with-icon">
                          <span className="section-icon">
                            <ReceiptText size={19} />
                          </span>
                          <h2>Bill summary</h2>
                        </div>
                        <span className="subtle-badge">{active.parts.length} PARTS</span>
                      </div>
                      <span className="muted">Total bill amount</span>
                      <div className="summary-total">{formatMoney(active.total)}</div>
                      {active.note && <p className="summary-note">{active.note}</p>}
                      <div className="merchant-summary">
                        <span className="merchant-avatar">
                          <Store size={22} />
                        </span>
                        <div>
                          <strong>{active.merchant.name}</strong>
                          <span>{active.merchant.upiId}</span>
                        </div>
                      </div>
                      <dl className="summary-details">
                        <div>
                          <dt>Maximum per payment</dt>
                          <dd>{formatMoney(active.cap)}</dd>
                        </div>
                        <div>
                          <dt>Split method</dt>
                          <dd>{active.mode === 'cap' ? 'Fill to cap' : 'Split evenly'}</dd>
                        </div>
                        <div>
                          <dt>Created</dt>
                          <dd>{dateLabel(active.createdAt)}</dd>
                        </div>
                      </dl>
                      <div className="collection-progress">
                        <div>
                          <strong>Collection progress</strong>
                          <span>
                            {receivedCount} / {active.parts.length}
                          </span>
                        </div>
                        <progress
                          aria-label="Payments recorded received"
                          value={receivedCount}
                          max={active.parts.length}
                        />
                        <dl>
                          <div>
                            <dt>Recorded received</dt>
                            <dd>{formatMoney(received)}</dd>
                          </div>
                          <div>
                            <dt>Remaining</dt>
                            <dd>{formatMoney(active.total - received)}</dd>
                          </div>
                        </dl>
                      </div>
                      <p className="manual-note">
                        <Info size={16} /> Status is recorded by you after checking your bank app.
                        It isn’t bank verification.
                      </p>
                      <button className="button primary" onClick={newBill}>
                        <Plus size={17} /> Create another bill
                      </button>
                    </section>
                  )}
                  <div className="privacy-note">
                    <LockKeyhole size={16} />
                    <p>
                      Bills stay in this browser.
                      <br />
                      <span>We don’t ask for your UPI PIN or bank login.</span>
                    </p>
                  </div>
                </div>
                {!active ? (
                  <section className="preview-column">
                    <div className="panel preview-panel">
                      <div className="panel-heading">
                        <div className="heading-with-icon">
                          <span className="section-icon neutral">
                            <QrCode size={19} />
                          </span>
                          <h2>Payment preview</h2>
                        </div>
                        <span className="preview-badge">
                          <span />
                          {actualTotal && actualCap ? 'Live preview' : 'Example preview'}
                        </span>
                      </div>
                      <div className="preview-stage">
                        <div className="stage-orbit orbit-one" />
                        <div className="stage-orbit orbit-two" />
                        <div className="receipt-preview">
                          <div className="receipt-logo">
                            <Layers2 size={22} />
                          </div>
                          <p>ONE BILL, MADE MANAGEABLE</p>
                          <h3>{formatMoney(actualTotal || 550_000)}</h3>
                          <div className="receipt-divider" />
                          <div className="receipt-list">
                            {preview.slice(0, 4).map((amount, index) => (
                              <div key={index}>
                                <span>
                                  <span className="receipt-part">
                                    {String(index + 1).padStart(2, '0')}
                                  </span>
                                  Payment {index + 1}
                                </span>
                                <strong>{formatMoney(amount)}</strong>
                              </div>
                            ))}
                            {preview.length > 4 && (
                              <p className="extra-parts">+ {preview.length - 4} more payments</p>
                            )}
                            {preview.length === 0 && (
                              <p className="extra-parts">
                                Increase the cap to create 100 or fewer payments.
                              </p>
                            )}
                          </div>
                          <div className="receipt-bottom">
                            <Check size={14} />
                            {mode === 'cap'
                              ? 'Every part within your cap'
                              : 'Evenly split, within your cap'}
                          </div>
                        </div>
                        <span className="floating-note">
                          <Sparkles size={15} /> Small payments. Same total.
                        </span>
                      </div>
                      <div className="preview-summary">
                        <div>
                          <span className="preview-summary-icon">
                            <Layers2 size={19} />
                          </span>
                          <div>
                            <strong>
                              {preview.length || '—'} separate payment
                              {preview.length !== 1 ? 's' : ''}
                            </strong>
                            <span>Up to {formatMoney(actualCap || 199_900)} each</span>
                          </div>
                        </div>
                        <span className="exact-badge">
                          <CheckCheck size={14} /> Exact total
                        </span>
                      </div>
                      <div className="preview-placeholder">
                        <QrCode size={21} />
                        <div>
                          <strong>Your QR codes will appear here</strong>
                          <p>Enter your bill and merchant details, then hit generate.</p>
                        </div>
                      </div>
                    </div>
                    <div className="benefits">
                      <div>
                        <span>
                          <IndianRupee size={19} />
                        </span>
                        <h3>Every paisa accounted for</h3>
                        <p>
                          Each part adds up to your total.
                          <br />
                          No rounding surprises.
                        </p>
                      </div>
                      <div>
                        <span>
                          <CreditCard size={19} />
                        </span>
                        <h3>Familiar way to pay</h3>
                        <p>
                          Customers scan and pay with
                          <br />
                          their preferred UPI app.
                        </p>
                      </div>
                    </div>
                    <div className="upi-strip">
                      <span className="upi-wordmark">
                        UPI<span>●</span>
                      </span>
                      <span>Built for the way India pays</span>
                      <div className="app-names">
                        BHIM <i /> Google Pay <i /> PhonePe <i /> Paytm
                      </div>
                    </div>
                  </section>
                ) : (
                  <Collection
                    key={active.id}
                    bill={active}
                    onRecord={(part) => {
                      setReference('')
                      setRecording({ part, undo: false })
                    }}
                    onUndo={(part) => setRecording({ part, undo: true })}
                    notify={setToast}
                  />
                )}
              </div>
            </>
          )}

          {view === 'history' && (
            <section className="history-panel panel">
              <div className="history-toolbar">
                <div className="history-filters" aria-label="Filter bills">
                  {[
                    ['all', 'All bills'],
                    ['open', 'Open'],
                    ['complete', 'Recorded complete'],
                  ].map(([value, label]) => (
                    <button
                      className={filter === value ? 'selected' : ''}
                      key={value}
                      onClick={() => setFilter(value)}
                      aria-pressed={filter === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="search-input">
                  <Search size={16} />
                  <input
                    aria-label="Search bills"
                    placeholder="Search bills…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <button className="button primary small" onClick={newBill}>
                  <Plus size={16} /> New bill
                </button>
              </div>
              {filteredBills.length ? (
                <div className="history-list">
                  {filteredBills.map((bill) => {
                    const count = bill.parts.filter((part) => part.receivedAt).length
                    return (
                      <button className="history-row" key={bill.id} onClick={() => openBill(bill)}>
                        <span className="history-icon">
                          <ReceiptText size={21} />
                        </span>
                        <span className="history-bill-name">
                          <strong>{bill.note || bill.merchant.name}</strong>
                          <span>
                            {bill.merchant.name} · {dateLabel(bill.createdAt)}
                          </span>
                          <small>{bill.id}</small>
                        </span>
                        <span className={`status ${count === bill.parts.length ? 'green' : ''}`}>
                          {count} / {bill.parts.length} recorded
                        </span>
                        <strong className="history-amount">{formatMoney(bill.total)}</strong>
                        <ChevronRight size={17} />
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-history">
                  <span>
                    <History size={32} />
                  </span>
                  <h2>
                    {bills.length ? 'No matching bills' : 'A fresh start for your collections'}
                  </h2>
                  <p>
                    {bills.length
                      ? 'Try a different search or filter.'
                      : 'Your generated bills will be saved here, ready when you need them.'}
                  </p>
                  {!bills.length && (
                    <button className="button primary" onClick={newBill}>
                      Create your first bill <ArrowRight size={17} />
                    </button>
                  )}
                </div>
              )}
              <p className="history-note">
                <LockKeyhole size={14} /> Your latest 100 bills are stored only in this browser.
                Clearing browser data removes them. Download bills you need to keep.
              </p>
            </section>
          )}

          <footer className="site-footer">
            <span>
              <Layers2 size={15} /> Less math. More business.
            </span>
            <button onClick={() => setHelp(true)}>
              About payment limits <ArrowUpRight size={13} />
            </button>
            <span>Made for payments in ₹ INR</span>
          </footer>
        </main>
      </div>

      {help && (
        <Modal title="A simpler way to collect" onClose={() => setHelp(false)}>
          <div className="how-steps">
            <div>
              <span>1</span>
              <div>
                <h3>Set your bill and cap</h3>
                <p>
                  Enter the total, maximum amount per payment, and your merchant UPI ID. The default
                  ₹1,999 cap keeps each generated amount below ₹2,000.
                </p>
              </div>
            </div>
            <div>
              <span>2</span>
              <div>
                <h3>Share a QR for each part</h3>
                <p>
                  Customers scan each QR or open each payment link on a phone with a compatible UPI
                  app. Every part needs a separate approval.
                </p>
              </div>
            </div>
            <div>
              <span>3</span>
              <div>
                <h3>Check and record</h3>
                <p>
                  Check the actual credit in your bank or merchant app, then mark the part received.
                  A scan or opened link does not confirm a payment.
                </p>
              </div>
            </div>
          </div>
          <div className="info-box">
            <h3>
              <Info size={17} /> About fees and payment limits
            </h3>
            <p>
              The Ministry of Finance’s September 15, 2026 release describes 0.4% MDR for specified
              P2M payments above ₹2,000, with exemptions. MDR is a merchant charge, not a government
              tax.
            </p>
            <p>
              Splitting a bill does not guarantee an MDR exemption. Confirm your provider’s rules
              for split payments. A QR prefills an amount; it cannot enforce a bank-side cap or
              prevent repeat payments.
            </p>
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              Read the official announcement <ArrowUpRight size={14} />
            </a>
          </div>
          <p className="help-footnote">
            SplitPay creates standard UPI payment links and QR codes. It does not send collect
            requests, verify a UPI account, or confirm settlements. Live confirmations require a
            payment provider integration.
          </p>
          <button className="button primary full-width" onClick={() => setHelp(false)}>
            Got it <Check size={17} />
          </button>
        </Modal>
      )}

      {recording && active && (
        <Modal
          title={recording.undo ? 'Undo received status?' : 'Record a received payment'}
          onClose={() => setRecording(null)}
        >
          <form onSubmit={record}>
            <div className="record-summary">
              <span>
                <Wallet size={24} />
              </span>
              <div>
                <p>
                  Payment {active.parts.findIndex((part) => part.id === recording.part.id) + 1} of{' '}
                  {active.parts.length}
                </p>
                <strong>{formatMoney(recording.part.amount)}</strong>
              </div>
            </div>
            <p className="record-explanation">
              {recording.undo
                ? 'This changes your local record to awaiting payment. It does not reverse or refund a bank transaction.'
                : 'Check that this exact amount reached your account in your bank or merchant app before recording it as received.'}
            </p>
            {!recording.undo && (
              <div className="field">
                <label htmlFor="payment-reference">
                  Bank reference / UTR <span className="optional">Optional</span>
                </label>
                <input
                  id="payment-reference"
                  placeholder="Add a reference for your records"
                  maxLength={60}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </div>
            )}
            <p className="manual-note">
              <Clock3 size={16} /> This is a manual record stored on this device.
            </p>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setRecording(null)}>
                Cancel
              </button>
              <button className="button primary" type="submit">
                {recording.undo ? 'Mark awaiting payment' : 'I checked — record received'}
                <Check size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={15} />
          </span>
          {toast}
          <button onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        </div>
      )}
    </>
  )
}
