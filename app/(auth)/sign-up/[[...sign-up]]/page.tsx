import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-indigo-950 via-indigo-900 to-purple-900">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">EduDesk</h1>
          <p className="text-indigo-300 mt-1 text-sm">Create your teacher account</p>
        </div>
        <SignUp />
      </div>
    </div>
  )
}
