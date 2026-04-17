import { jsPDF } from "jspdf";

// Convert number to French words
function numberToFrenchWords(num: number): string {
    const units = [
        "",
        "UN",
        "DEUX",
        "TROIS",
        "QUATRE",
        "CINQ",
        "SIX",
        "SEPT",
        "HUIT",
        "NEUF",
        "DIX",
        "ONZE",
        "DOUZE",
        "TREIZE",
        "QUATORZE",
        "QUINZE",
        "SEIZE",
        "DIX-SEPT",
        "DIX-HUIT",
        "DIX-NEUF",
    ];
    const tens = [
        "",
        "",
        "VINGT",
        "TRENTE",
        "QUARANTE",
        "CINQUANTE",
        "SOIXANTE",
        "SOIXANTE",
        "QUATRE-VINGT",
        "QUATRE-VINGT",
    ];

    if (num === 0) return "ZERO";
    if (num < 0) return "MOINS " + numberToFrenchWords(-num);

    let words = "";

    // Billions
    if (num >= 1000000000) {
        const billions = Math.floor(num / 1000000000);
        words += numberToFrenchWords(billions) + " MILLIARD";
        if (billions > 1) words += "S";
        num %= 1000000000;
        if (num > 0) words += " ";
    }

    // Millions
    if (num >= 1000000) {
        const millions = Math.floor(num / 1000000);
        words += numberToFrenchWords(millions) + " MILLION";
        if (millions > 1) words += "S";
        num %= 1000000;
        if (num > 0) words += " ";
    }

    // Thousands
    if (num >= 1000) {
        const thousands = Math.floor(num / 1000);
        if (thousands === 1) {
            words += "MILLE";
        } else {
            words += numberToFrenchWords(thousands) + " MILLE";
        }
        num %= 1000;
        if (num > 0) words += " ";
    }

    // Hundreds
    if (num >= 100) {
        const hundreds = Math.floor(num / 100);
        if (hundreds === 1) {
            words += "CENT";
        } else {
            words += units[hundreds] + " CENT";
            if (num % 100 === 0 && hundreds > 1) words += "S";
        }
        num %= 100;
        if (num > 0) words += " ";
    }

    // Tens and units
    if (num > 0) {
        if (num < 20) {
            words += units[num];
        } else {
            const ten = Math.floor(num / 10);
            const unit = num % 10;

            if (ten === 7 || ten === 9) {
                // 70s and 90s
                words += tens[ten];
                if (unit === 1 && ten === 7) {
                    words += " ET ONZE";
                } else {
                    words += "-" + units[10 + unit];
                }
            } else {
                words += tens[ten];
                if (unit === 1 && ten < 8) {
                    words += " ET UN";
                } else if (unit > 0) {
                    words += "-" + units[unit];
                } else if (ten === 8) {
                    words += "S"; // QUATRE-VINGTS
                }
            }
        }
    }

    return words;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("fr-MA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export interface AutorisationPaiementData {
    numeroAp: string;
    disponible: number;
    disponibleAnnuel: number; // Disponible rubrique - credits disponibles avant cette depense
    compteCode: string;
    libelle: string;
    fournisseur: string;
    adresseFournisseur: string;
    montant: number;
    factureNumero: string;
    factureDate: string;
    provinceName: string;
}

// Load image as base64
async function loadImageAsBase64(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/png"));
            } else {
                reject(new Error("Failed to get canvas context"));
            }
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = url;
    });
}

