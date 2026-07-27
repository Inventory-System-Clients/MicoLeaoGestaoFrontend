import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import {
  PageHeader,
  StatsGrid,
  DataTable,
  Badge,
  AlertBox,
} from "../components/UIComponents";
import RegistrarDinheiro from "../components/RegistrarDinheiro";
import LancarGastoVariavel from "../components/LancarGastoVariavel";
import { PageLoader, EmptyState } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";
import AvisosMaquinasFaltam from "../components/AvisosMaquinasFaltam";
import TabelaMovimentacoesEstoqueDeLoja from "../components/TabelaMovimentacoesEstoqueDeLoja";
import {
  salvarFotoUltimaMovimentacao,
  obterFotoUltimaMovimentacao,
  limparFotoUltimaMovimentacao,
} from "../services/fotoUltimaMovimentacaoDb";

const CHAVE_ULTIMA_MENSAGEM_WHATSAPP = "ultimaMensagemMovimentacaoWhatsapp";

export function Movimentacoes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [modalRegistrarDinheiro, setModalRegistrarDinheiro] = useState(false);
  const [modalGastoVariavel, setModalGastoVariavel] = useState(false);
  const { usuario } = useAuth();

  // --- ESTADOS ---
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [movimentacoesEstoqueLoja, setMovimentacoesEstoqueLoja] = useState([]);

  // Filtros Estoque Loja
  const [filtroLojaEstoque, setFiltroLojaEstoque] = useState("");
  const [filtroDataInicioEstoque, setFiltroDataInicioEstoque] = useState("");
  const [filtroDataFimEstoque, setFiltroDataFimEstoque] = useState("");
  const [filtroResponsavelEstoque, setFiltroResponsavelEstoque] = useState("");

  // AÃ§Ãµes Estoque Loja
  const [editandoEstoqueLoja, setEditandoEstoqueLoja] = useState(null);
  const [excluindoEstoqueLoja, setExcluindoEstoqueLoja] = useState(null);

  // Dados Gerais
  const [maquinas, setMaquinas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [salvandoMovimentacao, setSalvandoMovimentacao] = useState(false);
  const [fotoContadores, setFotoContadores] = useState(null);
  const [fotoContadoresPreview, setFotoContadoresPreview] = useState("");
  const [lendoFotoContadores, setLendoFotoContadores] = useState(false);
  const [resultadoFotoContadores, setResultadoFotoContadores] = useState("");
  const movimentacaoEmEnvioRef = useRef(false);
  const [movimentacaoAssistentePendente, setMovimentacaoAssistentePendente] =
    useState(null);
  const [naoVaiRegistrar, setNaoVaiRegistrar] = useState(false);
  const [mostrarObsAlerta, setMostrarObsAlerta] = useState(false);
  const [obsAlerta, setObsAlerta] = useState("");
  const [enviandoAlerta, setEnviandoAlerta] = useState(false);
  const [temMensagemSalva, setTemMensagemSalva] = useState(
    () => !!localStorage.getItem(CHAVE_ULTIMA_MENSAGEM_WHATSAPP),
  );

  // Filtros MovimentaÃ§Ãµes
  const [filtroLojaForm, setFiltroLojaForm] = useState("");
  const [filtroLojaListagem, setFiltroLojaListagem] = useState("");

  // EdiÃ§Ã£o
  const [editandoMovimentacao, setEditandoMovimentacao] = useState(null);
  const [formEdicao, setFormEdicao] = useState({
    fichas: "",
    abastecidas: "",
    quantidade_notas_entrada: "",
    valor_entrada_maquininha_pix: "",
  });

  // FormulÃ¡rio Nova MovimentaÃ§Ã£o
  const [formData, setFormData] = useState({
    maquina_id: "",
    produto_id: "",
    quantidadeAtualMaquina: "",
    quantidadeAdicionada: "",
    fichas: "",
    contadorIn: "",
    contadorOut: "",
    quantidade_notas_entrada: "",
    valor_entrada_maquininha_pix: "",
    observacao: "",
    retiradaEstoque: false,
    retiradaProduto: 0,
    ignoreInOut: false,
  });

  // Estados auxiliares
  const [estoqueAnterior, setEstoqueAnterior] = useState(0);
  const [alertaDivergencia, setAlertaDivergencia] = useState(null);

  // --- EFEITOS ---
  useEffect(() => {
    carregarDados();
    carregarMovimentacoesEstoqueLoja();
  }, []);

  useEffect(() => {
    return () => {
      if (fotoContadoresPreview) {
        URL.revokeObjectURL(fotoContadoresPreview);
      }
    };
  }, [fotoContadoresPreview]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const state = location.state || {};
    const deveAbrirFormulario =
      state.abrirFormulario === true ||
      state.autoAbrirMovimentacao === true ||
      params.get("abrirFormulario") === "true";
    const modo = state.modo || params.get("modo");

    if (!deveAbrirFormulario || modo !== "nova_movimentacao") {
      return;
    }

    setMovimentacaoAssistentePendente({
      lojaId: state.lojaId ?? params.get("lojaId") ?? "",
      maquinaId: state.maquinaId ?? params.get("maquinaId") ?? "",
      contadorIn: state.contadorIn ?? params.get("contadorIn") ?? "",
      contadorOut: state.contadorOut ?? params.get("contadorOut") ?? "",
    });
  }, [location.search, location.state]);

  useEffect(() => {
    if (!movimentacaoAssistentePendente || loading) {
      return;
    }

    const lojaId = movimentacaoAssistentePendente.lojaId
      ? String(movimentacaoAssistentePendente.lojaId)
      : "";
    const maquinaId = movimentacaoAssistentePendente.maquinaId
      ? String(movimentacaoAssistentePendente.maquinaId)
      : "";
    const contadorIn =
      movimentacaoAssistentePendente.contadorIn !== undefined &&
      movimentacaoAssistentePendente.contadorIn !== null
        ? String(movimentacaoAssistentePendente.contadorIn)
        : "";
    const contadorOut =
      movimentacaoAssistentePendente.contadorOut !== undefined &&
      movimentacaoAssistentePendente.contadorOut !== null
        ? String(movimentacaoAssistentePendente.contadorOut)
        : "";

    setShowForm(true);
    setFiltroLojaForm(lojaId);
    setFormData((prev) => ({
      ...prev,
      maquina_id: maquinaId,
      produto_id: "",
      contadorIn,
      contadorOut,
    }));
    setMovimentacaoAssistentePendente(null);

    queueMicrotask(() => {
      document
        .getElementById("form-nova-movimentacao")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [movimentacaoAssistentePendente, loading]);

  // Atualizar estoque anterior quando seleciona mÃ¡quina
  useEffect(() => {
    if (formData.maquina_id) {
      const maquina = maquinas.find(
        (m) => String(m.id) === String(formData.maquina_id),
      );
      if (maquina) {
        setEstoqueAnterior(maquina.estoqueAtual || 0);
      }
    }
  }, [formData.maquina_id, maquinas]);

  // Verificar divergÃªncia entre contador OUT e total pre informado
  useEffect(() => {
    const verificarDivergencia = async () => {
      // SÃ³ verificar se temos mÃ¡quina selecionada, contador OUT e total pre preenchidos
      if (
        !formData.maquina_id ||
        !formData.contadorOut ||
        !formData.quantidadeAtualMaquina
      ) {
        setAlertaDivergencia(null);
        return;
      }

      const contadorOutAtual = parseInt(formData.contadorOut);
      const totalPreInformado = parseInt(formData.quantidadeAtualMaquina);

      // Validar se sÃ£o nÃºmeros vÃ¡lidos
      if (isNaN(contadorOutAtual) || isNaN(totalPreInformado)) {
        setAlertaDivergencia(null);
        return;
      }

      try {
        // Buscar Ãºltima movimentaÃ§Ã£o da mÃ¡quina
        const response = await api.get(
          `/movimentacoes?maquinaId=${formData.maquina_id}&limite=1`,
        );
        const movimentacoes = response.data;

        if (movimentacoes && movimentacoes.length > 0) {
          const ultimaMov = movimentacoes[0];
          const contadorOutAnterior = ultimaMov.contadorOut || 0;
          const totalPosAnterior = ultimaMov.totalPos || 0;

          // Calcular quantos produtos saÃ­ram baseado no contador OUT
          const saidaCalculada = contadorOutAtual - contadorOutAnterior;

          // Calcular qual deveria ser o total pre esperado
          const totalPreEsperado = totalPosAnterior - saidaCalculada;

          // Se houver divergÃªncia, mostrar alerta
          const diferenca = Math.abs(totalPreInformado - totalPreEsperado);
          if (diferenca > 0) {
            setAlertaDivergencia({
              totalPreInformado,
              totalPreEsperado,
              diferenca,
              saidaCalculada,
              totalPosAnterior,
              contadorOutAnterior,
              contadorOutAtual,
            });
          } else {
            setAlertaDivergencia(null);
          }
        } else {
          // NÃ£o hÃ¡ movimentaÃ§Ã£o anterior, nÃ£o hÃ¡ como comparar
          setAlertaDivergencia(null);
        }
      } catch (error) {
        console.error("Erro ao verificar divergÃªncia:", error);
        setAlertaDivergencia(null);
      }
    };

    verificarDivergencia();
  }, [
    formData.maquina_id,
    formData.contadorOut,
    formData.quantidadeAtualMaquina,
  ]);

  // Sugere produto automaticamente ao escolher mÃ¡quina, mas permite troca manual
  // Sugere produto via backend ao escolher mÃ¡quina
  useEffect(() => {
    if (!formData.maquina_id) return;
    if (formData.produto_id) return;
    // Busca produto sugerido do backend
    const fetchProdutoSugerido = async () => {
      try {
        const res = await api.get(
          `/maquinas/${formData.maquina_id}/produto-sugerido`,
        );
        if (
          res.data &&
          res.data.produtoSugerido &&
          res.data.produtoSugerido.id
        ) {
          setFormData((prev) => ({
            ...prev,
            produto_id: res.data.produtoSugerido.id,
          }));
        }
      } catch {
        // Silencia erro, nÃ£o sugere nada
      }
    };
    fetchProdutoSugerido();
  }, [formData.maquina_id, formData.produto_id]);

  // --- FUNÃ‡Ã•ES DE CARREGAMENTO ---
  const carregarDados = async () => {
    try {
      setLoading(true);
      const [movRes, maqRes, prodRes, lojasRes, veiculosRes] =
        await Promise.all([
          api.get("/movimentacoes"),
          api.get("/maquinas"),
          api.get("/produtos"),
          api.get("/lojas"),
          api.get("/veiculos"),
        ]);

      setMovimentacoes(movRes.data || []);
      setMaquinas(maqRes.data || []);
      setProdutos(prodRes.data || []);
      setLojas(lojasRes.data || []);
      setVeiculos(veiculosRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      setError("Erro ao carregar dados iniciais.");
    } finally {
      setLoading(false);
    }
  };

  const carregarMovimentacoesEstoqueLoja = async () => {
    try {
      const res = await api.get("/movimentacao-estoque-loja");
      setMovimentacoesEstoqueLoja(res.data || []);
    } catch (error) {
      console.error(
        "Erro ao carregar movimentaÃ§Ãµes de estoque de loja:",
        error,
      );
      setMovimentacoesEstoqueLoja([]);
    }
  };

  // --- HANDLERS ---
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Limpar mensagens de erro/sucesso ao editar
    if (error) setError("");
    if (success) setSuccess("");
  };

  const limparFotoContadores = () => {
    if (fotoContadoresPreview) {
      URL.revokeObjectURL(fotoContadoresPreview);
    }
    setFotoContadores(null);
    setFotoContadoresPreview("");
    setResultadoFotoContadores("");
  };

  const prepararImagemParaEnvioIa = (file) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        const maxSize = 900;
        const escala = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * escala));
        canvas.height = Math.max(1, Math.round(image.height * escala));

        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/jpeg", 0.62));
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Nao foi possivel ler a imagem."));
      };

      image.src = objectUrl;
    });

  const handleFotoContadores = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setResultadoFotoContadores("Selecione uma imagem valida.");
      return;
    }

    if (fotoContadoresPreview) {
      URL.revokeObjectURL(fotoContadoresPreview);
    }

    setFotoContadores(file);
    setFotoContadoresPreview(URL.createObjectURL(file));
    setLendoFotoContadores(true);
    setResultadoFotoContadores("IA Mico lendo os contadores...");
    setError("");
    setSuccess("");

    try {
      const dataUrl = await prepararImagemParaEnvioIa(file);
      const [meta, imagemBase64] = dataUrl.split(",");
      const mimeType = meta.match(/^data:(.*);base64$/)?.[1] || "image/jpeg";
      const tamanhoEstimadoBytes = Math.ceil((imagemBase64.length * 3) / 4);

      if (tamanhoEstimadoBytes > 2 * 1024 * 1024) {
        setResultadoFotoContadores(
          "A foto ficou grande demais para enviar. Tente tirar mais perto dos contadores ou com menos area ao redor.",
        );
        return;
      }

      const response = await api.post("/assistente-ia/ler-contadores", {
        imagemBase64,
        mimeType,
      });
      const { contadorIn, contadorOut, confianca, observacao } = response.data || {};

      if (!contadorIn || !contadorOut || confianca === "baixa") {
        setResultadoFotoContadores(
          observacao ||
            "A IA Mico nao teve certeza dos dois contadores. Preencha manualmente ou tire outra foto mais perto e reta.",
        );
        return;
      }

      setFormData((prev) => ({
        ...prev,
        contadorIn: String(contadorIn),
        contadorOut: String(contadorOut),
        ignoreInOut: false,
      }));
      setResultadoFotoContadores(
        `IA Mico leu: IN ${contadorIn} e OUT ${contadorOut}. Confira antes de salvar.`,
      );
    } catch (err) {
      console.error("Erro ao ler foto dos contadores com IA:", err);
      const erroApi = err.response?.data?.message || err.response?.data?.error;
      const mensagemErro =
        typeof erroApi === "string"
          ? erroApi
          : erroApi
            ? JSON.stringify(erroApi)
            : "Nao foi possivel ler a foto com IA. Preencha manualmente ou tente novamente.";
      setResultadoFotoContadores(mensagemErro);
    } finally {
      setLendoFotoContadores(false);
      e.target.value = "";
    }
  };

  const obterEstoqueDisponivelProdutoLoja = async (lojaId, produtoId) => {
    if (!lojaId || !produtoId) return 0;

    try {
      const response = await api.get(`/estoque-lojas/${lojaId}`);
      const itensEstoque = response.data || [];
      const estoqueProduto = itensEstoque.find(
        (item) =>
          item.produtoId === produtoId || item.produto?.id === produtoId,
      );

      return Number(estoqueProduto?.quantidade || 0);
    } catch (err) {
      console.error("Erro ao consultar estoque da loja:", err);
      throw new Error("NÃ£o foi possÃ­vel validar o estoque da loja.");
    }
  };

  // --- CORREÃ‡ÃƒO AQUI: FunÃ§Ã£o handleSubmit recriada com o TRY ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (movimentacaoEmEnvioRef.current) {
      return;
    }

    movimentacaoEmEnvioRef.current = true;
    setSalvandoMovimentacao(true);
    setError("");
    setSuccess("");

    try {
      const quantidadeAdicionada = parseInt(formData.quantidadeAdicionada) || 0;

      if (quantidadeAdicionada > 0) {
        const estoqueDisponivel = await obterEstoqueDisponivelProdutoLoja(
          filtroLojaForm,
          formData.produto_id,
        );

        if (quantidadeAdicionada > estoqueDisponivel) {
          const produtoSelecionado = produtos.find(
            (p) => p.id === formData.produto_id,
          );
          setError(
            `NÃ£o hÃ¡ estoque suficiente na loja para abastecer ${produtoSelecionado?.nome || "este produto"}. DisponÃ­vel: ${estoqueDisponivel}, solicitado: ${quantidadeAdicionada}.`,
          );
          return;
        }
      }

      setSalvandoMovimentacao(true);

      // Converter valores do formulÃ¡rio
      const totalPre = parseInt(formData.quantidadeAtualMaquina) || 0; // valor digitado pelo usuÃ¡rio
      const fichas = parseInt(formData.fichas) || 0;

      // totalPos = totalPre + abastecidas - retiradaProduto
      const retiradaProduto = parseInt(formData.retiradaProduto) || 0;
      const totalPos = totalPre + quantidadeAdicionada - retiradaProduto;

      // Buscar a Ãºltima movimentaÃ§Ã£o da mÃ¡quina selecionada para pegar o totalPos anterior
      let ultimoTotalPos = 0;
      let movimentacoesMaquina = movimentacoes
        .filter((m) => {
          // Considera tanto maquinaId quanto maquina_id
          return (
            m.maquinaId === formData.maquina_id ||
            m.maquina_id === formData.maquina_id
          );
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (movimentacoesMaquina.length > 0) {
        ultimoTotalPos =
          movimentacoesMaquina[0].totalPos ||
          movimentacoesMaquina[0].totalPos ||
          0;
      }

      // sairam = totalPos da movimentaÃ§Ã£o anterior - totalPre da atual
      // retiradaProduto NÃƒO conta em quantidadeSaiu nem no financeiro
      const quantidadeSaiu = Math.max(0, ultimoTotalPos - totalPre);

      console.log("ðŸ“Š [handleSubmit] CÃ¡lculos da movimentaÃ§Ã£o:");
      console.log("   ðŸ“Œ totalPos anterior:", ultimoTotalPos);
      console.log("   ðŸ“Œ Quantidade atual informada (totalPre):", totalPre);
      console.log(
        "   ðŸ“Œ Quantidade adicionada (abastecidas):",
        quantidadeAdicionada,
      );
      console.log("   ðŸ“Œ Calculado que saiu (sairam):", quantidadeSaiu);
      console.log("   ðŸ“Œ Novo total (totalPos):", totalPos);

      // Preparar observaÃ§Ã£o
      let observacaoFinal = formData.observacao?.trim() || "";
      if (formData.retiradaEstoque) {
        const notaRetirada = "âš ï¸ RETIRADA DE ESTOQUE - NÃƒO Ã‰ VENDA";
        observacaoFinal = observacaoFinal
          ? `${notaRetirada}. ${observacaoFinal}`
          : notaRetirada;
      }

      // Transformar para o formato do backend
      const data = {
        maquinaId: formData.maquina_id,
        totalPre: totalPre,
        sairam: quantidadeSaiu,
        abastecidas: quantidadeAdicionada,
        totalPos: totalPos,
        fichas: fichas,
        contadorIn: parseInt(formData.contadorIn) || null,
        contadorOut: parseInt(formData.contadorOut) || null,
        quantidade_notas_entrada: formData.quantidade_notas_entrada
          ? parseFloat(formData.quantidade_notas_entrada)
          : null,
        valor_entrada_maquininha_pix: formData.valor_entrada_maquininha_pix
          ? parseFloat(formData.valor_entrada_maquininha_pix)
          : null,
        retiradaEstoque: formData.retiradaEstoque,
        contadorMaquina: null,
        observacoes: observacaoFinal || null,
        produtos: [
          {
            produtoId: formData.produto_id,
            quantidadeSaiu: quantidadeSaiu,
            quantidadeAbastecida: quantidadeAdicionada,
            retiradaProduto: retiradaProduto,
            // Transformar para o formato do backend (atualizado)
          },
        ],
      };

      await api.post("/movimentacoes", data);

      // MovimentaÃ§Ã£o registrada com sucesso: envia automaticamente para o WhatsApp
      await enviarParaWhatsapp();
      resetFluxoWhatsappBypass();

      // Devolver retirada para o estoque da loja, se marcado
      if (
        formData.retiradaProdutoDevolverEstoque &&
        retiradaProduto > 0 &&
        formData.produto_id &&
        formData.maquina_id
      ) {
        // Encontrar a loja da mÃ¡quina selecionada
        const maquinaSelecionada = maquinas.find(
          (m) => m.id === formData.maquina_id,
        );
        const lojaId = maquinaSelecionada ? maquinaSelecionada.lojaId : null;
        if (lojaId) {
          await api.post("/movimentacao-estoque-loja", {
            lojaId,
            produtos: [
              {
                produtoId: formData.produto_id,
                quantidade: retiradaProduto,
                tipoMovimentacao: "entrada",
              },
            ],
            usuarioId: usuario.id,
            observacao:
              "DevoluÃ§Ã£o automÃ¡tica de retirada de produto da mÃ¡quina",
          });
        }
      }

      // Logs para depuraÃ§Ã£o do filtro
      console.log("Todas movimentaÃ§Ãµes:", movimentacoes);
      console.log(
        "ID da mÃ¡quina selecionada:",
        formData.maquina_id,
        "(tipo:",
        typeof formData.maquina_id,
        ")",
      );
      movimentacoesMaquina = movimentacoes
        .filter((m) => {
          const id1 = m.maquinaId !== undefined ? m.maquinaId : m.maquina_id;
          console.log(
            "Comparando:",
            id1,
            "(tipo:",
            typeof id1,
            ") com",
            formData.retiradaProdutoDevolverEstoque === true,
            "(tipo:",
            typeof formData.maquina_id,
            ")",
          );
          return id1 === formData.maquina_id;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      console.log("MovimentaÃ§Ãµes filtradas:", movimentacoesMaquina);
      ultimoTotalPos = 0;
      if (movimentacoesMaquina.length > 0) {
        ultimoTotalPos = movimentacoesMaquina[0].totalPos || 0;
      }
      console.log("Ãšltimo totalPos encontrado:", ultimoTotalPos);

      setFormData({
        maquina_id: "",
        produto_id: "",
        quantidadeAtualMaquina: "",
        quantidadeAdicionada: "",
        fichas: "",
        contadorIn: "",
        contadorOut: "",
        quantidade_notas_entrada: "",
        valor_entrada_maquininha_pix: "",
        observacao: "",
        retiradaEstoque: false,
        retiradaProduto: 0,
        ignoreInOut: false,
      });
      limparFotoContadores();
      setEstoqueAnterior(0);
      setFiltroLojaForm("");
      setShowForm(false);

      // Recarregar dados
      carregarDados();
    } catch (error) {
      console.error("âŒ [handleSubmit] Erro:", error);
      setError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Erro ao registrar movimentaÃ§Ã£o",
      );
    } finally {
      movimentacaoEmEnvioRef.current = false;
      setSalvandoMovimentacao(false);
    }
  };

  const iniciarEdicao = (movimentacao) => {
    setEditandoMovimentacao(movimentacao);
    setFormEdicao({
      fichas: movimentacao.fichas || 0,
      abastecidas: movimentacao.abastecidas || 0,
      quantidade_notas_entrada: movimentacao.quantidade_notas_entrada || "",
      valor_entrada_maquininha_pix:
        movimentacao.valor_entrada_maquininha_pix || "",
    });
  };

  const cancelarEdicao = () => {
    setEditandoMovimentacao(null);
    setFormEdicao({
      fichas: "",
      abastecidas: "",
      quantidade_notas_entrada: "",
      valor_entrada_maquininha_pix: "",
    });
  };

  const salvarEdicao = async () => {
    try {
      await api.put(`/movimentacoes/${editandoMovimentacao.id}`, {
        fichas: parseInt(formEdicao.fichas) || 0,
        abastecidas: parseInt(formEdicao.abastecidas) || 0,
        quantidade_notas_entrada:
          formEdicao.quantidade_notas_entrada !== ""
            ? parseFloat(formEdicao.quantidade_notas_entrada)
            : null,
        valor_entrada_maquininha_pix:
          formEdicao.valor_entrada_maquininha_pix !== ""
            ? parseFloat(formEdicao.valor_entrada_maquininha_pix)
            : null,
      });
      setSuccess("MovimentaÃ§Ã£o atualizada com sucesso!");
      cancelarEdicao();
      carregarDados();
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      setError("Erro ao atualizar movimentaÃ§Ã£o");
    }
  };
  const confirmarExclusaoLoja = async () => {
    if (!excluindoEstoqueLoja) return;

    try {
      await api.delete(`/movimentacao-estoque-loja/${excluindoEstoqueLoja.id}`);
      setSuccess("MovimentaÃ§Ã£o de estoque de loja excluÃ­da com sucesso!");
      carregarMovimentacoesEstoqueLoja(); // Recarrega a lista
    } catch (err) {
      console.error("Erro ao excluir:", err);
      setError("Erro ao excluir movimentaÃ§Ã£o de loja.");
    } finally {
      setExcluindoEstoqueLoja(null); // Fecha o modal
    }
  };

  // FunÃ§Ã£o para salvar ediÃ§Ã£o de loja (Exemplo editando o ResponsÃ¡vel)
  const salvarEdicaoLoja = async (e) => {
    e.preventDefault();
    if (!editandoEstoqueLoja) return;

    try {
      await api.put(`/movimentacao-estoque-loja/${editandoEstoqueLoja.id}`, {
        lojaId: editandoEstoqueLoja.loja?.id || editandoEstoqueLoja.lojaId,
        usuarioId: usuario.id,
        produtos: editandoEstoqueLoja.produtosEnviados.map((p) => ({
          produtoId: p.produto?.id || p.produtoId,
          quantidade: Number(p.quantidade),
          tipoMovimentacao: p.tipoMovimentacao || "saida",
        })),
      });

      setSuccess("MovimentaÃ§Ã£o de loja atualizada!");
      carregarMovimentacoesEstoqueLoja();
      if (typeof carregarDados === "function") carregarDados();
      setEditandoEstoqueLoja(null);
    } catch (err) {
      console.error("Erro ao editar:", err);
      setError("Erro ao atualizar movimentaÃ§Ã£o de loja.");
    }
  };

  // --- WHATSAPP ---
  const enviarParaWhatsapp = async () => {
    const loja = lojas.find((l) => l.id === filtroLojaForm);
    const maquina = maquinas.find((m) => m.id === formData.maquina_id);
    const produto = produtos.find((p) => p.id === formData.produto_id);
    const capacidadeMaquina =
      maquina?.capacidadePadrao ?? maquina?.capacidade ?? null;

    const totalPre = parseInt(formData.quantidadeAtualMaquina) || 0;
    const quantidadeAdicionada = parseInt(formData.quantidadeAdicionada) || 0;
    const retiradaProduto = parseInt(formData.retiradaProduto) || 0;
    const totalPos = totalPre + quantidadeAdicionada - retiradaProduto;

    let mensagem = ` *MovimentaÃ§Ã£o de MÃ¡quina*\n`;
    mensagem += `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n\n`;
    mensagem += `->  *Loja:* ${loja?.nome || "NÃ£o informada"}\n`;
    mensagem += `->  *MÃ¡quina:* ${maquina ? `${maquina.nome} - ${maquina.codigo}` : "NÃ£o informada"}\n`;
    mensagem += `->  *Produto:* ${produto ? `${produto.emoji || ""} ${produto.nome}` : "NÃ£o informado"}\n`;
    mensagem += `->  *Capacidade da mÃ¡quina:* ${capacidadeMaquina ?? "NÃ£o informada"}\n`;

    if (!formData.ignoreInOut) {
      mensagem += `\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n`;
      mensagem += `->  *Contador IN:* ${formData.contadorIn || "0"}\n`;
      mensagem += `->  *Contador OUT:* ${formData.contadorOut || "0"}\n`;
    }

    mensagem += `\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n`;
    mensagem += `->  *Quantidade atual na mÃ¡quina:* ${totalPre}\n`;
    mensagem += `->  *Quantidade adicionada:* ${quantidadeAdicionada}\n`;
    mensagem += `->  *Total apÃ³s abastecimento:* ${totalPos}\n`;
    mensagem += `->  *Fichas:* ${formData.fichas || "0"}\n`;

    if (retiradaProduto > 0) {
      mensagem += `\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n`;
      mensagem += `->  *Retirada de produto:* ${retiradaProduto}\n`;
      mensagem += `->  *Devolvido ao estoque:* ${formData.retiradaProdutoDevolverEstoque ? "Sim âœ…" : "NÃ£o âŒ"}\n`;
    }

    if (formData.retiradaEstoque) {
      mensagem += `\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n`;
      mensagem += `-> *Retirada de estoque (nÃ£o Ã© venda)*\n`;
    }

    if (formData.observacao?.trim()) {
      mensagem += `\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n`;
      mensagem += `->  *ObservaÃ§Ã£o:* ${formData.observacao.trim()}\n`;
    }

    if (fotoContadores) {
      mensagem += `\n->  *Foto dos contadores:* anexada nesta mensagem\n`;
    }

    localStorage.setItem(CHAVE_ULTIMA_MENSAGEM_WHATSAPP, mensagem);
    setTemMensagemSalva(true);
    try {
      if (fotoContadores) {
        await salvarFotoUltimaMovimentacao(fotoContadores);
      } else {
        await limparFotoUltimaMovimentacao();
      }
    } catch (err) {
      console.error("Erro ao salvar foto da Ãºltima movimentaÃ§Ã£o:", err);
    }

    if (
      fotoContadores &&
      navigator.canShare &&
      navigator.share &&
      navigator.canShare({ files: [fotoContadores] })
    ) {
      try {
        await navigator.share({
          title: "Movimentacao de Maquina",
          text: mensagem,
          files: [fotoContadores],
        });
        return;
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }
        console.error("Erro ao compartilhar foto no WhatsApp:", err);
      }
    }

    if (fotoContadores) {
      setError(
        "Este navegador nao permite anexar a foto automaticamente pelo WhatsApp. O texto foi aberto; anexe a foto manualmente na conversa.",
      );
    }

    const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const enviarUltimaMensagemSalva = async () => {
    const mensagem = localStorage.getItem(CHAVE_ULTIMA_MENSAGEM_WHATSAPP);
    if (!mensagem) {
      setError("Nenhuma mensagem de movimentaÃ§Ã£o salva para reenviar.");
      return;
    }

    const foto = await obterFotoUltimaMovimentacao().catch((err) => {
      console.error("Erro ao ler foto salva da Ãºltima movimentaÃ§Ã£o:", err);
      return null;
    });

    if (
      foto &&
      navigator.canShare &&
      navigator.share &&
      navigator.canShare({ files: [foto] })
    ) {
      try {
        await navigator.share({
          title: "Movimentacao de Maquina",
          text: mensagem,
          files: [foto],
        });
        return;
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }
        console.error("Erro ao compartilhar foto salva no WhatsApp:", err);
      }
    }

    if (foto) {
      setError(
        "Este navegador nÃ£o permite anexar a foto automaticamente pelo WhatsApp. O texto foi aberto; anexe a foto manualmente na conversa.",
      );
    }

    const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const resetFluxoWhatsappBypass = () => {
    setNaoVaiRegistrar(false);
    setMostrarObsAlerta(false);
    setObsAlerta("");
  };

  const handleClickEnviarWhatsapp = () => {
    if (!naoVaiRegistrar) return;
    if (!formData.maquina_id) {
      setError("Selecione a mÃ¡quina antes de enviar para o WhatsApp.");
      return;
    }
    setMostrarObsAlerta(true);
  };

  const confirmarEnvioBypassWhatsapp = async () => {
    if (!obsAlerta.trim() || enviandoAlerta) return;

    setEnviandoAlerta(true);
    setError("");
    try {
      await api.post("/alertas-movimentacao", {
        maquinaId: formData.maquina_id,
        observacao: obsAlerta.trim(),
      });
      await enviarParaWhatsapp();
      resetFluxoWhatsappBypass();
    } catch (err) {
      console.error("Erro ao registrar alerta de movimentaÃ§Ã£o:", err);
      setError(
        err?.response?.data?.error ||
          "NÃ£o foi possÃ­vel registrar o alerta. O WhatsApp nÃ£o foi aberto.",
      );
    } finally {
      setEnviandoAlerta(false);
    }
  };

  // --- CÃLCULOS DE ESTATÃSTICAS ---
  const entradas = movimentacoes.filter((m) => m.abastecidas > 0);
  const saidas = movimentacoes.filter((m) => m.sairam > 0);
  const totalEntradas = entradas.reduce(
    (sum, m) => sum + (m.abastecidas || 0),
    0,
  );
  const totalSaidas = saidas.reduce((sum, m) => sum + (m.sairam || 0), 0);

  const movimentacoesFiltradas = filtroLojaListagem
    ? movimentacoes.filter((mov) => {
        const maquina = maquinas.find((m) => m.id === mov.maquinaId);
        return maquina?.lojaId === filtroLojaListagem;
      })
    : movimentacoes;

  const stats = [
    {
      label: "Total de Entradas",
      value: totalEntradas,
      icon: "ðŸ“¥",
      gradient: "bg-gradient-to-br from-green-500 to-green-600",
      subtitle: "Produtos abastecidos",
    },
    {
      label: "Total de SaÃ­das",
      value: totalSaidas,
      icon: "ðŸ“¤",
      gradient: "bg-gradient-to-br from-red-500 to-red-600",
      subtitle: "Produtos vendidos",
    },
    {
      label: "Saldo",
      value: totalEntradas - totalSaidas,
      icon: "ðŸ“Š",
      gradient: "bg-gradient-to-br from-blue-500 to-blue-600",
      subtitle: "DiferenÃ§a entrada/saÃ­da",
    },
    {
      label: "MovimentaÃ§Ãµes",
      value: movimentacoes.length,
      icon: "ðŸ”„",
      gradient: "bg-gradient-to-br from-purple-500 to-purple-600",
      subtitle: "Total de registros",
    },
  ];

  const columns = [
    {
      key: "data",
      label: "Data/Hora",
      render: (mov) => {
        const data = new Date(mov.dataColeta || mov.createdAt);
        return (
          <div>
            <div className="font-semibold">
              {data.toLocaleDateString("pt-BR")}
            </div>
            <div className="text-xs text-gray-500">
              {data.toLocaleTimeString("pt-BR")}
            </div>
          </div>
        );
      },
    },
    {
      key: "usuario",
      label: "UsuÃ¡rio",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">ðŸ‘¤</span>
          <span className="text-sm font-medium text-gray-700">
            {mov.usuario?.nome || "NÃ£o informado"}
          </span>
        </div>
      ),
    },
    {
      key: "tipo",
      label: "Tipo",
      render: (mov) => {
        const isEntrada = mov.abastecidas > 0;
        return (
          <Badge variant={isEntrada ? "success" : "danger"}>
            {isEntrada ? "ðŸ“¥ Entrada" : "ðŸ“¤ SaÃ­da"}
          </Badge>
        );
      },
    },
    {
      key: "produto",
      label: "Produto",
      render: (mov) => {
        const produtoId = mov.detalhesProdutos?.[0]?.produtoId;
        const produto = produtos.find((p) => p.id === produtoId);
        return produto ? (
          <div className="flex items-center gap-2">
            <span className="text-xl">{produto.emoji || "ðŸ§¸"}</span>
            <span>{produto.nome}</span>
          </div>
        ) : (
          `N/A (ID: ${produtoId || "undefined"})`
        );
      },
    },
    {
      key: "maquina",
      label: "MÃ¡quina",
      render: (mov) => {
        const maquina =
          mov.maquina || maquinas.find((m) => m.id === mov.maquinaId);
        if (!maquina) return `N/A (ID: ${mov.maquinaId})`;
        const loja = lojas.find((l) => l.id === maquina.lojaId);
        return (
          <div>
            <div className="font-semibold">
              {maquina.codigo}
              <span className="text-gray-500 text-xs ml-1">
                - {maquina.nome}
              </span>
            </div>
            <div className="text-xs text-gray-500">{loja?.nome || "N/A"}</div>
          </div>
        );
      },
    },
    {
      key: "saida",
      label: "SaÃ­da",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">ðŸ“¤</span>
          <span className="font-bold text-red-600">
            {mov.sairam > 0 ? `-${mov.sairam}` : "-"}
          </span>
        </div>
      ),
    },
    {
      key: "entrada",
      label: "Entrada",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">ðŸ“¥</span>
          <span className="font-bold text-green-600">
            {mov.abastecidas > 0 ? `+${mov.abastecidas}` : "-"}
          </span>
        </div>
      ),
    },
    {
      key: "fichas",
      label: "Fichas",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">ðŸŽ«</span>
          <span className="font-semibold text-blue-600">{mov.fichas || 0}</span>
        </div>
      ),
    },
    {
      key: "observacao",
      label: "ObservaÃ§Ã£o",
      render: (mov) => (
        <span className="text-sm text-gray-600">{mov.observacoes || "-"}</span>
      ),
    },
  ];

  if (usuario?.role === "ADMIN") {
    columns.push({
      key: "acoes",
      label: "AÃ§Ãµes",
      render: (mov) => (
        <button
          onClick={() => iniciarEdicao(mov)}
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Editar
        </button>
      ),
    });
  }

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header com dois botÃµes lado a lado */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <PageHeader
            title="MovimentaÃ§Ãµes"
            subtitle="Registre entradas e saÃ­das de produtos nas mÃ¡quinas"
            icon="ðŸ”„"
            action={null}
          />
          <div className="flex flex-wrap gap-3">
            <button
              className="px-6 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 font-bold shadow text-base"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Cancelar" : "Nova MovimentaÃ§Ã£o"}
            </button>
            <button
              className="px-6 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 font-bold shadow text-base"
              onClick={() => navigate("/sangrias")}
            >
              Sangria
            </button>
            {usuario?.role !== "FUNCIONARIO" && (
              <button
                className="px-6 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 font-bold shadow text-base"
                onClick={() => setModalRegistrarDinheiro(true)}
              >
                Registrar Dinheiro
              </button>
            )}
            <button
              className="px-6 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-bold shadow text-base"
              onClick={() => setModalGastoVariavel(true)}
            >
              LanÃ§ar Gasto VariÃ¡vel
            </button>
            <button
              className="px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 font-bold shadow text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700"
              onClick={enviarUltimaMensagemSalva}
              disabled={!temMensagemSalva}
              title={
                temMensagemSalva
                  ? "Reenviar a mensagem da Ãºltima movimentaÃ§Ã£o lanÃ§ada"
                  : "Nenhuma mensagem salva ainda"
              }
            >
              Enviar Ãšltima Mensagem
            </button>
          </div>
        </div>

        {/* Modal LanÃ§ar Gasto VariÃ¡vel */}
        {modalGastoVariavel && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-lg relative">
              <button
                onClick={() => setModalGastoVariavel(false)}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 16,
                  fontSize: 22,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#888",
                }}
                aria-label="Fechar"
              >
                Ã—
              </button>
              <LancarGastoVariavel
                lojas={lojas}
                veiculos={veiculos}
                onClose={() => setModalGastoVariavel(false)}
                onSuccess={() => {
                  setSuccess("Gasto variÃ¡vel lanÃ§ado com sucesso!");
                  carregarDados();
                }}
              />
            </div>
          </div>
        )}
        {/* Modal Registrar Dinheiro */}
        {modalRegistrarDinheiro && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div
              className="bg-white rounded-lg p-6 shadow-lg relative"
              style={{ minWidth: 520 }}
            >
              <button
                onClick={() => setModalRegistrarDinheiro(false)}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 16,
                  fontSize: 22,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#888",
                }}
                aria-label="Fechar"
              >
                Ã—
              </button>
              <RegistrarDinheiro
                lojas={lojas}
                maquinas={maquinas}
                onSubmit={async (data) => {
                  try {
                    setError("");
                    setSuccess("");
                    const response = await api.post("/registro-dinheiro", data);
                    const fechamentoMachinePay =
                      response.data?.fechamentoMachinePay;
                    if (fechamentoMachinePay?.executado) {
                      setSuccess(
                        fechamentoMachinePay.concluido
                          ? "Registro salvo e fechamento concluÃ­do na Machine Pay!"
                          : `Registro salvo no sistema, mas a Machine Pay nÃ£o confirmou o fechamento${
                              fechamentoMachinePay.erro
                                ? `: ${fechamentoMachinePay.erro}`
                                : "."
                            }`,
                      );
                    } else {
                      setSuccess("Registro de dinheiro salvo com sucesso!");
                    }
                    setModalRegistrarDinheiro(false);
                  } catch (err) {
                    setError(
                      err?.response?.data?.error ||
                        "Erro ao registrar dinheiro.",
                    );
                  }
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        )}

        {usuario?.role === "ADMIN" && <StatsGrid stats={stats} />}

        <AvisosMaquinasFaltam lojas={lojas} />

        {/* Filtro por Loja - Apenas para ADMIN */}
        {usuario?.role === "ADMIN" && (
          <div className="card-gradient mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">ðŸ”</span>
              Filtrar MovimentaÃ§Ãµes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ðŸª Filtrar por Loja
                </label>
                <select
                  value={filtroLojaListagem}
                  onChange={(e) => setFiltroLojaListagem(e.target.value)}
                  className="input-field"
                >
                  <option value="">Todas as lojas</option>
                  {lojas.map((loja) => (
                    <option key={loja.id} value={loja.id}>
                      {loja.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div id="form-nova-movimentacao" className="card-gradient mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">ðŸ“</span>
              Registrar MovimentaÃ§Ã£o
            </h3>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <strong>Como funciona:</strong> Informe quantos produtos tem
                AGORA na mÃ¡quina (o sistema calcula o que saiu). Se abastecer,
                informe quantos foram adicionados.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-4 bg-white border border-blue-100 rounded-lg">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Foto dos contadores
                </label>
                <input
                  id="foto-contadores-camera"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFotoContadores}
                  className="sr-only"
                  disabled={lendoFotoContadores}
                />
                <label
                  htmlFor="foto-contadores-camera"
                  className={`inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold text-white shadow transition-colors ${
                    lendoFotoContadores
                      ? "cursor-not-allowed bg-gray-400"
                      : "cursor-pointer bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  <span aria-hidden="true">ðŸ“·</span>
                  {lendoFotoContadores ? "Lendo foto..." : "Tirar foto dos contadores"}
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  No celular, o botao abre a camera para fotografar os dois
                  contadores. O maior numero sera usado como IN e o menor como
                  OUT. Confira e ajuste se precisar.
                </p>

                {fotoContadoresPreview && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3 items-start">
                    <img
                      src={fotoContadoresPreview}
                      alt="Foto dos contadores"
                      className="w-full max-w-40 rounded-lg border border-gray-200 object-cover"
                    />
                    <div className="text-sm">
                      {resultadoFotoContadores && (
                        <p
                          className={`font-medium ${
                            lendoFotoContadores
                              ? "text-blue-700"
                              : "text-gray-700"
                          }`}
                        >
                          {resultadoFotoContadores}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        A foto nao sera salva no sistema. Ela fica somente para
                        anexar na mensagem do WhatsApp.
                      </p>
                      <button
                        type="button"
                        onClick={limparFotoContadores}
                        className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Remover foto
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* Contadores da MÃ¡quina */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ðŸ“¥ Contador IN (Entrada)
                  </label>
                  <input
                    type="number"
                    name="contadorIn"
                    value={formData.contadorIn}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                    required={!formData.ignoreInOut}
                    disabled={formData.ignoreInOut}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    NÃºmero do contador IN da mÃ¡quina
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ðŸ“¤ Contador OUT (SaÃ­da)
                  </label>
                  <input
                    type="number"
                    name="contadorOut"
                    value={formData.contadorOut}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                    required={!formData.ignoreInOut}
                    disabled={formData.ignoreInOut}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    NÃºmero do contador OUT da mÃ¡quina
                  </p>
                </div>
              </div>
              {/* Checkbox para ignorar IN/OUT */}
              <div className="flex items-center mt-2 mb-4">
                <input
                  type="checkbox"
                  id="ignoreInOut"
                  name="ignoreInOut"
                  checked={formData.ignoreInOut || false}
                  onChange={handleChange}
                  className="mr-2"
                />
                <label htmlFor="ignoreInOut" className="text-sm text-gray-700">
                  NÃ£o preciso informar IN/OUT nesta movimentaÃ§Ã£o
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ðŸ“¦ Quantidade Atual na MÃ¡quina *
                  </label>
                  <input
                    type="number"
                    name="quantidadeAtualMaquina"
                    value={formData.quantidadeAtualMaquina}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantos produtos tem agora
                  </p>
                  {formData.quantidadeAtualMaquina && estoqueAnterior > 0 && (
                    <p className="text-xs font-semibold text-red-600 mt-1">
                      ðŸ”» SaÃ­ram:{" "}
                      {Math.max(
                        0,
                        estoqueAnterior -
                          parseInt(formData.quantidadeAtualMaquina || 0),
                      )}{" "}
                      unidades
                    </p>
                  )}
                  {alertaDivergencia && (
                    <div className="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                      <div className="flex items-start">
                        <span className="text-yellow-600 text-lg mr-2">âš ï¸</span>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-yellow-800 mb-1">
                            AtenÃ§Ã£o: PossÃ­vel erro de contagem!
                          </p>
                          <p className="text-xs text-yellow-700">
                            Reconte por favor
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ðŸ“¥ Quantidade Adicionada
                  </label>
                  <input
                    type="number"
                    name="quantidadeAdicionada"
                    value={formData.quantidadeAdicionada}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantos produtos foram adicionados
                  </p>
                  {formData.quantidadeAdicionada &&
                    formData.quantidadeAtualMaquina && (
                      <p className="text-xs font-semibold text-green-600 mt-1">
                        âœ… Novo total:{" "}
                        {parseInt(formData.quantidadeAtualMaquina || 0) +
                          parseInt(formData.quantidadeAdicionada || 0)}{" "}
                        unidades
                      </p>
                    )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ðŸŽ« Quantidade de Fichas
                  </label>
                  <input
                    type="number"
                    name="fichas"
                    value={formData.fichas}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                    disabled={formData.retiradaEstoque}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Fichas coletadas da mÃ¡quina
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    âŒ Retirada de Produto
                  </label>
                  <input
                    type="number"
                    name="retiradaProduto"
                    value={formData.retiradaProduto}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantidade de produtos retirados (nÃ£o conta como saÃ­da
                    financeira)
                  </p>
                  <label className="flex items-center mt-2 gap-2">
                    <input
                      type="checkbox"
                      name="retiradaProdutoDevolverEstoque"
                      checked={formData.retiradaProdutoDevolverEstoque || false}
                      onChange={handleChange}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-xs text-green-700">
                      Devolver retirada para o estoque da loja
                    </span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ðŸ’µ Valor em Notas (R$)
                  </label>
                  <input
                    type="number"
                    name="quantidade_notas_entrada"
                    value={formData.quantidade_notas_entrada}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor total em dinheiro (notas) inserido na mÃ¡quina
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ðŸ’³ Valor Digital (Pix/Maquininha) (R$)
                  </label>
                  <input
                    type="number"
                    name="valor_entrada_maquininha_pix"
                    value={formData.valor_entrada_maquininha_pix}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor total recebido via pagamento digital (Pix/Maquininha)
                  </p>
                </div>
              </div>

              {/* Checkbox de Retirada de Estoque */}
              <div className="p-4 bg-linear-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="retiradaEstoque"
                    checked={formData.retiradaEstoque}
                    onChange={handleChange}
                    className="w-5 h-5 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 focus:ring-2 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-bold text-orange-900">
                      ðŸ“¦ Retirada de Estoque (nÃ£o conta como dinheiro)
                    </span>
                    <p className="text-xs text-orange-700 mt-1">
                      Marque esta opÃ§Ã£o quando estiver retirando produtos da
                      mÃ¡quina sem que seja uma venda (exemplo: produtos
                      danificados, devoluÃ§Ã£o, transferÃªncia). As fichas serÃ£o
                      automaticamente zeradas.
                    </p>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Loja *
                  </label>
                  <select
                    value={filtroLojaForm}
                    onChange={(e) => {
                      setFiltroLojaForm(e.target.value);
                      setFormData({
                        ...formData,
                        maquina_id: "",
                        produto_id: "",
                      });
                    }}
                    className="select-field"
                    required
                  >
                    <option value="">Selecione uma loja...</option>
                    {lojas
                      .filter((l) => l.ativo)
                      .map((loja) => (
                        <option key={loja.id} value={loja.id}>
                          {loja.nome}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    MÃ¡quina *
                  </label>
                  <select
                    name="maquina_id"
                    value={formData.maquina_id}
                    onChange={handleChange}
                    className="select-field"
                    required
                    disabled={!filtroLojaForm}
                  >
                    <option value="">
                      {filtroLojaForm
                        ? "Selecione uma mÃ¡quina..."
                        : "Primeiro selecione uma loja"}
                    </option>
                    {maquinas
                      .filter(
                        (m) =>
                          !filtroLojaForm ||
                          String(m.lojaId) === String(filtroLojaForm),
                      )
                      .map((maquina) => (
                        <option key={maquina.id} value={maquina.id}>
                          {maquina.nome} - {maquina.codigo}
                        </option>
                      ))}
                  </select>
                  {filtroLojaForm && (
                    <p className="text-xs text-gray-500 mt-1">
                      ðŸ’¡ Mostrando apenas mÃ¡quinas da loja selecionada
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Produto *
                  </label>
                  <select
                    name="produto_id"
                    value={formData.produto_id}
                    onChange={handleChange}
                    className={`select-field ${formData.produto_id ? "border-blue-500 bg-blue-50" : ""}`}
                    required
                  >
                    <option value="">Nenhum produto</option>
                    {produtos.map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.emoji || "ðŸ§¸"} {produto.nome}
                      </option>
                    ))}
                  </select>
                  {formData.maquina_id && formData.produto_id && (
                    <p className="text-[10px] text-blue-600 mt-1 animate-pulse">
                      âœ¨ Produto sugerido com base na Ãºltima visita
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ObservaÃ§Ã£o
                  </label>
                  <textarea
                    name="observacao"
                    value={formData.observacao}
                    onChange={handleChange}
                    className="input-field"
                    rows="2"
                    placeholder="InformaÃ§Ãµes adicionais sobre a movimentaÃ§Ã£o..."
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 pt-4 border-t border-gray-200 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <input
                  type="checkbox"
                  id="naoVaiRegistrar"
                  checked={naoVaiRegistrar}
                  onChange={(e) => {
                    setNaoVaiRegistrar(e.target.checked);
                    if (!e.target.checked) {
                      setMostrarObsAlerta(false);
                      setObsAlerta("");
                    }
                  }}
                  className="mt-1"
                />
                <label htmlFor="naoVaiRegistrar" className="text-sm text-amber-900">
                  NÃ£o vou registrar esta movimentaÃ§Ã£o agora â€” sÃ³ quero avisar
                  pelo WhatsApp. (isso gera um alerta pra loja acompanhar)
                </label>
              </div>

              {mostrarObsAlerta && (
                <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 space-y-2">
                  <label className="block text-sm font-semibold text-amber-900">
                    Por que vocÃª nÃ£o vai registrar essa movimentaÃ§Ã£o agora?
                  </label>
                  <textarea
                    value={obsAlerta}
                    onChange={(e) => setObsAlerta(e.target.value)}
                    className="input-field"
                    rows="2"
                    placeholder="Explique o motivo (obrigatÃ³rio)"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setMostrarObsAlerta(false)}
                      disabled={enviandoAlerta}
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={confirmarEnvioBypassWhatsapp}
                      disabled={enviandoAlerta || !obsAlerta.trim()}
                    >
                      {enviandoAlerta
                        ? "Enviando..."
                        : "Confirmar e enviar para WhatsApp"}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-end pt-4 border-t border-gray-200">
                {error && (
                  <AlertBox
                    type="error"
                    message={error}
                    onClose={() => setError("")}
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFiltroLojaForm("");
                    limparFotoContadores();
                    resetFluxoWhatsappBypass();
                  }}
                  className="btn-secondary w-full sm:w-auto"
                  disabled={salvandoMovimentacao}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleClickEnviarWhatsapp}
                  className={`px-4 py-2 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 shadow w-full sm:w-auto ${
                    naoVaiRegistrar
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                  disabled={salvandoMovimentacao || !naoVaiRegistrar}
                  title={
                    naoVaiRegistrar
                      ? "Enviar aviso pelo WhatsApp sem registrar"
                      : "Marque a caixa acima para liberar este botÃ£o"
                  }
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Enviar para WhatsApp
                </button>
                <button
                  type="submit"
                  className="btn-primary w-full sm:w-auto"
                  disabled={salvandoMovimentacao}
                >
                  {salvandoMovimentacao ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Salvando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Registrar MovimentaÃ§Ã£o
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* HistÃ³rico de MovimentaÃ§Ãµes - Apenas para ADMIN */}
        {usuario?.role === "ADMIN" && (
          <div className="card-gradient">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">ðŸ“‹</span>
              HistÃ³rico de MovimentaÃ§Ãµes
              {filtroLojaListagem && (
                <span className="text-sm text-gray-600 font-normal">
                  ({movimentacoesFiltradas.length} de {movimentacoes.length}{" "}
                  registros)
                </span>
              )}
            </h3>

            {movimentacoesFiltradas.length > 0 ? (
              <DataTable headers={columns} data={movimentacoesFiltradas} />
            ) : (
              <EmptyState
                icon="ðŸ”„"
                title={
                  filtroLojaListagem
                    ? "Nenhuma movimentaÃ§Ã£o encontrada"
                    : "Nenhuma movimentaÃ§Ã£o registrada"
                }
                message={
                  filtroLojaListagem
                    ? "NÃ£o hÃ¡ movimentaÃ§Ãµes para a loja selecionada."
                    : "Registre sua primeira movimentaÃ§Ã£o para comeÃ§ar o controle de estoque!"
                }
                action={{
                  label: "Nova MovimentaÃ§Ã£o",
                  onClick: () => setShowForm(true),
                }}
              />
            )}
          </div>
        )}

        {/* SeÃ§Ã£o MovimentaÃ§Ãµes de Estoque de Loja - visÃ­vel apenas para ADMIN */}
        {usuario?.role === "ADMIN" && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span className="text-3xl">ðŸª</span>
              MovimentaÃ§Ãµes de Estoque de Loja
            </h2>
            {/* Filtros */}
            <div className="mb-5 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm p-4 md:p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-sm md:text-base font-bold text-gray-800 flex items-center gap-2">
                  <span>ðŸ”Ž</span>
                  Filtros
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setFiltroLojaEstoque("");
                    setFiltroDataInicioEstoque("");
                    setFiltroDataFimEstoque("");
                    setFiltroResponsavelEstoque("");
                  }}
                  className="text-xs md:text-sm font-semibold text-blue-700 hover:text-blue-800 transition-colors"
                >
                  Limpar filtros
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Loja
                  </label>
                  <select
                    className="input-field"
                    value={filtroLojaEstoque}
                    onChange={(e) => setFiltroLojaEstoque(e.target.value)}
                  >
                    <option value="">Todas as lojas</option>
                    {lojas.map((loja) => (
                      <option key={loja.id} value={loja.id}>
                        {loja.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data inÃ­cio
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={filtroDataInicioEstoque}
                    onChange={(e) => setFiltroDataInicioEstoque(e.target.value)}
                    aria-label="Data inÃ­cio"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data fim
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={filtroDataFimEstoque}
                    onChange={(e) => setFiltroDataFimEstoque(e.target.value)}
                    aria-label="Data fim"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ResponsÃ¡vel
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Digite o nome"
                    value={filtroResponsavelEstoque}
                    onChange={(e) =>
                      setFiltroResponsavelEstoque(e.target.value)
                    }
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                Sem selecionar datas, a tabela mostra automaticamente apenas os
                registros de hoje.
              </p>
            </div>
            <TabelaMovimentacoesEstoqueDeLoja
              movimentacoesEstoqueLoja={movimentacoesEstoqueLoja}
              lojas={lojas}
              produtos={produtos}
              filtroLojaEstoque={filtroLojaEstoque}
              filtroDataInicioEstoque={filtroDataInicioEstoque}
              filtroDataFimEstoque={filtroDataFimEstoque}
              filtroResponsavelEstoque={filtroResponsavelEstoque}
              setEditandoEstoqueLoja={setEditandoEstoqueLoja}
              setExcluindoEstoqueLoja={setExcluindoEstoqueLoja}
              onChangeEstoqueLoja={carregarDados}
            />
          </div>
        )}

        {/* Modal de EdiÃ§Ã£o */}
        {editandoMovimentacao && usuario?.role === "ADMIN" && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">âœï¸</span>
                  Editar MovimentaÃ§Ã£o
                </h3>
                <button
                  onClick={cancelarEdicao}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Data:</strong>{" "}
                    {new Date(
                      editandoMovimentacao.dataColeta ||
                        editandoMovimentacao.createdAt,
                    ).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>MÃ¡quina:</strong>{" "}
                    {maquinas.find(
                      (m) => m.id === editandoMovimentacao.maquinaId,
                    )?.codigo || "N/A"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ðŸŽ« Quantidade de Fichas
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formEdicao.fichas}
                    onChange={(e) =>
                      setFormEdicao({ ...formEdicao, fichas: e.target.value })
                    }
                    className="input-field"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ðŸ“¦ Quantidade Abastecida
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formEdicao.abastecidas}
                    onChange={(e) =>
                      setFormEdicao({
                        ...formEdicao,
                        abastecidas: e.target.value,
                      })
                    }
                    className="input-field"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ðŸ’µ Quantidade de Notas
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formEdicao.quantidade_notas_entrada}
                    onChange={(e) =>
                      setFormEdicao({
                        ...formEdicao,
                        quantidade_notas_entrada: e.target.value,
                      })
                    }
                    className="input-field"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ðŸ’³ Valor Digital (Pix/Maquininha) (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formEdicao.valor_entrada_maquininha_pix}
                    onChange={(e) =>
                      setFormEdicao({
                        ...formEdicao,
                        valor_entrada_maquininha_pix: e.target.value,
                      })
                    }
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={cancelarEdicao}
                    className="flex-1 btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button onClick={salvarEdicao} className="flex-1 btn-primary">
                    Salvar AlteraÃ§Ãµes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* --- MODAL DE EXCLUSÃƒO DE ESTOQUE LOJA --- */}
      {excluindoEstoqueLoja && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">
                Excluir MovimentaÃ§Ã£o?
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Tem certeza que deseja excluir esta movimentaÃ§Ã£o de estoque da
                loja? Esta aÃ§Ã£o nÃ£o pode ser desfeita.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={() => setExcluindoEstoqueLoja(null)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button onClick={confirmarExclusaoLoja} className="btn-danger">
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE EDIÃ‡ÃƒO DE ESTOQUE LOJA --- */}
      {editandoEstoqueLoja && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              âœï¸ Editar Produtos Enviados
            </h3>
            <form onSubmit={salvarEdicaoLoja}>
              <div className="p-3 bg-gray-50 rounded mb-4">
                <p className="text-xs text-gray-500">
                  Data:{" "}
                  {editandoEstoqueLoja.data
                    ? new Date(editandoEstoqueLoja.data).toLocaleString("pt-BR")
                    : "-"}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Produtos Enviados
                </label>
                {editandoEstoqueLoja.produtosEnviados &&
                editandoEstoqueLoja.produtosEnviados.length > 0 ? (
                  editandoEstoqueLoja.produtosEnviados.map((prod, idx) => (
                    <div
                      key={prod.id || idx}
                      className="flex gap-2 mb-2 items-center"
                    >
                      <span className="min-w-30">
                        {prod.produto?.nome || prod.produtoId}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={prod.quantidade}
                        onChange={(e) => {
                          const novaLista =
                            editandoEstoqueLoja.produtosEnviados.map((p, i) =>
                              i === idx
                                ? { ...p, quantidade: e.target.value }
                                : p,
                            );
                          setEditandoEstoqueLoja({
                            ...editandoEstoqueLoja,
                            produtosEnviados: novaLista,
                          });
                        }}
                        className="input-field w-24"
                      />
                      <select
                        value={prod.tipoMovimentacao}
                        onChange={(e) => {
                          const novaLista =
                            editandoEstoqueLoja.produtosEnviados.map((p, i) =>
                              i === idx
                                ? { ...p, tipoMovimentacao: e.target.value }
                                : p,
                            );
                          setEditandoEstoqueLoja({
                            ...editandoEstoqueLoja,
                            produtosEnviados: novaLista,
                          });
                        }}
                        className="input-field w-28"
                      >
                        <option value="entrada">Entrada</option>
                        <option value="saida">SaÃ­da</option>
                      </select>
                    </div>
                  ))
                ) : (
                  <span className="text-gray-500">Nenhum produto enviado</span>
                )}
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setEditandoEstoqueLoja(null)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
