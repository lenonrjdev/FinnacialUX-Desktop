import { expect, test } from "@playwright/test";

test.describe("rotas públicas do Desktop", () => {
  test("redireciona a raiz para o acesso local", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/");

    await expect(page).toHaveURL(/\/login\/?$/);
    await expect(page.getByRole("heading", { name: "Entre na sua conta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("valida o formulário antes de acessar o banco SQLCipher", async ({ page }) => {
    await page.goto("/login/");
    await page.getByLabel("E-mail").fill("usuario@exemplo.com");
    await page.getByLabel("Senha").fill("123");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("Preencha um e-mail válido e uma senha com pelo menos 8 caracteres."))
      .toBeVisible();
  });

  test("mantém navegação acessível entre login, cadastro e recuperação", async ({ page }) => {
    await page.goto("/login/");

    await page.getByRole("link", { name: "Criar conta gratuita" }).click();
    await expect(page).toHaveURL(/\/registro\/?$/);
    await expect(page.getByRole("heading", { name: "Crie sua conta" })).toBeVisible();

    await page.getByRole("link", { name: "Entrar" }).click();
    await page.getByRole("link", { name: "Esqueci minha senha" }).click();
    await expect(page).toHaveURL(/\/recuperar-senha\/?$/);
    await expect(page.getByRole("heading", { name: "Redefina sua senha" })).toBeVisible();
  });

  test("possui idioma, título e foco de teclado coerentes", async ({ page }) => {
    await page.goto("/login/");

    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page).toHaveTitle(/FinnacialUX/i);

    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
  });
});
