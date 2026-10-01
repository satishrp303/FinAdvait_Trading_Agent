// Pure deterministic simulation. All monetary values are integer paise.
export const CAPITAL=10_000_000, DAILY_LIMIT=150_000;
export const SYMBOLS=[['RELIANCE','Reliance Industries','Energy',1412],['ICICIBANK','ICICI Bank','Banking',1316],['INFY','Infosys','Technology',1584],['HDFCBANK','HDFC Bank','Banking',1728],['LT','Larsen & Toubro','Industrials',3510],['TCS','Tata Consultancy','Technology',3682],['SBIN','State Bank of India','Banking',812],['ITC','ITC Limited','Consumer',428],['BHARTIARTL','Bharti Airtel','Telecom',1820],['AXISBANK','Axis Bank','Banking',1134],['TATAMOTORS','Tata Motors','Automotive',756],['SUNPHARMA','Sun Pharma','Healthcare',1724]] as const;
export type Candle={open:number;high:number;low:number;close:number;volume:number};
export type Settings={risk:number;maxPositions:number;reward:number};
export type Position={id:string;symbol:string;qty:number;entry:number;stop:number;target:number;entryFee:number;plannedRisk:number;opened:number};
export type Trade=Position & {exit:number;exitFee:number;net:number;closed:number;reason:string};
export type State={version:number;step:number;cash:number;settings:Settings;positions:Position[];trades:Trade[];halted:boolean;ended:boolean;history:{step:number;equity:number}[];events:{step:number;text:string}[]};
export type Signal={symbol:string;name:string;sector:string;price:number;change:number;vwap:number;ema9:number;ema21:number;rvol:number;breakout:number;stop:number;target:number;status:'BUY'|'WAIT'|'NO TRADE';checks:boolean[];bars:Candle[]};
export const fee=(gross:number)=>Math.ceil(gross*0.0004);
export const buyFill=(price:number)=>Math.ceil(price*1.0005);
export const sellFill=(price:number)=>Math.floor(price*0.9995);
export function timeAt(step:number){const min=570+step*15;return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;}
export interface MarketDataProvider{candles(symbol:string,step:number):Candle[]}
export class DemoMarketData implements MarketDataProvider{
 candles(symbol:string,step:number){const index=SYMBOLS.findIndex(s=>s[0]===symbol);if(index<0)throw new Error('Unknown symbol.');const base=SYMBOLS[index][3]*100;const bars:Candle[]=[];
 for(let i=0;i<=25+step;i++){const trend=index%4===2?-0.0008:index%4===3?0.0002:0.0012;const pulse=i%8===5&&index%4<2?0.003:0;const retreat=i>31&&index%3===0?Math.sin((i-31)*0.75)*0.010:0;
 const close=Math.round(base*(1+trend*(i-25)+Math.sin(i*0.9+index)*0.00065+pulse+retreat));const open=i?bars[i-1].close:close-Math.round(base*0.001);const spread=Math.round(base*(0.0007+((i+index)%3)*0.0002));
 bars.push({open,close,high:Math.max(open,close)+spread,low:Math.min(open,close)-spread,volume:Math.round((180000+index*36000)*(1+((i+index)%5)*0.07)*(i%8===5?2.3:1))});}return bars;}
}
export const market:MarketDataProvider=new DemoMarketData();
function ema(bars:Candle[],period:number){let e=bars[0].close;for(const b of bars.slice(1))e=b.close*2/(period+1)+e*(1-2/(period+1));return Math.round(e);}
export function signal(symbol:string,step:number,settings:Settings,provider:MarketDataProvider=market):Signal{
 const bars=provider.candles(symbol,step),meta=SYMBOLS.find(x=>x[0]===symbol)!;
 if(bars.length<26||bars.some(b=>!Object.values(b).every(Number.isFinite)||b.low<=0||b.volume<=0||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)))throw new Error('Invalid or insufficient market data.');
 const last=bars.at(-1)!,prior=bars.slice(-21,-1),session=bars.slice(25);const vwap=Math.round(session.reduce((a,b)=>a+(b.high+b.low+b.close)/3*b.volume,0)/session.reduce((a,b)=>a+b.volume,0));
 const ema9=ema(bars,9),ema21=ema(bars,21),rvol=last.volume/(prior.reduce((a,b)=>a+b.volume,0)/20),breakout=Math.max(...prior.map(b=>b.high));const checks=[last.close>vwap,ema9>ema21,last.close>breakout,rvol>=1.5];
 const stop=Math.min(...bars.slice(-4).map(b=>b.low),Math.round(last.close*0.994));const status=checks.every(Boolean)?'BUY':checks[0]&&checks[1]?'WAIT':'NO TRADE';
 return {symbol,name:meta[1],sector:meta[2],price:last.close,change:(last.close/bars[24].close-1)*100,vwap,ema9,ema21,rvol,breakout,stop,target:last.close+Math.round((last.close-stop)*settings.reward),status,checks,bars};
}
export function mark(p:Position,step:number){return market.candles(p.symbol,step).at(-1)!.close;}
export function metrics(s:State){const invested=s.positions.reduce((a,p)=>a+p.qty*p.entry,0),unrealized=s.positions.reduce((a,p)=>a+(mark(p,s.step)-p.entry)*p.qty-p.entryFee-fee(mark(p,s.step)*p.qty),0),realized=s.trades.reduce((a,t)=>a+t.net,0),openRisk=s.positions.reduce((a,p)=>a+p.plannedRisk,0),reserved=Math.max(0,-realized)+openRisk;
 return {invested,unrealized,realized,net:realized+unrealized,equity:CAPITAL+realized+unrealized,openRisk,reserved,remaining:Math.max(0,DAILY_LIMIT-reserved)};}
