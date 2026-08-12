import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiTrash2, FiCamera, FiPlus, FiMinus, FiClock, FiShoppingCart, FiUserPlus, FiPercent, FiPrinter, FiDownload, FiCheckCircle } from 'react-icons/fi';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import SearchInput from '../../components/common/SearchInput';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';
import * as productService from '../../services/productService';
import * as branchService from '../../services/branchService';
import * as customerService from '../../services/customerService';
import * as saleService from '../../services/saleService';
import { formatCurrency } from '../../utils/formatCurrency';
import { splitFullName } from '../../utils/splitFullName';
import '../../styles/pages/POS.css';

// html5-qrcode is a genuinely heavy dependency (camera + barcode decoding)
// used only inside the scanner modal, which most POS sessions never open —
// lazy-loading it keeps that weight out of POS's own eager chunk, fetched
// only the moment a cashier actually taps "Scan".
const QRScanner = lazy(() => import('../../components/common/QRScanner'));

function POS() {
  const { t } = useTranslation(['sales', 'common']);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canOverride = usePermission('sales.manage');
  const toast = useToast();

  // Four cashier-facing payment buttons (spec). "Mobile Money" isn't a single
  // backend value — the app still records M-Pesa vs Airtel Money separately
  // for reporting — so it expands into a two-option sub-select on tap instead
  // of collapsing to one generic value.
  const PAYMENT_GROUPS = [
    { key: 'cash', label: t('sales:pos.payment.cash'), method: 'cash' },
    { key: 'card', label: t('sales:pos.payment.card'), method: 'card' },
    { key: 'transfer', label: t('sales:pos.payment.transfer'), method: 'bank_transfer' },
    { key: 'mobile_money', label: t('sales:pos.payment.mobileMoney'), subOptions: [{ method: 'mpesa', label: t('sales:pos.payment.mpesa') }, { method: 'airtel_money', label: t('sales:pos.payment.airtelMoney') }] },
  ];

  const searchInputRef = useRef(null);
  // One idempotency key per checkout attempt — generated once when the
  // cart starts (here, mount) and regenerated only in clearCart() (which
  // runs both on an explicit "Clear Cart" and right after a successful
  // checkout), so a double-click/retry during ONE attempt always resends
  // the same key, but a genuinely new sale always gets a fresh one.
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const isCheckingOutRef = useRef(false);

  const [branchId, setBranchId] = useState(user?.branch_id || '');
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [cart, setCart] = useState([]);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [flashLineId, setFlashLineId] = useState(null);
  const flashTimerRef = useRef(null);
  const [expandedDiscountLines, setExpandedDiscountLines] = useState(() => new Set());
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [mobileMoneyOpen, setMobileMoneyOpen] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [clearCartConfirmOpen, setClearCartConfirmOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [receiptBusy, setReceiptBusy] = useState('');
  const receiptTimerRef = useRef(null);

  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
  const [quickCustomerError, setQuickCustomerError] = useState('');
  const [savingQuickCustomer, setSavingQuickCustomer] = useState(false);

  const anyModalOpen = scannerOpen || quickCustomerOpen || clearCartConfirmOpen || Boolean(lastSale);

  useEffect(() => {
    if (!user?.branch_id) {
      branchService.listActiveBranches().then(setBranches);
    }
    customerService.listActiveCustomers().then(setCustomers);
  }, [user]);

  const loadProducts = useCallback(() => {
    if (!branchId) return;
    setProductsLoading(true);
    productService
      .listSellableProducts({ branchId, search: debouncedSearch || undefined })
      .then(setProducts)
      .finally(() => setProductsLoading(false));
  }, [branchId, debouncedSearch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the product grid on branch/search change is standard data-fetching, not derived state
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new query invalidates whatever result the cashier had arrow-keyed to
    setHighlightedIndex(-1);
  }, [debouncedSearch]);

  const cartLine = (productId) => cart.find((line) => line.productId === productId);

  // The cart itself is the confirmation — no toast, no status text. A brief
  // highlight on the affected row is the only feedback, cleared after
  // FLASH_DURATION_MS so it never lingers into being its own kind of
  // "message."
  const triggerFlash = useCallback((productId) => {
    clearTimeout(flashTimerRef.current);
    setFlashLineId(productId);
    flashTimerRef.current = setTimeout(() => setFlashLineId(null), 450);
  }, []);

  // The one path every add-to-cart trigger goes through — scan, exact-code
  // auto-match, search+Enter, and a plain product-grid click. Clears the
  // search box here (rather than in each caller) so none of them regress
  // into leaving the last query sitting there. Deliberately does NOT
  // refocus search — that used to happen on every add (scan, click, or
  // Enter alike), which meant tapping a product card or finishing a camera
  // scan popped the on-screen keyboard on mobile every single time. Search
  // now only gets focus from an actual user action on the search box
  // itself (a tap, or the F2/Escape shortcuts below) — a hardware
  // keyboard-wedge scanner still works exactly as before, since typing
  // into the box is what puts focus there in the first place; clearing its
  // value afterward doesn't blur it.
  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.available_quantity) return prev;
        return prev.map((line) => (line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      if (product.available_quantity < 1) return prev;
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          code: product.code,
          unitPrice: Number(product.selling_price),
          availableQuantity: product.available_quantity,
          quantity: 1,
          discountAmount: 0,
        },
      ];
    });
    triggerFlash(product.id);
    setSearch('');
    setHighlightedIndex(-1);
  }, [triggerFlash]);

  // Makes hardware/keyboard-wedge barcode scanners "just work" through the
  // same search box a cashier types into — those devices type the full
  // code faster than the debounce window, then the product grid settles on
  // exactly one row whose code equals what was typed. A manual, partial
  // name search essentially never produces an exact code match, so this
  // never fires for ordinary typing.
  useEffect(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query || products.length === 0) return;
    const exact = products.find((p) => p.code.toLowerCase() === query);
    if (exact) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to an external event (a completed scan resolving to a product) by updating the cart, not deriving render state
      addToCart(exact);
    }
  }, [products, debouncedSearch, addToCart]);

  const updateLine = (productId, patch) => {
    setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, ...patch } : line)));
  };

  // Shared by the [-]/[+] stepper buttons and the direct-type number input
  // so both paths clamp to the same [1, availableQuantity] bounds. Only
  // flashes on an actual increase — typing a smaller number or hitting [-]
  // isn't the "just added stock" moment this cue is for.
  const setLineQuantity = (line, nextQuantity) => {
    const qty = Math.max(1, Math.min(line.availableQuantity, nextQuantity || 1));
    if (qty > line.quantity) triggerFlash(line.productId);
    updateLine(line.productId, { quantity: qty });
  };

  const removeLine = (productId) => {
    setCart((prev) => prev.filter((line) => line.productId !== productId));
    setSelectedLineId((prev) => (prev === productId ? null : prev));
  };

  const selectLine = (productId) => {
    setSelectedLineId((prev) => (prev === productId ? null : productId));
    // So a subsequent Delete keypress (guarded against firing while any
    // text input is focused) is actually free to remove the line instead
    // of being swallowed by the "don't delete while typing" guard.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  const toggleDiscountEditor = (productId) => {
    setExpandedDiscountLines((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  const clearCart = () => {
    setClearCartConfirmOpen(false);
    setCart([]);
    setSelectedLineId(null);
    setExpandedDiscountLines(new Set());
    setCustomerId('');
    setPaymentMethod('cash');
    setMobileMoneyOpen(false);
    idempotencyKeyRef.current = crypto.randomUUID();
  };

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), [cart]);
  const discountTotal = useMemo(() => cart.reduce((sum, line) => sum + (Number(line.discountAmount) || 0), 0), [cart]);
  const total = Math.max(0, subtotal - discountTotal);

  const selectPaymentGroup = (group) => {
    if (group.subOptions) {
      setMobileMoneyOpen((prev) => !prev);
      return;
    }
    setMobileMoneyOpen(false);
    setPaymentMethod(group.method);
  };

  const selectMobileMoneyOption = (method) => {
    setPaymentMethod(method);
    setMobileMoneyOpen(false);
  };

  const isMobileMoneyMethod = paymentMethod === 'mpesa' || paymentMethod === 'airtel_money';

  // Success is silent by design — the cart flash + beep (in QRScanner) are
  // the only feedback a cashier gets. A scan that resolves to a real
  // product closes the scanner immediately (one successful scan = one
  // camera session, per spec — the cashier presses "Scan Barcode" again
  // for the next item rather than the camera staying open indefinitely).
  // A scan that can't resolve to a product is the one case that keeps the
  // camera open: silently doing nothing would leave the cashier wondering
  // why the item never showed up, and per spec a miss must NOT close the
  // scanner — a toast, not persistent on-screen text, and scanning
  // continues for another attempt.
  // The scanner's ONLY job: turn a decoded barcode into a product, then
  // hand off to the exact same addToCart() a manual product-grid click
  // calls — no separate cart logic ever lives here. Looks up by EXACT code
  // match (products.code is the only column that serves as a barcode in
  // this schema — there is no dedicated `barcode` column) rather than the
  // product grid's fuzzy name/code search, since a scan is either the
  // right product or nothing — never a "close enough" guess.
  const handleScan = async (decodedText) => {
    let code;
    try {
      const payload = JSON.parse(decodedText);
      code = payload.code;
    } catch {
      // Not our self-printed QR JSON — the raw decoded text is a real
      // manufacturer barcode, matched directly against products.code.
      code = decodedText;
    }
    code = code?.trim();
    if (!code) return;

    try {
      const match = await productService.lookupSellableProduct({ code, branchId });
      if (!match) {
        toast.error(t('sales:pos.toast.productNotFound'));
        return;
      }
      addToCart(match);
      setScannerOpen(false);
    } catch {
      toast.error(t('sales:pos.toast.productNotFound'));
    }
  };

  const handleScannerError = () => {
    setScannerOpen(false);
    toast.error(t('sales:pos.toast.cameraUnavailable'));
  };

  // Enter in the search box: a highlighted (arrow-keyed) result wins
  // outright. Otherwise this is almost always a hardware scanner that just
  // typed a full code faster than the debounce settled, or a cashier who
  // typed a few letters and hit Enter before the grid updated — a fresh,
  // un-debounced lookup keeps both cases correct instead of racing the
  // in-flight search.
  const handleSearchEnter = async () => {
    if (highlightedIndex >= 0 && products[highlightedIndex]) {
      addToCart(products[highlightedIndex]);
      return;
    }

    const query = search.trim();
    if (!query || !branchId) return;
    try {
      const results = await productService.listSellableProducts({ branchId, search: query, limit: 5 });
      const match = results.find((p) => p.code.toLowerCase() === query.toLowerCase()) || results[0];
      if (match) {
        addToCart(match);
      } else {
        toast.error(t('sales:pos.toast.noProductFoundFor', { query }));
      }
    } catch {
      toast.error(t('sales:pos.toast.productLookupFailed'));
    }
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, products.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleSearchEnter();
    }
  };

  const openQuickCustomer = () => {
    setQuickCustomerName('');
    setQuickCustomerPhone('');
    setQuickCustomerError('');
    setQuickCustomerOpen(true);
  };

  // Same two required fields the full Customer form already treats as
  // required (fullName, phone) — Quick Customer isn't a lighter validation
  // rule, it's the same create endpoint with the optional fields (email/
  // address/notes) simply never shown.
  const submitQuickCustomer = async () => {
    setQuickCustomerError('');
    if (!quickCustomerName.trim() || !quickCustomerPhone.trim()) {
      setQuickCustomerError(t('sales:pos.toast.nameAndPhoneRequired'));
      return;
    }
    setSavingQuickCustomer(true);
    try {
      const { firstName, lastName } = splitFullName(quickCustomerName);
      const created = await customerService.createCustomer({ firstName, lastName, phone: quickCustomerPhone.trim() });
      setCustomers((prev) => [...prev, created]);
      setCustomerId(String(created.id));
      setQuickCustomerOpen(false);
      toast.success(t('sales:pos.toast.customerAddedAndSelected', { name: quickCustomerName.trim() }));
    } catch (err) {
      setQuickCustomerError(err.response?.data?.message || t('sales:pos.toast.failedToAddCustomer'));
    } finally {
      setSavingQuickCustomer(false);
    }
  };

  const canCheckout = cart.length > 0 && branchId && total > 0 && !isCheckingOut;

  const handleCheckout = useCallback(async () => {
    // isCheckingOutRef is checked synchronously (unlike the isCheckingOut
    // state used to disable the button, which only takes effect after the
    // next render) — closes the gap where two rapid clicks/taps/Enter
    // presses both fire before React re-renders with the button disabled.
    // The server-side idempotency key is the actual authority (see
    // sale.service.js); this is just the fastest possible client-side line
    // of defense.
    if (isCheckingOutRef.current) return;
    if (cart.length === 0 || !branchId || total <= 0) return;
    isCheckingOutRef.current = true;

    setCheckoutError('');
    setIsCheckingOut(true);
    try {
      const payload = {
        idempotencyKey: idempotencyKeyRef.current,
        branchId: Number(branchId),
        customerId: customerId ? Number(customerId) : undefined,
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountAmount: Number(line.discountAmount) || 0,
        })),
        payments: [{ method: paymentMethod, amount: total }],
      };

      const sale = await saleService.checkout(payload);
      clearCart();
      // Deliberately NOT navigating away to the Sale Detail page — the
      // cashier never leaves POS. The Sale Completed modal uses the exact
      // same glass modal system as every other modal in the app (Add
      // Customer, Add Product, Settings, ...) rather than a bespoke panel,
      // per the "one consistent design language" requirement.
      setLastSale(sale);
    } catch (err) {
      setCheckoutError(err.response?.data?.message || t('sales:pos.toast.checkoutFailed'));
    } finally {
      setIsCheckingOut(false);
      isCheckingOutRef.current = false;
    }
  }, [cart, branchId, customerId, paymentMethod, total, t]);

  // A real modal blocks the page underneath it, so — unlike the previous
  // non-modal tray — it can't just dismiss itself the moment the cashier
  // starts scanning the next sale (there's nothing to interact with behind
  // the backdrop). It still closes itself after a short delay as a
  // convenience for a cashier who doesn't need Print/Download and would
  // otherwise have to click New Sale for every single transaction.
  useEffect(() => {
    if (!lastSale) return undefined;
    receiptTimerRef.current = setTimeout(() => setLastSale(null), 10000);
    return () => clearTimeout(receiptTimerRef.current);
  }, [lastSale]);

  const dismissReceipt = () => {
    clearTimeout(receiptTimerRef.current);
    setLastSale(null);
  };

  const handlePrintReceipt = async () => {
    if (!lastSale) return;
    setReceiptBusy('print');
    try {
      await saleService.printReceipt(lastSale.id);
    } catch {
      toast.error(t('sales:pos.toast.failedToOpenReceipt'));
    } finally {
      setReceiptBusy('');
    }
  };

  const handleDownloadReceipt = async () => {
    if (!lastSale) return;
    setReceiptBusy('download');
    try {
      await saleService.downloadReceiptPdf(lastSale.id, lastSale.sale_number);
    } catch {
      toast.error(t('sales:pos.toast.failedToDownloadReceipt'));
    } finally {
      setReceiptBusy('');
    }
  };

  // Production keyboard workflow: F2 refocuses search, F4 opens the
  // scanner, ESC clears the search box, Delete removes the selected cart
  // line, and Enter completes the sale — but only when focus isn't inside
  // a text field (the search box handles its own Enter in
  // handleSearchKeyDown, and a plain Enter while typing anywhere else,
  // e.g. the Quick Customer modal, must never accidentally fire checkout).
  // Suppressed entirely while any modal is open so ESC/Enter there do what
  // that modal expects, not this page's shortcuts underneath it.
  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if (anyModalOpen) return;

      const tag = document.activeElement?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (event.key === 'F2') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (event.key === 'F4') {
        event.preventDefault();
        setScannerOpen(true);
        return;
      }
      if (event.key === 'Escape') {
        setSearch('');
        setHighlightedIndex(-1);
        searchInputRef.current?.focus();
        return;
      }
      if (event.key === 'Delete' && !isTyping && selectedLineId) {
        removeLine(selectedLineId);
        return;
      }
      if (event.key === 'Enter' && !isTyping) {
        event.preventDefault();
        handleCheckout();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [anyModalOpen, selectedLineId, handleCheckout]);

  return (
    <div className="pos-page">
      <div className="pos-catalog">
        <div className="pos-catalog-toolbar">
          <div className="pos-catalog-toolbar-row">
            {!user?.branch_id ? (
              <select className="form-control pos-branch-select" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">{t('sales:pos.selectBranchPlaceholder')}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            ) : (
              <span className="badge badge-neutral">{user.branch_name}</span>
            )}
            <SearchInput
              ref={searchInputRef}
              value={search}
              onChange={setSearch}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('sales:pos.searchPlaceholder')}
            />
            <button type="button" className="btn btn-secondary" onClick={() => setScannerOpen(true)}>
              <FiCamera aria-hidden="true" /> {t('sales:pos.scanBarcode')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/pos/sales')}>
              <FiClock aria-hidden="true" /> {t('sales:pos.saleHistory')}
            </button>
          </div>
        </div>

        {!branchId ? (
          <div className="pos-scan-empty">{t('sales:pos.selectBranchToView')}</div>
        ) : productsLoading ? (
          <div className="flex items-center justify-center p-6"><span className="spinner" aria-label={t('common:state.loading')} /></div>
        ) : (
          <div className="pos-product-grid">
            {products.map((product, index) => {
              const inCartQty = cartLine(product.id)?.quantity || 0;
              const disabled = inCartQty >= product.available_quantity;
              return (
                <button
                  key={product.id}
                  type="button"
                  className={`pos-product-card ${index === highlightedIndex ? 'pos-product-card-highlighted' : ''}`}
                  onClick={() => addToCart(product)}
                  disabled={disabled}
                >
                  <span className="pos-product-name">{product.name}</span>
                  <span className="pos-product-code">{product.code}</span>
                  <span className="pos-product-price">{formatCurrency(product.selling_price)}</span>
                  <span className="pos-product-stock">
                    {t('sales:pos.inStock', { count: product.available_quantity })}
                    {inCartQty ? ` · ${t('sales:pos.inCart', { count: inCartQty })}` : ''}
                  </span>
                </button>
              );
            })}
            {products.length === 0 && <div className="pos-scan-empty">{t('sales:pos.noProductsFound')}</div>}
          </div>
        )}
      </div>

      <div className="pos-cart">
        <div className="pos-cart-header">
          <span className="card-title">{t('sales:pos.cart', { count: cart.length })}</span>
          {cart.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setClearCartConfirmOpen(true)}>{t('sales:pos.clearCart')}</button>
          )}
        </div>

        <div className="pos-cart-items">
          {cart.length === 0 ? (
            <EmptyState icon={FiShoppingCart} title={t('sales:pos.cartEmptyTitle')} description={t('sales:pos.cartEmptyDescription')} />
          ) : (
            cart.map((line) => {
              const lineTotal = line.quantity * line.unitPrice - (Number(line.discountAmount) || 0);
              const isSelected = selectedLineId === line.productId;
              const isExpanded = expandedDiscountLines.has(line.productId);
              const isFlashing = flashLineId === line.productId;
              return (
                <div className={`pos-cart-line ${isSelected ? 'pos-cart-line-selected' : ''} ${isFlashing ? 'pos-cart-line-flash' : ''}`} key={line.productId}>
                  <div className="pos-cart-line-top">
                    <button
                      type="button"
                      className="pos-cart-line-name"
                      onClick={() => selectLine(line.productId)}
                      aria-pressed={isSelected}
                      title={t('sales:pos.selectLineTitle')}
                    >
                      {line.name}
                    </button>
                    <div className="flex items-center gap-1">
                      {canOverride && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          onClick={() => toggleDiscountEditor(line.productId)}
                          aria-label={t('sales:pos.adjustPriceDiscountAria', { name: line.name })}
                          title={t('sales:pos.adjustPriceDiscountTitle')}
                        >
                          <FiPercent />
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeLine(line.productId)} aria-label={t('sales:pos.removeItemAria', { name: line.name })}>
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                  <div className="pos-cart-line-controls">
                    <div className="pos-cart-line-field">
                      <label htmlFor={`qty-${line.productId}`}>{t('sales:pos.qty')}</label>
                      <div className="pos-qty-stepper">
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon pos-qty-stepper-btn"
                          onClick={() => setLineQuantity(line, line.quantity - 1)}
                          disabled={line.quantity <= 1}
                          aria-label={t('sales:pos.decreaseQtyAria', { name: line.name })}
                        >
                          <FiMinus />
                        </button>
                        <input
                          id={`qty-${line.productId}`}
                          type="number"
                          min="1"
                          max={line.availableQuantity}
                          className="form-control pos-cart-qty-input"
                          value={line.quantity}
                          onChange={(e) => setLineQuantity(line, Number(e.target.value))}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon pos-qty-stepper-btn"
                          onClick={() => setLineQuantity(line, line.quantity + 1)}
                          disabled={line.quantity >= line.availableQuantity}
                          aria-label={t('sales:pos.increaseQtyAria', { name: line.name })}
                        >
                          <FiPlus />
                        </button>
                      </div>
                    </div>
                    <span className="pos-cart-line-price">{formatCurrency(line.unitPrice)}</span>
                    <span className="pos-cart-line-total">{formatCurrency(lineTotal)}</span>
                  </div>
                  {canOverride && isExpanded && (
                    <div className="pos-cart-line-override">
                      <div className="pos-cart-line-field">
                        <label htmlFor={`price-${line.productId}`}>{t('sales:pos.unitPrice')}</label>
                        <input
                          id={`price-${line.productId}`}
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control pos-cart-price-input"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.productId, { unitPrice: Number(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="pos-cart-line-field">
                        <label htmlFor={`discount-${line.productId}`}>{t('sales:pos.discount')}</label>
                        <input
                          id={`discount-${line.productId}`}
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control pos-cart-discount-input"
                          value={line.discountAmount}
                          onChange={(e) => updateLine(line.productId, { discountAmount: Number(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="pos-cart-footer">
          <div className="form-group">
            <div className="flex items-center justify-between">
              <label className="form-label" htmlFor="pos-customer" style={{ margin: 0 }}>{t('sales:pos.customerOptional')}</label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={openQuickCustomer}>
                <FiUserPlus aria-hidden="true" /> {t('sales:pos.quickAdd')}
              </button>
            </div>
            <select id="pos-customer" className="form-control" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">{t('sales:pos.walkInCustomer')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}{c.business_name ? ` (${c.business_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="pos-totals-row"><span>{t('sales:pos.subtotal')}</span><span>{formatCurrency(subtotal)}</span></div>
            {discountTotal > 0 && (
              <div className="pos-totals-row"><span>{t('sales:pos.discount')}</span><span>-{formatCurrency(discountTotal)}</span></div>
            )}
            <div className="pos-totals-row pos-totals-row-total"><span>{t('sales:pos.total')}</span><span>{formatCurrency(total)}</span></div>
          </div>

          <div>
            <span className="form-label" style={{ margin: 0 }}>{t('sales:pos.paymentMethod')}</span>
            <div className="pos-payment-groups">
              {PAYMENT_GROUPS.map((group) => {
                const isActive = group.subOptions ? isMobileMoneyMethod : paymentMethod === group.method;
                return (
                  <button
                    key={group.key}
                    type="button"
                    className={`pos-payment-group-btn ${isActive ? 'pos-payment-group-btn-active' : ''}`}
                    onClick={() => selectPaymentGroup(group)}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>
            {mobileMoneyOpen && (
              <div className="pos-payment-suboptions">
                {PAYMENT_GROUPS.find((g) => g.key === 'mobile_money').subOptions.map((option) => (
                  <button
                    key={option.method}
                    type="button"
                    className={`pos-payment-group-btn pos-payment-suboption-btn ${paymentMethod === option.method ? 'pos-payment-group-btn-active' : ''}`}
                    onClick={() => selectMobileMoneyOption(option.method)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            {isMobileMoneyMethod && !mobileMoneyOpen && (
              <p className="text-xs text-secondary mt-1">
                {PAYMENT_GROUPS.find((g) => g.key === 'mobile_money').subOptions.find((o) => o.method === paymentMethod)?.label} {t('sales:pos.selected')}
              </p>
            )}
          </div>

          {checkoutError && <div className="alert alert-danger" role="alert">{checkoutError}</div>}

          <button
            type="button"
            className={`btn btn-primary btn-lg ${isCheckingOut ? 'btn-loading' : ''}`}
            disabled={!canCheckout}
            onClick={handleCheckout}
          >
            {t('sales:pos.completeSale')}
          </button>
        </div>
      </div>

      <Modal open={scannerOpen} onClose={() => setScannerOpen(false)} title={t('sales:pos.scanBarcodeModalTitle')} size="sm">
        <Suspense fallback={null}>
          {scannerOpen && <QRScanner onScan={handleScan} onError={handleScannerError} />}
        </Suspense>
      </Modal>

      <ConfirmDialog
        open={clearCartConfirmOpen}
        onClose={() => setClearCartConfirmOpen(false)}
        onConfirm={clearCart}
        title={t('sales:pos.clearCartTitle')}
        message={t('sales:pos.clearCartMessage', { count: cart.length })}
        confirmLabel={t('sales:pos.clearCartConfirm')}
      />

      <Modal
        open={quickCustomerOpen}
        onClose={() => setQuickCustomerOpen(false)}
        title={t('sales:pos.quickAddCustomerTitle')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setQuickCustomerOpen(false)}>{t('common:actions.cancel')}</button>
            <button
              type="button"
              className={`btn btn-primary ${savingQuickCustomer ? 'btn-loading' : ''}`}
              disabled={savingQuickCustomer}
              onClick={submitQuickCustomer}
            >
              {t('sales:pos.addAndSelect')}
            </button>
          </>
        }
      >
        {quickCustomerError && <div className="alert alert-danger mb-4" role="alert">{quickCustomerError}</div>}
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="quick-customer-name">{t('sales:pos.fullName')}</label>
          <input
            id="quick-customer-name"
            className="form-control"
            value={quickCustomerName}
            onChange={(e) => setQuickCustomerName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="quick-customer-phone">{t('sales:pos.phoneNumber')}</label>
          <input
            id="quick-customer-phone"
            className="form-control"
            value={quickCustomerPhone}
            onChange={(e) => setQuickCustomerPhone(e.target.value)}
          />
        </div>
      </Modal>

      <Modal open={Boolean(lastSale)} onClose={dismissReceipt} title={t('sales:pos.saleCompleted')} size="sm">
        {lastSale && (
          <div className="pos-receipt-modal-body">
            <FiCheckCircle className="pos-receipt-modal-icon" aria-hidden="true" />
            <div className="pos-receipt-modal-number">{lastSale.sale_number}</div>
            <div className="pos-receipt-modal-total">{formatCurrency(lastSale.total_amount)}</div>
            <div className="pos-receipt-modal-actions">
              <button type="button" className={`btn btn-secondary ${receiptBusy === 'print' ? 'btn-loading' : ''}`} disabled={!!receiptBusy} onClick={handlePrintReceipt}>
                <FiPrinter aria-hidden="true" /> {t('sales:detail.print')}
              </button>
              <button type="button" className={`btn btn-secondary ${receiptBusy === 'download' ? 'btn-loading' : ''}`} disabled={!!receiptBusy} onClick={handleDownloadReceipt}>
                <FiDownload aria-hidden="true" /> {t('sales:detail.downloadPdf')}
              </button>
              <button type="button" className="btn btn-primary" onClick={dismissReceipt}>
                {t('sales:pos.newSale')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default POS;
