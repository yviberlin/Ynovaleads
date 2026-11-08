export function ScoreBadge({ score, reason }: { score: number | null; reason?: string | null }) {
  if (score === null || score === undefined) return <span className="missing">—</span>;
  const level = score >= 8 ? "high" : score >= 5 ? "mid" : "low";
  return <span className={`score ${level}`} title={reason ?? undefined} aria-label={`${score} von 10 Punkten`}>{score}</span>;
}
