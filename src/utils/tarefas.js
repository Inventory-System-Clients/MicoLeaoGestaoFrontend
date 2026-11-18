// Tarefas e calendário: nomes, cores e datas usados nas telas
// (pages/Tarefas.jsx, pages/Calendario.jsx, components/TarefaForm.jsx)

export const STATUS_TAREFA = {
  PENDENTE: { nome: "Esperando aceite", cor: "bg-amber-100 text-amber-800" },
  ACEITA: { nome: "Aceita", cor: "bg-blue-100 text-blue-800" },
  EXECUTANDO: { nome: "Fazendo...", cor: "bg-blue-100 text-blue-800" },
  FEITA: { nome: "Feita", cor: "bg-green-100 text-green-800" },
  RECUSADA: { nome: "Recusada", cor: "bg-red-100 text-red-800" },
  CANCELADA: { nome: "Cancelada", cor: "bg-gray-200 text-gray-600" },
};

export const ICONE_TIPO = {
  LIVRE: "📝",
  TRANSFERIR_MAQUINA: "🔁",
  STATUS_MAQUINA: "⏯️",
  PRECO_MAQUINA: "💲",
  PAGAR_CONTA: "💳",
  TROCAR_EXTINTOR: "🧯",
  RENOVAR_CONTRATO: "📄",
};

// O que aparece no calendário (filtros e cores)
export const CATEGORIAS_CALENDARIO = {
  tarefa: { nome: "Tarefas", icone: "✅", cor: "bg-primary/15 text-primary border-primary/30" },
  periodo: { nome: "Períodos", icone: "🎄", cor: "bg-rose-100 text-rose-800 border-rose-200" },
  conta: { nome: "Contas a pagar", icone: "💳", cor: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  extintor: { nome: "Extintores", icone: "🧯", cor: "bg-red-50 text-red-800 border-red-200" },
  contrato: { nome: "Contratos", icone: "📄", cor: "bg-orange-50 text-orange-800 border-orange-200" },
  manutencao: { nome: "Manutenção", icone: "🛠️", cor: "bg-yellow-50 text-yellow-800 border-yellow-200" },
  rota: { nome: "Rotas", icone: "🚚", cor: "bg-sky-50 text-sky-800 border-sky-200" },
  projeto: { nome: "Projetos loja", icone: "🏗️", cor: "bg-violet-50 text-violet-800 border-violet-200" },
  transferencia: { nome: "Transferências", icone: "🔁", cor: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  gasto: { nome: "Gastos variáveis", icone: "🧾", cor: "bg-stone-100 text-stone-700 border-stone-200" },
  compra: { nome: "Compras", icone: "🛒", cor: "bg-teal-50 text-teal-800 border-teal-200" },
  loja: { nome: "Lojas", icone: "🏪", cor: "bg-lime-50 text-lime-800 border-lime-200" },
};

export const CORES_PERIODO = {
  vermelho: "bg-red-500",
  verde: "bg-green-600",
  azul: "bg-blue-500",
  amarelo: "bg-yellow-400",
  roxo: "bg-purple-500",
  laranja: "bg-orange-500",
  rosa: "bg-pink-500",
};

export const NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const hojeBrasilia = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
export const dataBr = (data) => (data ? String(data).slice(0, 10).split("-").reverse().join("/") : "");
export const dataHoraBr = (valor) =>
  valor ? new Date(valor).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
export const reais = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const mensagemDeErro = (erro, padrao) => erro?.response?.data?.error || padrao;
