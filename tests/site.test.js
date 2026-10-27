// Teste do site num navegador de verdade (Playwright): abre, preenche,
// recarrega, faz backup e carrega backup. Rodar: npm run test:e2e
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

let server, browser, base;

before(async () => {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) return res.writeHead(403).end();
    fs.readFile(file, (err, body) => {
      if (err) return res.writeHead(404).end();
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file)] || "application/octet-stream",
      });
      res.end(body);
    });
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.close();
});

async function openPage() {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  // fontes do Google podem não carregar no teste; não importa aqui
  await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
  return { context, page, errors };
}

test("abre sem erros e mostra o Current CM e a lista de PvPs", async () => {
  const { context, page, errors } = await openPage();
  await page.goto(base);
  await page.waitForSelector(".curhero");
  assert.match(await page.textContent(".curhero"), /Current PvP/);
  for (const id of ["rank-aces", "rank-cards", "rank-borrowed"]) {
    await page.goto(base + "#" + id);
    await page.waitForSelector(".lhead h1");
    assert.equal(
      await page.isHidden("#back"),
      false,
      "seta de voltar na lista completa",
    );
  }
  await page.goto(base);
  await page.click("#nav-cms");
  await page.waitForSelector(".tile");
  assert.ok((await page.locator(".tile").count()) > 50);
  assert.deepEqual(errors, []);
  await context.close();
});

test("preencher um PvP salva no navegador e continua lá depois de recarregar", async () => {
  const { context, page, errors } = await openPage();
  await page.goto(base + "#cm-CM5");
  await page.click('[data-pl="1st"]');
  await page.fill("#rat-0", "4-5-4-4");
  await page.locator(".runner").first().locator(".main").click();
  await page.fill("#pk-q", "Oguri Cap");
  await page.locator("#pk-list button").first().click();
  await page.waitForFunction(
    () =>
      document.querySelector("#status").textContent === "Salvo neste navegador",
  );

  await page.reload();
  await page.waitForSelector('[data-pl="1st"]');
  assert.equal(
    await page.getAttribute('[data-pl="1st"]', "aria-pressed"),
    "true",
  );
  assert.equal(await page.inputValue("#rat-0"), "4-5-4-4");
  assert.match(await page.textContent(".runner .rname"), /Oguri Cap/);
  assert.equal(await page.textContent("#score"), "85%");

  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cmcomps:data")),
  );
  assert.equal(saved.v, 1, "dados salvos com número de formato");
  assert.equal(saved.data.CM5.pl, "1st");
  assert.deepEqual(errors, []);
  await context.close();
});

test("baixar backup e carregar em outro navegador traz os mesmos dados", async () => {
  const a = await openPage();
  await a.page.goto(base + "#cm-CM7");
  await a.page.click('[data-pl="2nd"]');
  await a.page.waitForFunction(
    () =>
      document.querySelector("#status").textContent === "Salvo neste navegador",
  );
  const [download] = await Promise.all([
    a.page.waitForEvent("download"),
    a.page.click("#bk-down"),
  ]);
  const file = path.join(
    require("node:os").tmpdir(),
    `cmcomps-${Date.now()}.json`,
  );
  await download.saveAs(file); // guarda antes de fechar este navegador
  const backup = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(backup.app, "cmcomps");
  assert.equal(backup.data.CM7.pl, "2nd");
  await a.context.close();

  const b = await openPage(); // contexto novo = navegador "limpo"
  await b.page.goto(base);
  await b.page.setInputFiles("#bk-file", file);
  await b.page.waitForFunction(() =>
    document
      .querySelector("#status")
      .textContent.startsWith("Backup carregado"),
  );
  await b.page.goto(base + "#cm-CM7");
  assert.equal(
    await b.page.getAttribute('[data-pl="2nd"]', "aria-pressed"),
    "true",
  );
  assert.deepEqual(b.errors, []);
  await b.context.close();
});

test("dados da versão antiga do site são convertidos ao abrir", async () => {
  const { context, page, errors } = await openPage();
  await page.goto(base);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "cmcomps:data:v1",
      JSON.stringify({ CM9: { pl: "3rd", rat: ["3-3-3-3"], team: [] } }),
    );
  });
  await page.goto(base + "#cm-CM9");
  await page.reload();
  await page.waitForSelector('[data-pl="3rd"]');
  assert.equal(
    await page.getAttribute('[data-pl="3rd"]', "aria-pressed"),
    "true",
  );
  const keys = await page.evaluate(() => Object.keys(localStorage));
  assert.deepEqual(
    keys,
    ["cmcomps:data"],
    "chave antiga removida após converter",
  );
  assert.deepEqual(errors, []);
  await context.close();
});
