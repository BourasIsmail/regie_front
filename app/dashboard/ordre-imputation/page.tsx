"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
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
  depensesOriginales?: number; // Original expenses before limiting by available
  transactions: TransactionRegie[]; // List of transactions for this rubrique
}

// Region name for "Siege Central"
const SIEGE_CENTRAL_NAME = "Siege central";

// City codes mapping (province name -> code ville)
const CITY_CODES: Record<string, string> = {
  "AGADIR": "5165-65", "AGADIR-IDA-OU-TANANE": "5165-65",
  "AL HOCEIMA": "5165-66",
  "AOUSERD": "5165-176", "AOUSSERD": "5165-176",
  "ASSA ZAG": "5165-123", "ASSA-ZAG": "5165-123",
  "AZILAL": "5165-67",
  "BENI MELLAL": "5165-68",
  "BEN SLIMANE": "5165-69", "BENSLIMANE": "5165-69",
  "BERCHID": "5165-181", "BERRECHID": "5165-181",
  "BERKANE": "5165-154",
  "BOUJDOUR": "5165-70",
  "BOULEMANE": "5165-71",
  "CASA AIN CHOK": "5165-72", "AIN CHOCK": "5165-72",
  "CASA AIN SBEA": "5165-73", "AIN SEBAA": "5165-73",
  "CASA ANFA": "5165-74", "ANFA": "5165-74",
  "CASA BEN M'SIK": "5165-75", "BEN M'SIK": "5165-75",
  "CASA EL FIDA": "5165-163", "EL FIDA": "5165-163",
  "CASA HAY HASSANI": "5165-164", "HAY HASSANI": "5165-164",
  "CASA MEDIOUNA": "5165-157", "MEDIOUNA": "5165-157",
  "CASA MOULAY RCHID": "5165-161", "MOULAY RACHID": "5165-161",
  "CASA NOUACER": "5165-165", "NOUACEUR": "5165-165",
  "CASA SIDI BERNOUSSI": "5165-158", "SIDI BERNOUSSI": "5165-158",
  "CHEFCHAOUEN": "5165-76",
  "CHICHAOUA": "5165-77",
  "CHTOUKA AIT BAHA": "5165-143", "CHTOUKA-AIT BAHA": "5165-143",
  "DAKHLA": "5165-98", "OUED ED-DAHAB": "5165-98",
  "DRIOUICH": "5165-173", "DRIOUCH": "5165-173",
  "EL HAJEB": "5165-138",
  "EL JADIDA": "5165-78",
  "EL KELAA": "5165-79", "EL KELAA DES SRAGHNA": "5165-79", "KELAAT SRAGHNA": "5165-79",
  "ERRACHIDIA": "5165-80",
  "ESSAOUIRA": "5165-81",
  "FES": "5165-64",
  "FIGUIG": "5165-82",
  "FKIH BEN SALEH": "5165-182", "FQUIH BEN SALAH": "5165-182",
  "FNIDEQ": "5165-155", "M'DIQ-FNIDEQ": "5165-155",
  "GUELMIM": "5165-83",
  "GUERSIF": "5165-180", "GUERCIF": "5165-180",
  "IFRANE": "5165-84",
  "INEZGANE AIT MELLOUL": "5165-141", "INEZGANE-AIT MELLOUL": "5165-141",
  "JERADA": "5165-131",
  "KENITRA": "5165-85",
  "KHEMISSET": "5165-63",
  "KHENIFRA": "5165-86",
  "KHOURIBGA": "5165-87",
  "LAAYOUNE": "5165-88",
  "LARACHE": "5165-89",
  "MARRAKECH": "5165-92",
  "EL HAOUZ": "5165-90",
  "MIDELT": "5165-172",
  "MEKNES": "5165-94",
  "MOHAMMADIA": "5165-95",
  "MY YAAKOUB": "5165-159", "MOULAY YACOUB": "5165-159",
  "NADOR": "5165-96",
  "OUARZAZATE": "5165-97",
  "OUAZZANE": "5165-178", "OUEZZANE": "5165-178",
  "OUJDA": "5165-61", "OUJDA-ANGAD": "5165-61",
  "RABAT": "5165-62",
  "RHAMNA": "5165-174", "REHAMNA": "5165-174",
  "SAFI": "5165-100",
  "SALE": "5165-101",
  "SEFROU": "5165-156",
  "SETTAT": "5165-102",
  "SIDI BENNOUR": "5165-177",
  "SIDI IFNI": "5165-179",
  "SIDI KACEM": "5165-103",
  "SIDI SLIMANE": "5165-183",
  "SMARA": "5165-104",
  "TAN TAN": "5165-105", "TAN-TAN": "5165-105",
  "TANGER ASILAH": "5165-106", "TANGER-ASSILAH": "5165-106",
  "FAHS ANJRA": "5165-126", "FAHS-ANJRA": "5165-126",
  "TAOUNATE": "5165-107",
  "TAOURIRT": "5165-132",
  "TARFAIA": "5165-184", "TARFAYA": "5165-184",
  "TAROUDANT": "5165-108", "TAROUDANNT": "5165-108",
  "TATA": "5165-109",
  "TAZA": "5165-110",
  "TEMARA": "5165-99", "SKHIRAT-TEMARA": "5165-99",
  "TETOUEN": "5165-111", "TETOUAN": "5165-111",
  "TINGHIR": "5165-175",
  "TIZNIT": "5165-112",
  "YOUSSOUFIA": "5165-186",
  "ZAGORA": "5165-142",
  "SIEGE CENTRAL": "5165-130", "SIEGE": "5165-130",
};

