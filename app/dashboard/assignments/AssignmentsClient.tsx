'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface Assignment {
  _id: string
  title: string
  description: string
  subject: string
  class: string
  deadline: string
  status: 'active' | 'closed'
  kanbanStatus: 'todo' | 'in_progress' | 'submitted'
  maxMarks: number
  createdAt: string
}

interface FormData {
  title: string
  description: string
  subject: string
  class: string
  deadline: string
  maxMarks: number
}

type KanbanCol = 'todo' | 'in_progress' | 'submitted'

const COLUMNS: {
  id: KanbanCol;
  title: string;
  accent: string;
  header: string;
}[] = [
  {
    id: "todo",
    title: "To Do",
    accent: "border-t-blue-500",
    header: "bg-blue-50 dark:bg-blue-900/10",
  },
  {
    id: "in_progress",
    title: "In Progress",
    accent: "border-t-amber-500",
    header: "bg-amber-50 dark:bg-amber-900/10",
  },
  {
    id: "submitted",
    title: "Submitted",
    accent: "border-t-emerald-500",
    header: "bg-emerald-50 dark:bg-emerald-900/10",
  },
];

function daysUntil(deadline: string) {
  const t = new Date(deadline).getTime();
  if (!Number.isFinite(t)) return NaN;
  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const days = daysUntil(deadline);
  if (!Number.isFinite(days)) return <Badge variant="default">Invalid date</Badge>;
  if (days < 0) return <Badge variant="danger">Overdue</Badge>;
  if (days <= 2) return <Badge variant="danger">{days}d left</Badge>;
  if (days <= 7) return <Badge variant="warning">{days}d left</Badge>;
  return <Badge variant="success">{days}d left</Badge>;
}

