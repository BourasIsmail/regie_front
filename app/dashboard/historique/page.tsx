"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useExercice } from "@/lib/exercice-context";
import { historiqueApi, regionsApi, provincesApi } from "@/lib/api";
import type { JournalDetail, JournalEntry, Region, Province } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  Filter,
  History,
  LayoutGrid,
  RefreshCw,
} from "lucide-react";

const PAGE_SIZE = 50;

const ENTITE_LABELS: Record<string, string> = {
  PLAFOND: "Plafond",
  TRANSACTION: "Dépense",
  VERSEMENT: "Versement",
  EXERCICE: "Exercice",
  UTILISATEUR: "Utilisateur",
  REGION: "Région",
  PROVINCE: "Province",
};

const ACTION_LABELS: Record<string, string> = {
  CREATION: "Création",
  MODIFICATION: "Modification",
  SUPPRESSION: "Suppression",
  ALIMENTATION: "Alimentation",
  CORRECTION: "Correction",
  DEPENSE_EN_ATTENTE: "Dépense en attente",
  CONFIRMATION_DEPENSE: "Confirmation dépense",
  REJET_DEPENSE: "Rejet dépense",
  VERSEMENT: "Versement",
  ANNULATION: "Annulation",
  SUPPRESSION_VERSEMENT: "Suppression versement",
  ANNULATION_VERSEMENT: "Suppression versement",
  CLOTURE_EXERCICE: "Report exercice",
  CLOTURE: "Clôture exercice",
  CHANGEMENT_MOT_DE_PASSE: "Changement mot de passe",
};

const ACTION_COLORS: Record<string, string> = {
  CREATION: "bg-[#6B21A8] text-white",
  MODIFICATION: "bg-[#1A3A8A] text-white",
  SUPPRESSION: "bg-[#991B1B] text-white",
  SUPPRESSION_VERSEMENT: "bg-[#991B1B] text-white",
  ANNULATION_VERSEMENT: "bg-[#991B1B] text-white",
  ALIMENTATION: "bg-[#059669] text-white",
  CORRECTION: "bg-amber-600 text-white",
  DEPENSE_EN_ATTENTE: "bg-yellow-500 text-white",
  CONFIRMATION_DEPENSE: "bg-green-600 text-white",
  REJET_DEPENSE: "bg-red-600 text-white",
  VERSEMENT: "bg-teal-600 text-white",
  ANNULATION: "bg-orange-600 text-white",
  CLOTURE: "bg-[#0A1A44] text-white",
  CLOTURE_EXERCICE: "bg-[#0A1A44] text-white",
};