// Function to get city code from province name
function getCityCode(provinceName: string): string {
  const normalized = provinceName.toUpperCase().trim();
  // Try exact match first
  if (CITY_CODES[normalized]) return CITY_CODES[normalized];
  // Try partial match
  for (const [key, code] of Object.entries(CITY_CODES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return code;
    }
  }
  return "5165-130"; // Default fallback - Siege Central code
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
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(
      new Set()
  );
  const [expandedRubriques, setExpandedRubriques] = useState<Set<string>>(
      new Set()
  );
  const [showPrint, setShowPrint] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [oiNumero, setOiNumero] = useState("");
  const [oiDate, setOiDate] = useState(
      new Date().toISOString().split("T")[0]
  );
  // Period filter - date-based (like historique)
  const [periodeDebut, setPeriodeDebut] = useState(
      `${new Date().getFullYear()}-01-01`
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
      } else if ((user?.role === "REGION" || user?.role === "VIEW_REGION") && user.regionId) {
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
    if (selectedRegion && (user?.role === "ADMIN" || user?.role === "ADMIN_VIEW")) {
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

      // Filter only CONFIRMEE transactions within the selected period
      const confirmedTransactions = transactions.filter((tx: TransactionRegie) => {
        if (tx.statut !== "CONFIRMEE") return false;

        // Filter by period using date range (based on factureDate)
        const txDateStr = tx.factureDate;
        if (!txDateStr) return false; // Exclude transactions without factureDate

        const txDate = new Date(txDateStr);
        let startDate = new Date(periodeDebut);
        let endDate = new Date(periodeFin);

        // Swap dates if they are reversed (startDate > endDate)
        if (startDate > endDate) {
          const temp = startDate;
          startDate = endDate;
          endDate = temp;
        }

        // Set time to start/end of day for proper comparison
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        txDate.setHours(12, 0, 0, 0); // Set to midday to avoid timezone issues

        return txDate >= startDate && txDate <= endDate;
      });

      // Build rubriques with totals and transactions list
      // Group by compteCode to avoid duplicates when multiple provinces have same rubrique
      const rubriqueMap = new Map<string, RubriqueTotal>();

      for (const p of plafonds) {
        if (rubriqueMap.has(p.compteCode)) continue; // Skip if already processed

        // Get unique transactions for this compteCode (avoid duplicates by transaction id)
        const rubriqueTransactions = confirmedTransactions
            .filter((tx: TransactionRegie) => tx.compteCode === p.compteCode);

        // Deduplicate transactions by id
        const uniqueTransactions = rubriqueTransactions.filter(
            (tx: TransactionRegie, index: number, self: TransactionRegie[]) =>
                index === self.findIndex((t) => t.id === tx.id)
        );

        const totalDepenses = uniqueTransactions
            .reduce((sum: number, tx: TransactionRegie) => sum + (tx.montantValide || 0), 0);

        if (uniqueTransactions.length > 0) {
          rubriqueMap.set(p.compteCode, {
            code: p.compteCode,
            libelle: p.libelle,
            plafondAnnuel: p.plafondAnnuel,
            encaissement: p.plafondEncaissement,
            maxFacture: p.plafondMaxFacture,
            totalDepensesValidees: totalDepenses,
            transactions: uniqueTransactions,
          });
        }
      }

      const results: RubriqueTotal[] = Array.from(rubriqueMap.values());

      setRubriqueTotals(results);

      // Auto-select rubriques and their transactions with validated expenses > 0
      const autoSelectedRubriques = new Set<string>();
      const autoSelectedTransactions = new Set<number>();
      for (const r of results) {
        if (r.totalDepensesValidees > 0) {
          autoSelectedRubriques.add(r.code);
          r.transactions.forEach(tx => autoSelectedTransactions.add(tx.id));
        }
      }
      setSelectedRubriques(autoSelectedRubriques);
      setSelectedTransactions(autoSelectedTransactions);
    } catch {
      // silently handle
    } finally {
      setLoadingTotals(false);
    }
  };

  const toggleRubrique = (code: string) => {
    const rubrique = rubriqueTotals.find(r => r.code === code);
    setSelectedRubriques((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
        // Deselect all transactions of this rubrique
        if (rubrique) {
          setSelectedTransactions(prevTx => {
            const nextTx = new Set(prevTx);
            rubrique.transactions.forEach(tx => nextTx.delete(tx.id));
            return nextTx;
          });
        }
      } else {
        next.add(code);
        // Select all transactions of this rubrique
        if (rubrique) {
          setSelectedTransactions(prevTx => {
            const nextTx = new Set(prevTx);
            rubrique.transactions.forEach(tx => nextTx.add(tx.id));
            return nextTx;
          });
        }
      }
      return next;
    });
  };

  const toggleTransaction = (txId: number, rubriqueCode: string) => {
    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
    // If at least one transaction is selected, select the rubrique
    const rubrique = rubriqueTotals.find(r => r.code === rubriqueCode);
    if (rubrique) {
      const hasSelectedTx = rubrique.transactions.some(tx =>
          tx.id === txId ? !selectedTransactions.has(txId) : selectedTransactions.has(tx.id)
      );
      if (hasSelectedTx) {
        setSelectedRubriques(prev => new Set(prev).add(rubriqueCode));
      }
    }
  };

  const toggleExpandRubrique = (code: string) => {
    setExpandedRubriques((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // Calculate selected items based on selected transactions
  const selectedItems = rubriqueTotals
      .filter((r) => selectedRubriques.has(r.code))
      .map((r) => {
        const depensesSelectionnees = r.transactions
            .filter(tx => selectedTransactions.has(tx.id))
            .reduce((sum, tx) => sum + (tx.montantValide || 0), 0);
        return {
          ...r,
          transactions: r.transactions.filter(tx => selectedTransactions.has(tx.id)),
          totalDepensesValidees: depensesSelectionnees, // Total reel des depenses selectionnees
        };
      })
      .filter((r) => r.totalDepensesValidees > 0);

  // Total a debiter = somme des depenses reelles selectionnees
  const totalDebiter = selectedItems.reduce((s, r) => s + r.totalDepensesValidees, 0);

  // Montant a alimenter = somme de min(plafondAnnuel, totalDepensesValidees) pour chaque rubrique
  // Si la rubrique n'a pas assez de disponible, on ne prend que le montant disponible
  const montantAAlimenter = selectedItems.reduce((s, r) => s + Math.min(r.plafondAnnuel, r.totalDepensesValidees), 0);

  const handlePrint = () => {
    if (!oiNumero.trim()) {
      setError("Veuillez saisir le numéro d'ordre d'imputation avant de générer.");
      return;
    }
    setError("");
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
    const provinceName = provinces.find((p) => String(p.id) === selectedProvince)?.name || "";
    // If no province found and region is "Siege central", use "SIEGE CENTRAL" as the city name
    const cityName = provinceName || (regionName.toLowerCase().includes("siege") ? "SIEGE CENTRAL" : "");
    const cityCode = getCityCode(cityName);

    return (
        <>
          <style>{`
          @page {
            size: A4 landscape;
            margin: 0;
          }
          @media print {
            * {
              margin: 0 !important;
              padding: 0 !important;
              box-sizing: border-box !important;
            }
            html, body { 
              background: white !important; 
              width: 297mm !important;
              height: 210mm !important;
              overflow: hidden !important;
            }
            .print-btn-container { display: none !important; }
            .page { 
              box-shadow: none !important; 
              margin: 0 !important; 
              padding: 5mm !important; 
              width: 297mm !important; 
              height: 210mm !important; 
              min-height: unset !important;
              max-height: 210mm !important;
              page-break-after: avoid !important;
              page-break-inside: avoid !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
            }
            nav, header, footer, .dashboard-nav, [class*="navbar"], [class*="header"], [class*="topbar"] { 
              display: none !important; 
              height: 0 !important;
              width: 0 !important;
              overflow: hidden !important;
            }
          }
          @media print {
            html {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
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
                width: "287mm",
                height: "200mm",
                padding: "8mm",
                fontFamily: '"Times New Roman", Times, serif',
                overflow: "hidden",
              }}
          >
            {/* Outer Border */}
            <div style={{ border: "2px solid #000", width: "100%", height: "100%", padding: 0, display: "flex", flexDirection: "column" }}>

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

              {/* Period Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", borderBottom: "1px solid #000", padding: "6px 10px" }}>
                <div style={{ fontSize: "12px" }}>
                  <span style={{ fontWeight: "bold" }}>Periode :</span>
                  <span style={{ marginLeft: "8px" }}>{formatDateFR(periodeDebut)} au {formatDateFR(periodeFin)}</span>
                </div>
              </div>

              {/* Nature Row */}
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", borderBottom: "1px solid #000", alignItems: "center" }}>
                <div style={{ padding: "5px 10px", fontSize: "12px", whiteSpace: "nowrap", borderRight: "1px solid #000", minWidth: "155px" }}>
                  {"Nature de l'operation :"}
                </div>
                <div style={{ padding: "5px 10px", fontSize: "13px", fontWeight: "bold", letterSpacing: "1px" }}>
                  {"REGIE " + (cityName || provinceName).toUpperCase()}
                </div>
              </div>

              {/* Suivant + Budget Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", borderBottom: "1px solid #000" }}>
                <div style={{ borderRight: "2px solid #000", padding: "8px 10px" }}>
                  <div style={{ fontSize: "12px", marginBottom: "4px" }}>Suivant pieces justificatives :</div>
                  <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "12px" }}>Voir pieces ci jointes</div>
                  <div style={{ fontSize: "14px", fontWeight: "bold", marginTop: "6px" }}>
                    {"Montant a alimenter : " + formatMontant(montantAAlimenter) + " dhs"}
                  </div>
                </div>
                <div style={{ padding: "6px 10px" }}>
                  <div style={{ textAlign: "center", fontSize: "12px", fontWeight: "bold", borderBottom: "1px solid #000", paddingBottom: "4px", marginBottom: "4px", letterSpacing: "0.5px" }}>
                    IMPUTATION BUDGETAIRE
                  </div>
                  {["Chapitre", "Article", "Paragraphe", "Credit disponible", "Visa :"].map((item) => (
                      <div key={item} style={{ fontSize: "11.5px", padding: "1.5px 0", display: "flex", justifyContent: "space-between" }}>
                        <span>{item}</span>
                      </div>
                  ))}
                </div>
              </div>

              {/* Accounts Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", borderTop: "1px solid #000", flex: 1 }}>
                <thead>
                <tr>
                  <th colSpan={2} style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "15px", textAlign: "center", fontWeight: "bold", width: "200px" }}>
                    {"N° Compte"}
                  </th>
                  <th rowSpan={2} style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "15px", textAlign: "center", fontWeight: "bold" }}>
                    INTITULE
                  </th>
                  <th colSpan={2} style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "15px", textAlign: "center", fontWeight: "bold", width: "300px" }}>
                    MONTANT
                  </th>
                </tr>
                <tr>
                  <th style={{ border: "1px solid #000", padding: "8px 12px", fontSize: "14px", textAlign: "center", width: "100px" }}>
                    {"a Debiter"}
                  </th>
                  <th style={{ border: "1px solid #000", padding: "8px 12px", fontSize: "14px", textAlign: "center", width: "100px" }}>
                    {"a Crediter"}
                  </th>
                  <th style={{ border: "1px solid #000", padding: "8px 12px", fontSize: "14px", textAlign: "right", width: "150px" }}>
                    {"a Debiter"}
                  </th>
                  <th style={{ border: "1px solid #000", padding: "8px 12px", fontSize: "14px", textAlign: "right", width: "150px" }}>
                    {"a Crediter"}
                  </th>
                </tr>
                </thead>
                <tbody>
                {selectedItems.map((item, idx) => (
                    <tr key={`${item.code}-${idx}`}>
                      <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", textAlign: "center" }}>
                        {item.code}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", textAlign: "center" }} />
                      <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", textAlign: "left" }}>
                        {item.libelle}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", textAlign: "right" }}>
                        {formatMontant(item.totalDepensesValidees)}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", textAlign: "right" }} />
                    </tr>
                ))}
                {/* Regie credit row */}
                <tr>
                  <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", textAlign: "center" }} />
                  <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", textAlign: "center" }}>
                    {cityCode}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", textAlign: "left" }}>
                    {"Regie " + (cityName || provinceName)}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", textAlign: "right" }} />
                  <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", textAlign: "right" }}>
                    {formatMontant(totalDebiter)}
                  </td>
                </tr>
                {/* Totals row */}
                <tr style={{ backgroundColor: "#e8e8e8", fontWeight: "bold" }}>
                  <td colSpan={3} style={{ border: "2px solid #000", padding: "10px 12px", fontSize: "15px", textAlign: "center", fontWeight: "bold" }}>
                    TOTAUX
                  </td>
                  <td style={{ border: "2px solid #000", padding: "10px 12px", fontSize: "15px", textAlign: "right", fontWeight: "bold" }}>
                    {formatMontant(totalDebiter)}
                  </td>
                  <td style={{ border: "2px solid #000", padding: "10px 12px", fontSize: "15px", textAlign: "right", fontWeight: "bold" }}>
                    {formatMontant(totalDebiter)}
                  </td>
                </tr>
                </tbody>
              </table>

              {/* Signature Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", borderTop: "2px solid #000" }}>
                <div style={{ borderRight: "1px solid #000", padding: "8px", fontSize: "11px", textAlign: "center", minHeight: "180px" }}>
                  <div style={{ fontWeight: "bold" }}>Chef de Service</div>
                </div>
                <div style={{ borderRight: "1px solid #000", padding: "8px", fontSize: "11px", textAlign: "center", minHeight: "180px" }}>
                  <div style={{ fontWeight: "bold" }}>Chef de division</div>
                </div>
                <div style={{ borderRight: "1px solid #000", padding: "8px", fontSize: "11px", textAlign: "center", minHeight: "180px" }}>
                  <div style={{ fontWeight: "bold" }}>Service Comptable</div>
                </div>
                <div style={{ borderRight: "1px solid #000", padding: "8px", fontSize: "11px", textAlign: "center", minHeight: "180px" }}>
                  <div style={{ fontWeight: "bold" }}>Le Tresorier Payeur</div>
                </div>
                <div style={{ padding: "8px", fontSize: "11px", textAlign: "center", minHeight: "180px" }}>
                  <div style={{ fontWeight: "bold" }}>
                    {(cityName || provinceName).toLowerCase().includes("siege") || (cityName || provinceName).toLowerCase().includes("siège") ? "L'Ordonnateur" : "Le Sous-Ordonnateur"}
                  </div>
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
                    disabled={user?.role === "REGION" || user?.role === "PROV" || user?.role === "VIEW_REGION"}
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
                  Province / Ville <span className="text-red-500">*</span>
                </Label>
                <select
                    className="h-10 min-w-[250px] rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10 disabled:cursor-not-allowed disabled:opacity-60"
                    value={selectedProvince}
                    onChange={(e) => {
                      setSelectedProvince(e.target.value);
                      setRubriqueTotals([]);
                    }}
                    disabled={!selectedRegion || provinces.length === 0 || user?.role === "PROV"}
                    required
                >
                  <option value="">-- Selectionner la Province --</option>
                  {provinces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Periode du
                </Label>
                <Input
                    type="date"
                    value={periodeDebut}
                    onChange={(e) => setPeriodeDebut(e.target.value)}
                    className="h-10 min-w-[150px]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Au
                </Label>
                <Input
                    type="date"
                    value={periodeFin}
                    onChange={(e) => setPeriodeFin(e.target.value)}
                    className="h-10 min-w-[150px]"
                />
              </div>
              <div className="flex items-end">
                <Button
                    onClick={handleLoadTotals}
                    disabled={!selectedRegion || !selectedProvince || loadingTotals}
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
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      {"N° d'Ordre d'Imputation"}
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
                </div>

                {/* Rubriques table with expandable transactions */}
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
                    <thead>
                    <tr className="bg-gradient-to-r from-[#0A1A44] to-[#1A3A8A]">
                      <th className="h-12 w-[50px] border-r border-white/10 px-4 text-center text-[11.5px] font-semibold uppercase tracking-widest text-white">
                        Sel.
                      </th>
                      <th className="h-12 w-[50px] border-r border-white/10 px-4 text-center text-[11.5px] font-semibold uppercase tracking-widest text-white">
                        Details
                      </th>
                      <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white" style={{ width: "100px" }}>
                        Code
                      </th>
                      <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white" style={{ minWidth: "200px" }}>
                        Rubrique
                      </th>
                      <th className="h-12 border-r border-white/10 px-4 text-right text-[11.5px] font-semibold uppercase tracking-widest text-white" style={{ width: "100px" }}>
                        Nb Depenses
                      </th>
                      <th className="h-12 px-4 text-right text-[11.5px] font-semibold uppercase tracking-widest text-white" style={{ width: "150px" }}>
                        Total Selectionne
                      </th>
                    </tr>
                    </thead>
                    <tbody>
                    {rubriqueTotals.map((r, i) => {
                      const isSelected = selectedRubriques.has(r.code);
                      const isExpanded = expandedRubriques.has(r.code);
                      const selectedTxCount = r.transactions.filter(tx => selectedTransactions.has(tx.id)).length;
                      const selectedTotal = r.transactions
                          .filter(tx => selectedTransactions.has(tx.id))
                          .reduce((sum, tx) => sum + (tx.montantValide || 0), 0);

                      return (
                          <React.Fragment key={`${r.code}-${i}`}>
                            <tr
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
                                    disabled={r.transactions.length === 0}
                                    className="h-4 w-4 cursor-pointer accent-[#1A3A8A]"
                                />
                              </td>
                              <td className="h-14 px-4 text-center">
                                {r.transactions.length > 0 && (
                                    <button
                                        onClick={() => toggleExpandRubrique(r.code)}
                                        className="rounded p-1 hover:bg-muted"
                                    >
                                      {isExpanded ? "▼" : "▶"}
                                    </button>
                                )}
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
                                {selectedTxCount} / {r.transactions.length}
                              </td>
                              <td
                                  className="h-14 px-4 text-right font-semibold"
                                  style={{
                                    color: selectedTotal > 0 ? "#059669" : "#ccc",
                                  }}
                              >
                                {formatCurrencyDH(selectedTotal)}
                              </td>
                            </tr>
                            {/* Expanded transactions */}
                            {isExpanded && r.transactions.map((tx) => (
                                <tr key={tx.id} className="bg-muted/30 border-b border-border/30">
                                  <td className="h-10 px-4 text-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedTransactions.has(tx.id)}
                                        onChange={() => toggleTransaction(tx.id, r.code)}
                                        className="h-3.5 w-3.5 cursor-pointer accent-[#1A3A8A]"
                                    />
                                  </td>
                                  <td className="h-10 px-4" />
                                  <td colSpan={2} className="h-10 px-4 text-xs text-muted-foreground">
                                    <span className="font-medium">{tx.fournisseur || "N/A"}</span>
                                    {tx.factureNumero && <span className="ml-2">- Fact. {tx.factureNumero}</span>}
                                    {tx.factureDate && <span className="ml-2">du {formatDateFR(tx.factureDate)}</span>}
                                  </td>
                                  <td className="h-10 px-4 text-right text-xs text-muted-foreground">
                                    {tx.provinceName}
                                  </td>
                                  <td className="h-10 px-4 text-right text-xs font-medium text-[#059669]">
                                    {formatCurrencyDH(tx.montantValide || 0)}
                                  </td>
                                </tr>
                            ))}
                          </React.Fragment>
                      );
                    })}
                    {/* Total row */}
                    <tr className="bg-secondary/50 font-semibold">
                      <td colSpan={5} className="h-14 px-4 text-right text-sm font-bold text-[#0A1A44]">
                        TOTAL SELECTIONNE :
                      </td>
                      <td className="h-14 px-4 text-right text-sm font-bold text-[#059669]">
                        {formatCurrencyDH(totalDebiter)}
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
                      disabled={selectedItems.length === 0 || !oiNumero.trim()}
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
