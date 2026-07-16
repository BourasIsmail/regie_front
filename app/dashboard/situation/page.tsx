"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { plafondsApi, provincesApi, regionsApi, transactionsApi, historiqueApi, ApiError } from "@/lib/api";
import { useRouter } from "next/navigation";
import type { PlafondRegie, Region, Province, TransactionRegie, HistoriqueAlimentation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { AlertCircle, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function SituationPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [regions, setRegions] = useState<Region[]>([]);
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [plafonds, setPlafonds] = useState<PlafondRegie[]>([]);
    const [filteredPlafonds, setFilteredPlafonds] = useState<PlafondRegie[]>([]);
    const [transactions, setTransactions] = useState<TransactionRegie[]>([]);
    const [alimentations, setAlimentations] = useState<HistoriqueAlimentation[]>([]);

    useEffect(() => {
        if (user && !["ADMIN", "ADMIN_VIEW", "REGION", "PROV", "VIEW_REGION"].includes(user.role)) {
            router.push("/dashboard");
        }
    }, [user, router]);

    useEffect(() => {
        fetchData();
    }, [user]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError("");

            const [regionsData, provincesData, plafondsData, transactionsData, alimentationsData] = await Promise.all([
                regionsApi.getAll(),
                provincesApi.getAll(),
                plafondsApi.getAll(),
                transactionsApi.getAll(),
                historiqueApi.getAll(),
            ]);

            setRegions(regionsData);
            setProvinces(provincesData);
            setPlafonds(plafondsData);
            setTransactions(transactionsData);
            setAlimentations(alimentationsData);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Erreur lors du chargement des données");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        filterData();
    }, [plafonds, user]);

    const filterData = () => {
        let filtered = [...plafonds];

        // Filter based on user role
        if (user?.role === "REGION" && user.regionId) {
            filtered = filtered.filter((p) => p.regionId === user.regionId);
        } else if (user?.role === "PROV" && user.provinceId) {
            filtered = filtered.filter((p) => p.provinceId === user.provinceId);
        } else if (user?.role === "VIEW_REGION" && user.regionId) {
            filtered = filtered.filter((p) => p.regionId === user.regionId);
        }

        // Sort by code
        filtered.sort((a, b) => (a.compteCode || "").localeCompare(b.compteCode || ""));
        setFilteredPlafonds(filtered);
    };

    const getDepensesForPlafond = (plafondId: number) => {
        return transactions
            .filter((tx) => tx.plafondId === plafondId && tx.statut === "CONFIRMEE")
            .reduce((sum, tx) => sum + (tx.montant || 0), 0);
    };

    const getAlimentationsForPlafond = (plafondId: number) => {
        return alimentations
            .filter((alim) => alim.plafondId === plafondId)
            .reduce((sum, alim) => sum + (alim.montantAlimentation || 0), 0);
    };

    const getRegionName = (regionId: number | null) => {
        if (!regionId) return "-";
        return regions.find((r) => r.id === regionId)?.name || "-";
    };

    const getProvinceName = (provinceId: number | null) => {
        if (!provinceId) return "-";
        return provinces.find((p) => p.id === provinceId)?.name || "-";
    };

    const calculateTotals = (data: PlafondRegie[]) => {
        const totalDepenses = data.reduce((sum, p) => sum + getDepensesForPlafond(p.id), 0);
        const totalAvance = data.reduce((sum, p) => sum + getAlimentationsForPlafond(p.id), 0);
        return {
            plafondAnnuel: data.reduce((sum, p) => sum + (p.plafondAnnuel || 0), 0),
            totalAvance: totalAvance,
            totalDepenses: totalDepenses,
            disponible: data.reduce(
                (sum, p) => sum + ((p.plafondAnnuel || 0) - (p.plafondEncaissement || 0)),
                0
            ),
        };
    };

    const totals = calculateTotals(filteredPlafonds);
    totals.solde = totals.totalAvance - totals.totalDepenses;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-[#0A1A44]">
                        Situation des Régies de Dépenses
                    </h1>
                    <p className="mt-1 text-base text-muted-foreground">
                        Exercice 2026
                    </p>
                </div>
                <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => window.print()}
                >
                    <Download className="h-4 w-4" />
                    Exporter
                </Button>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Situation Table */}
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gradient-to-r from-[#0A1A44] to-[#1A3A8A]">
                                <TableHead className="text-white">DRDP</TableHead>
                                <TableHead className="text-white">N° Compte</TableHead>
                                <TableHead className="text-right text-white">Plafond Annuel (I)</TableHead>
                                <TableHead className="text-right text-white">Total Avance (II)</TableHead>
                                <TableHead className="text-right text-white">Disponible (III=I-II)</TableHead>
                                <TableHead className="text-right text-white">Total Dépenses (IV)</TableHead>
                                <TableHead className="text-right text-white">Solde (V=II-IV)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPlafonds.map((plafond, index) => {
                                const avance = getAlimentationsForPlafond(plafond.id);
                                const depenses = getDepensesForPlafond(plafond.id);
                                const disponible = (plafond.plafondAnnuel || 0) - (plafond.plafondEncaissement || 0);
                                const solde = avance - depenses;

                                return (
                                    <TableRow
                                        key={plafond.id}
                                        className={`${
                                            index % 2 === 0 ? "bg-card" : "bg-secondary/20"
                                        } hover:bg-secondary/40`}
                                    >
                                        <TableCell className="font-medium">
                                            {getRegionName(plafond.regionId)}-{getProvinceName(plafond.provinceId)}
                                        </TableCell>
                                        <TableCell className="font-mono">{plafond.compteCode}</TableCell>
                                        <TableCell className="text-right">
                                            {(plafond.plafondAnnuel || 0).toLocaleString("fr-MA", {
                                                style: "currency",
                                                currency: "MAD",
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {avance.toLocaleString("fr-MA", {
                                                style: "currency",
                                                currency: "MAD",
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {disponible.toLocaleString("fr-MA", {
                                                style: "currency",
                                                currency: "MAD",
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {depenses.toLocaleString("fr-MA", {
                                                style: "currency",
                                                currency: "MAD",
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {solde.toLocaleString("fr-MA", {
                                                style: "currency",
                                                currency: "MAD",
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}

                            {/* Totals Row */}
                            <TableRow className="bg-gradient-to-r from-[#0A1A44]/10 to-transparent font-bold">
                                <TableCell>TOTAUX</TableCell>
                                <TableCell>-</TableCell>
                                <TableCell className="text-right">
                                    {totals.plafondAnnuel.toLocaleString("fr-MA", {
                                        style: "currency",
                                        currency: "MAD",
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </TableCell>
                                <TableCell className="text-right">
                                    {totals.totalAvance.toLocaleString("fr-MA", {
                                        style: "currency",
                                        currency: "MAD",
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </TableCell>
                                <TableCell className="text-right">
                                    {totals.disponible.toLocaleString("fr-MA", {
                                        style: "currency",
                                        currency: "MAD",
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </TableCell>
                                <TableCell className="text-right">
                                    {totals.totalDepenses.toLocaleString("fr-MA", {
                                        style: "currency",
                                        currency: "MAD",
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </TableCell>
                                <TableCell className="text-right">
                                    {totals.solde.toLocaleString("fr-MA", {
                                        style: "currency",
                                        currency: "MAD",
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
