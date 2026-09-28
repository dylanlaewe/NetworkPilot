import {readFileSync,readdirSync,statSync} from "node:fs";
import {join,relative,resolve} from "node:path";

const root=resolve(process.cwd()),allowed=new Set([
  "scripts/migrate.ts",
  "scripts/check-no-implicit-migrations.mjs",
  "src/infrastructure/sqlite/migration-runner.ts",
  "src/infrastructure/sqlite/test-migrations.ts",
]);
const files=[];
for(const start of ["src","scripts"]){const walk=(directory)=>{for(const name of readdirSync(directory)){const path=join(directory,name),stat=statSync(path);if(stat.isDirectory())walk(path);else if(/\.(?:ts|tsx|js|mjs)$/.test(name))files.push(path);}};walk(join(root,start));}
const failures=[];
for(const path of files){const name=relative(root,path),source=readFileSync(path,"utf8");
  if(name==="scripts/check-no-implicit-migrations.mjs"||name.includes(".test."))continue;
  if(source.includes("test-migrations"))failures.push(`${name}: imports test-only migration authority`);
  if(!allowed.has(name)&&source.includes("migration-runner"))failures.push(`${name}: imports migration authority`);
  if(source.includes(".migrate("))failures.push(`${name}: invokes legacy implicit migration API`);
  if(!allowed.has(name)&&/CREATE TABLE IF NOT EXISTS schema_migrations/.test(source))failures.push(`${name}: creates the migration ledger`);
}
if(failures.length){console.error(failures.join("\n"));process.exit(1);}
console.log("No implicit runtime migration paths found.");
