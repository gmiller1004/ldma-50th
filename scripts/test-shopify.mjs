#!/usr/bin/env node
/**
 * Test Shopify product fetch. Run with:
 *   node --env-file=.env.local scripts/test-shopify.mjs
 * Or:   npx dotenv -e .env.local -- node scripts/test-shopify.mjs
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
} catch {
  console.log("Could not load .env.local, using process env");
}

const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const token = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

if (!domain || !token) {
  console.error("Missing NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN or NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN");
  process.exit(1);
}

const endpoint = `https://${domain}/api/2026-01/graphql.json`;
const handles = ["50th-anniversary", "50th anniversary", "membership", "dirtfest", "merch", "all"];

console.log("\n🔍 Testing Shopify connection...\n");
console.log("Store:", domain);

// First, list ALL collections available via Storefront API
console.log("\n--- Published collections (Storefront API) ---");
try {
  const listRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({
      query: `{
        collections(first: 20) {
          edges {
            node {
              id
              handle
              title
              products(first: 5) {
                edges { node { title } }
              }
            }
          }
        }
      }`,
    }),
  });
  const listData = await listRes.json();
  const collections = listData?.data?.collections?.edges ?? [];
  if (collections.length === 0) {
    console.log("No collections returned. They may need to be published to the Online Store sales channel.");
  } else {
    collections.forEach(({ node }) => {
      const count = node.products?.edges?.length ?? 0;
      const productTitles = (node.products?.edges ?? []).map((e) => e.node.title);
      console.log(`  • handle: "${node.handle}" | title: "${node.title}" | products: ${productTitles.join(", ") || "(none)"}`);
    });
  }
} catch (e) {
  console.log("Error listing collections:", e.message);
}

// Also check if we can get products directly (fallback in getFeaturedProducts)
console.log("\n--- Products (direct query, fallback) ---");
try {
  const prodRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({
      query: `{ products(first: 10) { edges { node { id title handle } } } }`,
    }),
  });
  const prodData = await prodRes.json();
  const products = prodData?.data?.products?.edges ?? [];
  if (products.length === 0) {
    console.log("No products returned either. Store may need products published to the Storefront API sales channel.");
  } else {
    products.forEach(({ node }) => console.log(`  • ${node.title} (${node.handle})`));
  }
} catch (e) {
  console.log("Error:", e.message);
}

console.log("\n--- Checking expected collection handles ---\n");

for (const handle of handles) {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({
        query: `query($handle: String!) {
          collection(handle: $handle) {
            id
            title
            handle
            products(first: 5) {
              edges {
                node {
                  id
                  title
                  handle
                  featuredImage { url }
                  variants(first: 1) {
                    edges { node { id price { amount currencyCode } } }
                  }
                }
              }
            }
          }
        }`,
        variables: { handle },
      }),
    });

    const data = await res.json();
    const col = data?.data?.collection;

    if (col) {
      const count = col.products?.edges?.length ?? 0;
      const products = (col.products?.edges ?? []).map((e) => e.node.title);
      console.log(`✅ "${handle}"`);
      console.log(`   Collection: ${col.title} (${count} product${count !== 1 ? "s" : ""})`);
      if (products.length) products.forEach((p) => console.log(`   - ${p}`));
      console.log("");
    } else {
      const err = data?.errors?.[0]?.message ?? "Not found";
      console.log(`❌ "${handle}" - ${err}\n`);
    }
  } catch (e) {
    console.log(`❌ "${handle}" - ${e.message}\n`);
  }
}

console.log("---");
console.log("First matching collection will be used for Merch Spotlight on the homepage.\n");
