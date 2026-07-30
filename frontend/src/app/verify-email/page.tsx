import { Suspense } from "react";
import VerifyEmail from "@/components/auth/VerifyEmail";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a]" />}>
      <VerifyEmail />
    </Suspense>
  );
}
