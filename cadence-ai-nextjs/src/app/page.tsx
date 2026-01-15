import { redirect } from 'next/navigation'

export default function Home() {
  // In production, check if user is authenticated
  // For now, redirect to login
  redirect('/login')
}
