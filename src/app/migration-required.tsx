import {explicitMigrationCommand,isDatabaseMigrationRequired} from "@/infrastructure/sqlite/schema-contract";

export function migrationRequiredView(error:unknown){
  if(!isDatabaseMigrationRequired(error))throw error;
  return <main style={{maxWidth:"42rem",margin:"10vh auto",padding:"2rem",fontFamily:"var(--font-sans)"}}><p>Local database</p><h1>Migration required</h1><p>NetworkPilot has not changed this database. Review the target below, then run the explicit command and reload.</p><p><code>{explicitMigrationCommand(error.databasePath)}</code></p><p><small>Database: {error.databasePath}<br/>Required schema: {error.requiredVersion}</small></p></main>;
}
