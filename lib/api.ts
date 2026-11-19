import { getCookie, setCookie, removeCookie } from "@/lib/cookies";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ?? "https://services.entraide.ma/api/api";

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(
    endpoint: string,
    options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const token = typeof window !== "undefined" ? getCookie("accessToken") : null;

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = getCookie("accessToken");
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${newToken}`,
      } as Record<string, string>;
      const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, config);
      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({}));
        throw new ApiError(
            retryResponse.status,
            error.message || "Request failed"
        );
      }
      if (retryResponse.status === 204 || retryResponse.headers.get("content-length") === "0") {
        return undefined as T;
      }
      return retryResponse.json();
    }
    if (typeof window !== "undefined") {
      removeCookie("accessToken");
      removeCookie("refreshToken");
      removeCookie("user");
      window.location.href = "/login";
    }
    throw new ApiError(401, "Session expired");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.message || "Request failed");
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return response.json();
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getCookie("refreshToken");
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    setCookie("accessToken", data.accessToken, 1);
    setCookie("refreshToken", data.refreshToken, 7);
    return true;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

import type {
  Region,
  Province,
  User,
  PlafondRegie,
  PlafondRegieRequest,
  TransactionRegie,
  TransactionRegieRequest,
  JournalEntry,
  ExerciceInfo,
  CloturePrecheck,
  AlimentationRequest,
  UserUpdateRequest,
  SituationResponse,
  Versement,
  VersementRequest,
} from "@/lib/types";

const q = (exercice?: number) => (exercice ? `?exercice=${exercice}` : "");

// ========================
// Regions API (accessible by all authenticated users)
// ========================
export const regionsApi = {
  getAll: () => apiRequest<Region[]>("/regions"),
  getById: (id: number) => apiRequest<Region>(`/regions/${id}`),
  // Admin only methods
  create: (data: { name: string }) =>
      apiRequest<Region>("/admin/regions", { method: "POST", body: data }),
  update: (id: number, data: { name: string }) =>
      apiRequest<Region>(`/admin/regions/${id}`, { method: "PUT", body: data }),
  delete: (id: number) =>
      apiRequest<void>(`/admin/regions/${id}`, { method: "DELETE" }),
};

// ========================
// Provinces API (accessible by all authenticated users)
// ========================
export const provincesApi = {
  getAll: () => apiRequest<Province[]>("/provinces"),
  getById: (id: number) => apiRequest<Province>(`/provinces/${id}`),
  getByRegion: (regionId: number) =>
      apiRequest<Province[]>(`/provinces/region/${regionId}`),
  // Admin only methods
  create: (data: { name: string; regionId: number }) =>
      apiRequest<Province>("/admin/provinces", { method: "POST", body: data }),
  update: (id: number, data: { name: string; regionId: number }) =>
      apiRequest<Province>(`/admin/provinces/${id}`, { method: "PUT", body: data }),
  delete: (id: number) =>
      apiRequest<void>(`/admin/provinces/${id}`, { method: "DELETE" }),
};

// ========================
// Users API (Admin)
// ========================
export const usersApi = {
  getAll: () => apiRequest<User[]>("/admin/users"),
  getById: (id: number) => apiRequest<User>(`/admin/users/${id}`),
  update: (id: number, data: UserUpdateRequest) =>
      apiRequest<User>(`/admin/users/${id}`, { method: "PUT", body: data }),
  delete: (id: number) =>
      apiRequest<void>(`/admin/users/${id}`, { method: "DELETE" }),
};

// ========================
// Plafonds API
// ========================
export const plafondsApi = {
  getAll: (exercice?: number) => apiRequest<PlafondRegie[]>(`/plafonds${q(exercice)}`),
  getById: (id: number) => apiRequest<PlafondRegie>(`/plafonds/${id}`),
  getByProvince: (provinceId: number, exercice?: number) =>
      apiRequest<PlafondRegie[]>(`/plafonds/province/${provinceId}${q(exercice)}`),
  getByRegion: (regionId: number, exercice?: number) =>
      apiRequest<PlafondRegie[]>(`/plafonds/region/${regionId}${q(exercice)}`),
  create: (data: PlafondRegieRequest) =>
      apiRequest<PlafondRegie>("/plafonds", { method: "POST", body: data }),
  update: (id: number, data: PlafondRegieRequest) =>
      apiRequest<PlafondRegie>(`/plafonds/${id}`, { method: "PUT", body: data }),
  delete: (id: number) =>
      apiRequest<void>(`/plafonds/${id}`, { method: "DELETE" }),
  alimenter: (id: number, data: AlimentationRequest) =>
      apiRequest<PlafondRegie>(`/plafonds/${id}/alimenter`, {
        method: "POST",
        body: data,
      }),
  corriger: (id: number, data: { nouveauEncaissement: number; motif: string }) =>
      apiRequest<PlafondRegie>(`/plafonds/${id}/corriger?nouveauEncaissement=${data.nouveauEncaissement}&motif=${encodeURIComponent(data.motif)}`, {
        method: "POST",
      }),
};

// ========================
// Transactions API
// ========================
export const transactionsApi = {
  getAll: (exercice?: number) => apiRequest<TransactionRegie[]>(`/transactions${q(exercice)}`),
  getById: (id: number) => apiRequest<TransactionRegie>(`/transactions/${id}`),
  getByProvince: (provinceId: number, exercice?: number) =>
      apiRequest<TransactionRegie[]>(`/transactions/province/${provinceId}${q(exercice)}`),
  getByRegion: (regionId: number, exercice?: number) =>
      apiRequest<TransactionRegie[]>(`/transactions/region/${regionId}${q(exercice)}`),
  create: (data: TransactionRegieRequest) =>
      apiRequest<TransactionRegie>("/transactions", { method: "POST", body: data }),
  update: (id: number, data: TransactionRegieRequest) =>
      apiRequest<TransactionRegie>(`/transactions/${id}`, {
        method: "PUT",
        body: data,
      }),
  delete: (id: number) =>
      apiRequest<void>(`/transactions/${id}`, { method: "DELETE" }),
  confirm: (id: number, montantValide: number) =>
      apiRequest<TransactionRegie>(`/transactions/${id}/confirm?montantValide=${montantValide}`, {
        method: "POST",
      }),
  reject: (id: number, motif?: string) =>
      apiRequest<TransactionRegie>(`/transactions/${id}/reject${motif ? `?motif=${encodeURIComponent(motif)}` : ""}`, { method: "POST" }),
};

// ========================
// Historique Alimentations API
// ========================
export const historiqueApi = {
  getAll: (exercice?: number) => apiRequest<JournalEntry[]>(`/historique${q(exercice)}`),
  getById: (id: number) => apiRequest<JournalEntry>(`/historique/${id}`),
  getByPlafond: (plafondId: number, exercice?: number) =>
      apiRequest<JournalEntry[]>(`/historique/plafond/${plafondId}${q(exercice)}`),
  getByProvince: (provinceId: number, exercice?: number) =>
      apiRequest<JournalEntry[]>(`/historique/province/${provinceId}${q(exercice)}`),
  getByRegion: (regionId: number, exercice?: number) =>
      apiRequest<JournalEntry[]>(`/historique/region/${regionId}${q(exercice)}`),
};

// ========================
// Situation des regies API
// ========================
export const situationApi = {
  get: (exercice?: number, arreteAu?: string) => {
    const params = new URLSearchParams();
    if (exercice) params.set("exercice", String(exercice));
    if (arreteAu) params.set("arreteAu", arreteAu);
    const qs = params.toString();
    return apiRequest<SituationResponse>(`/situation${qs ? `?${qs}` : ""}`);
  },
};

// ========================
// Versements API
// ========================
export const versementsApi = {
  getAll: (plafondId?: number, exercice?: number) => {
    const params = new URLSearchParams();
    if (plafondId) params.set("plafondId", String(plafondId));
    if (exercice) params.set("exercice", String(exercice));
    const qs = params.toString();
    return apiRequest<Versement[]>(`/versements${qs ? `?${qs}` : ""}`);
  },
  create: (plafondId: number, data: VersementRequest) =>
      apiRequest<Versement>(`/versements/plafond/${plafondId}`, { method: "POST", body: data }),
  delete: (id: number) =>
      apiRequest<void>(`/versements/${id}`, { method: "DELETE" }),
};

// ========================
// Exercices API (selector + cloture)
// ========================
export const exercicesApi = {
  info: () => apiRequest<ExerciceInfo>("/exercices"),
  precheck: (provinceId: number, annee: number) =>
      apiRequest<CloturePrecheck>(`/admin/exercices/precheck?provinceId=${provinceId}&annee=${annee}`),
  cloturer: (provinceId: number, annee: number) =>
      apiRequest<CloturePrecheck>("/admin/exercices/cloturer", {
        method: "POST",
        body: { provinceId, annee },
      }),
};

// ========================
// Auth API
// ========================
export const authApi = {
  login: (email: string, password: string) =>
      apiRequest<{
        accessToken: string;
        refreshToken: string;
        id: number;
        email: string;
        role: string;
        regionId: number | null;
        regionName: string | null;
        provinceId: number | null;
        provinceName: string | null;
      }>("/auth/login", {
        method: "POST",
        body: { email, password },
      }),

  register: (data: {
    email: string;
    password: string;
    role: string;
    regionId?: number;
    provinceId?: number;
  }) =>
      apiRequest<{
        accessToken: string;
        refreshToken: string;
        id: number;
        email: string;
        role: string;
        regionId: number | null;
        regionName: string | null;
        provinceId: number | null;
        provinceName: string | null;
      }>("/auth/register", {
        method: "POST",
        body: data,
      }),

  changePassword: (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) =>
      apiRequest<{ message: string }>("/auth/change-password", {
        method: "POST",
        body: data,
      }),
};
