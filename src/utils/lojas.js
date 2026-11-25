// Mesma lógica usada no backend (movimentacaoEstoqueLojaController.js) e em
// Estoque.jsx para identificar o Depósito Principal, que é armazenado como
// uma Loja comum no banco só por conveniência de reaproveitar o estoque por
// loja — mas não é uma loja de verdade pra fins de rota/cadastro/operação.
const NOMES_DEPOSITO_PRINCIPAL = ["deposito principal", "depósito principal"];

export const ehDepositoPrincipal = (loja) =>
  NOMES_DEPOSITO_PRINCIPAL.includes(
    String(loja?.nome || "").trim().toLowerCase(),
  );

// Máquina avulsa (Loja tipo AVULSA): ponto de uma máquina só no shopping
export const ehAvulsa = (loja) => loja?.tipo === "AVULSA";
export const rotuloPonto = (loja) =>
  loja ? `${ehAvulsa(loja) ? "🎮 " : ""}${loja.nome}` : "";

export const filtrarLojasOperacionais = (lojas = []) =>
  lojas.filter((loja) => !ehDepositoPrincipal(loja));