const actionLabel = (a: string) => ACTION_LABELS[a] ?? a;
const entiteLabel = (e: string) => ENTITE_LABELS[e] ?? e;

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "-";
  return (
      new Intl.NumberFormat("fr-MA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value) + " DH"
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Parses a yyyy-mm-dd input as a LOCAL date (new Date("yyyy-mm-dd") would be UTC). */
function localDate(value: string, endOfDay: boolean) {
  const [y, m, d] = value.split("-").map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseDetails(json: string | null): JournalDetail[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const selectClass =
    "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50";

export default function HistoriquePage() {
  const { user } = useAuth();
  const { exercice, ready: exerciceReady } = useExercice();
  const [historique, setHistorique] = useState<JournalEntry[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Filters
  const [filterRegion, setFilterRegion] = useState("");
  const [filterProvince, setFilterProvince] = useState("");
  const [filterCompte, setFilterCompte] = useState("");
  const [filterEntite, setFilterEntite] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterMontantMin, setFilterMontantMin] = useState("");
  const [filterMontantMax, setFilterMontantMax] = useState("");
  const [filterDateStart, setFilterDateStart] = useState("");
  const [filterDateEnd, setFilterDateEnd] = useState("");

  const isProv = user?.role === "PROV";
  const isRegionScoped = user?.role === "REGION" || user?.role === "VIEW_REGION";

  const fetchData = useCallback(async () => {
    if (!user || !exerciceReady) return;
    setLoading(true);
    setError("");
    try {
      // Le backend ne renvoie que ce que l'utilisateur a le droit de voir
      const [data, regionsData, provincesData] = await Promise.all([
        historiqueApi.getAll(exercice),
        regionsApi.getAll(),
        provincesApi.getAll(),
      ]);
      setHistorique(data);
      setRegions(regionsData);
      setProvinces(provincesData);

      if (isProv && user.provinceId) {
        const prov = provincesData.find((p) => p.id === user.provinceId);
        if (prov) setFilterRegion(String(prov.regionId));
        setFilterProvince(String(user.provinceId));
      } else if (isRegionScoped && user.regionId) {
        setFilterRegion(String(user.regionId));
      }
    } catch {
      setError("Erreur lors du chargement de l'historique.");
    } finally {
      setLoading(false);
    }
  }, [user, exercice, exerciceReady, isProv, isRegionScoped]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Back to the first page whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [
    filterRegion, filterProvince, filterCompte, filterEntite, filterAction, filterUser,
    filterSearch, filterMontantMin, filterMontantMax, filterDateStart, filterDateEnd, exercice,
  ]);

  const uniqueComptes = useMemo(
      () => Array.from(new Set(historique.map((h) => h.compteCode).filter((c): c is string => !!c))).sort(),
      [historique]
  );
  const uniqueEntites = useMemo(
      () => Array.from(new Set(historique.map((h) => h.entite))).sort(),
      [historique]
  );
  const uniqueActions = useMemo(
      () =>
          Array.from(
              new Set(
                  historique
                      .filter((h) => !filterEntite || h.entite === filterEntite)
                      .map((h) => h.action)
              )
          ).sort((a, b) => actionLabel(a).localeCompare(actionLabel(b))),
      [historique, filterEntite]
  );
  const uniqueUsers = useMemo(
      () => Array.from(new Set(historique.map((h) => h.createdBy).filter(Boolean))).sort(),
      [historique]
  );

  const filteredProvinces = filterRegion
      ? provinces.filter((p) => p.regionId === Number(filterRegion))
      : provinces;

  const filtered = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    const min = filterMontantMin !== "" ? Number(filterMontantMin) : null;
    const max = filterMontantMax !== "" ? Number(filterMontantMax) : null;
    const start = filterDateStart ? localDate(filterDateStart, false) : null;
    const end = filterDateEnd ? localDate(filterDateEnd, true) : null;
    return historique.filter((h) => {
      if (filterRegion && h.regionId !== Number(filterRegion)) return false;
      if (filterProvince && h.provinceId !== Number(filterProvince)) return false;
      if (filterCompte && h.compteCode !== filterCompte) return false;
      if (filterEntite && h.entite !== filterEntite) return false;
      if (filterAction && h.action !== filterAction) return false;
      if (filterUser && h.createdBy !== filterUser) return false;
      if (min !== null && (h.montant == null || h.montant < min)) return false;
      if (max !== null && (h.montant == null || h.montant > max)) return false;
      const created = new Date(h.createdAt);
      if (start && created < start) return false;
      if (end && created > end) return false;
      if (q) {
        const hay = [
          h.commentaire, h.details, h.op, h.numCheque, h.libelle, h.compteCode,
          h.provinceName, h.regionName, h.createdBy, actionLabel(h.action), entiteLabel(h.entite),
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    historique, filterRegion, filterProvince, filterCompte, filterEntite, filterAction, filterUser,
    filterSearch, filterMontantMin, filterMontantMax, filterDateStart, filterDateEnd,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetFilters = () => {
    if (!isProv && !isRegionScoped) setFilterRegion("");
    if (!isProv) setFilterProvince("");
    setFilterCompte("");
    setFilterEntite("");
    setFilterAction("");
    setFilterUser("");
    setFilterSearch("");
    setFilterMontantMin("");
    setFilterMontantMax("");
    setFilterDateStart("");
    setFilterDateEnd("");
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "Date", "Exercice", "Entite", "Action", "Region", "Province", "Compte", "Libelle", "Montant",
      "Utilisateur", "OP", "Date OP", "Cheque", "Date Cheque", "Ancien Encaissement",
      "Nouvel Encaissement", "Commentaire", "Details",
    ];
    const rows = filtered.map((h) => [
      h.createdAt, h.exercice ?? "", entiteLabel(h.entite), actionLabel(h.action),
      h.regionName ?? "", h.provinceName ?? "", h.compteCode ?? "", h.libelle ?? "", h.montant ?? "",
      h.createdBy, h.op ?? "", h.dateOp ?? "", h.numCheque ?? "", h.dateCheque ?? "",
      h.ancienEncaissement ?? "", h.nouveauEncaissement ?? "", h.commentaire ?? "",
      parseDetails(h.details).map((d) => `${d.champ}: ${d.avant ?? "-"} -> ${d.apres ?? "-"}`).join(" | "),
    ]);
    const csv = "﻿" + [headers, ...rows].map((r) => r.map(esc).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `historique_operations_${exercice}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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

  const th =
      "h-12 border-b border-border px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

  return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-[#0A1A44]">
            <History className="h-6 w-6 text-[#1A3A8A]" />
            Historique des Operations — Exercice {exercice}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Journal complet de toutes les opérations (plafonds, dépenses, versements, clôtures,
            utilisateurs…) avec le détail avant / après de chaque modification.
          </p>
        </div>

        {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#1A3A8A]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#0A1A44]">
              Filtrer l{"'"}historique
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Region">
              <select
                  className={selectClass}
                  value={filterRegion}
                  onChange={(e) => {
                    setFilterRegion(e.target.value);
                    setFilterProvince("");
                  }}
                  disabled={isProv || isRegionScoped}
              >
                <option value="">Toutes les regions</option>
                {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Province">
              <select
                  className={selectClass}
                  value={filterProvince}
                  onChange={(e) => setFilterProvince(e.target.value)}
                  disabled={isProv}
              >
                <option value="">Toutes les provinces</option>
                {filteredProvinces.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Compte">
              <select className={selectClass} value={filterCompte} onChange={(e) => setFilterCompte(e.target.value)}>
                <option value="">Tous les comptes</option>
                {uniqueComptes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Utilisateur">
              <select className={selectClass} value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
                <option value="">Tous les utilisateurs</option>
                {uniqueUsers.map((u) => (
                    <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </Field>
            <Field label="Objet">
              <select
                  className={selectClass}
                  value={filterEntite}
                  onChange={(e) => {
                    setFilterEntite(e.target.value);
                    setFilterAction("");
                  }}
              >
                <option value="">Tous les objets</option>
                {uniqueEntites.map((e) => (
                    <option key={e} value={e}>{entiteLabel(e)}</option>
                ))}
              </select>
            </Field>
            <Field label="Type d'operation">
              <select className={selectClass} value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
                <option value="">Tous les types</option>
                {uniqueActions.map((a) => (
                    <option key={a} value={a}>{actionLabel(a)}</option>
                ))}
              </select>
            </Field>
            <Field label="Montant (min / max)">
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="Min" value={filterMontantMin}
                       onChange={(e) => setFilterMontantMin(e.target.value)} className="h-10 text-sm" />
                <Input type="number" placeholder="Max" value={filterMontantMax}
                       onChange={(e) => setFilterMontantMax(e.target.value)} className="h-10 text-sm" />
              </div>
            </Field>
            <Field label="Periode">
              <div className="flex items-center gap-2">
                <Input type="date" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} className="h-10 text-sm" />
                <Input type="date" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} className="h-10 text-sm" />
              </div>
            </Field>
            <div className="md:col-span-2 lg:col-span-4">
              <Field label="Recherche (commentaire, details, OP, cheque, fournisseur...)">
                <Input
                    type="text"
                    placeholder="Rechercher..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="h-10 text-sm"
                />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={fetchData} variant="outline" className="md:min-w-[160px]">
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
            <Button
                onClick={exportCsv}
                disabled={filtered.length === 0}
                className="bg-[#059669] text-white hover:bg-[#047857] md:min-w-[160px]"
            >
              <FileText className="mr-2 h-4 w-4" />
              Exporter CSV
            </Button>
            <Button onClick={resetFilters} variant="outline" className="md:min-w-[160px]">
              Reinitialiser les filtres
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between rounded-t-2xl border-b border-border/60 bg-gradient-to-r from-[#0A1A44] to-[#1A3A8A] px-6 py-4">
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-4 w-4 text-white" />
              <h2 className="text-sm font-bold text-white">Historique des operations</h2>
            </div>
            <span className="rounded-full bg-[#D4AF37] px-3 py-1 text-xs font-semibold text-white">
            {filtered.length} resultat{filtered.length > 1 ? "s" : ""}
          </span>
          </div>

          {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <History className="mb-4 h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Aucun historique trouve</p>
              </div>
          ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1300px] border-separate border-spacing-0 text-sm">
                    <thead>
                    <tr className="bg-secondary/30">
                      <th className={th}>Date</th>
                      <th className={th}>Objet</th>
                      <th className={th}>Operation</th>
                      <th className={th}>Region / Province</th>
                      <th className={th}>Compte</th>
                      <th className={`${th} text-right`}>Montant</th>
                      <th className={th}>Encaissement</th>
                      <th className={th}>Utilisateur</th>
                      <th className={th}>OP / Cheque</th>
                      <th className={th}>Commentaire</th>
                      <th className={th} />
                    </tr>
                    </thead>
                    <tbody>
                    {pageRows.map((h, i) => {
                      const details = parseDetails(h.details);
                      const open = expanded === h.id;
                      return (
                          <React.Fragment key={h.id}>
                            <tr className={`border-b border-border/60 transition-colors hover:bg-secondary/20 ${i % 2 === 0 ? "bg-white" : "bg-secondary/10"}`}>
                              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(h.createdAt)}</td>
                              <td className="px-4 py-3 text-xs font-medium">{entiteLabel(h.entite)}</td>
                              <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${ACTION_COLORS[h.action] ?? "bg-secondary text-foreground"}`}>
                                {actionLabel(h.action).toUpperCase()}
                              </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="font-medium text-[#1A3A8A]">{h.regionName || "-"}</span>
                                  <span className="text-xs text-muted-foreground">{h.provinceName || ""}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {h.compteCode ? (
                                    <div className="flex flex-col">
                                      <span className="font-mono text-sm">{h.compteCode}</span>
                                      <span className="text-xs text-muted-foreground">{h.libelle}</span>
                                    </div>
                                ) : "-"}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-[#059669] whitespace-nowrap">{formatCurrency(h.montant)}</td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap">
                                {h.ancienEncaissement != null || h.nouveauEncaissement != null ? (
                                    <>
                                      {formatCurrency(h.ancienEncaissement)} <span className="text-muted-foreground">-&gt;</span>{" "}
                                      {formatCurrency(h.nouveauEncaissement)}
                                    </>
                                ) : "-"}
                              </td>
                              <td className="px-4 py-3 text-sm">{h.createdBy}</td>
                              <td className="px-4 py-3 text-xs">
                                {(h.op || h.dateOp) && (
                                    <div><span className="font-semibold">OP:</span> {h.op || "-"} {h.dateOp && `(${formatDateOnly(h.dateOp)})`}</div>
                                )}
                                {(h.numCheque || h.dateCheque) && (
                                    <div><span className="font-semibold">Cheque:</span> {h.numCheque || "-"} {h.dateCheque && `(${formatDateOnly(h.dateCheque)})`}</div>
                                )}
                                {!h.op && !h.dateOp && !h.numCheque && !h.dateCheque && <span className="text-muted-foreground">-</span>}
                              </td>
                              <td className="max-w-[260px] px-4 py-3 text-xs text-muted-foreground">{h.commentaire || "-"}</td>
                              <td className="px-2 py-3">
                                {details.length > 0 && (
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Details"
                                            onClick={() => setExpanded(open ? null : h.id)}>
                                      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                )}
                              </td>
                            </tr>
                            {open && (
                                <tr className="bg-secondary/10">
                                  <td colSpan={11} className="px-6 py-4">
                                    <table className="w-full max-w-3xl text-xs">
                                      <thead>
                                      <tr className="text-left text-muted-foreground">
                                        <th className="pb-1 pr-4 font-semibold">Champ</th>
                                        <th className="pb-1 pr-4 font-semibold">Avant</th>
                                        <th className="pb-1 font-semibold">Apres</th>
                                      </tr>
                                      </thead>
                                      <tbody>
                                      {details.map((d, k) => (
                                          <tr key={k} className="border-t border-border/50">
                                            <td className="py-1 pr-4 font-medium">{d.champ}</td>
                                            <td className="py-1 pr-4 text-red-700">{d.avant ?? "-"}</td>
                                            <td className="py-1 text-green-700">{d.apres ?? "-"}</td>
                                          </tr>
                                      ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                            )}
                          </React.Fragment>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-border/60 px-6 py-3 text-sm">
                <span className="text-muted-foreground">
                  Page {currentPage} / {pageCount}
                </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                      <ChevronLeft className="h-4 w-4" /> Precedent
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>
                      Suivant <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
          )}
        </div>
      </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-muted-foreground">{label}</label>
        {children}
      </div>
  );
}
