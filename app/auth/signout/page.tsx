import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import SignOut from "@/components/auth/SignOut"

export default async function SignOutPage() {
  const session = await getServerSession()

  if (!session) {
    redirect("/auth/signin")
  }

  return <SignOut />
}