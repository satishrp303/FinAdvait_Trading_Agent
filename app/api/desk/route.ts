import { env } from 'cloudflare:workers';
import { initialState, transition, type State, type Action } from '../../../lib/engine';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const HOSTED_DEMO_HOSTS = new Set(['finadvait-trading-agent.satishrp303.workers.dev']);

function owner(req:Request){
  const id=req.headers.get('oai-authenticated-user-id');
  if(id)return id;
  const hostname=new URL(req.url).hostname;
  if(LOCAL_HOSTS.has(hostname))return 'local-paper-desk';
  if(HOSTED_DEMO_HOSTS.has(hostname))return 'cloud-demo-paper-desk';
  throw new Error('Sign in to open your private paper desk.');
}
function db(){if(!env.DB)throw new Error('Paper desk storage is unavailable. Please retry.');return env.DB;}
async function load(id:string):Promise<State>{await db().prepare('INSERT OR IGNORE INTO desks (owner, revision, state) VALUES (?, ?, ?)').bind(id,0,JSON.stringify(initialState())).run();const row=await db().prepare('SELECT state FROM desks WHERE owner = ?').bind(id).first<{state:string}>();if(!row)throw new Error('Could not load your paper desk.');return JSON.parse(row.state);}
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){try{return reply(await load(owner(req)));}catch(e){console.error('Desk load',e);return reply({error:(e as Error).message},503);}}
export async function POST(req:Request){try{const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return reply({error:'Cross-origin action rejected.'},403);const id=owner(req),body=await req.json() as {revision:number;action:Action},current=await load(id);if(!Number.isInteger(body.revision)||body.revision!==current.version)return reply({error:'The desk changed. Review the latest prices and try again.'},409);const next=transition(current,body.action);const result=await db().prepare('UPDATE desks SET revision = ?, state = ? WHERE owner = ? AND revision = ?').bind(next.version,JSON.stringify(next),id,current.version).run();if(result.meta.changes!==1)return reply({error:'Another action changed the desk. Refresh before approving.'},409);return reply(next);}catch(e){return reply({error:(e as Error).message},400);}}
