import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
// Use Wrangler's migration journal so repeated local setup is safe.
const config=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
config.main=resolve('dist/server/index.js');
if(config.assets)config.assets.directory=resolve('dist/client');
for(const binding of config.d1_databases??[])binding.migrations_dir=resolve('drizzle');
mkdirSync('.sites-runtime',{recursive:true});
writeFileSync('.sites-runtime/local-db.json',JSON.stringify(config));
const result=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config','.sites-runtime/local-db.json','--persist-to','.wrangler/state'],{stdio:'inherit'});
process.exit(result.status??1);
