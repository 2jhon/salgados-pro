const n = new Date();
const startOfDay = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
console.log(startOfDay, n.toISOString());
