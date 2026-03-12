"use client";

import React from "react";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  plafondsApi,
  transactionsApi,
  regionsApi,
  provincesApi,
  ApiError,
} from "@/lib/api";
import type {
  PlafondRegie,
  TransactionRegie,
  Region,
  Province,
} from "@/lib/types";
import { generateAutorisationPDF } from "@/lib/pdf-autorisation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  TrendingDown,
  PiggyBank,
  Banknote,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Save,
  List,
  BarChart3,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Pencil,
  Printer,
  Check,
  X,
} from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + " DH";
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Get current month/year in format "janvier 2026"
function getCurrentMoisAnnee() {
  const now = new Date();
  const month = now.toLocaleDateString("fr-FR", { month: "long" });
  const year = now.getFullYear();
  return `${month} ${year}`;
}

interface InlineTransaction {
  plafondId: number;
  factureNumero: string;
  factureDate: string;
  fournisseur: string;
  adresseFournisseur: string;
  numeroAp: string;
  dateAp: string;
  moisAnnee: string;
  montant: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [plafonds, setPlafonds] = useState<PlafondRegie[]>([]);
  const [transactions, setTransactions] = useState<TransactionRegie[]>([]);

  const [selectedRegion, setSelectedRegion] = useState<number | "">("");
  const [selectedProvince, setSelectedProvince] = useState<number | "">("");

  const [loading, setLoading] = useState(true);
  const [loadingPlafonds, setLoadingPlafonds] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Inline transaction forms - one per plafond
  const [inlineForms, setInlineForms] = useState<Record<number, InlineTransaction>>({});

  // Alimenter modal state
  const [alimenterModal, setAlimenterModal] = useState<{
    plafond: PlafondRegie;
    maxMontant: number;
  } | null>(null);

  // Confirm transaction modal state
  const [confirmModal, setConfirmModal] = useState<{
    transaction: TransactionRegie;
    montantValide: string;
  } | null>(null);

  // Edit transaction modal state (for DELEGATION on EN_ATTENTE)
  const [editModal, setEditModal] = useState<TransactionRegie | null>(null);
  const [editForm, setEditForm] = useState({
    montant: "",
    fournisseur: "",
    adresseFournisseur: "",
    factureNumero: "",
    factureDate: "",
    numeroAp: "",
    dateAp: "",
  });

  const [alimenterForm, setAlimenterForm] = useState({
    montant: "",
    op: "",
    dateOp: "",
    numCheque: "",
    dateCheque: "",
  });

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [regionsData, provincesData] = await Promise.all([
        regionsApi.getAll(),
        provincesApi.getAll(),
      ]);
      setRegions(regionsData);
      setProvinces(provincesData);

