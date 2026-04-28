
import React from 'react';
import { Zap, Info, MessageCircle, CheckCircle2, EyeOff, Megaphone, Loader2 } from 'lucide-react';
import { User, SubscriptionPlan } from '../../types';
import { toast } from 'sonner';

interface PlansTabProps {
  plans: SubscriptionPlan[];
  currentUser: User;
  isProActive: boolean;
  supportPhone: string;
}

export const PlansTab: React.FC<PlansTabProps> = ({ 
  plans, currentUser, isProActive, supportPhone 
}) => {
  const [isBuying, setIsBuying] = React.useState<string | null>(null);

  const handleBuyPlan = async (plan: SubscriptionPlan) => {
    if (isBuying) return;
    setIsBuying(plan.id);
    
    try {
      const response = await fetch('/api/mercadopago/create-plan-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          userId: currentUser.id,
          planName: plan.name,
          price: plan.price,
          returnUrl: window.location.origin
        })
      });

      const data = await response.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error(data.error || "Ponto de início não retornado");
      }
    } catch (e: any) {
      toast.error("Erro ao iniciar pagamento: " + (e.message || "Tente novamente mais tarde."));
      setIsBuying(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Plano Atual */}
      <div className="bg-[#131B2B] p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
        <h3 className="text-2xl font-black text-white mb-4">Plano Atual</h3>
        
        <div className="flex items-center gap-3 mb-8">
           {isProActive ? (
             <div className="bg-[#00C48C] text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                PRO ATIVO
             </div>
           ) : (
             <div className="bg-slate-800 text-slate-400 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                FREE
             </div>
           )}
           {isProActive && (
             <div className="bg-[#0A2624] text-[#00C48C] px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                ATIVAÇÃO RECENTE
             </div>
           )}
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className={`p-5 rounded-2xl border ${isProActive || currentUser.isAdFree ? 'bg-[#1C2438] border-[#2A344A] text-slate-300' : 'bg-[#182132] border-[#1F293D] text-slate-600'}`}>
              <EyeOff size={20} className="mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest">SEM ADS</p>
           </div>
           
           <div className={`p-5 rounded-2xl border ${isProActive || currentUser.isAdvertiser ? 'bg-[#1C2438] border-[#2A344A] text-slate-300' : 'bg-[#182132] border-[#1F293D] text-slate-600'}`}>
              <Megaphone size={20} className="mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest">ANUNCIANTE</p>
           </div>
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 ml-2">
            ASSINAR OU RENOVAR
         </h4>
         
         <div className="space-y-4">
              {plans.length > 0 ? (
                plans.filter(p => p.active).map(plan => (
                   <div 
                      key={plan.id}
                      onClick={() => handleBuyPlan(plan)}
                      className={`${
                        plan.grants_pro ? 'bg-[#131B2B] shadow-lg shadow-slate-900/10' : 'bg-white border border-slate-200'
                      } p-6 rounded-3xl flex items-center justify-between cursor-pointer hover:scale-[1.02] transition-transform`}
                   >
                      <div className="flex items-center gap-4">
                         <div className={plan.grants_pro ? 'text-amber-400' : 'text-slate-400'}>
                            {plan.grants_pro ? <Zap size={20} className="fill-current" /> : (plan.grants_ad_free ? <EyeOff size={20} /> : <Megaphone size={20} />)}
                         </div>
                         <div>
                            <h5 className={`text-[13px] font-black uppercase tracking-wide ${plan.grants_pro ? 'text-amber-400' : 'text-slate-700'}`}>
                              {plan.name}
                            </h5>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{plan.description}</p>
                         </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                         {isBuying === plan.id ? (
                            <Loader2 className="animate-spin text-slate-400" size={20} />
                         ) : (
                            <div className="flex items-baseline gap-1">
                               <p className={`text-xl font-black ${plan.grants_pro ? 'text-white' : 'text-slate-800'}`}>R$ {plan.price.toFixed(2)}</p>
                               <span className="text-[9px] font-bold text-slate-500 uppercase">/MÊS</span>
                            </div>
                         )}
                      </div>
                   </div>
                ))
              ) : (
                <div className="text-center py-8">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Carregando planos disponíveis...</p>
                </div>
              )}

             <button 
                onClick={() => window.open(`https://wa.me/55${supportPhone}?text=Ol%C3%A1%2C%20tenho%20interesse%20nos%20planos`, '_blank')}
                className="w-full mt-6 py-5 bg-[#00A669] text-white rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 hover:bg-[#00905A] transition-colors"
             >
                <MessageCircle size={16} /> FALAR COM SUPORTE
             </button>
         </div>
      </div>

    </div>
  );
};