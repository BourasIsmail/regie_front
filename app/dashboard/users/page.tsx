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
} from "lucide-react";

const ROLES = ["ADMIN", "REGION", "VIEW_REGION", "PROV", "BUDGET"];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "PROV",
    regionId: null as number | null,
    provinceId: null as number | null,
  });

  useEffect(() => {
    if (currentUser && currentUser.role !== "ADMIN") {
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
      setShowForm(false);
      setEditingId(null);
      setForm({
        email: "",
        password: "",
        role: "PROV",
        regionId: null,
        provinceId: null,
      });
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
    setShowForm(true);
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
                setShowForm(true);
              }}
              className="bg-gradient-to-r from-[#1A3A8A] to-[#0A1A44] text-white shadow-md hover:shadow-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouvel utilisateur
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
                    {editingId
                        ? "Modifier l'utilisateur"
                        : "Nouvel utilisateur"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {editingId
                        ? "Modifiez les informations du compte"
                        : "Creez un nouveau compte utilisateur"}
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
                    className="grid grid-cols-1 gap-4 md:grid-cols-2"
                >
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Email
                    </Label>
                    <Input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                            setForm({ ...form, email: e.target.value })
                        }
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
                      Role
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
                          Region
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
                          <option value="">Selectionner...</option>
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
                          <option value="">Selectionner...</option>
                          {provincesForRegion.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                          ))}
                        </select>
                      </div>
                  )}
                  <div className="flex items-end md:col-span-2">
                    <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-gradient-to-r from-[#1A3A8A] to-[#0A1A44] text-white"
                    >
                      {submitting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {editingId ? "Mettre a jour" : "Creer le compte"}
                    </Button>
                  </div>
                </form>
              </div>
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
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Aucun utilisateur trouve
                </p>
            ) : (
                <table className="w-full min-w-[700px] border-separate border-spacing-0 text-sm">
                  <thead>
                  <tr className="bg-gradient-to-r from-[#0A1A44] to-[#1A3A8A]">
                    <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white">
                      Email
                    </th>
                    <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white">
                      Role
                    </th>
                    <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white">
                      Region
                    </th>
                    <th className="h-12 border-r border-white/10 px-4 text-left text-[11.5px] font-semibold uppercase tracking-widest text-white">
                      Province
                    </th>
                    <th className="h-12 px-4 text-right text-[11.5px] font-semibold uppercase tracking-widest text-white">
                      Actions
                    </th>
                  </tr>
                  </thead>
                  <tbody>
                  {filtered.map((u, i) => (
                      <tr
                          key={u.id}
                          className={`border-b border-border/60 transition-colors hover:bg-secondary/40 ${
                              i % 2 === 0 ? "bg-card" : "bg-secondary/20"
                          }`}
                      >
                        <td className="h-14 px-4 font-medium text-foreground">
                          {u.email}
                        </td>
                        <td className="h-14 px-4">
                      <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getRoleBadge(u.role)}`}
                      >
                        {u.role}
                      </span>
                        </td>
                        <td className="h-14 px-4 text-muted-foreground">
                          {u.regionName || "-"}
                        </td>
                        <td className="h-14 px-4 text-muted-foreground">
                          {u.provinceName || "-"}
                        </td>
                        <td className="h-14 px-4">
                          <div className="flex items-center justify-end gap-1">
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
                          </div>
                        </td>
                      </tr>
                  ))}
                  </tbody>
                </table>
            )}
          </div>
        </div>
      </div>
  );
}
