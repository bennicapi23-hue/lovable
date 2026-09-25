import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb, builds, projects, type Project } from './index';
import type { AppBlueprint } from '@/lib/app-builder/blueprint';

/**
 * Project persistence.
 *
 * Before this, a build lived in sessionStorage and a process global: closing
 * the tab lost the work, and a redeploy lost everyone's. Projects and the
 * file trees their builds produced are now rows, which is also what makes the
 * "version history" the paid plans advertise into something real.
 */

export interface CreateProjectInput {
  userId: string;
  name: string;
  tagline?: string | null;
  origin: 'create' | 'clone';
  /** The description, or the URL for a clone. */
  source?: string | null;
  blueprint?: AppBlueprint | null;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const [row] = await getDb()
    .insert(projects)
    .values({
      userId: input.userId,
      name: input.name.trim().slice(0, 120) || 'Untitled app',
      tagline: input.tagline?.slice(0, 200) ?? null,
      origin: input.origin,
      source: input.source?.slice(0, 2048) ?? null,
      blueprint: input.blueprint ?? null,
    })
    .returning();

  return row;
}

/** Projects for a user, newest activity first. Archived ones are excluded. */
export async function listProjects(userId: string, limit = 50): Promise<Project[]> {
  return getDb()
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), isNull(projects.archivedAt)))
    .orderBy(desc(projects.updatedAt))
    .limit(limit);
}

/**
 * Loads one project.
 *
 * Ownership is part of the query rather than a check afterwards, so there is
 * no path where a row is fetched and the check is forgotten.
 */
export async function getProject(userId: string, projectId: string): Promise<Project | null> {
  const [row] = await getDb()
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  return row ?? null;
}

export async function touchProject(
  userId: string,
  projectId: string,
  patch: { name?: string; lastSandboxId?: string | null } = {},
): Promise<void> {
  await getDb()
    .update(projects)
    .set({ ...patch, updatedAt: Date.now() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}

export async function archiveProject(userId: string, projectId: string): Promise<void> {
  await getDb()
    .update(projects)
    .set({ archivedAt: Date.now() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}

/* ----------------------------------------------------------------- builds */

export async function startBuild(input: {
  userId: string;
  projectId: string;
  kind: 'build' | 'edit';
  prompt?: string | null;
  model?: string | null;
}): Promise<string> {
  const [row] = await getDb()
    .insert(builds)
    .values({
      userId: input.userId,
      projectId: input.projectId,
      kind: input.kind,
      prompt: input.prompt?.slice(0, 8000) ?? null,
      model: input.model ?? null,
      status: 'running',
    })
    .returning({ id: builds.id });

  return row.id;
}

export async function finishBuild(
  buildId: string,
  result:
    | { status: 'succeeded'; files: Record<string, string> }
    | { status: 'failed'; error: string },
): Promise<void> {
  await getDb()
    .update(builds)
    .set({
      status: result.status,
      files: result.status === 'succeeded' ? result.files : null,
      error: result.status === 'failed' ? result.error.slice(0, 2000) : null,
      finishedAt: Date.now(),
    })
    .where(eq(builds.id, buildId));
}

/** Build history for a project, newest first. */
export async function listBuilds(userId: string, projectId: string, limit = 25) {
  return getDb()
    .select({
      id: builds.id,
      kind: builds.kind,
      prompt: builds.prompt,
      model: builds.model,
      status: builds.status,
      error: builds.error,
      createdAt: builds.createdAt,
      finishedAt: builds.finishedAt,
    })
    .from(builds)
    .where(and(eq(builds.projectId, projectId), eq(builds.userId, userId)))
    .orderBy(desc(builds.createdAt))
    .limit(limit);
}

/** The file tree a particular build produced. */
export async function getBuildFiles(
  userId: string,
  buildId: string,
): Promise<Record<string, string> | null> {
  const [row] = await getDb()
    .select({ files: builds.files })
    .from(builds)
    .where(and(eq(builds.id, buildId), eq(builds.userId, userId)))
    .limit(1);

  return (row?.files as Record<string, string> | null) ?? null;
}
