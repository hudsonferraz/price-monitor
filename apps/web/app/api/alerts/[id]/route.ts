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

  const { id } = await context.params;

  const alert = await prisma.alert.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  await prisma.alert.update({
    where: { id },
    data: { dismissedAt: new Date() },
  });

  return new NextResponse(null, { status: 204 });
}
