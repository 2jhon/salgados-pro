import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { Coupon } from '../types';
import { Plus, Trash2, Edit3, Save, X, Loader2, Tag, Percent, DollarSign } from 'lucide-react';

interface CouponManagerProps {
  workspaceId: string;
}

export const CouponManager: React.FC<CouponManagerProps> = ({ workspaceId }) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCoupons();
  }, [workspaceId]);

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map snake_case to camelCase
      const formatted = (data || []).map(c => ({
        id: c.id,
        workspaceId: c.workspace_id,
        code: c.code,
        discountType: c.discount_type,
        discountValue: c.discount_value,
        minPurchaseValue: c.min_purchase_value,
        maxUses: c.max_uses,
        currentUses: c.current_uses,
        expiresAt: c.expires_at,
        active: c.active,
        createdAt: c.created_at
      }));
      
      setCoupons(formatted);
    } catch (error) {
      console.error('Error fetching coupons:', error);
      toast.error('Erro ao carregar cupons');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingCoupon?.code || !editingCoupon?.discountValue) {
      toast.error('Preencha o código e o valor do desconto');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        workspace_id: workspaceId,
        code: editingCoupon.code.toUpperCase(),
        discount_type: editingCoupon.discountType || 'PERCENTAGE',
        discount_value: editingCoupon.discountValue,
        min_purchase_value: editingCoupon.minPurchaseValue || null,
        max_uses: editingCoupon.maxUses || null,
        expires_at: editingCoupon.expiresAt || null,
        active: editingCoupon.active ?? true
      };

      if (editingCoupon.id) {
        const { error } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', editingCoupon.id);
        if (error) throw error;
        toast.success('Cupom atualizado!');
      } else {
        const { error } = await supabase
          .from('coupons')
          .insert([payload]);
        if (error) {
            if (error.code === '23505') {
                toast.error('Já existe um cupom com este código.');
                setSaving(false);
                return;
            }
            throw error;
        }
        toast.success('Cupom criado!');
      }

      setShowModal(false);
      fetchCoupons();
    } catch (error) {
      console.error('Error saving coupon:', error);
      toast.error('Erro ao salvar cupom');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ active: !coupon.active })
        .eq('id', coupon.id);
      
      if (error) throw error;
      
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, active: !c.active } : c));
      toast.success(`Cupom ${coupon.active ? 'desativado' : 'ativado'}`);
    } catch (error) {
      console.error('Error toggling coupon:', error);
      toast.error('Erro ao alterar status do cupom');
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cupom?')) return;
    
    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setCoupons(prev => prev.filter(c => c.id !== id));
      toast.success('Cupom excluído');
    } catch (error) {
      console.error('Error deleting coupon:', error);
      toast.error('Erro ao excluir cupom');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Tag className="text-emerald-500" /> Cupons de Desconto
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Crie promoções para seus clientes</p>
        </div>
        <button 
          onClick={() => {
            setEditingCoupon({ discountType: 'PERCENTAGE', active: true });
            setShowModal(true);
          }}
          className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg hover:scale-105 transition-all"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="grid gap-4">
        {coupons.length === 0 ? (
          <div className="p-12 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-sm font-black text-slate-500 uppercase">Nenhum cupom criado</p>
            <p className="text-[10px] font-bold text-slate-400 mt-2">Crie seu primeiro cupom para impulsionar vendas</p>
          </div>
        ) : (
          coupons.map(coupon => (
            <div key={coupon.id} className={`p-5 rounded-[2rem] border flex items-center justify-between transition-all ${coupon.active ? 'bg-white border-emerald-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-75'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${coupon.active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                  {coupon.discountType === 'PERCENTAGE' ? <Percent size={24} /> : <DollarSign size={24} />}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">{coupon.code}</h3>
                  <p className="text-xs font-bold text-emerald-600">
                    {coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}% OFF` : `R$ ${coupon.discountValue.toFixed(2)} OFF`}
                  </p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Usos: {coupon.currentUses}{coupon.maxUses ? ` / ${coupon.maxUses}` : ''}</span>
                    {coupon.expiresAt && <span className="text-[9px] font-black text-orange-400 uppercase">Validade: {new Date(coupon.expiresAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => toggleActive(coupon)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${coupon.active ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                >
                  {coupon.active ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => { setEditingCoupon(coupon); setShowModal(true); }} className="p-3 bg-slate-50 text-blue-500 rounded-xl hover:bg-blue-50 transition-all"><Edit3 size={16} /></button>
                <button onClick={() => deleteCoupon(coupon.id)} className="p-3 bg-slate-50 text-rose-500 rounded-xl hover:bg-rose-50 transition-all"><Trash2 size={16} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && editingCoupon && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-3xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase">{editingCoupon.id ? 'Editar Cupom' : 'Novo Cupom'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20} /></button>
            </div>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Código do Cupom</label>
                <input 
                  value={editingCoupon.code || ''} 
                  onChange={e => setEditingCoupon({...editingCoupon, code: e.target.value.toUpperCase()})} 
                  placeholder="EX: FESTA20" 
                  className="w-full p-4 bg-slate-50 rounded-xl font-black text-lg uppercase outline-none" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Tipo de Desconto</label>
                  <select 
                    value={editingCoupon.discountType || 'PERCENTAGE'} 
                    onChange={e => setEditingCoupon({...editingCoupon, discountType: e.target.value as any})}
                    className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none"
                  >
                    <option value="PERCENTAGE">Porcentagem (%)</option>
                    <option value="FIXED">Valor Fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Valor do Desconto</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editingCoupon.discountValue || ''} 
                    onChange={e => setEditingCoupon({...editingCoupon, discountValue: parseFloat(e.target.value) || 0})} 
                    placeholder={editingCoupon.discountType === 'PERCENTAGE' ? 'Ex: 10' : 'Ex: 15.00'} 
                    className="w-full p-4 bg-slate-50 rounded-xl font-black text-lg outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Valor Mínimo de Compra (Opcional)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={editingCoupon.minPurchaseValue || ''} 
                  onChange={e => setEditingCoupon({...editingCoupon, minPurchaseValue: parseFloat(e.target.value) || undefined})} 
                  placeholder="R$ 0,00" 
                  className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Limite de Usos (Opcional)</label>
                  <input 
                    type="number" 
                    value={editingCoupon.maxUses || ''} 
                    onChange={e => setEditingCoupon({...editingCoupon, maxUses: parseInt(e.target.value) || undefined})} 
                    placeholder="Ex: 100" 
                    className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none" 
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Validade (Opcional)</label>
                  <input 
                    type="datetime-local" 
                    value={(() => {
                      try {
                        if (!editingCoupon.expiresAt) return '';
                        const d = new Date(editingCoupon.expiresAt);
                        if (isNaN(d.getTime())) return '';
                        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                      } catch { return ''; }
                    })()} 
                    onChange={e => {
                      if (!e.target.value) {
                        setEditingCoupon({...editingCoupon, expiresAt: undefined});
                        return;
                      }
                      const d = new Date(e.target.value);
                      if (!isNaN(d.getTime())) {
                        setEditingCoupon({...editingCoupon, expiresAt: d.toISOString()});
                      }
                    }} 
                    className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-600 outline-none" 
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={handleSave} 
              disabled={saving}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Salvar Cupom
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
