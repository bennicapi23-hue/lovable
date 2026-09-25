import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import { getDb, accounts, sessions, users, verificationTokens } from '@/lib/db';
import { verifyPassword } from './password';
import { DEFAULT_PLAN_ID } from '@/config/plans.config';

/**
 * Authentication.
 *
 * Credentials is the default provider so a self-hosted install works without
 * registering an OAuth app anywhere. GitHub and Google switch themselves on
 * when their environment variables are present, so a hosted deployment can
 * offer them without a code change.
 *
 * Sessions are JWT rather than database-backed. Credentials requires it, and
 * it means a generation request does not pay a database round trip just to
 * learn who is asking — which matters when the route then streams for a
 * minute. The plan id rides in the token and is refreshed on update.
 */

declare module 'next-auth' {
  interface Session {
    user: { id: string; planId: string } & DefaultSession['user'];
  }
}

/** Providers configured in this deployment, for the sign-in page to render. */
export function enabledOAuthProviders(): Array<'github' | 'google'> {
  const enabled: Array<'github' | 'google'> = [];
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) enabled.push('github');
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) enabled.push('google');
  return enabled;
}

const oauthProviders = [
  ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
    ? [GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET })]
    : []),
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),

  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },

  pages: { signIn: '/sign-in', error: '/sign-in' },

  providers: [
    ...oauthProviders,
    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const email = typeof raw?.email === 'string' ? raw.email.trim().toLowerCase() : '';
        const password = typeof raw?.password === 'string' ? raw.password : '';
        if (!email || !password) return null;

        const [user] = await getDb()
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // Same answer whether the account is absent, OAuth-only, or the
        // password is wrong — otherwise this endpoint tells an attacker
        // which addresses are registered.
        if (!user?.passwordHash) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign-in, and whenever the session is explicitly refreshed, read
      // the plan from the database so an upgrade takes effect without
      // forcing the user to sign out and back in.
      if (user?.id || trigger === 'update') {
        const id = user?.id ?? (token.sub as string | undefined);
        if (id) {
          const [row] = await getDb()
            .select({ planId: users.planId })
            .from(users)
            .where(eq(users.id, id))
            .limit(1);
          token.planId = row?.planId ?? DEFAULT_PLAN_ID;
          token.sub = id;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.planId = (token.planId as string) ?? DEFAULT_PLAN_ID;
      }
      return session;
    },
  },

  trustHost: true,
});
