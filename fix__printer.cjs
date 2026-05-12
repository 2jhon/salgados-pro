const fs = require('fs');
let content = fs.readFileSync('lib/printer.ts', 'utf8');
content = content.replace(
  /} catch \(error: any\) {\n\s*console.error\('Printer connection error:', error\);\n\s*throw error;\n\s*}/g,
  `} catch (error: any) {
      console.error('Printer connection error:', error);
      if (error && error.message && error.message.includes('User cancelled')) {
        console.warn('Usuário cancelou a seleção da impressora.');
        throw new Error('USER_CANCELLED');
      }
      throw error;
    }`
);
fs.writeFileSync('lib/printer.ts', content);
