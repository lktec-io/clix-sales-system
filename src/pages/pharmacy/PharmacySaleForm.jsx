import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiTrash2, FiPlus, FiMinus, FiShoppingCart, FiUserPlus, FiPrinter, FiDownload, FiCheckCircle } from 'react-icons/fi';
import Modal from '../../components/common/Modal';
import SearchInput from '../../components/common/SearchInput';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';
import * as medicineService from '../../services/medicineService';
import * as customerService from '../../services/customerService';
import * as branchService from '../../services/branchService';
import * as pharmacySaleService from '../../services/pharmacySaleService';
import { formatCurrency } from '../../utils/formatCurrency';
import { splitFullName } from '../../utils/splitFullName';
import '../../styles/pages/POS.css';

// Pharmacy's own "New Sale" screen — the cart-based search/select/pay flow
// (spec: OPEN POS -> SEARCH MEDICINE -> SELECT -> QUANTITY -> PAYMENT ->
// COMPLETE SALE), built by adapting Retail POS.jsx's proven pattern rather
// than a from-scratch design. Deliberately leaner than Retail's POS: no
// camera barcode scanner (a heavy dependency most pharmacy counters won't
// use — a typed barcode still works through the same search box, matching
// findSellable()'s exact-barcode-or-name match), no per-line price/discount
// override (not part of the required pharmacy workflow), and only three
// payment choices (Cash / Mobile Money / Card) instead of Retail's four
// groups with M-Pesa/Airtel sub-options. Checkout still posts a plain
// {branchId, customerId, paymentMethod, items:[{medicineId, quantity}]} to
// the existing sellMedicines() endpoint, which does all batch/FEFO/expiry
// handling server-side — the cashier never sees or picks a batch.
const PAYMENT_METHODS = [
  { method: 'cash', labelKey: 'pos.payment.cash' },
  { method: 'mobile_money', labelKey: 'pos.payment.mobileMoney' },
  { method: 'card', labelKey: 'pos.payment.card' },
];

