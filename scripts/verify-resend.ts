/**
 * Verify Resend API key and domain setup.
 * Run from project root. Key must be in .env.local as RESEND_API_KEY (never paste the key in chat).
 *
 *   pnpm exec tsx scripts/verify-resend.ts
 *
 * Uses Resend's test recipient so no real email is sent. Only prints success/failure.
 */
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY?.trim();
const emailFrom = process.env.EMAIL_FROM ?? "noreply@techivano.com";

async function main() {
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set. Add it to .env.local and run again.");
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  // Resend test address – no real email sent, validates key and from domain
  const { data, error } = await resend.emails.send({
    from: `Techivano EAM <${emailFrom}>`,
    to: ["delivered@resend.dev"],
    subject: "Techivano EAM – Resend verification",
    html: "<p>Resend is configured correctly for Techivano EAM.</p>",
  });

  if (error) {
    console.error("Resend verification failed:", error.message);
    if (error.message?.toLowerCase().includes("domain")) {
      console.error("→ Verify your domain at https://resend.com/domains and use that domain in EMAIL_FROM.");
    }
    process.exit(1);
  }

  console.log("Resend verified successfully. Email ID:", data?.id ?? "ok");
}

main();
