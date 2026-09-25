"use client";

import copy from "copy-to-clipboard";
import { cubicBezier } from "motion";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import KilnMark from "@/components/brand/KilnMark";
import { KilnWordmark } from "@/components/brand/KilnLogo";
import { useHeaderContext } from "@/components/shared/header/HeaderContext";
import { brand } from "@/config/brand.config";
import { cn } from "@/utils/cn";

import Download from "./_svg/Download";
import Guidelines from "./_svg/Guidelines";
import Icon from "./_svg/Icon";

/** The mark, as a standalone file. Kept here so "copy" and "download" agree. */
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <defs>
    <linearGradient id="chamber" x1="12" y1="22" x2="12" y2="11" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4f35db"/>
      <stop offset="52%" stop-color="#6244f5"/>
      <stop offset="86%" stop-color="#a996f9"/>
      <stop offset="100%" stop-color="#f2b441"/>
    </linearGradient>
  </defs>
  <path d="M3 21V12a9 9 0 0 1 18 0v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" fill="#0b0b12"/>
  <path d="M8.5 22v-9.5a3.5 3.5 0 0 1 7 0V22Z" fill="url(#chamber)"/>
</svg>`;

export default function HeaderBrandKit() {
  const [open, setOpen] = useState(false);
  const { dropdownContent, clearDropdown } = useHeaderContext();

  useEffect(() => {
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    if (dropdownContent) setOpen(false);
  }, [dropdownContent]);

  return (
    <div className="relative">
      <Link
        className="flex items-center gap-8 relative brand-kit-menu"
        href="/"
        aria-label={`${brand.name} home`}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(!open);
          if (!open) clearDropdown(true);
        }}
      >
        <KilnMark className="size-24" variant="gradient" />
        <KilnWordmark className="text-[19px] text-accent-black" />
      </Link>

      <AnimatePresence initial={false} mode="popLayout">
        {open && <Menu setOpen={setOpen} />}
      </AnimatePresence>
    </div>
  );
}

const Menu = ({ setOpen }: { setOpen: (open: boolean) => void }) => {
  const downloadMark = useCallback(() => {
    const blob = new Blob([MARK_SVG], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kiln-mark.svg";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Mark downloaded");
  }, []);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      className="absolute w-220 whitespace-nowrap rounded-16 p-4 bg-white left-0 top-[calc(100%+8px)] z-[2000] border border-border-faint"
      exit={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(1px)" }}
      initial={{ opacity: 0, y: -6, filter: "blur(1px)" }}
      style={{
        boxShadow:
          "0px 12px 24px rgba(0, 0, 0, 0.08), 0px 4px 8px rgba(0, 0, 0, 0.04)",
      }}
      transition={{ ease: cubicBezier(0.1, 0.1, 0.25, 1), duration: 0.2 }}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        onClick={() => {
          window.open("/", "_blank");
          setOpen(false);
        }}
      >
        <svg
          className="w-16 h-16"
          fill="none"
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 4.5V12.5C12 13.0523 11.5523 13.5 11 13.5H4C3.44772 13.5 3 13.0523 3 12.5V4.5C3 3.94772 3.44772 3.5 4 3.5H7.5M10.5 2.5H13.5M13.5 2.5V5.5M13.5 2.5L8.5 7.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
        </svg>
        Open in new tab
      </Button>

      <div className="px-8 py-4">
        <div className="h-1 w-full bg-black-alpha-5" />
      </div>

      <Button
        onClick={() => {
          copy(MARK_SVG);
          toast.success("Mark copied as SVG");
          setOpen(false);
        }}
      >
        <Icon />
        Copy mark as SVG
      </Button>

      <Button
        onClick={() => {
          downloadMark();
          setOpen(false);
        }}
      >
        <Download />
        Download mark
      </Button>

      <div className="px-8 py-4">
        <div className="h-1 w-full bg-black-alpha-5" />
      </div>

      <Button
        onClick={() => {
          window.open("/brand", "_blank");
          setOpen(false);
        }}
      >
        <Guidelines />
        Brand guidelines
      </Button>
    </motion.div>
  );
};

const Button = ({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn(
      "flex items-center gap-8 w-full px-8 h-32 rounded-8 text-label-small",
      "text-accent-black transition-colors hover:bg-black-alpha-4",
      className,
    )}
    type="button"
    {...props}
  >
    {children}
  </button>
);
