import fetch from "node-fetch";

async function test() {
  const url = "http://localhost:3000/api/mercadopago/auth-url?workspaceId=test";
  const text = await (await fetch(url)).text();
  console.log(text);
}
test();
