import { Retriever } from "./retriever.ts";

let cached: Retriever | null = null;

export function getRetriever(): Retriever {
  if (!cached) cached = new Retriever();
  return cached;
}

export type { Passage } from "./retriever.ts";
