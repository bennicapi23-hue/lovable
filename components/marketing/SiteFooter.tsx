import Link from "next/link";
import KilnMark from "@/components/brand/KilnMark";
import { KilnWordmark } from "@/components/brand/KilnLogo";
import { brand } from "@/config/brand.config";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Start building", href: "/create" },
      { label: "Studio", href: "/generation" },
      { label: "Pricing", href: "/pricing" },
      { label: "Capabilities", href: "/#capabilities" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact", href: brand.urls.contact },
      { label: "Sales", href: brand.urls.sales },
      { label: "Security", href: brand.urls.security },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: brand.urls.terms },
      { label: "Privacy", href: brand.urls.privacy },
      { label: "Licences", href: "/legal/licences" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-kiln-obsidian">
      <div className="mx-auto max-w-[1160px] px-24 py-56">
        <div className="grid gap-40 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <span className="inline-flex items-center gap-9 text-white">
              <KilnMark className="w-24 h-24" variant="gradient" title={brand.name} />
              <KilnWordmark className="text-[19px]" />
            </span>
            <p className="mt-14 text-[13.5px] leading-[1.6] text-white/45 max-w-[34ch]">
              {brand.promise}
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="text-[12px] uppercase tracking-[0.08em] text-white/35 mb-14">
                {col.title}
              </h2>
              <ul className="space-y-10">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13.5px] text-white/55 hover:text-white transition-colors duration-140"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-48 pt-24 border-t border-white/8 flex flex-wrap items-center justify-between gap-12">
          <p className="text-[12.5px] text-white/35">
            © {brand.company.year} {brand.company.name}. All rights reserved.
          </p>
          <p className="text-[12.5px] text-white/30">
            Web extraction by Firecrawl · Sandboxes by Vercel and E2B
          </p>
        </div>
      </div>
    </footer>
  );
}
