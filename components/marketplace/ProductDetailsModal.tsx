import React from 'react';
import { ShoppingBag, X, Minus, Plus, MessageCircle } from 'lucide-react';

interface ProductDetailsModalProps {
  selectedProduct: any | null;
  setSelectedProduct: React.Dispatch<React.SetStateAction<any | null>>;
  isCartEnabled: boolean;
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
  addToCart: () => void;
  handleOrderSingle: (product: any) => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  selectedProduct,
  setSelectedProduct,
  isCartEnabled,
  quantity,
  setQuantity,
  addToCart,
  handleOrderSingle
}) => {
  if (!selectedProduct) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
        <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-3xl relative overflow-y-auto max-h-[90vh]">
          <button 
            onClick={() => setSelectedProduct(null)} 
            className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 transition-all z-10"
          >
              <X size={20} />
          </button>

          <div className="w-full aspect-square bg-slate-100 rounded-[2rem] mb-6 overflow-hidden shadow-inner flex items-center justify-center relative">
              {selectedProduct.imageUrl ? (
                <img src={selectedProduct.imageUrl} className="w-full h-full object-cover" />
              ) : (
                <div className="text-slate-300">
                    <ShoppingBag size={48} />
                </div>
              )}
          </div>

          <div className="mb-8">
              <h3 className="text-2xl font-black text-slate-800 uppercase leading-tight mb-2">{selectedProduct.name}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4">
                {selectedProduct.description || 'Sem descrição detalhada.'}
              </p>
              
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Preço Unitário</p>
                    <p className="text-2xl font-black text-emerald-600">R$ {(selectedProduct.price || 0).toFixed(2)}</p>
                </div>
                {isCartEnabled && (
                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 bg-slate-100 rounded-lg text-slate-500 hover:bg-slate-200"><Minus size={16} /></button>
                      <span className="font-black text-lg w-6 text-center">{quantity}</span>
                      <button onClick={() => setQuantity(quantity + 1)} className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"><Plus size={16} /></button>
                    </div>
                )}
              </div>
          </div>

          {isCartEnabled ? (
              <button 
                onClick={addToCart}
                className="w-full py-5 bg-slate-900 text-white rounded-[1.8rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <Plus size={20} /> Adicionar - R$ {((selectedProduct.price || 0) * quantity).toFixed(2)}
              </button>
          ) : (
              <button 
                onClick={() => handleOrderSingle(selectedProduct)}
                className="w-full py-5 bg-emerald-600 text-white rounded-[1.8rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-emerald-500"
              >
                <MessageCircle size={20} /> Pedir no WhatsApp
              </button>
          )}
        </div>
    </div>
  );
};
