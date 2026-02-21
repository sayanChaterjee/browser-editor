const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('https://browser-editor-cyan.vercel.app/api/v1/user/profile', {
      headers: {
        // Need a valid session cookie to test this properly
      }
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.message, err.response?.data);
  }
}
test();
