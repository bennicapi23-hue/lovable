import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Globe, Plus, Wand2 } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { listProjects } from "@/lib/db/projects";
import { usageSnapshot } from "@/lib/billing/entitlements";
import { resolveAccount } from "@/lib/billing/session";
import KilnLogo from "@/components/brand/KilnLogo";
import SignOutButton from "@/components/auth/SignOutButton";

export const metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/projects");

  const account = await resolveAccount();
  if (!account) redirect("/sign-in?callbackUrl=/projects");

  const [projects, snapshot] = await Promise.all([
    listProjects(account.id),
    usageSnapshot(account),
  ]);

  const buildsLeft = Number.isFinite(snapshot.builds.limit)
    ? Math.max(0, snapshot.builds.limit - snapshot.builds.used)
    : null;

  return (
    <main className="min-h-screen bg-kiln-obsidian text-kiln-studio-text">
      <header className="border-b border-white/8">
        <div className="mx-auto max-w-[1000px] px-24 h-64 flex items-center justify-between">
          <span className="text-white">
            <KilnLogo markClassName="w-22 h-22" variant="gradient" href="/projects" />
          </span>
          <div className="flex items-center gap-16">
            <span className="hidden sm:inline text-[13px] text-white/40">
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1000px] px-24 py-48">
        <div className="flex flex-wrap items-end justify-between gap-16 mb-32">
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.025em] text-white">
              Your projects
            </h1>
            <p className="mt-6 text-[14px] text-white/45">
              {snapshot.plan.name} plan ·{" "}
              {buildsLeft === null
                ? "unlimited builds"
                : `${buildsLeft} build${buildsLeft === 1 ? "" : "s"} left this month`}
              {buildsLeft === 0 && (
                <>
                  {" · "}
                  <Link href="/pricing" className="text-kiln-iris-300 hover:text-kiln-iris-200">
                    upgrade
                  </Link>
                </>
              )}
            </p>
          </div>

          <div className="flex gap-10">
            <Link
              href="/create"
              className="inline-flex items-center gap-8 h-40 px-18 rounded-full bg-kiln-iris-500 text-white text-[14px] font-medium hover:bg-kiln-iris-400 transition-colors"
            >
              <Plus className="w-15 h-15" aria-hidden />
              New app
            </Link>
            <Link
              href="/generation"
              className="inline-flex items-center gap-8 h-40 px-16 rounded-full border border-white/12 text-[14px] text-white/70 hover:text-white hover:border-white/25 transition-colors"
            >
              <Globe className="w-15 h-15" aria-hidden />
              Rebuild a site
            </Link>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-16 border border-dashed border-white/12 bg-white/[0.02] p-48 text-center">
            <Wand2 className="w-28 h-28 mx-auto text-white/25" aria-hidden />
            <h2 className="mt-16 text-[18px] font-medium text-white">Nothing here yet</h2>
            <p className="mt-8 text-[14px] text-white/45 max-w-[42ch] mx-auto">
              Describe an app in a sentence and Kiln will plan it, show you the
              plan, and build it once you approve.
            </p>
            <Link
              href="/create"
              className="mt-24 inline-flex items-center gap-8 h-42 px-20 rounded-full bg-kiln-iris-500 text-white text-[14px] font-medium hover:bg-kiln-iris-400 transition-colors"
            >
              Describe your first app
              <ArrowRight className="w-15 h-15" aria-hidden />
            </Link>
          </div>
        ) : (
          <ul className="grid gap-12 sm:grid-cols-2">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/generation?project=${project.id}`}
                  className="block rounded-14 border border-white/8 bg-white/[0.025] p-18 transition-colors hover:border-white/18 hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-10">
                    <h2 className="text-[16px] font-medium text-white">{project.name}</h2>
                    <span className="shrink-0 text-[11px] uppercase tracking-[0.07em] text-white/30">
                      {project.origin === "clone" ? "Rebuilt" : "Built"}
                    </span>
                  </div>
                  {project.tagline && (
                    <p className="mt-5 text-[13px] text-white/45 line-clamp-2">{project.tagline}</p>
                  )}
                  <p className="mt-12 text-[11.5px] text-white/28">
                    Updated{" "}
                    {new Date(project.updatedAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
