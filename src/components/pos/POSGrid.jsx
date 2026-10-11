import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { FiChevronUp, FiShoppingCart } from 'react-icons/fi';
import styles from './POSGrid.module.css';

const cx = (...classNames) => classNames.filter(Boolean).join(' ');

// Kept in sync with the 1023.98px breakpoint in POSGrid.module.css.
const COMPACT_QUERY = '(max-width: 1023.98px)';

function subscribeCompact(onChange) {
  const list = window.matchMedia(COMPACT_QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

function useIsCompact() {
  return useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false,
  );
}

// ---------------------------------------------------------------------------
// POSGrid — the split-screen frame every transaction screen shares.
//
//   toolbar      search / scan / branch controls above the catalog
//   catalog      usually a <POSProductGrid>
//   cartHeader   title row of the cart pane (count + clear action)
//   cart         cart lines and checkout footer
//   itemCount    total units in the cart (drives the summary bar)
//   totalLabel   pre-formatted grand total, e.g. "TSh 12,500"
//   pulseKey     bump on every add-to-cart; replays the badge pop
//   sheetOpen / onSheetOpenChange   optional controlled sheet state
// ---------------------------------------------------------------------------

function POSGrid({
  toolbar,
  catalog,
  cartHeader,
  cart,
  itemCount = 0,
  totalLabel = '',
  pulseKey = 0,
  sheetOpen,
  onSheetOpenChange,
  labels = {},
}) {
  const { t } = useTranslation('sales');
  const isCompact = useIsCompact();
  const sheetId = useId();
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = sheetOpen !== undefined;
  const open = isControlled ? sheetOpen : internalOpen;
  const effectiveOpen = isCompact && open;

  const setOpen = (next) => {
    if (!isControlled) setInternalOpen(next);
    onSheetOpenChange?.(next);
  };

  const onSheetOpenChangeRef = useRef(onSheetOpenChange);
  useEffect(() => {
    onSheetOpenChangeRef.current = onSheetOpenChange;
  });

  // Escape collapses the sheet; it never steals the key from an open modal
  // or a field that already handled it.
  useEffect(() => {
    if (!effectiveOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (!isControlled) setInternalOpen(false);
      onSheetOpenChangeRef.current?.(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [effectiveOpen, isControlled]);

  const text = {
    products: labels.products ?? t('pos.productGrid'),
    region: labels.region ?? t('pos.sheet.region'),
    items: labels.items ?? t('pos.sheet.items', { count: itemCount }),
    show: labels.show ?? t('pos.sheet.show'),
    hide: labels.hide ?? t('pos.sheet.hide'),
  };

  return (
    <div className={styles.pos} data-sheet-open={effectiveOpen}>
      <section className={styles.catalog} aria-label={text.products}>
        {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
        <div className={styles.catalogBody}>{catalog}</div>
      </section>

      <aside className={styles.cartPane} aria-label={text.region}>
        <button
          type="button"
          className={styles.sheetBar}
          onClick={() => setOpen(!open)}
          aria-expanded={effectiveOpen}
          aria-controls={sheetId}
          hidden={!isCompact}
        >
          <span className={styles.sheetHandle} aria-hidden="true" />
          <span className={styles.barIcon} aria-hidden="true">
            <FiShoppingCart />
            {itemCount > 0 && (
              <span key={pulseKey} className={styles.barBadge} data-pulse={pulseKey > 0}>
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </span>
          <span className={styles.barMeta}>
            <span className={styles.barCount}>{text.items}</span>
            <span className={styles.barHint}>{effectiveOpen ? text.hide : text.show}</span>
          </span>
          <span className={styles.barTotal}>{totalLabel}</span>
          <FiChevronUp className={styles.barChevron} aria-hidden="true" />
        </button>

        <div id={sheetId} className={styles.sheetBody} inert={isCompact && !open}>
          <div className={styles.sheetClip}>
            <div className={styles.sheetInner}>
              {cartHeader && <div className={styles.cartHeader}>{cartHeader}</div>}
              <div className={styles.cartContent}>{cart}</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product grid + tile
// ---------------------------------------------------------------------------

const DEFAULT_SKELETON_TILES = 12;

export function POSProductGrid({ loading = false, empty = false, emptyMessage, label, skeletonCount = DEFAULT_SKELETON_TILES, children }) {
  if (loading) {
    return (
      <div className={styles.gridWrap} aria-busy="true">
        <div className={styles.grid}>
          {Array.from({ length: skeletonCount }, (_, index) => (
            <div key={index} className={styles.tileSkeleton} aria-hidden="true">
              <span className={cx(styles.shimmer, styles.skName)} />
              <span className={cx(styles.shimmer, styles.skCode)} />
              <span className={cx(styles.shimmer, styles.skPrice)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (empty) {
    return <div className={styles.empty}>{emptyMessage}</div>;
  }

  return (
    <div className={styles.gridWrap}>
      <div className={styles.grid} role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function POSProductTile({
  name,
  code,
  priceLabel,
  stockLabel,
  inCartQty = 0,
  highlighted = false,
  disabled = false,
  onSelect,
}) {
  const tileRef = useRef(null);

  // Keeps the arrow-keyed result visible while the cashier walks the grid
  // from the search box.
  useEffect(() => {
    if (highlighted) tileRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [highlighted]);

  return (
    <button
      ref={tileRef}
      type="button"
      className={styles.tile}
      data-highlighted={highlighted}
      data-in-cart={inCartQty > 0}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className={styles.tileName}>{name}</span>
      {inCartQty > 0 && <span className={styles.tileBadge} aria-hidden="true">{inCartQty}</span>}
      {code && <span className={styles.tileCode}>{code}</span>}
      <span className={styles.tilePrice}>{priceLabel}</span>
      {stockLabel && <span className={styles.tileStock}>{stockLabel}</span>}
    </button>
  );
}

export default POSGrid;
