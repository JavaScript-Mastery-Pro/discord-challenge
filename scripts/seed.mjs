/**
 * Seed script for college-dashboard MongoDB database.
 *
 * Usage:
 *   npm run seed
 *   node scripts/seed.mjs
 *
 * The script reads MONGODB_URI from .env.local automatically.
 * It seeds data under the first Teacher found in the DB.
 * Sign in once via the app first (which auto-creates your Teacher doc),
 * then run this script.
 *
 * Override which teacher gets seeded:
 *   TEACHER_CLERK_ID=user_xxx node scripts/seed.mjs
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

// ── Load .env.local ────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
try {
  const envFile = readFileSync(envPath, 'utf-8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    val = val.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\'/g, "'")
    if (!process.env[key]) process.env[key] = val
  }
} catch {
  // .env.local not found — rely on process.env
}

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI is not set. Check your .env.local file.')
  process.exit(1)
}

// ── Schemas (mirror the TypeScript models exactly) ─────────────────────────────
const { Schema, model, models } = mongoose

const TeacherSchema = new Schema(
  {
    clerkId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    department: { type: String, default: '' },
    subjects: { type: [String], default: [] },
    phone: { type: String, default: '' },
    bio: { type: String, default: '' },
    academicHistory: {
      type: [
        {
          year: { type: String, required: true },
          title: { type: String, required: true },
          description: { type: String },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
)
const Teacher = models.Teacher ?? model('Teacher', TeacherSchema)

const StudentSchema = new Schema(
  {
    teacherId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    rollNo: { type: String, required: true },
    class: { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    parentName: { type: String, default: '' },
    parentPhone: { type: String, default: '' },
  },
  { timestamps: true }
)
StudentSchema.index({ teacherId: 1, rollNo: 1 }, { unique: true })
const Student = models.Student ?? model('Student', StudentSchema)

const AttendanceSchema = new Schema(
  {
    teacherId: { type: String, required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName: { type: String, required: true },
    class: { type: String, required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ['present', 'absent', 'late'], required: true },
  },
  { timestamps: true }
)
AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true })
const Attendance = models.Attendance ?? model('Attendance', AttendanceSchema)

const AssignmentSchema = new Schema(
  {
    teacherId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    subject: { type: String, required: true },
    class: { type: String, required: true },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    kanbanStatus: { type: String, enum: ['todo', 'in_progress', 'submitted'], default: 'todo' },
    maxMarks: { type: Number, default: 100 },
  },
  { timestamps: true }
)
const Assignment = models.Assignment ?? model('Assignment', AssignmentSchema)

const GradeSchema = new Schema(
  {
    teacherId: { type: String, required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName: { type: String, required: true },
    subject: { type: String, required: true },
    marks: { type: Number, required: true, min: 0 },
    maxMarks: { type: Number, default: 100 },
    grade: { type: String, default: '' },
    term: { type: String, default: 'Term 1' },
  },
  { timestamps: true }
)
GradeSchema.index({ teacherId: 1, studentId: 1, subject: 1, term: 1 }, { unique: true })
const Grade = models.Grade ?? model('Grade', GradeSchema)

const AnnouncementSchema = new Schema(
  {
    teacherId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    audience: { type: String, default: 'All' },
    category: { type: String, enum: ['academic', 'events', 'admin', 'general'], default: 'general' },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
)
const Announcement = models.Announcement ?? model('Announcement', AnnouncementSchema)

// ── Helpers ────────────────────────────────────────────────────────────────────
function gradeFromMarks(marks, max = 100) {
  const pct = (marks / max) * 100
  if (pct >= 90) return 'A+'
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B+'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 40) return 'D'
  return 'F'
}

function dateOffset(daysFromToday) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return d
}

function dateStr(daysFromToday) {
  return dateOffset(daysFromToday).toISOString().slice(0, 10) // YYYY-MM-DD
}

// ── Seed data definitions ──────────────────────────────────────────────────────
const SUBJECTS = ['Mathematics', 'Data Structures', 'Operating Systems', 'DBMS', 'Computer Networks']

const TEACHER_PROFILE = {
  department: 'Computer Science',
  subjects: SUBJECTS,
  phone: '9800000001',
  bio: 'Assistant Professor with 8 years of experience in Computer Science education, specialising in algorithms and database systems.',
  academicHistory: [
    { year: '2016', title: 'Joined as Lecturer', description: 'Started teaching undergraduate CS courses at City College.' },
    { year: '2018', title: 'Promoted to Assistant Professor', description: 'Received promotion after completing M.Tech and publishing two research papers.' },
    { year: '2020', title: 'Best Teacher Award', description: 'Awarded Best Teacher of the Year by the faculty board.' },
    { year: '2023', title: 'PhD Enrolled', description: 'Enrolled in PhD programme focusing on distributed database systems.' },
  ],
}

const STUDENTS_DATA = [
  { name: 'Aarav Sharma',  rollNo: 'CS001', class: 'CS-A', email: 'aarav@example.com',   phone: '9876543210', address: '12 MG Road, Mumbai',        parentName: 'Rajesh Sharma',  parentPhone: '9876543200' },
  { name: 'Priya Patel',   rollNo: 'CS002', class: 'CS-A', email: 'priya@example.com',   phone: '9876543211', address: '45 Park Street, Pune',       parentName: 'Suresh Patel',   parentPhone: '9876543201' },
  { name: 'Rohan Mehta',   rollNo: 'CS003', class: 'CS-A', email: 'rohan@example.com',   phone: '9876543212', address: '7 Hill View, Nashik',         parentName: 'Vikram Mehta',   parentPhone: '9876543202' },
  { name: 'Ananya Gupta',  rollNo: 'CS004', class: 'CS-A', email: 'ananya@example.com',  phone: '9876543213', address: '88 Gandhi Nagar, Nagpur',     parentName: 'Dinesh Gupta',   parentPhone: '9876543203' },
  { name: 'Karthik Reddy', rollNo: 'CS005', class: 'CS-A', email: 'karthik@example.com', phone: '9876543214', address: '3 Jubilee Hills, Hyderabad',  parentName: 'Venkat Reddy',   parentPhone: '9876543204' },
  { name: 'Divya Nair',    rollNo: 'CS006', class: 'CS-B', email: 'divya@example.com',   phone: '9876543215', address: '21 Koramangala, Bangalore',   parentName: 'Mohan Nair',     parentPhone: '9876543205' },
  { name: 'Arjun Singh',   rollNo: 'CS007', class: 'CS-B', email: 'arjun@example.com',   phone: '9876543216', address: '56 Sector 15, Chandigarh',    parentName: 'Balveer Singh',  parentPhone: '9876543206' },
  { name: 'Sneha Iyer',    rollNo: 'CS008', class: 'CS-B', email: 'sneha@example.com',   phone: '9876543217', address: '9 T Nagar, Chennai',          parentName: 'Ramesh Iyer',    parentPhone: '9876543207' },
  { name: 'Rahul Joshi',   rollNo: 'CS009', class: 'CS-B', email: 'rahul@example.com',   phone: '9876543218', address: '33 Civil Lines, Jaipur',      parentName: 'Prakash Joshi',  parentPhone: '9876543208' },
  { name: 'Pooja Agarwal', rollNo: 'CS010', class: 'CS-B', email: 'pooja@example.com',   phone: '9876543219', address: '77 Salt Lake, Kolkata',       parentName: 'Anil Agarwal',   parentPhone: '9876543209' },
]

// Assignments covering all statuses and kanbanStatuses
const ASSIGNMENTS_DATA = [
  { title: 'Binary Tree Traversal',       subject: 'Data Structures',   class: 'CS-A', description: 'Implement in-order, pre-order, and post-order traversals.',  deadline: dateOffset(7),  status: 'active', kanbanStatus: 'todo',        maxMarks: 50  },
  { title: 'Calculus Problem Set 3',      subject: 'Mathematics',        class: 'CS-A', description: 'Solve integration and differentiation problems (Ch. 5–6).',   deadline: dateOffset(5),  status: 'active', kanbanStatus: 'in_progress', maxMarks: 100 },
  { title: 'Process Scheduling Report',   subject: 'Operating Systems',  class: 'CS-B', description: 'Compare FCFS, SJF, and Round Robin scheduling algorithms.',    deadline: dateOffset(10), status: 'active', kanbanStatus: 'todo',        maxMarks: 50  },
  { title: 'ER Diagram – Library System', subject: 'DBMS',               class: 'CS-B', description: 'Design ER diagram and convert to a normalised relational schema.', deadline: dateOffset(-2), status: 'closed', kanbanStatus: 'submitted',   maxMarks: 30  },
  { title: 'Socket Programming Lab',      subject: 'Computer Networks',  class: 'CS-A', description: 'Implement a TCP echo server and client in C.',                 deadline: dateOffset(14), status: 'active', kanbanStatus: 'in_progress', maxMarks: 50  },
  { title: 'Sorting Algorithm Analysis',  subject: 'Data Structures',   class: 'CS-B', description: 'Analyse time and space complexity of 5 sorting algorithms.',   deadline: dateOffset(-5), status: 'closed', kanbanStatus: 'submitted',   maxMarks: 100 },
]

// Announcements covering all categories (academic, events, admin, general)
const ANNOUNCEMENTS_DATA = [
  { title: 'Mid-term Exam Schedule',       content: 'Mid-term exams are scheduled for 20–25 April 2026. Timetable will be shared on the notice board.',         audience: 'All',  category: 'academic', pinned: true  },
  { title: 'Guest Lecture: Cloud Basics',  content: 'A guest lecture on Cloud Computing fundamentals is on 18 April 2026 at 11 AM in the Seminar Hall.',        audience: 'All',  category: 'events',   pinned: false },
  { title: 'Lab Hours Extended',           content: 'Computer lab will be open until 9 PM on weekdays starting this week to support project work.',             audience: 'CS-A', category: 'academic', pinned: false },
  { title: 'Assignment Deadline Reminder', content: 'All pending assignments must be submitted before mid-term exams begin. No extensions will be granted.',    audience: 'CS-B', category: 'admin',    pinned: true  },
  { title: 'Sports Day Registration',      content: 'Students wishing to participate in Sports Day 2026 must register at the admin office by 17 April 2026.',   audience: 'All',  category: 'events',   pinned: false },
  { title: 'Library Fine Waiver',          content: 'All outstanding library fines are waived for the current semester. Please return overdue books by Friday.', audience: 'All',  category: 'admin',    pinned: false },
  { title: 'New Study Material Uploaded',  content: 'Chapter 7 slides for Data Structures and DBMS have been uploaded to the student portal.',                  audience: 'CS-A', category: 'academic', pinned: false },
  { title: 'Annual Tech Fest Announced',   content: 'TechVista 2026 is coming! Register your teams for hackathon, quiz, and project expo by 30 April 2026.',    audience: 'All',  category: 'general',  pinned: true  },
]

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const isAtlas = MONGODB_URI.includes('mongodb+srv://')
  const hostMatch = MONGODB_URI.match(/@([^\/?]+)/)
  const host = hostMatch ? hostMatch[1] : 'local or unknown host'

  console.log(`🔗  Connecting to MongoDB...`)
  if (process.env.DEBUG_DB === 'true') {
    console.log(`[DEBUG] Target Host: ${host}`)
    console.log(`[DEBUG] Connecting with TLS and 10s timeout...`)
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      tls: true,
      serverSelectionTimeoutMS: 10000,
    })
    console.log('✅  Connected to MongoDB.\n')
  } catch (err) {
    console.error('\n❌  MongoDB Connection Failed!')
    console.error(`    Error: ${err.message}`)
    
    if (err.message.includes('tls') || err.message.includes('SSL') || err.message.includes('tlsv1 alert')) {
      console.error('\n🔍  DIAGNOSTIC (TLS/SSL Issue):')
      console.error('    - Check if your connection permits outbound TLS over port 27017.')
      console.error('    - Could be an anti-virus or proxy intercepting the SSL handshake.')
    } else if (err.message.includes('timeout') || err.name === 'MongooseServerSelectionError') {
      console.error('\n🔍  DIAGNOSTIC (Timeout Issue):')
      if (isAtlas) {
        console.error('    - You are using MongoDB Atlas.')
        console.error('    - LIKELY CAUSE: Your IP address is not whitelisted.')
        console.error('    - FIX: Go to Atlas > Network Access > Add IP Address > "0.0.0.0/0" for testing.')
      } else {
        console.error('    - Check if the database is running and accessible at the network address.')
      }
    } else if (err.message.includes('bad auth')) {
      console.error('\n🔍  DIAGNOSTIC (Auth Issue): Check if your password contains unencoded special characters.')
    }
    process.exit(1)
  }

  try {
    // ── Resolve teacher ──────────────────────────────────────────────────────────
    let teacherId = process.env.TEACHER_CLERK_ID

    if (teacherId) {
      console.log(`ℹ️   Using TEACHER_CLERK_ID from env: ${teacherId}`)
      const exists = await Teacher.exists({ clerkId: teacherId })
      if (!exists) {
        console.log('⚠️   No Teacher found with that clerkId – creating a placeholder record.')
        await Teacher.create({
          clerkId: teacherId,
          name: 'Demo Teacher',
          email: 'demo@college.edu',
          ...TEACHER_PROFILE,
        })
      } else {
        // Update profile fields on existing teacher
        await Teacher.findOneAndUpdate(
          { clerkId: teacherId },
          { $set: TEACHER_PROFILE },
        )
        console.log('ℹ️   Updated teacher profile (department, subjects, bio, academicHistory).')
      }
    } else {
      const teacher = await Teacher.findOne().sort({ createdAt: 1 }).lean()
      if (!teacher) {
        console.error(
          '\n❌  No Teacher document found in the database.\n' +
          '    Sign in to the app once (it auto-creates your Teacher doc via /api/profile),\n' +
          '    then re-run this script.\n' +
          '    Alternatively: TEACHER_CLERK_ID=<your_clerk_id> node scripts/seed.mjs\n'
        )
        process.exit(1)
      }
      teacherId = teacher.clerkId
      console.log(`ℹ️   Seeding as teacher: "${teacher.name}" (${teacherId})`)

      // Fill in profile fields if they're still at defaults
      await Teacher.findOneAndUpdate(
        { clerkId: teacherId },
        { $set: TEACHER_PROFILE },
      )
      console.log('ℹ️   Updated teacher profile (department, subjects, bio, academicHistory).')
    }

    // ── Clear existing seed data for this teacher ────────────────────────────────
    console.log('\n🧹  Clearing existing data for this teacher…')
    await Promise.all([
      Student.deleteMany({ teacherId }),
      Attendance.deleteMany({ teacherId }),
      Assignment.deleteMany({ teacherId }),
      Grade.deleteMany({ teacherId }),
      Announcement.deleteMany({ teacherId }),
    ])
    console.log('    ✔ Cleared.')

    // ── Students ─────────────────────────────────────────────────────────────────
    console.log('\n👨‍🎓  Inserting 10 students…')
    const students = await Student.insertMany(
      STUDENTS_DATA.map(s => ({ ...s, teacherId }))
    )
    console.log(`    ✔ ${students.length} students created.`)

    // ── Attendance (last 14 days for every student) ──────────────────────────────
    console.log('\n📋  Inserting attendance records (last 14 days)…')
    const statusPool = ['present', 'present', 'present', 'present', 'present', 'absent', 'late']
    const attendanceDocs = []
    for (let day = -13; day <= 0; day++) {
      const date = dateStr(day)
      for (const student of students) {
        attendanceDocs.push({
          teacherId,
          studentId: student._id,
          studentName: student.name,
          class: student.class,
          date,
          status: statusPool[Math.floor(Math.random() * statusPool.length)],
        })
      }
    }
    const attendance = await Attendance.insertMany(attendanceDocs)
    console.log(`    ✔ ${attendance.length} attendance records created.`)

    // ── Assignments ───────────────────────────────────────────────────────────────
    console.log('\n📝  Inserting 6 assignments (all statuses & kanbanStatuses)…')
    const assignments = await Assignment.insertMany(
      ASSIGNMENTS_DATA.map(a => ({ ...a, teacherId }))
    )
    console.log(`    ✔ ${assignments.length} assignments created.`)

    // ── Grades (Term 1 & Term 2 for each student × each subject) ─────────────────
    console.log('\n🎓  Inserting grades (2 terms × 5 subjects × 10 students)…')
    const gradeDocs = []
    const terms = ['Term 1', 'Term 2']
    for (const student of students) {
      for (const subject of SUBJECTS) {
        for (const term of terms) {
          const marks = Math.floor(Math.random() * 41) + 55 // 55–95
          gradeDocs.push({
            teacherId,
            studentId: student._id,
            studentName: student.name,
            subject,
            marks,
            maxMarks: 100,
            grade: gradeFromMarks(marks),
            term,
          })
        }
      }
    }
    const grades = await Grade.insertMany(gradeDocs)
    console.log(`    ✔ ${grades.length} grade records created.`)

    // ── Announcements (all categories) ───────────────────────────────────────────
    console.log('\n📢  Inserting 8 announcements (all categories)…')
    const announcements = await Announcement.insertMany(
      ANNOUNCEMENTS_DATA.map(a => ({ ...a, teacherId }))
    )
    console.log(`    ✔ ${announcements.length} announcements created.`)

    // ── Verification ─────────────────────────────────────────────────────────────
    console.log('\n🔎  Verifying inserted data…')
    const verifyCounts = {
      students: await Student.countDocuments({ teacherId }),
      attendance: await Attendance.countDocuments({ teacherId }),
      assignments: await Assignment.countDocuments({ teacherId }),
      grades: await Grade.countDocuments({ teacherId }),
      announcements: await Announcement.countDocuments({ teacherId }),
    }
    
    if (process.env.DEBUG_DB === 'true') {
      console.log('[DEBUG] DB Counts:', verifyCounts)
    }
    
    if (!verifyCounts.students || !verifyCounts.attendance || !verifyCounts.assignments || !verifyCounts.grades || !verifyCounts.announcements) {
      throw new Error(`Verification failed! Zeros detected in one or more collections.\nCounts: ${JSON.stringify(verifyCounts)}`)
    }
    console.log('    ✔ Data verified successfully.')

    // ── Summary ───────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🌱  Data seeded successfully!')
    console.log(`    Teacher profile:  updated`)
    console.log(`    Students:         ${verifyCounts.students}`)
    console.log(`    Attendance:       ${verifyCounts.attendance} (14 days)`)
    console.log(`    Assignments:      ${verifyCounts.assignments} (todo / in_progress / submitted)`)
    console.log(`    Grades:           ${verifyCounts.grades} (Term 1 & Term 2)`)
    console.log(`    Announcements:    ${verifyCounts.announcements} (academic / events / admin / general)`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    process.exit(0)
  } catch (err) {
    console.error('\n❌  Seed operations failed:')
    console.error(`    ${err.message ?? err}`)
    throw err
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error('\n❌  Seed failed:', err.message ?? err)
  process.exit(1)
})
