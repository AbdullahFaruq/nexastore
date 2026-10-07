import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge route protection (Next 16's `proxy` convention, formerly `middleware`).
 *
 * When Clerk is configured this delegates to clerkMiddleware, which verifies
 * the session before a route renders. Without keys it is a no-op and
 * protection falls entirely to requireStoreContext() in every server component
 * and every server action - this layer is a fast path, never the only gate.
 */
const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

const PUBLIC_ROUTES = [
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health",
];

async function buildClerkProxy() {
  const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");
  const isPublic = createRouteMatcher(PUBLIC_ROUTES);
  return clerkMiddleware(async (auth, req) => {
    if (!isPublic(req)) await auth.protect();
  });
}

const clerkProxy = clerkConfigured ? buildClerkProxy() : null;

export default async function proxy(request: NextRequest, event: unknown) {
  if (!clerkProxy) return NextResponse.next();
  const handler = await clerkProxy;
  // Clerk's handler signature is looser than Next's proxy signature.
  return (handler as unknown as (r: NextRequest, e: unknown) => Response)(request, event);
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets, plus all API routes.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
