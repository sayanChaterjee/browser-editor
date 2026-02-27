const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3003,
  path: '/contest',
  method: 'POST',
  headers: {
    'x-user-id': 'test',
    'x-user-email': 'sayam@gmail.com'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});

req.on('error', e => console.error(e));
req.end();
