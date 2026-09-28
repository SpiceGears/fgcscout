const baseUrl = (process.env.FGCSCOUT_BASE_URL ?? "http://localhost").replace(/\/$/, "");
const adminKey = process.env.FGCSCOUT_ADMIN_API_KEY;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path}: ${response.status}\n${body.slice(0, 500)}`);
  }
  return { response, body };
}

for (const path of ["/", "/events", "/matches", "/teams", "/privacy", "/health"]) {
  await request(path);
}

const seasons = await request("/api/Seasons");
const years = JSON.parse(seasons.body);
if (!Array.isArray(years)) throw new Error("/api/Seasons did not return an array");

const unauthorized = await fetch(`${baseUrl}/api/Teams`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
if (unauthorized.status !== 401) {
  throw new Error(`Public write protection failed: expected 401, received ${unauthorized.status}`);
}

if (adminKey) {
  await request("/api/Admin/seasons", { headers: { "X-Admin-Key": adminKey } });
}

const home = await request("/");
for (const header of ["content-security-policy", "x-content-type-options", "referrer-policy"]) {
  if (!home.response.headers.get(header)) throw new Error(`Missing security header: ${header}`);
}

console.log(`Smoke tests passed against ${baseUrl}`);
