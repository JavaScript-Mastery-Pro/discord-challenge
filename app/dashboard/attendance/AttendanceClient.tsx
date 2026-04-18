'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { getLocalDateInputValue } from '@/lib/date'

interface Student {
  _id: string
  name: string
  rollNo: string
  class: string
}

interface AttendanceRecord {
  _id: string
  studentId: string
  studentName: string
  class: string
  date: string
  status: 'present' | 'absent' | 'late'
}

type AttendanceStatus = 'present' | 'absent' | 'late'
type Tab = 'mark' | 'heatmap' | 'history'

const STATUS_BADGE: Record<AttendanceStatus, 'success' | 'danger' | 'warning'> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
}

// Heatmap cell color based on attendance rate
function heatColor(rate: number | null) {
  if (rate === null) return 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600'
  if (rate >= 90) return 'bg-emerald-500 text-white'
  if (rate >= 75) return 'bg-emerald-300 text-emerald-900'
  if (rate >= 50) return 'bg-amber-400 text-amber-900'
  return 'bg-red-400 text-white'
}

export function AttendanceClient() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('mark')
  const today = getLocalDateInputValue()

  // ── Mark tab state ──
  const [students, setStudents] = useState<Student[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [date, setDate] = useState(today)
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({})
  const [saving, setSaving] = useState(false)

  // ── History tab state ──
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [historyDate, setHistoryDate] = useState(today)
  const [historyClass, setHistoryClass] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)

  // ── Heatmap tab state ──
  const [heatmapRecords, setHeatmapRecords] = useState<AttendanceRecord[]>([])
  const [heatmapClass, setHeatmapClass] = useState('')
  const [heatmapMonth, setHeatmapMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [loadingHeatmap, setLoadingHeatmap] = useState(false)
  const [heatmapDayDetail, setHeatmapDayDetail] = useState<string | null>(null)

  // ── Fetch students for mark tab ──
  const fetchStudents = useCallback(async () => {
    if (!selectedClass) {
      setStudents([]);
      return;
    }
    try {
      const firstRes = await fetch(
        `/api/students?class=${encodeURIComponent(selectedClass)}&limit=100&page=1`,
      );
      if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);

      const firstData = await firstRes.json();
      const totalPages =
        firstData &&
        typeof firstData === "object" &&
        typeof firstData.pages === "number"
          ? Math.max(1, firstData.pages)
          : 1;

      let classStudents: Student[] = firstData.students ?? [];

      if (totalPages > 1) {
        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            fetch(
              `/api/students?class=${encodeURIComponent(selectedClass)}&limit=100&page=${index + 2}`,
            ).then(async (res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            }),
          ),
        );

        classStudents = classStudents.concat(
          ...remainingPages.map((page) => page.students ?? []),
        );
      }

      setStudents(classStudents);
      const init: Record<string, AttendanceStatus> = {};
      for (const s of classStudents) init[s._id] = "present";
      setStatuses(init);
    } catch {
      toast("Failed to load students", "error");
      setStudents([]);
    }
  }, [selectedClass, toast]);

  useEffect(() => { fetchStudents() }, [fetchStudents])

  // ── Fetch history ──
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({ date: historyDate });
      if (historyClass) params.set("class", historyClass);
      const res = await fetch(`/api/attendance?${params}`);
      if (!res.ok) throw new Error(`Failed to fetch history: ${res.status}`);
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      toast(
        `Failed to load history: ${error instanceof Error ? error.message : "Network error"}`,
        "error",
      );
      console.error("fetchHistory error:", error);
      setRecords([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [historyDate, historyClass, toast]);

  useEffect(() => { if (tab === 'history') fetchHistory() }, [tab, fetchHistory])

  // ── Fetch heatmap data (all records for the month) ──
  const fetchHeatmap = useCallback(async () => {
    setLoadingHeatmap(true);
    try {
      const [year, month] = heatmapMonth.split("-").map(Number);
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const params = new URLSearchParams({ startDate, endDate });
      if (heatmapClass) params.set("class", heatmapClass);
      const res = await fetch(`/api/attendance?${params}`);
      if (!res.ok) throw new Error(`Failed to fetch heatmap: ${res.status}`);
      const data = await res.json();
      setHeatmapRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      toast(
        `Failed to load heatmap: ${error instanceof Error ? error.message : "Network error"}`,
        "error",
      );
      console.error("fetchHeatmap error:", error);
      setHeatmapRecords([]);
    } finally {
      setLoadingHeatmap(false);
    }
  }, [heatmapMonth, heatmapClass, toast]);

  useEffect(() => { if (tab === 'heatmap') fetchHeatmap() }, [tab, fetchHeatmap])

  // ── Save attendance ──
  const saveAttendance = async () => {
    if (!selectedClass) { toast('Select a class first', 'warning'); return }
    if (students.length === 0) { toast('No students in this class', 'warning'); return }
    setSaving(true)
    try {
      const payload = students.map((s) => ({
        studentId: s._id,
        studentName: s.name,
        class: s.class,
        date,
        status: statuses[s._id] ?? "present",
      }));
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok)
        toast(`Attendance saved for ${payload.length} students!`, "success");
      else toast("Failed to save attendance", "error");
    } catch {
      toast("Failed to save attendance", "error");
    } finally {
      setSaving(false);
    }
  }

  const markAll = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = {}
    for (const s of students) updated[s._id] = status
    setStatuses(updated)
  }

  // ── Heatmap computation ──
  const heatmapData = useMemo(() => {
    const [year, month] = heatmapMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const firstDow = new Date(year, month - 1, 1).getDay() // 0=Sun

    // Build date → { present, total } map
    const dayMap: Record<string, { present: number; absent: number; late: number }> = {}
    for (const r of heatmapRecords) {
      if (!dayMap[r.date]) dayMap[r.date] = { present: 0, absent: 0, late: 0 }
      dayMap[r.date][r.status]++
    }

    const cells: { day: number | null; date: string | null; rate: number | null; records: AttendanceRecord[] }[] = []

    // Leading empty cells
    for (let i = 0; i < firstDow; i++) cells.push({ day: null, date: null, rate: null, records: [] })

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const entry = dayMap[dateStr]
      const total = entry ? entry.present + entry.absent + entry.late : 0
      const rate = total > 0 ? Math.round((entry.present / total) * 100) : null
      const recs = heatmapRecords.filter((r) => r.date === dateStr)
      cells.push({ day: d, date: dateStr, rate, records: recs })
    }

    return cells
  }, [heatmapRecords, heatmapMonth])

  // ── Low attendance students (from heatmap records) ──
  const lowAttendanceStudents = useMemo(() => {
    const studentMap: Record<string, { name: string; present: number; total: number }> = {}
    for (const r of heatmapRecords) {
      if (!studentMap[r.studentId]) studentMap[r.studentId] = { name: r.studentName, present: 0, total: 0 }
      studentMap[r.studentId].total++
      if (r.status === 'present') studentMap[r.studentId].present++
    }
    return Object.entries(studentMap)
      .map(([id, v]) => ({ id, name: v.name, rate: Math.round((v.present / v.total) * 100), total: v.total }))
      .filter((s) => s.rate < 75)
      .sort((a, b) => a.rate - b.rate)
  }, [heatmapRecords])

  const presentCount = Object.values(statuses).filter((s) => s === 'present').length
  const absentCount = Object.values(statuses).filter((s) => s === 'absent').length

  const selectedDayRecords = heatmapDayDetail
    ? heatmapData.find((c) => c.date === heatmapDayDetail)?.records ?? []
    : []

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-slate-800 p-1 w-fit">
        {([
          { id: 'mark', label: 'Mark Attendance' },
          { id: 'heatmap', label: 'Heatmap' },
          { id: 'history', label: 'History' },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === id
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Mark Attendance tab ── */}
      {tab === 'mark' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Class</label>
                <input
                  type="text"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  placeholder="e.g. B.Tech 3rd Year - A"
                  className="input w-56"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => markAll('present')}>All Present</Button>
                <Button size="sm" variant="secondary" onClick={() => markAll('absent')}>All Absent</Button>
              </div>
            </div>
            {students.length > 0 && (
              <div className="mt-4 flex gap-4 text-sm">
                <span className="text-emerald-600 font-medium">{presentCount} Present</span>
                <span className="text-red-500 font-medium">{absentCount} Absent</span>
                <span className="text-amber-500 font-medium">{students.length - presentCount - absentCount} Late</span>
              </div>
            )}
          </div>

          {students.length > 0 ? (
            <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-900/50">
                    <tr>
                      {['Student', 'Roll No', 'Present', 'Absent', 'Late'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {students.map((s) => (
                      <tr key={s._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-semibold text-sm shrink-0">
                              {s.name.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{s.rollNo}</td>
                        {(['present', 'absent', 'late'] as AttendanceStatus[]).map((status) => (
                          <td key={status} className="px-4 py-3">
                            <input
                              type="radio"
                              name={`status-${s._id}`}
                              value={status}
                              checked={statuses[s._id] === status}
                              onChange={() => setStatuses((prev) => ({ ...prev, [s._id]: status }))}
                              className="h-4 w-4 accent-indigo-600 cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700">
                <Button loading={saving} onClick={saveAttendance}>Save Attendance</Button>
              </div>
            </div>
          ) : selectedClass ? (
            <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-16 text-center">
              <p className="text-gray-400 text-sm">No students found in class &quot;{selectedClass}&quot;.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-slate-600 py-16 text-center">
              <p className="text-gray-400 text-sm">Enter a class name above to load students.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Heatmap tab ── */}
      {tab === 'heatmap' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Month</label>
                <input
                  type="month"
                  value={heatmapMonth}
                  onChange={(e) => setHeatmapMonth(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Class (optional)</label>
                <input
                  type="text"
                  value={heatmapClass}
                  onChange={(e) => setHeatmapClass(e.target.value)}
                  placeholder="Filter by class"
                  className="input w-48"
                />
              </div>
              <Button size="sm" onClick={fetchHeatmap}>Load</Button>
            </div>
            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
              <span className="font-medium">Attendance rate:</span>
              {[
                { color: 'bg-emerald-500', label: '≥90%' },
                { color: 'bg-emerald-300', label: '75–89%' },
                { color: 'bg-amber-400', label: '50–74%' },
                { color: 'bg-red-400', label: '<50%' },
                { color: 'bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700', label: 'No data' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1">
                  <span className={`inline-block h-3 w-3 rounded-sm ${color}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Low attendance warning */}
          {!loadingHeatmap && lowAttendanceStudents.length > 0 && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    {lowAttendanceStudents.length} student{lowAttendanceStudents.length !== 1 ? 's' : ''} below 75% attendance this month
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lowAttendanceStudents.map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                        {s.name}
                        <span className="font-bold text-red-600 dark:text-red-400">{s.rate}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Calendar grid */}
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
            {loadingHeatmap ? (
              <TableSkeleton rows={5} />
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-slate-500 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {heatmapData.map((cell, i) => {
                    if (!cell.day || !cell.date) {
                      return <div key={`empty-${i}`} />
                    }
                    const isSelected = heatmapDayDetail === cell.date
                    return (
                      <button
                        key={cell.date}
                        onClick={() => setHeatmapDayDetail(isSelected ? null : cell.date)}
                        className={`aspect-square rounded-lg text-xs font-medium flex flex-col items-center justify-center transition-all hover:scale-105 hover:shadow ${heatColor(cell.rate)} ${
                          isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
                        }`}
                        title={cell.rate !== null ? `${cell.date}: ${cell.rate}% attendance (${cell.records.length} records)` : `${cell.date}: No data`}
                      >
                        <span>{cell.day}</span>
                        {cell.rate !== null && (
                          <span className="text-[10px] opacity-80">{cell.rate}%</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Day drill-down */}
                {heatmapDayDetail && selectedDayRecords.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 dark:border-slate-700 pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">
                      {heatmapDayDetail} — {selectedDayRecords.length} records
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {selectedDayRecords.map((r) => (
                        <div key={r._id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-slate-700/50 px-3 py-2 text-sm">
                          <span className="text-gray-700 dark:text-slate-200 truncate">{r.studentName}</span>
                          <Badge variant={STATUS_BADGE[r.status]} className="capitalize ml-2 shrink-0">{r.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {heatmapDayDetail && selectedDayRecords.length === 0 && (
                  <p className="mt-4 text-sm text-gray-400 text-center">No records for {heatmapDayDetail}.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Date</label>
                <input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Class (optional)</label>
                <input type="text" value={historyClass} onChange={(e) => setHistoryClass(e.target.value)} placeholder="Filter by class" className="input w-48" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
            {loadingHistory ? (
              <div className="p-6"><TableSkeleton rows={5} /></div>
            ) : records.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-gray-400 text-sm">No attendance records for this date.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-900/50">
                    <tr>
                      {['Student', 'Class', 'Date', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {records.map((r) => (
                      <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.studentName}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{r.class}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{r.date}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE[r.status]} className="capitalize">{r.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
