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
import {
    SITUATION_HEADERS,
    computeTotals,
    exportSituationExcel,
    exportSituationPdf,
    type SituationRow,
} from "@/lib/situation-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    AlertCircle,
    FileSpreadsheet,
    FileText,
    Loader2,
    RefreshCw,
    Search,
    X,
} from "lucide-react";

const ALLOWED_ROLES = ["ADMIN", "ADMIN_VIEW", "REGION", "PROV", "VIEW_REGION"];

function formatNumber(value: number) {
    return new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

const today = () => new Date().toISOString().slice(0, 10);

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
    const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
    const [error, setError] = useState("");

    const [exercice, setExercice] = useState(new Date().getFullYear());
    const [arreteAu, setArreteAu] = useState(today());
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

    // Une ligne par rubrique de régie (province + compte), comme dans l'état Excel.
    const rows = useMemo<(SituationRow & { regionId: number | null; provinceId: number })[]>(() => {
        const provinceById = new Map(provinces.map((p) => [p.id, p]));

        // Dépenses confirmées de l'exercice, jusqu'à la date d'arrêté
        const depenses = new Map<string, number>();
        for (const t of transactions) {
            if (t.statut !== "CONFIRMEE") continue;
            const date = (t.dateTransaction || "").slice(0, 10);
            if (!date || date.slice(0, 4) !== String(exercice)) continue;
            if (arreteAu && date > arreteAu) continue;
            const key = `${t.provinceId}|${t.compteCode}`;
            depenses.set(key, (depenses.get(key) ?? 0) + (t.montantValide ?? 0));
        }

        return plafonds.map((p) => {
            const prov = provinceById.get(p.provinceId);
            const plafondGlobal = p.budgetAnnuelInitial || p.plafondAnnuel;
            const avance = plafondGlobal - p.plafondAnnuel;
            const dep = depenses.get(`${p.provinceId}|${p.compteCode}`) ?? 0;
            return {
                key: String(p.id),
                provinceId: p.provinceId,
                regionId: prov?.regionId ?? null,
                dr: prov?.regionName ?? "-",
                dp: p.provinceName,
                compteCode: p.compteCode,
                plafondGlobal,
                avance,
                disponibleRubrique: p.plafondAnnuel,
                disponibleEncaisse: p.plafondEncaissement,
                depenses: dep,
                versement: 0,
                solde: avance - dep,
            };
        });
    }, [plafonds, transactions, provinces, exercice, arreteAu]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows
            .filter((r) => !filterRegion || String(r.regionId) === filterRegion)
            .filter((r) => !filterProvince || String(r.provinceId) === filterProvince)
            .filter(
                (r) =>
                    !q ||
                    r.compteCode.toLowerCase().includes(q) ||
                    r.dp.toLowerCase().includes(q) ||
                    r.dr.toLowerCase().includes(q)
            )
            .sort((a, b) => a.dp.localeCompare(b.dp) || a.compteCode.localeCompare(b.compteCode));
    }, [rows, filterRegion, filterProvince, search]);

    const totals = useMemo(() => computeTotals(filteredRows), [filteredRows]);

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

    const runExport = async (kind: "pdf" | "excel") => {
        setExporting(kind);
        try {
            if (kind === "pdf") await exportSituationPdf(filteredRows, exercice, arreteAu);
            else await exportSituationExcel(filteredRows, exercice, arreteAu);
        } catch {
            setError("Erreur lors de l'export.");
        } finally {
            setExporting(null);
        }
    };

    if (user && !ALLOWED_ROLES.includes(user.role)) return null;

    const numCell = "px-3 py-2 text-right tabular-nums whitespace-nowrap";

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-[#0A1A44]">
                        Situation des régies de dépenses
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Exercice {exercice} — arrêtée au{" "}
                        {arreteAu ? arreteAu.split("-").reverse().join("/") : "..."}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Actualiser
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => runExport("excel")}
                        disabled={filteredRows.length === 0 || exporting !== null}
                    >
                        {exporting === "excel" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                        )}
                        Excel
                    </Button>
                    <Button
                        onClick={() => runExport("pdf")}
                        disabled={filteredRows.length === 0 || exporting !== null}
                    >
                        {exporting === "pdf" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FileText className="mr-2 h-4 w-4" />
                        )}
                        PDF
                    </Button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                    Exercice
                    <Input
                        type="number"
                        className="w-24"
                        value={exercice}
                        min={2000}
                        max={2100}
                        onChange={(e) => setExercice(Number(e.target.value) || new Date().getFullYear())}
                    />
                </label>
                <label className="flex items-center gap-2 text-sm">
                    Arrêtée au
                    <Input
                        type="date"
                        className="w-40"
                        value={arreteAu}
                        onChange={(e) => setArreteAu(e.target.value)}
                    />
                </label>
                <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher une DR, une DP, un compte..."
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
                        <option value="">Toutes les DR</option>
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
                        <option value="">Toutes les DP</option>
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
                            Aucune régie à afficher.
                        </p>
                    ) : (
                        <div className="max-h-[70vh] overflow-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead className="sticky top-0 z-10 bg-yellow-300 text-xs text-black">
                                    <tr>
                                        {SITUATION_HEADERS.map((h, i) => (
                                            <th
                                                key={h}
                                                className={`border border-border px-3 py-2 ${i < 3 ? "text-left" : "text-center"}`}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((r) => (
                                        <tr key={r.key} className="hover:bg-muted/40">
                                            <td className="border border-border px-3 py-2 italic">{r.dr}</td>
                                            <td className="border border-border px-3 py-2 font-semibold">{r.dp}</td>
                                            <td className="border border-border px-3 py-2 font-semibold whitespace-nowrap">{r.compteCode}</td>
                                            <td className={`border border-border ${numCell}`}>{formatNumber(r.plafondGlobal)}</td>
                                            <td className={`border border-border bg-green-200 dark:bg-green-900/40 ${numCell}`}>{formatNumber(r.avance)}</td>
                                            <td className={`border border-border ${numCell}`}>{formatNumber(r.disponibleRubrique)}</td>
                                            <td className={`border border-border ${numCell}`}>{formatNumber(r.disponibleEncaisse)}</td>
                                            <td className={`border border-border bg-fuchsia-200 dark:bg-fuchsia-900/40 ${numCell}`}>{formatNumber(r.depenses)}</td>
                                            <td className={`border border-border ${numCell}`}>{formatNumber(r.versement)}</td>
                                            <td className={`border border-border font-bold ${numCell}`}>{formatNumber(r.solde)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="sticky bottom-0 bg-yellow-300 font-bold text-black">
                                    <tr>
                                        <td className="border border-border px-3 py-2 text-center" colSpan={3}>
                                            TOTAUX ({filteredRows.length})
                                        </td>
                                        <td className={`border border-border ${numCell}`}>{formatNumber(totals.plafondGlobal)}</td>
                                        <td className={`border border-border ${numCell}`}>{formatNumber(totals.avance)}</td>
                                        <td className={`border border-border ${numCell}`}>{formatNumber(totals.disponibleRubrique)}</td>
                                        <td className={`border border-border ${numCell}`}>{formatNumber(totals.disponibleEncaisse)}</td>
                                        <td className={`border border-border ${numCell}`}>{formatNumber(totals.depenses)}</td>
                                        <td className={`border border-border ${numCell}`}>{formatNumber(totals.versement)}</td>
                                        <td className={`border border-border ${numCell}`}>{formatNumber(totals.solde)}</td>
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
