"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

type Mode = "sign-in" | "sign-up";

/**
 * One form for both sign-in and registration.
 *
 * Kept as a single component because the fields are nearly identical and
 * two near-duplicate forms drift apart. Registration posts to our own route
 * and then signs in with the same credentials, so a new user lands in the
 * product rather than on a "now please sign in" page.
 */
export default function AuthForm({
  providers,
}: {
  providers: Array<"github" | "google">;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/create";

  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (mode === "sign-up") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data.error || "Could not create that account.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("That email and password do not match an account.");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-16 border border-white/10 bg-white/[0.035] backdrop-blur-sm p-24">
      <div
        className="flex gap-4 p-4 rounded-full bg-white/[0.05] mb-24"
        role="tablist"
        aria-label="Sign in or create an account"
      >
        {(["sign-in", "sign-up"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={mode === option}
            onClick={() => {
              setMode(option);
              setError(null);
            }}
            className={cn(
              "flex-1 h-32 rounded-full text-[13.5px] font-medium transition-colors duration-140",
              mode === option ? "bg-white text-kiln-obsidian" : "text-white/55 hover:text-white/85",
            )}
          >
            {option === "sign-in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-18 flex items-start gap-8 rounded-10 border border-kiln-danger/30 bg-kiln-danger/10 p-12"
        >
          <AlertCircle className="w-15 h-15 mt-1 shrink-0 text-kiln-danger" aria-hidden />
          <p className="text-[13px] text-white/80">{error}</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-14">
        {mode === "sign-up" && (
          <Field
            id="name"
            label="Name"
            type="text"
            value={name}
            onChange={setName}
            autoComplete="name"
            placeholder="Optional"
          />
        )}

        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
          placeholder="you@company.com"
        />

        <Field
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          required
          placeholder={mode === "sign-up" ? "At least 10 characters" : ""}
          hint={mode === "sign-up" ? "At least 10 characters. Length beats symbols." : undefined}
        />

        <button
          type="submit"
          disabled={busy}
          className={cn(
            "w-full h-44 rounded-full text-[14.5px] font-medium transition-colors duration-140",
            "inline-flex items-center justify-center gap-8",
            busy
              ? "bg-kiln-iris-500/60 text-white/70 cursor-wait"
              : "bg-kiln-iris-500 text-white hover:bg-kiln-iris-400",
          )}
        >
          {busy && <Loader2 className="w-16 h-16 animate-spin" aria-hidden />}
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>

      {providers.length > 0 && (
        <>
          <div className="my-20 flex items-center gap-12">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[11.5px] uppercase tracking-[0.08em] text-white/30">or</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="space-y-8">
            {providers.map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => signIn(provider, { callbackUrl })}
                className="w-full h-42 rounded-full border border-white/12 text-[14px] text-white/80 hover:text-white hover:border-white/25 transition-colors capitalize"
              >
                Continue with {provider}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  ...props
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id">) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12.5px] text-white/50 mb-6">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-42 px-14 rounded-10 bg-white/[0.05] border border-white/10 text-[14.5px] text-white placeholder:text-white/25 outline-none focus:border-kiln-iris-400/60 transition-colors"
        {...props}
      />
      {hint && <p className="mt-5 text-[11.5px] text-white/30">{hint}</p>}
    </div>
  );
}
