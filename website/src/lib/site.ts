export const BOOKING_URL = "https://cal.com/aniruddh-sharma-rygvji/30min";

// Product services remain on their existing deployment during the landing rebrand.
export const PRODUCT_ORIGIN = "https://sova-native.vercel.app";

/**
 * Public contact email for mailto links (careers, about, footer).
 * Set NEXT_PUBLIC_CONTACT_EMAIL in .env.local / Vercel; until then the
 * placeholder shows. The contact form separately delivers via Resend to
 * CONTACT_TO_EMAIL (server-side only).
 */
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@sova.example";

export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;
