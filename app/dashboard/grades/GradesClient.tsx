'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, Legend,
} from 'recharts'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface Grade {
  _id: string
  studentId: string
  studentName: string
  subject: string
  marks: number
  maxMarks: number
  grade: string
  term: string
}

interface Student {
  _id: string
  name: string
  rollNo: string
  class: string
}

interface FormData {
  studentId: string
  subject: string
  marks: number
  maxMarks: number
  term: string
}

const GRADE_COLOR: Record<string, string> = {
  'A+': 'success', A: 'success', 'B+': 'info', B: 'info', C: 'warning', D: 'warning', F: 'danger',
}

const TERM_ORDER = ['Term 1', 'Term 2', 'Term 3', 'Term 4', 'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4', 'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8']

function sortTerms(terms: string[]) {
  return [...terms].sort((a, b) => {
    const ai = TERM_ORDER.indexOf(a)
    const bi = TERM_ORDER.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    return a.localeCompare(b)
  })
}

function pct(marks: number, max: number) {
  return Math.round((marks / max) * 100);
}

const GRADE_POINT: Record<string, number> = {
  'A+': 10, A: 9, 'B+': 8, B: 7, C: 6, D: 5, F: 0,
}

function cgpaFromGrades(gradeList: Grade[]) {
  if (!gradeList.length) return null
  const total = gradeList.reduce((s, g) => s + (GRADE_POINT[g.grade] ?? 0), 0)
  return (total / gradeList.length).toFixed(2)
}

const LINE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