export function quote(s:State,symbol:string){const sig=signal(symbol,s.step,s.settings),m=metrics(s),entry=buyFill(sig.price),stop=sellFill(sig.stop),perShare=entry-stop,budget=Math.min(s.settings.risk,m.remaining);let qty=perShare>0?Math.floor(Math.min(budget/perShare,s.cash/entry)):0;const risk=(q:number)=>(entry-stop)*q+fee(entry*q)+fee(stop*q);
 while(qty>0&&(risk(qty)>budget||entry*qty+fee(entry*qty)>s.cash))qty--;let blocked='';
 if(s.halted)blocked='Daily loss protection is active for this session.';else if(s.ended)blocked='The demo session has ended.';else if(sig.status!=='BUY')blocked='This stock does not meet all four entry rules.';else if(s.positions.some(p=>p.symbol===symbol))blocked='A position in this stock is already open. No averaging down.';else if(s.positions.length>=s.settings.maxPositions)blocked='All position slots are occupied.';else if(qty<1)blocked='Available cash or daily risk budget is too low for one share.';
 return {signal:sig,entry,stop:sig.stop,target:sig.target,qty,cost:qty*entry+fee(qty*entry),risk:risk(qty),fees:fee(entry*qty)+fee(sig.target*qty),blocked,budget};}
export function initialState():State{return {version:0,step:4,cash:CAPITAL,settings:{risk:60000,maxPositions:3,reward:2},positions:[],trades:[],halted:false,ended:false,history:[{step:0,equity:CAPITAL},{step:4,equity:CAPITAL}],events:[{step:4,text:'Paper desk ready. ₹1,00,000 virtual capital allocated.'}]};}
export type Action={type:'approve';symbol:string}|{type:'advance'}|{type:'close';id:string}|{type:'settings';settings:Settings}|{type:'reset'};
function close(s:State,p:Position,price:number,reason:string){const exit=sellFill(price),exitFee=fee(exit*p.qty),net=(exit-p.entry)*p.qty-p.entryFee-exitFee;s.cash+=exit*p.qty-exitFee;s.positions=s.positions.filter(x=>x.id!==p.id);s.trades.unshift({...p,exit,exitFee,net,closed:s.step,reason});s.events.unshift({step:s.step,text:`${p.symbol} · ${reason} · ${p.qty} shares closed`});}
export function protectiveExit(p:Position,b:Candle):{price:number;reason:string}|null{if(b.open<=p.stop)return {price:b.open,reason:'Stop gap'};if(b.low<=p.stop)return {price:p.stop,reason:'Stop-loss'};if(b.high>=p.target)return {price:p.target,reason:'Target reached'};return null;}
export function transition(original:State,action:Action):State{const s:State=structuredClone(original);
 if(action.type==='reset'){const fresh=initialState();fresh.version=s.version+1;return fresh;}
 if(action.type==='approve'){const q=quote(s,action.symbol);if(q.blocked)throw new Error(q.blocked);const p:Position={id:`paper-${s.version+1}-${action.symbol}`,symbol:action.symbol,qty:q.qty,entry:q.entry,stop:q.stop,target:q.target,entryFee:fee(q.entry*q.qty),plannedRisk:q.risk,opened:s.step};s.cash-=q.cost;s.positions.push(p);s.events.unshift({step:s.step,text:`${p.symbol} · BUY approved · ${p.qty} shares filled in paper mode`});}
 else if(action.type==='close'){const p=s.positions.find(p=>p.id===action.id);if(!p)throw new Error('This position is already closed.');close(s,p,mark(p,s.step),'Manual exit');}
 else if(action.type==='advance'){if(s.ended)throw new Error('Session ended. Reset the demo to start again.');s.step++;for(const p of [...s.positions]){const exit=protectiveExit(p,market.candles(p.symbol,s.step).at(-1)!);if(exit)close(s,p,exit.price,exit.reason);}if(s.step>=24){for(const p of [...s.positions])close(s,p,mark(p,s.step),'Session close');s.ended=true;}}
 else if(action.type==='settings'){const cfg=action.settings;if(!cfg||!Number.isInteger(cfg.risk)||cfg.risk<50000||cfg.risk>75000||![2,3].includes(cfg.maxPositions)||![1.5,2].includes(cfg.reward))throw new Error('Use ₹500–₹750 risk, 2–3 slots, and 1.5R or 2R target.');if(cfg.maxPositions<s.positions.length)throw new Error('Close a position before reducing the number of slots.');if(s.positions.some(p=>p.plannedRisk>cfg.risk))throw new Error('The new limit is below an open position’s committed risk.');s.settings=cfg;s.events.unshift({step:s.step,text:'Risk settings updated. Existing stops and targets preserved.'});}
 else throw new Error('Unknown action.');
 if(metrics(s).net<=-DAILY_LIMIT){s.halted=true;for(const p of [...s.positions])close(s,p,mark(p,s.step),'Daily loss protection');}
 s.version++;const point={step:s.step,equity:metrics(s).equity};if(s.history.at(-1)?.step===s.step)s.history[s.history.length-1]=point;else s.history.push(point);s.events=s.events.slice(0,100);return s;}
export interface BrokerAdapter{readonly mode:'paper'|'live'}
export class PaperBroker implements BrokerAdapter{readonly mode='paper' as const;execute(state:State,symbol:string){return transition(state,{type:'approve',symbol});}}
// No credentials, network calls, or live order implementation are shipped.
export class KiteExecutionDisabled implements BrokerAdapter{readonly mode='live' as const;execute():never{throw new Error('Live-money execution is disabled in this prototype.');}}
