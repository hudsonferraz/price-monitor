import { auth } from "@/auth";
import { prisma } from "@price-monitor/database";
import {
  createSavedSearchSchema,
  reaisToCents,
  updateSavedSearchSchema,
} from "@price-monitor/shared/schemas";
import { NextResponse } from "next/server";

function serializeSavedSearch(search: {
  id: string;
  name: string;
  keywords: string;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  pollIntervalMin: number;
  listingLimit: number;
  isEnabled: boolean;
  lastPolledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: search.id,
    name: search.name,
    keywords: search.keywords,
    minPriceCents: search.minPriceCents,
    maxPriceCents: search.maxPriceCents,
    pollIntervalMin: search.pollIntervalMin,
    listingLimit: search.listingLimit,
    isEnabled: search.isEnabled,
    lastPolledAt: search.lastPolledAt?.toISOString() ?? null,
    createdAt: search.createdAt.toISOString(),
    updatedAt: search.updatedAt.toISOString(),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searches = await prisma.savedSearch.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(searches.map(serializeSavedSearch));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSavedSearchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const search = await prisma.savedSearch.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      keywords: parsed.data.keywords,
      minPriceCents: reaisToCents(parsed.data.minPriceReais),
      maxPriceCents: reaisToCents(parsed.data.maxPriceReais),
      pollIntervalMin: parsed.data.pollIntervalMin,
      listingLimit: parsed.data.listingLimit,
      isEnabled: parsed.data.isEnabled,
    },
  });

  return NextResponse.json(serializeSavedSearch(search), { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSavedSearchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const searchId = typeof body?.id === "string" ? body.id : null;
  if (!searchId) {
    return NextResponse.json({ error: "Search id is required" }, { status: 400 });
  }

  const existing = await prisma.savedSearch.findFirst({
    where: { id: searchId, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  const search = await prisma.savedSearch.update({
    where: { id: searchId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.keywords !== undefined ? { keywords: parsed.data.keywords } : {}),
      ...(parsed.data.minPriceReais !== undefined
        ? { minPriceCents: reaisToCents(parsed.data.minPriceReais) }
        : {}),
      ...(parsed.data.maxPriceReais !== undefined
        ? { maxPriceCents: reaisToCents(parsed.data.maxPriceReais) }
        : {}),
      ...(parsed.data.pollIntervalMin !== undefined
        ? { pollIntervalMin: parsed.data.pollIntervalMin }
        : {}),
      ...(parsed.data.listingLimit !== undefined
        ? { listingLimit: parsed.data.listingLimit }
        : {}),
      ...(parsed.data.isEnabled !== undefined ? { isEnabled: parsed.data.isEnabled } : {}),
    },
  });

  return NextResponse.json(serializeSavedSearch(search));
}