function exportCsv(grades: Grade[], filename = "grades.csv") {
  const headers = [
    "Student",
    "Subject",
    "Term",
    "Marks",
    "Max Marks",
    "Percentage",
    "Grade",
  ];
  const rows = grades.map((g) => [
    g.studentName,
    g.subject,
    g.term,
    String(g.marks),
    String(g.maxMarks),
    `${pct(g.marks, g.maxMarks)}%`,
    g.grade,
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function GradesClient() {
  const { toast } = useToast();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Grade | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [cgpaStudentId, setCgpaStudentId] = useState("");
  const [historyStudentId, setHistoryStudentId] = useState("");
  const [chartView, setChartView] = useState<
    "distribution" | "radar" | "history" | "comparison"
  >("distribution");

  // Filters
  const [filterClass, setFilterClass] = useState("all");
  const [filterTerm, setFilterTerm] = useState("all");

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormData>();

  const fetchGrades = useCallback(async () => {
    setLoading(true);
    try {
      const gradesRes = await fetch("/api/grades");
      const firstStudentsRes = await fetch("/api/students?limit=100&page=1");
      if (!gradesRes.ok) throw new Error(`Grades: ${gradesRes.status}`);
      if (!firstStudentsRes.ok) {
        throw new Error(`Students: ${firstStudentsRes.status}`);
      }

      const gradesData = await gradesRes.json();
      const firstStudentsData = await firstStudentsRes.json();
      const totalPages =
        firstStudentsData &&
        typeof firstStudentsData === "object" &&
        typeof firstStudentsData.pages === "number"
          ? Math.max(1, firstStudentsData.pages)
          : 1;

      let allStudents: Student[] = firstStudentsData.students ?? [];

      if (totalPages > 1) {
        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            fetch(`/api/students?limit=100&page=${index + 2}`).then(
              async (res) => {
                if (!res.ok) {
                  throw new Error(`Students: ${res.status}`);
                }

                return res.json();
              },
            ),
          ),
        );

        allStudents = allStudents.concat(
          ...remainingPages.map((page) => page.students ?? []),
        );
      }

      setGrades(Array.isArray(gradesData) ? gradesData : []);
      setStudents(allStudents);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  // Student lookup map for quick class resolution
  const studentMap = useMemo(() => {
    const m: Record<string, Student> = {};
    for (const s of students) m[s._id] = s;
    return m;
  }, [students]);

  // Unique values for filters
  const uniqueClasses = useMemo(
    () => ["all", ...Array.from(new Set(students.map((s) => s.class))).sort()],
    [students],
  );
  const uniqueTerms = useMemo(
    () => ["all", ...sortTerms([...new Set(grades.map((g) => g.term))])],
    [grades],
  );

  // Filtered grades (class + term)
  const filteredGrades = useMemo(() => {
    return grades.filter((g) => {
      if (filterClass !== "all") {
        const student = studentMap[g.studentId];
        if (!student || student.class !== filterClass) return false;
      }
      if (filterTerm !== "all" && g.term !== filterTerm) return false;
      return true;
    });
  }, [grades, filterClass, filterTerm, studentMap]);

  const { subjects, gradesBySubject } = useMemo(() => {
    const map: Record<string, Grade[]> = {};
    for (const g of filteredGrades) (map[g.subject] ??= []).push(g);
    return { subjects: Object.keys(map).sort(), gradesBySubject: map };
  }, [filteredGrades]);

  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(activeTab))
      setActiveTab(subjects[0]);
  }, [subjects, activeTab]);

  // Grade distribution (respects term filter)
  const gradeDistribution = useMemo(
    () =>
      ["A+", "A", "B+", "B", "C", "D", "F"]
        .map((g) => ({
          grade: g,
          count: filteredGrades.filter((r) => r.grade === g).length,
        }))
        .filter((r) => r.count > 0),
    [filteredGrades],
  );

  const radarData = useMemo(
    () =>
      subjects.map((subject) => {
        const sg = gradesBySubject[subject];
        const avg =
          sg.length > 0
            ? Math.round(
                sg.reduce((s, g) => s + pct(g.marks, g.maxMarks), 0) /
                  sg.length,
              )
            : 0;
        return {
          subject: subject.length > 10 ? subject.slice(0, 10) + "…" : subject,
          avg,
        };
      }),
    [subjects, gradesBySubject],
  );

  // Subject comparison: marks per student for activeTab subject
  const comparisonData = useMemo(() => {
    const sg = gradesBySubject[activeTab] ?? [];
    return [...sg]
      .sort((a, b) => b.marks - a.marks)
      .slice(0, 20) // cap at 20 students for readability
      .map((g) => ({
        name: g.studentName.split(" ")[0], // first name only for axis
        fullName: g.studentName,
        pct: pct(g.marks, g.maxMarks),
        grade: g.grade,
      }));
  }, [gradesBySubject, activeTab]);

  // CGPA calculator
  const cgpaStudent = useMemo(() => {
    if (!cgpaStudentId) return null;
    const sg = grades.filter((g) => g.studentId === cgpaStudentId);
    return {
      grades: sg,
      cgpa: cgpaFromGrades(sg),
      name: students.find((s) => s._id === cgpaStudentId)?.name ?? "",
    };
  }, [cgpaStudentId, grades, students]);

  // Grade history
  const historyData = useMemo(() => {
    if (!historyStudentId) return { terms: [], series: [], chartData: [] };
    const sg = grades.filter((g) => g.studentId === historyStudentId);
    const allTerms = sortTerms([...new Set(sg.map((g) => g.term))]);
    const allSubjects = [...new Set(sg.map((g) => g.subject))];
    const series = allSubjects.map((sub, i) => ({
      subject: sub,
      color: LINE_COLORS[i % LINE_COLORS.length],
      data: allTerms.map((term) => {
        const g = sg.find((x) => x.subject === sub && x.term === term);
        return g ? pct(g.marks, g.maxMarks) : null;
      }),
    }));
    const chartData = allTerms.map((term, ti) => {
      const row: Record<string, string | number | null> = { term };
      for (const s of series) row[s.subject] = s.data[ti];
      return row;
    });
    return { terms: allTerms, series, chartData };
  }, [historyStudentId, grades]);

  const openAdd = () => {
    setEditing(null);
    reset({ maxMarks: 100, term: "Term 1" });
    setModalOpen(true);
  };
  const openEdit = (g: Grade) => {
    setEditing(g);
    reset({
      studentId: g.studentId,
      subject: g.subject,
      marks: g.marks,
      maxMarks: g.maxMarks,
      term: g.term,
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    const selectedStudent = students.find((s) => s._id === data.studentId);
    // Validate that the student exists
    if (!selectedStudent) {
      toast("Selected student not found", "error");
      return;
    }
    const payload = {
      ...data,
      marks: Number(data.marks),
      maxMarks: Number(data.maxMarks),
      studentName: selectedStudent.name,
    };
    const url = editing ? `/api/grades/${editing._id}` : "/api/grades";
    const method = editing ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast(editing ? "Grade updated!" : "Grade added!", "success");
        setModalOpen(false);
        fetchGrades();
      } else {
        let message = "Failed to save grade";
        try {
          const err = await res.json();
          if (typeof err.error === "string") {
            message = err.error;
          }
        } catch {
          message = `Failed to save grade (${res.status})`;
        }
        toast(message, "error");
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Network error", "error");
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/grades/${deleteTarget._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast("Deleted", "success");
        fetchGrades();
      } else toast("Failed to delete", "error");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Network error", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const activeGrades = gradesBySubject[activeTab] ?? [];
  const activeAvg =
    activeGrades.length > 0
      ? Math.round(
          activeGrades.reduce((s, g) => s + pct(g.marks, g.maxMarks), 0) /
            activeGrades.length,
        )
      : 0;

  const activeFilters =
    (filterClass !== "all" ? 1 : 0) + (filterTerm !== "all" ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* ── Charts section ── */}
      {grades.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <div className="flex overflow-x-auto border-b border-gray-100 dark:border-slate-700">
            {(
              [
                { id: "distribution", label: "Distribution" },
                { id: "comparison", label: "Subject Comparison" },
                { id: "radar", label: "Radar" },
                { id: "history", label: "Grade History" },
              ] as { id: typeof chartView; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setChartView(id)}
                className={`shrink-0 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  chartView === id
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Grade Distribution */}
            {chartView === "distribution" && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                      Grade Distribution
                    </h3>
                    {/* Term filter for distribution */}
                    <select
                      value={filterTerm}
                      onChange={(e) => setFilterTerm(e.target.value)}
                      className="input text-xs py-1 w-auto"
                    >
                      {uniqueTerms.map((t) => (
                        <option key={t} value={t}>
                          {t === "all" ? "All Terms" : t}
                        </option>
                      ))}
                    </select>
                  </div>
                  {gradeDistribution.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-10">
                      No grades for the selected filter.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={gradeDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar
                          dataKey="count"
                          fill="#6366f1"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">
                    Average Score by Subject (%)
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={radarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="subject" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="avg" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Subject comparison — marks per student for the active subject */}
            {chartView === "comparison" && (
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                    Student Scores — {activeTab || "select a subject below"}
                  </h3>
                  {comparisonData.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {comparisonData.length} student
                      {comparisonData.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {comparisonData.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">
                    Select a subject tab in the grades table below to compare
                    scores.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={comparisonData}
                      layout="vertical"
                      margin={{ left: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e5e7eb"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fontSize: 11 }}
                        unit="%"
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        width={70}
                      />
                      <Tooltip
                        formatter={(v, _name, props) => [
                          `${v}% (${props.payload?.grade})`,
                          props.payload?.fullName,
                        ]}
                      />
                      <Bar dataKey="pct" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {/* Subject Radar */}
            {chartView === "radar" && (
              <div className="flex flex-col items-center">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3 self-start">
                  Subject-wise Performance (%)
                </h3>
                {radarData.length >= 3 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart
                      data={radarData}
                      cx="50%"
                      cy="50%"
                      outerRadius="70%"
                    >
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                      />
                      <Radar
                        name="Avg %"
                        dataKey="avg"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.3}
                      />
                      <Tooltip
                        formatter={(v) => [`${v}%`, "Avg Score"]}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-400 py-10 text-center">
                    Add grades for at least 3 subjects to see the radar chart.
                  </p>
                )}
              </div>
            )}

            {/* Grade History */}
            {chartView === "history" && (
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                    Grade History by Student
                  </h3>
                  <select
                    value={historyStudentId}
                    onChange={(e) => setHistoryStudentId(e.target.value)}
                    className="input text-sm py-1"
                  >
                    <option value="">Select student…</option>
                    {students.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.rollNo})
                      </option>
                    ))}
                  </select>
                </div>
                {historyStudentId && historyData.terms.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={historyData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="term" tick={{ fontSize: 11 }} />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                        unit="%"
                      />
                      <Tooltip formatter={(v) => [`${v}%`]} />
                      <Legend />
                      {historyData.series.map((s) => (
                        <Line
                          key={s.subject}
                          type="monotone"
                          dataKey={s.subject}
                          stroke={s.color}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : historyStudentId ? (
                  <p className="text-sm text-gray-400 text-center py-10">
                    No grade history for this student.
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-10">
                    Select a student to view their grade history across terms.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CGPA Calculator ── */}
      {grades.length > 0 && students.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-4">
            CGPA Calculator
          </h2>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <select
              value={cgpaStudentId}
              onChange={(e) => setCgpaStudentId(e.target.value)}
              className="input text-sm"
            >
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.rollNo})
                </option>
              ))}
            </select>
            {cgpaStudent && (
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {cgpaStudent.cgpa ?? "—"}
                </span>
                <span className="text-sm text-gray-500 dark:text-slate-400">
                  CGPA (10-point scale)
                </span>
              </div>
            )}
          </div>
          {cgpaStudent && cgpaStudent.grades.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-900/50">
                  <tr>
                    {["Subject", "Term", "Marks", "Grade", "Points"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {cgpaStudent.grades.map((g) => (
                    <tr
                      key={g._id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700/30"
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                        {g.subject}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-slate-400">
                        {g.term}
                      </td>
                      <td className="px-4 py-2.5">
                        {g.marks}/{g.maxMarks}
                        <span className="ml-1 text-xs text-gray-400">
                          ({pct(g.marks, g.maxMarks)}%)
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant={
                            (GRADE_COLOR[g.grade] as
                              | "success"
                              | "info"
                              | "warning"
                              | "danger") ?? "default"
                          }
                        >
                          {g.grade}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-indigo-600 dark:text-indigo-400">
                        {GRADE_POINT[g.grade] ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Grades table ── */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
            All Grades
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* Class filter */}
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="input text-sm py-1.5 w-auto"
            >
              {uniqueClasses.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All Classes" : c}
                </option>
              ))}
            </select>
            {/* Term filter */}
            <select
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              className="input text-sm py-1.5 w-auto"
            >
              {uniqueTerms.map((t) => (
                <option key={t} value={t}>
                  {t === "all" ? "All Terms" : t}
                </option>
              ))}
            </select>
            {activeFilters > 0 && (
              <button
                onClick={() => {
                  setFilterClass("all");
                  setFilterTerm("all");
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Clear ({activeFilters})
              </button>
            )}
            {/* CSV Export */}
            {filteredGrades.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportCsv(
                    filteredGrades,
                    `grades${filterClass !== "all" ? `-${filterClass}` : ""}${filterTerm !== "all" ? `-${filterTerm}` : ""}.csv`,
                  )
                }
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export CSV
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
              Add Grade
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={6} />
          </div>
        ) : grades.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">No grades recorded yet.</p>
            <Button size="sm" className="mt-4" onClick={openAdd}>
              Add first grade
            </Button>
          </div>
        ) : (
          <>
            {/* Subject tab bar */}
            <div className="flex overflow-x-auto border-b border-gray-200 dark:border-slate-700 scrollbar-none">
              {subjects.map((subject) => (
                <button
                  key={subject}
                  onClick={() => setActiveTab(subject)}
                  className={`shrink-0 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === subject
                      ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                  }`}
                >
                  {subject}
                  <span
                    className={`ml-2 text-xs rounded-full px-1.5 py-0.5 ${
                      activeTab === subject
                        ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                    }`}
                  >
                    {gradesBySubject[subject]?.length ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {subjects.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-10">
                No grades match the current filters.
              </p>
            ) : (
              <>
                {/* Stats bar */}
                <div className="flex items-center gap-4 px-5 py-3 bg-gray-50 dark:bg-slate-900/30 border-b border-gray-100 dark:border-slate-700/50 text-xs text-gray-500 dark:text-slate-400">
                  <span>
                    {activeGrades.length} record
                    {activeGrades.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-gray-300 dark:text-slate-600">|</span>
                  <span>
                    Avg:{" "}
                    <span className="font-semibold text-gray-700 dark:text-slate-200">
                      {activeAvg}%
                    </span>
                  </span>
                  <span className="text-gray-300 dark:text-slate-600">|</span>
                  <span>
                    CGPA avg:{" "}
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {cgpaFromGrades(activeGrades) ?? "—"}
                    </span>
                  </span>
                  <button
                    className="ml-auto text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 underline-offset-2 hover:underline transition-colors"
                    onClick={() => {
                      setActiveTab(activeTab);
                      setChartView("comparison");
                    }}
                  >
                    Compare in chart →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                      <tr>
                        {["Student", "Marks", "Grade", "Term", "Actions"].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {activeGrades.map((g) => (
                        <tr
                          key={g._id}
                          className="hover:bg-gray-50 dark:hover:bg-slate-700/30"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {g.studentName}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {g.marks}
                            </span>
                            <span className="text-gray-400">/{g.maxMarks}</span>
                            <span className="ml-1 text-xs text-gray-400">
                              ({pct(g.marks, g.maxMarks)}%)
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                (GRADE_COLOR[g.grade] as
                                  | "success"
                                  | "info"
                                  | "warning"
                                  | "danger") ?? "default"
                              }
                            >
                              {g.grade}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                            {g.term}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEdit(g)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => setDeleteTarget(g)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Delete confirm */}
      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete grade?"
        message={`Remove ${deleteTarget?.studentName}'s ${deleteTarget?.subject} grade?`}
        confirmLabel="Delete"
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Grade" : "Add Grade"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Student *
            </label>
            <select
              {...register("studentId", { required: true })}
              className="input w-full"
            >
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.rollNo})
                </option>
              ))}
            </select>
            {errors.studentId && (
              <p className="text-xs text-red-500 mt-1">Required</p>
            )}
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
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Term
              </label>
              <input
                {...register("term")}
                className="input w-full"
                placeholder="Term 1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Marks *
              </label>
              <input
                {...register("marks", {
                  required: true,
                  min: 0,
                  valueAsNumber: true,
                })}
                type="number"
                className="input w-full"
                placeholder="85"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Max Marks
              </label>
              <input
                {...register("maxMarks", { valueAsNumber: true, min: 1 })}
                type="number"
                min="1"
                className="input w-full"
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
              {editing ? "Update" : "Add Grade"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
