"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="inline-flex items-center gap-7 h-32 px-12 rounded-full border border-white/10 text-[13px] text-white/55 hover:text-white hover:border-white/22 transition-colors"
    >
      <LogOut className="w-14 h-14" aria-hidden />
      Sign out
    </button>
  );
}
