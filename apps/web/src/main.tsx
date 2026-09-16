import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { initErrorReporter } from "./shared/lib/error-reporter";
import { installStaleChunkReloadListener } from "./shared/utils/chunkReload";
// IBM Plex, bundled instead of fetched: the design leans on the exact type, so
// it must not depend on a third-party request in the critical path.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./shared/i18n";
import { App } from "./app/App";

initErrorReporter();
// Self-heal a stale chunk graph (a new deploy in prod / a Vite re-optimize in
// dev) by reloading once when a dynamic import fails outside a lazy boundary.
installStaleChunkReloadListener();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
