/**
 * Benchmark results shown on the KronosDB performance page.
 *
 * Single node: KronosDB development build 262f024 and Postgres 16.15 on the
 * same AWS i4i.2xlarge server, one store at a time, same Rust harness and
 * client (kronosdb benchmarks/vs-axon/20261026-axon-postgres-kronosdb-aws-nvme.md).
 * Medians of 5 runs for single events, 3 runs otherwise.
 *
 * Cluster: KronosDB development build 417d327, three i4i.2xlarge voters
 * (kronosdb benchmarks/kronosdb-cluster/2026-10-26-cluster-ack-mode-aws.md).
 * Means of 3 rounds.
 *
 * To publish a new run, replace these numbers and the build in the page's
 * setup table.
 */

export type Measurement = {
  /** events/s, or operations/s where the row says so */
  value: number
  /** milliseconds */
  p50?: number
  p99?: number
}

export type Row = { label: string; detail?: string; values: Record<string, Measurement> }

export const appendRows: Row[] = [
  { label: "1 event, 1 client", values: { kronosdb: { value: 5_543, p50: 0.129, p99: 0.45 }, postgres: { value: 1_000, p50: 0.704, p99: 2.59 } } },
  { label: "1 event, 16 clients", values: { kronosdb: { value: 40_486, p50: 0.392, p99: 0.779 }, postgres: { value: 12_182, p50: 1.29, p99: 1.75 } } },
  { label: "100 events, 16 clients", values: { kronosdb: { value: 814_240, p50: 1.88, p99: 3.89 }, postgres: { value: 200_140, p50: 7.36, p99: 18.1 } } },
  { label: "1000 events, 16 clients", values: { kronosdb: { value: 980_400, p50: 15.9, p99: 28.5 }, postgres: { value: 238_700, p50: 68.0, p99: 165.8 } } },
]

export const conditionalRows: Row[] = [
  { label: "1 event, 1 client", values: { kronosdb: { value: 5_329, p50: 0.128, p99: 0.45 }, postgres: { value: 505, p50: 1.58, p99: 3.83 } } },
  { label: "1 event, 16 clients", values: { kronosdb: { value: 39_853, p50: 0.399, p99: 0.782 }, postgres: { value: 3_401, p50: 4.43, p99: 9.79 } } },
]

export const tagReadRows: Row[] = [
  { label: "1 client", values: { kronosdb: { value: 100_736, p50: 0.083, p99: 0.358 }, postgres: { value: 17_876, p50: 0.461, p99: 4.94 } } },
  { label: "16 clients", values: { kronosdb: { value: 1_186_483, p50: 0.132, p99: 0.212 }, postgres: { value: 338_677, p50: 0.458, p99: 0.788 } } },
]

export const wholeLogRows: Row[] = [
  { label: "1 client", values: { kronosdb: { value: 2_949_617, p50: 33.8, p99: 34.2 }, postgres: { value: 1_148_735, p50: 87.2, p99: 87.3 } } },
  { label: "4 clients", values: { kronosdb: { value: 3_699_585, p50: 81.6, p99: 162.2 }, postgres: { value: 3_142_060, p50: 103.2, p99: 166.5 } } },
  { label: "16 clients", values: { kronosdb: { value: 3_704_141, p50: 345.3, p99: 776.2 }, postgres: { value: 3_717_806, p50: 336.9, p99: 715.8 } } },
]

export const clusterOneZoneRows: Row[] = [
  { label: "1 client", values: { written: { value: 4_648, p50: 0.212, p99: 0.252 }, durable: { value: 3_756, p50: 0.256, p99: 0.389 } } },
  { label: "16 clients", values: { written: { value: 40_686, p50: 0.382, p99: 0.599 }, durable: { value: 33_290, p50: 0.471, p99: 0.728 } } },
  { label: "64 clients", values: { written: { value: 116_943, p50: 0.55, p99: 0.794 }, durable: { value: 95_412, p50: 0.677, p99: 0.939 } } },
  { label: "256 clients", values: { written: { value: 258_891, p50: 0.976, p99: 1.576 }, durable: { value: 234_280, p50: 1.083, p99: 1.685 } } },
]

export const clusterThreeZoneRows: Row[] = [
  { label: "1 client", values: { written: { value: 765, p50: 1.311, p99: 1.46 }, durable: { value: 745, p50: 1.326, p99: 1.566 } } },
  { label: "16 clients", values: { written: { value: 12_776, p50: 1.226, p99: 1.64 }, durable: { value: 12_037, p50: 1.306, p99: 1.734 } } },
  { label: "64 clients", values: { written: { value: 48_466, p50: 1.302, p99: 1.727 }, durable: { value: 43_539, p50: 1.465, p99: 1.917 } } },
  { label: "256 clients", values: { written: { value: 151_610, p50: 1.681, p99: 2.341 }, durable: { value: 139_981, p50: 1.816, p99: 2.51 } } },
]
