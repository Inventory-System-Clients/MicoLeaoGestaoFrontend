import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";
import { pode } from "../utils/perfis";

const AlertasContext = createContext(null);

const INTERVALO_ATUALIZACAO_MS = 3 * 60 * 1000;

const DEFINICAO_TIPOS = [
  {
    id: "movimentacao",
    label: "Movimentação (contador)",
    icone: "🔄",
    cor: "purple",
  },
  {
    id: "estoque-maquina",
    label: "Estoque baixo em máquina",
    icone: "🎮",
    cor: "red",
  },
  {
    id: "estoque-loja",
    label: "Estoque baixo em loja",
    icone: "🏪",
    cor: "orange",
  },
  {
    id: "abastecimento-incompleto",
    label: "Abastecimento incompleto",
    icone: "📦",
    cor: "amber",
  },
  {
    id: "desempenho",
    label: "Pelúcias fora do esperado",
    icone: "⚠️",
    cor: "rose",
  },
  {
    id: "manutencao",
    label: "Manutenção pendente",
    icone: "🛠️",
    cor: "yellow",
  },
  {
    id: "manutencao-atrasada",
    label: "Manutenção atrasada",
    icone: "⏰",
    cor: "red",
  },
  {
    id: "manutencao-recorrente",
    label: "Manutenção recorrente",
    icone: "🔁",
    cor: "rose",
  },
  {
    id: "maquina-parada",
    label: "Máquina sem movimentação",
    icone: "⏸️",
    cor: "orange",
  },
  { id: "extintor", label: "Extintor vencendo", icone: "🧯", cor: "red" },
  { id: "contrato", label: "Contrato vencendo", icone: "📄", cor: "red" },
  {
    id: "carrinho-transito",
    label: "Carrinho não conferido",
    icone: "🔏",
    cor: "blue",
  },
  {
    id: "lacres-divergentes",
    label: "Lacres divergentes",
    icone: "🔏",
    cor: "red",
  },
  {
    id: "compra-pendente",
    label: "Compra pendente",
    icone: "🛒",
    cor: "amber",
  },
  {
    id: "sugestao-compra-pendente",
    label: "Sugestão de compra pendente",
    icone: "📝",
    cor: "purple",
  },
  { id: "veiculos", label: "Veículos", icone: "🚗", cor: "blue" },
  {
    id: "divergencia-blink",
    label: "Divergência Blink",
    icone: "⚡",
    cor: "amber",
  },
  {
    id: "divergencia-fichas-blink",
    label: "Divergência de fichas Blink",
    icone: "🎟️",
    cor: "amber",
  },
];

const tiposVazios = () =>
  DEFINICAO_TIPOS.map((tipo) => ({ ...tipo, itens: [], total: 0 }));

const extrairAlertas = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.alertas)) return data.alertas;
  return [];
};

