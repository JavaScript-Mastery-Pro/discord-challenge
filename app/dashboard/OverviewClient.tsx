'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { daysUntilDateOnly } from '@/lib/date'

interface Stats {
  totalStudents: number
  totalAssignments: number
  pendingAssignments: number
  attendancePct: number
  attendanceBreakdown: { present: number; absent: number; late: number }
  attendanceTrend: { date: string; present: number; absent: number }[]
  cgpaTrend: { term: string; cgpa: number }[]
  gradeDistribution: { grade: string; count: number }[]
  upcomingDeadlines: { _id: string; title: string; subject: string; class: string; deadline: string; daysLeft: number }[]
  recentAnnouncements: { _id: string; title: string; createdAt: string }[]
  recentStudents: { _id: string; name: string; class: string; rollNo: string }[]
}

const RING_COLORS = ['#10b981', '#ef4444', '#f59e0b']

// Avatar colors for students (matches Students page logic)
const AVATAR_COLORS = [
  'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
]
function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function StatCard({
  label,
  value,
  sub,
  color,
  icon,
  href,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ReactNode;
  href?: string;
  trend?: { delta: number; label: string };
}) {
  const inner = (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 flex items-start gap-4 transition-shadow hover:shadow-lg cursor-pointer">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${color} text-white shrink-0`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
          {value}
        </p>
        {trend ? (
          <div className="flex items-center gap-1 mt-1">
            <span
              className={`text-xs font-medium ${trend.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : trend.delta < 0 ? "text-red-500" : "text-gray-400"}`}
            >
              {trend.delta > 0 ? "↑" : trend.delta < 0 ? "↓" : "—"}{" "}
              {Math.abs(trend.delta)} {trend.label}
            </span>
          </div>
        ) : sub ? (
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function AttendanceRing({ pct, present, absent, late }: { pct: number; present: number; absent: number; late: number }) {
  const total = present + absent + late
  if (total === 0) return <p className="text-sm text-gray-400 text-center py-6">No attendance data yet.</p>

  const data = [
    { name: 'Present', value: present },
    { name: 'Absent', value: absent },
    { name: 'Late', value: late },
  ]

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <ResponsiveContainer width={280} height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={85}
              outerRadius={120}
              paddingAngle={2}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={RING_COLORS[i]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => {
                const n = Number(v)
                return [`${n} (${total > 0 ? Math.round((n / total) * 100) : 0}%)`]
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {pct}%
          </span>
          <span className="text-sm text-gray-500 dark:text-slate-400">
            Present
          </span>
        </div>
      </div>
      <div className="flex gap-6 mt-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          Present {present}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          Absent {absent}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-amber-500" />
          Late {late}
        </span>
      </div>
    </div>
  );
}

// CGPA empty state illustration
function CgpaEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <svg className="h-14 w-14 text-gray-200 dark:text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-sm text-gray-400 dark:text-slate-500">No grade data yet.</p>
      <Link href="/dashboard/grades" className="mt-2 text-xs text-indigo-500 hover:underline">Add grades →</Link>
    </div>
  )
}

const QUICK_ACTIONS = [
  { label: 'Mark Attendance', href: '/dashboard/attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', color: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' },
  { label: 'Add Grade', href: '/dashboard/grades', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', color: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400' },
  { label: 'New Assignment', href: '/dashboard/assignments', icon: 'M12 4v16m8-8H4', color: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' },
  { label: 'Post Announcement', href: '/dashboard/announcements', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z', color: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' },
]

export function OverviewClient() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const fetchAllAssignments = async () => {
        const parseAssignments = (
          data: unknown,
        ): {
          assignments: {
            _id: string;
            title: string;
            subject: string;
            class: string;
            deadline: string;
            status: string;
          }[];
          total: number | null;
        } => {
          if (
            data &&
            typeof data === "object" &&
            Array.isArray((data as { assignments?: unknown }).assignments)
          ) {
            return {
              assignments: (data as {
                assignments: {
                  _id: string;
                  title: string;
                  subject: string;
                  class: string;
                  deadline: string;
                  status: string;
                }[];
              }).assignments,
              total:
                typeof (data as { total?: unknown }).total === "number"
                  ? (data as { total: number }).total
                  : null,
            };
          }

          return {
            assignments: Array.isArray(data)
              ? (data as {
                  _id: string;
                  title: string;
                  subject: string;
                  class: string;
                  deadline: string;
                  status: string;
                }[])
              : [],
            total: null,
          };
        };

        const firstRes = await fetch("/api/assignments?limit=100&page=1");
        if (!firstRes.ok) {
          throw new Error(`Assignments: ${firstRes.status}`);
        }

        const firstData = await firstRes.json();
        const firstPage = parseAssignments(firstData);
        const totalPages =
          firstData &&
          typeof firstData === "object" &&
          !Array.isArray(firstData) &&
          typeof (firstData as { pages?: unknown }).pages === "number"
            ? Math.max(1, (firstData as { pages: number }).pages)
            : 1;

        let allAssignments = firstPage.assignments;

        if (totalPages > 1) {
          const remainingPages = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, index) =>
              fetch(`/api/assignments?limit=100&page=${index + 2}`).then(
                async (res) => {
                  if (!res.ok) {
                    throw new Error(`Assignments: ${res.status}`);
                  }

                  return res.json();
                },
              ),
            ),
          );

          allAssignments = allAssignments.concat(
            ...remainingPages.map((page) => parseAssignments(page).assignments),
          );
        }

        return {
          assignments: allAssignments,
          total: firstPage.total,
        };
      };

      const [
        studentsRes,
        assignmentsData,
        activeAssignmentsRes,
        attendanceRes,
        gradesRes,
        announcementsRes,
      ] = await Promise.all([
        fetch("/api/students?limit=5"),
        fetchAllAssignments(),
        fetch("/api/assignments?status=active&limit=1"),
        fetch("/api/attendance"),
        fetch("/api/grades"),
        fetch("/api/announcements?limit=5"),
      ]);

      const [
        students,
        activeAssignmentsData,
        attendance,
        grades,
        announcements,
      ] =
        await Promise.all([
          studentsRes.json(),
          activeAssignmentsRes.json(),
          attendanceRes.json(),
          gradesRes.json(),
          announcementsRes.json(),
        ]);

      const assignments = assignmentsData.assignments;
      const activeAssignments =
        activeAssignmentsData.assignments ?? activeAssignmentsData;

      // ── Attendance ──
      const dateMap: Record<
        string,
        { present: number; absent: number; late: number }
      > = {};
      let totalPresent = 0,
        totalAbsent = 0,
        totalLate = 0;
      for (const rec of attendance) {
        if (!dateMap[rec.date])
          dateMap[rec.date] = { present: 0, absent: 0, late: 0 };
        // Validate status before using it
        const validStatuses = ["present", "absent", "late"];
        if (!validStatuses.includes(rec.status)) {
          console.warn(
            `Unknown attendance status: ${rec.status}, skipping record`,
          );
          continue;
        }
        dateMap[rec.date][rec.status as "present" | "absent" | "late"]++;
        if (rec.status === "present") totalPresent++;
        else if (rec.status === "absent") totalAbsent++;
        else if (rec.status === "late") totalLate++;
      }
      const total = totalPresent + totalAbsent + totalLate;
      const attendancePct =
        total > 0 ? Math.round((totalPresent / total) * 100) : 0;
      const attendanceTrend = Object.entries(dateMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-7)
        .map(([date, v]) => ({
          date: date.slice(5),
          present: v.present,
          absent: v.absent,
        }));

      // ── CGPA trend ──
      const GRADE_POINT: Record<string, number> = {
        "A+": 10,
        A: 9,
        "B+": 8,
        B: 7,
        C: 6,
        D: 5,
        F: 0,
      };
      const termMap: Record<string, number[]> = {};
      for (const g of grades) {
        (termMap[g.term] ??= []).push(GRADE_POINT[g.grade] ?? 0);
      }
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
      const cgpaTrend = Object.entries(termMap)
        .sort(([a], [b]) => {
          const ai = TERM_ORDER.indexOf(a),
            bi = TERM_ORDER.indexOf(b);
          if (ai !== -1 && bi !== -1) return ai - bi;
          return a.localeCompare(b);
        })
        .map(([term, pts]) => ({
          term,
          cgpa: parseFloat(
            (pts.reduce((s, p) => s + p, 0) / pts.length).toFixed(2),
          ),
        }));

      // ── Grade distribution ──
      const gradeCounts: Record<string, number> = {};
      for (const g of grades)
        gradeCounts[g.grade || "N/A"] =
          (gradeCounts[g.grade || "N/A"] || 0) + 1;
      const gradeDistribution = Object.entries(gradeCounts).map(
        ([grade, count]) => ({ grade, count }),
      );

      // ── Upcoming deadlines ──
      const upcomingDeadlines = (
        assignments as {
          _id: string;
          title: string;
          subject: string;
          class: string;
          deadline: string;
          status: string;
        }[]
      )
        .filter((a) => a.status === "active")
        .map((a) => ({
          ...a,
          daysLeft: daysUntilDateOnly(a.deadline) ?? 0,
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 5);

      setStats({
        totalStudents:
          typeof students.total === "number"
            ? students.total
            : (students.students?.length ?? 0),
        totalAssignments:
          typeof assignmentsData.total === "number"
            ? assignmentsData.total
            : (Array.isArray(assignments) ? assignments.length : 0),
        pendingAssignments:
          typeof activeAssignmentsData.total === "number"
            ? activeAssignmentsData.total
            : (Array.isArray(activeAssignments) ? activeAssignments.length : 0),
        attendancePct,
        attendanceBreakdown: {
          present: totalPresent,
          absent: totalAbsent,
          late: totalLate,
        },
        attendanceTrend,
        cgpaTrend,
        gradeDistribution,
        upcomingDeadlines,
        recentAnnouncements: announcements.slice(0, 5),
        recentStudents: students.students?.slice(0, 5) ?? [],
      });
      setLastRefreshed(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500 text-white shrink-0">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
              Failed to load dashboard
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {error}
            </p>
            <button
              onClick={() => load()}
              className="mt-3 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Compute stat card deltas
  const overdueCount = stats.upcomingDeadlines.filter(
    (d) => d.daysLeft < 0,
  ).length;
  const criticalCount = stats.upcomingDeadlines.filter(
    (d) => d.daysLeft >= 0 && d.daysLeft <= 2,
  ).length;

  return (
    <div className="space-y-6 page-enter">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block">
              Updated{" "}
              {lastRefreshed.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Students"
          value={stats.totalStudents}
          color="bg-indigo-500"
          href="/dashboard/students"
          sub="Enrolled this year"
          icon={
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          }
        />
        <StatCard
          label="Total Assignments"
          value={stats.totalAssignments}
          color="bg-emerald-500"
          href="/dashboard/assignments"
          trend={{ delta: stats.pendingAssignments, label: "active" }}
          icon={
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        />
        <StatCard
          label="Attendance Rate"
          value={`${stats.attendancePct}%`}
          color="bg-amber-500"
          href="/dashboard/attendance"
          trend={
            stats.attendancePct >= 75
              ? { delta: stats.attendancePct - 75, label: "above threshold" }
              : { delta: stats.attendancePct - 75, label: "below threshold" }
          }
          icon={
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          }
        />
        <StatCard
          label="Pending Assignments"
          value={stats.pendingAssignments}
          color="bg-rose-500"
          href="/dashboard/assignments"
          trend={
            overdueCount > 0
              ? { delta: -overdueCount, label: "overdue" }
              : criticalCount > 0
                ? { delta: -criticalCount, label: "due soon" }
                : undefined
          }
          sub={overdueCount === 0 ? "All on track" : undefined}
          icon={
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map(({ label, href, icon, color }) => (
          <Link
            key={label}
            href={href}
            className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col items-center gap-2 hover:shadow-md transition-all group"
          >
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center ${color} transition-transform group-hover:scale-110`}
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
                  d={icon}
                />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-slate-300 text-center">
              {label}
            </span>
          </Link>
        ))}
      </div>

      {/* Charts column */}
      <div className="flex flex-col gap-6">
        {/* Attendance Ring */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 flex flex-col">
          <h2 className="text-base font-semibold text-gray-700 dark:text-slate-200 mb-6">
            Attendance Breakdown
          </h2>
          <div className="flex items-center justify-center py-4">
            <AttendanceRing
              pct={stats.attendancePct}
              present={stats.attendanceBreakdown.present}
              absent={stats.attendanceBreakdown.absent}
              late={stats.attendanceBreakdown.late}
            />
          </div>
        </div>

        {/* Attendance Trend */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
          <h2 className="text-base font-semibold text-gray-700 dark:text-slate-200 mb-6">
            Attendance Trend (last 7 days)
          </h2>
          {stats.attendanceTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={stats.attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 13 }} />
                <YAxis tick={{ fontSize: 13 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="present"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="absent"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-20">
              No attendance data yet.
            </p>
          )}
        </div>

        {/* CGPA Trend */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8">
          <h2 className="text-base font-semibold text-gray-700 dark:text-slate-200 mb-6">
            CGPA Trend by Term
          </h2>
          {stats.cgpaTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={stats.cgpaTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="term" tick={{ fontSize: 13 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 13 }} />
                <Tooltip formatter={(v) => [v, "CGPA"]} />
                <Line
                  type="monotone"
                  dataKey="cgpa"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: "#6366f1" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <CgpaEmptyState />
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Upcoming Deadlines */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
              Upcoming Deadlines
            </h2>
            <Link
              href="/dashboard/assignments"
              className="text-xs text-indigo-500 hover:underline"
            >
              View all
            </Link>
          </div>
          {stats.upcomingDeadlines.length === 0 ? (
            <div className="text-center py-6">
              <svg
                className="mx-auto h-10 w-10 text-gray-200 dark:text-slate-700 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-gray-400">No active assignments.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {stats.upcomingDeadlines.map((a) => (
                <li key={a._id} className="flex items-start gap-3">
                  <div
                    className={`shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      a.daysLeft < 0
                        ? "bg-red-100 dark:bg-red-900/20 text-red-600"
                        : a.daysLeft <= 2
                          ? "bg-amber-100 dark:bg-amber-900/20 text-amber-600"
                          : "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600"
                    }`}
                  >
                    {a.daysLeft < 0 ? "!" : a.daysLeft}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {a.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">{a.subject}</span>
                      <span className="text-xs text-gray-300 dark:text-slate-600">
                        ·
                      </span>
                      {a.daysLeft < 0 ? (
                        <Badge
                          variant="danger"
                          className="text-[10px] px-1.5 py-0"
                        >
                          Overdue
                        </Badge>
                      ) : a.daysLeft <= 2 ? (
                        <Badge
                          variant="warning"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {a.daysLeft}d left
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {a.daysLeft}d left
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Students */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
              Recently Added Students
            </h2>
            <Link
              href="/dashboard/students"
              className="text-xs text-indigo-500 hover:underline"
            >
              View all
            </Link>
          </div>
          {stats.recentStudents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No students yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {stats.recentStudents.map((s) => (
                <li key={s._id} className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-semibold text-sm shrink-0 ${avatarColor(s.name ?? "")}`}
                  >
                    {(s.name?.charAt(0) ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {s.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      Roll: {s.rollNo} · {s.class}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Announcements */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
              Recent Announcements
            </h2>
            <Link
              href="/dashboard/announcements"
              className="text-xs text-indigo-500 hover:underline"
            >
              View all
            </Link>
          </div>
          {stats.recentAnnouncements.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No announcements yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {stats.recentAnnouncements.map((a) => (
                <li key={a._id} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {a.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
