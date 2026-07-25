import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { FiZap } from 'react-icons/fi';
import '../../styles/components/QRScanner.css';

const ELEMENT_ID = 'qr-scanner-viewport';

// A code held in front of the camera gets detected on every frame (~10/sec)
// until it's moved away — without this, one physical scan would fire onScan
// (and add-to-cart) a dozen times. A different code scanned immediately
// after is never blocked; only the *same* code repeating within the window
// is treated as "still the same physical scan."
const SCAN_COOLDOWN_MS = 1800;
const FLASH_DURATION_MS = 350;

// Real retail products carry 1D barcodes (EAN/UPC/Code128), not this app's
// self-printed QR labels — restricting to QR_CODE (the previous config) meant
// a genuine supermarket barcode was never even recognized by the decoder,
// let alone matched to a product. useBarCodeDetectorIfSupported opts into
// the browser's native BarcodeDetector API where available, which is both
// faster and more reliable than the pure-JS decoder for 1D formats.
const SCAN_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
];

// The spec's requested preset stops — only the ones inside this camera's
// actual supported [min, max] zoomFeature() range ever render, so a device
// that can't zoom (most laptop webcams) simply shows no zoom row instead of
// buttons that would silently no-op.
const ZOOM_PRESETS = [0.5, 1, 2, 3];

// html5-qrcode's stop() throws *synchronously* — not a rejected promise —
// when the scanner isn't currently SCANNING/PAUSED (see its source: `if
// (!this.stateManagerProxy.isScanning()) throw "Cannot stop, scanner is not
// running or paused.";`, before it ever returns anything to chain .catch()
// onto). A plain `scanner.stop().catch(() => {})` only catches a rejection
// — it does nothing for that synchronous throw, which is exactly what
// produced the "Uncaught Cannot stop..." error whenever cleanup ran before
// start() had finished negotiating the camera (component unmounted/closed
// quickly, or React re-invoking effects). getState() is synchronous and
// backed by the same flag stop() itself checks, so reading it immediately
// beforehand — no `await` in between — reliably predicts whether stop()
// would throw. The try/catch is extra insurance for any other synchronous
// throw the library can raise (e.g. mid-transition), not just this one.
function safeStopScanner(scanner) {
  if (scanner.getState() === Html5QrcodeScannerState.NOT_STARTED) {
    return Promise.resolve();
  }
  try {
    return scanner.stop().catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 1200;
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.15);
    oscillator.onended = () => ctx.close();
  } catch {
    // A beep is feedback, not a requirement — a scan that can't play audio
    // (autoplay policy, no AudioContext) must still add the product.
  }
}

