import {STORAGE_KEY, DEFAULT_UNITS, initialState, addProduct, editProduct, changeStock, archiveProduct, addToShopping, removeShopping, purchaseShopping, shortage, suggestedPurchase, expiryStatus, addCategoryOrLocation, exportBackup, importBackup, csvProducts, setShoppingQuantity} from './model.js';
const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtNum=n=>new Intl.NumberFormat('ja-JP',{maximumFractionDigits:3}).format(Number(n||0));
const money=n=>new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(Number(n||0));
const localDate=date=>new Date(date).toLocaleDateString('ja-JP',{year:'numeric',month:'short',day:'numeric'});
const today = new Date().toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'});
const icons={home:'⌂',inventory:'▤',shopping:'🛒',history:'◷',settings:'⚙'};
const tabs=[['home','ホーム'],['inventory','在庫一覧'],['shopping','買い物'],['history','履歴'],['settings','設定']];
const catIcons={'食品':'🍚','冷蔵・冷凍':'🥦','飲料':'🥤','洗濯・掃除':'🧴','衛生・美容':'🫧','紙製品':'🧻','医薬・救急':'🩹','防災用品':'🔦','その他':'📦'};
let state;
let memoryOnly=false;
try {const raw=localStorage.getItem(STORAGE_KEY);state=raw?importBackup(raw):initialState();}catch(err){console.warn(err);state=initialState();memoryOnly=true;}
let view='home',filter='all',search='',categoryFilter='all',toastTimer;
const liveProducts=()=>state.products.filter(p=>!p.archived);
const getProduct=id=>state.products.find(p=>p.id===id&&!p.archived);
function persist(next, message='保存しました'){
  state=next;
  try{localStorage.setItem(STORAGE_KEY,exportBackup(state));memoryOnly=false;}catch(err){memoryOnly=true;notify('保存領域にアクセスできません。JSONバックアップを作成してください。',true);}
  render();if(message)notify(message);
}
function notify(message,error=false){const toast=$('#toast');toast.textContent=message;toast.className=`toast visible ${error?'error':''}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),3600);}
function go(next){view=next;filter='all';search='';categoryFilter='all';render();$('#app').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
function pageHeading(eyebrow,title,subtitle,actions=''){return `<div class="page-heading"><div><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(subtitle)}</p></div><div class="heading-actions">${actions}</div></div>`;}
const primaryButton=(label,action,attrs='')=>`<button type="button" class="button primary" data-action="${action}" ${attrs}>${label}</button>`;
const tinyPill=(label,kind='muted')=>`<span class="pill ${kind}">${escapeHtml(label)}</span>`;
function productStatus(p){const exp=expiryStatus(p,new Date(),state.settings.expiryDays);return [shortage(p)?tinyPill('在庫不足','warn'):'',exp==='expired'?tinyPill('期限切れ','danger'):exp==='soon'?tinyPill('期限間近','warn'):''].join('');}
function productCard(p,compact=false){return `<article class="product-card ${compact?'compact':''}">
  <div class="product-icon" aria-hidden="true">${catIcons[p.category]||'📦'}</div>
  <div class="product-info"><div class="product-title">${escapeHtml(p.name)}</div><div class="product-meta">${escapeHtml(p.category)} <span class="dot">·</span> ${escapeHtml(p.location)}</div><div class="status-row">${productStatus(p)}${p.expiry?`<span class="date-meta">期限 ${escapeHtml(p.expiry.replaceAll('-','/'))}</span>`:''}</div></div>
  <div class="product-actions"><div class="stock-display"><strong>${fmtNum(p.quantity)}</strong><span>${escapeHtml(p.unit)}</span></div><div class="quantity-controls"><button class="icon-button" data-action="consume" data-id="${p.id}" aria-label="${escapeHtml(p.name)}を1${escapeHtml(p.unit)}使う" ${p.quantity<=0?'disabled':''}>−</button><button class="icon-button plus" data-action="replenish" data-id="${p.id}" aria-label="${escapeHtml(p.name)}を1${escapeHtml(p.unit)}補充">＋</button><button class="icon-button more" data-action="edit" data-id="${p.id}" aria-label="${escapeHtml(p.name)}を編集">⋯</button></div></div>
  </article>`;}
function empty(title,sub,button=''){return `<div class="empty"><div class="empty-icon">📦</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(sub)}</p>${button}</div>`;}
function dashboard(){const all=liveProducts(),low=all.filter(shortage),exp=all.filter(p=>expiryStatus(p,new Date(),state.settings.expiryDays)!=='none');
 return `${pageHeading('MY STOCK','おうちの在庫を、ひと目で。','必要なものを、必要なだけ。今日のストック状況を確認しましょう。',primaryButton('＋ 商品を登録','add-product'))}
  ${memoryOnly?'<div class="alert danger-alert">この端末では自動保存できません。設定からJSONバックアップを作成してください。</div>':''}
  <div class="stats-grid"><div class="stat-card"><div class="stat-top"><span>登録商品</span><span class="stat-icon mint">▤</span></div><div class="stat-number">${all.length}<small>種類</small></div><div class="stat-foot">管理中の商品</div></div>
  <div class="stat-card"><div class="stat-top"><span>在庫不足</span><span class="stat-icon peach">!</span></div><div class="stat-number">${low.length}<small>種類</small></div><div class="stat-foot">補充しておきたいもの</div></div>
  <div class="stat-card"><div class="stat-top"><span>期限の注意</span><span class="stat-icon lavender">◷</span></div><div class="stat-number">${exp.length}<small>種類</small></div><div class="stat-foot">${state.settings.expiryDays}日以内・期限切れ</div></div>
  <div class="stat-card"><div class="stat-top"><span>買い物リスト</span><span class="stat-icon sky">🛒</span></div><div class="stat-number">${state.shopping.length}<small>件</small></div><div class="stat-foot">まだ買っていないもの</div></div></div>
  <div class="hero-banner"><div><span class="hero-eyebrow">SMART SHOPPING</span><h2>ストックを把握して、<br>買い物をもっとかしこく。</h2><p>在庫不足の商品を買い物リストにまとめましょう。</p><button class="button white" data-action="go-shopping">買い物リストを見る →</button></div><div class="hero-art" aria-hidden="true"><div>🧴</div><div>🧻</div><div>🥫</div></div></div>
  <div class="two-cols"><section class="panel"><div class="section-title"><div><h2>補充したいもの</h2><p>最低在庫を下回った商品</p></div><button class="text-button" data-action="show-low">すべて見る →</button></div>${low.length?`<div class="mini-list">${low.slice(0,5).map(p=>`<div class="mini-row"><span class="mini-emoji">${catIcons[p.category]||'📦'}</span><span class="mini-name">${escapeHtml(p.name)}</span><span class="muted small">残り ${fmtNum(p.quantity)} ${escapeHtml(p.unit)}</span><button class="small-button" data-action="shop" data-id="${p.id}">追加</button></div>`).join('')}</div>`:empty('在庫不足はありません','必要なものが揃っています。')}</section>
  <section class="panel"><div class="section-title"><div><h2>期限が近いもの</h2><p>先に使いたい商品</p></div><button class="text-button" data-action="show-expiry">すべて見る →</button></div>${exp.length?`<div class="mini-list">${exp.slice(0,5).map(p=>`<div class="mini-row"><span class="mini-emoji">${catIcons[p.category]||'📦'}</span><span class="mini-name">${escapeHtml(p.name)}</span><span class="muted small">${escapeHtml(p.expiry)}</span>${tinyPill(expiryStatus(p)==='expired'?'期限切れ':'まもなく','warn')}</div>`).join('')}</div>`:empty('期限の注意はありません','期限を登録すると、ここに表示されます。')}</section></div>
  <section class="panel"><div class="section-title"><div><h2>最近登録した商品</h2><p>在庫の増減はワンタップで</p></div><button class="text-button" data-action="go-inventory">在庫一覧へ →</button></div>${all.length?`<div class="product-list">${all.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,4).map(p=>productCard(p,true)).join('')}</div>`:empty('商品を登録して始めましょう','洗剤、食品、トイレットペーパーなど何でも登録できます。',primaryButton('＋ 最初の商品を登録','add-product'))}</section>`;
}
function inventory(){let products=liveProducts().filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||p.notes.toLowerCase().includes(search.toLowerCase()));
 if(categoryFilter!=='all')products=products.filter(p=>p.category===categoryFilter);
 if(filter==='low')products=products.filter(shortage);
 if(filter==='expiry')products=products.filter(p=>expiryStatus(p,new Date(),state.settings.expiryDays)!=='none');
 if(filter==='zero')products=products.filter(p=>p.quantity===0);
 return `${pageHeading('INVENTORY','在庫一覧','家にあるものを検索・確認。＋ / − で数量を更新できます。',primaryButton('＋ 商品を登録','add-product'))}
 <div class="panel inventory-toolbar"><div class="search-field"><span aria-hidden="true">⌕</span><input id="search" type="search" autocomplete="off" placeholder="商品名やメモで検索" value="${escapeHtml(search)}" aria-label="商品検索"></div><select id="category-filter" aria-label="カテゴリを選択"><option value="all">すべてのカテゴリ</option>${state.categories.map(c=>`<option ${categoryFilter===c?'selected':''} value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select></div>
 <div class="filter-tabs">${[['all','すべて'],['low','在庫不足'],['expiry','期限注意'],['zero','在庫ゼロ']].map(([key,label])=>`<button data-action="filter" data-value="${key}" class="filter-tab ${filter===key?'active':''}">${label}</button>`).join('')}</div>
 <div class="list-caption">${products.length} 件の商品</div>
 ${products.length?`<div class="panel product-list">${products.sort((a,b)=>a.name.localeCompare(b.name,'ja')).map(p=>productCard(p)).join('')}</div>`:empty('該当する商品がありません','検索条件を変えるか、新しく商品を登録してください。',primaryButton('＋ 商品を登録','add-product'))}`;
}
function shopping(){const valid=state.shopping.map(x=>({...x,product:getProduct(x.productId)})).filter(x=>x.product);
 const available=liveProducts();return `${pageHeading('SHOPPING LIST','買い物リスト','買うものをリストにして、買い忘れを防ぎます。',primaryButton('＋ リストに追加','add-shopping'))}
 <div class="shopping-layout"><div class="panel"><div class="section-title"><div><h2>買うもの</h2><p>購入したら「購入完了」で在庫に反映されます</p></div>${tinyPill(`${valid.length}件`,'green')}</div>
 ${valid.length?`<div class="shopping-list">${valid.map(item=>`<div class="shopping-item"><div class="shopping-item-symbol">${catIcons[item.product.category]||'📦'}</div><div class="shopping-item-info"><strong>${escapeHtml(item.product.name)}</strong><small>現在庫 ${fmtNum(item.product.quantity)} ${escapeHtml(item.product.unit)}</small></div><div class="shopping-item-right"><span>${fmtNum(item.quantity)} ${escapeHtml(item.product.unit)}</span><div class="shopping-buttons"><button class="small-button success" data-action="purchased" data-id="${item.id}">✓ 購入完了</button><button class="small-button subtle" data-action="edit-shopping" data-id="${item.id}">数量</button><button class="small-button danger-text" data-action="remove-shopping" data-id="${item.id}">削除</button></div></div></div>`).join('')}</div>`:empty('買い物リストは空です','在庫一覧から商品を追加することもできます。')}</div>
 <div class="panel suggestions"><div class="section-title"><div><h2>補充候補</h2><p>在庫不足から自動で提案</p></div></div>${available.filter(p=>shortage(p)&&!valid.some(x=>x.productId===p.id)).length?available.filter(p=>shortage(p)&&!valid.some(x=>x.productId===p.id)).map(p=>`<div class="suggestion"><div><strong>${escapeHtml(p.name)}</strong><small>おすすめ ${fmtNum(suggestedPurchase(p)||1)} ${escapeHtml(p.unit)}</small></div><button class="small-button" data-action="shop" data-id="${p.id}">＋ 追加</button></div>`).join(''):empty('補充候補はありません','在庫不足の商品がここに表示されます。')}</div></div>`;
}
function history(){const rows=state.events.slice(0,200);return `${pageHeading('ACTIVITY','在庫の履歴','入庫・使用・購入など、最近の変更を確認できます。')}<div class="panel">${rows.length?`<div class="history-list">${rows.map(e=>`<div class="history-row"><div class="history-marker ${e.delta>0?'positive':'negative'}">${e.delta>0?'＋':'−'}</div><div class="history-info"><strong>${escapeHtml(e.name)}</strong><small>${escapeHtml(e.type)}${e.note?' · '+escapeHtml(e.note):''} · ${escapeHtml(localDate(e.at))}</small></div><div class="history-delta ${e.delta>0?'positive':'negative'}">${e.delta>0?'+':''}${fmtNum(e.delta)} ${escapeHtml(e.unit)}</div></div>`).join('')}</div>`:empty('まだ履歴はありません','商品の数量を変更すると、ここに記録されます。')}</div>`;}
function settings(){return `${pageHeading('SETTINGS','設定とデータ管理','自分の暮らしに合わせて管理項目を追加できます。')}<div class="settings-grid"><div class="panel"><div class="section-title"><div><h2>カテゴリ</h2><p>登録済み ${state.categories.length} 件</p></div></div><div class="tag-wrap">${state.categories.map(c=>`<span class="tag">${catIcons[c]||'📦'} ${escapeHtml(c)}</span>`).join('')}</div><form id="category-form" class="inline-form"><input name="value" maxlength="40" placeholder="カテゴリ名を追加" required><button class="button secondary" type="submit">追加</button></form></div><div class="panel"><div class="section-title"><div><h2>保管場所</h2><p>登録済み ${state.locations.length} 件</p></div></div><div class="tag-wrap">${state.locations.map(x=>`<span class="tag">${escapeHtml(x)}</span>`).join('')}</div><form id="location-form" class="inline-form"><input name="value" maxlength="40" placeholder="保管場所を追加" required><button class="button secondary" type="submit">追加</button></form></div>
 <div class="panel"><div class="section-title"><div><h2>期限の警告</h2><p>設定日数以内の期限を表示</p></div></div><form id="expiry-form" class="inline-form"><label for="expiry-days">期限の何日前から警告？</label><input id="expiry-days" name="days" type="number" min="0" max="365" step="1" value="${state.settings.expiryDays}" required><button class="button secondary" type="submit">保存</button></form></div>
 <div class="panel"><div class="section-title"><div><h2>バックアップ</h2><p>機種変更や端末故障への備えに</p></div></div><div class="settings-actions"><button class="button secondary" data-action="export-json">JSONバックアップ</button><button class="button secondary" data-action="import-json">JSONから復元</button><button class="button secondary" data-action="export-csv">商品一覧CSV</button></div><p class="hint">この端末内でのみ保存しています。ブラウザのデータ消去で在庫が消えるため、定期的にJSONバックアップを保存してください。CSVは商品一覧の取り出し専用で、復元にはJSONを使います。</p></div>
 </div>`;}
function render(){const navHtml=tabs.map(([id,label])=>`<button data-action="nav" data-value="${id}" class="nav-item ${view===id?'active':''}" aria-current="${view===id?'page':'false'}"><span aria-hidden="true" class="nav-icon">${icons[id]}</span><span>${label}</span></button>`).join('');$('#side-nav').innerHTML=navHtml;$('#bottom-nav').innerHTML=navHtml;$('#today-label').textContent=today;
 $('#app').innerHTML=({home:dashboard,inventory,shopping,history,settings}[view]||dashboard)();}
function options(items,current=''){return items.map(v=>`<option value="${escapeHtml(v)}" ${v===current?'selected':''}>${escapeHtml(v)}</option>`).join('');}
function showModal(html){$('#modal-body').innerHTML=html;const dlg=$('#modal');if(!dlg.open)dlg.showModal();$('#modal-body input:not([type=hidden]),#modal-body select')?.focus();}
function closeModal(){$('#modal').close();}
function productDialog(id=null){const p=id?getProduct(id):null; if(id&&!p)return;
 const title=p?'商品を編集':'新しい商品を登録';const v=(x)=>escapeHtml(x??'');
 showModal(`<div class="modal-header"><div><div class="eyebrow">PRODUCT</div><h2>${title}</h2><p>商品名、在庫数、期限などを登録します。</p></div><button type="button" data-action="close-modal" class="close-button" aria-label="閉じる">×</button></div>
 <form id="product-form" data-id="${p?.id||''}"><div class="field"><label>商品名 <b>必須</b></label><input name="name" value="${v(p?.name)}" maxlength="100" placeholder="例：洗濯洗剤 詰替用" required></div><div class="form-grid"><div class="field"><label>カテゴリ</label><select name="category">${options(state.categories,p?.category||'その他')}</select></div><div class="field"><label>保管場所</label><select name="location">${options(state.locations,p?.location||'キッチン')}</select></div></div>
 <div class="form-grid"><div class="field"><label>単位</label><select name="unit">${options([...new Set([...DEFAULT_UNITS,...(p?[p.unit]:[])])],p?.unit||'個')}</select></div>${!p?`<div class="field"><label>現在の数量</label><input type="number" name="quantity" min="0" step="any" value="0" required></div>`:`<div class="field"><label>現在の数量</label><input value="${fmtNum(p.quantity)} ${v(p.unit)}" disabled><small>数量変更は在庫一覧から行います。</small></div>`}</div>
 <div class="form-grid"><div class="field"><label>最低在庫数</label><input type="number" name="minStock" min="0" step="any" value="${v(p?.minStock??1)}"></div><div class="field"><label>目標在庫数</label><input type="number" name="targetStock" min="0" step="any" value="${v(p?.targetStock??3)}"></div></div>
 <div class="form-grid"><div class="field"><label>期限（任意）</label><input type="date" name="expiry" value="${v(p?.expiry)}"></div><div class="field"><label>参考価格（円）</label><input type="number" name="price" min="0" step="1" value="${v(p?.price)}" placeholder="例：298"></div></div><div class="field"><label>メモ</label><textarea name="notes" rows="2" maxlength="500" placeholder="容量・購入先など">${v(p?.notes)}</textarea></div><div class="modal-actions">${p?`<button type="button" class="button danger-outline" data-action="archive" data-id="${p.id}">アーカイブ</button>`:''}<button type="button" data-action="close-modal" class="button secondary">キャンセル</button><button type="submit" class="button primary">${p?'変更を保存':'登録する'}</button></div></form>`);
}
function adjustDialog(id,defaultType='使用',defaultValue=1){const p=getProduct(id);if(!p)return;showModal(`<div class="modal-header"><div><div class="eyebrow">STOCK</div><h2>${escapeHtml(p.name)}</h2><p>現在庫：${fmtNum(p.quantity)} ${escapeHtml(p.unit)}</p></div><button class="close-button" data-action="close-modal">×</button></div><form id="adjust-form" data-id="${p.id}"><div class="field"><label>処理</label><select name="type"><option value="使用" ${defaultType==='使用'?'selected':''}>使用する（減らす）</option><option value="補充" ${defaultType==='補充'?'selected':''}>補充する（増やす）</option><option value="廃棄">廃棄する（減らす）</option></select></div><div class="field"><label>数量（${escapeHtml(p.unit)}）</label><input name="quantity" type="number" step="any" min="0.001" value="${defaultValue}" required></div><div class="field"><label>メモ（任意）</label><input name="note" maxlength="100" placeholder="例：週末の買い物"></div><div class="modal-actions"><button class="button secondary" type="button" data-action="close-modal">キャンセル</button><button class="button primary" type="submit">在庫を更新</button></div></form>`);}
function shoppingDialog(id=null){const all=liveProducts();const initial=id?getProduct(id):all[0];if(!initial){notify('先に商品を登録してください',true);return;}
 const qty=Math.max(1,suggestedPurchase(initial));showModal(`<div class="modal-header"><div><div class="eyebrow">SHOPPING</div><h2>買い物リストに追加</h2><p>補充する数量を決めましょう。</p></div><button class="close-button" data-action="close-modal">×</button></div><form id="shopping-form"><div class="field"><label>商品</label><select name="productId" id="shopping-product">${all.map(p=>`<option value="${p.id}" ${p.id===initial.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select></div><div class="field"><label>購入予定数</label><input name="quantity" type="number" step="any" min="0.001" value="${qty}" required></div><div class="modal-actions"><button class="button secondary" data-action="close-modal" type="button">キャンセル</button><button class="button primary" type="submit">リストに追加</button></div></form>`);}
function editShoppingDialog(id){const item=state.shopping.find(x=>x.id===id),p=item&&getProduct(item.productId);if(!p)return;
 showModal(`<div class="modal-header"><div><div class="eyebrow">SHOPPING</div><h2>購入予定数を変更</h2><p>${escapeHtml(p.name)}</p></div><button class="close-button" data-action="close-modal">×</button></div><form id="shopping-qty-form" data-id="${id}"><div class="field"><label>購入予定数（${escapeHtml(p.unit)}）</label><input name="quantity" type="number" step="any" min="0.001" value="${item.quantity}" required></div><div class="modal-actions"><button type="button" class="button secondary" data-action="close-modal">キャンセル</button><button type="submit" class="button primary">保存</button></div></form>`);
}
function download(filename,data,mime){const blob=new Blob([data],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function execute(action,id,value){try{switch(action){
  case 'nav':go(value);break;case 'go-inventory':go('inventory');break;case 'go-shopping':go('shopping');break;
  case 'show-low':go('inventory');filter='low';render();break;case 'show-expiry':go('inventory');filter='expiry';render();break;
  case 'filter':filter=value;render();break;case 'add-product':productDialog();break;case 'edit':productDialog(id);break;
  case 'close-modal':closeModal();break;case 'consume':persist(changeStock(state,id,-1,'使用'),'1つ使用しました');break;
  case 'replenish':persist(changeStock(state,id,1,'補充'),'1つ補充しました');break;
  case 'adjust':adjustDialog(id);break;case 'shop':shoppingDialog(id);break;case 'add-shopping':shoppingDialog();break;
  case 'remove-shopping':persist(removeShopping(state,id),'買い物リストから削除しました');break;
  case 'purchased':{const item=state.shopping.find(x=>x.id===id);if(!item)break;persist(purchaseShopping(state,id),'購入分を在庫に反映しました');break;}
  case 'edit-shopping':editShoppingDialog(id);break;
  case 'archive':{if(!confirm('商品をアーカイブしますか？ 履歴は残りますが在庫一覧には表示されなくなります。'))break;persist(archiveProduct(state,id),'商品をアーカイブしました');closeModal();break;}
  case 'export-json':download('kurashi-stock-backup-'+new Date().toISOString().slice(0,10)+'.json',exportBackup(state),'application/json;charset=utf-8');notify('JSONバックアップを保存しました');break;
  case 'export-csv':download('kurashi-stock-products.csv',csvProducts(state),'text/csv;charset=utf-8');notify('CSVファイルを保存しました');break;
  case 'import-json':$('#backup-file').click();break;
 }}catch(e){notify(e.message||'操作できませんでした',true);}}
document.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn||btn.disabled)return;execute(btn.dataset.action,btn.dataset.id,btn.dataset.value);});
document.addEventListener('submit',e=>{const form=e.target;const known=['product-form','adjust-form','shopping-form','shopping-qty-form','category-form','location-form','expiry-form'];if(!known.includes(form.id))return;
 e.preventDefault();try{const d=Object.fromEntries(new FormData(form).entries());switch(form.id){
  case 'product-form':persist(form.dataset.id?editProduct(state,form.dataset.id,d):addProduct(state,d),form.dataset.id?'商品を変更しました':'商品を登録しました');closeModal();break;
  case 'adjust-form':{const qty=Number(d.quantity),delta=['使用','廃棄'].includes(d.type)?-qty:qty;persist(changeStock(state,form.dataset.id,delta,d.type,d.note),'在庫を更新しました');closeModal();break;}
  case 'shopping-form':persist(addToShopping(state,d.productId,d.quantity),'買い物リストに追加しました');closeModal();break;
  case 'shopping-qty-form':persist(setShoppingQuantity(state,form.dataset.id,d.quantity),'購入予定数を変更しました');closeModal();break;
  case 'category-form':persist(addCategoryOrLocation(state,'categories',d.value),'カテゴリを追加しました');break;
  case 'location-form':persist(addCategoryOrLocation(state,'locations',d.value),'保管場所を追加しました');break;
  case 'expiry-form':{const days=Number(d.days);if(!Number.isInteger(days)||days<0||days>365)throw new Error('0〜365日で設定してください');persist({...state,settings:{...state.settings,expiryDays:days}},'期限の警告日数を保存しました');break;}
 }}catch(err){notify(err.message||'入力を確認してください',true);}});
document.addEventListener('input',e=>{if(e.target.id==='search'){const start=e.target.selectionStart;search=e.target.value;render();const input=$('#search');input.focus();input.setSelectionRange(start,start);}});
document.addEventListener('change',e=>{if(e.target.id==='category-filter'){categoryFilter=e.target.value;render();}if(e.target.id==='shopping-product'){const p=getProduct(e.target.value);if(p){const inp=$('#shopping-form input[name=quantity]');inp.value=Math.max(1,suggestedPurchase(p));}}});
$('#backup-file').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>15*1024*1024){notify('15MB以下のバックアップを選択してください',true);return;}try{const raw=await file.text(),parsed=importBackup(raw);if(!confirm(`バックアップ内の${parsed.products.length}件の商品で現在のデータを置き換えますか？ この操作は元に戻せません。`))return;persist(parsed,'バックアップを復元しました');}catch(err){notify('バックアップを読み込めません: '+err.message,true);}});
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal();});
render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('オフラインキャッシュの登録に失敗:',error)));
}
