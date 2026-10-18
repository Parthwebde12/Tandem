import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { Notification, Page } from "../api/types";

function relativeTime(value: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function notificationTitle(kind: string) {
  const titles: Record<string, string> = {
    "item.urgent_unclaimed": "Urgent item needs an owner",
    "item.assigned": "You were assigned an item",
    "item.claimed": "Your item was claimed",
    "item.commented": "New comment on an item",
    "item.state_changed": "An item’s status changed",
    "item.created": "New item in your team",
  };
  return titles[kind] ?? kind.replaceAll(".", " ").replaceAll("_", " ");
}

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<Page<Notification>>("/notifications?limit=25"),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      apiFetch<void>(`/notifications/${notificationId}/read`, { method: "POST" }),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<Page<Notification>>(["notifications"]);
      queryClient.setQueryData<Page<Notification>>(["notifications"], (current) =>
        current
          ? {
              ...current,
              items: current.items.map((notification) =>
                notification.id === notificationId
                  ? { ...notification, read_at: new Date().toISOString() }
                  : notification,
              ),
            }
          : current,
      );
      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = notificationsQuery.data?.items ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative flex size-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition hover:bg-gray-50 hover:text-gray-950"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
          <path
            d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-5 text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          aria-label="Notifications"
          className="absolute right-0 top-12 z-30 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-gray-950">Notifications</h2>
              <p className="text-xs text-gray-500">
                {unreadCount ? `${unreadCount} unread` : "You’re all caught up"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
              className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              ×
            </button>
          </div>

          {notificationsQuery.isPending ? (
            <p className="px-4 py-6 text-sm text-gray-500">Checking for updates…</p>
          ) : notificationsQuery.isError ? (
            <p role="alert" className="px-4 py-6 text-sm text-rose-700">
              Could not load notifications.
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">
              New assignments and item updates will show up here.
            </p>
          ) : (
            <ul className="max-h-[min(28rem,65vh)] divide-y divide-gray-100 overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    to={`/items/${notification.work_item_id}`}
                    onClick={() => {
                      setOpen(false);
                      if (!notification.read_at) markRead.mutate(notification.id);
                    }}
                    className={`block px-4 py-3 transition hover:bg-gray-50 ${
                      notification.read_at ? "bg-white" : "bg-[#f7f9f3]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${
                          notification.read_at ? "bg-transparent" : "bg-[#78945e]"
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-gray-700">
                          {notificationTitle(notification.kind)}
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-gray-600">
                          {notification.message}
                        </span>
                        <time
                          dateTime={notification.created_at}
                          className="mt-1.5 block text-xs text-gray-400"
                        >
                          {relativeTime(notification.created_at)}
                        </time>
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {markRead.isError && (
            <p role="alert" className="border-t border-gray-100 px-4 py-2 text-xs text-rose-700">
              Could not update notification status. It will refresh shortly.
            </p>
          )}
          <div className="border-t border-gray-100 px-4 py-2">
            <p className="text-[11px] text-gray-400">Refreshes every 30 seconds</p>
          </div>
        </section>
      )}
    </div>
  );
}
