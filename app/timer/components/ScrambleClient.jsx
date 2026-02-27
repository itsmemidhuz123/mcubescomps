"use client";

import { useState } from "react";

export default function ScrambleClient({ eventId = '333', onScrambleChange }) {
  const [scramble, setScramble] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const cubing = await import("cubing");
      const { randomScrambleForEvent } = cubing;

      const result = await randomScrambleForEvent(eventId, {
        worker: false
      });

      const scrambleStr = result.toString();
      setScramble(scrambleStr);
      if (onScrambleChange) onScrambleChange(scrambleStr);
    } catch (e) {
      console.error('Scramble error:', e);
    } finally {
      setLoading(false);
    }
  }

  return { scramble, loading, generate };
}
