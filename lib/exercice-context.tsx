"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { exercicesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ExerciceInfo } from "@/lib/types";

interface ExerciceContextType {
  /** Selected exercice (defaults to the current exercice). Only meaningful when `ready`. */
  exercice: number;
  setExercice: (year: number) => void;
  ready: boolean;
  info: ExerciceInfo | null;
  /** Years the user can pick (current one + closed ones when allowed). */
  annees: number[];
  /** True when the selected exercice is not the current exercice of any visible province. */
  readOnly: boolean;
  /** True when this province has already closed the selected exercice (or it is not its current one). */
  isClosedFor: (provinceId: number | null | undefined) => boolean;
  /** True when the user may create / edit data of the selected exercice for this province. */
  isEditableFor: (provinceId: number | null | undefined) => boolean;
  refresh: () => Promise<void>;
}

const ExerciceContext = createContext<ExerciceContextType | undefined>(undefined);

const STORAGE_KEY = "regie_exercice";

export function ExerciceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [info, setInfo] = useState<ExerciceInfo | null>(null);
  const [exercice, setExerciceState] = useState<number>(new Date().getFullYear());
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await exercicesApi.info();
      setInfo(data);
      let selected = data.exerciceCourant;
      try {
        const stored = Number(sessionStorage.getItem(STORAGE_KEY));
        if (stored && data.annees.includes(stored)) selected = stored;
      } catch {
        /* sessionStorage unavailable */
      }
      const first = !initialized.current;
      initialized.current = true;
      setExerciceState((prev) => (!first && data.annees.includes(prev) ? prev : selected));
    } catch {
      setInfo(null);
      setExerciceState(new Date().getFullYear());
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  const setExercice = useCallback((year: number) => {
    setExerciceState(year);
    try {
      sessionStorage.setItem(STORAGE_KEY, String(year));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ExerciceContextType>(() => {
    const provinces = info?.provinces ?? [];
    const currentOf = (id: number | null | undefined) =>
      provinces.find((p) => p.provinceId === id)?.exerciceCourant;
    return {
      exercice,
      setExercice,
      ready,
      info,
      annees: info?.annees ?? [exercice],
      readOnly: provinces.length > 0 && !provinces.some((p) => p.exerciceCourant === exercice),
      isClosedFor: (id) => {
        const cur = currentOf(id);
        return cur !== undefined && exercice !== cur;
      },
      isEditableFor: (id) => {
        const cur = currentOf(id);
        return cur === undefined ? provinces.length === 0 : exercice === cur;
      },
      refresh: load,
    };
  }, [info, exercice, ready, setExercice, load]);

  return <ExerciceContext.Provider value={value}>{children}</ExerciceContext.Provider>;
}

export function useExercice() {
  const ctx = useContext(ExerciceContext);
  if (!ctx) throw new Error("useExercice must be used within an ExerciceProvider");
  return ctx;
}
