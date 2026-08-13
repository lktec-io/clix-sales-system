// Per-business demo-preview content — Part 6/7's "short product demo"
// requirement, built as data, not six bespoke components. Each business
// gets exactly 5 scenes matching its real workflow (the master prompt
// specifies the sequence for each), each scene assigned one of 5 shared
// visual "shapes" DemoPreview.jsx knows how to render:
//   dashboard   — two stat tiles + a small trend line
//   catalog     — a highlighted item card (product/medicine/menu item/...)
//   detail      — a short 2-3 line info panel revealing line by line
//   transaction — a "processing -> success" badge
//   result      — a completed-summary line with a counted-up number
//
// Every value below is clearly synthetic demo data (round numbers, a
// generic "Demo Customer"/"Sample Product" name) — never presented as a
// real tenant's data, per the explicit "must not pretend to be real
// customer data" requirement. Captions are i18n keys
// (landing:demoPreview.<slug>.scenes.<n>.caption) so the visible text is
// translated; the numeric/label values here are display-only fragments,
// not full sentences, so they're kept inline rather than duplicated into
// i18n (matching how KPI labels elsewhere in the app already mix a
// translated label with a raw formatted number).
export const BUSINESS_DEMO_SCENES = {
  'retail-store': [
    { shape: 'dashboard', stats: [{ value: '128', label: 'Sales Today' }, { value: '42', label: 'Products' }] },
    { shape: 'catalog', icon: 'FiPackage', title: 'Sample Product', meta: 'SKU-1042' },
    { shape: 'detail', rows: [{ label: 'Stock', value: '+25 units' }, { label: 'Branch', value: 'Main Store' }] },
    { shape: 'transaction', label: 'Sale' },
    { shape: 'result', amount: '45,000', unit: 'TZS', label: 'Receipt Total' },
  ],
  pharmacy: [
    { shape: 'catalog', icon: 'FiPlusSquare', title: 'Sample Medicine', meta: 'Batch #204' },
    { shape: 'detail', rows: [{ label: 'Expiry', value: '12 months left' }, { label: 'Stock', value: '86 units' }] },
    { shape: 'dashboard', stats: [{ value: '3', label: 'Expiring Soon' }, { value: '212', label: 'In Stock' }] },
    { shape: 'transaction', label: 'Dispense' },
    { shape: 'result', amount: '18,500', unit: 'TZS', label: 'Sale Completed' },
  ],
  restaurant: [
    { shape: 'dashboard', stats: [{ value: '14', label: 'Active Orders' }, { value: '6', label: 'Tables Occupied' }] },
    { shape: 'catalog', icon: 'FiCoffee', title: 'Sample Menu Item', meta: 'Main Course' },
    { shape: 'detail', rows: [{ label: 'Table', value: 'Table 5' }, { label: 'Status', value: 'Preparing' }] },
    { shape: 'transaction', label: 'Order' },
    { shape: 'result', amount: '32,000', unit: 'TZS', label: 'Order Total' },
  ],
  microfinance: [
    { shape: 'dashboard', stats: [{ value: '58', label: 'Active Loans' }, { value: '96%', label: 'Repayment Rate' }] },
    { shape: 'catalog', icon: 'FiUser', title: 'Demo Borrower', meta: 'Group A' },
    { shape: 'detail', rows: [{ label: 'Loan Amount', value: '500,000 TZS' }, { label: 'Term', value: '6 months' }] },
    { shape: 'transaction', label: 'Repayment' },
    { shape: 'result', amount: '75,000', unit: 'TZS', label: 'Repaid Today' },
  ],
  'cosmetics-shop': [
    { shape: 'catalog', icon: 'FiDroplet', title: 'Sample Beauty Product', meta: 'Skincare' },
    { shape: 'detail', rows: [{ label: 'Category', value: 'Perfumes' }, { label: 'Stock', value: '34 units' }] },
    { shape: 'dashboard', stats: [{ value: '19', label: 'Best Sellers' }, { value: '210', label: 'Products' }] },
    { shape: 'transaction', label: 'Sale' },
    { shape: 'result', amount: '28,000', unit: 'TZS', label: 'Order Complete' },
  ],
  'electronics-shop': [
    { shape: 'catalog', icon: 'FiSmartphone', title: 'Demo Customer', meta: 'iPhone 12 · Cracked Screen' },
    { shape: 'detail', rows: [{ label: 'Condition', value: 'Screen: Cracked' }, { label: 'Diagnosis', value: 'Display replacement' }] },
    { shape: 'dashboard', stats: [{ value: '9', label: 'In Repair' }, { value: '4', label: 'Ready for Pickup' }] },
    { shape: 'transaction', label: 'Repair' },
    { shape: 'result', amount: 'Ready', unit: '', label: 'For Collection' },
  ],
};
