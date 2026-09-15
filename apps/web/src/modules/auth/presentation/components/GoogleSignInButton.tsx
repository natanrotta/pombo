import { GoogleLogin } from "@react-oauth/google";
import { Box } from "@chakra-ui/react";
import { useColorMode } from "@/components/ui/color-mode";
import { useEffect, useRef, useState } from "react";

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => void;
  onError: () => void;
}

// Google Identity Services renders its button inside an iframe that CSS can't
// reach, and only accepts a pixel width (Google caps it at 400px). So we measure
// the container and feed GSI a px width, making the button track the login card
// width responsively instead of rendering at its intrinsic chip size.
const GSI_MAX_WIDTH = 400;

/**
 * Google sign-in button standardized to the login card: follows the app color
 * mode (dark → filled_black, light → outline), spans the card width, and is
 * localized to the active UI language. It still emits the GSI `credential`
 * (id_token JWT) consumed by the existing `POST /auth/google` flow — behavior is
 * unchanged, only the presentation.
 *
 * `useColorMode` here is the deliberate exception to the "no color-mode
 * conditionals" rule: `theme` is the ONLY way to make a third-party GSI widget
 * follow light/dark, and a semantic token can't drive a JS string prop.
 * Toggling the color mode re-renders `GoogleLogin` with a new `theme`, which
 * re-inits the GSI button — that re-init is expected; it's how the button
 * tracks the theme.
 */
export function GoogleSignInButton({
  onSuccess,
  onError,
}: GoogleSignInButtonProps) {
  const { colorMode } = useColorMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () =>
      setWidth(Math.min(Math.round(el.clientWidth), GSI_MAX_WIDTH));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={containerRef}
      data-cy="google-signin"
      w="100%"
      minH="40px"
      display="flex"
      justifyContent="center"
    >
      {/* Render only after the first measurement: GSI needs a real px width
          (it ignores "100%"), and the minH above reserves space so swapping in
          the measured button doesn't shift the layout. */}
      {width > 0 && (
        <GoogleLogin
          onSuccess={(response) => {
            if (response.credential) {
              onSuccess(response.credential);
            }
          }}
          onError={onError}
          theme={colorMode === "dark" ? "filled_black" : "outline"}
          size="large"
          shape="rectangular"
          text="continue_with"
          width={String(width)}
        />
      )}
    </Box>
  );
}
