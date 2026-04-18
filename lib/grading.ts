export const GRADE_POINTS: Record<string, number> = {
  'A+': 10,
  A: 9,
  'B+': 8,
  B: 7,
  C: 6,
  D: 5,
  F: 0,
}

export function getGradePoint(grade: string | null | undefined): number {
  if (!grade) return 0
  return GRADE_POINTS[grade] ?? 0
}

export function calculateCgpaFromGrades<T extends { grade?: string | null }>(grades: T[]): string | null {
  if (!grades.length) return null
  const total = grades.reduce((sum, item) => sum + getGradePoint(item.grade), 0)
  return (total / grades.length).toFixed(2)
}

export function calculateLetterGrade(marks: number, max: number): string {
  const pct = (marks / max) * 100
  if (pct > 90) return 'A+'
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B+'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 40) return 'D'
  return 'F'
}
