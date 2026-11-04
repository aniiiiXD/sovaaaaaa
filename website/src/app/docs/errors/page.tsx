import type { Metadata } from "next";
import Link from "next/link";
import PageHead, { C, Facts, P, Section } from "../page-head";
import CodeBlock from "../code-block";
import DocsTable from "../docs-table";
import Callout from "../callout";

export const metadata: Metadata = {
  title: "Errors",
  description:
    "Every Sova API error uses one envelope with message and type. Status codes 400 through 504, what each honestly means, and when to retry.",
};

const ENVELOPE = `{
  "error": {
    "message": "Unsupported request field. See the Sova inference API documentation.",
    "type": "api_error"
  }
}`;

const ERROR_ROWS: [string, string, string][] = [
  ["400", "api_error", "The request failed validation: an unsupported field, a bad message shape, or a limit exceeded. The serving backend can also return 400 when it rejects a request that passed local validation."],
  ["401", "authentication_error", "The Authorization header is missing, malformed, or does not match an issued key."],
  ["413", "api_error", "The request body exceeds 128 KiB."],
  ["415", "api_error", "Content-Type is not application/json."],
  ["422", "api_error", "The serving backend rejected the request. Check message length and token limits."],
  ["429", "api_error", "Too many active requests. Admission control allows 4 concurrent inference requests per serving instance. This is per-instance admission control, not a published per-key rate limit."],
  ["502", "api_error", "The inference provider request failed or returned an invalid response."],
  ["503", "api_error", "Inference is not enabled, or the model is starting or unavailable. Retry shortly."],
  ["504", "api_error", "The request exceeded the 240 second limit and was aborted."],
];

const RETRY_FACTS = [
  "400, 413, 415, 422: fix the request first. The message says what to change; retrying unchanged will fail again.",
  "429: back off and retry. The active request count drops as in-flight calls finish.",
  "503 and 504: retry shortly with the same body.",
  "Every error response carries an X-Request-Id header. Quote it when reporting a failed call to Sova.",
];

export default function ErrorsPage() {
  return (
    <>
      <PageHead
        eyebrow="Resources"
        title="Errors"
        lead={
          <>
            Every error uses the same envelope: an <C>error</C> object with{" "}
            <C>message</C> and <C>type</C>. The type is{" "}
            <C>authentication_error</C> for 401 and <C>api_error</C> for
            everything else.
          </>
        }
      />

      <Section id="envelope" title="The envelope">
        <CodeBlock lang="json" label="error envelope" code={ENVELOPE} />
        <P>
          Messages describe what to fix and never echo prompt text. Provider
          diagnostics are not forwarded.
        </P>
      </Section>

      <Section id="statuses" title="Statuses">
        <DocsTable head={["Status", "Type", "When"]} rows={ERROR_ROWS} mono={[0, 1]} />
        <Callout variant="warning" title="429 is admission control, not a quota">
          The serving instance admits 4 concurrent inference requests. That is
          per-instance capacity, not a published per-key rate limit; see{" "}
          <Link href="/docs/limits" className="ulink">
            Limits
          </Link>
          .
        </Callout>
      </Section>

      <Section id="retry" title="Retry guidance">
        <Facts items={RETRY_FACTS} />
      </Section>
    </>
  );
}
