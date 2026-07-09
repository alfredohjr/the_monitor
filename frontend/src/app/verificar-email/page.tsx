import { Suspense } from "react";
import VerifyEmail from "@/components/auth/VerifyEmail";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <VerifyEmail />
    </Suspense>
  );
}
