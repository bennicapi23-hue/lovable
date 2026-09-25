import { Suspense } from "react";
import { enabledOAuthProviders } from "@/lib/auth/config";
import { brand } from "@/config/brand.config";
import AuthForm from "@/components/auth/AuthForm";
import KilnMark from "@/components/brand/KilnMark";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  // Read on the server so the page only offers providers this deployment
  // has actually configured, rather than buttons that fail on click.
  const providers = enabledOAuthProviders();

  return (
    <main className="min-h-screen bg-kiln-obsidian text-kiln-studio-text flex flex-col">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-[30%] left-1/2 -translate-x-1/2 w-[820px] h-[640px] rounded-full opacity-[0.22] blur-[140px] bg-[radial-gradient(circle,#6244f5_0%,transparent_63%)]" />
      </div>

      <div className="relative z-10 flex-1 grid place-items-center px-24 py-56">
        <div className="w-full max-w-[400px]">
          <div className="text-center mb-32">
            <KilnMark className="w-40 h-40 mx-auto text-white" variant="gradient" />
            <h1 className="mt-18 text-[26px] font-semibold tracking-[-0.02em] text-white">
              {brand.name}
            </h1>
            <p className="mt-6 text-[14px] text-white/45">{brand.tagline}</p>
          </div>

          <Suspense fallback={<div className="h-[340px]" aria-busy="true" />}>
            <AuthForm providers={providers} />
          </Suspense>

          <p className="mt-24 text-center text-[12px] leading-[1.6] text-white/30">
            By continuing you agree to the{" "}
            <a href={brand.urls.terms} className="text-white/50 hover:text-white/80 underline underline-offset-2">
              Terms
            </a>{" "}
            and{" "}
            <a href={brand.urls.privacy} className="text-white/50 hover:text-white/80 underline underline-offset-2">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
