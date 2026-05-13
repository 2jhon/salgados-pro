import http from 'http';
const req = http.request('http://localhost:3000/api/admin/ads/approve', {method: 'POST', headers: {'content-type': 'application/json'}}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', body));
});
req.on('error', e => console.error(e));
req.write(JSON.stringify({adId:'1',secret:'APP_USR-6530054478198582-042418-54bca1c838b02982555169fa9e5e464f-197672024'}));
req.end();
