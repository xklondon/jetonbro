const id = process.env.RESEND_EMAIL_ID;
if (!id) {
  console.log(JSON.stringify({ found: false, reason: "missing-id" }));
  process.exit(2);
}
const origin = process.env.AUTH_URL ?? "https://jetbro-ii-web-production.up.railway.app";
const res = await fetch(`https://api.resend.com/emails/${id}`, {
  headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
});
const body = await res.json();
const text = String(body.text ?? body.html ?? "");
const url = text.match(/https:\/\/[^\s"']+/)?.[0] ?? "";
if (!url.startsWith(origin) || /localhost|127\.0\.0\.1/i.test(url)) {
  console.log(JSON.stringify({ found: false, urlSafe: false, hasText: Boolean(text) }));
  process.exit(3);
}
console.log(JSON.stringify({ found: true, urlSafe: true, url }));
