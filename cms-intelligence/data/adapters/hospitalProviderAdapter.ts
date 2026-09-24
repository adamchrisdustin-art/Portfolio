/**
 * Real ProviderAdapter/NetworkAdapter implementation backed by the
 * Hospital General Information dataset - proves the interfaces in
 * types.ts are actually swappable, not just speculative shape. A future
 * internal-data adapter would implement these same interfaces without
 * changing any agent code that depends on them.
 */
import { concentrationRatio } from "../../intelligence/metrics/metrics";
import { loadLatestSnapshot, SOURCE_ID } from "./hospitalGeneralInformation";
import type { NetworkAdapter, ProviderAdapter } from "./types";

export const hospitalProviderAdapter: ProviderAdapter = {
  sourceId: SOURCE_ID,
  async getProviderCount({ geography, providerType }): Promise<number | null> {
    const snapshot = loadLatestSnapshot();
    if (!snapshot) return null;
    return snapshot.rows.filter((row) => {
      const matchesGeography = !geography || row.state === geography;
      const matchesType = !providerType || row.hospital_ownership === providerType;
      return matchesGeography && matchesType;
    }).length;
  },
};

export const hospitalNetworkAdapter: NetworkAdapter = {
  sourceId: SOURCE_ID,
  async getConcentrationRatio({ geography, topN }): Promise<number | null> {
    const snapshot = loadLatestSnapshot();
    if (!snapshot) return null;
    const scoped = geography ? snapshot.rows.filter((r) => r.state === geography) : snapshot.rows;
    if (scoped.length === 0) return null;

    const counts = new Map<string, number>();
    for (const row of scoped) {
      const ownership = row.hospital_ownership ?? "Unknown";
      counts.set(ownership, (counts.get(ownership) ?? 0) + 1);
    }
    const sortedValues = Array.from(counts.values()).sort((a, b) => b - a);
    return concentrationRatio(sortedValues, topN, scoped.length);
  },
};
