"use client";

import React from "react";

import { useEffect, useState, useCallback } from "react";
import {
  usersApi,
  regionsApi,
  provincesApi,
  authApi,
  ApiError,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import type { User, Region, Province } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Users,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ROLES = ["ADMIN", "ADMIN_VIEW", "REGION", "VIEW_REGION", "PROV", "BUDGET"];
const ITEMS_PER_PAGE = 10;

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "PROV",
    regionId: null as number | null,
    provinceId: null as number | null,
  });

  useEffect(() => {
    if (currentUser && currentUser.role !== "ADMIN" && currentUser.role !== "ADMIN_VIEW") {
      router.push("/dashboard");
    }
  }, [currentUser, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, regionsData, provincesData] = await Promise.all([
        usersApi.getAll(),
        regionsApi.getAll(),
        provincesApi.getAll(),
      ]);
      setUsers(usersData);
      setRegions(regionsData);
      setProvinces(provincesData);
    } catch {
      setError("Erreur lors du chargement des utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const provincesForRegion = form.regionId
      ? provinces.filter((p) => p.regionId === form.regionId)
      : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (editingId) {
        const updateData: Record<string, unknown> = {
          email: form.email,
          role: form.role,
          regionId: form.regionId,
          provinceId: form.provinceId,
        };
        if (form.password) {
          updateData.password = form.password;
        }
        await usersApi.update(editingId, updateData);
      } else {
        await authApi.register({
          email: form.email,
          password: form.password,
          role: form.role,
          regionId: form.regionId ?? undefined,
          provinceId: form.provinceId ?? undefined,
        });
      }
      setShowModal(false);
      setEditingId(null);
      setForm({
        email: "",
        password: "",
        role: "PROV",
        regionId: null,
        provinceId: null,
      });
      setCurrentPage(1);
      await fetchData();
    } catch (err) {
      setError(
          err instanceof ApiError ? err.message : "Erreur lors de la sauvegarde."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (u: User) => {
    setForm({
      email: u.email,
      password: "",
      role: u.role,
      regionId: u.regionId,
      provinceId: u.provinceId,
    });
    setEditingId(u.id);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    try {
      await usersApi.delete(id);
      await fetchData();
    } catch (err) {
      setError(
          err instanceof ApiError
              ? err.message
              : "Erreur lors de la suppression."
      );
    }
  };

  const filtered = users.filter(
      (u) =>
          u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (u.regionName?.toLowerCase() || "").includes(
              searchTerm.toLowerCase()
          ) ||
          (u.provinceName?.toLowerCase() || "").includes(
              searchTerm.toLowerCase()
          )
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-[#1A3A8A]/10 text-[#1A3A8A]";
      case "REGION":
        return "bg-[#D4AF37]/10 text-[#D4AF37]";
      case "VIEW_REGION":
        return "bg-[#6366F1]/10 text-[#6366F1]";
      case "PROV":
        return "bg-[#059669]/10 text-[#059669]";
      default:
        return "bg-secondary text-muted-foreground";
    }
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

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedUsers = filtered.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
  );

  return (
      <div className="flex flex-col gap-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0A1A44]">
              Utilisateurs
            </h1>
            <p className="mt-1 text-base text-muted-foreground">
              Gestion des comptes utilisateurs
            </p>
          </div>
          {currentUser?.role !== "ADMIN_VIEW" && (
              <Button
                  onClick={() => {
                    setForm({
                      email: "",
                      password: "",
                      role: "PROV",
                      regionId: null,
                      provinceId: null,
                    });
                    setEditingId(null);
                    setShowModal(true);
                  }}
                  className="bg-gradient-to-r from-[#1A3A8A] to-[#0A1A44] text-white shadow-md hover:shadow-lg"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nouvel utilisateur
              </Button>
          )}
        </div>

        {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
        )}

        {/* Users Table */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-[#0A1A44]/[0.02] to-transparent px-7 py-4">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-[#1A3A8A]" />
              <h2 className="text-sm font-bold tracking-tight text-[#0A1A44]">
                Utilisateurs ({filtered.length})
              </h2>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {paginatedUsers.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {filtered.length === 0 ? "Aucun utilisateur trouvé" : "Aucun utilisateur sur cette page"}
                </p>
            ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-[#0A1A44] to-[#1A3A8A]">
                      <TableHead className="text-white">Email</TableHead>
                      <TableHead className="text-white">Rôle</TableHead>
                      <TableHead className="text-white">Région</TableHead>
                      <TableHead className="text-white">Province</TableHead>
                      <TableHead className="text-right text-white">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((u) => (
                        <TableRow key={u.id} className="hover:bg-secondary/40">
                          <TableCell className="font-medium">{u.email}</TableCell>
                          <TableCell>
                      <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getRoleBadge(u.role)}`}
                      >
                        {u.role}
                      </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {u.regionName || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {u.provinceName || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {currentUser?.role !== "ADMIN_VIEW" && (
                                  <>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                        onClick={() => handleEdit(u)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDelete(u.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/60 bg-gradient-to-r from-[#0A1A44]/[0.02] to-transparent px-7 py-4">
                <p className="text-xs text-muted-foreground">
                  Page {currentPage} sur {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
          )}
        </div>

        {/* User Form Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Email
                </Label>
                <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="utilisateur@exemple.ma"
                    required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Mot de passe
                  {editingId ? " (laisser vide pour conserver)" : ""}
                </Label>
                <Input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                    }
                    placeholder={
                      editingId ? "Nouveau mot de passe" : "Mot de passe"
                    }
                    required={!editingId}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Rôle
                </Label>
                <select
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10"
                    value={form.role}
                    onChange={(e) =>
                        setForm({
                          ...form,
                          role: e.target.value,
                          regionId: null,
                          provinceId: null,
                        })
                    }
                    required
                >
                  {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                  ))}
                </select>
              </div>

              {(form.role === "REGION" || form.role === "VIEW_REGION" || form.role === "PROV") && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Région
                    </Label>
                    <select
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10"
                        value={form.regionId ?? ""}
                        onChange={(e) =>
                            setForm({
                              ...form,
                              regionId: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              provinceId: null,
                            })
                        }
                        required
                    >
                      <option value="">Sélectionner...</option>
                      {regions.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                      ))}
                    </select>
                  </div>
              )}

              {form.role === "PROV" && form.regionId && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Province
                    </Label>
                    <select
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium focus:border-[#1A3A8A] focus:outline-none focus:ring-2 focus:ring-[#1A3A8A]/10"
                        value={form.provinceId ?? ""}
                        onChange={(e) =>
                            setForm({
                              ...form,
                              provinceId: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                            })
                        }
                        required
                    >
                      <option value="">Sélectionner...</option>
                      {provincesForRegion.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                      ))}
                    </select>
                  </div>
              )}

              <div className="flex gap-2 md:col-span-2">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowModal(false);
                      setEditingId(null);
                    }}
                >
                  Annuler
                </Button>
                <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-gradient-to-r from-[#1A3A8A] to-[#0A1A44] text-white"
                >
                  {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {editingId ? "Mettre à jour" : "Créer le compte"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
  );
}
