"use client";

import React from "react";

import { useEffect, useState, useCallback } from "react";
import { transactionsApi, plafondsApi, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { TransactionRegie, PlafondRegie } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ArrowLeftRight,
  X,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const emptyForm = {
  provinceId: 0,
  compteCode: "",
  montant: 0,
  fournisseur: "",
  adresseFournisseur: "",
  factureNumero: "",
  factureDate: "",
  numeroAp: "",
  dateAp: "",
  moisAnnee: "",
  typeTransaction: "",
  description: "",
};

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRegie[]>([]);
  const [plafonds, setPlafonds] = useState<PlafondRegie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [txData, plafData] = await Promise.all([
        transactionsApi.getAll(),
        plafondsApi.getAll(),
      ]);
      setTransactions(txData);
      setPlafonds(plafData);
    } catch {
      setError("Erreur lors du chargement des transactions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        ...form,
        factureDate: form.factureDate || undefined,
        dateAp: form.dateAp || undefined,
      };
      if (editingId) {
        await transactionsApi.update(editingId, payload);
      } else {
        await transactionsApi.create(payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await fetchData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors de la sauvegarde.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (tx: TransactionRegie) => {
    setForm({
      provinceId: tx.provinceId,
      compteCode: tx.compteCode,
      montant: tx.montant,
      fournisseur: tx.fournisseur || "",
      adresseFournisseur: tx.adresseFournisseur || "",
      factureNumero: tx.factureNumero || "",
      factureDate: tx.factureDate || "",
      numeroAp: tx.numeroAp || "",
      dateAp: tx.dateAp || "",
      moisAnnee: tx.moisAnnee || "",
      typeTransaction: tx.typeTransaction || "",
      description: tx.description || "",
    });
    setEditingId(tx.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette transaction ?")) return;
    try {
      await transactionsApi.delete(id);
      await fetchData();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erreur lors de la suppression.",
      );
    }
  };

  const uniqueProvinces = Array.from(
    new Map(
      plafonds.map((p) => [
        p.provinceId,
        { id: p.provinceId, name: p.provinceName },
      ]),
    ).values(),
  );

  const comptesForProvince = plafonds.filter(
    (p) => p.provinceId === form.provinceId,
  );

  const filtered = transactions.filter(
    (tx) =>
      tx.provinceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.compteCode.includes(searchTerm) ||
      (tx.fournisseur || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.factureNumero || "").includes(searchTerm) ||
      (tx.description || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Generate mois/annee options (12 months)
  const moisAnneeOptions: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    moisAnneeOptions.push(`${mm}/${yyyy}`);
  }

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
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0A1A44]">
            Transactions
          </h1>
          <p className="mt-1 text-base text-muted-foreground">
            Saisie et suivi des depenses par province
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(true);
          }}
          className="bg-gradient-to-r from-[#1A3A8A] to-[#0A1A44] text-white shadow-md hover:shadow-lg"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle depense
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-[#0A1A44]/[0.02] to-transparent px-7 py-4">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-[#0A1A44]">
                {editingId ? "Modifier la transaction" : "Nouvelle depense"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {editingId
                  ? "Modifiez les informations de la transaction"
                  : "Saisissez les details de la depense"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-7">
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              {/* Province */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Province
                </Label>
                <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10"
                  value={form.provinceId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      provinceId: Number(e.target.value),
                      compteCode: "",
                    })
                  }
                  required
                >
                  <option value={0}>Selectionner...</option>
                  {uniqueProvinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* Compte */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Compte
                </Label>
                <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10"
                  value={form.compteCode}
                  onChange={(e) =>
                    setForm({ ...form, compteCode: e.target.value })
                  }
                  required
                  disabled={!form.provinceId}
                >
                  <option value="">Selectionner...</option>
                  {comptesForProvince.map((p) => (
                    <option key={p.compteCode} value={p.compteCode}>
                      {p.compteCode} - {p.libelle} (Dispo:{" "}
                      {formatCurrency(p.disponible)})
                    </option>
                  ))}
                </select>
              </div>
              {/* Montant */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Montant (MAD)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.montant || ""}
                  onChange={(e) =>
                    setForm({ ...form, montant: Number(e.target.value) })
                  }
                  placeholder="0.00"
                  required
                />
              </div>
              {/* Facture Numero */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  N Facture
                </Label>
                <Input
                  value={form.factureNumero}
                  onChange={(e) =>
                    setForm({ ...form, factureNumero: e.target.value })
                  }
                  placeholder="Numero de facture"
                  maxLength={50}
                />
              </div>
              {/* Facture Date */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Date Facture
                </Label>
                <Input
                  type="date"
                  value={form.factureDate}
                  onChange={(e) =>
                    setForm({ ...form, factureDate: e.target.value })
                  }
                />
              </div>
              {/* Fournisseur */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Fournisseur
                </Label>
                <Input
                  value={form.fournisseur}
                  onChange={(e) =>
                    setForm({ ...form, fournisseur: e.target.value })
                  }
                  placeholder="Nom du fournisseur"
                  maxLength={255}
                />
              </div>
              {/* Adresse Fournisseur */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Adresse Fournisseur
                </Label>
                <Input
                  value={form.adresseFournisseur}
                  onChange={(e) =>
                    setForm({ ...form, adresseFournisseur: e.target.value })
                  }
                  placeholder="Adresse"
                  maxLength={500}
                />
              </div>
              {/* Numero AP */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  N AP
                </Label>
                <Input
                  value={form.numeroAp}
                  onChange={(e) =>
                    setForm({ ...form, numeroAp: e.target.value })
                  }
                  placeholder="Numero AP"
                  maxLength={50}
                />
              </div>
              {/* Date AP */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Date AP
                </Label>
                <Input
                  type="date"
                  value={form.dateAp}
                  onChange={(e) => setForm({ ...form, dateAp: e.target.value })}
                />
              </div>
              {/* Mois/Annee */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Mois / Annee
                </Label>
                <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10"
                  value={form.moisAnnee}
                  onChange={(e) =>
                    setForm({ ...form, moisAnnee: e.target.value })
                  }
                >
                  <option value="">Selectionner...</option>
                  {moisAnneeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              {/* Type Transaction */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Type
                </Label>
                <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10"
                  value={form.typeTransaction}
                  onChange={(e) =>
                    setForm({ ...form, typeTransaction: e.target.value })
                  }
                >
                  <option value="">Selectionner...</option>
                  <option value="facture">Facture</option>
                  <option value="avance">Avance</option>
                  <option value="regularisation">Regularisation</option>
                </select>
              </div>
              {/* Description */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Description
                </Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Description de la depense"
                />
              </div>
              {/* Submit */}
              <div className="flex items-end lg:col-span-3 md:col-span-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-gradient-to-r from-[#1A3A8A] to-[#0A1A44] text-white"
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {editingId ? "Mettre a jour" : "Enregistrer la depense"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-[#0A1A44]/[0.02] to-transparent px-7 py-4">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="h-4 w-4 text-[#1A3A8A]" />
            <h2 className="text-sm font-bold tracking-tight text-[#0A1A44]">
              Transactions ({filtered.length})
            </h2>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Aucune transaction trouvee
            </p>
          ) : (
            <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-[#0A1A44] to-[#1A3A8A]">
                  <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white">
                    Province
                  </th>
                  <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white">
                    Compte
                  </th>
                  <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white">
                    N Facture
                  </th>
                  <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white">
                    Date Facture
                  </th>
                  <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white">
                    Fournisseur
                  </th>
                  <th className="h-12 border-r border-white/10 px-4 text-right text-[11.5px] font-semibold uppercase tracking-widest text-white">
                    Montant
                  </th>
                  <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white">
                    Mois/Annee
                  </th>
                  <th className="h-12 px-4 text-right text-[11.5px] font-semibold uppercase tracking-widest text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx, i) => (
                  <React.Fragment key={tx.id}>
                    <tr
                      className={`border-b border-border/60 transition-colors hover:bg-secondary/40 ${
                        i % 2 === 0 ? "bg-card" : "bg-secondary/20"
                      }`}
                    >
                      <td className="h-14 px-4 font-medium text-foreground">
                        {tx.provinceName}
                      </td>
                      <td className="h-14 px-4 font-mono text-xs text-muted-foreground">
                        {tx.compteCode}
                      </td>
                      <td className="h-14 px-4 text-foreground">
                        {tx.factureNumero || "-"}
                      </td>
                      <td className="h-14 px-4 text-xs text-muted-foreground">
                        {formatDateOnly(tx.factureDate)}
                      </td>
                      <td className="h-14 px-4 text-foreground">
                        {tx.fournisseur || "-"}
                      </td>
                      <td className="h-14 px-4 text-right font-semibold text-[#DC2626]">
                        {formatCurrency(tx.montant)}
                      </td>
                      <td className="h-14 px-4 text-xs text-muted-foreground">
                        {tx.moisAnnee || "-"}
                      </td>
                      <td className="h-14 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              setExpandedRow(
                                expandedRow === tx.id ? null : tx.id,
                              )
                            }
                            title="Details"
                          >
                            {expandedRow === tx.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                          {(user?.role === "ADMIN" ||
                            user?.role === "REGION") && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => handleEdit(tx)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(tx.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded detail row */}
                    {expandedRow === tx.id && (
                      <tr className="bg-secondary/10">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground">
                                Adresse Fournisseur
                              </span>
                              <p className="text-foreground">
                                {tx.adresseFournisseur || "-"}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground">
                                N AP
                              </span>
                              <p className="text-foreground">
                                {tx.numeroAp || "-"}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground">
                                Date AP
                              </span>
                              <p className="text-foreground">
                                {formatDateOnly(tx.dateAp)}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground">
                                Type
                              </span>
                              <p className="text-foreground">
                                {tx.typeTransaction || "-"}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground">
                                Description
                              </span>
                              <p className="text-foreground">
                                {tx.description || "-"}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground">
                                Cree par
                              </span>
                              <p className="text-foreground">{tx.createdBy}</p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground">
                                Date creation
                              </span>
                              <p className="text-foreground">
                                {formatDate(tx.createdAt)}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
