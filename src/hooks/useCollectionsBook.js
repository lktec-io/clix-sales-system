import * as loanService from '../services/loanService';
import { useReportLoader } from './useReportLoader';
import { fetchAllPages, toDayKey } from '../utils/reportData';

// Schedules only come with the loan detail endpoint, so the collections
// views load each live loan's detail (capped, a few at a time). Loans that
// finished before `since` cannot have installments in the window and are
// skipped.
const MAX_DETAILS = 120;
const CONCURRENCY = 6;

async function mapLimited(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]).catch(() => null);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function useCollectionsBook(since) {
  return useReportLoader(async () => {
    const { items, truncated } = await fetchAllPages(({ page, limit }) => loanService.listLoans({ page, limit }), { maxPages: 30 });
    const relevant = items.filter((loan) => ['active', 'defaulted'].includes(loan.status)
      || (loan.status === 'completed' && toDayKey(loan.updated_at || loan.disbursed_at) >= since));
    const details = (await mapLimited(relevant.slice(0, MAX_DETAILS), CONCURRENCY, (loan) => loanService.getLoan(loan.id))).filter(Boolean);
    return { loans: details, truncated: truncated || relevant.length > MAX_DETAILS };
  }, [since]);
}

// Repayments recorded from `from` onward (newest-first paging stops early).
export function useRepaymentsSince(from) {
  return useReportLoader(async () => {
    const { items, truncated } = await fetchAllPages(
      ({ page, limit }) => loanService.listRepayments({ page, limit }),
      { isBeforeRange: (row) => toDayKey(row.created_at) < from, maxPages: 30 },
    );
    return { rows: items, truncated };
  }, [from]);
}
