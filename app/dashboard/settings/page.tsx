"use client";

import { useState } from "react";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import {useAuth} from "@/lib/auth-context";

export default function SettingsPage() {
    const { user } = useAuth();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess(false);

        // Client-side validation
        if (newPassword !== confirmPassword) {
            setError("Le nouveau mot de passe et la confirmation ne correspondent pas");
            return;
        }

        if (newPassword.length < 6) {
            setError("Le nouveau mot de passe doit contenir au moins 6 caracteres");
            return;
        }

        setLoading(true);
        try {
            await authApi.changePassword({
                currentPassword,
                newPassword,
                confirmPassword,
            });
            setSuccess(true);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            if (err instanceof Error) {
                if (err.message.includes("Current password is incorrect")) {
                    setError("Le mot de passe actuel est incorrect");
                } else if (err.message.includes("do not match")) {
                    setError("Le nouveau mot de passe et la confirmation ne correspondent pas");
                } else if (err.message.includes("different from current")) {
                    setError("Le nouveau mot de passe doit etre different du mot de passe actuel");
                } else {
                    setError(err.message || "Une erreur est survenue");
                }
            } else {
                setError("Une erreur est survenue");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-6">
            <div className="mx-auto max-w-2xl">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-[#0A1A44]">Parametres du compte</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gerez vos informations de compte et votre securite
                    </p>
                </div>

                {/* User Info Card */}
                <Card className="mb-6 border-0 shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-[#1A3A8A] to-[#0A1A44] text-white rounded-t-lg">
                        <CardTitle className="text-lg">Informations du compte</CardTitle>
                        <CardDescription className="text-blue-100">
                            Vos informations de connexion actuelles
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid gap-4">
                            <div className="flex items-center justify-between py-2 border-b border-border">
                                <span className="text-sm font-medium text-muted-foreground">Email</span>
                                <span className="text-sm font-semibold">{user?.email}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-border">
                                <span className="text-sm font-medium text-muted-foreground">Role</span>
                                <span className="inline-flex items-center rounded-full bg-[#1A3A8A]/10 px-3 py-1 text-xs font-semibold text-[#1A3A8A]">
                  {user?.role}
                </span>
                            </div>
                            {user?.regionName && (
                                <div className="flex items-center justify-between py-2 border-b border-border">
                                    <span className="text-sm font-medium text-muted-foreground">Region</span>
                                    <span className="text-sm font-semibold">{user.regionName}</span>
                                </div>
                            )}
                            {user?.provinceName && (
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-sm font-medium text-muted-foreground">Province</span>
                                    <span className="text-sm font-semibold">{user.provinceName}</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Change Password Card */}
                <Card className="border-0 shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-[#1A3A8A] to-[#0A1A44] text-white rounded-t-lg">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Lock className="h-5 w-5" />
                            Changer le mot de passe
                        </CardTitle>
                        <CardDescription className="text-blue-100">
                            Mettez a jour votre mot de passe pour securiser votre compte
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        {success && (
                            <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-4 text-green-800">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <span className="text-sm font-medium">Mot de passe modifie avec succes</span>
                            </div>
                        )}

                        {error && (
                            <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
                                <AlertCircle className="h-5 w-5 text-red-600" />
                                <span className="text-sm font-medium">{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword" className="text-sm font-semibold">
                                    Mot de passe actuel
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="currentPassword"
                                        type={showCurrentPassword ? "text" : "password"}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="Entrez votre mot de passe actuel"
                                        required
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="newPassword" className="text-sm font-semibold">
                                    Nouveau mot de passe
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="newPassword"
                                        type={showNewPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Entrez votre nouveau mot de passe"
                                        required
                                        minLength={6}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground">Minimum 6 caracteres</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-sm font-semibold">
                                    Confirmer le nouveau mot de passe
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirmez votre nouveau mot de passe"
                                        required
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                                className="w-full bg-gradient-to-r from-[#1A3A8A] to-[#0A1A44] text-white shadow-md hover:shadow-lg"
                            >
                                {loading ? "Modification en cours..." : "Modifier le mot de passe"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
