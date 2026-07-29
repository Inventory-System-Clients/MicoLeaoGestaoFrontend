// Mesma lógica usada no backend (movimentacaoEstoqueLojaController.js) e em
// Estoque.jsx para identificar o Depósito Principal, que é armazenado como
// uma Loja comum no banco só por conveniência de reaproveitar o estoque por
// loja — mas não é uma loja de verdade pra fins de rota/cadastro/operação.
const NOMES_DEPOSITO_PRINCIPAL = ["deposito principal", "depósito principal"];

export const ehDepositoPrincipal = (loja) =>
  NOMES_DEPOSITO_PRINCIPAL.includes(
    String(loja?.nome || "").trim().toLowerCase(),
  );

export const filtrarLojasOperacionais = (lojas = []) =>
  lojas.filter((loja) => !ehDepositoPrincipal(loja));
