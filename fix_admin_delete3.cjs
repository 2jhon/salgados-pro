const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');

const oldTablesStr = "const tables = ['transactions', 'inventory', 'notes', 'ads', 'app_banners', 'customers', 'reports', 'app_config', 'store_profiles', 'users'];";
const newTablesStr = "const tables = ['store_interactions', 'store_ratings', 'market_telemetry', 'coupons', 'historical_summaries', 'whatsapp_logs', 'payment_webhooks', 'stock_movements', 'store_analytics_views', 'store_analytics_clicks', 'transactions', 'inventory', 'notes', 'ads', 'app_banners', 'customers', 'reports', 'app_config', 'store_profiles', 'users'];";

serverCode = serverCode.replace(oldTablesStr, newTablesStr);
fs.writeFileSync('server.ts', serverCode);
