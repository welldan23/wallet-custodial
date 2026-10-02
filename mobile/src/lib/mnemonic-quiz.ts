export type QuizQuestion = {
  /** Posisi kata (0-based). */
  index: number;
  /** Kata yang benar. */
  answer: string;
  /** Pilihan teracak, termasuk jawaban. */
  options: string[];
};

/** Acak urutan (Fisher–Yates) dengan `rng` yang menghasilkan [0, 1). */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Kuis cek catatan: `count` posisi acak (urut naik), masing-masing dengan
 * jawaban + pengecoh dari kata lain milik pengguna sendiri — jadi yang dites
 * urutan catatannya, bukan sekadar ingat katanya. Kalau kata unik kurang,
 * pengecoh diambil dari `fallbackWords`.
 */
export function buildMnemonicQuiz(
  words: string[],
  rng: () => number,
  { count = 3, optionCount = 3, fallbackWords = [] as readonly string[] } = {},
): QuizQuestion[] {
  const positions = shuffle(
    words.map((_, index) => index),
    rng,
  )
    .slice(0, count)
    .sort((a, b) => a - b);

  return positions.map((index) => {
    const answer = words[index]!;
    const pool = [...new Set([...words, ...fallbackWords])].filter((word) => word !== answer);
    const decoys = shuffle(pool, rng).slice(0, optionCount - 1);
    return { index, answer, options: shuffle([answer, ...decoys], rng) };
  });
}
