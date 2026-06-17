import { auth } from "@/auth";
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

  const { id: savedSearchId } = await context.params;

  const savedSearch = await prisma.savedSearch.findFirst({
    where: { id: savedSearchId, userId: session.user.id },
  });

  if (!savedSearch) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  const result = await prisma.alert.updateMany({
    where: { savedSearchId, userId: session.user.id, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });

  return NextResponse.json({ dismissed: result.count });
}
