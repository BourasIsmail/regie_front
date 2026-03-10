"use client";

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, Lock, User, LogIn } from "lucide-react";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(username, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError("Identifiant ou mot de passe incorrect.");
        } else if (err.status === 0 || err.message === "Failed to fetch") {
          setError(
              "Impossible de se connecter au serveur. Veuillez verifier que le serveur est en cours d'execution."
          );
        } else {
          setError(err.message || "Une erreur est survenue.");
        }
      } else {
        setError("Impossible de se connecter au serveur. Veuillez reessayer.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
      <div className="flex min-h-screen flex-col bg-[#f8fafc]">
        {/* Main Content */}
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="flex w-full max-w-md flex-col items-center gap-8">
            {/* Logo Section */}
            <div className="flex flex-col items-center gap-4">
              <img
                  src="/images.png"
                  alt="Entraide Nationale - Royaume du Maroc"
                  className="h-auto w-96 object-contain"
              />
            </div>

            {/* Title */}
            <div className="flex flex-col items-center gap-1">
              <h1 className="text-3xl font-bold text-[#0A1A44]">Connexion</h1>
              <p className="text-sm text-muted-foreground">
                Accedez a votre tableau de bord
              </p>
            </div>

            {/* Login Card */}
            <div className="w-full rounded-2xl border border-border bg-white p-8 shadow-sm">
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {error && (
                    <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                )}

                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-[#0A1A44]">
                    <User className="h-4 w-4 text-[#1A3A8A]" />
                    Identifiant
                  </label>
                  <Input
                      type="text"
                      placeholder="Votre identifiant"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      className="h-12 border-[#1A3A8A]/20 bg-[#1A3A8A]/5 text-base focus:border-[#1A3A8A] focus:ring-[#1A3A8A]/20"
                      disabled={isSubmitting}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-[#0A1A44]">
                    <Lock className="h-4 w-4 text-[#1A3A8A]" />
                    Mot de passe
                  </label>
                  <Input
                      type="password"
                      placeholder="Votre mot de passe"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="h-12 border-[#1A3A8A]/20 bg-[#1A3A8A]/5 text-base focus:border-[#1A3A8A] focus:ring-[#1A3A8A]/20"
                      disabled={isSubmitting}
                  />
                </div>

                <Button
                    type="submit"
                    className="mt-2 h-12 w-full bg-[#1A3A8A] text-base font-semibold text-white hover:bg-[#0A1A44]"
                    disabled={isSubmitting}
                >
                  {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Connexion en cours...
                      </>
                  ) : (
                      <>
                        <LogIn className="mr-2 h-5 w-5" />
                        Se connecter
                      </>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span>Version 1.0</span>
                  <span>•</span>
                  <button
                      type="button"
                      className="text-[#1A3A8A] hover:underline"
                  >
                    Mot de passe oublie ?
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>


      </div>
  );
}
