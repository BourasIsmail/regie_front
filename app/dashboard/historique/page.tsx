"use client";

import React from "react";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { historiqueApi, regionsApi, provincesApi } from "@/lib/api";
import type { HistoriqueAlimentation, Region, Province } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  History,
  Search,
  Download,
  RefreshCw,
  Filter,
  FileText,
  LayoutGrid,
} from "lucide-react";

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
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getTypeBadge(type: string | null) {
  const t = (type || "").toLowerCase();
  let classes = "bg-secondary text-foreground";
  let label = type || "N/A";
  if (t === "alimentation") {
    classes = "bg-[#059669] text-white";
    label = "ALIMENTATION";
  } else if (t === "avance") {
    classes = "bg-[#D4AF37] text-white";
    label = "AVANCE";
  } else if (t === "depense") {
    classes = "bg-[#DC2626] text-white";
    label = "DEPENSE";
  } else if (t === "modification") {
    classes = "bg-[#1A3A8A] text-white";
    label = "MODIFICATION";
  } else if (t === "suppression") {
    classes = "bg-[#991B1B] text-white";
    label = "SUPPRESSION";
  } else if (t === "creation") {
    classes = "bg-[#6B21A8] text-white";
    label = "CREATION";
  }
  return (
      <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${classes}`}
      >
      {label}
    </span>
  );
}

export default function HistoriquePage() {
  const { user } = useAuth();
  const [historique, setHistorique] = useState<HistoriqueAlimentation[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterRegion, setFilterRegion] = useState("");
  const [filterProvince, setFilterProvince] = useState("");
  const [filterCompte, setFilterCompte] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDateStart, setFilterDateStart] = useState("");
  const [filterDateEnd, setFilterDateEnd] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let data: HistoriqueAlimentation[];

      // Filter data based on user role
      if (user?.role === "PROV" && user.provinceId) {
        // PROV can only see their province's history
        data = await historiqueApi.getByProvince(user.provinceId);
      } else if (user?.role === "REGION" && user.regionId) {
        // REGION can see all provinces in their region
        data = await historiqueApi.getByRegion(user.regionId);
      } else {
        // ADMIN can see all
        data = await historiqueApi.getAll();
      }

      const [regionsData, provincesData] = await Promise.all([
        regionsApi.getAll(),
        provincesApi.getAll(),
      ]);
      setHistorique(data);
      setRegions(regionsData);
      setProvinces(provincesData);

      // Pre-set filters based on user role
      if (user?.role === "PROV" && user.provinceId) {
        const prov = provincesData.find((p) => p.id === user.provinceId);
        if (prov) {
          setFilterRegion(String(prov.regionId));
          setFilterProvince(String(user.provinceId));
        }
      } else if (user?.role === "REGION" && user.regionId) {
        setFilterRegion(String(user.regionId));
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  // Get unique compte codes
  const uniqueComptes = Array.from(new Set(historique.map((h) => h.compteCode)));

  // Get provinces for selected region
  const filteredProvinces = filterRegion
      ? provinces.filter(p => p.regionId === Number(filterRegion))
      : provinces;

  // Apply filters
  const filtered = historique.filter((h) => {
    // Region filter - use regionId directly
    const matchRegion = filterRegion
        ? h.regionId === Number(filterRegion)
        : true;
    // Province filter
    const matchProvince = filterProvince
        ? h.provinceId === Number(filterProvince)
        : true;
    const matchCompte = filterCompte ? h.compteCode === filterCompte : true;
    const matchType = filterType
        ? (h.typeOperation || "").toLowerCase() === filterType.toLowerCase()
        : true;
    const matchDateStart = filterDateStart
        ? new Date(h.createdAt) >= new Date(filterDateStart)
        : true;
    const matchDateEnd = filterDateEnd
        ? new Date(h.createdAt) <= new Date(filterDateEnd + "T23:59:59")
        : true;
    return matchRegion && matchProvince && matchCompte && matchType && matchDateStart && matchDateEnd;
  });

  const resetFilters = () => {
    // Only reset filters that user can change
    if (user?.role === "ADMIN") {
      setFilterRegion("");
    }
    if (user?.role !== "PROV") {
      setFilterProvince("");
    }
    setFilterCompte("");
    setFilterType("");
    setFilterDateStart("");
    setFilterDateEnd("");
  };

  const exportCsv = () => {
    const headers = [
      "Date",
      "Region",
      "Compte",
      "Libelle",
      "Type",
      "Montant",
      "Utilisateur",
      "OP",
      "Date OP",
      "Cheque",
      "Date Cheque",
      "Ancien Encaissement",
      "Nouvel Encaissement",
      "Plafond Fixe",
      "Commentaire",
    ];
    const rows = filtered.map((h) => [
      h.createdAt,
      h.provinceName,
      h.compteCode,
      h.libelle,
      h.typeOperation || "",
      h.montantAlimentation,
      h.createdBy,
      h.op || "",
      h.dateOp || "",
      h.numCheque || "",
      h.dateCheque || "",
      h.ancienEncaissement ?? "",
      h.nouveauEncaissement ?? "",
      h.nouveauPlafondFixe ?? "",
      h.commentaire || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "historique_operations.csv";
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

  return (
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-[#0A1A44]">
            <History className="h-6 w-6 text-[#1A3A8A]" />
            Historique des Operations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consultez l{"'"}historique complet des alimentations, avances et
            modifications
          </p>
        </div>

        {/* Filter Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#1A3A8A]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#0A1A44]">
              Filtrer l{"'"}historique
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            {/* Region filter - only for ADMIN */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Region
              </label>
              <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50"
                  value={filterRegion}
                  onChange={(e) => {
                    setFilterRegion(e.target.value);
                    setFilterProvince("");
                  }}
                  disabled={user?.role === "REGION" || user?.role === "PROV"}
              >
                <option value="">Toutes les regions</option>
                {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                ))}
              </select>
            </div>
            {/* Province filter - for ADMIN and REGION */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Province
              </label>
              <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50"
                  value={filterProvince}
                  onChange={(e) => setFilterProvince(e.target.value)}
                  disabled={user?.role === "PROV"}
              >
                <option value="">Toutes les provinces</option>
                {filteredProvinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Compte
              </label>
              <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={filterCompte}
                  onChange={(e) => setFilterCompte(e.target.value)}
              >
                <option value="">Tous les comptes</option>
                {uniqueComptes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Type d{"'"}operation
              </label>
              <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">Tous les types</option>
                <option value="alimentation">Alimentation</option>
                <option value="depense">Depense</option>
                <option value="modification">Modification</option>
                <option value="suppression">Suppression</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Periode
              </label>
              <div className="flex items-center gap-2">
                <Input
                    type="date"
                    value={filterDateStart}
                    onChange={(e) => setFilterDateStart(e.target.value)}
                    className="h-10 text-sm"
                />
                <Input
                    type="date"
                    value={filterDateEnd}
                    onChange={(e) => setFilterDateEnd(e.target.value)}
                    className="h-10 text-sm"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button className="flex-1 bg-[#0A1A44] text-white hover:bg-[#1A3A8A] md:flex-none md:min-w-[180px]">
              <Search className="mr-2 h-4 w-4" />
              Appliquer
            </Button>
            <Button
                onClick={exportCsv}
                disabled={filtered.length === 0}
                className="flex-1 bg-[#059669] text-white hover:bg-[#047857] md:flex-none md:min-w-[180px]"
            >
              <FileText className="mr-2 h-4 w-4" />
              Exporter CSV
            </Button>
            <Button
                onClick={resetFilters}
                variant="outline"
                className="flex-1 md:flex-none md:min-w-[180px]"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reinitialiser
            </Button>
          </div>
        </div>

        {/* Results Table */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-[#0A1A44] to-[#1A3A8A] px-6 py-4 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-4 w-4 text-white" />
              <h2 className="text-sm font-bold text-white">
                Historique des operations
              </h2>
            </div>
            <span className="rounded-full bg-[#D4AF37] px-3 py-1 text-xs font-semibold text-white">
            {filtered.length} resultats
          </span>
          </div>

          {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <History className="mb-4 h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Aucun historique trouve
                </p>
              </div>
          ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1400px] border-separate border-spacing-0 text-sm">
                  <thead>
                  <tr className="bg-secondary/30">
                    <th className="h-12 border-b border-border px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Date
                    </th>
                    <th className="h-12 border-b border-border px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Region
                    </th>
                    <th className="h-12 border-b border-border px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Compte
                    </th>
                    <th className="h-12 border-b border-border px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Type
                    </th>
                    <th className="h-12 border-b border-border px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Montant
                    </th>
                    <th className="h-12 border-b border-border px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Utilisateur
                    </th>
                    <th className="h-12 border-b border-border px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Informations OP/Cheque
                    </th>
                    <th className="h-12 border-b border-border px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Details
                    </th>
                    <th className="h-12 border-b border-border px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Commentaire
                    </th>
                  </tr>
                  </thead>
                  <tbody>
                  {filtered.map((h, i) => (
                      <tr
                          key={h.id}
                          className={`border-b border-border/60 transition-colors hover:bg-secondary/20 ${
                              i % 2 === 0 ? "bg-white" : "bg-secondary/10"
                          }`}
                      >
                        <td className="h-16 px-4 text-xs text-muted-foreground">
                          {formatDate(h.createdAt)}
                        </td>
                        <td className="h-16 px-4 font-medium text-[#1A3A8A]">
                          {h.regionName || h.provinceName}
                        </td>
                        <td className="h-16 px-4">
                          <div className="flex flex-col">
                            <span className="font-mono text-sm">{h.compteCode}</span>
                            <span className="text-xs text-muted-foreground">
                          {h.libelle}
                        </span>
                          </div>
                        </td>
                        <td className="h-16 px-4">{getTypeBadge(h.typeOperation)}</td>
                        <td className="h-16 px-4 text-right font-semibold text-[#059669]">
                          {formatCurrency(h.montantAlimentation)}
                        </td>
                        <td className="h-16 px-4 text-sm text-foreground">
                          {h.createdBy}
                        </td>
                        <td className="h-16 px-4">
                          <div className="flex flex-col text-xs">
                            {(h.op || h.dateOp) && (
                                <span>
                            <span className="font-semibold">OP:</span> {h.op || "-"}{" "}
                                  {h.dateOp && `(${formatDateOnly(h.dateOp)})`}
                          </span>
                            )}
                            {(h.numCheque || h.dateCheque) && (
                                <span>
                            <span className="font-semibold">Cheque:</span>{" "}
                                  {h.numCheque || "-"}{" "}
                                  {h.dateCheque && `(${formatDateOnly(h.dateCheque)})`}
                          </span>
                            )}
                            {!h.op && !h.dateOp && !h.numCheque && !h.dateCheque && (
                                <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td className="h-16 px-4">
                          <div className="flex flex-col text-xs">
                            {h.ancienDisponible != null && h.nouveauDisponible != null && (
                                <span>
                            <span className="font-semibold">Disponible:</span>{" "}
                                  {formatCurrency(h.ancienDisponible)}{" "}
                                  <span className="text-muted-foreground">-&gt;</span>{" "}
                                  {formatCurrency(h.nouveauDisponible)}
                          </span>
                            )}
                            {h.ancienAvance != null && h.nouveauAvance != null && (
                                <span>
                            <span className="font-semibold">Avance:</span>{" "}
                                  {formatCurrency(h.ancienAvance)}{" "}
                                  <span className="text-muted-foreground">-&gt;</span>{" "}
                                  {formatCurrency(h.nouveauAvance)}
                          </span>
                            )}
                            {h.ancienDisponible == null &&
                                h.nouveauDisponible == null &&
                                h.ancienAvance == null &&
                                h.nouveauAvance == null && (
                                    <span className="text-muted-foreground">-</span>
                                )}
                          </div>
                        </td>
                        <td className="h-16 max-w-[200px] px-4 text-xs text-muted-foreground">
                          {h.commentaire || "-"}
                        </td>
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>
          )}
        </div>
      </div>
  );
}
