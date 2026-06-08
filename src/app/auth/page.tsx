import { AuthCard } from "@/components/auth/auth-card";

export default function AuthPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-120px] h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-[-160px] right-[-80px] h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <AuthCard />
      </div>
    </main>
  );
}