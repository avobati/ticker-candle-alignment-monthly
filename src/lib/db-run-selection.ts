export type DatasetSource = "database-coherent" | "database-legacy" | "fallback";

export function expectedTimeframeRows(universeSize: number) {
  return universeSize * 2;
}

export function datasetSourceFor({
  completeRunFound,
  fallbackUsed,
}: {
  completeRunFound: boolean;
  fallbackUsed: boolean;
}): DatasetSource {
  if (fallbackUsed) return "fallback";
  return completeRunFound ? "database-coherent" : "database-legacy";
}