function PharmacySaleForm() {
  const { t } = useTranslation(['pharmacy', 'common']);
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const searchInputRef = useRef(null);
  const isCheckingOutRef = useRef(false);

  const [branchId, setBranchId] = useState(user?.branch_id || '');
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [medicines, setMedicines] = useState([]);
  const [medicinesLoading, setMedicinesLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [cart, setCart] = useState([]);
  const [flashLineId, setFlashLineId] = useState(null);
  const flashTimerRef = useRef(null);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

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

  const anyModalOpen = quickCustomerOpen || Boolean(lastSale);

  useEffect(() => {
    if (!user?.branch_id) branchService.listActiveBranches().then(setBranches);
    customerService.listActiveCustomers().then(setCustomers);
  }, [user]);

  const loadMedicines = useCallback(() => {
    if (!branchId) return;
    setMedicinesLoading(true);
    medicineService
      .listSellableMedicines({ branchId, search: debouncedSearch || undefined })
      .then(setMedicines)
      .finally(() => setMedicinesLoading(false));
  }, [branchId, debouncedSearch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the medicine grid on branch/search change is standard data-fetching, not derived state
    loadMedicines();
  }, [loadMedicines]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new query invalidates whatever result the cashier had arrow-keyed to
    setHighlightedIndex(-1);
  }, [debouncedSearch]);

  const cartLine = (medicineId) => cart.find((line) => line.medicineId === medicineId);

  const triggerFlash = useCallback((medicineId) => {
    clearTimeout(flashTimerRef.current);
    setFlashLineId(medicineId);
    flashTimerRef.current = setTimeout(() => setFlashLineId(null), 450);
  }, []);

  // The one path every add-to-cart trigger goes through — a grid click,
  // an exact-barcode match, or Enter in the search box.
  const addToCart = useCallback((medicine) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.medicineId === medicine.id);
      if (existing) {
        if (existing.quantity >= medicine.available_quantity) return prev;
        return prev.map((line) => (line.medicineId === medicine.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      if (medicine.available_quantity < 1) return prev;
      return [
        ...prev,
        {
          medicineId: medicine.id,
          name: medicine.name,
          unit: medicine.unit,
          unitPrice: Number(medicine.selling_price),
          availableQuantity: medicine.available_quantity,
          quantity: 1,
        },
      ];
    });
    triggerFlash(medicine.id);
    setSearch('');
    setHighlightedIndex(-1);
  }, [triggerFlash]);

  // A typed barcode (or a hardware keyboard-wedge scanner, which types the
  // full code faster than the debounce window) resolves to exactly one
  // medicine whose barcode equals what was typed — an ordinary partial-name
  // search essentially never matches a full barcode by coincidence.
  useEffect(() => {
    const query = debouncedSearch.trim();
    if (!query || medicines.length === 0) return;
    const exact = medicines.find((m) => m.barcode && m.barcode === query);
    if (exact) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a resolved barcode match by updating the cart, not deriving render state
      addToCart(exact);
    }
  }, [medicines, debouncedSearch, addToCart]);

  const setLineQuantity = (line, nextQuantity) => {
    const qty = Math.max(1, Math.min(line.availableQuantity, nextQuantity || 1));
    if (qty > line.quantity) triggerFlash(line.medicineId);
    setCart((prev) => prev.map((l) => (l.medicineId === line.medicineId ? { ...l, quantity: qty } : l)));
  };

  const removeLine = (medicineId) => {
    setCart((prev) => prev.filter((line) => line.medicineId !== medicineId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerId('');
    setPaymentMethod('cash');
  };

  const total = useMemo(() => cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), [cart]);
  const canCheckout = cart.length > 0 && branchId && total > 0 && !isCheckingOut;

  const handleSearchEnter = async () => {
    if (highlightedIndex >= 0 && medicines[highlightedIndex]) {
      addToCart(medicines[highlightedIndex]);
      return;
    }
    const query = search.trim();
    if (!query || !branchId) return;
    try {
      const results = await medicineService.listSellableMedicines({ branchId, search: query });
      const match = results.find((m) => m.barcode === query) || results[0];
      if (match) {
        addToCart(match);
      } else {
        toast.error(t('pharmacy:pos.toast.noMedicineFoundFor', { query }));
      }
    } catch {
      toast.error(t('pharmacy:pos.toast.medicineLookupFailed'));
    }
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, medicines.length - 1));
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

  const submitQuickCustomer = async () => {
    setQuickCustomerError('');
    if (!quickCustomerName.trim() || !quickCustomerPhone.trim()) {
      setQuickCustomerError(t('pharmacy:pos.toast.nameAndPhoneRequired'));
      return;
    }
    setSavingQuickCustomer(true);
    try {
      const { firstName, lastName } = splitFullName(quickCustomerName);
      const created = await customerService.createCustomer({ firstName, lastName, phone: quickCustomerPhone.trim() });
      setCustomers((prev) => [...prev, created]);
      setCustomerId(String(created.id));
      setQuickCustomerOpen(false);
      toast.success(t('pharmacy:pos.toast.customerAddedAndSelected', { name: quickCustomerName.trim() }));
    } catch (err) {
      setQuickCustomerError(err.response?.data?.message || t('pharmacy:pos.toast.failedToAddCustomer'));
    } finally {
      setSavingQuickCustomer(false);
    }
  };

  const handleCheckout = useCallback(async () => {
    if (isCheckingOutRef.current) return;
    if (cart.length === 0 || !branchId || total <= 0) return;
    isCheckingOutRef.current = true;

    setCheckoutError('');
    setIsCheckingOut(true);
    try {
      const payload = {
        branchId: Number(branchId),
        customerId: customerId ? Number(customerId) : undefined,
        paymentMethod,
        items: cart.map((line) => ({ medicineId: line.medicineId, quantity: line.quantity })),
      };
      const sale = await pharmacySaleService.createSale(payload);
      clearCart();
      setLastSale(sale);
    } catch (err) {
      setCheckoutError(err.response?.data?.message || t('pharmacy:pos.toast.checkoutFailed'));
    } finally {
      setIsCheckingOut(false);
      isCheckingOutRef.current = false;
    }
  }, [cart, branchId, customerId, paymentMethod, total, t]);

  // Same convenience auto-dismiss as Retail's POS: closes itself after a
  // short delay so a cashier who doesn't need Print/Download isn't forced
  // to click through for every single sale.
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
      await pharmacySaleService.printReceipt(lastSale.id);
    } catch {
      toast.error(t('pharmacy:pos.toast.failedToOpenReceipt'));
    } finally {
      setReceiptBusy('');
    }
  };

  const handleDownloadReceipt = async () => {
    if (!lastSale) return;
    setReceiptBusy('download');
    try {
      await pharmacySaleService.downloadReceiptPdf(lastSale.id, lastSale.sale_number);
    } catch {
      toast.error(t('pharmacy:pos.toast.failedToDownloadReceipt'));
    } finally {
      setReceiptBusy('');
    }
  };

  // A lean production shortcut set (no F2/F4 scanner shortcuts — there's no
  // camera scanner here): Escape clears search, Enter completes the sale
  // when focus isn't inside a text field.
  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if (anyModalOpen) return;
      const tag = document.activeElement?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (event.key === 'Escape') {
        setSearch('');
        setHighlightedIndex(-1);
        searchInputRef.current?.focus();
        return;
      }
      if (event.key === 'Enter' && !isTyping) {
        event.preventDefault();
        handleCheckout();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [anyModalOpen, handleCheckout]);

  return (
    <div className="pos-page">
      <div className="pos-catalog">
        <div className="pos-catalog-toolbar">
          <div className="pos-catalog-toolbar-row">
            {!user?.branch_id ? (
              <select className="form-control pos-branch-select" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">{t('pharmacy:pos.selectBranchPlaceholder')}</option>
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
              placeholder={t('pharmacy:pos.searchPlaceholder')}
            />
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/pharmacy/sales')}>
              {t('pharmacy:pos.saleHistory')}
            </button>
          </div>
        </div>

        {!branchId ? (
          <div className="pos-scan-empty">{t('pharmacy:pos.selectBranchToView')}</div>
        ) : medicinesLoading ? (
          <div className="flex items-center justify-center p-6"><span className="spinner" aria-label={t('common:state.loading')} /></div>
        ) : (
          <div className="pos-product-grid">
            {medicines.map((medicine, index) => {
              const inCartQty = cartLine(medicine.id)?.quantity || 0;
              const disabled = inCartQty >= medicine.available_quantity;
              return (
                <button
                  key={medicine.id}
                  type="button"
                  className={`pos-product-card ${index === highlightedIndex ? 'pos-product-card-highlighted' : ''}`}
                  onClick={() => addToCart(medicine)}
                  disabled={disabled}
                >
                  <span className="pos-product-name">{medicine.name}</span>
                  <span className="pos-product-code">{medicine.category_name || medicine.unit}</span>
                  <span className="pos-product-price">{formatCurrency(medicine.selling_price)}</span>
                  <span className="pos-product-stock">
                    {t('pharmacy:pos.inStock', { count: medicine.available_quantity, unit: medicine.unit })}
                    {inCartQty ? ` · ${t('pharmacy:pos.inCart', { count: inCartQty })}` : ''}
                  </span>
                </button>
              );
            })}
            {medicines.length === 0 && <div className="pos-scan-empty">{t('pharmacy:pos.noMedicinesFound')}</div>}
          </div>
        )}
      </div>

      <div className="pos-cart">
        <div className="pos-cart-header">
          <span className="card-title">{t('pharmacy:pos.cart', { count: cart.length })}</span>
          {cart.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearCart}>{t('pharmacy:pos.clearCart')}</button>
          )}
        </div>

        <div className="pos-cart-items">
          {cart.length === 0 ? (
            <EmptyState icon={FiShoppingCart} title={t('pharmacy:pos.cartEmptyTitle')} description={t('pharmacy:pos.cartEmptyDescription')} />
          ) : (
            cart.map((line) => {
              const lineTotal = line.quantity * line.unitPrice;
              const isFlashing = flashLineId === line.medicineId;
              return (
                <div className={`pos-cart-line ${isFlashing ? 'pos-cart-line-flash' : ''}`} key={line.medicineId}>
                  <div className="pos-cart-line-top">
                    <span className="pos-cart-line-name">{line.name}</span>
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeLine(line.medicineId)} aria-label={t('pharmacy:pos.removeItemAria', { name: line.name })}>
                      <FiTrash2 />
                    </button>
                  </div>
                  <div className="pos-cart-line-controls">
                    <div className="pos-cart-line-field">
                      <label htmlFor={`qty-${line.medicineId}`}>{t('pharmacy:pos.qty')}</label>
                      <div className="pos-qty-stepper">
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon pos-qty-stepper-btn"
                          onClick={() => setLineQuantity(line, line.quantity - 1)}
                          disabled={line.quantity <= 1}
                          aria-label={t('pharmacy:pos.decreaseQtyAria', { name: line.name })}
                        >
                          <FiMinus />
                        </button>
                        <input
                          id={`qty-${line.medicineId}`}
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
                          aria-label={t('pharmacy:pos.increaseQtyAria', { name: line.name })}
                        >
                          <FiPlus />
                        </button>
                      </div>
                    </div>
                    <span className="pos-cart-line-price">{formatCurrency(line.unitPrice)}</span>
                    <span className="pos-cart-line-total">{formatCurrency(lineTotal)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pos-cart-footer">
          <div className="form-group">
            <div className="flex items-center justify-between">
              <label className="form-label" htmlFor="pharmacy-pos-customer" style={{ margin: 0 }}>{t('pharmacy:pos.customerOptional')}</label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={openQuickCustomer}>
                <FiUserPlus aria-hidden="true" /> {t('pharmacy:pos.quickAdd')}
              </button>
            </div>
            <select id="pharmacy-pos-customer" className="form-control" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">{t('pharmacy:pos.walkInCustomer')}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>

          <div className="pos-totals-row pos-totals-row-total"><span>{t('pharmacy:pos.total')}</span><span>{formatCurrency(total)}</span></div>

          <div>
            <span className="form-label" style={{ margin: 0 }}>{t('pharmacy:pos.paymentMethod')}</span>
            <div className="pos-payment-groups">
              {PAYMENT_METHODS.map((option) => (
                <button
                  key={option.method}
                  type="button"
                  className={`pos-payment-group-btn ${paymentMethod === option.method ? 'pos-payment-group-btn-active' : ''}`}
                  onClick={() => setPaymentMethod(option.method)}
                >
                  {t(`pharmacy:${option.labelKey}`)}
                </button>
              ))}
            </div>
          </div>

          {checkoutError && <div className="alert alert-danger" role="alert">{checkoutError}</div>}

          <button
            type="button"
            className={`btn btn-primary btn-lg ${isCheckingOut ? 'btn-loading' : ''}`}
            disabled={!canCheckout}
            onClick={handleCheckout}
          >
            {t('pharmacy:pos.completeSale')}
          </button>
        </div>
      </div>

      <Modal
        open={quickCustomerOpen}
        onClose={() => setQuickCustomerOpen(false)}
        title={t('pharmacy:pos.quickAddCustomerTitle')}
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
              {t('pharmacy:pos.addAndSelect')}
            </button>
          </>
        }
      >
        {quickCustomerError && <div className="alert alert-danger mb-4" role="alert">{quickCustomerError}</div>}
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="pharmacy-quick-customer-name">{t('pharmacy:pos.fullName')}</label>
          <input id="pharmacy-quick-customer-name" className="form-control" value={quickCustomerName} onChange={(e) => setQuickCustomerName(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="pharmacy-quick-customer-phone">{t('pharmacy:pos.phoneNumber')}</label>
          <input id="pharmacy-quick-customer-phone" className="form-control" value={quickCustomerPhone} onChange={(e) => setQuickCustomerPhone(e.target.value)} />
        </div>
      </Modal>

      <Modal open={Boolean(lastSale)} onClose={dismissReceipt} title={t('pharmacy:pos.saleCompleted')} size="sm">
        {lastSale && (
          <div className="pos-receipt-modal-body">
            <FiCheckCircle className="pos-receipt-modal-icon" aria-hidden="true" />
            <div className="pos-receipt-modal-number">{lastSale.sale_number}</div>
            <div className="pos-receipt-modal-total">{formatCurrency(lastSale.total_amount)}</div>
            <div className="pos-receipt-modal-actions">
              <button type="button" className={`btn btn-secondary ${receiptBusy === 'print' ? 'btn-loading' : ''}`} disabled={!!receiptBusy} onClick={handlePrintReceipt}>
                <FiPrinter aria-hidden="true" /> {t('pharmacy:pos.print')}
              </button>
              <button type="button" className={`btn btn-secondary ${receiptBusy === 'download' ? 'btn-loading' : ''}`} disabled={!!receiptBusy} onClick={handleDownloadReceipt}>
                <FiDownload aria-hidden="true" /> {t('pharmacy:pos.downloadPdf')}
              </button>
              <button type="button" className="btn btn-primary" onClick={dismissReceipt}>
                {t('pharmacy:pos.newSale')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PharmacySaleForm;