export async function generateAutorisationPDF(data: AutorisationPaiementData) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const marginLeft = 20;
    const marginRight = 20;

    // Try to load and add the logo image
    try {
        const logoBase64 = await loadImageAsBase64("/images.png");
        // Add logo centered at top - keep original aspect ratio, wider display
        const logoWidth = 160;
        const logoHeight = 25;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(logoBase64, "PNG", logoX, 20, logoWidth, logoHeight);
    } catch {
        // Fallback to text if image fails to load
        doc.setFontSize(8);
        doc.setTextColor(0, 100, 0);
        doc.text("ROYAUME DU MAROC - ENTRAIDE NATIONALE", pageWidth / 2, 35, { align: "center" });
        doc.text("KINGDOM OF MOROCCO - NATIONAL MUTUAL AID", pageWidth / 2, 39, { align: "center" });
    }

    // Title
    const titleY = 55;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`AUTORISATION DE PAIEMENT N° ${data.numeroAp}`, pageWidth / 2, titleY, { align: "center" });

    // Underline the title
    const titleText = `AUTORISATION DE PAIEMENT N° ${data.numeroAp}`;
    const titleWidth = doc.getTextWidth(titleText);
    doc.setDrawColor(0, 0, 0);
    doc.line((pageWidth - titleWidth) / 2, titleY + 1, (pageWidth + titleWidth) / 2, titleY + 1);

    // Subtitle - black text, no border
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const subtitleY = titleY + 10;
    doc.text("Regie de depenses", pageWidth / 2, subtitleY, { align: "center" });

    // Content
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    let y = subtitleY + 18;
    const lineHeight = 8;

    // Available credits with disponible annuel
    doc.setFont("helvetica", "normal");
    doc.text(`Sur les credits disponibles de `, marginLeft, y);
    doc.setFont("helvetica", "bold");
    doc.text(`${formatCurrency(data.disponibleAnnuel)} DH`, marginLeft + doc.getTextWidth("Sur les credits disponibles de "), y);

    y += lineHeight;

    // Account
    doc.setFont("helvetica", "normal");
    doc.text("Compte ", marginLeft, y);
    doc.setFont("helvetica", "bold");
    doc.text(data.compteCode, marginLeft + doc.getTextWidth("Compte "), y);
    doc.setFont("helvetica", "normal");
    doc.text(` : ${data.libelle}`, marginLeft + doc.getTextWidth("Compte " + data.compteCode), y);

    y += lineHeight;

    // Authorization text
    doc.text("Autorisation est donnee au regisseur de depenses de payer a", marginLeft, y);

    y += lineHeight;

    // Supplier name
    doc.setFont("helvetica", "bold");
    doc.text(data.fournisseur, marginLeft, y);

    y += lineHeight;

    // Supplier address
    doc.setFont("helvetica", "normal");
    doc.text(`Demeurant a ${data.adresseFournisseur}`, marginLeft, y);

    y += lineHeight;

    // Amount in numbers
    doc.text("la somme de ", marginLeft, y);
    doc.setFont("helvetica", "bold");
    doc.text(`${formatCurrency(data.montant)} DIRHAMS`, marginLeft + doc.getTextWidth("la somme de "), y);

    y += lineHeight;

    // Invoice reference
    doc.setFont("helvetica", "normal");
    doc.text("En reglement de facture N° ", marginLeft, y);
    doc.setFont("helvetica", "bold");
    doc.text(data.factureNumero, marginLeft + doc.getTextWidth("En reglement de facture N° "), y);
    doc.setFont("helvetica", "normal");
    const factureEndX = marginLeft + doc.getTextWidth("En reglement de facture N° " + data.factureNumero);
    doc.text(`          du ${data.factureDate}`, factureEndX, y);

    y += lineHeight;

    // Justification text
    doc.text("Representant le montant de la piece justificative ci-joint.", marginLeft, y);

    y += lineHeight * 1.5;

    // Amount in words with centimes and DIRHAMS
    const wholePart = Math.floor(data.montant);
    const centimes = Math.round((data.montant - wholePart) * 100);
    let amountWords = numberToFrenchWords(wholePart);
    if (centimes > 0) {
        amountWords += " VIRGULE " + numberToFrenchWords(centimes);
    }
    amountWords += " DIRHAMS";

    doc.text("Arretee la somme a", marginLeft, y);
    y += lineHeight;
    doc.setFont("helvetica", "bold");
    doc.text(amountWords, marginLeft, y);

    // Footer - Location and date (using factureDate)
    y = 220;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    // Draw line
    doc.setDrawColor(150, 150, 150);
    doc.line(marginLeft, y - 15, pageWidth - marginRight, y - 15);

    doc.text(`A ${data.provinceName.toUpperCase()}, le ${data.factureDate}`, pageWidth / 2, y, { align: "center" });

    // Signature area
    y += 20;
    doc.setFont("helvetica", "italic");
    doc.text("L'ordonnateur ou son delegataire", pageWidth / 2, y, { align: "center" });

    // Save the PDF
    doc.save(`Autorisation_Paiement_${data.numeroAp}.pdf`);
}
