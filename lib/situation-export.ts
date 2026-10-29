import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface SituationRow {
    key: string;
    dr: string;
    dp: string;
    compteCode: string;
    plafondGlobal: number; // (I)
    avance: number; // (II)
    disponibleRubrique: number; // (III = I - II)
    disponibleEncaisse: number;
    depenses: number; // (IV)
    versement: number;
    solde: number; // (V = II - IV)
}

export const SITUATION_HEADERS = [
    "DR",
    "DP",
    "N° compte de régie",
    "Plafond annuel global (I)",
    "Total Avance / Direction (II)",
    "Disponible Par Rubrique (III=I-II)",
    "Disponible Encaisse",
    "Total des Dépenses (IV)",
    "Versement",
    "Solde (V=II-IV)",
];

export function computeTotals(rows: SituationRow[]) {
    const sum = (f: (r: SituationRow) => number) => rows.reduce((s, r) => s + f(r), 0);
    return {
        plafondGlobal: sum((r) => r.plafondGlobal),
        avance: sum((r) => r.avance),
        disponibleRubrique: sum((r) => r.disponibleRubrique),
        disponibleEncaisse: sum((r) => r.disponibleEncaisse),
        depenses: sum((r) => r.depenses),
        versement: sum((r) => r.versement),
        solde: sum((r) => r.solde),
    };
}

function amount(v: number) {
    // Espaces simples pour rester lisible dans jsPDF (les espaces insécables s'affichent mal)
    return v
        .toFixed(2)
        .replace(".", ",")
        .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatDateFr(iso: string) {
    const [y, m, d] = iso.split("-");
    return y && m && d ? `${d}/${m}/${y}` : "";
}

function numbers(r: Omit<SituationRow, "key" | "dr" | "dp" | "compteCode">) {
    return [
        r.plafondGlobal,
        r.avance,
        r.disponibleRubrique,
        r.disponibleEncaisse,
        r.depenses,
        r.versement,
        r.solde,
    ];
}

async function loadLogo(): Promise<{ dataUrl: string; ratio: number } | null> {
    try {
        const res = await fetch("/logo-entraide.png");
        if (!res.ok) return null;
        const blob = await res.blob();
        const dataUrl: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        const ratio: number = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img.width / img.height);
            img.onerror = () => resolve(687 / 91);
            img.src = dataUrl;
        });
        return { dataUrl, ratio };
    } catch {
        return null;
    }
}

export async function exportSituationPdf(
    rows: SituationRow[],
    exercice: number,
    arreteAu: string
) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const totals = computeTotals(rows);
    const logo = await loadLogo();

    const drawHeader = () => {
        if (logo) {
            const w = 90;
            doc.addImage(logo.dataUrl, "PNG", (pageWidth - w) / 2, 6, w, w / logo.ratio);
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text("SITUATION DES REGIES DE DEPENSES", pageWidth / 2, 28, { align: "center" });
        doc.setFontSize(10);
        doc.text(`( Exercice ${exercice} )`, pageWidth / 2, 33, { align: "center" });
        doc.text(
            `ARRETEE AU ${arreteAu ? formatDateFr(arreteAu) : "......................"}`,
            pageWidth / 2,
            38,
            { align: "center" }
        );
    };

    autoTable(doc, {
        head: [SITUATION_HEADERS],
        body: rows.map((r) => [r.dr, r.dp, r.compteCode, ...numbers(r).map(amount)]),
        foot: [
            [
                { content: "TOTAUX", colSpan: 3, styles: { halign: "center" } },
                ...numbers(totals).map(amount),
            ],
        ],
        startY: 41,
        margin: { top: 41, left: 8, right: 8, bottom: 10 },
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 1, lineColor: [150, 150, 150], lineWidth: 0.1, textColor: 0 },
        headStyles: { fillColor: [255, 255, 0], textColor: 0, fontStyle: "bold", halign: "center", valign: "middle" },
        footStyles: { fillColor: [255, 255, 0], textColor: 0, fontStyle: "bold" },
        columnStyles: {
            0: { fontStyle: "italic" },
            1: { fontStyle: "bold" },
            2: { fontStyle: "bold" },
            3: { halign: "right" },
            4: { halign: "right", fillColor: [144, 238, 144] },
            5: { halign: "right" },
            6: { halign: "right" },
            7: { halign: "right", fillColor: [238, 170, 238] },
            8: { halign: "right" },
            9: { halign: "right", fontStyle: "bold" },
        },
        showFoot: "lastPage",
        didDrawPage: drawHeader,
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(
            `Page ${i} / ${pages}`,
            pageWidth - 8,
            doc.internal.pageSize.getHeight() - 4,
            { align: "right" }
        );
    }

    doc.save(`situation-regies-${exercice}.pdf`);
}

export async function exportSituationExcel(
    rows: SituationRow[],
    exercice: number,
    arreteAu: string
) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Situation", {
        views: [{ state: "frozen", ySplit: 5 }],
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const totals = computeTotals(rows);
    const cols = SITUATION_HEADERS.length;

    ws.getColumn(1).width = 16;
    ws.getColumn(2).width = 24;
    ws.getColumn(3).width = 14;
    for (let c = 4; c <= cols; c++) ws.getColumn(c).width = 18;

    const title = (row: number, text: string, size: number) => {
        ws.mergeCells(row, 1, row, cols);
        const cell = ws.getCell(row, 1);
        cell.value = text;
        cell.font = { bold: true, size };
        cell.alignment = { horizontal: "center", vertical: "middle" };
    };
    title(1, "SITUATION DES REGIES DE DEPENSES", 14);
    title(2, `( Exercice ${exercice} )`, 11);
    title(3, `ARRETEE AU ${arreteAu ? formatDateFr(arreteAu) : "......................"}`, 11);

    const border = {
        top: { style: "thin" as const },
        left: { style: "thin" as const },
        bottom: { style: "thin" as const },
        right: { style: "thin" as const },
    };
    const yellow = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFF00" } };
    const green = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF90EE90" } };
    const pink = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEEAAEE" } };

    const header = ws.getRow(5);
    SITUATION_HEADERS.forEach((h, i) => {
        const cell = header.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true };
        cell.fill = yellow;
        cell.border = border;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    header.height = 36;

    const numFmt = "#,##0.00";
    rows.forEach((r, idx) => {
        const row = ws.getRow(6 + idx);
        row.values = [r.dr, r.dp, r.compteCode, ...numbers(r)];
        for (let c = 1; c <= cols; c++) {
            const cell = row.getCell(c);
            cell.border = border;
            if (c >= 4) cell.numFmt = numFmt;
        }
        row.getCell(1).font = { italic: true };
        row.getCell(2).font = { bold: true };
        row.getCell(3).font = { bold: true };
        row.getCell(5).fill = green;
        row.getCell(8).fill = pink;
        row.getCell(10).font = { bold: true };
    });

    const totalRow = ws.getRow(6 + rows.length);
    totalRow.values = ["TOTAUX", "", "", ...numbers(totals)];
    ws.mergeCells(totalRow.number, 1, totalRow.number, 3);
    for (let c = 1; c <= cols; c++) {
        const cell = totalRow.getCell(c);
        cell.fill = yellow;
        cell.font = { bold: true };
        cell.border = border;
        if (c >= 4) cell.numFmt = numFmt;
    }
    totalRow.getCell(1).alignment = { horizontal: "center" };

    ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + rows.length, column: cols } };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `situation-regies-${exercice}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}
