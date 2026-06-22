import { auth } from "@/auth";
import { cancelPollSearchJob } from "@price-monitor/queue";
import { prisma } from "@price-monitor/database";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.savedSearch.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  await prisma.savedSearch.update({
    where: { id },
    data: { isEnabled: false },
  });

  const cancelResult = await cancelPollSearchJob(id);

  if (!cancelResult.removed && cancelResult.reason === "active") {
    return NextResponse.json(
      {
        error: "A poll is currently running for this search. Try deleting again in a minute.",
      },
      { status: 409 },
    );
  }

  if (!cancelResult.removed && cancelResult.reason === "failed") {
    return NextResponse.json(
      { error: "Could not cancel the pending poll job. Try again shortly." },
      { status: 503 },
    );
  }

  await prisma.savedSearch.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