      // Pre-fill filters based on user role
      if (user?.role === "PROV" && user.provinceId) {
        // PROV: pre-fill and lock both region and province
        setSelectedProvince(user.provinceId);
        const prov = provincesData.find((p) => p.id === user.provinceId);
        if (prov) {
          setSelectedRegion(prov.regionId);
        }
      } else if (user?.role === "REGION" && user.regionId) {
        // REGION: pre-fill and lock region only
        setSelectedRegion(user.regionId);
      }
    } catch {
      setError("Erreur lors du chargement des donnees.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchPlafonds = useCallback(async () => {
    if (!selectedProvince) {
      setPlafonds([]);
      setTransactions([]);
      return;
    }
    setLoadingPlafonds(true);
    setError("");
    setSuccess("");
    try {
      const [plafondsData, transactionsData] = await Promise.all([
        plafondsApi.getAll(),
        transactionsApi.getAll(),
      ]);
      // Filter by selected province
      const filtered = plafondsData.filter(
          (p) => p.provinceId === selectedProvince
      );
      setPlafonds(filtered);
      setTransactions(
          transactionsData.filter((t) => t.provinceId === selectedProvince)
      );

      // Initialize inline forms for each plafond
      const forms: Record<number, InlineTransaction> = {};
      filtered.forEach((p) => {
        forms[p.id] = {
          plafondId: p.id,
          factureNumero: "",
          factureDate: "",
          fournisseur: "",
          adresseFournisseur: "",
          numeroAp: "",
          dateAp: "",
          moisAnnee: getCurrentMoisAnnee(),
          montant: "",
        };
      });
      setInlineForms(forms);
      setSuccess(`Chargement des donnees pour ${filtered[0]?.provinceName || "la province"}...`);
    } catch {
      setError("Erreur lors du chargement des plafonds.");
    } finally {
      setLoadingPlafonds(false);
    }
  }, [selectedProvince]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (selectedProvince) {
      fetchPlafonds();
    }
  }, [selectedProvince, fetchPlafonds]);

  const filteredProvinces = selectedRegion
      ? provinces.filter((p) => p.regionId === Number(selectedRegion))
      : [];

  const handleInlineChange = (
      plafondId: number,
      field: keyof InlineTransaction,
      value: string
  ) => {
    setInlineForms((prev) => ({
      ...prev,
      [plafondId]: {
        ...prev[plafondId],
        [field]: value,
      },
    }));
  };

  const handleSaveAll = async () => {
    // Collect all forms with montant > 0
    const toSave = Object.values(inlineForms).filter(
        (f) => f.montant && Number(f.montant) > 0
    );

    if (toSave.length === 0) {
      setError("Aucune depense a enregistrer.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      for (const form of toSave) {
        const plafond = plafonds.find((p) => p.id === form.plafondId);
        if (!plafond) continue;

        await transactionsApi.create({
          provinceId: plafond.provinceId,
          compteCode: plafond.compteCode,
          montant: Number(form.montant),
          factureNumero: form.factureNumero || undefined,
          factureDate: form.factureDate || undefined,
          fournisseur: form.fournisseur || undefined,
          adresseFournisseur: form.adresseFournisseur || undefined,
          numeroAp: form.numeroAp || undefined,
          dateAp: form.dateAp || undefined,
          moisAnnee: form.moisAnnee || undefined,
          description: `Depense ${plafond.libelle}`,
        });
      }

      setSuccess(`${toSave.length} depense(s) enregistree(s) avec succes.`);
      await fetchPlafonds(); // Refresh data
    } catch (err) {
      setError(
          err instanceof ApiError
              ? err.message
              : "Erreur lors de l'enregistrement."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Open alimenter modal
  const openAlimenterModal = (plafond: PlafondRegie, maxMontant: number) => {
    setAlimenterModal({ plafond, maxMontant });
    setAlimenterForm({
      montant: "",
      op: "",
      dateOp: "",
      numCheque: "",
      dateCheque: "",
    });
  };

  // Handle alimentation submission
  const handleAlimenter = async () => {
    if (!alimenterModal || !alimenterForm.montant || Number(alimenterForm.montant) <= 0) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await plafondsApi.alimenter(alimenterModal.plafond.id, {
        montant: Number(alimenterForm.montant),
        op: alimenterForm.op || undefined,
        dateOp: alimenterForm.dateOp || undefined,
        numCheque: alimenterForm.numCheque || undefined,
        dateCheque: alimenterForm.dateCheque || undefined,
      });
      setSuccess("Alimentation effectuee avec succes.");
      setAlimenterModal(null);
      await fetchPlafonds(); // Refresh data
    } catch (err) {
      setError(
          err instanceof ApiError
              ? err.message
              : "Erreur lors de l'alimentation."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Print autorisation PDF for a transaction
  const handlePrintAutorisation = async (tx: TransactionRegie) => {
    const plafond = plafonds.find((p) => p.compteCode === tx.compteCode);
    // Calculate credit disponible BEFORE this transaction was deducted
    // We add back the current transaction amount to show the previous balance
    const totalDepenses = transactions
        .filter(t => t.compteCode === plafond?.compteCode && t.id !== tx.id)
        .reduce((s, t) => s + t.montant, 0);
    const disponibleAvantDepense = plafond
        ? plafond.plafondAnnuel - totalDepenses
        : 0;
    await generateAutorisationPDF({
      numeroAp: tx.numeroAp || String(tx.id),
      disponible: disponibleAvantDepense,
      compteCode: tx.compteCode,
      libelle: plafond?.libelle || "",
      fournisseur: tx.fournisseur || "",
      adresseFournisseur: tx.adresseFournisseur || "",
      montant: tx.montant,
      factureNumero: tx.factureNumero || "",
      factureDate: tx.factureDate
          ? new Date(tx.factureDate).toLocaleDateString("fr-FR")
          : "",
      provinceName: tx.provinceName,
    });
  };

  // Confirm transaction handler
  const handleConfirmTransaction = async () => {
    if (!confirmModal) return;
    const montantValide = Number(confirmModal.montantValide);
    if (isNaN(montantValide) || montantValide <= 0) {
      setError("Veuillez entrer un montant valide.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await transactionsApi.confirm(confirmModal.transaction.id, montantValide);
      setSuccess("Transaction confirmee avec succes.");
      setConfirmModal(null);
      await fetchPlafonds(); // Refresh data
    } catch (err) {
      setError(
          err instanceof ApiError
              ? err.message
              : "Erreur lors de la confirmation."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit modal for pending transaction
  const openEditModal = (tx: TransactionRegie) => {
    setEditModal(tx);
    setEditForm({
      montant: String(tx.montant),
      fournisseur: tx.fournisseur || "",
      adresseFournisseur: tx.adresseFournisseur || "",
      factureNumero: tx.factureNumero || "",
      factureDate: tx.factureDate || "",
      numeroAp: tx.numeroAp || "",
      dateAp: tx.dateAp || "",
    });
  };

  // Submit edit transaction
  const handleEditTransaction = async () => {
    if (!editModal) return;
    const montant = Number(editForm.montant);
    if (isNaN(montant) || montant <= 0) {
      setError("Veuillez entrer un montant valide.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await transactionsApi.update(editModal.id, {
        provinceId: editModal.provinceId,
        compteCode: editModal.compteCode,
        montant,
        fournisseur: editForm.fournisseur,
        adresseFournisseur: editForm.adresseFournisseur,
        factureNumero: editForm.factureNumero,
        factureDate: editForm.factureDate || undefined,
        numeroAp: editForm.numeroAp,
        dateAp: editForm.dateAp || undefined,
        moisAnnee: editModal.moisAnnee || undefined,
        typeTransaction: editModal.typeTransaction || undefined,
        description: editModal.description || undefined,
      });
      setSuccess("Transaction modifiee avec succes.");
      setEditModal(null);
      await fetchPlafonds();
    } catch (err) {
      setError(
          err instanceof ApiError
              ? err.message
              : "Erreur lors de la modification."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Reject transaction handler
  const handleRejectTransaction = async (id: number) => {
    if (!confirm("Etes-vous sur de vouloir rejeter cette transaction?")) return;
    setSubmitting(true);
    setError("");
    try {
      await transactionsApi.reject(id);
      setSuccess("Transaction rejetee.");
      await fetchPlafonds(); // Refresh data
    } catch (err) {
      setError(
          err instanceof ApiError
              ? err.message
              : "Erreur lors du rejet."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate totals - only count CONFIRMED transactions
  const confirmedTransactions = transactions.filter(t => t.statut === "CONFIRMEE");
  const totalBudgetAnnuel = plafonds.reduce((s, p) => s + p.plafondAnnuel, 0);
  const totalDepense = confirmedTransactions.reduce((s, t) => s + (t.montantValide || 0), 0);
  const totalResteGlobal = totalBudgetAnnuel - totalDepense;
  const totalEncaissement = plafonds.reduce(
      (s, p) => s + p.plafondEncaissement,
      0
  );

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
            <Wallet className="h-7 w-7 text-[#1A3A8A]" />
            Gestion des Depenses de Regie
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selectionnez une region pour consulter l{"'"}etat budgetaire des
            comptes et enregistrer les depenses.
          </p>
        </div>

        {/* Region/Province Selection */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#1A3A8A]" />
            <h2 className="text-sm font-bold text-[#0A1A44]">
              Selection de la Region Administrative
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Choisissez la Region
              </label>
              <select
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  value={selectedRegion}
                  onChange={(e) => {
                    setSelectedRegion(e.target.value ? Number(e.target.value) : "");
                    setSelectedProvince("");
                  }}
                  disabled={user?.role === "REGION" || user?.role === "PROV"}
              >
                <option value="">-- Selectionnez une Region --</option>
                {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Choisissez une Ville
              </label>
              <select
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  value={selectedProvince}
                  onChange={(e) =>
                      setSelectedProvince(e.target.value ? Number(e.target.value) : "")
                  }
                  disabled={!selectedRegion || user?.role === "PROV"}
              >
                <option value="">-- Selectionnez une Ville --</option>
                {filteredProvinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Vue d'Ensemble Budgetaire - Only show when province selected */}
        {selectedProvince && plafonds.length > 0 && (
            <>
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[#1A3A8A]" />
                    <h2 className="text-sm font-bold text-[#0A1A44]">
                      Vue d{"'"}Ensemble Budgetaire :{" "}
                      <span className="text-[#1A3A8A]">
                    {plafonds[0]?.provinceName}
                  </span>
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Mise a jour : {formatTime(new Date())}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {/* Budget Annuel Total */}
                  <div className="relative overflow-hidden rounded-xl border-t-4 border-t-[#1A3A8A] bg-white p-5 shadow-sm">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A3A8A]/10">
                      <Wallet className="h-5 w-5 text-[#1A3A8A]" />
                    </div>
                    <p className="text-2xl font-bold text-[#0A1A44]">
                      {formatCurrency(totalBudgetAnnuel)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Budget Annuel Total
                    </p>
                  </div>

                  {/* Total Depense */}
                  <div className="relative overflow-hidden rounded-xl border-t-4 border-t-[#059669] bg-white p-5 shadow-sm">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#059669]/10">
                      <TrendingDown className="h-5 w-5 text-[#059669]" />
                    </div>
                    <p className="text-2xl font-bold text-[#0A1A44]">
                      {formatCurrency(totalDepense)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Total Depense (Annuel)
                    </p>
                  </div>

                  {/* Reste Global Estime */}
                  <div className="relative overflow-hidden rounded-xl border-t-4 border-t-[#F59E0B] bg-white p-5 shadow-sm">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#F59E0B]/10">
                      <PiggyBank className="h-5 w-5 text-[#F59E0B]" />
                    </div>
                    <p className="text-2xl font-bold text-[#F59E0B]">
                      {formatCurrency(totalResteGlobal)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reste Global Estime
                    </p>
                  </div>

                  {/* Plafond d'Encaissement */}
                  <div className="relative overflow-hidden rounded-xl border-t-4 border-t-[#D4AF37] bg-white p-5 shadow-sm">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#D4AF37]/10">
                      <Banknote className="h-5 w-5 text-[#D4AF37]" />
                    </div>
                    <p className="text-2xl font-bold text-[#0A1A44]">
                      {formatCurrency(totalEncaissement)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Plafond d{"'"}Encaissement
                    </p>
                  </div>
                </div>
              </div>

              {/* Saisie des Depenses par Rubrique */}
              <div className="rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4 text-[#1A3A8A]" />
                    <h2 className="text-sm font-bold text-[#0A1A44]">
                      Saisie des Depenses par Rubrique
                    </h2>
                  </div>
                </div>

                {/* Success/Error Messages */}
                {success && (
                    <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg bg-[#059669]/10 p-3 text-sm text-[#059669]">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{success}</span>
                    </div>
                )}
                {error && (
                    <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                )}

                {loadingPlafonds ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="max-h-[500px] overflow-auto">
                      <table className="w-full min-w-[1400px] border-separate border-spacing-0 text-sm">
                        <thead>
                        <tr className="bg-gradient-to-r from-[#0A1A44] to-[#1A3A8A]">
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Code
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Rubrique / Plafonds
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Facture N
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Date Facture
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Fournisseur
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Adresse Fournisseur
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Numero AP
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Date AP
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Mois/Annee
                          </th>
                          <th className="h-12 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-white">
                            Montant (DH)
                          </th>
                        </tr>
                        </thead>
                        <tbody>
                        {plafonds.map((p, i) => {
                          const form = inlineForms[p.id];
                          if (!form) return null;

                          // Calculate Facture = sum of all transactions for this rubrique
                          const factureTotal = transactions
                              .filter((t) => t.compteCode === p.compteCode)
                              .reduce((sum, t) => sum + t.montant, 0);

                          // Disponible = Encaissement - Facture
                          const disponibleCalc = p.plafondEncaissement - factureTotal;

                          // A Alimenter = Facture - Encaissement (when positive)
                          const aAlimenter = factureTotal - p.plafondEncaissement;

                          return (
                              <tr
                                  key={p.id}
                                  className={`border-b border-border/60 ${
                                      i % 2 === 0 ? "bg-white" : "bg-secondary/20"
                                  }`}
                              >
                                {/* Code */}
                                <td className="h-auto px-4 py-3 align-top font-mono text-sm font-medium text-foreground">
                                  {p.compteCode}
                                </td>

                                {/* Rubrique / Plafonds */}
                                <td className="h-auto px-4 py-3 align-top">
                                  <div className="flex flex-col gap-1.5">
                              <span className="font-medium text-foreground">
                                {p.libelle}
                              </span>
                                    <div className="flex flex-col gap-1 text-[11px]">
                                <span className="inline-flex items-center rounded bg-[#1A3A8A]/10 px-2 py-0.5 text-[#1A3A8A]">
                                  Annuel: {formatCurrency(p.plafondAnnuel)}
                                </span>
                                      <span className="inline-flex items-center rounded bg-[#7C3AED]/10 px-2 py-0.5 text-[#7C3AED]">
                                  Encaissement: {formatCurrency(p.plafondEncaissement)}
                                </span>
                                      <span className="inline-flex items-center rounded bg-[#F59E0B]/10 px-2 py-0.5 text-[#F59E0B]">
                                  Max Facture: {formatCurrency(p.plafondMaxFacture)}
                                </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Facture N */}
                                <td className="h-auto px-2 py-3 align-top">
                                  <Input
                                      placeholder="N"
                                      value={form.factureNumero}
                                      onChange={(e) =>
                                          handleInlineChange(p.id, "factureNumero", e.target.value)
                                      }
                                      className="h-9 w-20 text-sm"
                                  />
                                </td>

                                {/* Date Facture */}
                                <td className="h-auto px-2 py-3 align-top">
                                  <Input
                                      type="date"
                                      value={form.factureDate}
                                      onChange={(e) =>
                                          handleInlineChange(p.id, "factureDate", e.target.value)
                                      }
                                      className="h-9 w-36 text-sm"
                                  />
                                </td>

                                {/* Fournisseur */}
                                <td className="h-auto px-2 py-3 align-top">
                                  <Input
                                      placeholder="Nom"
                                      value={form.fournisseur}
                                      onChange={(e) =>
                                          handleInlineChange(p.id, "fournisseur", e.target.value)
                                      }
                                      className="h-9 w-28 text-sm"
                                  />
                                </td>

                                {/* Adresse Fournisseur */}
                                <td className="h-auto px-2 py-3 align-top">
                                  <Input
                                      placeholder="Adresse"
                                      value={form.adresseFournisseur}
                                      onChange={(e) =>
                                          handleInlineChange(
                                              p.id,
                                              "adresseFournisseur",
                                              e.target.value
                                          )
                                      }
                                      className="h-9 w-32 text-sm"
                                  />
                                </td>

                                {/* Numero AP */}
                                <td className="h-auto px-2 py-3 align-top">
                                  <Input
                                      placeholder="N AP"
                                      value={form.numeroAp}
                                      onChange={(e) =>
                                          handleInlineChange(p.id, "numeroAp", e.target.value)
                                      }
                                      className="h-9 w-20 text-sm"
                                  />
                                </td>

                                {/* Date AP */}
                                <td className="h-auto px-2 py-3 align-top">
                                  <Input
                                      type="date"
                                      value={form.dateAp}
                                      onChange={(e) =>
                                          handleInlineChange(p.id, "dateAp", e.target.value)
                                      }
                                      className="h-9 w-36 text-sm"
                                  />
                                </td>

                                {/* Mois/Annee */}
                                <td className="h-auto px-2 py-3 align-top">
                                  <Input
                                      placeholder="janvier 2026"
                                      value={form.moisAnnee}
                                      onChange={(e) =>
                                          handleInlineChange(p.id, "moisAnnee", e.target.value)
                                      }
                                      className="h-9 w-32 text-sm"
                                  />
                                </td>

                                {/* Montant */}
                                <td className="h-auto px-2 py-3 align-top">
                                  <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="0.00"
                                      value={form.montant}
                                      onChange={(e) =>
                                          handleInlineChange(p.id, "montant", e.target.value)
                                      }
                                      className="h-9 w-28 text-right text-sm"
                                  />
                                </td>
                              </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end border-t border-border/60 px-6 py-4">
                  <Button
                      onClick={handleSaveAll}
                      disabled={submitting}
                      className="bg-[#059669] text-white hover:bg-[#047857]"
                  >
                    {submitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    Enregistrer les Depenses Saisies
                  </Button>
                </div>
              </div>

              {/* Transactions List Section - Filter & Historique */}
              <div className="rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-[#1A3A8A]" />
                    <h2 className="text-sm font-bold text-[#0A1A44]">
                      Filtre Global & Historique des Operations
                    </h2>
                  </div>
                </div>

                {/* Filters */}
                <div className="border-b border-border/60 px-6 py-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Filtrer par Region
                      </label>
                      <select
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                          value={selectedRegion}
                          disabled
                      >
                        <option value="">
                          {regions.find((r) => r.id === selectedRegion)?.name || "Region"}
                        </option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Filtrer par Compte
                      </label>
                      <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                        <option value="">Tous les Comptes</option>
                        {plafonds.map((p) => (
                            <option key={p.compteCode} value={p.compteCode}>
                              {p.compteCode}
                            </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button className="w-full bg-[#0A1A44] text-white hover:bg-[#1A3A8A]">
                        <Filter className="mr-2 h-4 w-4" />
                        Appliquer Filtre
                      </Button>
                    </div>
                    <div className="flex items-end">
                      <Button variant="outline" className="w-full">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reinitialiser
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Transactions Table */}
                {transactions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1200px] border-separate border-spacing-0 text-sm">
                        <thead>
                        <tr className="bg-gradient-to-r from-[#0A1A44] to-[#1A3A8A]">
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            ID
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Region
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Compte Code
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Facture N
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Date Facture
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Fournisseur
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Adresse Fournisseur
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Numero AP
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Date AP
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-white">
                            Montant (DH)
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-white">
                            Montant Valide
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-center text-[11px] font-semibold uppercase tracking-wider text-white">
                            Statut
                          </th>
                          <th className="h-12 border-r border-white/10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                            Mois/Annee
                          </th>
                          <th className="h-12 px-4 text-center text-[11px] font-semibold uppercase tracking-wider text-white">
                            Action
                          </th>
                        </tr>
                        </thead>
                        <tbody>
                        {transactions.map((tx, i) => (
                            <tr
                                key={tx.id}
                                className={`border-b border-border/60 ${
                                    i % 2 === 0 ? "bg-white" : "bg-secondary/10"
                                }`}
                            >
                              <td className="h-14 px-4 text-foreground">{tx.id}</td>
                              <td className="h-14 px-4 text-foreground">{tx.provinceName}</td>
                              <td className="h-14 px-4 font-mono text-sm">{tx.compteCode}</td>
                              <td className="h-14 px-4">{tx.factureNumero || "-"}</td>
                              <td className="h-14 px-4 text-xs">
                                {tx.factureDate
                                    ? new Date(tx.factureDate).toLocaleDateString("fr-FR")
                                    : "-"}
                              </td>
                              <td className="h-14 px-4">{tx.fournisseur || "-"}</td>
                              <td className="h-14 px-4 max-w-[180px] truncate text-xs">
                                {tx.adresseFournisseur || "-"}
                              </td>
                              <td className="h-14 px-4">{tx.numeroAp || "-"}</td>
                              <td className="h-14 px-4 text-xs">
                                {tx.dateAp
                                    ? new Date(tx.dateAp).toLocaleDateString("fr-FR")
                                    : "-"}
                              </td>
                              <td className="h-14 px-4 text-right font-semibold text-[#1A3A8A]">
                                {formatCurrency(tx.montant)}
                              </td>
                              <td className="h-14 px-4 text-right font-semibold text-[#059669]">
                                {tx.montantValide ? formatCurrency(tx.montantValide) : "-"}
                              </td>
                              <td className="h-14 px-4 text-center">
                          <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                  tx.statut === "CONFIRMEE"
                                      ? "bg-green-100 text-green-700"
                                      : tx.statut === "REJETEE"
                                          ? "bg-red-100 text-red-700"
                                          : "bg-yellow-100 text-yellow-700"
                              }`}
                          >
                            {tx.statut === "CONFIRMEE" && <CheckCircle className="mr-1 h-3 w-3" />}
                            {tx.statut === "REJETEE" && <XCircle className="mr-1 h-3 w-3" />}
                            {tx.statut === "EN_ATTENTE" && <Clock className="mr-1 h-3 w-3" />}
                            {tx.statut === "CONFIRMEE" ? "Confirmee" : tx.statut === "REJETEE" ? "Rejetee" : "En attente"}
                          </span>
                              </td>
                              <td className="h-14 px-4 text-xs">{tx.moisAnnee || "-"}</td>
                              <td className="h-14 px-4">
                                <div className="flex items-center justify-center gap-1">
                                  {/* Confirm/Reject buttons for REGION or ADMIN role on pending transactions */}
                                  {(user?.role === "REGION" || user?.role === "ADMIN") && tx.statut === "EN_ATTENTE" && (
                                      <>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                            title="Confirmer"
                                            onClick={() => setConfirmModal({ transaction: tx, montantValide: String(tx.montant) })}
                                        >
                                          <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            title="Rejeter"
                                            onClick={() => handleRejectTransaction(tx.id)}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </>
                                  )}
                                  {/* Edit button for all roles on pending transactions */}
                                  {tx.statut === "EN_ATTENTE" && (
                                      <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                          title="Modifier"
                                          onClick={() => openEditModal(tx)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                  )}
                                  {/* Delete button */}
                                  <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                      title="Supprimer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                      title="Imprimer Autorisation"
                                      onClick={() => handlePrintAutorisation(tx)}
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                        ))}
                        </tbody>
                      </table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <List className="mb-4 h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">
                        Aucune transaction pour cette province
                      </p>
                    </div>
                )}
              </div>
            </>
        )}

        {/* Empty State when no province selected */}
        {!selectedProvince && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16">
              <MapPin className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Selectionnez une region et une ville pour commencer
              </p>
            </div>
        )}

        {/* Alimenter l'Encaissement Modal */}
        {alimenterModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#059669]">
                      <span className="text-lg text-white">+</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#0A1A44]">
                      Alimenter l{"'"}Encaissement
                    </h3>
                  </div>
                  <button
                      onClick={() => setAlimenterModal(null)}
                      className="text-muted-foreground hover:text-foreground"
                  >
                    &times;
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Region */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Region
                    </label>
                    <div className="rounded-lg border border-input bg-secondary/30 px-3 py-2 text-sm">
                      {regions.find((r) => r.id === selectedRegion)?.name || "-"}
                    </div>
                  </div>

                  {/* Compte */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Compte
                    </label>
                    <div className="rounded-lg border border-input bg-secondary/30 px-3 py-2 text-sm">
                      {alimenterModal.plafond.compteCode}
                    </div>
                  </div>

                  {/* Maximum autorise */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Maximum autorise
                    </label>
                    <div className="rounded-lg border border-input bg-secondary/30 px-3 py-2 text-sm text-[#059669] font-medium">
                      {formatCurrency(alimenterModal.maxMontant)}
                    </div>
                  </div>

                  {/* Montant a alimenter */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Montant a alimenter (DH) *
                    </label>
                    <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={alimenterModal.maxMontant}
                        value={alimenterForm.montant}
                        onChange={(e) =>
                            setAlimenterForm((f) => ({ ...f, montant: e.target.value }))
                        }
                        className="h-11"
                        placeholder="0.00"
                    />
                  </div>

                  {/* N OP */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      N OP
                    </label>
                    <Input
                        value={alimenterForm.op}
                        onChange={(e) =>
                            setAlimenterForm((f) => ({ ...f, op: e.target.value }))
                        }
                        className="h-11"
                    />
                  </div>

                  {/* Date OP */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Date OP
                    </label>
                    <Input
                        type="date"
                        value={alimenterForm.dateOp}
                        onChange={(e) =>
                            setAlimenterForm((f) => ({ ...f, dateOp: e.target.value }))
                        }
                        className="h-11"
                    />
                  </div>

                  {/* N Cheque */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      N Cheque
                    </label>
                    <Input
                        value={alimenterForm.numCheque}
                        onChange={(e) =>
                            setAlimenterForm((f) => ({ ...f, numCheque: e.target.value }))
                        }
                        className="h-11"
                    />
                  </div>

                  {/* Date Cheque */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Date Cheque
                    </label>
                    <Input
                        type="date"
                        value={alimenterForm.dateCheque}
                        onChange={(e) =>
                            setAlimenterForm((f) => ({ ...f, dateCheque: e.target.value }))
                        }
                        className="h-11"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                      onClick={handleAlimenter}
                      disabled={submitting || !alimenterForm.montant}
                      className="mt-2 h-11 w-full bg-[#059669] text-white hover:bg-[#047857]"
                  >
                    {submitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Confirmer l{"'"}Alimentation
                  </Button>
                </div>
              </div>
            </div>
        )}

        {/* Confirm Transaction Modal */}
        {confirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#059669]">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0A1A44]">
                      Confirmer la Transaction
                    </h3>
                  </div>
                  <button
                      onClick={() => setConfirmModal(null)}
                      className="text-muted-foreground hover:text-foreground"
                  >
                    &times;
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Transaction info */}
                  <div className="rounded-lg bg-secondary/30 p-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Fournisseur:</span>
                      <span className="font-medium">{confirmModal.transaction.fournisseur || "-"}</span>
                      <span className="text-muted-foreground">Montant demande:</span>
                      <span className="font-medium text-[#1A3A8A]">{formatCurrency(confirmModal.transaction.montant)}</span>
                      <span className="text-muted-foreground">Facture N:</span>
                      <span className="font-medium">{confirmModal.transaction.factureNumero || "-"}</span>
                    </div>
                  </div>

                  {/* Montant valide */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Montant Valide (DH) *
                    </label>
                    <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={confirmModal.montantValide}
                        onChange={(e) =>
                            setConfirmModal((m) => m ? { ...m, montantValide: e.target.value } : null)
                        }
                        className="h-11"
                        placeholder="0.00"
                    />
                    <span className="text-xs text-muted-foreground">
                  Vous pouvez modifier le montant valide si necessaire
                </span>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2">
                    <Button
                        onClick={() => setConfirmModal(null)}
                        variant="outline"
                        className="flex-1 h-11"
                    >
                      Annuler
                    </Button>
                    <Button
                        onClick={handleConfirmTransaction}
                        disabled={submitting || !confirmModal.montantValide}
                        className="flex-1 h-11 bg-[#059669] text-white hover:bg-[#047857]"
                    >
                      {submitting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Confirmer
                    </Button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* Edit Transaction Modal (for DELEGATION on EN_ATTENTE) */}
        {editModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A3A8A]">
                      <Pencil className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0A1A44]">
                      Modifier la Transaction
                    </h3>
                  </div>
                  <button
                      onClick={() => setEditModal(null)}
                      className="text-muted-foreground hover:text-foreground"
                  >
                    &times;
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Montant */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Montant (DH) *
                    </label>
                    <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.montant}
                        onChange={(e) =>
                            setEditForm((f) => ({ ...f, montant: e.target.value }))
                        }
                        className="h-11"
                        placeholder="0.00"
                    />
                  </div>

                  {/* Fournisseur */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">
                        Fournisseur
                      </label>
                      <Input
                          value={editForm.fournisseur}
                          onChange={(e) =>
                              setEditForm((f) => ({ ...f, fournisseur: e.target.value }))
                          }
                          className="h-11"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">
                        Adresse Fournisseur
                      </label>
                      <Input
                          value={editForm.adresseFournisseur}
                          onChange={(e) =>
                              setEditForm((f) => ({ ...f, adresseFournisseur: e.target.value }))
                          }
                          className="h-11"
                      />
                    </div>
                  </div>

                  {/* Facture */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">
                        Facture N
                      </label>
                      <Input
                          value={editForm.factureNumero}
                          onChange={(e) =>
                              setEditForm((f) => ({ ...f, factureNumero: e.target.value }))
                          }
                          className="h-11"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">
                        Date Facture
                      </label>
                      <Input
                          type="date"
                          value={editForm.factureDate}
                          onChange={(e) =>
                              setEditForm((f) => ({ ...f, factureDate: e.target.value }))
                          }
                          className="h-11"
                      />
                    </div>
                  </div>

                  {/* AP */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">
                        Numero AP
                      </label>
                      <Input
                          value={editForm.numeroAp}
                          onChange={(e) =>
                              setEditForm((f) => ({ ...f, numeroAp: e.target.value }))
                          }
                          className="h-11"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">
                        Date AP
                      </label>
                      <Input
                          type="date"
                          value={editForm.dateAp}
                          onChange={(e) =>
                              setEditForm((f) => ({ ...f, dateAp: e.target.value }))
                          }
                          className="h-11"
                      />
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                        onClick={() => setEditModal(null)}
                        variant="outline"
                        className="flex-1 h-11"
                    >
                      Annuler
                    </Button>
                    <Button
                        onClick={handleEditTransaction}
                        disabled={submitting || !editForm.montant}
                        className="flex-1 h-11 bg-[#1A3A8A] text-white hover:bg-[#0A1A44]"
                    >
                      {submitting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Enregistrer
                    </Button>
                  </div>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}
