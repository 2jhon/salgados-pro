const fs = require('fs');
['components/Factory.tsx', 'components/Stall.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /if \(e\.message === "IOS_NOT_SUPPORTED"\) \{/,
    "if (e.message === 'USER_CANCELLED') {\n                        toast.dismiss(toastId);\n                      } else if (e.message === 'IOS_NOT_SUPPORTED') {"
  );
  fs.writeFileSync(file, content);
});
