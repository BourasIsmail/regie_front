"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useExercice } from "@/lib/exercice-context";
import {
    ApiError,
    exercicesApi,
    provincesApi,
    regionsApi,
    situationApi,
    versementsApi,
} from "@/lib/api";
import type { CloturePrecheck, Province, Region, SituationRow } from "@/lib/types";
import {
    SITUATION_HEADERS,
    computeTotals,
    exportSituationExcel,
    exportSituationPdf,
} from "@/lib/situation-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
    AlertCircle,
    FileSpreadsheet,
    FileText,
    HandCoins,
    Loader2,
    Lock,
    RefreshCw,
    Search,
    X,
} from "lucide-react";

const ALLOWED_ROLES = ["ADMIN", "ADMIN_VIEW", "REGION", "PROV", "VIEW_REGION"];
const VERSEMENT_ROLES = ["ADMIN", "REGION", "PROV"];

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
    const { exercice, ready: exerciceReady, info: exerciceInfo, refresh: refreshExercices, isEditableFor } = useExercice();

    const [rows, setRows] = useState<SituationRow[]>([]);
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
    const [error, setError] = useState("");

    const [arreteAu, setArreteAu] = useState(today());
    const [filterRegion, setFilterRegion] = useState("");
    const [filterProvince, setFilterProvince] = useState("");
    const [search, setSearch] = useState("");

    // Versement modal
    const [versementModal, setVersementModal] = useState<SituationRow | null>(null);
    const [versementForm, setVersementForm] = useState({
        montant: "",
        dateVersement: today(),
        reference: "",
        commentaire: "",
        type: "VERSEMENT" as "VERSEMENT" | "ANNULATION",
    });
    const [versementSubmitting, setVersementSubmitting] = useState(false);
    const [versementError, setVersementError] = useState("");

    useEffect(() => {
        if (user && !ALLOWED_ROLES.includes(user.role)) {
            router.push("/dashboard");
        }
    }, [user, router]);

    // Clôture de l'exercice (admin)
    const [clotureProvince, setClotureProvince] = useState("");
    const [cloturePrecheck, setCloturePrecheck] = useState<CloturePrecheck | null>(null);
    const [clotureChecking, setClotureChecking] = useState(false);
    const [clotureConfirm, setClotureConfirm] = useState(false);
    const [clotureSubmitting, setClotureSubmitting] = useState(false);
    const [clotureMessage, setClotureMessage] = useState("");
    const [clotureError, setClotureError] = useState("");

    const fetchData = useCallback(async () => {
        if (!exerciceReady) return;
        setLoading(true);
        setError("");
        try {
            // Le backend ne renvoie que les régies visibles par l'utilisateur connecté
            const [situation, provincesData, regionsData] = await Promise.all([
                situationApi.get(exercice, arreteAu || undefined),
                provincesApi.getAll(),
                regionsApi.getAll(),
            ]);
            setRows(situation.rows);
            setProvinces(provincesData);
            setRegions(regionsData);
        } catch {
            setError("Erreur lors du chargement de la situation.");
        } finally {
            setLoading(false);
        }
    }, [exercice, exerciceReady, arreteAu]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Pré-sélection des filtres selon le rôle
    useEffect(() => {
        if (!user || provinces.length === 0) return;
        if (user.role === "PROV" && user.provinceId) {
            const prov = provinces.find((p) => p.id === user.provinceId);
            if (prov) setFilterRegion(String(prov.regionId));
            setFilterProvince(String(user.provinceId));
        } else if (
            (user.role === "REGION" || user.role === "VIEW_REGION") &&
            user.regionId
        ) {
            setFilterRegion(String(user.regionId));
        }
    }, [user, provinces]);

    const openVersement = (row: SituationRow) => {
        setVersementModal(row);
        setVersementForm({ montant: "", dateVersement: today(), reference: "", commentaire: "", type: "VERSEMENT" });
        setVersementError("");
    };

    const submitVersement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!versementModal) return;
        setVersementSubmitting(true);
        setVersementError("");
        try {
            await versementsApi.create(versementModal.plafondId, {
                montant: Number(versementForm.montant),
                dateVersement: versementForm.dateVersement || undefined,
                reference: versementForm.reference || undefined,
                commentaire: versementForm.commentaire || undefined,
                type: versementForm.type,
            });
            setVersementModal(null);
            await fetchData();
        } catch (err) {
            setVersementError(
                err instanceof ApiError ? err.message : "Erreur lors de l'enregistrement du versement."
            );
        } finally {
            setVersementSubmitting(false);
        }
    };

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

    const canVersement = !!user && VERSEMENT_ROLES.includes(user.role);
    const canCloturer = !!exerciceInfo?.peutCloturer;
    const provincesOuvertes = (exerciceInfo?.provinces ?? []).filter((p) => p.exerciceCourant === exercice);

    const runPrecheck = async (provinceId: string) => {
        setClotureProvince(provinceId);
        setCloturePrecheck(null);
        setClotureMessage("");
        setClotureError("");
        if (!provinceId) return;
        setClotureChecking(true);
        try {
            setCloturePrecheck(await exercicesApi.precheck(Number(provinceId), exercice));
        } catch (err) {
            setClotureError(err instanceof ApiError ? err.message : "Erreur lors de la vérification.");
        } finally {
            setClotureChecking(false);
        }
    };

    const submitCloture = async () => {
        if (!clotureProvince) return;
        setClotureSubmitting(true);
        setClotureError("");
        try {
            const res = await exercicesApi.cloturer(Number(clotureProvince), exercice);
            setClotureConfirm(false);
            setClotureMessage(`Exercice ${exercice} clôturé pour ${res.provinceName}. Les plafonds de ${exercice + 1} ont été remis à zéro.`);
            setClotureProvince("");
            setCloturePrecheck(null);
            await refreshExercices();
            await fetchData();
        } catch (err) {
            setClotureConfirm(false);
            setClotureError(err instanceof ApiError ? err.message : "Erreur lors de la clôture.");
        } finally {
            setClotureSubmitting(false);
        }
    };
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
                                        {canVersement && <th className="border border-border px-3 py-2" />}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((r) => (
                                        <tr key={`${r.provinceId}-${r.compteCode}`} className="hover:bg-muted/40">
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
                                            {canVersement && (
                                                <td className="border border-border px-2 py-1 text-center">
                                                    {r.cloture || !isEditableFor(r.provinceId) ? (
                                                        <span title="Exercice clôturé"><Lock className="mx-auto h-4 w-4 text-muted-foreground" /></span>
                                                    ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Enregistrer un versement / une annulation"
                                                        onClick={() => openVersement(r)}
                                                    >
                                                        <HandCoins className="h-4 w-4" />
                                                    </Button>
                                                    )}
                                                </td>
                                            )}
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
                                        {canVersement && <td className="border border-border" />}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {canCloturer && (
                <Card>
                    <CardContent className="space-y-4 p-6">
                        <div className="flex items-center gap-2">
                            <Lock className="h-5 w-5 text-[#1A3A8A]" />
                            <h2 className="text-lg font-bold text-[#0A1A44]">Clôturer l&apos;exercice {exercice}</h2>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            La clôture se fait province par province. Une fois clôturé, l&apos;exercice {exercice} est
                            conservé en lecture seule (consultable par l&apos;administration et la région concernée).
                            Pour {exercice + 1} : le disponible par rubrique redevient égal au plafond, l&apos;encaissement
                            passe à 0 et le plafond max facture est inchangé. La clôture est impossible tant qu&apos;un
                            solde est non nul ou qu&apos;une dépense est en attente.
                        </p>
                        {clotureMessage && (
                            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                                {clotureMessage}
                            </div>
                        )}
                        {clotureError && (
                            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {clotureError}
                            </div>
                        )}
                        {provincesOuvertes.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Aucune province n&apos;a l&apos;exercice {exercice} ouvert.
                            </p>
                        ) : (
                            <div className="flex flex-wrap items-center gap-3">
                                <select
                                    className={selectClass}
                                    value={clotureProvince}
                                    onChange={(e) => runPrecheck(e.target.value)}
                                >
                                    <option value="">Choisir une province...</option>
                                    {provincesOuvertes.map((p) => (
                                        <option key={p.provinceId} value={p.provinceId}>
                                            {p.provinceName}
                                        </option>
                                    ))}
                                </select>
                                <Button
                                    variant="destructive"
                                    disabled={!cloturePrecheck?.cloturable || clotureChecking}
                                    onClick={() => setClotureConfirm(true)}
                                >
                                    {clotureChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Clôturer l&apos;exercice {exercice}
                                </Button>
                            </div>
                        )}
                        {cloturePrecheck && !cloturePrecheck.cloturable && (
                            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                                <p className="mb-1 font-semibold">Clôture impossible pour {cloturePrecheck.provinceName} :</p>
                                <ul className="list-disc pl-5">
                                    {cloturePrecheck.blocages.map((b) => (
                                        <li key={b}>{b}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {cloturePrecheck?.cloturable && (
                            <p className="text-sm text-green-700">
                                {cloturePrecheck.provinceName} : tous les soldes sont à 0 et aucune dépense n&apos;est en attente.
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            <Dialog open={clotureConfirm} onOpenChange={(open) => !open && setClotureConfirm(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirmer la clôture</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm">
                        Clôturer l&apos;exercice <strong>{exercice}</strong> de{" "}
                        <strong>{cloturePrecheck?.provinceName}</strong> ? Cette action est définitive : les données{" "}
                        {exercice} ne seront plus modifiables.
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setClotureConfirm(false)}>
                            Annuler
                        </Button>
                        <Button variant="destructive" onClick={submitCloture} disabled={clotureSubmitting}>
                            {clotureSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Clôturer définitivement
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={!!versementModal} onOpenChange={(open) => !open && setVersementModal(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Enregistrer un versement / une annulation</DialogTitle>
                    </DialogHeader>
                    {versementModal && (
                        <form onSubmit={submitVersement} className="flex flex-col gap-4">
                            <p className="text-sm text-muted-foreground">
                                {versementModal.dp} — compte{" "}
                                <span className="font-mono">{versementModal.compteCode}</span>
                                <br />
                                Solde disponible:{" "}
                                <strong>{formatNumber(versementModal.solde)} DH</strong>
                            </p>
                            {versementError && (
                                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {versementError}
                                </div>
                            )}
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-semibold">Type *</Label>
                                <select
                                    className={selectClass}
                                    value={versementForm.type}
                                    onChange={(e) =>
                                        setVersementForm({ ...versementForm, type: e.target.value as "VERSEMENT" | "ANNULATION" })
                                    }
                                >
                                    <option value="VERSEMENT">Versement</option>
                                    <option value="ANNULATION">Annulation</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-semibold">Montant (DH) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={versementModal.solde}
                                    required
                                    value={versementForm.montant}
                                    onChange={(e) => setVersementForm({ ...versementForm, montant: e.target.value })}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-semibold">Date</Label>
                                <Input
                                    type="date"
                                    value={versementForm.dateVersement}
                                    onChange={(e) => setVersementForm({ ...versementForm, dateVersement: e.target.value })}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-semibold">Référence (reçu, virement...)</Label>
                                <Input
                                    maxLength={100}
                                    value={versementForm.reference}
                                    onChange={(e) => setVersementForm({ ...versementForm, reference: e.target.value })}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-semibold">Commentaire</Label>
                                <Input
                                    maxLength={500}
                                    value={versementForm.commentaire}
                                    onChange={(e) => setVersementForm({ ...versementForm, commentaire: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setVersementModal(null)}>
                                    Annuler
                                </Button>
                                <Button type="submit" disabled={versementSubmitting || !versementForm.montant}>
                                    {versementSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Enregistrer
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
