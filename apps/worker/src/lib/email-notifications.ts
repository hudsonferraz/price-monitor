import { Resend } from "resend";
import { prisma } from "@price-monitor/database";
import { buildAlertEmailContent } from "@price-monitor/shared/alert-email";
import {
  computeDealQualitySignals,
  groupSnapshotPricesByListing,
} from "@price-monitor/shared/deal-quality";
import { normalizeAppLocale } from "@price-monitor/shared/locales";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? "price-monitor <onboarding@resend.dev>";
}

function getDashboardUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export async function sendNewAlertsEmail(
  userId: string,
  savedSearchId: string,
  alertIds: string[],
): Promise<boolean> {
  if (alertIds.length === 0) {
    return false;
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn("RESEND_API_KEY is not set — skipping alert email.");
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailNotificationsEnabled: true, preferredLocale: true },
  });

  if (!user?.email || !user.emailNotificationsEnabled) {
    return false;
  }

  const savedSearch = await prisma.savedSearch.findUnique({
    where: { id: savedSearchId },
    select: { name: true },
  });

  if (!savedSearch) {
    return false;
  }

  const alerts = await prisma.alert.findMany({
    where: { id: { in: alertIds } },
    include: { listing: true },
    orderBy: { createdAt: "desc" },
  });

  if (alerts.length === 0) {
    return false;
  }

  const listingIds = alerts.map((alert) => alert.listingId);
  const snapshots = await prisma.pollSnapshotListing.findMany({
    where: {
      listingId: { in: listingIds },
      pollRun: { savedSearchId },
    },
    select: {
      listingId: true,
      priceCents: true,
      pollRun: { select: { savedSearchId: true } },
    },
  });
  const snapshotPricesByListing = groupSnapshotPricesByListing(
    snapshots.map((snapshot) => ({
      listingId: snapshot.listingId,
      priceCents: snapshot.priceCents,
      savedSearchId: snapshot.pollRun.savedSearchId,
    })),
  );

  const locale = normalizeAppLocale(user.preferredLocale);
  const dashboardUrl = `${getDashboardUrl()}/dashboard`;
  const emailContent = buildAlertEmailContent({
    locale,
    searchName: savedSearch.name,
    alerts: alerts.map((alert) => {
      const snapshotPrices =
        snapshotPricesByListing.get(`${savedSearchId}:${alert.listingId}`) ?? [];
      const dealQuality = computeDealQualitySignals({
        currentPriceCents: alert.listing.priceCents,
        snapshotPricesCents: snapshotPrices,
      });

      return {
        title: alert.listing.title,
        url: alert.listing.url,
        priceCents: alert.listing.priceCents,
        location: alert.listing.location,
        priceDroppedAt: alert.priceDroppedAt,
        previousPriceCents: alert.previousPriceCents,
        dealQuality: {
          isLowestSeen: dealQuality.isLowestSeen,
          isBelowRecentAverage: dealQuality.isBelowRecentAverage,
          recentAverageCents: dealQuality.recentAverageCents,
        },
      };
    }),
    dashboardUrl,
  });

  const response = await resend.emails.send({
    from: getFromAddress(),
    to: user.email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  await prisma.alert.updateMany({
    where: { id: { in: alertIds } },
    data: { emailSentAt: new Date() },
  });

  console.log(`Sent alert email to ${user.email} (${alerts.length} listing(s)).`);
  return true;
}
