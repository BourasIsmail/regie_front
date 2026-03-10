export interface Region {
  id: number;
  name: string;
}

export interface Province {
  id: number;
  name: string;
  regionId: number;
  regionName: string;
}

export interface User {
  id: number;
  email: string;
  role: string;
  regionId: number | null;
  regionName: string | null;
  provinceId: number | null;
  provinceName: string | null;
}

export interface PlafondRegie {
  id: number;
  provinceId: number;
  provinceName: string;
  compteCode: string;
  libelle: string;
  plafondAnnuel: number;
  plafondEncaissement: number;
  plafondMaxFacture: number;
}

export interface TransactionRegie {
  id: number;
  provinceId: number;
  provinceName: string;
  compteCode: string;
  montant: number;
  montantValide: number | null;
  statut: "EN_ATTENTE" | "CONFIRMEE" | "REJETEE";
  validatedBy: string | null;
  validatedAt: string | null;
  fournisseur: string | null;
  adresseFournisseur: string | null;
  factureNumero: string | null;
  factureDate: string | null;
  numeroAp: string | null;
  dateAp: string | null;
  moisAnnee: string | null;
  typeTransaction: string | null;
  description: string;
  dateTransaction: string;
  createdBy: string;
  createdAt: string;
}

export interface HistoriqueAlimentation {
  id: number;
  plafondId: number;
  compteCode: string;
  libelle: string;
  provinceId: number;
  provinceName: string;
  regionId: number;
  regionName: string;
  montantAlimentation: number;
  ancienDisponible: number;
  nouveauDisponible: number;
  ancienAvance: number;
  nouveauAvance: number;
  ancienEncaissement: number | null;
  nouveauEncaissement: number | null;
  ancienPlafondFixe: number | null;
  nouveauPlafondFixe: number | null;
  ancienPlafondAnnuel: number | null;
  nouveauPlafondAnnuel: number | null;
  typeOperation: string | null;
  op: string | null;
  dateOp: string | null;
  numCheque: string | null;
  dateCheque: string | null;
  commentaire: string | null;
  createdBy: string;
  createdAt: string;
}

export interface PlafondRegieRequest {
  provinceId: number;
  compteCode: string;
  libelle: string;
  plafondAnnuel: number;
  plafondEncaissement: number;
  plafondMaxFacture: number;
}

export interface TransactionRegieRequest {
  provinceId: number;
  compteCode: string;
  montant: number;
  fournisseur?: string;
  adresseFournisseur?: string;
  factureNumero?: string;
  factureDate?: string;
  numeroAp?: string;
  dateAp?: string;
  moisAnnee?: string;
  typeTransaction?: string;
  description?: string;
}

export interface AlimentationRequest {
  montant: number;
  op?: string;
  dateOp?: string;
  numCheque?: string;
  dateCheque?: string;
  commentaire?: string;
}

export interface UserUpdateRequest {
  email?: string;
  password?: string;
  role?: string;
  regionId?: number | null;
  provinceId?: number | null;
}
