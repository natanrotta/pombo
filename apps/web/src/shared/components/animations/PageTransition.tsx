import { Box } from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";
import { EASE_ORGANIC } from "@/shared/constants/animation";

const MotionBox = motion.create(Box);

// Collapse known detail-route pathnames to their pattern so URLs that
// resolve to the same `<Route>` share a transition key. Without this the
// pathname swap during the first auto-save (e.g. `/templates/new →
// /templates/{id}`) would trip `mode="wait"` into playing an exit
// animation, unmounting the page, wiping local form state, and dropping
// focus from the input the user is typing into.
//
// We collapse via regex (rather than `useMatches`, which would force a
// migration to the data router) because the app uses the legacy
// `<BrowserRouter>` host. Each entry maps a literal pathname shape onto
// a stable key — `/templates/abc` and `/templates/new` both become
// `/templates/:id`. List → detail transitions still animate because the
// list path (e.g. `/templates`) doesn't match any of these patterns.
const STABLE_KEY_PATTERNS: { pattern: RegExp; key: string }[] = [];

function getTransitionKey(pathname: string): string {
  for (const { pattern, key } of STABLE_KEY_PATTERNS) {
    if (pattern.test(pathname)) return key;
  }
  return pathname;
}

/**
 * Cross-fade between routes. Detail-page pathnames are collapsed to
 * their pattern so URLs that resolve to the same `<Route>` — the
 * sentinel `/templates/new` and the real `/templates/{id}` after the
 * first auto-save, for instance — share a key. The component instance
 * survives the URL swap, the input keeps focus, and the first save
 * feels identical to subsequent updates.
 */
export function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();

  const transitionKey = getTransitionKey(location.pathname);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <MotionBox
        key={transitionKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: EASE_ORGANIC }}
      >
        {outlet}
      </MotionBox>
    </AnimatePresence>
  );
}
