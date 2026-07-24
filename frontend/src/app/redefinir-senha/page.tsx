import { Suspense } from "react";
import ResetPassword from "@/components/auth/ResetPassword";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <ResetPassword />
    </Suspense>
  );
}
