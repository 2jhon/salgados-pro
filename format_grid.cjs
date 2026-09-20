const fs = require('fs');

let content = fs.readFileSync('components/Settings.tsx', 'utf8');

const oldGrid = `<div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">R$ Vista</label>
                          <input 
                            value={manageForm.priceVista} 
                            onChange={e => setManageForm({...manageForm, priceVista: e.target.value})} 
                            placeholder="0,00" 
                            className="w-full p-4 bg-white rounded-xl font-black text-slate-700 outline-none border border-slate-100"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">R$ Prazo</label>
                          <input 
                            value={manageForm.pricePrazo} 
                            onChange={e => setManageForm({...manageForm, pricePrazo: e.target.value})} 
                            placeholder="0,00" 
                            className="w-full p-4 bg-white rounded-xl font-black text-slate-700 outline-none border border-slate-100"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-rose-500 uppercase tracking-widest ml-3">R$ Custo (Unidade)</label>
                          <input 
                            value={manageForm.costPrice}
                            onChange={e => setManageForm({...manageForm, costPrice: e.target.value})}
                            placeholder="0,00" 
                            className="w-full p-4 bg-white rounded-xl font-black text-rose-700 outline-none border border-slate-100"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest ml-3">R$ Promo Vista</label>
                          <input 
                            value={manageForm.promoVista} 
                            onChange={e => setManageForm({...manageForm, promoVista: e.target.value})} 
                            placeholder="0,00" 
                            className="w-full p-4 bg-emerald-50 text-emerald-700 rounded-xl font-black outline-none border border-emerald-100"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest ml-3">R$ Promo Prazo</label>
                          <input 
                            value={manageForm.promoPrazo} 
                            onChange={e => setManageForm({...manageForm, promoPrazo: e.target.value})} 
                            placeholder="0,00" 
                            className="w-full p-4 bg-emerald-50 text-emerald-700 rounded-xl font-black outline-none border border-emerald-100"
                          />
                       </div>
                    </div>`;

const newGrid = `<div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">R$ Vista</label>
                            <input 
                              value={manageForm.priceVista} 
                              onChange={e => setManageForm({...manageForm, priceVista: e.target.value})} 
                              placeholder="0,00" 
                              className="w-full p-4 bg-white rounded-xl font-black text-slate-700 outline-none border border-slate-100"
                            />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">R$ Prazo</label>
                            <input 
                              value={manageForm.pricePrazo} 
                              onChange={e => setManageForm({...manageForm, pricePrazo: e.target.value})} 
                              placeholder="0,00" 
                              className="w-full p-4 bg-white rounded-xl font-black text-slate-700 outline-none border border-slate-100"
                            />
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                         <div className="space-y-1 col-span-1">
                            <label className="text-[8px] font-black text-rose-500 uppercase tracking-widest ml-3" title="Preço de custo para cálculo de lucro">R$ Custo (Unid)</label>
                            <input 
                              value={manageForm.costPrice}
                              onChange={e => setManageForm({...manageForm, costPrice: e.target.value})}
                              placeholder="0,00" 
                              className="w-full p-4 bg-rose-50 rounded-xl font-black text-rose-700 outline-none border border-rose-100"
                            />
                         </div>
                         <div className="space-y-1 col-span-1">
                            <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest ml-3">R$ Promo Vista</label>
                            <input 
                              value={manageForm.promoVista} 
                              onChange={e => setManageForm({...manageForm, promoVista: e.target.value})} 
                              placeholder="0,00" 
                              className="w-full p-4 bg-emerald-50 text-emerald-700 rounded-xl font-black outline-none border border-emerald-100"
                            />
                         </div>
                         <div className="space-y-1 col-span-1">
                            <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest ml-3">R$ Promo Praz</label>
                            <input 
                              value={manageForm.promoPrazo} 
                              onChange={e => setManageForm({...manageForm, promoPrazo: e.target.value})} 
                              placeholder="0,00" 
                              className="w-full p-4 bg-emerald-50 text-emerald-700 rounded-xl font-black outline-none border border-emerald-100"
                            />
                         </div>
                      </div>
                    </div>`;

if (content.includes('R$ Custo (Unidade)')) {
    const startIndex = content.indexOf('<div className="grid grid-cols-2 gap-3">');
    const endIndex = content.indexOf('</div>\n   \n                    <button ', startIndex) || content.indexOf('</div>\n                    <button ', startIndex);
    
    // We will do it simpler: just replace everything between <div className="grid grid-cols-2 gap-3"> and <button onClick={handleSaveManageItem}
    content = content.replace(/<div className="grid grid-cols-2 gap-3">[\s\S]*?(?=<button \n                      onClick=\{handleSaveManageItem\})/g, newGrid + "\n                    ");
    fs.writeFileSync('components/Settings.tsx', content);
}