// Reusable camera scanner for both QR labels and real 1D barcodes. Requires
// a secure context (HTTPS in production, or localhost in dev — see
// docs/PROJECT_PLAN.md §9) and browser camera permission. onScan receives
// the raw decoded text for every physically-distinct scan (already
// deduplicated and beeped/flashed) — callers decide whether it's JSON
// (self-printed QR) or a plain barcode string.
function QRScanner({ onScan, onError }) {
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ text: null, time: 0 });
  const zoomFeatureRef = useRef(null);
  const torchFeatureRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | starting | scanning | error
  const [flash, setFlash] = useState(false);
  const [zoomInfo, setZoomInfo] = useState(null); // { presets, current } once confirmed supported
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    // Guards against the real race this component's lifecycle can hit: the
    // scanner can be told to close (Modal's onClose, or handleScan closing
    // it right after a successful match) WHILE start() is still resolving
    // — camera negotiation is genuinely async and can take a moment. If
    // that happens, getState() below wouldn't yet report SCANNING, so a
    // plain "only stop if scanning" cleanup would skip the stop() call
    // entirely — and then start() would go on to succeed moments later,
    // leaving the camera running with no component left to ever release
    // it. cancelled is checked the instant start() resolves so that exact
    // window can never leave a hidden running scanner behind.
    let cancelled = false;
    const scanner = new Html5Qrcode(ELEMENT_ID, {
      formatsToSupport: SCAN_FORMATS,
      useBarCodeDetectorIfSupported: true,
    });
    scannerRef.current = scanner;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starting the camera is an external-system side effect, not a derived-state pattern
    setStatus('starting');

    scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          // Highest resolution the camera offers rather than the browser's
          // low default — more detail for the decoder, and the same
          // barcode is readable from farther away at a given frame size.
          // Rear camera preferred on mobile (facingMode carried here too,
          // matching the first start() argument).
          videoConstraints: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        },
        (decodedText) => {
          const now = Date.now();
          const last = lastScanRef.current;
          if (decodedText === last.text && now - last.time < SCAN_COOLDOWN_MS) return;
          lastScanRef.current = { text: decodedText, time: now };

          playBeep();
          setFlash(true);
          setTimeout(() => setFlash(false), FLASH_DURATION_MS);
          onScan(decodedText);
        },
        () => {
          // Fired continuously while no code is in frame — not an error, ignore.
        },
      )
      .then(async () => {
        if (cancelled) {
          safeStopScanner(scanner);
          return;
        }
        setStatus('scanning');

        // Continuous autofocus reduces the camera "hunting" for focus on
        // every frame — best-effort, silently ignored where unsupported.
        try {
          await scanner.applyVideoConstraints({ advanced: [{ focusMode: 'continuous' }] });
        } catch {
          // Not supported on this device/browser — the camera's default
          // focus behavior still works, just without this hint.
        }
        if (cancelled) {
          safeStopScanner(scanner);
          return;
        }

        try {
          const capabilities = scanner.getRunningTrackCameraCapabilities();
          const zoom = capabilities.zoomFeature();
          if (zoom.isSupported()) {
            const min = zoom.min();
            const max = zoom.max();
            const presets = ZOOM_PRESETS.filter((value) => value >= min && value <= max);
            if (presets.length > 0) {
              zoomFeatureRef.current = zoom;
              setZoomInfo({ presets, current: zoom.value() ?? presets[0] });
            }
          }
          const torch = capabilities.torchFeature();
          if (torch.isSupported()) {
            torchFeatureRef.current = torch;
            setTorchSupported(true);
          }
        } catch {
          // getRunningTrackCameraCapabilities/MediaTrackCapabilities isn't
          // available on this browser — no zoom/torch controls render, the
          // plain camera feed still works.
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        onError?.(err);
      });

    return () => {
      cancelled = true;
      // safeStopScanner checks getState() first — stop() throws
      // *synchronously* (see its definition above) when the camera never
      // reached SCANNING, so this is required, not just cheap insurance.
      // clear() afterward tears down the library's own rendered
      // video/canvas/UI state so nothing lingers if this same DOM node is
      // ever reused.
      safeStopScanner(scanner).finally(() => {
        try {
          scanner.clear();
        } catch {
          // Nothing rendered yet (start() never got far enough) — fine.
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scanner lifecycle is intentionally mount/unmount only
  }, []);

  const handleZoomSelect = async (value) => {
    if (!zoomFeatureRef.current) return;
    try {
      await zoomFeatureRef.current.apply(value);
      setZoomInfo((prev) => (prev ? { ...prev, current: value } : prev));
    } catch {
      // Camera momentarily rejected the level — leave the UI as-is rather
      // than showing an error for a zoom tap.
    }
  };

  const handleToggleTorch = async () => {
    if (!torchFeatureRef.current) return;
    const next = !torchOn;
    try {
      await torchFeatureRef.current.apply(next);
      setTorchOn(next);
    } catch {
      // Unsupported mid-session on this device — button just stays inert.
    }
  };

  // No status text by design — a cashier scanning continuously should never
  // have to read "Starting..."/"Ready..."/error copy. Camera startup is a
  // bare spinner (no words); a failure is reported to the caller (onError)
  // which closes this modal and hands off to the search box instead of
  // leaving dead camera UI on screen.
  return (
    <div className={`qr-scanner ${flash ? 'qr-scanner-flash' : ''}`}>
      <div id={ELEMENT_ID} className="qr-scanner-viewport" />
      {status === 'starting' && (
        <div className="flex items-center justify-center p-4">
          <span className="spinner" aria-label="Starting camera" />
        </div>
      )}
      {(zoomInfo || torchSupported) && (
        <div className="qr-scanner-controls">
          {zoomInfo && (
            <div className="qr-scanner-zoom">
              {zoomInfo.presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`qr-scanner-zoom-btn ${zoomInfo.current === preset ? 'qr-scanner-zoom-btn-active' : ''}`}
                  onClick={() => handleZoomSelect(preset)}
                >
                  {preset}x
                </button>
              ))}
            </div>
          )}
          {torchSupported && (
            <button
              type="button"
              className={`qr-scanner-torch-btn ${torchOn ? 'qr-scanner-torch-btn-active' : ''}`}
              onClick={handleToggleTorch}
              aria-label={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
              aria-pressed={torchOn}
            >
              <FiZap />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default QRScanner;
