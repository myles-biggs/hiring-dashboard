/**
 * One-time script to register the Level Hire app as an Asana webhook target.
 * Run with: npx tsx scripts/register-asana-webhook.ts
 *
 * Prerequisites:
 * - .env.local must have ASANA_ACCESS_TOKEN, ASANA_PROJECT_ID, NEXT_PUBLIC_APP_URL set
 * - The app must be publicly accessible at NEXT_PUBLIC_APP_URL (use ngrok for local dev)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const BASE_URL = "https://app.asana.com/api/1.0";
const targetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/asana`;

async function main() {
  console.log(`Registering Asana webhook → ${targetUrl}`);

  const res = await fetch(`${BASE_URL}/webhooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.ASANA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        resource: process.env.ASANA_PROJECT_ID,
        target: targetUrl,
        filters: [
          {
            resource_type: "task",
            action: "changed",
            fields: ["custom_fields"],
          },
        ],
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Failed:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("Webhook registered successfully:");
  console.log(`  GID: ${data.data.gid}`);
  console.log(`  Target: ${data.data.target}`);
  console.log(`  Resource: ${data.data.resource.gid}`);
}

main().catch(console.error);
