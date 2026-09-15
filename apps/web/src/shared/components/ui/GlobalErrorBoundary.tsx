import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Button, Container, Flex, Heading, Text } from "@chakra-ui/react";
import { errorReporter } from "@/shared/lib/error-reporter";
import { isChunkLoadError } from "@/shared/utils/chunkError";
import { reloadForStaleChunk } from "@/shared/utils/chunkReload";
import i18n from "@/shared/i18n";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("GlobalErrorBoundary caught:", error, info.componentStack);
    }
    // Public routes have no RouteErrorBoundary, so stale-chunk failures land
    // here. They are deploy/dev-cache rotation noise, not app bugs: auto-heal
    // with the shared guarded reload and keep them out of Bugsnag.
    if (isChunkLoadError(error)) {
      reloadForStaleChunk();
      return;
    }
    errorReporter.notify(error, (event) => {
      // A React tree crash is unambiguously an error. Bugsnag defaults handled
      // notifications to "warning", so set it explicitly for correct triage.
      event.severity = "error";
      event.addMetadata("react", { componentStack: info.componentStack });
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Flex
          minH="100vh"
          align="center"
          justify="center"
          bg="bg.canvas"
          px={4}
        >
          <Container maxW="md">
            <Box
              bg="bg.surface"
              borderRadius="2xl"
              boxShadow="shadow.lg"
              p={{ base: 6, md: 10 }}
              textAlign="center"
            >
              <Heading size="lg" mb={3} color="text.primary">
                {i18n.t("common:errors.somethingWentWrong")}
              </Heading>
              <Text color="text.secondary" mb={6}>
                {i18n.t("common:errors.reloadDescription")}
              </Text>
              <Button colorPalette="brand" onClick={this.handleReload}>
                {i18n.t("common:actions.reload")}
              </Button>
            </Box>
          </Container>
        </Flex>
      );
    }

    return this.props.children;
  }
}
