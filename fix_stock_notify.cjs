const fs = require('fs');

function fix(file) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(
    /if \(addNote && item\.minStock !== undefined && newStock <= item\.minStock\) \{/g,
    "if (addNote && item.trackStock === true && item.minStock !== undefined && newStock <= item.minStock) {"
  );
  fs.writeFileSync(file, code);
}

fix('components/Stall.tsx');
fix('components/Factory.tsx');
