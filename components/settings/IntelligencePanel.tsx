import React, { useEffect, useState } from 'react';
import { StoreAnalyticsSummary, StoreProfile } from '../../types';
import { useAnalytics } from '../../hooks/useAnalytics';
import { Eye, MousePointerClick, Heart, Star, Users, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

interface IntelligencePanelProps {
  workspaceId: string;
  profile: StoreProfile | null;
}

export const IntelligencePanel: React.FC<IntelligencePanelProps> = ({ workspaceId, profile }) => {
  const { getStoreSummary, getTopProducts } = useAnalytics();
  const [summary, setSummary] = useState<StoreAnalyticsSummary | null>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [sumData, topProdData] = await Promise.all([
          getStoreSummary(workspaceId),
          getTopProducts(workspaceId)
        ]);
        if (sumData) setSummary(sumData);
        if (topProdData) {
            // Resolve names based on the profile portfolio
            const resolved = topProdData.map(t => {
                const item = profile?.portfolio?.find((p: any) => String(p.id) === String(t.productId));
                return {
                    ...t,
                    productName: item?.name || 'Produto Não Encontrado',
                    imageUrl: item?.imageUrl
                };
            });
            setTopProducts(resolved);
        }
      } catch (error) {
        console.error("Erro no BI Panel:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workspaceId, profile, getStoreSummary, getTopProducts]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center opacity-50">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50">
           <Eye className="w-8 h-8 text-indigo-500 mb-3 opacity-80" />
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Views</p>
           <p className="text-3xl font-black text-slate-800 mt-1">{summary?.totalViews || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50">
           <MousePointerClick className="w-8 h-8 text-emerald-500 mb-3 opacity-80" />
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Cliques</p>
           <p className="text-3xl font-black text-slate-800 mt-1">{summary?.totalClicks || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50">
           <Heart className="w-8 h-8 text-rose-500 mb-3 opacity-80" />
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Favoritos</p>
           <p className="text-3xl font-black text-slate-800 mt-1">{summary?.totalFavorites || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50">
           <Users className="w-8 h-8 text-sky-500 mb-3 opacity-80" />
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seguidores</p>
           <p className="text-3xl font-black text-slate-800 mt-1">{summary?.totalFollowers || 0}</p>
        </div>
      </div>

      {topProducts.length > 0 && (
         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Produtos Mais Acessados</h3>
            <div className="space-y-4">
              {topProducts.slice(0, 5).map((prod, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                       {prod.imageUrl ? (
                           <img src={prod.imageUrl} alt={prod.productName} className="w-10 h-10 rounded-xl object-cover" />
                       ) : (
                           <div className="w-10 h-10 rounded-xl bg-slate-200"></div>
                       )}
                       <div>
                          <p className="font-bold text-sm text-slate-800">{prod.productName}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RANK #{idx + 1}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="font-black text-lg text-emerald-600">{prod.clicks}</p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cliques</p>
                    </div>
                </div>
              ))}
            </div>
         </div>
      )}
    </div>
  );
};
