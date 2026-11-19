"use client";

import { usePathname } from "next/navigation";
import { CalendarRange, Lock } from "lucide-react";
import { useExercice } from "@/lib/exercice-context";

const HIDDEN_ON = ["/dashboard/users", "/dashboard/settings"];

/** Exercice selector shown on every data page. */
export function ExerciceBar() {
  const pathname = usePathname();
  const { exercice, setExercice, annees, readOnly, info, ready } = useExercice();

  if (HIDDEN_ON.some((p) => pathname?.startsWith(p))) return null;
  if (!ready) return null;

  const canPick = annees.length > 1;
  const someClosed =
    !readOnly &&
    (info?.provinces ?? []).some((p) => p.exerciceCourant > exercice);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
      {readOnly && (
        <span className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          <Lock className="h-3.5 w-3.5" />
          Exercice {exercice} clôturé — consultation en lecture seule
        </span>
      )}
      {someClosed && (
        <span className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          <Lock className="h-3.5 w-3.5" />
          Certaines provinces ont clôturé l&apos;exercice {exercice} (lecture seule)
        </span>
      )}
      <label className="flex items-center gap-2 text-sm font-medium">
        <CalendarRange className="h-4 w-4 text-muted-foreground" />
        Exercice
        {canPick ? (
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={exercice}
            onChange={(e) => setExercice(Number(e.target.value))}
          >
            {annees.map((a) => (
              <option key={a} value={a}>
                {a}
                {(info?.provinces ?? []).some((p) => p.exerciceCourant === a)
                  ? " (en cours)"
                  : " (clôturé)"}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-md border border-input bg-muted/40 px-3 py-1.5 text-sm">{exercice}</span>
        )}
      </label>
    </div>
  );
}
