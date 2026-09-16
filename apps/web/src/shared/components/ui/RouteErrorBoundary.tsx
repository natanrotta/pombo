import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Button, Flex, Icon, Text } from "@chakra-ui/react";
import { FiAlertTriangle, FiRefreshCw } from "@/shared/components/icons";
import { reportRenderError } from "@/shared/lib/error-reporter";
import { isChunkLoadError } from "@/shared/utils/chunkError";
import { reloadForStaleChunk } from "@/shared/utils/chunkReload";
import i18n from "@/shared/i18n";

interface Props {
  children: ReactNode;
  locationKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("RouteErrorBoundary caught:", error, info.componentStack);
    }
    // Last-resort auto-heal: if a stale-chunk error reached the boundary (it
    // slipped past `lazyWithRetry` — e.g. a chunk imported by a non-lazy child),
    // reload once. The shared, debounced guard keeps this from looping with the
    // other recovery paths; if it's suppressed, the dead screen below is shown
    // and the user can still force a reload with "Tentar novamente".
    if (isChunkLoadError(error)) {
      reloadForStaleChunk();
      return;
    }
    // Every authenticated page renders inside this boundary, so it — not the
    // global one — is where real page crashes land. Report them.
    reportRenderError(error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.locationKey !== this.props.locationKey &&
      this.state.hasError
    ) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    // A stale-chunk failure can only be cleared by a full reload: the browser
    // memoizes the rejected `import()`, so a soft reset just re-renders into the
    // same failed import. `lazyWithRetry` already auto-reloads once; reaching
    // here means that didn't recover, so let the user force a fresh reload (by
    // now the dev server may have finished re-optimizing).
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Flex direction="column" align="center" justify="center" py={20} px={4}>
          <Box
            bg="bg.surface"
            borderRadius="xl"
            boxShadow="sm"
            p={8}
            textAlign="center"
            maxW="md"
            w="full"
          >
            <Icon boxSize={10} color="purple.500" mb={4}>
              <FiAlertTriangle />
            </Icon>
            <Text fontSize="lg" fontWeight="600" color="text.primary" mb={2}>
              {i18n.t("common:errors.pageLoadError")}
            </Text>
            <Text fontSize="sm" color="text.secondary" mb={6}>
              {i18n.t("common:errors.pageLoadDescription")}
            </Text>
            <Flex gap={3} justify="center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.history.back()}
              >
                {i18n.t("common:actions.back")}
              </Button>
              <Button size="sm" colorPalette="brand" onClick={this.handleRetry}>
                <Icon>
                  <FiRefreshCw />
                </Icon>
                {i18n.t("common:actions.retry")}
              </Button>
            </Flex>
          </Box>
        </Flex>
      );
    }

    return this.props.children;
  }
}
