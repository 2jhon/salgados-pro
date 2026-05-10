var n = new Date();
var startOfDay = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
console.log(startOfDay, n.toISOString());
