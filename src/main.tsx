import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import Home from "./app/page";
import { resolveVanityRedirect } from "./utils/vanity-redirect";

const redirect = resolveVanityRedirect(window.location.pathname, import.meta.env.BASE_URL);
if (redirect) {
  window.history.replaceState(null, "", redirect);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Home />
  </StrictMode>
);
