import { brand } from "@/config/brand.config";

export const metadata = { title: "Terms of Service" };

const EFFECTIVE = "1 January 2026";

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="!text-white/35 !text-[13px]">Effective {EFFECTIVE}</p>

      <p>
        These terms govern your use of {brand.legalName} (&ldquo;{brand.name}&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using the
        service you agree to them. This is a template intended for adaptation by
        the operator of this deployment; have a lawyer review it before you rely
        on it commercially.
      </p>

      <h2>1. What the service does</h2>
      <p>
        {brand.name} generates application source code from descriptions you
        provide and from public web pages you point it at, and runs that code in
        a temporary sandbox so you can preview it.
      </p>

      <h2>2. Your code is yours</h2>
      <p>
        We claim no ownership over the code {brand.name} generates for you, or
        over the descriptions and other inputs you supply. You may use, modify,
        distribute and sell the generated output without restriction from us and
        without attribution.
      </p>
      <p>
        You are responsible for reviewing generated code before you use it.
        Output produced by language models can contain defects, insecure
        patterns, or material resembling existing works. It is supplied
        <strong> as is</strong>.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to use {brand.name} to:</p>
      <ul>
        <li>Build or distribute unlawful material, malware or tools designed to cause harm.</li>
        <li>
          Reproduce a third party&rsquo;s website, branding or content in a way that
          infringes their rights. The rebuild feature is for sites you own or are
          authorised to copy.
        </li>
        <li>Circumvent plan limits, resell capacity, or automate abusive traffic.</li>
        <li>Attempt to reach systems, networks or data you are not authorised to access.</li>
      </ul>

      <h2>4. Plans, billing and limits</h2>
      <p>
        Paid plans are billed in advance, monthly or annually, and renew
        automatically until cancelled. Usage allowances reset at the start of
        each calendar month and do not carry over. We may change prices with at
        least 30 days&rsquo; notice, effective at your next renewal.
      </p>
      <p>
        Cancel at any time; your plan continues until the end of the period you
        have paid for. Fees already paid are non-refundable except where the law
        requires otherwise.
      </p>

      <h2>5. Third-party services</h2>
      <p>
        {brand.name} passes your inputs to model providers, web extraction
        services and sandbox providers in order to work. Their handling of that
        data is governed by their own terms. See our{" "}
        <a href={brand.urls.privacy}>Privacy Policy</a> for detail.
      </p>

      <h2>6. Availability</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted service
        on any plan without a written service level agreement. Sandboxes are
        temporary by design and are reclaimed after the session limit for your
        plan.
      </p>

      <h2>7. Liability</h2>
      <p>
        To the fullest extent permitted by law, our total liability arising out
        of or relating to the service is limited to the amount you paid us in
        the twelve months before the event giving rise to the claim. We are not
        liable for indirect or consequential loss, including lost profits or
        lost data.
      </p>
      <p>Nothing here excludes liability that cannot lawfully be excluded.</p>

      <h2>8. Termination</h2>
      <p>
        You may close your account at any time. We may suspend or terminate an
        account that breaches these terms, with notice where practicable and
        immediately where the breach causes risk to the service or other users.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms. Material changes will be announced at least
        30 days before they take effect. Continued use after that constitutes
        acceptance.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these terms: <a href={brand.urls.contact}>get in touch</a>.
      </p>
    </>
  );
}
