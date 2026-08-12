const { chromium } = require("playwright-core");

const SCREENSHOT_DIR = "C:\\Users\\gakir\\AppData\\Local\\Temp\\claude\\c--Users-gakir-TrabalhoSelfMachine-MicoLeaoSistemaGestao\\2419d658-f3f1-48e1-9b8f-b4e34f30e9b6\\scratchpad";

const shot = async (page, name) => {
  await page.screenshot({ path: `${SCREENSHOT_DIR}\\${name}.png`, fullPage: true });
  console.log("screenshot:", name);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  try {
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', "admin@micoleao.com");
    await page.fill('input[type="password"]', "Admin@123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|inicio|\//, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, "01-pos-login");

    await page.goto("http://localhost:5173/compras", { waitUntil: "networkidle" });
    await page.waitForSelector("text=Novo pedido de compra", { timeout: 15000 });
    await shot(page, "02-compras-novaCompra");

    // Selecionar fornecedor existente
    const fornecedorSelect = page.locator("select").first();
    await fornecedorSelect.selectOption({ index: 1 });

    // Moeda USD
    await page.click('button:has-text("US$ (USD)")');

    // Tipo pagamento parcelado
    await page.click('button:has-text("Parcelado")');
    await page.fill('input[min="2"]', "2");

    // Preencher item: usar catálogo produto
    const produtoSelects = page.locator("select");
    // segundo select visível na área de item (catálogo) - localizar pelo label
    await page.waitForTimeout(300);

    // Selecionar produto do catálogo (o select dentro do bloco "Itens do pedido")
    const itemProdutoSelect = page.locator("text=do catálogo").locator("..").locator("select");
    await itemProdutoSelect.selectOption({ index: 1 });

    await page.fill('input[placeholder=""]', "").catch(() => {});
    // Quantidade e valor unitario do item (primeiros inputs number dentro do bloco item)
    const qtdInput = page.locator('div:has-text("Quantidade") input[type="number"]').first();
    await qtdInput.fill("5");
    const valorInput = page.locator('div:has-text("Valor unitário") input[type="number"]').first();
    await valorInput.fill("10");

    await page.click('button:has-text("+ Adicionar item na lista")');
    await page.waitForTimeout(300);
    await shot(page, "03-item-adicionado");

    // Custo adicional
    await page.click('button:has-text("+ Adicionar custo")');
    await page.fill('input[placeholder="Ex: Frete"]', "Frete teste");
    const custoValorInput = page.locator('div:has-text("Custos adicionais")').locator('input[type="number"]').first();
    await custoValorInput.fill("15");
    await shot(page, "04-custo-adicionado");

    await page.click('button:has-text("Lançar pedido")');
    await page.waitForTimeout(1500);
    await shot(page, "05-pos-lancar-pedido");

    console.log("CONSOLE ERRORS:", JSON.stringify(errors));
  } catch (err) {
    console.error("TEST ERROR:", err);
    await shot(page, "erro");
    console.log("CONSOLE ERRORS:", JSON.stringify(errors));
  } finally {
    await browser.close();
  }
})();
