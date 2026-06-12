const EXPO_PUSH_URL = "https://api.expo.dev/v2/push/send";
const BATCH_SIZE = 100;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: "default";
  data?: Record<string, unknown>;
  badge?: number;
}

/**
 * Fetch unread notification counts for a set of users in one bulk query.
 * Returns a Map of userId → unread count (omits users with 0 unread).
 * Call this before sendExpoPushBatch and attach badge to each message.
 */
export async function fetchUnreadCounts(
  supabase: any,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const now = new Date().toISOString();
  const { data } = await supabase
    .from("notifications")
    .select("user_id")
    .in("user_id", userIds)
    .eq("is_read", false)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }
  return counts;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error: string };
}

export interface SendResult {
  sent: number;
  errors: number;
  invalidTokenUserIds: string[];
}

/**
 * Send push notifications via the Expo Push API.
 * Batches messages into groups of 100 (Expo's limit).
 * Returns counts and a list of user IDs with stale tokens.
 */
export async function sendExpoPushBatch(
  messages: (ExpoPushMessage & { _userId: string })[],
): Promise<SendResult> {
  const result: SendResult = { sent: 0, errors: 0, invalidTokenUserIds: [] };

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);

    // Strip _userId before sending to Expo
    const payload = batch.map(({ _userId, ...msg }) => msg);

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Expo API error: ${response.status} ${response.statusText}`);
        result.errors += batch.length;
        continue;
      }

      const { data: tickets } = (await response.json()) as {
        data: ExpoPushTicket[];
      };

      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        if (ticket.status === "ok") {
          result.sent++;
        } else {
          result.errors++;
          if (ticket.details?.error === "DeviceNotRegistered") {
            result.invalidTokenUserIds.push(batch[j]._userId);
          }
        }
      }
    } catch (err) {
      console.error("Expo Push fetch error:", err);
      result.errors += batch.length;
    }
  }

  return result;
}
