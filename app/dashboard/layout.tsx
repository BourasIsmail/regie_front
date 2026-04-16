"use client";

import React from "react"

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DashboardTopbar } from "@/components/dashboard-topbar";

export default function DashboardLayout({
                                            children,
                                        }: {
    children: React.ReactNode;
}) {
    const { isLoading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push("/login");
        }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Chargement...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) return null;

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <DashboardTopbar />
            <main className="mx-auto mt-[70px] max-w-[1600px] flex-1 animate-in fade-in slide-in-from-bottom-5 p-8 duration-400">
                {children}
            </main>
            <footer className="border-t border-border bg-muted/30 py-4 text-center">
                <p className="text-xs text-muted-foreground">
                    Division des systemes d&apos;information et de la digitalisation – Entraide Nationale 2026
                </p>
            </footer>
        </div>
    );
}
