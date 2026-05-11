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
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // For delete confirmation modals usually identified by checking confirmDelete variables
    // But safely we can just look for "fixed inset-0 z-[600]" or "z-[700]" inside confirm checks.
    // Or just all modals with Trash2. Let's just find and replace z-[600] and z-[700] where it's near Trash2 or where there's confirm modal.
    // Actually, I can globally make all specific confirmation modals 9999.
    
    // Quick regex to find generic modal wrapper right after a confirm condition:
    content = content.replace(/confirmDeleteSectionId && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/confirmDeleteUserId && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/confirmClearInfo && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/confirmDeleteAdId && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/showConfirmDelete && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/confirmDeleteId && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/companyToDelete && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    content = content.replace(/confirmDeletePlanId && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));

    // In Stock.tsx it's isConfirmingClear, wait Stock.tsx doesn't open modal, just button edit. But ManagerActivity has confirm
    content = content.replace(/deleteConfirm && \([\s\S]*?z-\[[0-9]+\]/g, (match) => match.replace(/z-\[[0-9]+\]/, 'z-[9999]'));
    
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
}
