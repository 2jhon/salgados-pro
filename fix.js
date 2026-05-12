const fs = require('fs');
let content = fs.readFileSync('components/Factory.tsx', 'utf8');
content = content.replace('setCustomerName(\'\');\n        setNewCustomerPhone(\'\');\n        toast.success', 'setCustomerName(\'\');\n        setNewCustomerPhone(\'\');\n        setIsUnregistered(false);\n        toast.success');
fs.writeFileSync('components/Factory.tsx', content);
