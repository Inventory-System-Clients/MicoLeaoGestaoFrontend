// Textos e formatação do ponto (regras e cálculos ficam no backend:
// backend/src/utils/ponto.js)

export const TIPOS_BATIDA = {
  ENTRADA: { rotulo: "Entrada", acao: "Bater entrada", icone: "🟢", cor: "bg-emerald-500" },
  SAIDA_INTERVALO: { rotulo: "Saída p/ intervalo", acao: "Sair para o intervalo", icone: "🍽️", cor: "bg-amber-500" },
  VOLTA_INTERVALO: { rotulo: "Volta do intervalo", acao: "Voltar do intervalo", icone: "↩️", cor: "bg-sky-500" },
  SAIDA: { rotulo: "Saída", acao: "Encerrar o dia", icone: "🔴", cor: "bg-rose-500" },
};

export const STATUS_FUNCIONARIO = {
  TRABALHANDO: { rotulo: "Trabalhando", classe: "bg-emerald-100 text-emerald-800", ponto: "bg-emerald-500" },
  INTERVALO: { rotulo: "Em intervalo", classe: "bg-amber-100 text-amber-800", ponto: "bg-amber-500" },
  ENCERROU: { rotulo: "Encerrou o dia", classe: "bg-gray-100 text-gray-700", ponto: "bg-gray-400" },
  INCOMPLETO: { rotulo: "Batidas incompletas", classe: "bg-rose-100 text-rose-800", ponto: "bg-rose-500" },
  NAO_BATEU: { rotulo: "Não bateu hoje", classe: "bg-slate-100 text-slate-500", ponto: "bg-slate-300" },
};

export const SITUACAO_DIA = {
  COMPLETO: { rotulo: "Completo", classe: "bg-emerald-100 text-emerald-800" },
  EM_ANDAMENTO: { rotulo: "Em andamento", classe: "bg-sky-100 text-sky-800" },
  INCOMPLETO: { rotulo: "Incompleto", classe: "bg-rose-100 text-rose-800" },
  SEM_REGISTRO: { rotulo: "Sem registro", classe: "bg-gray-100 text-gray-500" },
};

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// 95 -> "1h35"; 0 -> "0h00"
export const formatarMinutos = (minutos, { sinal = false } = {}) => {
  const valor = Math.round(Number(minutos) || 0);
  const absoluto = Math.abs(valor);
  const texto = `${Math.floor(absoluto / 60)}h${String(absoluto % 60).padStart(2, "0")}`;
  if (valor < 0) return `-${texto}`;
  return sinal && valor > 0 ? `+${texto}` : texto;
};

export const formatarHora = (data) =>
  data
    ? new Date(data).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "--:--";

export const formatarDataHora = (data) =>
  data
    ? new Date(data).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "-";

// "2026-11-11" -> "11/11"
export const formatarDia = (dia, { ano = false } = {}) => {
  if (!dia) return "-";
  const [a, m, d] = dia.split("-");
  return ano ? `${d}/${m}/${a}` : `${d}/${m}`;
};

export const formatarDistancia = (metros) => {
  if (metros === null || metros === undefined) return "-";
  return metros >= 1000 ? `${(metros / 1000).toFixed(1).replace(".", ",")} km` : `${metros} m`;
};

// Dia de hoje em Brasília ("2026-11-11")
export const hojeEmBrasilia = () =>
  new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const somarDias = (dia, quantidade) => {
  const data = new Date(`${dia}T12:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + quantidade);
  return data.toISOString().slice(0, 10);
};

export const PERIODOS_RAPIDOS = [
  { chave: "hoje", rotulo: "Hoje", calcular: (hoje) => ({ inicio: hoje, fim: hoje }) },
  { chave: "7dias", rotulo: "7 dias", calcular: (hoje) => ({ inicio: somarDias(hoje, -6), fim: hoje }) },
  { chave: "mes", rotulo: "Este mês", calcular: (hoje) => ({ inicio: `${hoje.slice(0, 7)}-01`, fim: hoje }) },
  {
    chave: "mesPassado",
    rotulo: "Mês passado",
    calcular: (hoje) => {
      const fim = somarDias(`${hoje.slice(0, 7)}-01`, -1);
      return { inicio: `${fim.slice(0, 7)}-01`, fim };
    },
  },
];

// Localização atual do aparelho (GPS). Rejeita com mensagem amigável.
export const pegarLocalizacao = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este aparelho não informa a localização. Use o celular com GPS."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) =>
        resolve({
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
          precisao: Math.round(posicao.coords.accuracy),
        }),
      (erro) => {
        const mensagens = {
          1: "A localização está bloqueada. Toque no cadeado ao lado do endereço do site, permita a Localização e tente de novo.",
          2: "Não foi possível achar sua localização. Ligue o GPS do celular e tente de novo.",
          3: "A localização demorou demais para responder. Tente de novo em um lugar aberto.",
        };
        reject(new Error(mensagens[erro.code] || "Não foi possível ler sua localização."));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });

// Mesma conta do backend (Haversine), só pra mostrar antes de bater
export const distanciaEmMetros = (lat1, lon1, lat2, lon2) => {
  const rad = (grau) => (Number(grau) * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(a)));
};

export const localMaisProximo = (posicao, locais) => {
  if (!posicao || !locais?.length) return null;
  return locais
    .map((local) => ({
      local,
      distancia: distanciaEmMetros(posicao.latitude, posicao.longitude, local.latitude, local.longitude),
    }))
    .map((item) => ({ ...item, dentro: item.distancia <= item.local.raioMetros }))
    .sort((a, b) => a.distancia - b.distancia)[0];
};

// Planilha (abre no Excel com acentos)
export const baixarCsv = (nomeArquivo, linhas) => {
  const texto = linhas
    .map((linha) =>
      linha
        .map((celula) => {
          const valor = String(celula ?? "");
          return /[";\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
        })
        .join(";"),
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${texto}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
};

export const linkDoMapa = (latitude, longitude) =>
  `https://www.google.com/maps?q=${latitude},${longitude}`;
