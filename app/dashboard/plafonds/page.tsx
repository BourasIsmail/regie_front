"use client";

import React from "react";
import { useEffect, useState, useCallback } from "react";
import {
  plafondsApi,
  provincesApi,
  regionsApi,
  ApiError,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { PlafondRegie, Province, Region } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Loader2,
  Plus,
  Pencil,
  Download,
  Settings,
  Filter,
  Search,
  RefreshCw,
  X,
  Info,
  LayoutGrid, Save,
} from "lucide-react";

function formatCurrency(value: number) {
  return (
      new Intl.NumberFormat("fr-MA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value) + " DH"
  );
}

const emptyForm = {
  provinceId: 0,
  compteCode: "",
  libelle: "",
  plafondAnnuel: 0,
  budgetAnnuelInitial: 0,
  plafondEncaissement: 0,
  plafondMaxFacture: 0,
};

export default function PlafondsPage() {
  const { user } = useAuth();
  const [plafonds, setPlafonds] = useState<PlafondRegie[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [filterRegion, setFilterRegion] = useState<string>("");
  const [filterProvince, setFilterProvince] = useState<string>("");
  const [filterCompte, setFilterCompte] = useState<string>("");
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Avance modal
  const [avanceModal, setAvanceModal] = useState<PlafondRegie | null>(null);
  const [avanceForm, setAvanceForm] = useState({
    montant: "",
    op: "",
    dateOp: "",
    numCheque: "",
    dateCheque: "",
    commentaire: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plafondsData, provincesData, regionsData] = await Promise.all([
        plafondsApi.getAll(),
        provincesApi.getAll(),
        regionsApi.getAll(),
      ]);
      setPlafonds(plafondsData);
      setProvinces(provincesData);
      setRegions(regionsData);

      // Pre-fill filters based on user role
      if (user?.role === "PROV" && user.provinceId) {
        const prov = provincesData.find((p) => p.id === user.provinceId);
        if (prov) {
          setFilterRegion(String(prov.regionId));
          setFilterProvince(String(user.provinceId));
          setFiltersApplied(true);
        }
      } else if (user?.role === "REGION" && user.regionId) {
        setFilterRegion(String(user.regionId));
        setFiltersApplied(true);
      }
    } catch {
      setError("Erreur lors du chargement des plafonds.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (editingId) {
        await plafondsApi.update(editingId, form);
      } else {
        await plafondsApi.create(form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await fetchData();
    } catch (err) {
      setError(
          err instanceof ApiError ? err.message : "Erreur lors de la sauvegarde."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (p: PlafondRegie) => {
    setForm({
      provinceId: p.provinceId,
      compteCode: p.compteCode,
      libelle: p.libelle,
      plafondAnnuel: p.plafondAnnuel,
      budgetAnnuelInitial: p.budgetAnnuelInitial || 0,
      plafondEncaissement: p.plafondEncaissement,
      plafondMaxFacture: p.plafondMaxFacture,
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleAvance = async () => {
    if (!avanceModal || !avanceForm.montant || Number(avanceForm.montant) <= 0)
      return;
    setSubmitting(true);
    setError("");
    try {
      await plafondsApi.alimenter(avanceModal.id, {
        montant: Number(avanceForm.montant),
        op: avanceForm.op || undefined,
        dateOp: avanceForm.dateOp || undefined,
        numCheque: avanceForm.numCheque || undefined,
        dateCheque: avanceForm.dateCheque || undefined,
        commentaire: avanceForm.commentaire || undefined,
      });
      setAvanceModal(null);
      setAvanceForm({
        montant: "",
        op: "",
        dateOp: "",
        numCheque: "",
        dateCheque: "",
        commentaire: "",
      });
      await fetchData();
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

  const applyFilters = () => {
    setFiltersApplied(true);
  };

  const resetFilters = () => {
    // Only reset filters that user can change
    if (user?.role === "ADMIN") {
      setFilterRegion("");
    }
    if (user?.role !== "PROV") {
      setFilterProvince("");
    }
    setFilterCompte("");
    setFiltersApplied(user?.role === "REGION" || user?.role === "PROV");
  };

  // Get unique compte codes for filter dropdown
  const uniqueComptes = Array.from(new Set(plafonds.map((p) => p.compteCode)));

  // Get provinces for selected region
  const filteredProvinces = filterRegion
      ? provinces.filter(p => p.regionId === Number(filterRegion))
      : provinces;

  // Filter plafonds
  const filtered = filtersApplied
      ? plafonds.filter((p) => {
        const prov = provinces.find((pr) => pr.id === p.provinceId);
        const matchRegion = filterRegion
            ? prov?.regionId === Number(filterRegion)
            : true;
        const matchProvince = filterProvince
            ? p.provinceId === Number(filterProvince)
            : true;
        const matchCompte = filterCompte ? p.compteCode === filterCompte : true;
        return matchRegion && matchProvince && matchCompte;
      })
      : [];

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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-[#0A1A44]">
              <Settings className="h-6 w-6 text-[#1A3A8A]" />
              Plafonds Budgetaires
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerez les plafonds annuels et les encaissements par region et compte
            </p>
          </div>
          <div className="flex items-center gap-3">
            {user?.role === "ADMIN" && (
                <Button
                    onClick={() => {
                      setForm(emptyForm);
                      setEditingId(null);
                      setShowForm(true);
                    }}
                    className="bg-[#1A3A8A] text-white hover:bg-[#0A1A44]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau plafond
                </Button>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 text-[#1A3A8A]" />
              Le plafond annuel affiche le disponible actuel
            </div>
          </div>
        </div>

        {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
        )}

        {/* Filter Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#1A3A8A]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#0A1A44]">
              Filtrer les donnees
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Region
              </label>
              <select
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10 disabled:cursor-not-allowed disabled:opacity-60"
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
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Province
              </label>
              <select
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10"
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
          </div>
          <div className="mt-4 flex gap-3">
            <Button
                onClick={applyFilters}
                className="flex-1 bg-white text-[#0A1A44] border border-[#0A1A44] hover:bg-[#0A1A44] hover:text-white"
            >
              <Search className="mr-2 h-4 w-4" />
              Appliquer
            </Button>
            <Button
                onClick={resetFilters}
                variant="outline"
                className="flex-1"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reinitialiser
            </Button>
          </div>
        </div>

        {/* Plafonds Table */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-[#0A1A44] to-[#1A3A8A] px-6 py-4 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-4 w-4 text-white" />
              <h2 className="text-sm font-bold text-white">
                Plafonds configures
              </h2>
            </div>
            {filtersApplied && (
                <span className="rounded-full bg-[#D4AF37] px-3 py-1 text-xs font-semibold text-white">
              {filtered.length} resultats
            </span>
            )}
          </div>

          {!filtersApplied ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Filter className="mb-4 h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Aucun filtre applique
                </p>
              </div>
          ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Search className="mb-4 h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Aucun plafond trouve
                </p>
              </div>
          ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] border-separate border-spacing-0 text-sm">
                  <thead>
                  <tr className="bg-secondary/30">
                    <th className="h-12 border-b border-border px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Region
                    </th>
                    <th className="h-12 border-b border-border px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Compte
                    </th>
                    <th className="h-12 border-b border-border px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Libelle
                    </th>
                    <th className="h-12 border-b border-border px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Plafond Annuel
                    </th>
                    <th className="h-12 border-b border-border px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Disponible Rubrique
                    </th>
                    <th className="h-12 border-b border-border px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Encaissement
                    </th>
                    <th className="h-12 border-b border-border px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Max Facture
                    </th>
                    <th className="h-12 border-b border-border px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                  </thead>
                  <tbody>
                  {filtered.map((p, i) => (
                      <tr
                          key={p.id}
                          className={`border-b border-border/60 transition-colors hover:bg-secondary/20 ${
                              i % 2 === 0 ? "bg-white" : "bg-secondary/10"
                          }`}
                      >
                        <td className="h-14 px-4 font-medium text-[#1A3A8A]">
                          {p.provinceName}
                        </td>
                        <td className="h-14 px-4 font-mono text-sm text-foreground">
                          {p.compteCode}
                        </td>
                        <td className="h-14 px-4 text-foreground">{p.libelle}</td>
                        <td className="h-14 px-4 text-right font-semibold text-foreground">
                          {formatCurrency(p.budgetAnnuelInitial || 0)}
                        </td>
                        <td className="h-14 px-4 text-right font-semibold text-[#1A3A8A]">
                          {formatCurrency(p.plafondAnnuel)}
                        </td>
                        <td className="h-14 px-4 text-right font-semibold text-foreground">
                          {formatCurrency(p.plafondEncaissement)}
                        </td>
                        <td className="h-14 px-4 text-right font-semibold text-foreground">
                          {formatCurrency(p.plafondMaxFacture)}
                        </td>
                        <td className="h-14 px-4">
                          <div className="flex items-center justify-end gap-1">
                            {user?.role === "ADMIN" && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                    title="Modifier"
                                    onClick={() => handleEdit(p)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                            )}
                            {(user?.role === "ADMIN" || user?.role === "REGION") && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-3 text-xs text-[#059669] border-[#059669] hover:bg-[#059669] hover:text-white"
                                    title="Alimenter"
                                    onClick={() => setAvanceModal(p)}
                                >
                                  Alimenter
                                </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>
          )}
        </div>

        {/* Create/Edit Form Modal */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Modifier le plafond" : "Nouveau plafond"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-semibold">Province</Label>
                  <select
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      value={form.provinceId}
                      onChange={(e) =>
                          setForm({ ...form, provinceId: Number(e.target.value) })
                      }
                      required
                  >
                    <option value={0}>Selectionner...</option>
                    {provinces.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.regionName})
                        </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-semibold">Code compte</Label>
                  <Input
                      value={form.compteCode}
                      onChange={(e) =>
                          setForm({ ...form, compteCode: e.target.value })
                      }
                      placeholder="612111"
                      required
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-2">
                  <Label className="text-xs font-semibold">Libelle</Label>
                  <Input
                      value={form.libelle}
                      onChange={(e) =>
                          setForm({ ...form, libelle: e.target.value })
                      }
                      placeholder="Achats de matieres premieres"
                      required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-semibold">Plafond Annuel (DH)</Label>
                  <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.budgetAnnuelInitial}
                      onChange={(e) =>
                          setForm({ ...form, budgetAnnuelInitial: Number(e.target.value) })
                      }
                      placeholder="0.00"
                      required
                  />
                  <span className="text-[10px] text-muted-foreground">
                  Budget fixe de reference (ne change pas avec les alimentations)
                </span>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-semibold">Disponible Rubrique (DH)</Label>
                  <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.plafondAnnuel}
                      onChange={(e) =>
                          setForm({ ...form, plafondAnnuel: Number(e.target.value) })
                      }
                      placeholder="0.00"
                      required
                  />
                  <span className="text-[10px] text-muted-foreground">
                  Montant disponible pour cette rubrique
                </span>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-semibold">Encaissement (DH)</Label>
                  <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.plafondEncaissement}
                      onChange={(e) =>
                          setForm({ ...form, plafondEncaissement: Number(e.target.value) })
                      }
                      placeholder="0.00"
                      required
                  />
                  <span className="text-[10px] text-muted-foreground">
                  Montant actuellement disponible pour depenses
                </span>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-semibold">Max Facture (DH)</Label>
                  <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.plafondMaxFacture}
                      onChange={(e) =>
                          setForm({ ...form, plafondMaxFacture: Number(e.target.value) })
                      }
                      placeholder="0.00"
                      required
                  />
                  <span className="text-[10px] text-muted-foreground">
                  Montant maximum par transaction
                </span>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowForm(false)}
                >
                  Annuler
                </Button>
                <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#1A3A8A] text-white"
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? "Mettre a jour" : "Creer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Donner une Avance Modal */}
        <Dialog
            open={!!avanceModal}
            onOpenChange={() => setAvanceModal(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-[#1A3A8A]" />
                Donner une Avance
              </DialogTitle>
            </DialogHeader>
            {avanceModal && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Region
                  </span>
                      <span className="font-medium">{avanceModal.provinceName}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Compte
                  </span>
                      <span className="font-mono">{avanceModal.compteCode}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold">
                      Montant de l{"'"}Avance (DH) *
                    </Label>
                    <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={avanceForm.montant}
                        onChange={(e) =>
                            setAvanceForm({ ...avanceForm, montant: e.target.value })
                        }
                        required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold">N OP</Label>
                    <Input
                        placeholder="Numero OP"
                        value={avanceForm.op}
                        onChange={(e) =>
                            setAvanceForm({ ...avanceForm, op: e.target.value })
                        }
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold">Date OP</Label>
                    <Input
                        type="date"
                        value={avanceForm.dateOp}
                        onChange={(e) =>
                            setAvanceForm({ ...avanceForm, dateOp: e.target.value })
                        }
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold">N Cheque</Label>
                    <Input
                        placeholder="Numero cheque"
                        value={avanceForm.numCheque}
                        onChange={(e) =>
                            setAvanceForm({ ...avanceForm, numCheque: e.target.value })
                        }
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold">Date Cheque</Label>
                    <Input
                        type="date"
                        value={avanceForm.dateCheque}
                        onChange={(e) =>
                            setAvanceForm({ ...avanceForm, dateCheque: e.target.value })
                        }
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold">Commentaire</Label>
                    <textarea
                        className="h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10"
                        placeholder="Ajouter un commentaire (optionnel)"
                        value={avanceForm.commentaire}
                        onChange={(e) =>
                            setAvanceForm({ ...avanceForm, commentaire: e.target.value })
                        }
                    />
                  </div>

                  <div className="rounded-lg bg-[#1A3A8A]/5 p-3 text-xs text-muted-foreground">
                    <Info className="mb-1 inline h-3.5 w-3.5 text-[#1A3A8A]" /> Les
                    nouveaux plafonds seront calcules automatiquement
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setAvanceModal(null)}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Annuler
                    </Button>
                    <Button
                        onClick={handleAvance}
                        disabled={submitting || !avanceForm.montant}
                        className="bg-[#1A3A8A] text-white"
                    >
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="mr-2 h-4 w-4" />
                      Enregistrer
                    </Button>
                  </div>
                </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
  );
}