export function AlertasProvider({ children }) {
  const { usuario } = useAuth();
  const [tipos, setTipos] = useState(tiposVazios);
  const [carregando, setCarregando] = useState(false);
  const emAndamentoRef = useRef(false);

  const carregar = useCallback(async () => {
    const podeVerAlertas = pode(
      usuario,
      "alertas.ver",
      ["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"].includes(usuario?.role),
    );
    if (!podeVerAlertas || emAndamentoRef.current) return;

    emAndamentoRef.current = true;
    setCarregando(true);

    try {
      const [
        estoqueMaquinaRes,
        desempenhoRes,
        abastecimentoRes,
        movOutRes,
        movInRes,
        lojasRes,
        manutencaoRes,
        veiculosRes,
        manutencaoAtrasadaRes,
        manutencaoRecorrenteRes,
        maquinaParadaRes,
        extintorRes,
        contratoRes,
        carrinhoTransitoRes,
        lacresDivergentesRes,
        comprasPendentesRes,
        sugestoesCompraPendentesRes,
        divergenciaBlinkRes,
        divergenciaFichasBlinkRes,
      ] = await Promise.all([
        api
          .get("/relatorios/alertas-estoque")
          .catch(() => ({ data: { alertas: [] } })),
        api
          .get("/relatorios/alertas-bom-desempenho")
          .catch(() => ({ data: { alertas: [] } })),
        api
          .get("/relatorios/alertas-abastecimento-incompleto")
          .catch(() => ({ data: { alertas: [] } })),
        api
          .get("/relatorios/alertas-movimentacao-out")
          .catch(() => ({ data: { alertas: [] } })),
        api
          .get("/relatorios/alertas-movimentacao-in")
          .catch(() => ({ data: { alertas: [] } })),
        api.get("/lojas").catch(() => ({ data: [] })),
        api.get("/manutencoes").catch(() => ({ data: [] })),
        api.get("/alertas-veiculos").catch(() => ({ data: [] })),
        api
          .get("/manutencoes/alertas/atrasadas")
          .catch(() => ({ data: { alertas: [] } })),
        api
          .get("/manutencoes/alertas/recorrentes")
          .catch(() => ({ data: { alertas: [] } })),
        api
          .get("/relatorios/alertas-maquina-parada")
          .catch(() => ({ data: { alertas: [] } })),
        api
          .get("/relatorios/alertas-extintor")
          .catch(() => ({ data: { alertas: [] } })),
        api
          .get("/relatorios/alertas-contrato")
          .catch(() => ({ data: { alertas: [] } })),
        api
          .get("/lacres/alertas/em-transito")
          .catch(() => ({ data: { alertas: [] } })),
        api.get("/lacres/divergentes").catch(() => ({ data: [] })),
        api
          .get("/compras", { params: { status: "PESQUISANDO,COMPRADO" } })
          .catch(() => ({ data: [] })),
        api
          .get("/sugestoes-compra", { params: { status: "PENDENTE" } })
          .catch(() => ({ data: [] })),
        api.get("/registro-dinheiro/alertas-blink").catch(() => ({ data: [] })),
        api
          .get("/registro-dinheiro/alertas-fichas-blink")
          .catch(() => ({ data: [] })),
      ]);

      const lojas = Array.isArray(lojasRes.data) ? lojasRes.data : [];
      const alertasPorLoja = await Promise.all(
        lojas.map((loja) =>
          api
            .get(`/estoque-lojas/${loja.id}/alertas`)
            .then((res) =>
              extrairAlertas(res.data).map((item) => ({
                ...item,
                lojaNome: loja.nome,
                lojaId: loja.id,
              })),
            )
            .catch(() => []),
        ),
      );

      const movimentacaoItens = [
        ...extrairAlertas(movOutRes.data),
        ...extrairAlertas(movInRes.data),
      ];
      const manutencaoItens = Array.isArray(manutencaoRes.data)
        ? manutencaoRes.data.filter((item) => item.status !== "CONCLUIDA")
        : [];
      const veiculosItens = Array.isArray(veiculosRes.data)
        ? veiculosRes.data
        : [];
      const lacresDivergentesItens = Array.isArray(lacresDivergentesRes.data)
        ? lacresDivergentesRes.data.map((lacre) => ({
            id: lacre.id,
            titulo: `Lacre ${lacre.numero}`,
            mensagem: `Esperado ${lacre.numero} — digitado ${lacre.numeroDigitado}`,
            lojaNome: lacre.envio?.lojaDestino?.nome,
            lojaId: lacre.envio?.lojaDestino?.id,
            createdAt: lacre.conferidoEm,
          }))
        : [];

      const compraPendenteItens = Array.isArray(comprasPendentesRes.data)
        ? comprasPendentesRes.data.map((compra) => ({
            id: compra.id,
            produtoNome:
              compra.produto?.nome || compra.insumo?.nome || compra.nomeItem,
            quantidade: compra.quantidade,
            lojaNome: compra.loja?.nome,
            lojaId: compra.loja?.id,
            mensagem: `${compra.quantidade}x — ${
              compra.status === "COMPRADO"
                ? "comprada, aguardando recebimento"
                : "em pesquisa"
            }`,
            createdAt: compra.createdAt,
          }))
        : [];

      const sugestaoCompraPendenteItens = Array.isArray(
        sugestoesCompraPendentesRes.data,
      )
        ? sugestoesCompraPendentesRes.data.map((sugestao) => ({
            id: sugestao.id,
            titulo: "Sugestão de compra",
            mensagem: `${sugestao.itens?.length || 0} item(ns) sugerido(s) por ${
              sugestao.criadoPor?.nome || "-"
            }`,
            createdAt: sugestao.createdAt,
          }))
        : [];

      const divergenciaBlinkItens = Array.isArray(divergenciaBlinkRes.data)
        ? divergenciaBlinkRes.data.map((registro) => {
            const contado =
              Number(registro.valorDinheiro || 0) +
              Number(registro.valorCartaoPix || 0);
            const blink = Number(registro.valorBlink || 0);
            const diferenca = Number(registro.diferencaBlink || 0);
            return {
              id: registro.id,
              titulo: "Divergência Blink",
              lojaNome: registro.loja?.nome,
              lojaId: registro.loja?.id,
              mensagem: `Dinheiro+Cartão/Pix: R$ ${contado.toFixed(2)} · Blink: R$ ${blink.toFixed(2)} · Diferença: R$ ${diferenca.toFixed(2)}`,
              createdAt: registro.createdAt,
            };
          })
        : [];

      const divergenciaFichasBlinkItens = Array.isArray(
        divergenciaFichasBlinkRes.data,
      )
        ? divergenciaFichasBlinkRes.data.map((registro) => {
            const sistema = Number(registro.quantidadeFichasSistema || 0);
            const blink = Number(registro.quantidadeFichasBlink || 0);
            const diferenca = Number(registro.diferencaFichasBlink || 0);
            return {
              id: registro.id,
              titulo: "Divergência de fichas Blink",
              lojaNome: registro.loja?.nome,
              lojaId: registro.loja?.id,
              mensagem: `Sistema: ${sistema} ficha(s) · Blink: ${blink} ficha(s) · Diferença: ${diferenca}`,
              createdAt: registro.createdAt,
            };
          })
        : [];

      const resultados = [
        { id: "movimentacao", itens: movimentacaoItens },
        {
          id: "estoque-maquina",
          itens: extrairAlertas(estoqueMaquinaRes.data),
        },
        { id: "estoque-loja", itens: alertasPorLoja.flat() },
        {
          id: "abastecimento-incompleto",
          itens: extrairAlertas(abastecimentoRes.data),
        },
        { id: "desempenho", itens: extrairAlertas(desempenhoRes.data) },
        { id: "manutencao", itens: manutencaoItens },
        {
          id: "manutencao-atrasada",
          itens: extrairAlertas(manutencaoAtrasadaRes.data),
        },
        {
          id: "manutencao-recorrente",
          itens: extrairAlertas(manutencaoRecorrenteRes.data),
        },
        { id: "maquina-parada", itens: extrairAlertas(maquinaParadaRes.data) },
        { id: "extintor", itens: extrairAlertas(extintorRes.data) },
        { id: "contrato", itens: extrairAlertas(contratoRes.data) },
        {
          id: "carrinho-transito",
          itens: extrairAlertas(carrinhoTransitoRes.data),
        },
        {
          id: "lacres-divergentes",
          itens: lacresDivergentesItens,
        },
        { id: "compra-pendente", itens: compraPendenteItens },
        {
          id: "sugestao-compra-pendente",
          itens: sugestaoCompraPendenteItens,
        },
        { id: "veiculos", itens: veiculosItens },
        { id: "divergencia-blink", itens: divergenciaBlinkItens },
        {
          id: "divergencia-fichas-blink",
          itens: divergenciaFichasBlinkItens,
        },
      ].map((resultado) => {
        const definicao = DEFINICAO_TIPOS.find(
          (tipo) => tipo.id === resultado.id,
        );
        return {
          ...definicao,
          itens: resultado.itens,
          total: resultado.itens.length,
        };
      });

      setTipos(resultados);
    } catch (error) {
      console.error("Erro ao carregar alertas:", error);
    } finally {
      emAndamentoRef.current = false;
      setCarregando(false);
    }
  }, [usuario]);

  useEffect(() => {
    if (
      !pode(
        usuario,
        "alertas.ver",
        ["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"].includes(usuario?.role),
      )
    ) {
      setTipos(tiposVazios());
      return;
    }

    carregar();
    const intervalo = setInterval(carregar, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(intervalo);
  }, [usuario, carregar]);

  const totalGeral = tipos.reduce((soma, tipo) => soma + tipo.total, 0);

  return (
    <AlertasContext.Provider
      value={{ tipos, totalGeral, carregando, recarregar: carregar }}
    >
      {children}
    </AlertasContext.Provider>
  );
}

export function useAlertas() {
  const context = useContext(AlertasContext);
  if (!context) {
    throw new Error("useAlertas deve ser usado dentro de um AlertasProvider");
  }
  return context;
}
