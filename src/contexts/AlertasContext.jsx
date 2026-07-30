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

const AlertasContext = createContext(null);

const INTERVALO_ATUALIZACAO_MS = 3 * 60 * 1000;

const DEFINICAO_TIPOS = [
  { id: "movimentacao", label: "Movimentação (contador)", icone: "🔄", cor: "purple" },
  { id: "estoque-maquina", label: "Estoque baixo em máquina", icone: "🎮", cor: "red" },
  { id: "estoque-loja", label: "Estoque baixo em loja", icone: "🏪", cor: "orange" },
  { id: "abastecimento-incompleto", label: "Abastecimento incompleto", icone: "📦", cor: "amber" },
  { id: "desempenho", label: "Pelúcias fora do esperado", icone: "⚠️", cor: "rose" },
  { id: "manutencao", label: "Manutenção pendente", icone: "🛠️", cor: "yellow" },
  { id: "manutencao-atrasada", label: "Manutenção atrasada", icone: "⏰", cor: "red" },
  { id: "manutencao-recorrente", label: "Manutenção recorrente", icone: "🔁", cor: "rose" },
  { id: "maquina-parada", label: "Máquina sem movimentação", icone: "⏸️", cor: "orange" },
  { id: "extintor", label: "Extintor vencendo", icone: "🧯", cor: "red" },
  { id: "carrinho-transito", label: "Carrinho não conferido", icone: "🔏", cor: "blue" },
  { id: "compra-pendente", label: "Compra pendente", icone: "🛒", cor: "amber" },
  { id: "veiculos", label: "Veículos", icone: "🚗", cor: "blue" },
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
    const podeVerAlertas = ["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role);
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
        carrinhoTransitoRes,
        comprasPendentesRes,
      ] = await Promise.all([
        api.get("/relatorios/alertas-estoque").catch(() => ({ data: { alertas: [] } })),
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
          .get("/lacres/alertas/em-transito")
          .catch(() => ({ data: { alertas: [] } })),
        api
          .get("/compras", { params: { status: "PESQUISANDO,COMPRADO" } })
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
      const veiculosItens = Array.isArray(veiculosRes.data) ? veiculosRes.data : [];

      const compraPendenteItens = Array.isArray(comprasPendentesRes.data)
        ? comprasPendentesRes.data.map((compra) => ({
            id: compra.id,
            produtoNome: compra.produto?.nome || compra.insumo?.nome || compra.nomeItem,
            quantidade: compra.quantidade,
            lojaNome: compra.loja?.nome,
            lojaId: compra.loja?.id,
            mensagem: `${compra.quantidade}x — ${
              compra.status === "COMPRADO" ? "comprada, aguardando recebimento" : "em pesquisa"
            }`,
            createdAt: compra.createdAt,
          }))
        : [];

      const resultados = [
        { id: "movimentacao", itens: movimentacaoItens },
        { id: "estoque-maquina", itens: extrairAlertas(estoqueMaquinaRes.data) },
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
        {
          id: "carrinho-transito",
          itens: extrairAlertas(carrinhoTransitoRes.data),
        },
        { id: "compra-pendente", itens: compraPendenteItens },
        { id: "veiculos", itens: veiculosItens },
      ].map((resultado) => {
        const definicao = DEFINICAO_TIPOS.find((tipo) => tipo.id === resultado.id);
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
  }, [usuario?.role]);

  useEffect(() => {
    if (!["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role)) {
      setTipos(tiposVazios());
      return;
    }

    carregar();
    const intervalo = setInterval(carregar, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(intervalo);
  }, [usuario?.role, carregar]);

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
