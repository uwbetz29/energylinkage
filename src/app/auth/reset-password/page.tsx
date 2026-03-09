"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EDF5E0] via-[#F0F7E6] to-[#E8F0DB] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="flex justify-center mb-8">
          <Image
            src="/logo.png"
            alt="EnergyLink FLEX"
            width={706}
            height={149}
            className="w-[280px] h-auto"
            priority
          />
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-[#D4E4B8] p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-[#222] mb-2">
            Reset Password
          </h2>
          <p className="text-sm text-[#888] mb-6">
            Enter your email and we'll send you a reset link.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          {sent ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
                Check your email for a password reset link.
              </div>
              <Link
                href="/login"
                className="block text-center text-sm text-[#93C90F] hover:text-[#7AB00D] font-medium"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#555] mb-1 block">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#93C90F] hover:bg-[#86BB46] text-white font-medium"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Link
                href="/login"
                className="block text-center text-sm text-[#888] hover:text-[#555]"
              >
                Back to Sign In
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
