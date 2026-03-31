import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { env, isAuthConfigured } from "../../config/env.js";
import { account } from "../../schema/account.js";
import { session } from "../../schema/session.js";
import { user } from "../../schema/user.js";
import { verification } from "../../schema/verification.js";
import { getDb } from "../db.js";

function buildTrustedOrigins(): string[] {
  const base = env.BETTER_AUTH_URL!.replace(/\/$/, "");
  const set = new Set<string>([base]);
  if (env.NODE_ENV !== "production") {
    set.add(`http://localhost:${env.PORT}`);
    set.add(`http://127.0.0.1:${env.PORT}`);
  }
  return [...set];
}

let authInstance: unknown = null;

export function getAuth(): ReturnType<typeof betterAuth> | null {
  if (!isAuthConfigured()) return null;
  if (authInstance) return authInstance as ReturnType<typeof betterAuth>;
  const db = getDb();
  if (!db) return null;

  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        }
      : undefined;

  authInstance = betterAuth({
    secret: env.BETTER_AUTH_SECRET!,
    baseURL: env.BETTER_AUTH_URL!,
    trustedOrigins: buildTrustedOrigins(),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
          input: false,
        },
        stripeCustomerId: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          // No real email in dev — open this URL from the terminal output.
          console.warn(
            "\n======== MAGIC LINK (copy into browser) ========\n" +
              `${url}\n` +
              `for: ${email}\n` +
              "==================================================\n",
          );
        },
      }),
    ],
    socialProviders: google ? { google } : {},
  });

  return authInstance as ReturnType<typeof betterAuth>;
}
