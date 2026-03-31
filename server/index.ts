import { env, isAuthConfigured, isDatabaseConfigured } from "../config/env.js";
import { createApp } from "./create-app.js";

const port = env.PORT;
const isProd = env.NODE_ENV === "production";

const app = await createApp();

if (isProd && !isDatabaseConfigured()) {
  console.error("DATABASE_URL is required in production. Set it in the environment or .env.");
  process.exit(1);
}

if (isProd && !isAuthConfigured()) {
  console.error(
    "Auth is required in production: set DATABASE_URL, BETTER_AUTH_SECRET, and BETTER_AUTH_URL.",
  );
  process.exit(1);
}

if (!isProd && !isDatabaseConfigured()) {
  console.warn(
    "DATABASE_URL is not set — auth and admin APIs need Postgres (see .env.example).",
  );
}

const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use (another dev server, or another container).`,
    );
    console.error(`Try: stop the other process, or set PORT=3001 in .env and run again.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
