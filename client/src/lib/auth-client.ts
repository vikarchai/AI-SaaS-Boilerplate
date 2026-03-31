import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

const baseURL =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: { credentials: "include" },
  plugins: [magicLinkClient()],
});
