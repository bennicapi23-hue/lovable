import { brand } from "@/config/brand.config";

export const metadata = { title: "Licences and attribution" };

const SERVICES = [
  {
    name: "Firecrawl",
    role: "Web page extraction for the rebuild-from-URL feature",
    url: "https://firecrawl.dev",
  },
  {
    name: "Vercel Sandbox / E2B",
    role: "Ephemeral sandboxes that run each generated application",
    url: "https://vercel.com",
  },
  {
    name: "OpenAI, Anthropic, Google, Groq",
    role: "Language models used for planning and code generation",
    url: "https://platform.openai.com",
  },
];

export default function LicencesPage() {
  return (
    <>
      <h1>Licences and attribution</h1>
      <p className="!text-white/35 !text-[13px]">
        What {brand.name} is built on, and who gets credit for it.
      </p>

      <h2>Upstream project</h2>
      <p>
        {brand.legalName} began as a derivative of{" "}
        <a
          href="https://github.com/firecrawl/open-lovable"
          target="_blank"
          rel="noreferrer noopener"
        >
          open-lovable
        </a>
        , created by Firecrawl and its contributors and released under the MIT
        Licence. That licence permits commercial use, modification and
        distribution provided the original copyright and permission notices are
        retained, and they are — in full, in the <code>LICENSE</code> and{" "}
        <code>NOTICE</code> files of this repository.
      </p>
      <p>
        {brand.name} is not affiliated with, endorsed by or sponsored by
        Firecrawl. Firecrawl is named here to satisfy that attribution
        requirement, and because it is the extraction API this software calls
        when you ask it to rebuild a page.
      </p>

      <h2>Our own licence</h2>
      <p>
        The {brand.name} source is distributed under the MIT Licence. The
        commercial product is the hosted service — the infrastructure, the
        sandboxes, the model capacity and the support that come with a plan.
      </p>

      <h2>Services we call</h2>
      <ul>
        {SERVICES.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong> — {s.role}.{" "}
            <a href={s.url} target="_blank" rel="noreferrer noopener">
              {s.url.replace(/^https?:\/\//, "")}
            </a>
          </li>
        ))}
      </ul>

      <h2>Open-source dependencies</h2>
      <p>
        This product bundles packages from the npm ecosystem, each under its own
        licence — predominantly MIT, ISC and Apache-2.0. Run{" "}
        <code>pnpm licenses list</code> against an installed tree for the
        complete, resolved list including versions.
      </p>

      <h2>Generated code</h2>
      <p>
        Code that {brand.name} generates for you is yours. We claim no rights
        over it and require no attribution. See the{" "}
        <a href={brand.urls.terms}>Terms of Service</a> for the full position.
      </p>
    </>
  );
}
