/**
 * Test Salesforce OAuth token - loads .env.local and calls token endpoint.
 * Supports Client Credentials (default) and Password flow.
 * Run: node scripts/test-sf-token.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local (simple parser, no dependencies)
const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const eq = line.indexOf("=");
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return [key, val];
    })
);

const clientId = env.SALESFORCE_CLIENT_ID;
const clientSecret = env.SALESFORCE_CLIENT_SECRET;
const authMethod = env.SALESFORCE_AUTH_METHOD || "client_credentials";
const domain = env.SALESFORCE_DOMAIN || "login.salesforce.com";

console.log("Env check:", {
  hasClientId: !!clientId,
  hasClientSecret: !!clientSecret,
  authMethod,
  domain,
});

const url = `https://${domain}/services/oauth2/token`;

let body;
if (authMethod === "client_credentials") {
  body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  console.log("Using Client Credentials flow (no username/password)");
} else {
  const username = env.SALESFORCE_USERNAME;
  const password = env.SALESFORCE_PASSWORD;
  const securityToken = env.SALESFORCE_SECURITY_TOKEN;
  const passwordWithToken = securityToken ? `${password}${securityToken}` : password;
  body = new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    client_secret: clientSecret,
    username,
    password: passwordWithToken,
  });
  console.log("Using Password flow");
}

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: body.toString(),
});

const data = await res.json();
console.log("\nStatus:", res.status);
console.log("Response:", JSON.stringify(data, null, 2));
