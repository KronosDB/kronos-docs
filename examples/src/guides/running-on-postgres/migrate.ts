import {
  DEFAULT_TABLE_NAMES,
  buildDeadLettersIndexesDDL,
  buildDeadLettersTableDDL,
  buildEventsIndexesDDL,
  buildEventsTableDDL,
  buildScheduledEventsIndexesDDL,
  buildScheduledEventsTableDDL,
  buildSnapshotsTableDDL,
  buildTokensTableDDL,
} from "@kronos-ts/postgres"

const tables = DEFAULT_TABLE_NAMES

console.log(
  [
    buildEventsTableDDL(tables),
    buildEventsIndexesDDL(tables),
    buildSnapshotsTableDDL(tables),
    buildScheduledEventsTableDDL(tables),
    buildScheduledEventsIndexesDDL(tables),
    buildTokensTableDDL(tables),
    buildDeadLettersTableDDL(tables),
    buildDeadLettersIndexesDDL(tables),
  ].join("\n\n"),
)
