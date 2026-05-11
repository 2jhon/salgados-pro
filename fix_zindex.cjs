const fs = require('fs');
const files = [
  'components/settings/TeamTab.tsx',
  'components/settings/SystemTab.tsx',
  'components/settings/StructureTab.tsx',
  'components/settings/AdsTab.tsx',
  'components/settings/CustomersTab.tsx',
  'components/SuperAdmin.tsx',
  'components/CouponManager.tsx',
  'components/ManagerActivity.tsx',
  'components/MarketplaceManager.tsx',
  'components/Stock.tsx',
  'components/Settings.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    content = content.replace(/confirmDeleteSectionId && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/confirmDeleteUserId && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/confirmClearInfo && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/confirmDeleteAdId && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/showConfirmDelete && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/confirmDeleteId && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/companyToDelete && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/confirmDeletePlanId && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/deleteConfirm && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
}
