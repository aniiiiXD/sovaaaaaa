/**
 * Shared shape for the contact form action. Kept out of the "use server"
 * module because every export there must be an async function.
 */
export type InquiryState = {
  status: "idle" | "ok" | "error";
  message: string;
};

export const initialInquiryState: InquiryState = {
  status: "idle",
  message: "",
};
