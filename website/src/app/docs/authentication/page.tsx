import type { Metadata } from "next";
import Link from "next/link";
import PageHead, { C, Facts, P, Section } from "../page-head";
import CodeBlock from "../code-block";
import Callout from "../callout";

export const metadata: Metadata = {
  title: "Authentication",
  description:
    "Sova API keys are sk-sova-<48 hex>, sent as a bearer token, shown once at issue, and stored only as a SHA-256 fingerprint. Manage keys at /portal/keys.",
};

const KEY_FORMAT = `sk-sova-<48 lowercase hex characters>`;

const BEARER_HEADER = `Authorization: Bearer $SOVA_API_KEY`;

const ERROR_401 = `{
  "error": {
    "message": "Invalid API key.",
    "type": "authentication_error"
  }
}`;

const AUTH_FACTS = [
  "Shown once. The full key is displayed a single time, at issue. Store it in your secret manager immediately.",
  "Fingerprint only. Sova stores a SHA-256 fingerprint of the key, never the plaintext. A lost key cannot be recovered, only replaced.",
  "Safe label. The key id Sova uses in support conversations is the first 8 hex characters of that fingerprint. Sharing it leaks nothing.",
  "Portal. Sign in at /portal with the key itself to see your usage. The portal is read-only: it reports usage and cannot call models.",
];

export default function AuthenticationPage() {
  return (
    <>
      <PageHead
        eyebrow="API reference"
        title="Authentication"
        lead="Requests authenticate with an API key sent as a bearer token. Keys are issued by Sova, and every request is metered against the key that made it."
      />

      <Section id="key-format" title="Key format">
        <P>
          A Sova key is the prefix <C>sk-sova-</C> followed by 48 lowercase hex
          characters. Anything else is rejected.
        </P>
        <CodeBlock lang="text" label="key format" code={KEY_FORMAT} />
      </Section>

      <Section id="bearer-header" title="Send the key">
        <P>
          Put the key in the <C>Authorization</C> header of every request, with
          the <C>Bearer</C> scheme. This applies to <C>/chat/completions</C> and{" "}
          <C>/models</C> alike.
        </P>
        <CodeBlock lang="text" label="authorization header" code={BEARER_HEADER} />
        <Facts items={AUTH_FACTS} />
        <Callout variant="warning" title="A lost key cannot be recovered, only replaced">
          The plaintext key never lives on Sova servers, only its SHA-256
          fingerprint. If you lose it, revoke it and generate a new one.
        </Callout>
      </Section>

      <Section id="failures" title="When authentication fails">
        <P>
          A missing, malformed, or unknown key gets a 401 with the standard
          error envelope. Check that the header reads{" "}
          <C>Bearer sk-sova-...</C> with no trailing whitespace or quotes.
        </P>
        <CodeBlock lang="json" label="401 response body" code={ERROR_401} />
      </Section>

      <Section id="manage" title="Manage your keys">
        <P>
          Keys are issued by Sova: book a call and we mint one for your
          workload. After that, management is self-serve at{" "}
          <Link href="/portal/keys" className="ulink">
            /portal/keys
          </Link>
          : generate additional keys and revoke ones you no longer need.
        </P>
        <P>
          Generating a key shows it once, like every other key. Revoking a key
          stops it from authenticating; your usage history stays with Sova.
        </P>
      </Section>
    </>
  );
}
