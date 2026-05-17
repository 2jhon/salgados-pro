import React from 'react';
import { ShoppingCart, X, Trash2, Sparkles, Loader2, CreditCard, ShieldCheck } from 'lucide-react';
import { StoreProfile } from '../../types';

interface CartItem {
  product: any;
  qty: number;
}

interface CartModalProps {
  isCartOpen: boolean;
  setIsCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeView: StoreProfile | null;
  cart: CartItem[];
  removeFromCart: (idx: number) => void;
  getEffectivePrice: (item: any) => number;
  couponCode: string;
  setCouponCode: React.Dispatch<React.SetStateAction<string>>;
  appliedCoupon: any | null;
  setAppliedCoupon: React.Dispatch<React.SetStateAction<any | null>>;
  couponError: string;
  isApplyingCoupon: boolean;
  applyCoupon: () => void;
  cartTotal: number;
  discountAmount: number;
  deliveryFee: number | null;
  finalTotal: number;
  checkout: () => void;
}

export const CartModal: React.FC<CartModalProps> = ({
  isCartOpen,
  setIsCartOpen,
  activeView,
  cart,
  removeFromCart,
  getEffectivePrice,
  couponCode,
  setCouponCode,
  appliedCoupon,
  setAppliedCoupon,
  couponError,
  isApplyingCoupon,
  applyCoupon,
  cartTotal,
  discountAmount,
  deliveryFee,
  finalTotal,
  checkout
}) => {
  if (!isCartOpen || !activeView) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in slide-in-from-bottom-10">
      <div className="bg-white w-full max-w-sm h-[80vh] sm:h-auto rounded-t-[3rem] sm:rounded-[3rem] pt-8 px-8 pb-32 sm:pb-8 shadow-3xl flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><ShoppingCart size={24} /></div>
                <h3 className="text-xl font-black text-slate-800 uppercase">Seu Carrinho</h3>
            </div>
            <button onClick={() => setIsCartOpen(false)} className="p-2 bg-slate-50 rounded-full"><X size={20} /></button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {cart.map((item, idx) => {
                const effectivePrice = getEffectivePrice(item.product);
                return (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                        <p className="font-black text-slate-800 text-xs uppercase">{item.product.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">{item.qty}x R$ {effectivePrice.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <p className="font-black text-emerald-600 text-sm">R$ {(item.qty * effectivePrice).toFixed(2)}</p>
                        <button onClick={() => removeFromCart(idx)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl"><Trash2 size={16} /></button>
                    </div>
                  </div>
                );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
            {/* Coupon Section */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              {appliedCoupon ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Sparkles size={14} /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-800 uppercase">{appliedCoupon.code}</p>
                      <p className="text-[8px] font-bold text-emerald-600 uppercase">Cupom Aplicado</p>
                    </div>
                  </div>
                  <button onClick={() => setAppliedCoupon(null)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl"><X size={14} /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input 
                    value={couponCode} 
                    onChange={e => setCouponCode(e.target.value.toUpperCase())} 
                    placeholder="CUPOM DE DESCONTO" 
                    className="flex-1 bg-white p-3 rounded-xl text-[10px] font-black uppercase outline-none border border-slate-200 focus:border-emerald-500"
                  />
                  <button 
                    onClick={applyCoupon}
                    disabled={!couponCode || isApplyingCoupon}
                    className="px-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-50"
                  >
                    {isApplyingCoupon ? <Loader2 className="animate-spin" size={14} /> : 'Aplicar'}
                  </button>
                </div>
              )}
              {couponError && <p className="text-[9px] font-bold text-rose-500 mt-2 ml-1">{couponError}</p>}
            </div>

            <div className="flex justify-between items-center pt-2">
                <span className="text-[10px] font-black uppercase text-slate-400">Subtotal</span>
                <span className="text-sm font-black text-slate-600">R$ {(cartTotal || 0).toFixed(2)}</span>
            </div>

            {appliedCoupon && (
              <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-emerald-500">Desconto ({appliedCoupon.code})</span>
                  <span className="text-sm font-black text-emerald-600">- R$ {discountAmount.toFixed(2)}</span>
              </div>
            )}
            
            {activeView.fulfillmentMode !== 'PICKUP' && (
              <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-slate-400">Taxa de Entrega</span>
                  <span className={`text-sm font-black ${deliveryFee === 0 ? 'text-emerald-600' : deliveryFee === -1 ? 'text-rose-500' : 'text-slate-600'}`}>
                    {deliveryFee === 0 ? 'Grátis' : deliveryFee === -1 ? 'Fora da Área' : deliveryFee === null ? 'Ative o GPS' : `R$ ${deliveryFee.toFixed(2)}`}
                  </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                <span className="text-xs font-black uppercase text-slate-400">Total a Pagar</span>
                <span className="text-2xl font-black text-slate-800">R$ {(finalTotal || 0).toFixed(2)}</span>
            </div>
            
            <button 
              onClick={checkout} 
              disabled={deliveryFee === -1}
              className={`w-full py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all ${deliveryFee === -1 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white'}`}
            >
                <div className="flex items-center gap-2">
                   <CreditCard size={18} /> 
                   <span>Pagar e Finalizar</span>
                </div>
                <div className="flex items-center gap-1 opacity-70 text-[8px]">
                   <ShieldCheck size={10} />
                   <span>Pagamento Seguro via Mercado Pago</span>
                </div>
            </button>
          </div>
      </div>
    </div>
  );
};
