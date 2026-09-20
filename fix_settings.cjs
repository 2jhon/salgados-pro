const fs = require('fs');

// 1. UPDATE useSettingsLogic.ts
let logic = fs.readFileSync('hooks/useSettingsLogic.ts', 'utf8');

logic = logic.replace(
  "const [manageForm, setManageForm] = useState({ \n    name: '', category: '', priceVista: '', pricePrazo: '', imageUrl: '',\n    promoVista: '', promoPrazo: '', promoEndsAt: ''\n  });",
  "const [manageForm, setManageForm] = useState({ \n    name: '', category: '', priceVista: '', pricePrazo: '', costPrice: '', imageUrl: '',\n    promoVista: '', promoPrazo: '', promoEndsAt: ''\n  });"
);

// If the previous replace didn't work because of spacing, try a simpler regex:
logic = logic.replace(/const \[manageForm, setManageForm\] = useState\(\{([\s\S]*?)promoEndsAt: ''\n  \}\);/, 
"const [manageForm, setManageForm] = useState({ \n    name: '', category: '', priceVista: '', pricePrazo: '', costPrice: '', imageUrl: '',\n    promoVista: '', promoPrazo: '', promoEndsAt: ''\n  });");

logic = logic.replace(
  "const priceV = parseFloat((manageForm.priceVista || '0').replace(',', '.')) || 0;",
  "const priceV = parseFloat((manageForm.priceVista || '0').replace(',', '.')) || 0;\n        const costP = parseFloat((manageForm.costPrice || '0').replace(',', '.')) || 0;"
);

logic = logic.replace(
  "currentStock: 0, minStock: 0, trackStock: true",
  "currentStock: 0, minStock: 0, trackStock: true, costPrice: costP > 0 ? costP : undefined"
);

logic = logic.replace(
  "setManageForm({\n      name: item.name,\n      category: item.category || '',\n      priceVista: item.defaultPriceAVista?.toString() || '',\n      pricePrazo: item.defaultPriceAPrazo?.toString() || '',\n      imageUrl: item.imageUrl || '',\n      promoVista: item.promotionalPriceAVista?.toString() || '',\n      promoPrazo: item.promotionalPriceAPrazo?.toString() || '',\n      promoEndsAt: item.promoEndsAt || ''\n    });",
  "setManageForm({\n      name: item.name,\n      category: item.category || '',\n      priceVista: item.defaultPriceAVista?.toString() || '',\n      pricePrazo: item.defaultPriceAPrazo?.toString() || '',\n      costPrice: item.costPrice?.toString() || '',\n      imageUrl: item.imageUrl || '',\n      promoVista: item.promotionalPriceAVista?.toString() || '',\n      promoPrazo: item.promotionalPriceAPrazo?.toString() || '',\n      promoEndsAt: item.promoEndsAt || ''\n    });"
);

fs.writeFileSync('hooks/useSettingsLogic.ts', logic);

// 2. UPDATE Settings.tsx
let settings = fs.readFileSync('components/Settings.tsx', 'utf8');

const costInputStr = `
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-rose-500 uppercase tracking-widest ml-3">R$ Custo (Unidade)</label>
                          <input 
                            value={manageForm.costPrice}
                            onChange={e => setManageForm({...manageForm, costPrice: e.target.value})}
                            placeholder="0,00" 
                            className="w-full p-4 bg-white rounded-xl font-black text-rose-700 outline-none border border-slate-100"
                          />
                       </div>`;

settings = settings.replace(
  '<label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">R$ Prazo</label>',
  '<label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">R$ Prazo</label>'
);

settings = settings.replace(
  '                           className="w-full p-4 bg-white rounded-xl font-black text-slate-700 outline-none border border-slate-100"\n                          />\n                       </div>\n                       <div className="space-y-1">\n                          <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest ml-3">R$ Promo Vista</label>',
  '                           className="w-full p-4 bg-white rounded-xl font-black text-slate-700 outline-none border border-slate-100"\n                          />\n                       </div>' + costInputStr + '\n                       <div className="space-y-1">\n                          <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest ml-3">R$ Promo Vista</label>'
);

settings = settings.replace(
  "setManageForm({ name: '', category: '', priceVista: '', pricePrazo: '', imageUrl: '', promoVista: '', promoPrazo: '', promoEndsAt: '' });",
  "setManageForm({ name: '', category: '', priceVista: '', pricePrazo: '', costPrice: '', imageUrl: '', promoVista: '', promoPrazo: '', promoEndsAt: '' });"
);

fs.writeFileSync('components/Settings.tsx', settings);
