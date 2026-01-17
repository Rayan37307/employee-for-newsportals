import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import SignUp from "@/components/auth/SignUp"

export default async function SignUpPage() {
  const session = await getServerSession()

  if (session) {
    redirect("/dashboard")
  }

  return <SignUp />
}