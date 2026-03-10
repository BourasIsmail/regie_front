"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { regionsApi, transactionsApi, plafondsApi } from "@/lib/api";
import type { Region, PlafondRegie, TransactionRegie } from "@/lib/types";
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
  const [selectedRegion, setSelectedRegion] = useState("");
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
      const data = await regionsApi.getAll();
      setRegions(data);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  const handleLoadTotals = async () => {
    if (!selectedRegion) return;
    setLoadingTotals(true);
    try {
      const [transactions, plafonds] = await Promise.all([
        transactionsApi.getByRegion(Number(selectedRegion)),
        plafondsApi.getByRegion(Number(selectedRegion)),
      ]);

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

  // Print View
  if (showPrint) {
    return (
        <div>
          <div className="mb-4 flex items-center gap-3 print:hidden">
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
              className="mx-auto max-w-[297mm] bg-card p-8 font-sans text-foreground print:max-w-none print:p-5"
          >
            {/* Print Header */}
            <div className="mb-6 text-center">
              <h1 className="text-xl font-bold tracking-widest underline">
                {"ORDRE D'IMPUTATION"}
              </h1>
              <p className="mt-1 text-sm font-bold">
                VEUILLEZ COMPTABILISER AU JOURNAL
              </p>
            </div>

            {/* Top Info */}
            <div className="mb-5 flex justify-between text-[13px]">
              <div className="w-3/5">
                <div className="mb-2">
                  <span className="font-bold">{"Nature de l'operation:"}</span>{" "}
                  <span className="inline-block min-w-[200px] border-b border-dotted border-foreground pb-px">
                  REGIE{" "}
                    {regions.find((r) => String(r.id) === selectedRegion)?.name}
                </span>
                </div>
                <div className="mb-2">
                <span className="font-bold">
                  Suivant pieces justificatives:
                </span>{" "}
                  <span className="inline-block min-w-[200px] border-b border-dotted border-foreground pb-px">
                  Voir pieces ci jointes
                </span>
                </div>
                <div>
                  <span className="font-bold">Periode du:</span>{" "}
                  <span className="inline-block min-w-[80px] border-b border-dotted border-foreground pb-px">
                  {formatDateFR(periodeDebut)}
                </span>{" "}
                  <span className="font-bold">au:</span>{" "}
                  <span className="inline-block min-w-[80px] border-b border-dotted border-foreground pb-px">
                  {formatDateFR(periodeFin)}
                </span>
                </div>
              </div>
              <div className="w-[35%] text-right">
                <div className="mb-2">
                  <span className="font-bold">{"N:"}</span>{" "}
                  <span className="inline-block min-w-[100px] border-b border-dotted border-foreground pb-px">
                  {oiNumero}
                </span>
                </div>
                <div>
                  <span className="font-bold">du:</span>{" "}
                  <span className="inline-block min-w-[100px] border-b border-dotted border-foreground pb-px">
                  {formatDateFR(oiDate)}
                </span>
                </div>
              </div>
            </div>

            {/* Main Table */}
            <table className="mb-4 w-full border-collapse text-xs">
              <thead>
              <tr>
                <th
                    colSpan={2}
                    className="border border-foreground bg-secondary/50 px-2 py-1.5 text-center font-bold"
                >
                  COMPTE
                </th>
                <th
                    rowSpan={2}
                    className="border border-foreground bg-secondary/50 px-2 py-1.5 text-center font-bold"
                    style={{ width: "46%" }}
                >
                  {"INTITULE"}
                </th>
                <th
                    colSpan={2}
                    className="border border-foreground bg-secondary/50 px-2 py-1.5 text-center font-bold"
                >
                  MONTANT
                </th>
              </tr>
              <tr>
                <th
                    className="border border-foreground bg-secondary/50 px-2 py-1.5 text-center font-bold"
                    style={{ width: "12%" }}
                >
                  {"a Debiter"}
                </th>
                <th
                    className="border border-foreground bg-secondary/50 px-2 py-1.5 text-center font-bold"
                    style={{ width: "12%" }}
                >
                  {"a Crediter"}
                </th>
                <th
                    className="border border-foreground bg-secondary/50 px-2 py-1.5 text-center font-bold"
                    style={{ width: "15%" }}
                >
                  {"a Debiter"}
                </th>
                <th
                    className="border border-foreground bg-secondary/50 px-2 py-1.5 text-center font-bold"
                    style={{ width: "15%" }}
                >
                  {"a Crediter"}
                </th>
              </tr>
              </thead>
              <tbody>
              {selectedItems.map((item) => (
                  <tr key={item.code}>
                    <td className="border border-foreground px-2 py-1.5 text-center font-mono">
                      {item.code}
                    </td>
                    <td className="border border-foreground px-2 py-1.5" />
                    <td className="border border-foreground px-3 py-1.5 text-left">
                      {item.libelle}
                    </td>
                    <td className="border border-foreground px-2 py-1.5 text-center">
                      {formatCurrencyDH(item.totalDepensesValidees)}
                    </td>
                    <td className="border border-foreground px-2 py-1.5" />
                  </tr>
              ))}
              {/* Regie credit row */}
              <tr>
                <td className="border border-foreground px-2 py-1.5" />
                <td className="border border-foreground px-2 py-1.5 text-center font-mono">
                  5165-130
                </td>
                <td className="border border-foreground px-3 py-1.5 text-left">
                  Regie
                </td>
                <td className="border border-foreground px-2 py-1.5" />
                <td className="border border-foreground px-2 py-1.5 text-center">
                  {formatCurrencyDH(totalDebiter)}
                </td>
              </tr>
              {/* Total row */}
              <tr className="bg-secondary/40 font-bold">
                <td
                    colSpan={3}
                    className="border border-foreground px-2 py-2 text-right"
                >
                  {"TOTAL GENERAL"}
                </td>
                <td className="border border-foreground px-2 py-2 text-center">
                  {formatCurrencyDH(totalDebiter)}
                </td>
                <td className="border border-foreground px-2 py-2 text-center">
                  {formatCurrencyDH(totalDebiter)}
                </td>
              </tr>
              </tbody>
            </table>

            {/* Budget Box */}
            <div className="mb-5 border border-foreground p-3 text-[13px]">
            <span className="mb-2 block font-bold underline">
              {"IMPUTATION BUDGETAIRE"}
            </span>
              <div className="flex gap-8">
                <div>
                  <span className="font-bold">Chapitre:</span>{" "}
                  <span className="inline-block min-w-[80px] border-b border-dotted border-foreground" />
                </div>
                <div>
                  <span className="font-bold">Article:</span>{" "}
                  <span className="inline-block min-w-[80px] border-b border-dotted border-foreground" />
                </div>
                <div>
                  <span className="font-bold">Paragraphe:</span>{" "}
                  <span className="inline-block min-w-[80px] border-b border-dotted border-foreground" />
                </div>
              </div>
              <div className="mt-4 flex gap-12">
                <div>
                  <span className="font-bold">Credit disponible:</span>{" "}
                  <span className="inline-block min-w-[150px] border-b border-dotted border-foreground" />
                </div>
                <div>
                  <span className="font-bold">Visa:</span>{" "}
                  <span className="inline-block min-w-[150px] border-b border-dotted border-foreground" />
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-5 border-l border-t border-foreground">
              {[
                "Chef de Service",
                "Chef de division",
                "Journal / N Ecriture\nDate",
                "Le Tresorier Payeur",
                "L'Ordonnateur",
              ].map((label) => (
                  <div
                      key={label}
                      className="flex h-24 flex-col justify-between border-b border-r border-foreground p-2 text-center text-[11px] font-bold"
                  >
                    <span className="whitespace-pre-line">{label}</span>
                    <span />
                  </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-5 text-center text-[10px] text-muted-foreground">
              Document genere le{" "}
              {new Date().toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              par {user?.email}
            </div>
          </div>
        </div>
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
                    className="h-10 min-w-[250px] rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10"
                    value={selectedRegion}
                    onChange={(e) => {
                      setSelectedRegion(e.target.value);
                      setRubriqueTotals([]);
                    }}
                >
                  <option value="">-- Selectionner la Region --</option>
                  {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
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
                              key={r.code}
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
