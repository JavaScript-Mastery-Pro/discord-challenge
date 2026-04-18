'use client'

import { useEffect, useRef, useState } from 'react'
import Image from "next/image";
import { useForm } from 'react-hook-form'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface AcademicHistoryEntry {
  year: string
  title: string
  description?: string
}

interface TeacherProfile {
  name: string
  email: string
  department: string
  subjects: string[]
  phone: string
  bio: string
  academicHistory: AcademicHistoryEntry[]
  createdAt?: string
}

interface FormData {
  name: string
  department: string
  subjectsRaw: string
  phone: string
  bio: string
}

interface TimelineFormData {
  year: string
  title: string
  description: string
}

async function getErrorMessage(res: Response, fallback: string) {
  try {
    const payload = await res.json()
    if (typeof payload?.error === 'string') {
      return payload.error
    }
    if (payload?.error?.fieldErrors) {
      const firstError = Object.values(
        payload.error.fieldErrors as Record<string, string[]>,
      )[0]
      if (firstError?.[0]) {
        return firstError[0]
      }
    }
  } catch {
    // Ignore malformed error bodies and fall back to the generic message.
  }

  return fallback
}

export function ProfileClient() {
  const { user } = useUser()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<TeacherProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [timelineModalOpen, setTimelineModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<{ index: number; entry: AcademicHistoryEntry } | null>(null)
  const [deleteEntryIndex, setDeleteEntryIndex] = useState<number | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>()
  const {
    register: tlRegister,
    handleSubmit: tlHandleSubmit,
    reset: tlReset,
    formState: { isSubmitting: tlSubmitting, errors: tlErrors },
  } = useForm<TimelineFormData>()

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`)
        const data = await res.json()
        setProfile(data)
        reset({
          name: data.name,
          department: data.department,
          subjectsRaw: (data.subjects ?? []).join(', '),
          phone: data.phone,
          bio: data.bio,
        })
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Failed to load profile', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [reset, toast])

  // ── Avatar upload via Clerk ──
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5 MB', 'error'); return }

    setAvatarUploading(true)
    try {
      await user.setProfileImage({ file })
      toast('Avatar updated!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to upload avatar', 'error')
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  // ── Profile form submit ──
  const onSubmit = async (data: FormData) => {
    // Deduplicate subjects by converting to Set and back to array
    const subjectsArray = data.subjectsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const subjects = Array.from(new Set(subjectsArray));
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          department: data.department,
          subjects,
          phone: data.phone,
          bio: data.bio,
          academicHistory: profile?.academicHistory ?? [],
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        toast("Profile updated!", "success");
        setEditing(false);
      } else {
        toast(await getErrorMessage(res, "Failed to update profile"), "error");
      }
    } catch (error) {
      toast(
        `Network error: ${error instanceof Error ? error.message : "Failed to update profile"}`,
        "error",
      );
      console.error("onSubmit error:", error);
    }
  };

  // ── Academic history helpers ──
  const saveHistory = async (
    history: AcademicHistoryEntry[],
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          academicHistory: history,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        return true;
      } else {
        toast(await getErrorMessage(res, "Failed to save history"), "error");
        return false;
      }
    } catch (error) {
      toast(
        `Network error: ${error instanceof Error ? error.message : "Failed to save history"}`,
        "error",
      );
      console.error("saveHistory error:", error);
      return false;
    }
  };

  const openAddEntry = () => {
    setEditingEntry(null)
    tlReset({ year: String(new Date().getFullYear()), title: '', description: '' })
    setTimelineModalOpen(true)
  }

  const openEditEntry = (index: number, entry: AcademicHistoryEntry) => {
    setEditingEntry({ index, entry })
    tlReset({ year: entry.year, title: entry.title, description: entry.description ?? '' })
    setTimelineModalOpen(true)
  }

  const onTimelineSubmit = async (data: TimelineFormData) => {
    const current = [...(profile?.academicHistory ?? [])]
    if (editingEntry !== null) {
      current[editingEntry.index] = data
    } else {
      current.push(data)
    }
    // sort descending by year
    current.sort((a, b) => b.year.localeCompare(a.year))
    const success = await saveHistory(current);
    if (success) {
      toast("Academic history saved!", "success");
      setTimelineModalOpen(false);
    }
  }

  const executeDeleteEntry = async () => {
    if (deleteEntryIndex === null) return;
    const current = [...(profile?.academicHistory ?? [])];
    current.splice(deleteEntryIndex, 1);
    const success = await saveHistory(current);
    if (success) {
      setDeleteEntryIndex(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* ── Avatar + Identity card ── */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <div className="flex items-start gap-5">
          {/* Avatar with upload overlay */}
          <div className="relative group shrink-0">
            {user?.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt={user.fullName ?? "Teacher"}
                width={80}
                height={80}
                className="h-20 w-20 rounded-full object-cover ring-2 ring-indigo-200 dark:ring-indigo-800"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-3xl">
                {(profile?.name ?? "T").charAt(0).toUpperCase()}
              </div>
            )}

            {/* Upload overlay button */}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-wait"
              title="Change avatar"
            >
              {avatarUploading ? (
                <svg
                  className="h-5 w-5 text-white animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {profile?.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {profile?.email}
            </p>
            {profile?.department && (
              <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                {profile.department}
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Hover avatar to change photo
            </p>
          </div>
        </div>

        {profile?.subjects && profile.subjects.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.subjects.map((s, index) => (
              <span
                key={`${s}-${index}`}
                className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-400"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Profile Details ── */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Profile Details
          </h3>
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
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
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input {...register("name")} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Phone
                </label>
                <input
                  {...register("phone")}
                  className="input w-full"
                  placeholder="+91 9876543210"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <input
                {...register("department")}
                className="input w-full"
                placeholder="Computer Science & Engineering"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Subjects (comma-separated)
              </label>
              <input
                {...register("subjectsRaw")}
                className="input w-full"
                placeholder="Mathematics, Physics, Programming"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Bio
              </label>
              <textarea
                {...register("bio")}
                rows={4}
                className="input w-full resize-none"
                placeholder="Write something about yourself…"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button loading={isSubmitting} type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <dl className="space-y-4">
            {[
              { label: "Full Name", value: profile?.name },
              { label: "Email", value: profile?.email },
              { label: "Phone", value: profile?.phone || "—" },
              { label: "Department", value: profile?.department || "—" },
              {
                label: "Subjects",
                value: profile?.subjects?.join(", ") || "—",
              },
              { label: "Bio", value: profile?.bio || "—" },
              {
                label: "Member since",
                value: (() => {
                  if (!profile?.createdAt) return "—";
                  const d = new Date(profile.createdAt);
                  if (isNaN(d.getTime())) return "—";
                  return d.toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  });
                })(),
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-4">
                <dt className="w-32 shrink-0 text-sm text-gray-500 dark:text-slate-400">
                  {label}
                </dt>
                <dd className="text-sm text-gray-900 dark:text-white flex-1">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* ── Academic History Timeline ── */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Academic History
          </h3>
          <Button size="sm" variant="outline" onClick={openAddEntry}>
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
            Add Entry
          </Button>
        </div>

        {!profile?.academicHistory?.length ? (
          <div className="text-center py-8">
            <svg
              className="mx-auto h-10 w-10 text-gray-300 dark:text-slate-600 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            <p className="text-sm text-gray-400 dark:text-slate-500">
              No academic history yet.
            </p>
            <button
              onClick={openAddEntry}
              className="mt-2 text-sm text-indigo-500 hover:underline"
            >
              Add your first entry
            </button>
          </div>
        ) : (
          <ol className="relative border-l border-gray-200 dark:border-slate-700 ml-3 space-y-6">
            {profile.academicHistory.map((entry, i) => (
              <li key={i} className="ml-6">
                {/* Timeline dot */}
                <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 ring-4 ring-white dark:ring-slate-800">
                  <svg
                    className="h-3 w-3 text-indigo-600 dark:text-indigo-400"
                    fill="currentColor"
                    viewBox="0 0 8 8"
                  >
                    <circle cx="4" cy="4" r="3" />
                  </svg>
                </span>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded px-2 py-0.5 mb-1">
                      {entry.year}
                    </span>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {entry.title}
                    </h4>
                    {entry.description && (
                      <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                        {entry.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEditEntry(i, entry)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-600 transition-colors"
                    >
                      <svg
                        className="h-3.5 w-3.5"
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
                      onClick={() => setDeleteEntryIndex(i)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
                    >
                      <svg
                        className="h-3.5 w-3.5"
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
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Delete history entry confirm */}
      <ConfirmModal
        open={deleteEntryIndex !== null}
        title="Remove entry?"
        message="This academic history entry will be permanently removed."
        confirmLabel="Remove"
        onConfirm={executeDeleteEntry}
        onCancel={() => setDeleteEntryIndex(null)}
      />

      {/* ── Timeline Entry Modal ── */}
      {timelineModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40"
            onClick={() => setTimelineModalOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                {editingEntry !== null ? "Edit Entry" : "Add Academic History"}
              </h3>
              <form
                onSubmit={tlHandleSubmit(onTimelineSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Year *
                    </label>
                    <input
                      {...tlRegister("year", {
                        required: true,
                        pattern: /^\d{4}$/,
                      })}
                      className="input w-full"
                      placeholder="2022"
                      maxLength={4}
                    />
                    {tlErrors.year && (
                      <p className="text-xs text-red-500 mt-1">
                        Enter a 4-digit year
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Title *
                    </label>
                    <input
                      {...tlRegister("title", { required: true })}
                      className="input w-full"
                      placeholder="e.g. M.Tech Completed"
                    />
                    {tlErrors.title && (
                      <p className="text-xs text-red-500 mt-1">Required</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea
                    {...tlRegister("description")}
                    rows={3}
                    className="input w-full resize-none"
                    placeholder="Brief description…"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setTimelineModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button loading={tlSubmitting} type="submit">
                    {editingEntry !== null ? "Update" : "Add Entry"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
