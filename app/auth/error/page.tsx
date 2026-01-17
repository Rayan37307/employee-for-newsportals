import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"

export default async function ErrorPage() {
  const session = await getServerSession()

  if (!session) {
    redirect("/auth/signin")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600">Authentication Error</h1>
        <p className="mt-4">There was an error with authentication. Please try again.</p>
        <a href="/auth/signin" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to Sign In
        </a>
      </div>
    </div>
  )
}