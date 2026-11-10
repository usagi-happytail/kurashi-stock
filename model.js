/** 家庭用品在庫管理: 副作用のないデータ操作。 */
export const STORAGE_KEY = 'kurashi-stock:v1';
export const DEFAULT_CATEGORIES = ['食品','冷蔵・冷凍','飲料','洗濯・掃除','衛生・美容','紙製品','医薬・救急','防災用品','その他'];
export const DEFAULT_LOCATIONS = ['キッチン','冷蔵庫','冷凍庫','洗面所','浴室','収納棚','玄関','その他'];
export const DEFAULT_UNITS = ['個','袋','箱','本','ロール','セット','枚','g','kg','mL','L'];
export const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const initialState = () => ({version:1, products:[], shopping:[], events:[], categories:[...DEFAULT_CATEGORIES], locations:[...DEFAULT_LOCATIONS], settings:{expiryDays:7}});
const copy = data => JSON.parse(JSON.stringify(data));
const now = () => new Date().toISOString();
const round = n => Math.round((n+Number.EPSILON)*1000)/1000;
const num = (value, fallback=0) => {const n=Number(value); return Number.isFinite(n) && n>=0 ? round(n) : fallback;};
const text = v => String(v ?? '').trim();
function ensure(cause, message) { if(!cause) throw new Error(message); }
export function normalizeProduct(draft, base={}) {
  const name=text(draft.name); ensure(name.length>0 && name.length<=100,'商品名を1〜100文字で入力してください');
  const category=text(draft.category)||'その他'; const location=text(draft.location)||'その他';
  const unit=text(draft.unit)||'個';
  const quantity=num(draft.quantity ?? base.quantity ?? 0,NaN);
  const minStock=draft.minStock===''||draft.minStock==null?null:num(draft.minStock,NaN);
  const targetStock=draft.targetStock===''||draft.targetStock==null?null:num(draft.targetStock,NaN);
  const price=draft.price===''||draft.price==null?null:num(draft.price,NaN);
  ensure(Number.isFinite(quantity),'数量は0以上の数値で入力してください');
  ensure(minStock===null||Number.isFinite(minStock),'最低在庫数は0以上にしてください');
  ensure(targetStock===null||Number.isFinite(targetStock),'目標在庫数は0以上にしてください');
  ensure(price===null||Number.isFinite(price),'価格は0以上にしてください');
  ensure(minStock===null||targetStock===null||targetStock>=minStock,'目標在庫数は最低在庫数以上にしてください');
  const expiry=text(draft.expiry); ensure(!expiry || /^\d{4}-\d{2}-\d{2}$/.test(expiry),'期限の日付が正しくありません');
  return {...base,name,category,location,unit,quantity,minStock,targetStock,price,expiry,notes:text(draft.notes).slice(0,500),updatedAt:now()};
}
function log(state, product, delta, type, note='') {
  if(delta===0) return;
  state.events.unshift({id:makeId(),productId:product.id,name:product.name,unit:product.unit,delta:round(delta),type,note,at:now()});
}
export function addProduct(state,draft) {
  const next=copy(state); const product=normalizeProduct(draft);
  product.id=makeId(); product.createdAt=now(); product.archived=false;
  next.products.unshift(product); if(product.quantity>0)log(next,product,product.quantity,'初期登録');
  return next;
}
export function editProduct(state,id,draft) {
  const next=copy(state), i=next.products.findIndex(p=>p.id===id && !p.archived);
  ensure(i>=0,'商品が見つかりません');
  const old=next.products[i]; const updated=normalizeProduct({...draft,quantity:old.quantity},old);
  next.products[i]=updated; return next;
}
export function changeStock(state,id,delta,type='調整',note='') {
  const next=copy(state), p=next.products.find(p=>p.id===id && !p.archived);
  ensure(p,'商品が見つかりません');
  ensure(Number.isFinite(delta) && round(delta)!==0,'変更数量が正しくありません');
  ensure(round(p.quantity+delta)>=0,'在庫が不足しています');
  const amount=round(delta);p.quantity=round(p.quantity+amount);p.updatedAt=now();log(next,p,amount,type,note);
  return next;
}
export function archiveProduct(state,id) {
  const next=copy(state),p=next.products.find(p=>p.id===id&&!p.archived);
  ensure(p,'商品が見つかりません');p.archived=true;p.updatedAt=now();
  next.shopping=next.shopping.filter(x=>x.productId!==id);return next;
}
export function addToShopping(state,id,quantity) {
  const next=copy(state),p=next.products.find(p=>p.id===id && !p.archived);
  ensure(p,'商品が見つかりません');const amount=num(quantity,NaN);ensure(Number.isFinite(amount)&&amount>0,'購入予定数は0より大きくしてください');
  const existing=next.shopping.find(x=>x.productId===id);
  if(existing)existing.quantity=round(existing.quantity+amount);
  else next.shopping.unshift({id:makeId(),productId:id,quantity:amount,createdAt:now()});
  return next;
}
export function setShoppingQuantity(state,itemId,quantity) {
  const next=copy(state),item=next.shopping.find(x=>x.id===itemId);ensure(item,'商品が見つかりません');
  const q=num(quantity,NaN);ensure(Number.isFinite(q)&&q>0,'購入予定数は0より大きくしてください');item.quantity=q;return next;
}
export function removeShopping(state,itemId) {const next=copy(state);next.shopping=next.shopping.filter(x=>x.id!==itemId);return next;}
export function purchaseShopping(state,itemId,actualQty=null) {
  const item=state.shopping.find(x=>x.id===itemId);ensure(item,'買い物リストにありません');
  const qty=actualQty===null?item.quantity:num(actualQty,NaN);ensure(Number.isFinite(qty)&&qty>0,'購入数量が正しくありません');
  const next=changeStock(state,item.productId,qty,'購入');next.shopping=next.shopping.filter(x=>x.id!==itemId);return next;
}
export function shortage(p) {return p.minStock!==null && p.minStock!==undefined && p.quantity<p.minStock;}
export function suggestedPurchase(p) { const target=p.targetStock??p.minStock??0;return Math.max(0,round(target-p.quantity)); }
export function expiryStatus(p, today=new Date(), days=7) {
  if(!p.expiry || !p.quantity)return 'none';
  const date=new Date(`${p.expiry}T00:00:00`);if(Number.isNaN(date.getTime()))return 'none';
  const start=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  const diff=Math.round((date-start)/86400000);
  return diff<0?'expired':diff<=days?'soon':'none';
}
export function addCategoryOrLocation(state,key,value) {
  ensure(['categories','locations'].includes(key),'設定項目が不正です');const item=text(value);
  ensure(item.length>0&&item.length<=40,'1〜40文字で入力してください');
  const next=copy(state);ensure(!next[key].includes(item),'すでに登録されています');next[key].push(item);return next;
}
export function exportBackup(state){return JSON.stringify({...state,exportedAt:now()},null,2);}
export function importBackup(data){
  const raw=typeof data==='string'?JSON.parse(data):data;
  ensure(raw && raw.version===1 && Array.isArray(raw.products) && Array.isArray(raw.shopping) && Array.isArray(raw.events) && Array.isArray(raw.categories) && Array.isArray(raw.locations),'対応していないバックアップ形式です');
  ensure(raw.products.length<=100000 && raw.events.length<=500000,'データが大きすぎます');
  const out=initialState();out.products=raw.products.map(p=>{
    ensure(p&&typeof p.id==='string'&&/^[A-Za-z0-9._:-]{1,100}$/.test(p.id),'商品IDが不正です');
    const normalized=normalizeProduct(p,p);
    return {...normalized,id:p.id,createdAt:text(p.createdAt)||now(),archived:!!p.archived};
  });
  ensure(new Set(out.products.map(p=>p.id)).size===out.products.length,'商品IDが重複しています');
  const ids=new Set(out.products.map(p=>p.id));
  out.shopping=raw.shopping.map(x=>{
    ensure(x && typeof x.id==='string'&&/^[A-Za-z0-9._:-]{1,100}$/.test(x.id)&&ids.has(x.productId)&&Number(x.quantity)>0,'買い物リストの内容が不正です');
    return {id:x.id,productId:x.productId,quantity:num(x.quantity),createdAt:text(x.createdAt)};
  });
  out.events=raw.events.map(e=>{
    ensure(e&&typeof e.id==='string'&&typeof e.name==='string'&&typeof e.at==='string'&&Number.isFinite(Number(e.delta)),'履歴が不正です');
    return {id:e.id,productId:text(e.productId),name:text(e.name),unit:text(e.unit),delta:Number(e.delta),type:text(e.type),note:text(e.note),at:e.at};
  });
  for(const key of ['categories','locations']) {
    ensure(raw[key].every(x=>typeof x==='string'&&x.trim().length>0),'カテゴリまたは保管場所が不正です');
    out[key]=[...new Set(raw[key])];
  }
  out.settings={expiryDays:Math.min(365,Math.max(0,num(raw.settings?.expiryDays,7)))};
  return out;
}
export function csvProducts(state) {
  const rows=[['商品名','カテゴリ','保管場所','数量','単位','最低在庫','目標在庫','期限','参考価格','備考'],...state.products.filter(p=>!p.archived).map(p=>[p.name,p.category,p.location,p.quantity,p.unit,p.minStock??'',p.targetStock??'',p.expiry,p.price??'',p.notes])];
  const safe=v=>{const s=String(v??''); const guarded=/^[\s]*[=+@\-]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s.trim()) ? `'${s}`:s;return '"'+guarded.replace(/"/g,'""')+'"';};
  return '\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n');
}
