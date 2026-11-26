// Fluxo da manutenção (backend: controllers/manutencaoController.js)
// SOLICITADA (Cadastro/admin autoriza) -> PENDENTE -> ACEITA -> CONCLUIDA ->
// FINALIZADA (admin lança o gasto). AGUARDANDO: quem aceitou não conseguiu
// fazer; volta pro admin reenviar. RECUSADA: solicitação não autorizada.
export const STATUS_MANUTENCAO = {
  SOLICITADA: { rotulo: "Solicitada", icone: "📥", classe: "bg-violet-100 text-violet-800 border-violet-200", borda: "border-l-violet-500" },
  PENDENTE: { rotulo: "Pendente", icone: "🕐", classe: "bg-amber-100 text-amber-800 border-amber-200", borda: "border-l-amber-400" },
  ACEITA: { rotulo: "Aceita", icone: "🔧", classe: "bg-sky-100 text-sky-800 border-sky-200", borda: "border-l-sky-500" },
  AGUARDANDO: { rotulo: "Aguardando", icone: "⏸️", classe: "bg-rose-100 text-rose-800 border-rose-200", borda: "border-l-rose-500" },
  CONCLUIDA: { rotulo: "Concluída", icone: "✅", classe: "bg-emerald-100 text-emerald-800 border-emerald-200", borda: "border-l-emerald-500" },
  FINALIZADA: { rotulo: "Finalizada", icone: "🏁", classe: "bg-gray-200 text-gray-700 border-gray-300", borda: "border-l-gray-400" },
  RECUSADA: { rotulo: "Recusada", icone: "✖️", classe: "bg-gray-100 text-gray-500 border-gray-200", borda: "border-l-gray-300" },
};

export const ORDEM_STATUS = ["SOLICITADA", "PENDENTE", "ACEITA", "AGUARDANDO", "CONCLUIDA", "FINALIZADA", "RECUSADA"];

export const TIPOS_PROBLEMA = [
  { valor: "MECANICO", rotulo: "Mecânico", icone: "⚙️" },
  { valor: "ELETRICO", rotulo: "Elétrico", icone: "⚡" },
  { valor: "SOFTWARE", rotulo: "Placa/sistema", icone: "💾" },
  { valor: "LIMPEZA", rotulo: "Limpeza", icone: "🧽" },
  { valor: "ESTRUTURAL", rotulo: "Estrutura", icone: "🏗️" },
  { valor: "OUTRO", rotulo: "Outro", icone: "❓" },
];

export const ACOES_HISTORICO = {
  CRIADA: "📝 Aberta",
  SOLICITADA: "📥 Solicitada",
  AUTORIZADA: "👍 Autorizada",
  RECUSADA: "✖️ Recusada",
  ACEITA: "✋ Aceita",
  AGUARDANDO: "⏸️ Não conseguiu fazer",
  SERVICO: "🛠️ Serviço solicitado",
  CONCLUIDA: "✅ Concluída",
  REENVIADA: "↪️ Reenviada",
  FINALIZADA: "🏁 Finalizada",
  EDITADA: "✏️ Editada",
  OCORRENCIA: "➕ Outra ocorrência juntada",
  DESIGNADA: "👑 Chefe do setor escolheu quem faz",
  PECA_ADICIONADA: "🔩 Peça adicionada",
  PECA_REMOVIDA: "🗑️ Peça retirada",
  COMPRA_PECA: "🛒 Compra de peça pedida",
};

// Andamento do pedido de compra de uma peça da manutenção
export const situacaoCompraPeca = (item) => {
  if (item.temAgora) return { texto: "✅ Agora tem no estoque", classe: "bg-emerald-100 text-emerald-800" };
  const compra = item.compra || {};
  if (compra.compraStatus === "RECEBIDO") return { texto: "Peça chegou", classe: "bg-emerald-100 text-emerald-800" };
  if (compra.compraStatus === "COMPRADO") return { texto: "Comprada, a caminho", classe: "bg-sky-100 text-sky-800" };
  if (compra.compraStatus === "PESQUISANDO") return { texto: "Pesquisando preço", classe: "bg-amber-100 text-amber-800" };
  if (compra.sugestaoStatus === "RECUSADA") return { texto: `Compra recusada${compra.resposta ? `: ${compra.resposta}` : ""}`, classe: "bg-rose-100 text-rose-800" };
  return { texto: "Pedido de compra enviado", classe: "bg-violet-100 text-violet-800" };
};

// Pendente enviada pra essa pessoa: direto pra ela, ou pro setor (perfil)
// dela; nas antigas (sem setor), quem estava na lista
export const ehParaMim = (m, usuario) => {
  // Chefe do setor: as do setor dele também são pra ele (aceita ou escolhe quem faz)
  if (m.acoes?.chefe) return true;
  if (m.destinatarioId) {
    return m.destinatarioId === usuario?.id || (m.destinatariosIds || []).includes(usuario?.id);
  }
  if (m.setor) return m.setor === usuario?.role;
  return (
    m.responsavelId === usuario?.id ||
    (m.funcionariosPermitidos || []).some((p) => p.id === usuario?.id)
  );
};

// Manutenções de quem vai fazer em que a peça pedida para compra chegou
// (aceitas por ela, ou pendentes esperando ela aceitar)
export const pecasChegaramParaMim = (lista, usuario) =>
  (Array.isArray(lista) ? lista : []).filter(
    (m) =>
      m.situacaoPecas === "TEM_PECA" &&
      (m.aceitaPorId === usuario?.id || (m.status === "PENDENTE" && !m.aceitaPorId && ehParaMim(m, usuario))),
  );

// O que a pessoa tem pra fazer: pendentes que chegaram pra ela e as que ela
// aceitou e ainda não concluiu
export const contarParaFazer = (lista, usuario) =>
  (Array.isArray(lista) ? lista : []).filter(
    (m) =>
      (m.status === "PENDENTE" && ehParaMim(m, usuario)) ||
      (m.status === "ACEITA" && m.aceitaPorId === usuario?.id),
  ).length;
