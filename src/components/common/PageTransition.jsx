import { Suspense } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import PageSkeleton from './PageSkeleton';

// Drop-in replacement for <Outlet />. The new page mounts immediately and
// fades in with a short, non-blocking CSS animation — there is no exit
// animation to wait for, so navigation never stalls.
//
// The Suspense boundary is load-bearing: AppRouter's lazy() route chunks
// suspend the first time they load. Scoping the boundary here keeps the
// sidebar and top bar mounted while a page chunk downloads, showing a
// skeleton only in the content area.
function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <div key={location.pathname} className="page-enter">
      <Suspense fallback={<PageSkeleton />}>{outlet}</Suspense>
    </div>
  );
}

export default PageTransition;
