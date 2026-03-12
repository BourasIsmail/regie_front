"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { regionsApi, transactionsApi, plafondsApi, provincesApi } from "@/lib/api";
import type { Region, Province, PlafondRegie, TransactionRegie } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  MapPin,
  Loader2,
  Printer,
  ArrowLeft,
  CheckSquare,
} from "lucide-react";

interface RubriqueTotal {
  code: string;
  libelle: string;
  plafondAnnuel: number;
  encaissement: number;
  maxFacture: number;
  totalDepensesValidees: number;
}

function formatCurrencyDH(value: number) {
  return (
      new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value) + " DH"
  );
}

function formatDateFR(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function OrdreImputationPage() {
  const { user } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [rubriqueTotals, setRubriqueTotals] = useState<RubriqueTotal[]>([]);
  const [selectedRubriques, setSelectedRubriques] = useState<Set<string>>(
      new Set()
  );
  const [showPrint, setShowPrint] = useState(false);

  // Form fields
  const [oiNumero, setOiNumero] = useState(
      `OI-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`
  );
  const [oiDate, setOiDate] = useState(
      new Date().toISOString().split("T")[0]
  );
  const [periodeDebut, setPeriodeDebut] = useState(
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`
  );
  const [periodeFin, setPeriodeFin] = useState(
      new Date().toISOString().split("T")[0]
  );

  const printRef = useRef<HTMLDivElement>(null);

  const fetchRegions = useCallback(async () => {
    setLoading(true);
    try {
      const [regionsData, provincesData] = await Promise.all([
        regionsApi.getAll(),
        provincesApi.getAll(),
      ]);
      setRegions(regionsData);

      // Pre-fill filters based on user role
      if (user?.role === "PROV" && user.provinceId) {
        const prov = provincesData.find((p) => p.id === user.provinceId);
        if (prov) {
          setSelectedRegion(String(prov.regionId));
          setSelectedProvince(String(user.provinceId));
          // Load provinces for the region
          const regionProvinces = provincesData.filter((p) => p.regionId === prov.regionId);
          setProvinces(regionProvinces);
        }
      } else if (user?.role === "REGION" && user.regionId) {
        setSelectedRegion(String(user.regionId));
        const regionProvinces = provincesData.filter((p) => p.regionId === user.regionId);
        setProvinces(regionProvinces);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  // Fetch provinces when region changes (only if not pre-filled by role)
  useEffect(() => {
    if (selectedRegion && user?.role === "ADMIN") {
      provincesApi.getByRegion(Number(selectedRegion)).then(setProvinces).catch(() => setProvinces([]));
      setSelectedProvince("");
    }
  }, [selectedRegion, user?.role]);

  const handleLoadTotals = async () => {
    if (!selectedRegion) return;
    setLoadingTotals(true);
    try {
      // Fetch transactions and plafonds based on province or region
      let transactions: TransactionRegie[];
      let plafonds: PlafondRegie[];

      if (selectedProvince) {
        // Filter by province
        [transactions, plafonds] = await Promise.all([
          transactionsApi.getByProvince(Number(selectedProvince)),
          plafondsApi.getByProvince(Number(selectedProvince)),
        ]);
      } else {
        // Filter by region (all provinces)
        [transactions, plafonds] = await Promise.all([
          transactionsApi.getByRegion(Number(selectedRegion)),
          plafondsApi.getByRegion(Number(selectedRegion)),
        ]);
      }

      // Filter only CONFIRMEE transactions
      const confirmedTransactions = transactions.filter(
          (tx: TransactionRegie) => tx.statut === "CONFIRMEE"
      );

      // Build rubriques with totals from confirmed transactions
      const results: RubriqueTotal[] = plafonds.map((p: PlafondRegie) => {
        // Calculate total validated expenses for this rubrique
        const totalDepenses = confirmedTransactions
            .filter((tx: TransactionRegie) => tx.compteCode === p.compteCode)
            .reduce((sum: number, tx: TransactionRegie) => sum + (tx.montantValide || 0), 0);

        return {
          code: p.compteCode,
          libelle: p.libelle,
          plafondAnnuel: p.plafondAnnuel,
          encaissement: p.plafondEncaissement,
          maxFacture: p.plafondMaxFacture,
          totalDepensesValidees: totalDepenses,
        };
      });

      setRubriqueTotals(results);

      // Auto-select rubriques with validated expenses > 0
      const autoSelected = new Set<string>();
      for (const r of results) {
        if (r.totalDepensesValidees > 0) autoSelected.add(r.code);
      }
      setSelectedRubriques(autoSelected);
    } catch {
      // silently handle
    } finally {
      setLoadingTotals(false);
    }
  };

  const toggleRubrique = (code: string) => {
    setSelectedRubriques((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectedItems = rubriqueTotals.filter(
      (r) => selectedRubriques.has(r.code) && r.totalDepensesValidees > 0
  );
  const totalDebiter = selectedItems.reduce((s, r) => s + r.totalDepensesValidees, 0);

  const handlePrint = () => {
    setShowPrint(true);
    setTimeout(() => window.print(), 300);
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

  // Get month name in French
  const getMoisFR = (dateStr: string) => {
    const d = new Date(dateStr);
    return "Mois  " + d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  // Format amount with spaces for thousands
  const formatMontant = (value: number) => {
    return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Print View - Exact format from provided JSX template
  if (showPrint) {
    const regionName = regions.find((r) => String(r.id) === selectedRegion)?.name || "";

    return (
        <>
          <style>{`
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          @media print {
            body { background: white; padding: 0; margin: 0; }
            .print-btn-container { display: none !important; }
            .page { box-shadow: none; margin: 0; padding: 10mm; width: 100%; height: auto; min-height: auto; }
            nav, header, .dashboard-nav, [class*="navbar"], [class*="header"] { display: none !important; }
          }
        `}</style>

          <div className="print-btn-container mb-4 flex items-center gap-3">
            <Button
                variant="outline"
                onClick={() => setShowPrint(false)}
                className="border-[#0A1A44] text-[#0A1A44] hover:bg-[#0A1A44] hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            <Button
                onClick={() => window.print()}
                className="bg-gradient-to-r from-[#1A3A8A] to-[#0A1A44] text-white"
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer / PDF
            </Button>
          </div>

          <div
              ref={printRef}
              className="page mx-auto bg-white shadow-lg"
              style={{
                width: "297mm",
                minHeight: "210mm",
                padding: "15mm",
                fontFamily: '"Times New Roman", Times, serif',
              }}
          >
            {/* Outer Border */}
            <div style={{ border: "2px solid #000", width: "100%", height: "100%", padding: 0 }}>

              {/* Title Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", borderBottom: "2px solid #000" }}>
                <div style={{ textAlign: "center", padding: "6px 10px", fontSize: "22px", fontWeight: "bold", letterSpacing: "2px", borderRight: "2px solid #000" }}>
                  {"ORDRE D'IMPUTATION"}
                </div>
                <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", minWidth: "130px" }}>
                  <div style={{ display: "flex", alignItems: "center", padding: "4px 10px", fontSize: "13px", borderBottom: "1px solid #000", gap: "8px" }}>
                    <span>{"N°"}</span>
                    <span style={{ fontWeight: "bold", fontSize: "16px", marginLeft: "auto" }}>{oiNumero}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", padding: "4px 10px", fontSize: "13px", gap: "8px" }}>
                    <span>du</span>
                    <span style={{ marginLeft: "auto" }}>{formatDateFR(oiDate)}</span>
                  </div>
                </div>
              </div>

              {/* Journal Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", borderBottom: "1px solid #000" }}>
                <div style={{ padding: "5px 10px", fontSize: "12px", letterSpacing: "0.5px", borderRight: "2px solid #000" }}>
                  VEUILLEZ COMPTABILISER AU JOURNAL
                </div>
                <div style={{ minWidth: "130px", padding: "5px 10px", fontSize: "11px" }} />
              </div>

              {/* Nature Row */}
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", borderBottom: "1px solid #000", alignItems: "center" }}>
                <div style={{ padding: "5px 10px", fontSize: "12px", whiteSpace: "nowrap", borderRight: "1px solid #000", minWidth: "155px" }}>
                  {"Nature de l'operation :"}
                </div>
                <div style={{ padding: "5px 10px", fontSize: "13px", fontWeight: "bold", letterSpacing: "1px" }}>
                  {"REGIE " + regionName.toUpperCase()}
                </div>
              </div>

              {/* Suivant + Budget Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", borderBottom: "1px solid #000" }}>
                <div style={{ borderRight: "2px solid #000", padding: "8px 10px" }}>
                  <div style={{ fontSize: "12px", marginBottom: "4px" }}>Suivant pieces justificatives :</div>
                  <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "2px" }}>Voir pieces ci jointes</div>
                  <div style={{ fontSize: "12px", marginBottom: "12px" }}>{getMoisFR(periodeDebut)}</div>
                  <div style={{ fontSize: "14px", fontWeight: "bold", marginTop: "6px" }}>
                    {"Montant a alimenter : " + formatMontant(totalDebiter) + " dhs"}
                  </div>
                </div>
                <div style={{ padding: "6px 10px" }}>
                  <div style={{ textAlign: "center", fontSize: "12px", fontWeight: "bold", borderBottom: "1px solid #000", paddingBottom: "4px", marginBottom: "4px", letterSpacing: "0.5px" }}>
                    IMPUTATION BUDGETAIRE
                  </div>
                  {["Chapitre", "Article", "Paragraphe", "Credit disponible", "Visa :"].map((item) => (
                      <div key={item} style={{ fontSize: "11.5px", padding: "1.5px 0", display: "flex", justifyContent: "space-between" }}>
                        <span>{item}</span>
                        {item === "Visa :" && <span style={{ fontSize: "16px" }}>$</span>}
                      </div>
                  ))}
                </div>
              </div>

              {/* Accounts Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", borderTop: "1px solid #000" }}>
                <thead>
                <tr>
                  <th colSpan={2} style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "12px", textAlign: "center", fontWeight: "bold", width: "140px" }}>
                    {"N° Compte"}
                  </th>
                  <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "12px", textAlign: "center", fontWeight: "bold" }}>
                    INTITULE
                  </th>
                  <th colSpan={2} style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "12px", textAlign: "center", fontWeight: "bold", width: "220px" }}>
                    MONTANT
                  </th>
                </tr>
                <tr>
                  <th style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "11px", textAlign: "center", width: "70px" }}>
                    {"a Debiter"}
                  </th>
                  <th style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "11px", textAlign: "center", width: "70px" }}>
                    {"a Crediter"}
                  </th>
                  <th style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "11px", textAlign: "right", width: "110px" }}>
                    {"a Debiter"}
                  </th>
                  <th style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "11px", textAlign: "right", width: "110px" }}>
                    {"a Crediter"}
                  </th>
                </tr>
                </thead>
                <tbody>
                {selectedItems.map((item) => (
                    <tr key={item.code}>
                      <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "12px", textAlign: "center" }}>
                        {item.code}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "12px", textAlign: "center" }} />
                      <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "12px", textAlign: "left" }}>
                        {item.libelle}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "12px", textAlign: "right" }}>
                        {formatMontant(item.totalDepensesValidees)}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "12px", textAlign: "right" }} />
                    </tr>
                ))}
                {/* Regie credit row */}
                <tr>
                  <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "12px", textAlign: "center" }} />
                  <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "12px", textAlign: "center" }}>
                    5165-130
                  </td>
                  <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "12px", textAlign: "left" }}>
                    {"Regie " + regionName}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "12px", textAlign: "right" }} />
                  <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "12px", textAlign: "right" }}>
                    {formatMontant(totalDebiter)}
                  </td>
                </tr>
                {/* Empty filler rows */}
                {Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`empty-${i}`} style={{ height: "22px" }}>
                      <td style={{ border: "1px solid #000" }} />
                      <td style={{ border: "1px solid #000" }} />
                      <td style={{ border: "1px solid #000" }} />
                      <td style={{ border: "1px solid #000" }} />
                      <td style={{ border: "1px solid #000" }} />
                    </tr>
                ))}
                </tbody>
              </table>

              {/* Signature Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", borderTop: "2px solid #000" }}>
                <div style={{ borderRight: "1px solid #000", padding: "6px 8px", fontSize: "11px", textAlign: "center", minHeight: "70px" }}>
                  <div style={{ fontWeight: "bold", borderBottom: "1px solid #000", paddingBottom: "4px", marginBottom: "4px" }}>Chef de Service</div>
                </div>
                <div style={{ borderRight: "1px solid #000", padding: "6px 8px", fontSize: "11px", textAlign: "center", minHeight: "70px" }}>
                  <div style={{ fontWeight: "bold", borderBottom: "1px solid #000", paddingBottom: "4px", marginBottom: "4px" }}>Chef de division</div>
                </div>
                <div style={{ borderRight: "1px solid #000", padding: "6px 8px", fontSize: "11px", textAlign: "left", minHeight: "70px" }}>
                  <div style={{ fontSize: "11px" }}>Journal................................</div>
                  <div style={{ fontSize: "11px", marginTop: "4px" }}>{"N° Ecriture..........................."}</div>
                  <div style={{ fontSize: "11px", marginTop: "4px" }}>Date.........................................</div>
                </div>
                <div style={{ borderRight: "1px solid #000", padding: "6px 8px", fontSize: "11px", textAlign: "center", minHeight: "70px" }}>
                  <div style={{ fontWeight: "bold", borderBottom: "1px solid #000", paddingBottom: "4px", marginBottom: "4px" }}>Le Tresorier Payeur</div>
                </div>
                <div style={{ padding: "6px 8px", fontSize: "11px", textAlign: "center", minHeight: "70px" }}>
                  <div style={{ fontWeight: "bold", borderBottom: "1px solid #000", paddingBottom: "4px", marginBottom: "4px" }}>{"L'Ordonnateur"}</div>
                </div>
              </div>

            </div>
          </div>
        </>
    );
  }

  // Main Form View
  return (
      <div className="flex flex-col gap-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0A1A44]">
            {"Ordre d'Imputation Comptable"}
          </h1>
          <p className="mt-1 max-w-2xl text-base text-muted-foreground">
            {"Generez les ordres d'imputation pour la comptabilisation des depenses de regie selon les normes marocaines."}
          </p>
        </div>

        {/* Region Selection Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
          <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-[#0A1A44]/[0.02] to-transparent px-7 py-4">
            <MapPin className="h-4 w-4 text-[#1A3A8A]" />
            <h2 className="text-sm font-bold tracking-tight text-[#0A1A44]">
              Selection de la Region
            </h2>
          </div>
          <div className="p-7">
            <div className="flex flex-wrap items-end gap-6">
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Region Administrative
                </Label>
                <select
                    className="h-10 min-w-[250px] rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10 disabled:cursor-not-allowed disabled:opacity-60"
                    value={selectedRegion}
                    onChange={(e) => {
                      setSelectedRegion(e.target.value);
                      setRubriqueTotals([]);
                    }}
                    disabled={user?.role === "REGION" || user?.role === "PROV"}
                >
                  <option value="">-- Selectionner la Region --</option>
                  {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Province (optionnel)
                </Label>
                <select
                    className="h-10 min-w-[250px] rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10 disabled:cursor-not-allowed disabled:opacity-60"
                    value={selectedProvince}
                    onChange={(e) => {
                      setSelectedProvince(e.target.value);
                      setRubriqueTotals([]);
                    }}
                    disabled={!selectedRegion || provinces.length === 0 || user?.role === "PROV"}
                >
                  <option value="">-- Toutes les Provinces --</option>
                  {provinces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                  ))}
                </select>
              </div>
              <Button
                  onClick={handleLoadTotals}
                  disabled={!selectedRegion || loadingTotals}
                  className="bg-gradient-to-r from-[#1A3A8A] to-[#0A1A44] text-white shadow-md hover:shadow-lg"
              >
                {loadingTotals ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <FileText className="mr-2 h-4 w-4" />
                )}
                Charger les Totaux par Rubrique
              </Button>
            </div>
          </div>
        </div>

        {/* Rubriques Selection Table */}
        {rubriqueTotals.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
              <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-[#0A1A44]/[0.02] to-transparent px-7 py-4">
                <CheckSquare className="h-4 w-4 text-[#1A3A8A]" />
                <h2 className="text-sm font-bold tracking-tight text-[#0A1A44]">
                  {"Selection des Rubriques pour l'Ordre d'Imputation"}
                  {selectedRegion && (
                      <span className="ml-1 text-muted-foreground">
                  :{" "}
                        {
                          regions.find((r) => String(r.id) === selectedRegion)
                              ?.name
                        }
                </span>
                  )}
                </h2>
              </div>
              <div className="p-7">
                {/* Order form fields */}
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      {"N d'Ordre d'Imputation"}
                    </Label>
                    <Input
                        value={oiNumero}
                        onChange={(e) => setOiNumero(e.target.value)}
                        placeholder="Ex: OI-2026-001"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      {"Date de l'Ordre"}
                    </Label>
                    <Input
                        type="date"
                        value={oiDate}
                        onChange={(e) => setOiDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Periode du
                    </Label>
                    <Input
                        type="date"
                        value={periodeDebut}
                        onChange={(e) => setPeriodeDebut(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Periode au
                    </Label>
                    <Input
                        type="date"
                        value={periodeFin}
                        onChange={(e) => setPeriodeFin(e.target.value)}
                    />
                  </div>
                </div>

                {/* Rubriques table */}
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
                    <thead>
                    <tr className="bg-gradient-to-r from-[#0A1A44] to-[#1A3A8A]">
                      <th className="h-12 w-[50px] border-r border-white/10 px-4 text-center text-[11.5px] font-semibold uppercase tracking-widest text-white">
                        Selection
                      </th>
                      <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white" style={{ width: "100px" }}>
                        Code
                      </th>
                      <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white" style={{ minWidth: "200px" }}>
                        Rubrique
                      </th>
                      <th className="h-12 border-r border-white/10 px-4 text-right text-[11.5px] font-semibold uppercase tracking-widest text-white" style={{ width: "120px" }}>
                        Plafond Annuel
                      </th>
                      <th className="h-12 border-r border-white/10 px-4 text-right text-[11.5px] font-semibold uppercase tracking-widest text-white" style={{ width: "120px" }}>
                        Encaissement
                      </th>
                      <th className="h-12 border-r border-white/10 px-4 text-right text-[11.5px] font-semibold uppercase tracking-widest text-white" style={{ width: "120px" }}>
                        Max Facture
                      </th>
                      <th className="h-12 px-4 text-right text-[11.5px] font-semibold uppercase tracking-widest text-white" style={{ width: "150px" }}>
                        Depenses Validees
                      </th>
                    </tr>
                    </thead>
                    <tbody>
                    {rubriqueTotals.map((r, i) => {
                      const isSelected = selectedRubriques.has(r.code);
                      return (
                          <tr
                              key={`${r.code}-${i}`}
                              className={`border-b border-border/60 transition-colors ${
                                  isSelected
                                      ? "bg-[#3B82F6]/[0.08]"
                                      : i % 2 === 0
                                          ? "bg-card"
                                          : "bg-secondary/20"
                              }`}
                          >
                            <td className="h-14 px-4 text-center">
                              <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleRubrique(r.code)}
                                  disabled={r.totalDepensesValidees <= 0}
                                  className="h-4 w-4 cursor-pointer accent-[#1A3A8A]"
                              />
                            </td>
                            <td
                                className={`h-14 px-4 font-mono font-semibold ${isSelected ? "text-[#1A3A8A]" : "text-foreground"}`}
                            >
                              {r.code}
                            </td>
                            <td
                                className={`h-14 px-4 ${isSelected ? "font-semibold text-[#1A3A8A]" : "text-foreground"}`}
                            >
                              {r.libelle}
                            </td>
                            <td className="h-14 px-4 text-right text-muted-foreground">
                              {formatCurrencyDH(r.plafondAnnuel)}
                            </td>
                            <td className="h-14 px-4 text-right text-muted-foreground">
                              {formatCurrencyDH(r.encaissement)}
                            </td>
                            <td className="h-14 px-4 text-right text-muted-foreground">
                              {formatCurrencyDH(r.maxFacture)}
                            </td>
                            <td
                                className="h-14 px-4 text-right font-semibold"
                                style={{
                                  color: r.totalDepensesValidees > 0 ? "#059669" : "#ccc",
                                }}
                            >
                              {formatCurrencyDH(r.totalDepensesValidees)}
                            </td>
                          </tr>
                      );
                    })}
                    {/* Total row - sum of all validated expenses */}
                    <tr className="bg-secondary/50 font-semibold">
                      <td colSpan={6} className="h-14 px-4 text-right text-sm font-bold text-[#0A1A44]">
                        TOTAL DEPENSES VALIDEES :
                      </td>
                      <td className="h-14 px-4 text-right text-sm font-bold text-[#059669]">
                        {formatCurrencyDH(
                            rubriqueTotals.reduce((sum, rubrique) => sum + rubrique.totalDepensesValidees, 0)
                        )}
                      </td>
                    </tr>
                    </tbody>
                  </table>
                </div>

                {/* Generate button */}
                <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
                  {selectedItems.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                  <span className="font-semibold text-[#059669]">
                    {selectedItems.length} rubrique(s)
                  </span>{" "}
                        selectionnee(s) - Total:{" "}
                        <span className="font-bold text-[#0A1A44]">
                    {formatCurrencyDH(totalDebiter)}
                  </span>
                      </div>
                  )}
                  <Button
                      onClick={handlePrint}
                      disabled={selectedItems.length === 0}
                      className="ml-auto bg-gradient-to-r from-[#059669] to-[#047857] text-white shadow-md hover:shadow-lg"
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    {"Generer l'Ordre d'Imputation"}
                  </Button>
                </div>
              </div>
            </div>
        )}

        {/* Floating selected total */}
        {selectedItems.length > 0 && (
            <div className="fixed bottom-5 left-5 z-50 min-w-[250px] rounded-xl bg-gradient-to-r from-[#059669] to-[#047857] p-4 text-white shadow-lg print:hidden">
              <div className="text-[12px] font-medium uppercase tracking-widest opacity-90">
                Total des rubriques selectionnees
              </div>
              <div className="mt-1 text-2xl font-bold tracking-tight">
                {formatCurrencyDH(totalDebiter)}
              </div>
              <div className="mt-1 text-[11px] opacity-80">
                {selectedItems.length} rubrique(s) selectionnee(s)
              </div>
            </div>
        )}
      </div>
  );
}
