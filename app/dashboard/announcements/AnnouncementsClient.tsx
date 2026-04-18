'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface Announcement {
  _id: string
  title: string
  content: string
  audience: string
  category: string
  pinned: boolean
  createdAt: string
}

interface FormData {
  title: string
  content: string
  audience: string
  category: string
  pinned: boolean
}

type CategoryFilter = 'all' | 'academic' | 'events' | 'admin' | 'general'

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'academic', label: 'Academic' },
  { value: 'events', label: 'Events' },
  { value: 'admin', label: 'Admin' },
  { value: 'general', label: 'General' },
]

const CATEGORY_BADGE: Record<string, 'info' | 'success' | 'warning' | 'purple' | 'default'> = {
  academic: 'info',
  events: 'success',
  admin: 'warning',
  general: 'default',
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 0 || isNaN(diff)) return 'Just now'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function useReadState() {
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem("announcement_read_ids")
      if (stored) return new Set(JSON.parse(stored) as string[])
    } catch {
      // Silently ignore JSON parse errors
    }
    return new Set()
  });

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem('announcement_read_ids', JSON.stringify([...next])) } catch {}
      return next
    })
  }, [])

  const markAllRead = useCallback((ids: string[]) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      try { localStorage.setItem('announcement_read_ids', JSON.stringify([...next])) } catch {}
      return next
    })
  }, [])

  return { readIds, markRead, markAllRead }
}

export function AnnouncementsClient() {
  const { toast } = useToast()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const { readIds, markRead, markAllRead } = useReadState()

  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<FormData>()

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/announcements')
      if (!res.ok) throw new Error(`Failed to fetch announcements: ${res.status}`)
      const data = await res.json()
      setAnnouncements(Array.isArray(data) ? data : [])
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to load', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchAnnouncements() }, [fetchAnnouncements])

  const filtered = categoryFilter === 'all'
    ? announcements
    : announcements.filter((a) => (a.category || 'general') === categoryFilter)

  const unreadCount = announcements.filter((a) => !readIds.has(a._id)).length

  const openAdd = () => {
    setEditing(null)
    reset({ audience: 'All', category: 'general', pinned: false })
    setModalOpen(true)
  }

  const openEdit = (a: Announcement) => {
    setEditing(a)
    reset({ title: a.title, content: a.content, audience: a.audience, category: a.category || 'general', pinned: a.pinned })
    setModalOpen(true)
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
    markRead(id)
  }

  const onSubmit = async (data: FormData) => {
    const url = editing ? `/api/announcements/${editing._id}` : '/api/announcements'
    const method = editing ? 'PUT' : 'POST'
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        toast(editing ? 'Announcement updated!' : 'Announcement posted!', 'success')
        setModalOpen(false)
        fetchAnnouncements()
      } else {
        toast('Failed to save announcement', 'error')
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Network error', 'error')
    }
  }

  const togglePin = async (a: Announcement) => {
    try {
      const res = await fetch(`/api/announcements/${a._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !a.pinned }),
      })
      if (res.ok) { toast(a.pinned ? 'Unpinned' : 'Pinned!', 'success'); fetchAnnouncements() }
      else toast('Failed to update', 'error')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Network error', 'error')
    }
  }

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/announcements/${deleteTarget._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast("Deleted", "success");
        fetchAnnouncements();
      } else toast("Failed to delete", "error");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Network error", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setCategoryFilter(value)}
              className={`relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                categoryFilter === value
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
              }`}
            >
              {label}
              {value === "all" && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead(announcements.map((a) => a._id))}
            >
              Mark all read
            </Button>
          )}
          <Button onClick={openAdd}>
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Announcement
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <TableSkeleton rows={4} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-slate-600 py-20 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-300 dark:text-slate-600 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
            />
          </svg>
          <p className="text-gray-400 text-sm mb-4">
            {categoryFilter === "all"
              ? "No announcements yet."
              : `No ${categoryFilter} announcements.`}
          </p>
          {categoryFilter === "all" && (
            <Button size="sm" onClick={openAdd}>
              Post first announcement
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const isRead = readIds.has(a._id);
            const isExpanded = expandedId === a._id;
            const cat = a.category || "general";
            const catVariant = CATEGORY_BADGE[cat] ?? "default";

            return (
              <div
                key={a._id}
                className={`rounded-2xl border bg-white dark:bg-slate-800 transition-all ${
                  a.pinned
                    ? "border-indigo-300 dark:border-indigo-700 shadow-sm"
                    : !isRead
                      ? "border-blue-200 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-900/5"
                      : "border-gray-200 dark:border-slate-700"
                }`}
              >
                <div
                  className="p-5 cursor-pointer select-none"
                  onClick={() => toggleExpand(a._id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpand(a._id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {!isRead && (
                          <span
                            className="h-2 w-2 rounded-full bg-blue-500 shrink-0"
                            title="Unread"
                          />
                        )}
                        {a.pinned && (
                          <svg
                            className="h-4 w-4 text-indigo-500 shrink-0"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M16 2L12 6 8 2 4 6l4 4-2 8h12l-2-8 4-4-4-4z" />
                          </svg>
                        )}
                        <h3
                          className={`font-semibold text-sm ${isRead ? "text-gray-700 dark:text-slate-200" : "text-gray-900 dark:text-white"}`}
                        >
                          {a.title}
                        </h3>
                        <Badge variant={catVariant} className="capitalize">
                          {cat}
                        </Badge>
                        {a.audience && a.audience !== "All" && (
                          <Badge variant="info" className="text-xs">
                            {a.audience}
                          </Badge>
                        )}
                      </div>

                      {isExpanded ? (
                        <p className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-wrap mt-2">
                          {a.content}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-1">
                          {a.content}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {timeAgo(a.createdAt)}
                        </p>
                        <span className="text-xs text-indigo-500 dark:text-indigo-400">
                          {isExpanded ? "Show less" : "Read more"}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons — stop propagation so clicks don't toggle expand */}
                    <div
                      className="flex gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => togglePin(a)}
                        title={a.pinned ? "Unpin" : "Pin"}
                        className={`rounded-lg p-1.5 transition-colors ${
                          a.pinned
                            ? "text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                            : "text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => openEdit(a)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-600 transition-colors"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(a)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete announcement?"
        message={`"${deleteTarget?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Announcement" : "New Announcement"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Title *
            </label>
            <input
              {...register("title", { required: true })}
              className="input w-full"
              placeholder="Announcement title"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-500">Title is required</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Content *
            </label>
            <textarea
              {...register("content", { required: true })}
              rows={4}
              className="input w-full resize-none"
              placeholder="Write your announcement…"
            />
            {errors.content && (
              <p className="mt-1 text-xs text-red-500">Content is required</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select {...register("category")} className="input w-full">
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="events">Events</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Audience
              </label>
              <input
                {...register("audience")}
                className="input w-full"
                placeholder="All / B.Tech 3rd Year…"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              {...register("pinned")}
              type="checkbox"
              className="h-4 w-4 rounded accent-indigo-600"
            />
            <span className="text-sm text-gray-700 dark:text-slate-300">
              Pin this announcement
            </span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button loading={isSubmitting} type="submit">
              {editing ? "Update" : "Post"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
