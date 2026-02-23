/**
 * TrainingBanner - Hinweis: Nur für Schulungszwecke
 * Immer sichtbar, kein echtes Discord
 */
export function TrainingBanner() {
  return (
    <div className="h-8 flex items-center justify-center gap-2 bg-amber-500/20 border-b border-amber-500/30 text-amber-200 text-sm">
      <span className="font-medium">Schulungszwecke</span>
      <span className="text-amber-300/80">—</span>
      <span>Kein echtes Produkt, nur Demo zum Lernen</span>
    </div>
  )
}
