import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import SignIn from "@/components/auth/SignIn"

export default async function SignInPage() {
  const session = await getServerSession()

  if (session) {
    redirect("/dashboard")
  }

  return <SignIn />
}