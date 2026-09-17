import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import QRCode from 'qrcode'
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  Copy,
  LoaderCircle,
  Maximize2,
  Printer,
  QrCode,
  RotateCcw,
  X,
} from 'lucide-react'
import { billText, decimalAmount, formatMoney, paymentUri } from './lib/payments'
import type { Bill, PaymentPart } from './lib/payments'

export function Modal({
  title,
  children,
  onClose,
  className = '',
}: {
  title: string
  children: ReactNode
  onClose: () => void
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-header">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}

export function downloadFile(content: string, filename: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Collection({
  bill,
  onRecord,
  onUndo,
  notify,
}: {
  bill: Bill
  onRecord: (part: PaymentPart) => void
  onUndo: (part: PaymentPart) => void
  notify: (text: string) => void
}) {
  const [codes, setCodes] = useState<{ id: string; urls: Record<string, string> } | null>(null)
  const [qrError, setQrError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copyFallback, setCopyFallback] = useState<string | null>(null)
  const selected = bill.parts.find((part) => part.id === expanded)
  const urls = codes?.id === bill.id ? codes.urls : {}
  const ready = Object.keys(urls).length === bill.parts.length
  const complete = bill.parts.every((part) => part.receivedAt)

  useEffect(() => {
    let cancelled = false
    Promise.all(
      bill.parts.map(
        async (part) =>
          [
            part.id,
            await QRCode.toDataURL(paymentUri(bill, part), {
              errorCorrectionLevel: 'M',
              width: 480,
              margin: 4,
              color: { dark: '#201b32', light: '#ffffff' },
            }),
          ] as const,
      ),
    )
      .then((entries) => {
        if (!cancelled) {
          setCodes({ id: bill.id, urls: Object.fromEntries(entries) })
          setQrError(false)
        }
      })
      .catch(() => {
        if (!cancelled) setQrError(true)
      })
    return () => {
      cancelled = true
    }
  }, [bill, attempt])

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      notify(message)
    } catch {
      setCopyFallback(text)
    }
  }

  function downloadQr(part: PaymentPart) {
    if (!urls[part.id]) return
    const anchor = document.createElement('a')
    anchor.href = urls[part.id]
    anchor.download = `${part.id}-INR-${decimalAmount(part.amount)}.png`
    anchor.click()
    notify('QR code downloaded')
  }

  function qr(part: PaymentPart, large = false) {
    return urls[part.id] ? (
      <img
        src={urls[part.id]}
        width={large ? 280 : 136}
        height={large ? 280 : 136}
        alt={`UPI QR for ${formatMoney(part.amount)} to ${bill.merchant.name}`}
      />
    ) : (
      <div className="qr-loading">
        <LoaderCircle className="spin" size={24} />
        <span>Preparing QR…</span>
      </div>
    )
  }

  return (
    <>
      <section className="collection" aria-labelledby="collection-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">READY TO COLLECT</span>
            <h2 id="collection-title" tabIndex={-1}>
              Your payment QRs <span className="count-badge">{bill.parts.length}</span>
            </h2>
          </div>
          <span className={`status ${complete ? 'green' : ''}`}>
            <span />
            {complete ? 'All recorded' : 'Awaiting payments'}
          </span>
        </div>
        <p className="section-description">
          Ask your customer to scan and approve each payment separately.
        </p>
        <div className="collection-toolbar">
          <button
            className="button secondary small"
            onClick={() => copy(billText(bill), 'Bill and payment links copied')}
          >
            <Copy size={15} /> Copy bill
          </button>
          <button
            className="button secondary small"
            disabled={!ready}
            onClick={() => window.print()}
          >
            <Printer size={15} /> Print QRs
          </button>
          <button
            className="icon-button"
            onClick={() => downloadFile(billText(bill), `${bill.id}.txt`)}
            aria-label="Download bill as text"
            title="Download bill"
          >
            <ArrowDownToLine size={18} />
          </button>
          <span>{bill.id}</span>
        </div>
        {qrError && (
          <div className="inline-error" role="alert">
            QR codes could not be created. Payment links are still available.{' '}
            <button
              className="text-button"
              onClick={() => {
                setQrError(false)
                setAttempt(attempt + 1)
              }}
            >
              Retry
            </button>
          </div>
        )}
        <div className="payment-grid">
          {bill.parts.map((part, index) => (
            <article className={`payment-card ${part.receivedAt ? 'received' : ''}`} key={part.id}>
              <div className="payment-card-top">
                <span className="part-number">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  Payment {index + 1} of {bill.parts.length}
                </span>
                {part.receivedAt && <CheckCheck size={17} />}
              </div>
              <h3>{formatMoney(part.amount)}</h3>
              <button
                className="qr-button"
                onClick={() => setExpanded(part.id)}
                aria-label={`Enlarge QR for payment ${index + 1}`}
              >
                {qr(part)}
                <span>
                  <Maximize2 size={13} /> Enlarge QR
                </span>
              </button>
              <div className="qr-actions">
                <button
                  onClick={() => downloadQr(part)}
                  disabled={!urls[part.id]}
                  aria-label={`Download QR for payment ${index + 1}`}
                >
                  <ArrowDownToLine size={15} /> QR
                </button>
                <button
                  onClick={() => copy(paymentUri(bill, part), `Payment ${index + 1} link copied`)}
                  aria-label={`Copy link for payment ${index + 1}`}
                >
                  <Copy size={14} /> Link
                </button>
                <a
                  href={paymentUri(bill, part)}
                  aria-label={`Pay ${formatMoney(part.amount)} in UPI app`}
                >
                  Pay <ArrowUpRight size={15} />
                </a>
              </div>
              {part.receivedAt ? (
                <div className="received-action">
                  <span>
                    <Check size={14} /> Recorded received
                  </span>
                  <button
                    className="icon-button"
                    onClick={() => onUndo(part)}
                    aria-label={`Undo received status for payment ${index + 1}`}
                    title="Undo received status"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              ) : (
                <button className="record-button" onClick={() => onRecord(part)}>
                  <Check size={16} /> Mark received
                </button>
              )}
              {part.reference && <p className="reference">Ref: {part.reference}</p>}
            </article>
          ))}
        </div>
        <p className="payment-footnote">
          <QrCode size={16} /> Amounts are prefilled. Verify the actual amount received in your bank
          app.
        </p>
      </section>
      <section className="print-sheet" aria-hidden="true">
        <div className="print-heading">
          <h1>{bill.merchant.name}</h1>
          <p>
            {bill.note || 'UPI payment bill'} · {bill.id}
          </p>
          <p>
            Bill total: <strong>{formatMoney(bill.total)}</strong> · Pay to: {bill.merchant.upiId}
          </p>
          <p>
            Scan and approve each payment separately. Check the recipient and amount in your UPI
            app.
          </p>
        </div>
        <div className="print-grid">
          {bill.parts.map((part, index) => (
            <article className="print-payment" key={part.id}>
              <p>
                Payment {index + 1} of {bill.parts.length}
              </p>
              <h2>{formatMoney(part.amount)}</h2>
              {qr(part)}
              <p>{bill.merchant.upiId}</p>
              <small>{part.id}</small>
              {part.receivedAt && <p>Recorded received by merchant</p>}
            </article>
          ))}
        </div>
      </section>
      {selected && (
        <Modal
          title={`Payment ${bill.parts.indexOf(selected) + 1} of ${bill.parts.length}`}
          onClose={() => setExpanded(null)}
          className="qr-modal"
        >
          <div className="expanded-payment">
            <span className="muted">Paying {bill.merchant.name}</span>
            <h3>{formatMoney(selected.amount)}</h3>
            {qr(selected, true)}
            <strong>{bill.merchant.upiId}</strong>
            <p>
              Scan with your UPI app.
              <br />
              Check the recipient name and amount before paying.
            </p>
            <a className="button primary" href={paymentUri(bill, selected)}>
              Open UPI app <ArrowUpRight size={17} />
            </a>
            <button
              className="button secondary"
              disabled={!urls[selected.id]}
              onClick={() => downloadQr(selected)}
            >
              <ArrowDownToLine size={17} /> Download QR
            </button>
            <button
              className="text-button"
              onClick={() => {
                setExpanded(null)
                const next = bill.parts[bill.parts.indexOf(selected) + 1]
                if (next) setExpanded(next.id)
              }}
            >
              {bill.parts.indexOf(selected) < bill.parts.length - 1 ? (
                <>
                  Next payment <ChevronRight size={15} />
                </>
              ) : (
                'Back to all payments'
              )}
            </button>
          </div>
        </Modal>
      )}
      {copyFallback && (
        <Modal title="Copy payment details" onClose={() => setCopyFallback(null)}>
          <p className="muted">
            Your browser couldn’t access the clipboard. Select and copy the details below.
          </p>
          <textarea
            className="copy-fallback"
            aria-label="Payment details to copy"
            readOnly
            value={copyFallback}
            onFocus={(event) => event.target.select()}
            autoFocus
          />
        </Modal>
      )}
    </>
  )
}
