"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import KilnLogo from "@/components/brand/KilnLogo";
import { cn } from "@/utils/cn";

const NAV = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Capabilities", href: "/#capabilities" },
  { label: "Pricing", href: "/pricing" },
];

/**
 * Marketing header. Transparent over the hero, then a solid bar once the
 * page scrolls, so the logo never sits on top of moving content.
 */
export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-colors duration-240",
        scrolled
          ? "bg-kiln-obsidian/85 backdrop-blur-xl border-b border-white/8"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="mx-auto max-w-[1160px] px-24 h-68 flex items-center justify-between gap-24">
        <span className="text-white">
          <KilnLogo markClassName="w-24 h-24" variant="gradient" />
        </span>

        <nav className="hidden md:flex items-center gap-28" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[14px] text-white/55 hover:text-white transition-colors duration-140"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-12">
          <Link
            href="/generation"
            className="text-[14px] text-white/55 hover:text-white transition-colors duration-140"
          >
            Open studio
          </Link>
          <Link
            href="/create"
            className="inline-flex items-center h-38 px-18 rounded-full bg-white text-kiln-obsidian text-[14px] font-medium hover:bg-white/90 transition-colors duration-140"
          >
            Start building
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden text-white/70 hover:text-white p-8 -mr-8"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="w-20 h-20" /> : <Menu className="w-20 h-20" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/8 bg-kiln-obsidian/95 backdrop-blur-xl">
          <nav className="px-24 py-16 flex flex-col gap-4" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="py-10 text-[15px] text-white/70 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/create"
              onClick={() => setOpen(false)}
              className="mt-8 inline-flex items-center justify-center h-44 rounded-full bg-white text-kiln-obsidian text-[15px] font-medium"
            >
              Start building
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
