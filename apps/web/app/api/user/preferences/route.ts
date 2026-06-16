import { auth } from "@/auth";
import { prisma } from "@price-monitor/database";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailNotificationsEnabled: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    emailNotificationsEnabled: user.emailNotificationsEnabled,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.emailNotificationsEnabled !== "boolean") {
    return NextResponse.json(
      { error: "emailNotificationsEnabled must be a boolean" },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { emailNotificationsEnabled: body.emailNotificationsEnabled },
    select: { emailNotificationsEnabled: true },
  });

  return NextResponse.json(user);
}
