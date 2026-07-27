export const CATEGORIA_LABELS = {
  VENDA: "Venda",
  TROCA: "Troca",
  COMPRA: "Compra",
  DEVOLUCAO: "Devolução",
};

export const CATEGORIA_BADGE_CLASSES = {
  VENDA: "bg-purple-900/50 text-purple-300 border border-purple-700",
  TROCA: "bg-amber-900/50 text-amber-300 border border-amber-700",
  COMPRA: "bg-blue-900/50 text-blue-300 border border-blue-700",
  DEVOLUCAO: "bg-teal-900/50 text-teal-300 border border-teal-700",
};

export const CATEGORIAS_POR_TIPO = {
  ENTRADA: [
    { value: "COMPRA", label: "Compra" },
    { value: "DEVOLUCAO", label: "Devolução" },
  ],
  SAIDA: [
    { value: "VENDA", label: "Venda" },
    { value: "TROCA", label: "Troca" },
  ],
};
