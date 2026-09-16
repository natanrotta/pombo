import { Box } from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";
import { EASE_ORGANIC } from "@/shared/constants/animation";

const MotionBox = motion.create(Box);

/**
 * Cross-fade between routes, keyed by pathname. No route in the app swaps its
 * URL in place (no `/x/new → /x/{id}` flow), so the pathname is a stable key.
 */
export function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <MotionBox
        key={location.pathname}
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
