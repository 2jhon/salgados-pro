const now = new Date();
const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
const endOfDay = startOfDay + 86400000;
const tDate = now.toISOString();

const txTime = new Date(tDate).getTime();
console.log({ startOfDay, endOfDay, txTime, match: txTime >= startOfDay && txTime < endOfDay });
