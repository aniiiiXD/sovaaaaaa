"use server";

import { Resend } from "resend";

import type { InquiryState } from "@/lib/inquiry";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Keeps a pasted-in wall of text from becoming the whole email body. */
const MAX_NOTE = 4000;

export async function sendInquiry(
  _prev: InquiryState,
  formData: FormData,
): Promise<InquiryState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, MAX_NOTE);

  if (!name) {
    return { status: "error", message: "Your name, please." };
  }
  if (!EMAIL.test(email)) {
    return { status: "error", message: "That doesn't look like an email." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL ?? process.env.NOTIFICATION_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL ?? "Clove <onboarding@resend.dev>";

  if (!apiKey || !to) {
    console.error("Contact: email delivery is not configured.");
    return { status: "error", message: "The form is offline. Email us instead." };
  }

  const { error } = await new Resend(apiKey).emails.send({
    from,
    to,
    // So hitting reply in the inbox goes straight back to the sender.
    replyTo: email,
    subject: `Clove enquiry — ${name}`,
    text: [
      `Name:  ${name}`,
      `Email: ${email}`,
      "",
      note || "(no message)",
    ].join("\n"),
  });

  if (error) {
    console.error("Contact: Resend rejected the send.", error);
    return { status: "error", message: "Couldn't send that. Try again." };
  }

  return { status: "ok", message: "Got it — we'll reply within a day." };
}
