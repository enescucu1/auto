export function generateFGNR() {
    // Erstes Segment: feste "1" wie in CSV
    const prefix = "1";

    // Laufende Nummer 1 - 9999
    const nummer = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");

    // Prüfziffer wie in Beispielen (immer 6)
    const pruefziffer = "6";

    return `${prefix}-${nummer}-${pruefziffer}`;
}