// Assignment detail drawer
function AssignmentDrawer({
  assignment,
  onClose,
  onEdit,
}: {
  assignment: Assignment;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  const days = daysUntil(assignment.deadline);
  const col = COLUMNS.find((c) => c.id === assignment.kanbanStatus);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 dark:bg-black/60 z-40 transition-opacity duration-200 ${closing ? "opacity-0" : "opacity-100"}`}
        onClick={handleClose}
      />
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col overflow-hidden ${closing ? "animate-slide-out" : "animate-slide-in"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Assignment Details
          </h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onEdit();
                handleClose();
              }}
            >
              Edit
            </Button>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title + status */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge
                variant={assignment.status === "active" ? "success" : "default"}
                className="capitalize"
              >
                {assignment.status}
              </Badge>
              {col && <Badge variant="default">{col.title}</Badge>}
              <DeadlineBadge deadline={assignment.deadline} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {assignment.title}
            </h3>
          </div>

          {/* Meta grid */}
          <div className="rounded-xl border border-gray-100 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
            {[
              { label: "Subject", value: assignment.subject },
              { label: "Class", value: assignment.class },
              {
                label: "Deadline",
                value: new Date(assignment.deadline).toLocaleDateString(
                  "en-IN",
                  {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  },
                ),
              },
              { label: "Max Marks", value: String(assignment.maxMarks) },
              {
                label: "Created",
                value: new Date(assignment.createdAt).toLocaleDateString(
                  "en-IN",
                  { year: "numeric", month: "short", day: "numeric" },
                ),
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-3 px-4 py-3">
                <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">
                  {label}
                </span>
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Deadline visual */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Deadline status</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${days < 0 ? "bg-red-500" : days <= 2 ? "bg-red-400" : days <= 7 ? "bg-amber-400" : "bg-emerald-500"}`}
                  style={{
                    width:
                      days < 0
                        ? "100%"
                        : `${Math.max(5, 100 - (Math.min(days, 30) / 30) * 100)}%`,
                  }}
                />
              </div>
              <span
                className={`text-sm font-bold shrink-0 ${days < 0 ? "text-red-500" : days <= 7 ? "text-amber-500" : "text-emerald-600"}`}
              >
                {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
              </span>
            </div>
          </div>

          {/* Description */}
          {assignment.description && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">
                Instructions
              </h4>
              <p className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-wrap rounded-xl bg-gray-50 dark:bg-slate-800 px-4 py-3">
                {assignment.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function AssignmentsClient() {
  const { toast } = useToast()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Assignment | null>(null)
  const [drawerAssignment, setDrawerAssignment] = useState<Assignment | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<KanbanCol | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);

  // Filters
  const [filterClass, setFilterClass] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [search, setSearch] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormData>();

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/assignments?limit=100");
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      const raw: Assignment[] = Array.isArray(data.assignments)
        ? data.assignments
        : Array.isArray(data)
          ? data
          : [];
      setAssignments(
        raw.map((a) => ({
          ...a,
          kanbanStatus:
            a.kanbanStatus ?? (a.status === "closed" ? "submitted" : "todo"),
        })),
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Unique values for filter dropdowns
  const uniqueClasses = useMemo(
    () => [
      "all",
      ...Array.from(new Set(assignments.map((a) => a.class))).sort(),
    ],
    [assignments],
  );
  const uniqueSubjects = useMemo(
    () => [
      "all",
      ...Array.from(new Set(assignments.map((a) => a.subject))).sort(),
    ],
    [assignments],
  );

  // Filtered set
  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      if (filterClass !== "all" && a.class !== filterClass) return false;
      if (filterSubject !== "all" && a.subject !== filterSubject) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !a.title.toLowerCase().includes(q) &&
          !a.subject.toLowerCase().includes(q) &&
          !a.class.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [assignments, filterClass, filterSubject, search]);

  const openAdd = () => {
    setEditing(null);
    reset({ maxMarks: 100 });
    setModalOpen(true);
  };
  const openEdit = (a: Assignment) => {
    setEditing(a);
    reset({
      title: a.title,
      description: a.description,
      subject: a.subject,
      class: a.class,
      deadline: a.deadline,
      maxMarks: a.maxMarks,
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    const url = editing
      ? `/api/assignments/${editing._id}`
      : "/api/assignments";
    const method = editing ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, maxMarks: Number(data.maxMarks) }),
      });
      if (res.ok) {
        toast(
          editing ? "Assignment updated!" : "Assignment created!",
          "success",
        );
        setModalOpen(false);
        fetchAssignments();
      } else toast("Failed to save", "error");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Network error", "error");
    }
  };

  const moveCard = async (id: string, col: KanbanCol) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a._id === id
          ? {
              ...a,
              kanbanStatus: col,
              status: col === "submitted" ? "closed" : "active",
            }
          : a,
      ),
    );
    try {
      await fetch(`/api/assignments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kanbanStatus: col,
          status: col === "submitted" ? "closed" : "active",
        }),
      });
    } catch (error) {
      fetchAssignments();
      toast(
        `Failed to move assignment: ${error instanceof Error ? error.message : "Network error"}`,
        "error",
      );
      console.error("moveCard error:", error);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/assignments/${deleteTarget._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast("Deleted", "success");
        fetchAssignments();
      } else toast("Failed to delete", "error");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Network error", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  // Drag handlers
  const onDragStart = (e: React.DragEvent, id: string) => {
    draggingRef.current = id;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragEnd = () => {
    setDragId(null);
    setDragOverCol(null);
    setDragOverId(null);
    draggingRef.current = null;
  };
  const onDragOver = (e: React.DragEvent, col: KanbanCol, cardId?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(col);
    setDragOverId(cardId ?? null);
  };
  const onDrop = (e: React.DragEvent, col: KanbanCol) => {
    e.preventDefault();
    const id = draggingRef.current;
    if (id) {
      const a = assignments.find((x) => x._id === id);
      if (a && a.kanbanStatus !== col) moveCard(id, col);
    }
    setDragId(null);
    setDragOverCol(null);
    setDragOverId(null);
  };

  const columnAssignments = (col: KanbanCol) =>
    filtered.filter((a) => (a.kanbanStatus ?? "todo") === col);

  const activeFilters =
    (filterClass !== "all" ? 1 : 0) +
    (filterSubject !== "all" ? 1 : 0) +
    (search ? 1 : 0);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-100">
        {COLUMNS.map((col) => (
          <div key={col.id} className={`rounded-2xl border-t-4 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 animate-pulse ${col.accent}`}>
            <div className="h-5 w-24 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-gray-100 dark:bg-slate-700/50 p-4 mb-3 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded w-1/2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44 pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {/* Class filter */}
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="py-2 pl-3 pr-8 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {uniqueClasses.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All Classes" : c}
              </option>
            ))}
          </select>
          {/* Subject filter */}
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="py-2 pl-3 pr-8 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {uniqueSubjects.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All Subjects" : s}
              </option>
            ))}
          </select>
          {activeFilters > 0 && (
            <button
              onClick={() => {
                setFilterClass("all");
                setFilterSubject("all");
                setSearch("");
              }}
              className="px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Clear filters ({activeFilters})
            </button>
          )}
        </div>

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
          New Assignment
        </Button>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-400 dark:text-slate-500">
        Drag cards between columns · Click a card to see full details
      </p>

      {/* Kanban */}
      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-slate-600 py-20 text-center">
          <p className="text-gray-400 text-sm mb-4">No assignments yet.</p>
          <Button size="sm" onClick={openAdd}>
            Create first assignment
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {COLUMNS.map((col) => {
            const cards = columnAssignments(col.id);
            const isDragTarget = dragOverCol === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => onDragOver(e, col.id)}
                onDragLeave={(e) => {
                  // Only clear if leaving the column entirely
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverCol(null);
                    setDragOverId(null);
                  }
                }}
                onDrop={(e) => onDrop(e, col.id)}
                className={`rounded-2xl border-t-4 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all duration-150 ${col.accent} ${
                  isDragTarget
                    ? "ring-2 ring-indigo-400 dark:ring-indigo-500 shadow-lg scale-[1.01]"
                    : ""
                }`}
              >
                {/* Column header */}
                <div
                  className={`px-4 py-3 flex items-center justify-between rounded-t-xl ${col.header}`}
                >
                  <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                    {col.title}
                  </span>
                  <span className="text-xs font-medium bg-white/80 dark:bg-slate-700/80 text-gray-600 dark:text-slate-300 rounded-full px-2 py-0.5">
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="p-3 space-y-3 min-h-30">
                  {cards.length === 0 && (
                    <div
                      className={`flex items-center justify-center h-20 rounded-xl border-2 border-dashed text-xs text-gray-400 dark:text-slate-500 transition-colors ${
                        isDragTarget
                          ? "border-indigo-400 text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10"
                          : "border-gray-200 dark:border-slate-700"
                      }`}
                    >
                      Drop here
                    </div>
                  )}
                  {cards.map((a) => {
                    const isDragging = dragId === a._id;
                    const isDragOver = dragOverId === a._id && dragId !== a._id;
                    return (
                      <div
                        key={a._id}
                        draggable
                        onDragStart={(e) => onDragStart(e, a._id)}
                        onDragEnd={onDragEnd}
                        onDragOver={(e) => {
                          e.stopPropagation();
                          onDragOver(e, col.id, a._id);
                        }}
                        className={`rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
                          isDragging
                            ? "opacity-40 scale-95 rotate-1 shadow-none"
                            : isDragOver
                              ? "border-indigo-300 dark:border-indigo-600 shadow-md -translate-y-1"
                              : "hover:shadow-md hover:-translate-y-0.5"
                        }`}
                      >
                        {/* Clickable area for detail drawer */}
                        <div
                          onClick={() => !isDragging && setDrawerAssignment(a)}
                          className="cursor-pointer"
                        >
                          {/* Card header */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                              {a.title}
                            </h3>
                            <DeadlineBadge deadline={a.deadline} />
                          </div>

                          {a.description && (
                            <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 mb-2">
                              {a.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1.5 mb-2">
                            <Badge variant="info" className="text-xs">
                              {a.subject}
                            </Badge>
                            <Badge variant="default" className="text-xs">
                              {a.class}
                            </Badge>
                            <Badge variant="purple" className="text-xs">
                              {a.maxMarks}m
                            </Badge>
                          </div>

                          <p className="text-xs text-gray-400 dark:text-slate-500">
                            Due{" "}
                            {new Date(a.deadline).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        </div>

                        {/* Card actions — stop click bubbling to detail drawer */}
                        <div
                          className="flex gap-1.5 pt-2 mt-2 border-t border-gray-100 dark:border-slate-700/50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => openEdit(a)}
                            className="flex-1 text-xs py-1 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            Edit
                          </button>
                          {COLUMNS.filter((c) => c.id !== col.id).map((c) => (
                            <button
                              key={c.id}
                              onClick={() => moveCard(a._id, c.id)}
                              className="flex-1 text-xs py-1 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors truncate"
                              title={`Move to ${c.title}`}
                            >
                              → {c.title}
                            </button>
                          ))}
                          <button
                            onClick={() => setDeleteTarget(a)}
                            className="text-xs py-1 px-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete"
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
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assignment detail drawer */}
      {drawerAssignment && (
        <AssignmentDrawer
          assignment={drawerAssignment}
          onClose={() => setDrawerAssignment(null)}
          onEdit={() => {
            openEdit(drawerAssignment!);
            setDrawerAssignment(null);
          }}
        />
      )}

      {/* Delete confirm */}
      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete assignment?"
        message={`"${deleteTarget?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Assignment" : "Create Assignment"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Title *
            </label>
            <input
              {...register("title", { required: true })}
              className="input w-full"
              placeholder="Assignment title"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-500">Required</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              {...register("description")}
              rows={3}
              className="input w-full resize-none"
              placeholder="Instructions…"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Subject *
              </label>
              <input
                {...register("subject", { required: true })}
                className="input w-full"
                placeholder="Mathematics"
              />
              {errors.subject && (
                <p className="mt-1 text-xs text-red-500">Required</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Class *
              </label>
              <input
                {...register("class", { required: true })}
                className="input w-full"
                placeholder="B.Tech 3rd - A"
              />
              {errors.class && (
                <p className="mt-1 text-xs text-red-500">Required</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Deadline *
              </label>
              <input
                {...register("deadline", { required: true })}
                type="date"
                className="input w-full"
              />
              {errors.deadline && (
                <p className="mt-1 text-xs text-red-500">Required</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Max Marks
              </label>
              <input
                {...register("maxMarks", { valueAsNumber: true })}
                type="number"
                min="1"
                className="input w-full"
                defaultValue={100}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button loading={isSubmitting} type="submit">
              {editing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
