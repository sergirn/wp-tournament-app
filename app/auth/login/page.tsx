"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Image from "next/image"

export default function LoginPage() { 
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      router.push("/")
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to sign in")
      setIsLoading(false)
    }
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.06] dark:opacity-[0.14]"
          style={{ backgroundImage: "url('/images/3.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-muted/40" />
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[260px] w-[260px] rounded-full bg-foreground/5 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[220px] w-[220px] rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-6xl items-center justify-center px-6 py-10 md:px-10">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2">
          <div className="hidden lg:flex flex-col justify-center">
            <div className="max-w-md space-y-6">
              <div className="inline-flex items-center rounded-full border border-border/60 bg-background/70 px-4 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur-md">
                Sports management platform
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
                  Welcome back
                </h1>
                <p className="text-base leading-7 text-muted-foreground">
                  Sign in to manage tournaments, participants, and results through a cleaner, faster, and more professional experience.
                </p>
              </div>

              <div className="grid gap-3 pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  Secure access
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  Centralized management
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  Modern, efficient interface
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <Card className="overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-2xl backdrop-blur-2xl">
              <CardContent className="p-0">
                <div className="px-8 pb-8 pt-8 sm:px-10 sm:pt-10">
                  <div className="mb-8 flex flex-col items-center text-center">
                    <div className="mb-5 flex h-28 w-40 items-center justify-center rounded-2xl">
                      <Image
                        src="/images/bwmf-logo.png"
                        alt="Tournament Manager"
                        width={172}
                        height={172}
                        className="object-contain dark:brightness-0 dark:invert"
                        priority
                      />
                    </div>

                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                      Sign in
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Enter your credentials to access your account
                    </p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-foreground">
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 rounded-xl border-border bg-background/70 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
                      />
                    </div>

                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="password" className="text-sm font-medium text-foreground">
                          Password
                        </Label>
                      </div>

                      <Input
                        id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 rounded-xl border-border bg-background/70 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
                      />
                    </div>

                    {error && (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="h-12 w-full rounded-xl shadow-lg transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
                      disabled={isLoading}
                    >
                      {isLoading ? "Signing in..." : "Sign in"}
                    </Button>
                  </form>

                  <div className="mt-6 text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <Link
                      href="/auth/sign-up"
                      className="font-medium text-foreground underline underline-offset-4 transition hover:text-primary"
                    >
                      Create account
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
