
import React, { useMemo, useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Clock, Zap } from 'lucide-react';
import { SubscriptionPlan, User } from '../types';

interface SystemPromoBannerProps {
  plans: SubscriptionPlan[];
  user: User;
  onNavigate: (tab: string) => void;
  variant?: 'DASHBOARD' | 'MARKETPLACE';
}

export const SystemPromoBanner: React.FC<SystemPromoBannerProps> = ({ plans, user, onNavigate, variant = 'DASHBOARD' }) => {
  const isOwner = user.role === 'OWNER';
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
  // Encontra o plano com a maior promoção ativa
  const promoPlan = useMemo(() => {
    return plans
      .filter(p => p.promo_price && p.promo_ends_at && new Date(p.promo_ends_at) > now)
      .sort((a, b) => {
        const discountA = (Number(a.price) - Number(a.promo_price!)) / Number(a.price);
        const discountB = (Number(b.price) - Number(b.promo_price!)) / Number(b.price);
        return discountB - discountA;
      })[0];
  }, [plans, now]);

  if (!isOwner || !promoPlan) return null;

  const discountPercent = Math.round(((Number(promoPlan.price) - Number(promoPlan.promo_price!)) / Number(promoPlan.price)) * 100);

  const handleBannerClick = () => {
    localStorage.setItem('settings_pending_tab', 'PLANOS');
    onNavigate('CONFIG');
  };

  if (variant === 'MARKETPLACE') {
    return (
      <div 
        onClick={handleBannerClick}
        className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[3rem] border-2 border-amber-500/30 shadow-2xl relative overflow-hidden cursor-pointer group hover:scale-[1.01] transition-all"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl" />
        <div className="relative flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-amber-500 text-slate-950 rounded-2xl shadow-xl shadow-amber-500/20">
            <Sparkles size={32} />
          </div>
          <div>
            <h4 className="text-xl font-black text-white uppercase tracking-tight">Destaque sua Empresa</h4>
            <p className="text-slate-400 text-xs font-medium max-w-[200px] mx-auto mt-2">
              Assine o plano <span className="text-amber-500 font-black">{promoPlan.name}</span> com {discountPercent}% de desconto e apareça no topo!
            </p>
          </div>
          <div className="flex items-center gap-2 text-amber-500 font-black text-sm">
             <span className="line-through text-slate-600 text-xs">R$ {Number(promoPlan.price).toFixed(2)}</span>
             <span>R$ {Number(promoPlan.promo_price).toFixed(2)}</span>
          </div>
          <button className="w-full py-4 bg-amber-500 text-slate-950 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 group-hover:bg-amber-400 transition-colors">
            Ver Oferta <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={handleBannerClick}
      className="group relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 p-6 rounded-[2.5rem] shadow-2xl shadow-orange-900/20 cursor-pointer hover:scale-[1.02] transition-all active:scale-95 mb-8"
    >
      {/* Efeitos de Fundo */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-black/10 rounded-full blur-2xl" />
      
      <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-white/20 backdrop-blur-md rounded-3xl shadow-inner">
            <Zap className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Oferta Limitada</span>
              <span className="text-amber-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                <Clock size={12} /> {discountPercent}% OFF
              </span>
            </div>
            <h3 className="text-2xl font-black text-white uppercase leading-tight">
              Upgrade para {promoPlan.name}
            </h3>
            <p className="text-amber-100/80 text-xs font-bold">
              De <span className="line-through opacity-60">R$ {Number(promoPlan.price).toFixed(2)}</span> por apenas <span className="text-white text-lg">R$ {Number(promoPlan.promo_price).toFixed(2)}</span>
            </p>
          </div>
        </div>

        <button className="px-8 py-4 bg-white text-orange-600 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl group-hover:shadow-white/20 flex items-center gap-2 transition-all">
          Aproveitar Agora <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
