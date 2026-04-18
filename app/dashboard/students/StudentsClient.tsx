'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface Student {
  _id: string
  name: string
  rollNo: string
  class: string
  email: string
  phone: string
  parentName: string
  parentPhone: string
  createdAt?: string
}

interface AttendanceRecord {
  _id: string
  studentId: string
  status: 'present' | 'absent' | 'late'
  date: string
  class: string
}

interface GradeRecord {
  _id: string
  subject: string
  marks: number
  maxMarks: number
  grade: string
  term: string
}

interface FormData {
  name: string
  rollNo: string
  class: string
  email: string
  phone: string
  parentName: string
  parentPhone: string
}

type SortKey = "name" | "rollNo" | "class";
type SortDir = "asc" | "desc";

const GRADE_COLOR: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  'A+': 'success', A: 'success', 'B+': 'info', B: 'info', C: 'warning', D: 'warning', F: 'danger',
}

// Derive a consistent avatar color from a name string
const AVATAR_COLORS = [
  'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
  'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
  'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
]

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// Mini attendance heatmap — last 5 weeks (35 days)
function AttendanceHeatmap({ records }: { records: AttendanceRecord[] }) {
  const byDate = useMemo(() => {
    const map: Record<string, AttendanceRecord['status']> = {}
    for (const r of records) map[r.date.slice(0, 10)] = r.status
    return map
  }, [records])

  const days = useMemo(() => {
    const arr: string[] = []
    const today = new Date()
    for (let i = 34; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      arr.push(d.toISOString().slice(0, 10))
    }
    return arr
  }, [])

  const statusColor: Record<string, string> = {
    present: 'bg-emerald-400 dark:bg-emerald-500',
    absent: 'bg-red-400 dark:bg-red-500',
    late: 'bg-amber-400 dark:bg-amber-500',
  }

  return (
    <div>
      <div className="flex gap-1 flex-wrap">
        {days.map((d) => {
          const status = byDate[d]
          return (
            <div
              key={d}
              title={`${d}: ${status ?? 'no record'}`}
              className={`h-4 w-4 rounded-sm ${status ? statusColor[status] : 'bg-gray-100 dark:bg-slate-700'}`}
            />
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-2">
        {[
          { label: 'Present', color: 'bg-emerald-400' },
          { label: 'Absent', color: 'bg-red-400' },
          { label: 'Late', color: 'bg-amber-400' },
          { label: 'No record', color: 'bg-gray-200 dark:bg-slate-700' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`h-3 w-3 rounded-sm ${color}`} />
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Slide-in drawer with exit animation
function StudentDrawer({
  student,
  onClose,
  onEdit,
}: {
  student: Student
  onClose: () => void
  onEdit: () => void
}) {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [grades, setGrades] = useState<GradeRecord[]>([])
  const [loadingDetails, setLoadingDetails] = useState(true)
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

  useEffect(() => {
    async function load() {
      setLoadingDetails(true)
      try {
        const [attRes, gradeRes] = await Promise.all([
          fetch(`/api/attendance?studentId=${student._id}`),
          fetch(`/api/grades?studentId=${student._id}`),
        ])
        const attData = attRes.ok ? await attRes.json() : []
        const gradeData = gradeRes.ok ? await gradeRes.json() : []
        setAttendance(Array.isArray(attData) ? attData : [])
        setGrades(Array.isArray(gradeData) ? gradeData : [])
      } catch {
        // silently fail — drawer still shows static info
      } finally {
        setLoadingDetails(false)
      }
    }
    load()
  }, [student._id])

  const attendanceSummary = useMemo(() => {
    const total = attendance.length
    const present = attendance.filter((r) => r.status === 'present').length
    const absent = attendance.filter((r) => r.status === 'absent').length
    const late = attendance.filter((r) => r.status === 'late').length
    const pct = total > 0 ? Math.round((present / total) * 100) : null
    return { total, present, absent, late, pct }
  }, [attendance])

  const recentGrades = useMemo(() => {
    const TERM_ORDER = [
      "Term 1",
      "Term 2",
      "Term 3",
      "Term 4",
      "Semester 1",
      "Semester 2",
      "Semester 3",
      "Semester 4",
      "Semester 5",
      "Semester 6",
      "Semester 7",
      "Semester 8",
    ];
    const SEASON_ORDER: Record<string, number> = {
      Spring: 1,
      Summer: 2,
      Fall: 3,
      Winter: 4,
    };
    const termRank = (term: string): number => {
      const i = TERM_ORDER.indexOf(term);
      if (i !== -1) return 1000 + i;
      const parts = term.split(" ");
      const season = parts[0] || "";
      const year = parseInt(parts[1] || "0", 10);
      const seasonVal = SEASON_ORDER[season] ?? 0;
      return year * 100 + seasonVal;
    };
    const sortedGrades = [...grades].sort((a, b) => termRank(b.term) - termRank(a.term));
    return sortedGrades.slice(0, 6);
  }, [grades]);

  const cgpa = useMemo(() => {
    const GRADE_POINT: Record<string, number> = { 'A+': 10, A: 9, 'B+': 8, B: 7, C: 6, D: 5, F: 0 }
    if (!grades.length) return null
    const sum = grades.reduce((s, g) => s + (GRADE_POINT[g.grade] ?? 0), 0)
    return (sum / grades.length).toFixed(2)
  }, [grades])

  const color = avatarColor(student.name);

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
            Student Details
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
          {/* Avatar + basic info */}
          <div className="flex items-center gap-4">
            <div
              className={`h-16 w-16 rounded-full flex items-center justify-center font-bold text-2xl shrink-0 ${color}`}
            >
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {student.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Roll: {student.rollNo}
              </p>
              <Badge variant="info" className="mt-1">
                {student.class}
              </Badge>
            </div>
          </div>

          {/* Contact info */}
          <div className="rounded-xl border border-gray-100 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
            {[
              {
                label: "Email",
                value: student.email || "—",
                icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
              },
              {
                label: "Phone",
                value: student.phone || "—",
                icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
              },
              {
                label: "Parent",
                value: student.parentName || "—",
                icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
              },
              {
                label: "Parent Phone",
                value: student.parentPhone || "—",
                icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
              },
            ].map(({ label, value, icon }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3">
                <svg
                  className="h-4 w-4 text-gray-400 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={icon}
                  />
                </svg>
                <span className="text-xs text-gray-400 w-20 shrink-0">
                  {label}
                </span>
                <span className="text-sm text-gray-700 dark:text-slate-200 truncate">
                  {value}
                </span>
              </div>
            ))}
          </div>

          {loadingDetails ? (
            <TableSkeleton rows={3} />
          ) : (
            <>
              {/* Attendance */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">
                  Attendance
                </h4>
                {attendanceSummary.total === 0 ? (
                  <p className="text-xs text-gray-400">
                    No attendance records found.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (attendanceSummary.pct ?? 0) >= 75
                              ? "bg-emerald-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${attendanceSummary.pct ?? 0}%` }}
                        />
                      </div>
                      <span
                        className={`text-sm font-bold shrink-0 ${
                          (attendanceSummary.pct ?? 0) >= 75
                            ? "text-emerald-600"
                            : "text-red-500"
                        }`}
                      >
                        {attendanceSummary.pct}%
                      </span>
                    </div>
                    {(attendanceSummary.pct ?? 0) < 75 && (
                      <p className="text-xs text-red-500 mb-2 flex items-center gap-1">
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
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        Below 75% attendance threshold
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-center mb-4">
                      {[
                        {
                          label: "Present",
                          value: attendanceSummary.present,
                          color: "text-emerald-600 dark:text-emerald-400",
                        },
                        {
                          label: "Absent",
                          value: attendanceSummary.absent,
                          color: "text-red-500",
                        },
                        {
                          label: "Late",
                          value: attendanceSummary.late,
                          color: "text-amber-500",
                        },
                      ].map(({ label, value, color }) => (
                        <div
                          key={label}
                          className="rounded-xl bg-gray-50 dark:bg-slate-800 py-3"
                        >
                          <p className={`text-xl font-bold ${color}`}>
                            {value}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                    {/* Heatmap — last 35 days */}
                    <p className="text-xs text-gray-400 mb-2">Last 35 days</p>
                    <AttendanceHeatmap records={attendance} />
                  </>
                )}
              </div>

              {/* Grades */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                    Grades
                  </h4>
                  {cgpa && (
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      CGPA:{" "}
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {cgpa}
                      </span>
                    </span>
                  )}
                </div>
                {recentGrades.length === 0 ? (
                  <p className="text-xs text-gray-400">No grades recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {recentGrades.map((g) => (
                      <div
                        key={g._id}
                        className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-slate-800 px-4 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 dark:text-slate-200 truncate">
                            {g.subject}
                          </p>
                          <p className="text-xs text-gray-400">{g.term}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-700 dark:text-slate-200 shrink-0">
                          {g.marks}/{g.maxMarks}
                        </span>
                        <Badge
                          variant={GRADE_COLOR[g.grade] ?? "default"}
                          className="shrink-0"
                        >
                          {g.grade}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Sort icon
function SortIcon({ dir }: { dir: SortDir | null }) {
  if (!dir) return (
    <svg className="h-3.5 w-3.5 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  )
  return (
    <svg className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  )
}

export function StudentsClient() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [drawerStudent, setDrawerStudent] = useState<Student | null>(null);
  const [groupByClass, setGroupByClass] = useState(false);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Class filter
  const [classFilter, setClassFilter] = useState<string>("all");

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Single delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Visible columns (desktop)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormData>();

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (classFilter !== "all") params.set("class", classFilter);
      const res = await fetch(`/api/students?${params}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg =
          typeof (errBody as { error?: string }).error === "string"
            ? (errBody as { error: string }).error
            : `Request failed (${res.status})`;
        throw new Error(msg);
      }
      const data = await res.json();
      setStudents(data.students ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load students", "error");
      setStudents([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, classFilter, toast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Unique classes for filter dropdown — derive from all loaded students on current page
  const uniqueClasses = useMemo(() => {
    const set = new Set(students.map((s) => s.class));
    return ["all", ...Array.from(set).sort()];
  }, [students]);

  // Sort + filter pipeline (client-side sorting, server-side filtering now handles class filter)
  const visibleStudents = useMemo(() => {
    let list = students; // Already filtered by server if classFilter !== 'all'
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = a[sortKey].toLowerCase();
        const bv = b[sortKey].toLowerCase();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return list;
  }, [students, sortKey, sortDir]);

  // Group for grouped view
  const grouped = useMemo(() => {
    if (!groupByClass) return null;
    const map: Record<string, Student[]> = {};
    for (const s of visibleStudents) (map[s.class] ??= []).push(s);
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [visibleStudents, groupByClass]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next;
    });
  }

  function toggleAllVisible() {
    const visibleIds = visibleStudents.map((s) => s._id);
    const allSelected = visibleIds.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  }

  function toggleColumn(col: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) { next.delete(col) } else { next.add(col) }
      return next;
    });
  }

  const openAdd = () => {
    setEditing(null);
    reset({});
    setModalOpen(true);
  };
  const openEdit = (s: Student) => {
    setEditing(s);
    reset({
      name: s.name,
      rollNo: s.rollNo,
      class: s.class,
      email: s.email,
      phone: s.phone,
      parentName: s.parentName,
      parentPhone: s.parentPhone,
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    const url = editing ? `/api/students/${editing._id}` : "/api/students";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast(editing ? "Student updated!" : "Student added!", "success");
      setModalOpen(false);
      fetchStudents();
    } else {
      let msg = "Something went wrong";
      try {
        const err = await res.json();
        if (typeof err.error === "string") msg = err.error;
        else if (err.error?.fieldErrors) {
          const first = Object.values(
            err.error.fieldErrors as Record<string, string[]>,
          )[0];
          if (first?.[0]) msg = first[0];
        }
      } catch {
        msg = `Error: ${res.status}`;
      }
      toast(msg, "error");
    }
  };

  const confirmDelete = (s: Student) => setDeleteTarget(s);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/students/${deleteTarget._id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    setDeleteTarget(null);
    if (res.ok) {
      toast("Student deleted", "success");
      setSelected((p) => {
        const n = new Set(p);
        n.delete(deleteTarget._id);
        return n;
      });
      fetchStudents();
    } else toast("Failed to delete", "error");
  };

  const executeBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/students/${id}`, { method: "DELETE" })),
    );
    const failed = results.filter(
      (r) =>
        r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok),
    ).length;
    setBulkDeleting(false);
    setBulkConfirmOpen(false);
    setSelected(new Set());
    if (failed === 0)
      toast(
        `${ids.length} student${ids.length !== 1 ? "s" : ""} deleted`,
        "success",
      );
    else toast(`${failed} deletion${failed !== 1 ? "s" : ""} failed`, "error");
    fetchStudents();
  };

  // Optional columns config
  const optionalCols = [
    { key: "contact", label: "Contact" },
    { key: "parent", label: "Parent" },
  ];

  const allVisibleSelected =
    visibleStudents.length > 0 &&
    visibleStudents.every((s) => selected.has(s._id));
  const someSelected = selected.size > 0;

  const tableHeaders: {
    key: SortKey | null;
    label: string;
    colKey?: string;
  }[] = [
    { key: "name", label: "Student" },
    { key: "rollNo", label: "Roll No" },
    { key: "class", label: "Class" },
    { key: null, label: "Contact", colKey: "contact" },
    { key: null, label: "Parent", colKey: "parent" },
    { key: null, label: "Actions" },
  ];

  function StudentRow({ s }: { s: Student }) {
    return (
      <tr className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
        {/* Checkbox */}
        <td className="pl-4 pr-2 py-3 w-8">
          <input
            type="checkbox"
            checked={selected.has(s._id)}
            onChange={() => toggleSelected(s._id)}
            className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
            aria-label={`Select ${s.name}`}
          />
        </td>
        <td className="px-4 py-3">
          <button
            className="flex items-center gap-3 text-left group"
            onClick={() => setDrawerStudent(s)}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold text-sm shrink-0 ${avatarColor(s.name)}`}
            >
              {s.name.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {s.name}
            </span>
          </button>
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
          {s.rollNo}
        </td>
        <td className="px-4 py-3">
          <Badge variant="info">{s.class}</Badge>
        </td>
        {!hiddenCols.has("contact") && (
          <td className="px-4 py-3 text-gray-600 dark:text-slate-300 hidden sm:table-cell">
            {s.phone || s.email || "—"}
          </td>
        )}
        {!hiddenCols.has("parent") && (
          <td className="px-4 py-3 text-gray-600 dark:text-slate-300 hidden md:table-cell">
            {s.parentName || "—"}
          </td>
        )}
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={() => confirmDelete(s)}>
              Delete
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  const tableHead = (
    <thead className="bg-gray-50 dark:bg-slate-900/50">
      <tr>
        <th className="pl-4 pr-2 py-3 w-8">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
            className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
            aria-label="Select all"
          />
        </th>
        {tableHeaders.map(({ key, label, colKey }) => {
          if (colKey && hiddenCols.has(colKey)) return null;
          if (colKey === "contact")
            return (
              <th
                key={label}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 hidden sm:table-cell"
              >
                {label}
              </th>
            );
          if (colKey === "parent")
            return (
              <th
                key={label}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 hidden md:table-cell"
              >
                {label}
              </th>
            );
          return (
            <th
              key={label}
              className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 ${key ? "cursor-pointer select-none hover:text-gray-700 dark:hover:text-slate-200" : ""}`}
              onClick={key ? () => toggleSort(key) : undefined}
            >
              <div className="flex items-center gap-1">
                {label}
                {key && <SortIcon dir={sortKey === key ? sortDir : null} />}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
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
              placeholder="Search students…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-56 pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Class filter */}
          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setPage(1);
            }}
            className="py-2 pl-3 pr-8 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {uniqueClasses.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All Classes" : c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Column visibility */}
          <ColumnToggle
            cols={optionalCols}
            hiddenCols={hiddenCols}
            onToggle={toggleColumn}
          />

          <button
            onClick={() => setGroupByClass((v) => !v)}
            className={`px-3 py-2 text-sm rounded-xl border transition-colors ${
              groupByClass
                ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400"
                : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
            }`}
          >
            Group by Class
          </button>
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
            Add Student
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center justify-between rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-4 py-2.5">
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
            {selected.size} student{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Deselect all
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setBulkConfirmOpen(true)}
            >
              Delete selected
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
            {total} student{total !== 1 ? "s" : ""}
            {classFilter !== "all" && (
              <span className="ml-1 text-gray-400 font-normal">
                · filtered by{" "}
                <span className="font-medium text-indigo-600 dark:text-indigo-400">
                  {classFilter}
                </span>
              </span>
            )}
          </span>
        </div>

        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={6} />
          </div>
        ) : visibleStudents.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">No students found.</p>
            <Button className="mt-4" size="sm" onClick={openAdd}>
              Add your first student
            </Button>
          </div>
        ) : groupByClass && grouped ? (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {grouped.map(([cls, classStudents]) => (
              <div key={cls}>
                <div className="px-6 py-2.5 bg-gray-50 dark:bg-slate-900/40 flex items-center gap-2">
                  <Badge variant="info">{cls}</Badge>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {classStudents.length} student
                    {classStudents.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    {tableHead}
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {classStudents.map((s) => (
                        <StudentRow key={s._id} s={s} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {tableHead}
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {visibleStudents.map((s) => (
                  <StudentRow key={s._id} s={s} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-slate-700">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500 dark:text-slate-400">
              Page {page} of {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Student detail drawer */}
      {drawerStudent && (
        <StudentDrawer
          student={drawerStudent}
          onClose={() => setDrawerStudent(null)}
          onEdit={() => {
            openEdit(drawerStudent!);
          }}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Student" : "Add Student"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                {...register("name", { required: true })}
                className="input w-full"
                placeholder="John Doe"
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">Required</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Roll No *
              </label>
              <input
                {...register("rollNo", { required: true })}
                className="input w-full"
                placeholder="CS-001"
              />
              {errors.rollNo && (
                <p className="text-xs text-red-500 mt-1">Required</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Class *
            </label>
            <input
              {...register("class", { required: true })}
              className="input w-full"
              placeholder="B.Tech 3rd Year - A"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                {...register("email")}
                type="email"
                className="input w-full"
                placeholder="student@email.com"
              />
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Parent Name
              </label>
              <input
                {...register("parentName")}
                className="input w-full"
                placeholder="Parent's name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Parent Phone
              </label>
              <input
                {...register("parentPhone")}
                className="input w-full"
                placeholder="+91 9876543210"
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
              {editing ? "Update" : "Add Student"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Single delete confirm */}
      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete student?"
        message={`This will permanently remove ${deleteTarget?.name ?? "this student"} and all associated records.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Bulk delete confirm */}
      <ConfirmModal
        open={bulkConfirmOpen}
        title={`Delete ${selected.size} student${selected.size !== 1 ? "s" : ""}?`}
        message="This will permanently remove the selected students and all associated records. This cannot be undone."
        confirmLabel={`Delete ${selected.size}`}
        loading={bulkDeleting}
        onConfirm={executeBulkDelete}
        onCancel={() => setBulkConfirmOpen(false)}
      />
    </div>
  );
}

// Column visibility toggle dropdown
function ColumnToggle({
  cols,
  hiddenCols,
  onToggle,
}: {
  cols: { key: string; label: string }[];
  hiddenCols: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors"
        title="Show/hide columns"
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
            d="M3 10h18M3 14h18M10 4v16M14 4v16"
          />
        </svg>
        Columns
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-10 p-2">
          {cols.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={!hiddenCols.has(key)}
                onChange={() => onToggle(key)}
                className="h-4 w-4 rounded accent-indigo-600"
              />
              <span className="text-sm text-gray-700 dark:text-slate-300">
                {label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
