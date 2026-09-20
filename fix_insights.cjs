const fs = require('fs');

let content = fs.readFileSync('components/ProductInsights.tsx', 'utf8');

// 1. Add sections to Props
content = content.replace(
  'isOwner?: boolean;',
  'isOwner?: boolean;\n  sections?: import(\'../types\').AppSection[];'
);

content = content.replace(
  'export const ProductInsights: React.FC<ProductInsightsProps> = ({ transactions, title = \'Desempenho de Produtos\', sectionName, isOwner }) => {',
  'export const ProductInsights: React.FC<ProductInsightsProps> = ({ transactions, title = \'Desempenho de Produtos\', sectionName, isOwner, sections }) => {'
);

// 2. Update stats calculation
content = content.replace(
  'const pStats: Record<string, { quantity: number; revenue: number }> = {};',
  `const costMap: Record<string, number> = {};
    if (sections) {
      sections.forEach(s => {
        s.items?.forEach(i => {
           if (i.costPrice) {
               costMap[i.name.toUpperCase()] = i.costPrice;
           }
        });
      });
    }

    const pStats: Record<string, { quantity: number; revenue: number; cost: number; net: number }> = {};`
);

content = content.replace(
  'if (!pStats[itemName]) pStats[itemName] = { quantity: 0, revenue: 0 };',
  'if (!pStats[itemName]) pStats[itemName] = { quantity: 0, revenue: 0, cost: 0, net: 0 };'
);

content = content.replace(
  'pStats[itemName].revenue += t.value;',
  `pStats[itemName].revenue += t.value;
        const qty = t.quantity || 1;
        const cost = (costMap[itemUpper] || 0) * qty;
        pStats[itemName].cost += cost;
        pStats[itemName].net += (t.value - cost);`
);

content = content.replace(
  'const tNetProfit = tSales - tExpenses;',
  `let tCost = 0;
    Object.values(pStats).forEach(s => { tCost += s.cost; });
    const tNetProfit = tSales - tCost - tExpenses;`
);
content = content.replace( // Just in case it's named differently
  'const netProfit = totalSales - totalExpenses;',
  `let tCost = 0;
    Object.values(pStats).forEach(s => { tCost += s.cost; });
    const netProfit = totalSales - tCost - totalExpenses;`
);

// 3. Add to the render UI
content = content.replace(
  '<TrendingUp className="w-3 h-3" /> {formatCurrency(stat.revenue)}',
  `<TrendingUp className="w-3 h-3" /> {formatCurrency(stat.revenue)}
                        </span>
                        {isOwner && (
                          <>
                            <span className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-1">
                               CMV: {formatCurrency(stat.cost)}
                            </span>
                            <span className="text-[10px] font-black text-indigo-500 uppercase flex items-center gap-1">
                               Líq: {formatCurrency(stat.net)}
                            </span>
                          </>
                        )`
);

// 4. Update PDF
content = content.replace(
  'head: [[\'Produto/Item\', \'Unidades\', \'Receita\']],',
  'head: [isOwner ? [\'Produto/Item\', \'Unid.\', \'Receita\', \'Custo (CMV)\', \'Lucro\'] : [\'Produto/Item\', \'Unidades\', \'Receita\']],'
);
content = content.replace(
  'body: productStats.map(s => [s.name, s.quantity, formatCurrency(s.revenue)]),',
  'body: productStats.map(s => isOwner ? [s.name, s.quantity, formatCurrency(s.revenue), formatCurrency(s.cost), formatCurrency(s.net)] : [s.name, s.quantity, formatCurrency(s.revenue)]),'
);


fs.writeFileSync('components/ProductInsights.tsx', content);
