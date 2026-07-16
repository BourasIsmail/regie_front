"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export default function SituationPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user && !["ADMIN", "ADMIN_VIEW", "REGION", "PROV", "VIEW_REGION"].includes(user.role)) {
            router.push("/dashboard");
        }
    }, [user, router]);

    return (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
            <h1 className="text-4xl font-extrabold tracking-tight text-[#0A1A44]">Situation</h1>
            <p className="text-lg text-muted-foreground">En cours de développement</p>
        </div>
    );
}
