"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface NotificationSettingsProps {
  emailNotificationsEnabled: boolean;
}

export function NotificationSettings({
  emailNotificationsEnabled: initialEnabled,
}: NotificationSettingsProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(nextValue: boolean) {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotificationsEnabled: nextValue }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Failed to update notification settings");
        return;
      }

      setEnabled(data.emailNotificationsEnabled);
      setMessage(
        data.emailNotificationsEnabled
          ? "Email alerts enabled."
          : "Email alerts disabled.",
      );
      router.refresh();
    } catch {
      setError("Failed to update notification settings");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-lg font-semibold">Notifications</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Get an email when new Facebook Marketplace listings match your saved searches.
      </p>

      <label className="mt-4 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={isSaving}
          onChange={(event) => handleToggle(event.target.checked)}
          className="mt-0.5 rounded border-[var(--border)]"
        />
        <span>
          <span className="font-medium">Email me about new matches</span>
          <span className="mt-1 block text-[var(--muted)]">
            Requires Resend to be configured on the worker.
          </span>
        </span>
      </label>

      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
