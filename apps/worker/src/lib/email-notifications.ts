import { Resend } from "resend";
import { prisma } from "@price-monitor/database";
import { formatPriceCents } from "@price-monitor/shared/poll-rate-limit";

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
    select: { email: true, emailNotificationsEnabled: true },
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

  const alertCount = alerts.length;
  const subject =
    alertCount === 1
      ? `New match for ${savedSearch.name}`
      : `${alertCount} new matches for ${savedSearch.name}`;

  const listingLines = alerts
    .map((alert) => {
      const price = formatPriceCents(alert.listing.priceCents);
      const location = alert.listing.location ? ` · ${alert.listing.location}` : "";
      return `• ${alert.listing.title} — ${price}${location}\n  ${alert.listing.url}`;
    })
    .join("\n\n");

  const dashboardUrl = `${getDashboardUrl()}/dashboard`;
  const text = [
    `You have ${alertCount} new Facebook Marketplace match(es) for "${savedSearch.name}".`,
    "",
    listingLines,
    "",
    `View all alerts: ${dashboardUrl}`,
  ].join("\n");

  const html = `
    <p>You have <strong>${alertCount}</strong> new Facebook Marketplace match(es) for <strong>${savedSearch.name}</strong>.</p>
    <ul>
      ${alerts
        .map((alert) => {
          const price = formatPriceCents(alert.listing.priceCents);
          const location = alert.listing.location ? ` · ${alert.listing.location}` : "";
          return `<li><a href="${alert.listing.url}">${alert.listing.title}</a> — ${price}${location}</li>`;
        })
        .join("")}
    </ul>
    <p><a href="${dashboardUrl}">Open your dashboard</a></p>
  `;

  const response = await resend.emails.send({
    from: getFromAddress(),
    to: user.email,
    subject,
    text,
    html,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  await prisma.alert.updateMany({
    where: { id: { in: alertIds } },
    data: { emailSentAt: new Date() },
  });

  console.log(`Sent alert email to ${user.email} (${alertCount} listing(s)).`);
  return true;
}
