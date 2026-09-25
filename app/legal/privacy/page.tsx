import { brand } from "@/config/brand.config";

export const metadata = { title: "Privacy Policy" };

const EFFECTIVE = "1 January 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="!text-white/35 !text-[13px]">Effective {EFFECTIVE}</p>

      <p>
        This policy explains what {brand.legalName} collects, why, and who else
        sees it. It is a template intended for adaptation by the operator of
        this deployment; have it reviewed before you rely on it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — email address, and billing details held
          by our payment processor. We do not store card numbers.
        </li>
        <li>
          <strong>Your inputs</strong> — the descriptions you write, the URLs you
          submit, and the chat messages you send while editing a build.
        </li>
        <li>
          <strong>Generated output</strong> — the blueprints and source files
          produced for you.
        </li>
        <li>
          <strong>Operational data</strong> — timestamps, build counts, error
          reports and IP address, used to run the service, enforce plan limits
          and prevent abuse.
        </li>
      </ul>

      <h2>Who it is shared with</h2>
      <p>
        To generate an application we necessarily send your inputs to third
        parties:
      </p>
      <ul>
        <li>
          <strong>Model providers</strong> (OpenAI, Anthropic, Google, Groq, or a
          gateway of your choosing) receive your descriptions and the relevant
          code context.
        </li>
        <li>
          <strong>Firecrawl</strong> receives any URL you ask us to rebuild, in
          order to fetch and extract that page.
        </li>
        <li>
          <strong>Sandbox providers</strong> (Vercel or E2B) receive the generated
          files in order to run them.
        </li>
      </ul>
      <p>
        We do not sell personal data, and we do not share it for advertising.
      </p>

      <h2>Training</h2>
      <p>
        We do not use your inputs or generated output to train models. Model
        providers have their own policies; on plans that support your own API
        keys, your traffic runs under your provider agreement rather than ours.
      </p>

      <h2>Retention</h2>
      <p>
        Projects are retained according to the history limit of your plan.
        Sandboxes and their contents are destroyed when the session ends.
        Operational logs are kept for up to 90 days. Deleting your account
        removes your projects and personal data within 30 days, except where we
        must retain records for legal or accounting reasons.
      </p>

      <h2>Your rights</h2>
      <p>
        If you are in the EEA or the UK you may request access to, correction
        of, export of, or deletion of your personal data, and you may object to
        processing. Write to <a href={brand.urls.contact}>us</a> and we will
        respond within 30 days. You may also complain to your local data
        protection authority.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit. Access to production systems is limited to
        staff who need it. Report a vulnerability to{" "}
        <a href={brand.urls.security}>our security contact</a> — we will
        acknowledge within two working days.
      </p>

      <h2>Cookies</h2>
      <p>
        We use cookies that are necessary to keep you signed in and to remember
        your preferences. We do not use advertising cookies.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions: <a href={brand.urls.contact}>get in touch</a>.
      </p>
    </>
  );
}
