"use client";

import { useCallback, useEffect, useState } from "react";
import { listKnowledgeBases } from "@/lib/api/knowledge";
import type { KnowledgeBaseSummary } from "@/lib/types/knowledge";

export function useKnowledgeBases() {
  const [items, setItems] = useState<KnowledgeBaseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listKnowledgeBases());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载知识库失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
