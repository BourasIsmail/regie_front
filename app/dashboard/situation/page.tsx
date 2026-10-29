"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
    plafondsApi,
    provincesApi,
    regionsApi,
    transactionsApi,
} from "@/lib/api";
import type {
    PlafondRegie,
    Province,
    Region,
    TransactionRegie,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    AlertCircle,
    Banknote,
    Download,
    Loader2,
    PiggyBank,
    Printer,
    RefreshCw,
    Search,
    TrendingDown,
    Wallet,
    X,
} from "lucide-react";

const ALLOWED_ROLES = ["ADMIN", "ADMIN_VIEW", "REGION", "PROV", "VIEW_REGION"];

function formatCurrency(value: number) {
    return (
        new Intl.NumberFormat("fr-MA", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value) + " DH"
    );
}

interface SituationRow {
    plafondId: number;
    provinceId: number;
    provinceName: string;
    regionId: number | null;
    regionName: string;
    compteCode: string;
    libelle: string;
    budgetAnnuel: number;
    depense: number;
    enAttente: number;
    disponibleRubrique: number;
    encaissement: number;
    taux: number;
}

const selectClass =
    "h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function SituationPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [plafonds, setPlafonds] = useState<PlafondRegie[]>([]);
    const [transactions, setTransactions] = useState<TransactionRegie[]>([]);
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [filterRegion, setFilterRegion] = useState("");
    const [filterProvince, setFilterProvince] = useState("");
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (user && !ALLOWED_ROLES.includes(user.role)) {
            router.push("/dashboard");
        }
    }, [user, router]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [plafondsData, transactionsData, provincesData, regionsData] =
                await Promise.all([
                    plafondsApi.getAll(),
                    transactionsApi.getAll(),
                    provincesApi.getAll(),
                    regionsApi.getAll(),
                ]);
            setPlafonds(plafondsData);
            setTransactions(transactionsData);
            setProvinces(provincesData);
            setRegions(regionsData);

            if (user?.role === "PROV" && user.provinceId) {
                const prov = provincesData.find((p) => p.id === user.provinceId);
                if (prov) setFilterRegion(String(prov.regionId));
                setFilterProvince(String(user.provinceId));
            } else if (
                (user?.role === "REGION" || user?.role === "VIEW_REGION") &&
                user.regionId
            ) {
                setFilterRegion(String(user.regionId));
            }
        } catch {
            setError("Erreur lors du chargement de la situation.");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const rows = useMemo<SituationRow[]>(() => {
        const provinceById = new Map(provinces.map((p) => [p.id, p]));
        const regionById = new Map(regions.map((r) => [r.id, r]));

        // Cumul des transactions par rubrique (province + compte)
        const totals = new Map<string, { depense: number; enAttente: number }>();
        for (const t of transactions) {
            const key = `${t.provinceId}|${t.compteCode}`;
            const acc = totals.get(key) ?? { depense: 0, enAttente: 0 };
            if (t.statut === "CONFIRMEE") acc.depense += t.montantValide ?? 0;
            else if (t.statut === "EN_ATTENTE") acc.enAttente += t.montant;
            totals.set(key, acc);
        }

        return plafonds.map((p) => {
            const prov = provinceById.get(p.provinceId);
            const region = prov ? regionById.get(prov.regionId) : undefined;
            const t = totals.get(`${p.provinceId}|${p.compteCode}`) ?? {
                depense: 0,
                enAttente: 0,
            };
            const budgetAnnuel = p.budgetAnnuelInitial || p.plafondAnnuel;
            return {
                plafondId: p.id,
                provinceId: p.provinceId,
                provinceName: p.provinceName,
                regionId: prov?.regionId ?? null,
                regionName: region?.name ?? prov?.regionName ?? "-",
                compteCode: p.compteCode,
                libelle: p.libelle,
                budgetAnnuel,
                depense: t.depense,
                enAttente: t.enAttente,
                disponibleRubrique: p.plafondAnnuel,
                encaissement: p.plafondEncaissement,
                taux: budgetAnnuel > 0 ? (t.depense / budgetAnnuel) * 100 : 0,
            };
        });
    }, [plafonds, transactions, provinces, regions]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows
            .filter((r) => !filterRegion || String(r.regionId) === filterRegion)
            .filter((r) => !filterProvince || String(r.provinceId) === filterProvince)
            .filter(
                (r) =>
                    !q ||
                    r.compteCode.toLowerCase().includes(q) ||
                    r.libelle.toLowerCase().includes(q) ||
                    r.provinceName.toLowerCase().includes(q)
            )
            .sort(
                (a, b) =>
                    a.regionName.localeCompare(b.regionName) ||
                    a.provinceName.localeCompare(b.provinceName) ||
                    a.compteCode.localeCompare(b.compteCode)
            );
    }, [rows, filterRegion, filterProvince, search]);

    const totals = useMemo(() => {
        const sum = (f: (r: SituationRow) => number) =>
            filteredRows.reduce((s, r) => s + f(r), 0);
        const budget = sum((r) => r.budgetAnnuel);
        const depense = sum((r) => r.depense);
        return {
            budget,
            depense,
            enAttente: sum((r) => r.enAttente),
            disponible: sum((r) => r.disponibleRubrique),
            encaissement: sum((r) => r.encaissement),
            taux: budget > 0 ? (depense / budget) * 100 : 0,
        };
    }, [filteredRows]);

    const isProv = user?.role === "PROV";
    const isRegionScoped = user?.role === "REGION" || user?.role === "VIEW_REGION";
    const availableProvinces = provinces.filter(
        (p) => !filterRegion || String(p.regionId) === filterRegion
    );
    const hasActiveFilters =
        search !== "" ||
        (!isProv && !isRegionScoped && (filterRegion !== "" || filterProvince !== "")) ||
        (isRegionScoped && filterProvince !== "");

    const resetFilters = () => {
        setSearch("");
        if (isProv) return;
        setFilterProvince("");
        if (!isRegionScoped) setFilterRegion("");
    };

    const exportCsv = () => {
        const header = [
            "Region",
            "Province",
            "Compte",
            "Libelle",
            "Budget annuel",
            "Depense confirmee",
            "En attente",
            "Disponible rubrique",
            "Encaissement",
            "Taux de consommation (%)",
        ];
        const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
        const lines = filteredRows.map((r) =>
            [
                r.regionName,
                r.provinceName,
                r.compteCode,
                r.libelle,
                r.budgetAnnuel.toFixed(2),
                r.depense.toFixed(2),
                r.enAttente.toFixed(2),
                r.disponibleRubrique.toFixed(2),
                r.encaissement.toFixed(2),
                r.taux.toFixed(1),
            ]
                .map(escape)
                .join(";")
        );
        // BOM pour l'ouverture correcte des accents dans Excel
        const csv = "﻿" + [header.map(escape).join(";"), ...lines].join("\r\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `situation-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (user && !ALLOWED_ROLES.includes(user.role)) return null;

    const kpis = [
        { label: "Budget annuel", value: totals.budget, icon: Wallet, color: "text-[#0A1A44]" },
        { label: "Dépenses confirmées", value: totals.depense, icon: TrendingDown, color: "text-red-600" },
        { label: "Disponible rubriques", value: totals.disponible, icon: PiggyBank, color: "text-emerald-600" },
        { label: "Encaissement disponible", value: totals.encaissement, icon: Banknote, color: "text-blue-600" },
    ];

    return (
        <div className="space-y-6 print:space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-[#0A1A44]">
                        Situation des régies
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Synthèse du budget, des dépenses et des disponibilités par rubrique.
                    </p>
                </div>
                <div className="flex gap-2 print:hidden">
                    <Button variant="outline" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Actualiser
                    </Button>
                    <Button variant="outline" onClick={exportCsv} disabled={filteredRows.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Exporter CSV
                    </Button>
                    <Button variant="outline" onClick={() => window.print()} disabled={filteredRows.length === 0}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimer
                    </Button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map(({ label, value, icon: Icon, color }) => (
                    <Card key={label}>
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="rounded-full bg-muted p-3">
                                <Icon className={`h-5 w-5 ${color}`} />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className={`text-lg font-bold ${color}`}>{formatCurrency(value)}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 print:hidden">
                <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un compte, un libellé, une province..."
                        className="pl-9"
                    />
                </div>
                {!isProv && !isRegionScoped && (
                    <select
                        className={selectClass}
                        value={filterRegion}
                        onChange={(e) => {
                            setFilterRegion(e.target.value);
                            setFilterProvince("");
                        }}
                    >
                        <option value="">Toutes les régions</option>
                        {regions.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name}
                            </option>
                        ))}
                    </select>
                )}
                {!isProv && (
                    <select
                        className={selectClass}
                        value={filterProvince}
                        onChange={(e) => setFilterProvince(e.target.value)}
                    >
                        <option value="">Toutes les provinces</option>
                        {availableProvinces.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                )}
                {hasActiveFilters && (
                    <Button variant="ghost" onClick={resetFilters}>
                        <X className="mr-1 h-4 w-4" />
                        Réinitialiser
                    </Button>
                )}
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Chargement...
                        </div>
                    ) : filteredRows.length === 0 ? (
                        <p className="py-20 text-center text-muted-foreground">
                            Aucune rubrique à afficher.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Province</th>
                                        <th className="px-4 py-3 text-left">Compte</th>
                                        <th className="px-4 py-3 text-left">Libellé</th>
                                        <th className="px-4 py-3 text-right">Budget annuel</th>
                                        <th className="px-4 py-3 text-right">Dépensé</th>
                                        <th className="px-4 py-3 text-right">En attente</th>
                                        <th className="px-4 py-3 text-right">Disponible rubrique</th>
                                        <th className="px-4 py-3 text-right">Encaissement</th>
                                        <th className="min-w-[140px] px-4 py-3 text-left">Consommation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredRows.map((r) => (
                                        <tr key={r.plafondId} className="hover:bg-muted/30">
                                            <td className="px-4 py-3">
                                                <div className="font-medium">{r.provinceName}</div>
                                                <div className="text-xs text-muted-foreground">{r.regionName}</div>
                                            </td>
                                            <td className="px-4 py-3 font-mono">{r.compteCode}</td>
                                            <td className="px-4 py-3">{r.libelle}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.budgetAnnuel)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums text-red-600">{formatCurrency(r.depense)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums text-amber-600">{formatCurrency(r.enAttente)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{formatCurrency(r.disponibleRubrique)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums text-blue-600">{formatCurrency(r.encaissement)}</td>
                                            <td className="px-4 py-3">
                                                <ConsumptionBar taux={r.taux} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-border bg-muted/50 font-semibold">
                                    <tr>
                                        <td className="px-4 py-3" colSpan={3}>
                                            Total ({filteredRows.length} rubrique{filteredRows.length > 1 ? "s" : ""})
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totals.budget)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-red-600">{formatCurrency(totals.depense)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-amber-600">{formatCurrency(totals.enAttente)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{formatCurrency(totals.disponible)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-blue-600">{formatCurrency(totals.encaissement)}</td>
                                        <td className="px-4 py-3">
                                            <ConsumptionBar taux={totals.taux} />
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function ConsumptionBar({ taux }: { taux: number }) {
    const pct = Math.min(Math.max(taux, 0), 100);
    const color = taux >= 90 ? "bg-red-500" : taux >= 70 ? "bg-amber-500" : "bg-emerald-500";
    return (
        <div className="flex items-center gap-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-12 text-right text-xs tabular-nums">{taux.toFixed(1)}%</span>
        </div>
    );
}
