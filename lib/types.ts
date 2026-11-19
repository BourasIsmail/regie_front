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
  budgetAnnuelInitial: number | null;
  plafondEncaissement: number;
  plafondMaxFacture: number;
  exercice?: number;
  cloture?: boolean;
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
  motifRejet: string | null;
  disponibleAnnuelSnapshot: number | null;
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
  exercice?: number;
  cloture?: boolean;
}

/** One entry of the journal: every operation, with before/after details. */
export interface JournalEntry {
  id: number;
  entite: string; // PLAFOND | TRANSACTION | VERSEMENT | EXERCICE | UTILISATEUR | REGION | PROVINCE
  action: string;
  entiteId: number | null;
  exercice: number | null;
  provinceId: number | null;
  provinceName: string | null;
  regionId: number | null;
  regionName: string | null;
  plafondId: number | null;
  compteCode: string | null;
  libelle: string | null;
  montant: number | null;
  ancienEncaissement: number | null;
  nouveauEncaissement: number | null;
  ancienPlafondAnnuel: number | null;
  nouveauPlafondAnnuel: number | null;
  op: string | null;
  dateOp: string | null;
  numCheque: string | null;
  dateCheque: string | null;
  commentaire: string | null;
  details: string | null; // JSON: [{champ, avant, apres}]
  createdBy: string;
  createdAt: string;
}

export interface JournalDetail {
  champ: string;
  avant: string | null;
  apres: string | null;
}

export type HistoriqueAlimentation = JournalEntry;

export interface ProvinceExercice {
  provinceId: number;
  provinceName: string;
  regionId: number | null;
  exerciceCourant: number;
  clotures: { annee: number; cloturePar: string; clotureLe: string }[];
}

export interface ExerciceInfo {
  exerciceCourant: number;
  annees: number[];
  peutConsulterClotures: boolean;
  peutCloturer: boolean;
  provinces: ProvinceExercice[];
}

export interface CloturePrecheck {
  provinceId: number;
  provinceName: string;
  annee: number;
  cloturable: boolean;
  blocages: string[];
}

export interface PlafondRegieRequest {
  provinceId: number;
  compteCode: string;
  libelle: string;
  plafondAnnuel: number;
  budgetAnnuelInitial?: number;
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

export interface SituationRow {
  plafondId: number;
  provinceId: number;
  dp: string;
  regionId: number;
  dr: string;
  compteCode: string;
  libelle: string;
  plafondGlobal: number; // (I)
  avance: number; // (II)
  disponibleRubrique: number; // (III = I - II)
  disponibleEncaisse: number;
  depenses: number; // (IV)
  versement: number;
  solde: number; // (V = II - IV - versement)
  cloture?: boolean;
}

export interface SituationResponse {
  exercice: number;
  arreteAu: string;
  rows: SituationRow[];
  totals: Omit<SituationRow, "plafondId" | "provinceId" | "dp" | "regionId" | "dr" | "compteCode" | "libelle" | "cloture">;
}

export interface Versement {
  id: number;
  plafondId: number;
  provinceId: number;
  provinceName: string;
  compteCode: string;
  montant: number;
  dateVersement: string;
  reference: string | null;
  commentaire: string | null;
  createdBy: string;
  createdAt: string;
  type: "VERSEMENT" | "ANNULATION";
  exercice?: number;
  cloture?: boolean;
}

export interface VersementRequest {
  montant: number;
  dateVersement?: string;
  reference?: string;
  commentaire?: string;
  type?: "VERSEMENT" | "ANNULATION";
}
