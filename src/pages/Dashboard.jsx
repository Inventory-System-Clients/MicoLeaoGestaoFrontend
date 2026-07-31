import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { IAgarraAssistente } from "../components/IAgarraAssistente";
import { PageLoader } from "../components/Loading";
import { Badge } from "../components/UIComponents";
import AlertAdmin from "../components/AlertAdmin";
import LancarGastoVariavel from "../components/LancarGastoVariavel";
import { useAuth } from "../contexts/AuthContext";
import { filtrarLojasOperacionais } from "../utils/lojas";

import Swal from "sweetalert2";

export function Dashboard() {
  const navigate = useNavigate();
  const [mostrarTodosAlertasMaquinas, setMostrarTodosAlertasMaquinas] =
    useState(false);
  // Estado para modal de movimentação de estoque
  const [mostrarModalMovimentacao, setMostrarModalMovimentacao] =
    useState(false);
  // Estados para busca e navegação (deve vir antes do uso em modais)
  const [searchTerm, setSearchTerm] = useState("");
  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [alertasBomDesempenho, setAlertasBomDesempenho] = useState([]);
  // Estado para modal de movimentação de estoque de loja
  const [movimentacaoLojaId, setMovimentacaoLojaId] = useState("");
  const [movimentacaoEnviando, setMovimentacaoEnviando] = useState(false);
  const [movimentacaoErro, setMovimentacaoErro] = useState("");
  // Removido movimentacaoSucesso, feedback só via alert externo
  // Estado para lista de produtos da movimentação
  const [produtosMovimentacao, setProdutosMovimentacao] = useState([
    { produtoId: "", quantidade: "", tipoMovimentacao: "entrada" },
  ]);

  // Sempre deve haver pelo menos um produto na lista
  const handleAddProduto = () => {
    setProdutosMovimentacao((prev) => [
      ...prev,
      { produtoId: "", quantidade: "", tipoMovimentacao: "entrada" },
    ]);
  };

  const handleRemoveProduto = (index) => {
    setProdutosMovimentacao((prev) => {
      if (prev.length === 1) {
        // Não permite remover o último produto
        return prev;
      }
      const novos = [...prev];
      novos.splice(index, 1);
      return novos;
    });
  };

  const handleProdutoChange = (index, field, value) => {
    setProdutosMovimentacao((prev) => {
      const novos = [...prev];
      if (field === "quantidade") {
        // Garante que só aceita números inteiros positivos
        const val = value.replace(/\D/g, "");
        novos[index][field] = val;
      } else {
        novos[index][field] = value;
      }
      return novos;
    });
  };
  // ...já declarado acima...
  // removido reloadAfterModal/setReloadAfterModal pois não são usados
  const enviarMovimentacaoEstoqueLoja = async (e) => {
    if (e) e.preventDefault();
    setMovimentacaoEnviando(true);
    setMovimentacaoErro("");
    // Removido setMovimentacaoSucesso
    try {
      const produtosValidos = produtosMovimentacao.filter(
        (p) => p.produtoId && Number(p.quantidade) > 0,
      );
      if (!movimentacaoLojaId || produtosValidos.length === 0) {
        setMovimentacaoErro(
          "Preencha todos os campos obrigatórios e adicione pelo menos um produto válido.",
        );
        setMovimentacaoEnviando(false);
        return;
      }
      const payload = {
        lojaId: movimentacaoLojaId,
        usuarioId: usuario?.id,
        produtos: produtosValidos.map((p) => ({
          produtoId: p.produtoId,
          quantidade: parseInt(p.quantidade),
          tipoMovimentacao: p.tipoMovimentacao || "saida",
        })),
        observacao: "",
        dataMovimentacao: new Date().toISOString(),
      };
      await api.post("/movimentacao-estoque-loja", payload);
      Swal.fire({
        icon: "success",
        title: "Sucesso",
        text: "Movimentação registrada com sucesso!",
        confirmButtonColor: "#fbbf24",
      });
      setMostrarModalMovimentacao(false);
      setMovimentacaoLojaId("");
      setProdutosMovimentacao([
        { produtoId: "", quantidade: "", tipoMovimentacao: "entrada" },
      ]);
      setTimeout(() => {
        if (typeof carregarDados === "function") carregarDados();
      }, 200);
      // ...atualize dados se necessário
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: "Erro ao registrar movimentação!",
        confirmButtonColor: "#ef4444",
      });
      console.error("Erro ao enviar movimentação de estoque de loja:", error);
    } finally {
      setMovimentacaoEnviando(false);
    }
  };

  // Faz o reload só depois que o modal sumiu
  // (removido reloadAfterModal/useEffect pois reload é imediato)
  // Botão no topo do dashboard para abrir o modal
  // Adicione ao JSX principal, ao lado do botão de impressão:
  // <button onClick={() => setMostrarModalMovimentacao(true)} className="btn-primary">Movimentação de Estoque</button>

  // Modal de movimentação de estoque de loja
  {
    mostrarModalMovimentacao && (
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
          <h2 className="text-xl font-bold mb-4">
            Movimentação de Estoque de Loja
          </h2>
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">
              Loja de destino
            </label>
            <select
              value={movimentacaoLojaId}
              onChange={(e) => setMovimentacaoLojaId(e.target.value)}
              className="input-field"
            >
              <option value="">Selecione a loja</option>
              {(lojas || []).map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">
              Produtos enviados
            </label>
            {produtosMovimentacao.map((p, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select
                  value={p.produtoId}
                  onChange={(e) =>
                    handleProdutoChange(idx, "produtoId", e.target.value)
                  }
                  className="input-field"
                >
                  <option value="">Produto</option>
                  {(produtos || []).map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.nome}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={p.quantidade}
                  onChange={(e) =>
                    handleProdutoChange(idx, "quantidade", e.target.value)
                  }
                  placeholder="Quantidade"
                  className="input-field w-24"
                />
                <select
                  value={p.tipoMovimentacao || "entrada"}
                  onChange={(e) =>
                    handleProdutoChange(idx, "tipoMovimentacao", e.target.value)
                  }
                  className="input-field w-28"
                >
                  <option value="saida">Saída</option>
                  <option value="entrada">Entrada</option>
                </select>
                {produtosMovimentacao.length > 1 && (
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => handleRemoveProduto(idx)}
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddProduto}
            >
              Adicionar mais um produto
            </button>
          </div>
          <form onSubmit={enviarMovimentacaoEstoqueLoja}>
            <div className="flex gap-4 justify-end mt-6">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMostrarModalMovimentacao(false)}
                disabled={movimentacaoEnviando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={movimentacaoEnviando}
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
                Registrar Movimentação
              </button>
            </div>
          </form>
          {movimentacaoErro && (
            <div className="text-red-600 mt-2">{movimentacaoErro}</div>
          )}
          {/* Mensagem de sucesso removida, feedback só via alert externo */}
        </div>
      </div>
    );
  }
  const { usuario } = useAuth();
  const [stats, setStats] = useState({
    alertas: [],
    balanco: null,
    comparativoLucroMensal: null,
    gastoVariavelMes: 0,
    loading: true,
  });
  const [atualizandoDashboard, setAtualizandoDashboard] = useState(false);
  const [manutencoesPendentes, setManutencoesPendentes] = useState([]);
  const [loadingManutencoesPendentes, setLoadingManutencoesPendentes] =
    useState(false);
  const [veiculos, setVeiculos] = useState([]);
  const [modalGastoVariavel, setModalGastoVariavel] = useState(false);

  // Estados para busca e navegação

  const [movimentacoes, setMovimentacoes] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState(null);
  const [maquinaSelecionada, setMaquinaSelecionada] = useState(null);
  // Estoque por máquina na lista: { [maquinaId]: number }
  const [estoqueMaquinas, setEstoqueMaquinas] = useState({});
  // Produto atual por máquina na lista: { [maquinaId]: produto | null }
  const [produtoAtualMaquinas, setProdutoAtualMaquinas] = useState({});
  const [loadingMaquina, setLoadingMaquina] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [alertasEstoqueLoja, setAlertasEstoqueLoja] = useState([]);

  // Estados para estoque das lojas
  const [lojasComEstoque, setLojasComEstoque] = useState([]);
  const [loadingEstoque, setLoadingEstoque] = useState(false);
  const [lojaEstoqueExpanded, setLojaEstoqueExpanded] = useState({});
  const [enviandoSaidaTotal, setEnviandoSaidaTotal] = useState({});

  // Estados para edição de estoque
  const [estoqueEditando, setEstoqueEditando] = useState(null); // { lojaId, estoque: [...] }
  const [salvandoEstoque, setSalvandoEstoque] = useState(false);
  const [movimentacaoEditandoId, setMovimentacaoEditandoId] = useState(null);
  const [movimentacaoForm, setMovimentacaoForm] = useState(null);
  const [salvandoMovimentacaoId, setSalvandoMovimentacaoId] = useState(null);
  const recognitionRef = useRef(null);
  const [assistenteStatus, setAssistenteStatus] = useState("idle");
  const [assistenteMensagem, setAssistenteMensagem] = useState(
    "Clique na IA Mico e fale um comando.",
  );
  const [assistenteTranscricao, setAssistenteTranscricao] = useState("");
  const [assistenteResultado, setAssistenteResultado] = useState(null);
  const [assistenteContextoPendente, setAssistenteContextoPendente] =
    useState("");

  const normalizarTextoAssistente = useCallback(
    (valor) =>
      String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim(),
    [],
  );

  const formatarDataAssistente = (dia, mes, ano) =>
    `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  const extrairDatasDaFalaAssistente = useCallback(
    (texto) => {
      const meses = {
        janeiro: 1,
        fevereiro: 2,
        marco: 3,
        abril: 4,
        maio: 5,
        junho: 6,
        julho: 7,
        agosto: 8,
        setembro: 9,
        outubro: 10,
        novembro: 11,
        dezembro: 12,
      };
      const textoNormalizado = normalizarTextoAssistente(texto);
      const datas = [
        ...textoNormalizado.matchAll(
          /(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/g,
        ),
      ];
      const anoAtual = new Date().getFullYear();

      if (datas.length < 2) return {};

      const [inicio, fim] = datas.map((match) => ({
        dia: Number(match[1]),
        mes: meses[match[2]],
        ano: Number(match[3]) || anoAtual,
      }));

      if (!inicio.mes || !fim.mes) return {};

      return {
        dataInicio: formatarDataAssistente(inicio.dia, inicio.mes, inicio.ano),
        dataFim: formatarDataAssistente(fim.dia, fim.mes, fim.ano),
      };
    },
    [normalizarTextoAssistente],
  );

  const encontrarLojaAssistente = useCallback(
    (texto, resultado) => {
      const idsPossiveis = [
        resultado?.acao?.query?.lojaId,
        resultado?.acao?.query?.loja_id,
        resultado?.dados?.lojaId,
        resultado?.dados?.loja_id,
        resultado?.dados?.loja?.id,
        resultado?.lojaId,
        resultado?.loja_id,
      ].filter(Boolean);

      if (idsPossiveis.length > 0) {
        return String(idsPossiveis[0]);
      }

      const nomesPossiveis = [
        resultado?.acao?.query?.loja,
        resultado?.acao?.query?.lojaNome,
        resultado?.dados?.lojaNome,
        resultado?.dados?.loja?.nome,
        resultado?.lojaNome,
        texto,
      ]
        .filter(Boolean)
        .map(normalizarTextoAssistente);

      const textoNormalizado = normalizarTextoAssistente(texto);

      const lojaEncontrada = lojas.find((loja) => {
        const nomeLoja = normalizarTextoAssistente(loja.nome);
        const partesNome = nomeLoja
          .split(/\s+/)
          .filter((parte) => parte.length >= 4);

        return (
          nomesPossiveis.some(
            (nome) => nome.includes(nomeLoja) || nomeLoja.includes(nome),
          ) || partesNome.some((parte) => textoNormalizado.includes(parte))
        );
      });

      return lojaEncontrada?.id ? String(lojaEncontrada.id) : "";
    },
    [lojas, normalizarTextoAssistente],
  );

  const montarFiltrosRelatorioAssistente = useCallback(
    (resultado, texto) => {
      const query = resultado?.acao?.query || {};
      const datasDaFala = extrairDatasDaFalaAssistente(texto);

      return {
        lojaId:
          query.lojaId ||
          query.loja_id ||
          encontrarLojaAssistente(texto, resultado),
        dataInicio:
          query.dataInicio ||
          query.data_inicio ||
          resultado?.dados?.dataInicio ||
          resultado?.dados?.data_inicio ||
          datasDaFala.dataInicio,
        dataFim:
          query.dataFim ||
          query.data_fim ||
          resultado?.dados?.dataFim ||
          resultado?.dados?.data_fim ||
          datasDaFala.dataFim,
      };
    },
    [encontrarLojaAssistente, extrairDatasDaFalaAssistente],
  );

  const extrairNumeroMaquinaAssistente = useCallback(
    (texto) => {
      const textoNormalizado = normalizarTextoAssistente(texto);
      const match = textoNormalizado.match(
        /maquina\s*(?:numero|n|no|#)?\s*(\d+)/,
      );
      return match?.[1] || "";
    },
    [normalizarTextoAssistente],
  );

  const encontrarMaquinaAssistente = useCallback(
    (texto, resultado, lojaId) => {
      const query = resultado?.acao?.query || {};
      const idsPossiveis = [
        query.maquinaId,
        query.maquina_id,
        resultado?.dados?.maquinaId,
        resultado?.dados?.maquina_id,
        resultado?.dados?.maquina?.id,
        resultado?.maquinaId,
        resultado?.maquina_id,
      ].filter(
        (valor) => valor !== undefined && valor !== null && valor !== "",
      );

      if (idsPossiveis.length > 0) {
        return String(idsPossiveis[0]);
      }

      const numeroMaquina = extrairNumeroMaquinaAssistente(texto);
      if (!numeroMaquina) return "";

      const maquinasDaLoja = maquinas.filter(
        (maquina) => !lojaId || String(maquina.lojaId) === String(lojaId),
      );

      const maquinaEncontrada = maquinasDaLoja.find((maquina) => {
        const codigo = normalizarTextoAssistente(maquina.codigo);
        const nome = normalizarTextoAssistente(maquina.nome);

        return (
          String(maquina.id) === numeroMaquina ||
          codigo === numeroMaquina ||
          Number(codigo) === Number(numeroMaquina) ||
          nome === `maquina ${numeroMaquina}` ||
          nome.endsWith(` ${numeroMaquina}`) ||
          nome.includes(`maquina ${numeroMaquina}`)
        );
      });

      return maquinaEncontrada?.id ? String(maquinaEncontrada.id) : "";
    },
    [extrairNumeroMaquinaAssistente, maquinas, normalizarTextoAssistente],
  );

  const montarFiltrosMovimentacaoAssistente = useCallback(
    (resultado, texto) => {
      const query = resultado?.acao?.query || {};
      const lojaId =
        query.lojaId ||
        query.loja_id ||
        encontrarLojaAssistente(texto, resultado);

      return {
        lojaId,
        maquinaId: encontrarMaquinaAssistente(texto, resultado, lojaId),
      };
    },
    [encontrarLojaAssistente, encontrarMaquinaAssistente],
  );

  const enviarComandoAssistente = useCallback(
    async (textoTranscrito) => {
      const textoLimpo = textoTranscrito.trim();
      if (!textoLimpo) {
        setAssistenteStatus("erro");
        setAssistenteMensagem("IA Mico nao conseguiu entender.");
        return;
      }

      const textoParaEnviar = assistenteContextoPendente
        ? `${assistenteContextoPendente} ${textoLimpo}`.trim()
        : textoLimpo;

      setAssistenteStatus("processando");
      setAssistenteMensagem("IA Mico pensando...");
      setAssistenteResultado(null);

      try {
        const response = await api.post("/assistente-ia/comando", {
          texto: textoParaEnviar,
        });
        const resultadoBase = response.data?.resultado || response.data;
        const resultado = {
          ...resultadoBase,
          assistente: response.data?.assistente || resultadoBase?.assistente,
        };

        if (resultado?.status === "precisa_confirmacao") {
          setAssistenteResultado(resultado);
          setAssistenteStatus("resposta");
          setAssistenteMensagem(
            resultado?.mensagem || "Comando processado com sucesso.",
          );
          setAssistenteContextoPendente(textoParaEnviar);
          return;
        }

        setAssistenteContextoPendente("");

        const deveAbrirMovimentacao =
          (resultado?.acao?.tipo === "abrir_movimentacao" &&
            resultado?.acao?.abrirFormulario === true &&
            resultado?.acao?.modo === "nova_movimentacao") ||
          (resultado?.acao?.rota === "/movimentacoes" &&
            normalizarTextoAssistente(textoParaEnviar).includes(
              "movimentacao",
            ));

        if (deveAbrirMovimentacao) {
          const filtrosMovimentacao = montarFiltrosMovimentacaoAssistente(
            resultado,
            textoParaEnviar,
          );
          const params = new URLSearchParams({
            abrirFormulario: "true",
            modo: "nova_movimentacao",
          });

          if (filtrosMovimentacao.lojaId) {
            params.set("lojaId", filtrosMovimentacao.lojaId);
          }

          if (filtrosMovimentacao.maquinaId) {
            params.set("maquinaId", filtrosMovimentacao.maquinaId);
          }

          setAssistenteResultado(resultado);
          setAssistenteStatus("processando");
          setAssistenteMensagem("IA Mico esta abrindo a nova movimentacao...");

          navigate(`${resultado?.acao?.rota || "/movimentacoes"}?${params}`, {
            state: {
              lojaId: filtrosMovimentacao.lojaId,
              maquinaId: filtrosMovimentacao.maquinaId,
              abrirFormulario: true,
              modo: "nova_movimentacao",
              origem: "IA Mico",
            },
          });
          return;
        }

        if (resultado?.tipo === "navegacao" && resultado?.acao?.rota) {
          navigate(resultado.acao.rota);
          return;
        }

        if (resultado?.tipo === "relatorio-loja") {
          const filtrosRelatorio = montarFiltrosRelatorioAssistente(
            resultado,
            textoParaEnviar,
          );
          const params = new URLSearchParams();

          Object.entries(filtrosRelatorio).forEach(([chave, valor]) => {
            if (valor) {
              params.set(chave, valor);
            }
          });

          setAssistenteResultado(resultado);
          setAssistenteStatus("processando");
          setAssistenteMensagem("IA Mico esta abrindo o relatorio...");

          const rotaRelatorio = resultado?.acao?.rota || "/relatorios";
          const queryString = params.toString();

          if (
            !filtrosRelatorio.lojaId ||
            !filtrosRelatorio.dataInicio ||
            !filtrosRelatorio.dataFim
          ) {
            setAssistenteStatus("erro");
            setAssistenteMensagem(
              "IA Mico nao conseguiu entender loja e periodo para abrir o relatorio.",
            );
            return;
          }

          navigate(
            queryString ? `${rotaRelatorio}?${queryString}` : rotaRelatorio,
            {
              state: {
                lojaId: filtrosRelatorio.lojaId,
                dataInicio: filtrosRelatorio.dataInicio,
                dataFim: filtrosRelatorio.dataFim,
                autoGerar: true,
                origem: "IA Mico",
              },
            },
          );
          return;
        }

        setAssistenteResultado(resultado);
        setAssistenteStatus("resposta");
        setAssistenteMensagem(
          resultado?.mensagem || "Comando processado com sucesso.",
        );
      } catch (error) {
        console.error("Erro ao enviar comando para o assistente:", error);
        setAssistenteStatus("erro");
        setAssistenteMensagem(
          error.response?.data?.message ||
            error.response?.data?.error ||
            "IA Mico nao conseguiu entender.",
        );
      }
    },
    [
      assistenteContextoPendente,
      montarFiltrosMovimentacaoAssistente,
      montarFiltrosRelatorioAssistente,
      navigate,
      normalizarTextoAssistente,
    ],
  );

  const iniciarEscutaAssistente = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setAssistenteStatus("erro");
      setAssistenteMensagem(
        "IA Mico nao conseguiu acessar o reconhecimento de voz neste navegador.",
      );
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let capturouResultado = false;

    recognition.onstart = () => {
      setAssistenteStatus("ouvindo");
      setAssistenteMensagem("IA Mico ouvindo...");
      setAssistenteTranscricao("");
      setAssistenteResultado(null);
    };

    recognition.onresult = (event) => {
      capturouResultado = true;
      const texto = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      setAssistenteTranscricao(texto);
      enviarComandoAssistente(texto);
    };

    recognition.onerror = (event) => {
      capturouResultado = true;
      setAssistenteStatus("erro");
      setAssistenteMensagem(
        event.error === "not-allowed"
          ? "Permita o uso do microfone para falar com a IA Mico."
          : "IA Mico nao conseguiu entender. Tente novamente.",
      );
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (!capturouResultado) {
        setAssistenteStatus("idle");
        setAssistenteMensagem("Clique na IA Mico e fale um comando.");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [enviarComandoAssistente]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Função para remover produto do estoque da loja (usando o id do registro)

  const carregarDados = useCallback(async () => {
    try {
      const isAdmin = usuario?.role === "ADMIN";
      const formatarDataParametro = (data) => {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        const dia = String(data.getDate()).padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
      };
      let periodoComparacaoMensal = null;

      // Buscar lojas e máquinas (acessível para todos)
      const requisicoes = [
        api.get("/lojas").catch((err) => {
          console.error("Erro ao carregar lojas:", err.message);
          return { data: [] };
        }),
        api.get("/maquinas").catch((err) => {
          console.error("Erro ao carregar máquinas:", err.message);
          return { data: [] };
        }),
        api.get("/produtos").catch((err) => {
          console.error("Erro ao carregar produtos:", err.message);
          return { data: [] };
        }),
      ];

      // Adicionar requisições de relatórios apenas para ADMIN
      if (isAdmin) {
        const hoje = new Date();
        const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMesAtual = new Date(
          hoje.getFullYear(),
          hoje.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
        const ultimoDiaMesAnterior = new Date(
          hoje.getFullYear(),
          hoje.getMonth(),
          0,
        ).getDate();
        const diaComparacao = Math.min(hoje.getDate(), ultimoDiaMesAnterior);
        const inicioMesAnterior = new Date(
          hoje.getFullYear(),
          hoje.getMonth() - 1,
          1,
        );
        const fimMesAnterior = new Date(
          hoje.getFullYear(),
          hoje.getMonth() - 1,
          diaComparacao,
        );

        periodoComparacaoMensal = {
          diaComparacao,
          inicioMesAtual: formatarDataParametro(inicioMesAtual),
          fimMesAtual: formatarDataParametro(hoje),
          inicioMesAnterior: formatarDataParametro(inicioMesAnterior),
          fimMesAnterior: formatarDataParametro(fimMesAnterior),
          nomeMesAnterior: inicioMesAnterior.toLocaleDateString("pt-BR", {
            month: "long",
          }),
        };

        requisicoes.unshift(
          api
            .get("/relatorios/dashboard", {
              params: {
                dataInicio: periodoComparacaoMensal.inicioMesAtual,
                dataFim: periodoComparacaoMensal.fimMesAtual,
              },
            })
            .catch((err) => {
              console.error(
                "Erro ao carregar faturamento do mês atual para comparação:",
                err.message,
              );
              return { data: null };
            }),
          api
            .get("/relatorios/dashboard", {
              params: {
                dataInicio: periodoComparacaoMensal.inicioMesAnterior,
                dataFim: periodoComparacaoMensal.fimMesAnterior,
              },
            })
            .catch((err) => {
              console.error(
                "Erro ao carregar faturamento do mês anterior para comparação:",
                err.message,
              );
              return { data: null };
            }),
          api.get("/relatorios/alertas-estoque").catch((err) => {
            console.error("Erro ao carregar alertas de máquinas:", err.message);
            return { data: { alertas: [] } };
          }),
          api.get("/relatorios/alertas-bom-desempenho").catch((err) => {
            console.error(
              "Erro ao carregar alertas de jogadas fora da meta:",
              err.message,
            );
            return { data: { alertas: [] } };
          }),
          api.get("/relatorios/balanco-semanal").catch((err) => {
            console.error("Erro ao carregar balanço:", err.message);
            return { data: null };
          }),
          api
            .get("/gastos-variaveis", {
              params: {
                dataInicio: periodoComparacaoMensal.inicioMesAtual,
                dataFim: periodoComparacaoMensal.fimMesAtual,
              },
            })
            .catch((err) => {
              console.error(
                "Erro ao carregar gastos variáveis do mês:",
                err.message,
              );
              return { data: [] };
            }),
        );
      }

      const resultados = await Promise.all(requisicoes);

      let faturamentoMesAtualRes,
        faturamentoMesAnteriorRes,
        alertasRes,
        alertasBomDesempenhoRes,
        balancoRes,
        gastoVariavelMesRes,
        lojasRes,
        maquinasRes,
        produtosRes;

      let comparativoLucroMensal = null;
      let gastoVariavelMes = 0;

      if (isAdmin) {
        [
          faturamentoMesAtualRes,
          faturamentoMesAnteriorRes,
          alertasRes,
          alertasBomDesempenhoRes,
          balancoRes,
          gastoVariavelMesRes,
          lojasRes,
          maquinasRes,
          produtosRes,
        ] = resultados;

        gastoVariavelMes = (gastoVariavelMesRes?.data || []).reduce(
          (acc, gasto) => acc + Number(gasto.valor || 0),
          0,
        );

        const faturamentoMesAtual = Number(
          faturamentoMesAtualRes?.data?.totais?.faturamento || 0,
        );
        const faturamentoMesAnterior = Number(
          faturamentoMesAnteriorRes?.data?.totais?.faturamento || 0,
        );
        const diferencaFaturamento =
          faturamentoMesAtual - faturamentoMesAnterior;
        const percentualVariacao =
          Math.abs(faturamentoMesAnterior) > 0
            ? (diferencaFaturamento / Math.abs(faturamentoMesAnterior)) * 100
            : null;

        comparativoLucroMensal = {
          valorMesAtual: faturamentoMesAtual,
          valorMesAnterior: faturamentoMesAnterior,
          diferenca: diferencaFaturamento,
          percentualVariacao,
          diaComparacao: periodoComparacaoMensal?.diaComparacao,
          nomeMesAnterior: periodoComparacaoMensal?.nomeMesAnterior,
        };
      } else {
        [lojasRes, maquinasRes, produtosRes] = resultados;
        alertasRes = { data: { alertas: [] } };
        alertasBomDesempenhoRes = { data: { alertas: [] } };
        balancoRes = { data: null };
      }

      console.log("Lojas carregadas:", lojasRes.data);
      console.log("Máquinas carregadas:", maquinasRes.data);
      console.log("Produtos carregados:", produtosRes.data);
      if (isAdmin) {
        console.log("Balanço Mensal:", balancoRes.data);
        console.log("Estrutura completa de totais:", balancoRes.data?.totais);
        console.log("Total de Fichas:", balancoRes.data?.totais?.totalFichas);
        console.log(
          "Total de Faturamento:",
          balancoRes.data?.totais?.totalFaturamento,
        );
      }

      setStats({
        alertas: alertasRes.data?.alertas || [],
        balanco: balancoRes.data,
        comparativoLucroMensal,
        gastoVariavelMes,
        loading: false,
      });
      const lojasOperacionais = filtrarLojasOperacionais(lojasRes.data || []);
      setLojas(lojasOperacionais);
      setMaquinas(maquinasRes.data || []);
      setProdutos(produtosRes.data || []);
      setAlertasBomDesempenho(alertasBomDesempenhoRes.data?.alertas || []);
      // Carregar alertas de estoque de lojas (para todos os usuários)
      if (lojasOperacionais.length > 0) {
        carregarAlertasEstoqueLoja(lojasOperacionais);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setStats({
        alertas: [],
        balanco: null,
        comparativoLucroMensal: null,
        gastoVariavelMes: 0,
        loading: false,
      });
      setLojas([]);
      setMaquinas([]);
      setAlertasBomDesempenho([]);
    }
  }, [usuario]);

  useEffect(() => {
    carregarDados();
    const intervaloDashboard = setInterval(carregarDados, 30 * 60 * 1000);

    return () => clearInterval(intervaloDashboard);
  }, [carregarDados]);

  const handleAtualizarDashboard = async () => {
    if (atualizandoDashboard) return;

    try {
      setAtualizandoDashboard(true);
      await carregarDados();
      Swal.fire({
        icon: "success",
        title: "Atualizado",
        text: "Dados do dashboard atualizados.",
        timer: 1400,
        showConfirmButton: false,
        confirmButtonColor: "#ef3b24",
      });
    } catch (error) {
      console.error("Erro ao atualizar dashboard:", error);
      Swal.fire({
        icon: "error",
        title: "Erro ao atualizar",
        text: "Nao foi possivel atualizar os dados agora.",
        confirmButtonColor: "#ef3b24",
      });
    } finally {
      setAtualizandoDashboard(false);
    }
  };

  const carregarManutencoesPendentes = useCallback(async () => {
    if (usuario?.role !== "FUNCIONARIO") {
      setManutencoesPendentes([]);
      return;
    }

    try {
      setLoadingManutencoesPendentes(true);
      const response = await api.get("/manutencoes");
      const lista = Array.isArray(response.data) ? response.data : [];
      setManutencoesPendentes(
        lista.filter((item) => item.status === "PENDENTE"),
      );
    } catch (error) {
      console.error("Erro ao carregar manutenções pendentes:", error);
      setManutencoesPendentes([]);
    } finally {
      setLoadingManutencoesPendentes(false);
    }
  }, [usuario?.role]);

  useEffect(() => {
    carregarManutencoesPendentes();
  }, [carregarManutencoesPendentes]);

  useEffect(() => {
    api
      .get("/veiculos")
      .then((response) => setVeiculos(response.data || []))
      .catch((error) => {
        console.error("Erro ao carregar veículos:", error);
        setVeiculos([]);
      });
  }, []);

  const carregarAlertasEstoqueLoja = async (lojasData) => {
    try {
      // Buscar alertas de todas as lojas
      const alertasPromises = lojasData.map((loja) =>
        api
          .get(`/estoque-lojas/${loja.id}/alertas`)
          .then((res) => ({
            lojaId: loja.id,
            lojaNome: loja.nome,
            alertas: res.data || [],
          }))
          .catch((err) => {
            console.error(
              `Erro ao carregar alertas da loja ${loja.nome}:`,
              err.message,
            );
            return { lojaId: loja.id, lojaNome: loja.nome, alertas: [] };
          }),
      );

      const alertasTodasLojas = await Promise.all(alertasPromises);

      // Agrupar todos os alertas
      const todosAlertas = alertasTodasLojas.flatMap((lojaAlertas) => {
        // Garantir que alertas seja um array
        const alertasArray = Array.isArray(lojaAlertas.alertas)
          ? lojaAlertas.alertas
          : [];

        return alertasArray.map((alerta) => ({
          ...alerta,
          lojaNome: lojaAlertas.lojaNome,
        }));
      });

      setAlertasEstoqueLoja(todosAlertas);
      console.log("Alertas de estoque de lojas:", todosAlertas);
    } catch (error) {
      console.error("Erro ao carregar alertas de estoque de lojas:", error);
      setAlertasEstoqueLoja([]);
    }
  };

  const carregarEstoqueDasLojas = async () => {
    try {
      setLoadingEstoque(true);

      // 1. Buscar todas as lojas
      const lojasRes = await api.get("/lojas");
      const lojas = lojasRes.data || [];

      // 2. Para cada loja, buscar seu estoque
      const lojasComEstoquePromises = lojas.map(async (loja) => {
        try {
          const estoqueRes = await api.get(`/estoque-lojas/${loja.id}`);
          const estoque = estoqueRes.data || [];

          return {
            ...loja,
            estoque: estoque,
            totalProdutos: estoque.length,
            totalUnidades: estoque.reduce(
              (sum, item) => sum + item.quantidade,
              0,
            ),
          };
        } catch (error) {
          console.error(`Erro ao carregar estoque da loja ${loja.id}:`, error);
          return {
            ...loja,
            estoque: [],
            totalProdutos: 0,
            totalUnidades: 0,
          };
        }
      });

      const resultado = await Promise.all(lojasComEstoquePromises);
      setLojasComEstoque(resultado);
    } catch (error) {
      console.error("Erro ao carregar estoque das lojas:", error);
      setLojasComEstoque([]);
    } finally {
      setLoadingEstoque(false);
    }
  };

  // Carregar estoque das lojas
  useEffect(() => {
    carregarEstoqueDasLojas();
  }, []);

  const carregarDetalhesMaquina = async (maquinaId) => {
    try {
      setLoadingMaquina(true);
      const movRes = await api.get(`/movimentacoes?maquinaId=${maquinaId}`);
      setMovimentacoes(movRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar movimentações:", error);
      setMovimentacoes([]);
    } finally {
      setLoadingMaquina(false);
    }
  };

  const toggleLojaEstoque = (lojaId) => {
    setLojaEstoqueExpanded((prev) => ({
      ...prev,
      [lojaId]: !prev[lojaId],
    }));
  };

  const abrirEdicaoEstoque = (loja) => {
    // Criar um mapa dos produtos já cadastrados no estoque
    const estoqueMap = new Map(
      loja.estoque.map((item) => [item.produtoId, item]),
    );

    // Criar lista completa com todos os produtos do sistema
    const estoqueTodos = produtos.map((produto) => {
      const itemExistente = estoqueMap.get(produto.id);
      return {
        id: itemExistente?.id || null, // null para produtos novos
        produtoId: produto.id,
        produtoNome: produto.nome,
        produtoEmoji: produto.emoji,
        produtoCodigo: produto.codigo,
        quantidade: itemExistente?.quantidade || 0,
        estoqueMinimo: itemExistente?.estoqueMinimo || 0,
        ativo: itemExistente?.ativo ?? false, // respeita valor real do backend
      };
    });

    setEstoqueEditando({
      lojaId: loja.id,
      lojaNome: loja.nome,
      estoque: estoqueTodos,
    });
  };

  const darSaidaEmTodoEstoque = async (loja) => {
    const produtosComEstoque = (loja.estoque || []).filter(
      (item) => item.quantidade > 0,
    );

    if (produtosComEstoque.length === 0) {
      Swal.fire({
        icon: "info",
        title: "Estoque já vazio",
        text: "Esta loja não possui produtos com quantidade em estoque.",
        confirmButtonColor: "#fbbf24",
      });
      return;
    }

    const confirmacao = await Swal.fire({
      icon: "warning",
      title: "Dar saída em todo o estoque?",
      html: `Isso vai zerar as <b>${produtosComEstoque.length}</b> produtos em estoque da loja <b>${loja.nome}</b> e registrar uma saída para cada um nas movimentações de estoque. Essa ação não pode ser desfeita automaticamente.`,
      showCancelButton: true,
      confirmButtonText: "Sim, dar saída em tudo",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });

    if (!confirmacao.isConfirmed) return;

    try {
      setEnviandoSaidaTotal((prev) => ({ ...prev, [loja.id]: true }));

      await api.post("/movimentacao-estoque-loja", {
        lojaId: loja.id,
        usuarioId: usuario?.id,
        produtos: produtosComEstoque.map((item) => ({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          tipoMovimentacao: "saida",
        })),
        observacao: "Saída em massa - zerar estoque",
        dataMovimentacao: new Date().toISOString(),
      });

      Swal.fire({
        icon: "success",
        title: "Sucesso",
        text: "Saída registrada e estoque zerado com sucesso!",
        confirmButtonColor: "#fbbf24",
      });

      await carregarEstoqueDasLojas();
    } catch (error) {
      console.error("Erro ao dar saída em todo o estoque:", error);
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: "Erro ao registrar a saída em massa do estoque!",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setEnviandoSaidaTotal((prev) => ({ ...prev, [loja.id]: false }));
    }
  };

  // ...
  // Exemplo de uso no JSX (dentro do modal de edição de estoque):
  // <button onClick={() => removerProdutoEstoque(item)}>Remover</button>

  const fecharEdicaoEstoque = () => {
    setEstoqueEditando(null);
  };

  const atualizarQuantidadeEstoque = (produtoId, novaQuantidade) => {
    setEstoqueEditando((prev) => ({
      ...prev,
      estoque: prev.estoque.map((item) =>
        item.produtoId === produtoId
          ? { ...item, quantidade: parseInt(novaQuantidade) || 0 }
          : item,
      ),
    }));
  };

  const atualizarEstoqueMinimoEstoque = (produtoId, novoMinimo) => {
    setEstoqueEditando((prev) => ({
      ...prev,
      estoque: prev.estoque.map((item) =>
        item.produtoId === produtoId
          ? { ...item, estoqueMinimo: parseInt(novoMinimo) || 0 }
          : item,
      ),
    }));
  };

  const toggleProdutoAtivo = (produtoId) => {
    setEstoqueEditando((prev) => ({
      ...prev,
      estoque: prev.estoque.map((item) =>
        item.produtoId === produtoId ? { ...item, ativo: !item.ativo } : item,
      ),
    }));
  };

  const marcarTodosProdutos = (ativo) => {
    setEstoqueEditando((prev) => ({
      ...prev,
      estoque: prev.estoque.map((item) => ({ ...item, ativo })),
    }));
  };

  // Função para imprimir relatório individual de uma loja
  const imprimirRelatorioLoja = (loja) => {
    const itensParaComprar = loja.estoque.filter(
      (item) => item.quantidade < item.estoqueMinimo,
    );

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Relatório de Estoque - ${loja.nome}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 3px solid #FF69B4;
              padding-bottom: 20px;
            }
            .header h1 {
              color: #FF69B4;
              margin: 0;
              font-size: 28px;
            }
            .header p {
              color: #666;
              margin: 5px 0;
            }
            .info-box {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .section-title {
              color: #333;
              font-size: 20px;
              margin: 25px 0 15px 0;
              padding-bottom: 8px;
              border-bottom: 2px solid #ddd;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background: #FF69B4;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: bold;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #ddd;
            }
            tr:nth-child(even) {
              background: #f8f9fa;
            }
            .alerta {
              background: #fee;
              color: #c00;
              font-weight: bold;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #666;
              font-size: 12px;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }
            @media print {
              body { padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📦 Relatório de Estoque</h1>
            <p><strong>Loja:</strong> ${loja.nome}</p>
            <p><strong>Endereço:</strong> ${
              loja.endereco || "Não informado"
            }</p>
            <p><strong>Data:</strong> ${new Date().toLocaleDateString(
              "pt-BR",
            )} às ${new Date().toLocaleTimeString("pt-BR")}</p>
          </div>

          <div class="info-box">
            <p><strong>Total de Produtos:</strong> ${loja.totalProdutos}</p>
            <p><strong>Total de Unidades:</strong> ${loja.totalUnidades}</p>
            <p><strong>Produtos Abaixo do Mínimo:</strong> ${
              itensParaComprar.length
            }</p>
          </div>

          <h2 class="section-title">📋 Estoque Atual</h2>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Código</th>
                <th>Qtd Atual</th>
                <th>Qtd Mínima</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${loja.estoque
                .map((item) => {
                  const abaixo = item.quantidade < item.estoqueMinimo;
                  return `
                    <tr ${abaixo ? 'class="alerta"' : ""}>
                      <td>${item.produto.emoji || "📦"} ${
                        item.produto.nome
                      }</td>
                      <td>${item.produto.codigo || "-"}</td>
                      <td>${item.quantidade}</td>
                      <td>${item.estoqueMinimo}</td>
                      <td>${abaixo ? "⚠️ ABAIXO DO MÍNIMO" : "✅ OK"}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>

          ${
            itensParaComprar.length > 0
              ? `
            <h2 class="section-title">🛒 Produtos para Comprar</h2>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qtd Atual</th>
                  <th>Qtd Mínima</th>
                  <th>Quantidade Sugerida</th>
                </tr>
              </thead>
              <tbody>
                ${itensParaComprar
                  .map((item) => {
                    const sugestao = item.estoqueMinimo - item.quantidade;
                    return `
                      <tr>
                        <td>${item.produto.emoji || "📦"} ${
                          item.produto.nome
                        }</td>
                        <td>${item.quantidade}</td>
                        <td>${item.estoqueMinimo}</td>
                        <td><strong>${sugestao} unidades</strong></td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          `
              : '<p style="text-align: center; color: #28a745; font-size: 18px; padding: 20px;">✅ Todos os produtos estão com estoque adequado!</p>'
          }

          <div class="footer">
            <p>Relatorio gerado automaticamente pelo Sistema Mico Leao</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Função para imprimir relatório consolidado de todas as lojas
  const imprimirRelatorioConsolidado = () => {
    // Consolidar necessidades por produto
    const necessidadesPorProduto = {};

    lojasComEstoque.forEach((loja) => {
      loja.estoque.forEach((item) => {
        const falta = item.estoqueMinimo - item.quantidade;
        if (falta > 0) {
          if (!necessidadesPorProduto[item.produtoId]) {
            necessidadesPorProduto[item.produtoId] = {
              produto: item.produto,
              totalNecessario: 0,
              lojas: [],
            };
          }
          necessidadesPorProduto[item.produtoId].totalNecessario += falta;
          necessidadesPorProduto[item.produtoId].lojas.push({
            loja: loja.nome,
            atual: item.quantidade,
            minimo: item.estoqueMinimo,
            necessario: falta,
          });
        }
      });
    });

    const produtosNecessarios = Object.values(necessidadesPorProduto);
    const totalItensComprar = produtosNecessarios.reduce(
      (acc, p) => acc + p.totalNecessario,
      0,
    );

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Relatório Consolidado de Compras</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 1000px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 3px solid #FF69B4;
              padding-bottom: 20px;
            }
            .header h1 {
              color: #FF69B4;
              margin: 0;
              font-size: 28px;
            }
            .info-box {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              text-align: center;
            }
            .info-box h3 {
              margin: 0;
              color: #333;
              font-size: 24px;
            }
            .section-title {
              color: #333;
              font-size: 20px;
              margin: 25px 0 15px 0;
              padding-bottom: 8px;
              border-bottom: 2px solid #ddd;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background: #FF69B4;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: bold;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #ddd;
            }
            tr:nth-child(even) {
              background: #f8f9fa;
            }
            .sub-table {
              margin: 10px 0;
              background: #fff;
            }
            .sub-table th {
              background: #ffd1dc;
              color: #333;
              font-size: 13px;
            }
            .sub-table td {
              font-size: 13px;
              padding: 8px;
            }
            .total-row {
              background: #ffe4e1 !important;
              font-weight: bold;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #666;
              font-size: 12px;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }
            @media print {
              body { padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🛒 Relatório Consolidado de Compras</h1>
            <p><strong>Data:</strong> ${new Date().toLocaleDateString(
              "pt-BR",
            )} às ${new Date().toLocaleTimeString("pt-BR")}</p>
          </div>

          <div class="info-box">
            <h3>📦 Total de Unidades a Comprar: ${totalItensComprar}</h3>
            <p><strong>Tipos de Produtos:</strong> ${
              produtosNecessarios.length
            }</p>
            <p><strong>Lojas Atendidas:</strong> ${lojasComEstoque.length}</p>
          </div>

          ${
            produtosNecessarios.length > 0
              ? `
            <h2 class="section-title">📋 Lista de Compras por Produto</h2>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Total a Comprar</th>
                  <th>Distribuição por Loja</th>
                </tr>
              </thead>
              <tbody>
                ${produtosNecessarios
                  .map(
                    (item) => `
                      <tr>
                        <td>
                          <strong>${item.produto.emoji || "📦"} ${
                            item.produto.nome
                          }</strong><br>
                          <small>Cód: ${item.produto.codigo || "-"}</small>
                        </td>
                        <td style="font-size: 18px; font-weight: bold; color: #FF69B4;">
                          ${item.totalNecessario} unidades
                        </td>
                        <td>
                          <table class="sub-table" style="width: 100%;">
                            <thead>
                              <tr>
                                <th>Loja</th>
                                <th>Atual</th>
                                <th>Mínimo</th>
                                <th>Enviar</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${item.lojas
                                .map(
                                  (l) => `
                                  <tr>
                                    <td>${l.loja}</td>
                                    <td>${l.atual}</td>
                                    <td>${l.minimo}</td>
                                    <td><strong>${l.necessario}</strong></td>
                                  </tr>
                                `,
                                )
                                .join("")}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    `,
                  )
                  .join("")}
                <tr class="total-row">
                  <td colspan="2"><strong>TOTAL GERAL A COMPRAR:</strong></td>
                  <td style="font-size: 20px; color: #FF69B4;"><strong>${totalItensComprar} unidades</strong></td>
                </tr>
              </tbody>
            </table>
          `
              : '<p style="text-align: center; color: #28a745; font-size: 18px; padding: 20px;">✅ Todas as lojas estão com estoque adequado!</p>'
          }

          <div class="footer">
            <p>Relatorio gerado automaticamente pelo Sistema Mico Leao</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const salvarEstoque = async () => {
    try {
      setSalvandoEstoque(true);

      // Filtrar apenas produtos ativos (marcados para aparecer)
      const produtosAtivos = estoqueEditando.estoque.filter(
        (item) => item.ativo,
      );

      console.log(
        `📊 Salvando ${produtosAtivos.length} produtos ativos no estoque`,
      );

      // Salvar produtos ativos
      for (const item of produtosAtivos) {
        try {
          // Se o item já tem ID, usar PUT para atualizar
          // Se não tem ID, usar POST para criar
          if (item.id) {
            console.log(
              `✏️ Atualizando produto ${item.produtoNome} (ID: ${item.id})`,
            );
            await api.put(
              `/estoque-lojas/${estoqueEditando.lojaId}/${item.produtoId}`,
              {
                quantidade: item.quantidade || 0,
                estoqueMinimo: item.estoqueMinimo || 0,
                ativo: item.ativo,
              },
            );
          } else {
            console.log(
              `➕ Criando novo produto ${item.produtoNome} no estoque`,
            );
            await api.post(`/estoque-lojas/${estoqueEditando.lojaId}`, {
              produtoId: item.produtoId,
              quantidade: item.quantidade || 0,
              estoqueMinimo: item.estoqueMinimo || 0,
              ativo: item.ativo,
            });
          }
        } catch (itemError) {
          console.error(
            `❌ Erro ao salvar produto ${item.produtoId}:`,
            itemError.response?.data || itemError.message,
          );
        }
      }

      // Remover produtos que foram desmarcados (se tinham id)
      const produtosInativos = estoqueEditando.estoque.filter(
        (item) => !item.ativo && item.id,
      );

      for (const item of produtosInativos) {
        console.log("Tentando remover produto inativo:", {
          id: item.id,
          produtoId: item.produtoId,
          produtoNome: item.produtoNome,
          lojaId: estoqueEditando.lojaId,
          itemCompleto: item,
        });
        try {
          await api.delete(
            `/estoque-lojas/${estoqueEditando.lojaId}/${item.produtoId}`,
          );
          console.log(`🗑️ Removido produto ${item.produtoNome} do estoque`);
        } catch (deleteError) {
          console.error(
            `❌ Erro ao remover produto ${item.produtoId}:`,
            deleteError.response?.data || deleteError.message,
          );
        }
      }

      // Recarregar os dados
      await carregarEstoqueDasLojas();
      fecharEdicaoEstoque();
    } catch (error) {
      console.error("Erro ao salvar estoque:", error);
      Swal.fire({
        icon: "error",
        title: "Erro ao salvar estoque",
        text: error.response?.data?.error || error.message,
        confirmButtonColor: "#ef3b24",
      });
    } finally {
      setSalvandoEstoque(false);
    }
  };

  const handleSelecionarLoja = (loja) => {
    setLojaSelecionada(loja);
    setMaquinaSelecionada(null);
    setMovimentacoes([]);
    setSearchTerm("");
    setMovimentacaoEditandoId(null);
    setMovimentacaoForm(null);
  };

  const handleSelecionarMaquina = async (maquina) => {
    try {
      // Buscar dados completos da máquina (inclui fichasNecessarias e forcaGarra)
      const maquinaRes = await api.get(`/maquinas/${maquina.id}`);
      const maquinaCompleta = maquinaRes.data;

      // Buscar estoque atual
      const estoqueRes = await api.get(`/maquinas/${maquina.id}/estoque`);
      const estoqueAtual = estoqueRes.data.estoqueAtual || 0;

      // Buscar movimentações para obter último produto
      const movRes = await api.get(`/movimentacoes?maquinaId=${maquina.id}`);
      const movimentacoes = movRes.data || [];

      let ultimoProduto = null;
      if (movimentacoes.length > 0) {
        const movimentacoesOrdenadas = movimentacoes.sort(
          (a, b) =>
            new Date(b.dataColeta || b.createdAt) -
            new Date(a.dataColeta || a.createdAt),
        );
        const ultimaMov = movimentacoesOrdenadas[0];
        const produtoId = ultimaMov.detalhesProdutos?.[0]?.produtoId;

        if (produtoId) {
          const produtosRes = await api.get(`/produtos`);
          ultimoProduto = produtosRes.data.find((p) => p.id === produtoId);
        }
      }

      setMaquinaSelecionada({
        ...maquinaCompleta,
        estoqueAtual,
        ultimoProduto,
      });
      setMovimentacaoEditandoId(null);
      setMovimentacaoForm(null);
      carregarDetalhesMaquina(maquina.id);
    } catch (error) {
      console.error("Erro ao carregar detalhes da máquina:", error);
      setMaquinaSelecionada(maquina);
      setMovimentacaoEditandoId(null);
      setMovimentacaoForm(null);
      carregarDetalhesMaquina(maquina.id);
    }
  };

  const handleVoltar = () => {
    if (maquinaSelecionada) {
      setMaquinaSelecionada(null);
      setMovimentacoes([]);
      setMovimentacaoEditandoId(null);
      setMovimentacaoForm(null);
    } else if (lojaSelecionada) {
      setLojaSelecionada(null);
      setMovimentacaoEditandoId(null);
      setMovimentacaoForm(null);
    }
  };

  const formatarDataHoraParaInput = (valor) => {
    if (!valor) return "";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
  };

  const iniciarEdicaoMovimentacao = (mov) => {
    setMovimentacaoEditandoId(mov.id);
    setMovimentacaoForm({
      dataColeta: formatarDataHoraParaInput(mov.dataColeta || mov.createdAt),
      totalPre: String(mov.totalPre ?? 0),
      sairam: String(mov.sairam ?? 0),
      abastecidas: String(mov.abastecidas ?? 0),
      totalPos: String(mov.totalPos ?? 0),
      fichas: String(mov.fichas ?? 0),
      contadorIn:
        mov.contadorIn === null || mov.contadorIn === undefined
          ? ""
          : String(mov.contadorIn),
      contadorOut:
        mov.contadorOut === null || mov.contadorOut === undefined
          ? ""
          : String(mov.contadorOut),
      observacoes: mov.observacoes || "",
      produtos: Array.isArray(mov.detalhesProdutos)
        ? mov.detalhesProdutos.map((p) => ({
            produtoId: p.produtoId || "",
            quantidadeSaiu: String(p.quantidadeSaiu ?? 0),
            quantidadeAbastecida: String(p.quantidadeAbastecida ?? 0),
            retiradaProduto: String(p.retiradaProduto ?? 0),
          }))
        : [],
    });
  };

  const cancelarEdicaoMovimentacao = () => {
    setMovimentacaoEditandoId(null);
    setMovimentacaoForm(null);
  };

  const atualizarCampoMovimentacao = (campo, valor) => {
    setMovimentacaoForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const atualizarProdutoMovimentacao = (index, campo, valor) => {
    setMovimentacaoForm((prev) => {
      const produtos = [...(prev?.produtos || [])];
      produtos[index] = { ...produtos[index], [campo]: valor };
      return { ...prev, produtos };
    });
  };

  const adicionarProdutoMovimentacao = () => {
    setMovimentacaoForm((prev) => ({
      ...prev,
      produtos: [
        ...(prev?.produtos || []),
        {
          produtoId: "",
          quantidadeSaiu: "0",
          quantidadeAbastecida: "0",
          retiradaProduto: "0",
        },
      ],
    }));
  };

  const removerProdutoMovimentacao = (index) => {
    setMovimentacaoForm((prev) => {
      const produtos = [...(prev?.produtos || [])];
      produtos.splice(index, 1);
      return { ...prev, produtos };
    });
  };

  const parseNumeroInteiro = (valor, permitirNulo = false) => {
    if (valor === "" || valor === null || valor === undefined) {
      return permitirNulo ? null : 0;
    }
    const numero = parseInt(valor, 10);
    if (Number.isNaN(numero)) {
      return permitirNulo ? null : 0;
    }
    return numero;
  };

  const salvarEdicaoMovimentacao = async (movimentacaoId) => {
    if (!movimentacaoForm) return;

    try {
      setSalvandoMovimentacaoId(movimentacaoId);

      const payload = {
        dataColeta: movimentacaoForm.dataColeta || null,
        totalPre: parseNumeroInteiro(movimentacaoForm.totalPre),
        sairam: parseNumeroInteiro(movimentacaoForm.sairam),
        abastecidas: parseNumeroInteiro(movimentacaoForm.abastecidas),
        totalPos: parseNumeroInteiro(movimentacaoForm.totalPos),
        fichas: parseNumeroInteiro(movimentacaoForm.fichas),
        contadorIn: parseNumeroInteiro(movimentacaoForm.contadorIn, true),
        contadorOut: parseNumeroInteiro(movimentacaoForm.contadorOut, true),
        observacoes: movimentacaoForm.observacoes || "",
        produtos: (movimentacaoForm.produtos || [])
          .filter((p) => p.produtoId)
          .map((p) => ({
            produtoId: p.produtoId,
            quantidadeSaiu: parseNumeroInteiro(p.quantidadeSaiu),
            quantidadeAbastecida: parseNumeroInteiro(p.quantidadeAbastecida),
            retiradaProduto: parseNumeroInteiro(p.retiradaProduto),
          })),
      };

      await api.put(`/movimentacoes/${movimentacaoId}`, payload);

      Swal.fire({
        icon: "success",
        title: "Movimentação atualizada",
        text: "As alterações foram salvas com sucesso.",
        confirmButtonColor: "#fbbf24",
      });

      if (maquinaSelecionada?.id) {
        await carregarDetalhesMaquina(maquinaSelecionada.id);
      }

      cancelarEdicaoMovimentacao();
    } catch (error) {
      console.error("Erro ao salvar edição da movimentação:", error);
      Swal.fire({
        icon: "error",
        title: "Erro ao salvar",
        text:
          error?.response?.data?.error ||
          "Não foi possível salvar a movimentação.",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setSalvandoMovimentacaoId(null);
    }
  };

  // Filtrar lojas conforme busca
  const lojasFiltradas = lojas.filter(
    (loja) =>
      loja.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loja.endereco?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Máquinas da loja selecionada
  const maquinasDaLoja = lojaSelecionada
    ? (() => {
        const result = maquinas.filter((m) => m.lojaId === lojaSelecionada.id);
        console.log("Máquinas da loja selecionada:", result);
        return result;
      })()
    : [];

  // Busca estoques das máquinas da loja selecionada
  useEffect(() => {
    if (!lojaSelecionada || maquinasDaLoja.length === 0) {
      setEstoqueMaquinas({});
      setProdutoAtualMaquinas({});
      return;
    }

    setEstoqueMaquinas({});
    setProdutoAtualMaquinas({});

    let ativo = true;

    const carregarResumoMaquinas = async () => {
      try {
        const produtosRes = await api.get("/produtos");
        const produtos = Array.isArray(produtosRes.data)
          ? produtosRes.data
          : [];

        await Promise.all(
          maquinasDaLoja.map(async (maquina) => {
            try {
              const [estoqueRes, movRes] = await Promise.all([
                api.get(`/maquinas/${maquina.id}/estoque`),
                api.get(`/movimentacoes?maquinaId=${maquina.id}`),
              ]);

              if (!ativo) return;

              setEstoqueMaquinas((prev) => ({
                ...prev,
                [maquina.id]: estoqueRes.data.estoqueAtual ?? 0,
              }));

              const movimentacoesMaquina = Array.isArray(movRes.data)
                ? [...movRes.data].sort(
                    (a, b) =>
                      new Date(b.dataColeta || b.createdAt) -
                      new Date(a.dataColeta || a.createdAt),
                  )
                : [];

              const produtoId =
                movimentacoesMaquina[0]?.detalhesProdutos?.[0]?.produtoId;
              const ultimoProduto = produtoId
                ? produtos.find((produto) => produto.id === produtoId) || null
                : null;

              setProdutoAtualMaquinas((prev) => ({
                ...prev,
                [maquina.id]: ultimoProduto,
              }));
            } catch {
              if (!ativo) return;
              setProdutoAtualMaquinas((prev) => ({
                ...prev,
                [maquina.id]: null,
              }));
            }
          }),
        );
      } catch {
        if (!ativo) return;
      }
    };

    carregarResumoMaquinas();

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaSelecionada]);

  if (stats.loading) {
    return <PageLoader />;
  }

  console.log("Estado stats no render:", stats);
  console.log("Fichas no render:", stats.balanco?.totais?.totalFichas);

  const formatarMoeda = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const comparativoLucroMensal = stats.comparativoLucroMensal;
  const statusComparativoLucro = !comparativoLucroMensal
    ? "igual"
    : comparativoLucroMensal.diferenca > 0
      ? "acima"
      : comparativoLucroMensal.diferenca < 0
        ? "abaixo"
        : "igual";

  const badgeComparativoLucroClass =
    statusComparativoLucro === "acima"
      ? "bg-emerald-100 text-emerald-800"
      : statusComparativoLucro === "abaixo"
        ? "bg-red-100 text-red-800"
        : "bg-slate-100 text-slate-800";

  const percentualComparativoLucro =
    comparativoLucroMensal?.percentualVariacao === null ||
    comparativoLucroMensal?.percentualVariacao === undefined
      ? null
      : Math.abs(comparativoLucroMensal.percentualVariacao)
          .toFixed(1)
          .replace(".", ",");

  const mesAnteriorComparacao =
    comparativoLucroMensal?.nomeMesAnterior || "mês anterior";

  const textoPercentualComparativoLucro =
    statusComparativoLucro === "acima"
      ? `${percentualComparativoLucro ?? "N/A"}% melhor que ${mesAnteriorComparacao}`
      : statusComparativoLucro === "abaixo"
        ? `${percentualComparativoLucro ?? "N/A"}% pior que ${mesAnteriorComparacao}`
        : `0,0% igual a ${mesAnteriorComparacao}`;

  const textoDiferencaLucro = !comparativoLucroMensal
    ? "R$ 0,00"
    : `${comparativoLucroMensal.diferenca >= 0 ? "+" : "-"}R$ ${formatarMoeda(Math.abs(comparativoLucroMensal.diferenca || 0))}`;

  const classeTextoDiferencaLucro =
    statusComparativoLucro === "acima"
      ? "text-emerald-700"
      : statusComparativoLucro === "abaixo"
        ? "text-red-700"
        : "text-slate-700";

  const assistenteNome = assistenteResultado?.assistente?.nome || "IA Mico";

  const assistenteStatusLabel = {
    idle: assistenteNome,
    ouvindo: `${assistenteNome} ouvindo...`,
    processando: `${assistenteNome} pensando...`,
    erro: `${assistenteNome} nao conseguiu entender`,
    resposta: `${assistenteNome} respondeu`,
  }[assistenteStatus];

  const assistenteBotaoTexto = {
    idle: assistenteNome,
    ouvindo: `${assistenteNome} ouvindo...`,
    processando: `${assistenteNome} pensando...`,
    erro: `${assistenteNome} nao conseguiu entender`,
    resposta: assistenteContextoPendente
      ? `${assistenteNome} complementar`
      : assistenteNome,
  }[assistenteStatus];

  const assistenteStatusClass =
    assistenteStatus === "ouvindo"
      ? "bg-red-100 text-red-700"
      : assistenteStatus === "processando"
        ? "bg-yellow-100 text-yellow-800"
        : assistenteStatus === "erro"
          ? "bg-red-100 text-red-700"
          : assistenteStatus === "resposta"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-100 text-slate-700";

  const lojasAssistente =
    assistenteResultado?.tipo === "estoque"
      ? assistenteResultado?.dados?.lojas || []
      : [];

  void assistenteMensagem;
  void assistenteTranscricao;
  void iniciarEscutaAssistente;
  void assistenteStatusLabel;
  void assistenteBotaoTexto;
  void assistenteStatusClass;
  void lojasAssistente;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header com boas-vindas */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold">
                <span className="text-gradient">Dashboard</span> 🧸
              </h1>
              {["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_ESTOQUE"].includes(
                usuario?.role,
              ) && (
                <button
                  onClick={() => navigate("/compras")}
                  className="btn-primary flex items-center gap-2"
                  title="Abrir compras"
                >
                  <span className="text-base">🛒</span>
                  Compras
                </button>
              )}
            </div>
            <p className="text-gray-600">
              Visão geral do seu sistema de pelúcias
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role) && (
              <button
                type="button"
                onClick={() => navigate("/relatorios")}
                className="btn-secondary flex items-center gap-2"
                title="Ver relatório"
              >
                📄 Ver relatório
              </button>
            )}
            {["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role) && (
              <button
                type="button"
                onClick={() => navigate("/registrar-dinheiro")}
                className="btn-secondary flex items-center gap-2"
                title="Registrar dinheiro"
              >
                💵 Registrar dinheiro
              </button>
            )}
            {["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO", "FUNCIONARIO_ESTOQUE"].includes(
              usuario?.role,
            ) && (
              <button
                type="button"
                onClick={() => navigate("/gastos-variaveis")}
                className="btn-secondary flex items-center gap-2"
                title="Registrar gasto variável"
              >
                🧾 Registrar gasto variável
              </button>
            )}
            <button
              type="button"
              onClick={handleAtualizarDashboard}
              disabled={atualizandoDashboard}
              className="btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              title="Atualizar dados"
            >
              <svg
                className={`w-5 h-5 ${atualizandoDashboard ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {atualizandoDashboard ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        <IAgarraAssistente />

        {/* Cards de Resumo com design moderno - Apenas para ADMIN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 md:gap-6 mb-8">
          {/* Faturamento Mensal, Fichas Inseridas, Prêmios Saídos, Alertas de Estoque: só para ADMIN */}
          {usuario?.role === "ADMIN" && (
            <>
              {/* Faturamento Mensal */}
              <div className="stat-card bg-linear-to-br from-yellow-500 to-orange-500 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">
                      Faturamento Mensal
                    </h3>
                    <svg
                      className="w-8 h-8 opacity-80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold">
                    R${" "}
                    {formatarMoeda(
                      stats.balanco?.totais?.totalFaturamento || 0,
                    )}
                  </p>
                  {comparativoLucroMensal ? (
                    <>
                      <span
                        className={`mt-2 inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-bold ${badgeComparativoLucroClass}`}
                      >
                        <span>
                          {statusComparativoLucro === "acima"
                            ? "▲"
                            : statusComparativoLucro === "abaixo"
                              ? "▼"
                              : "="}
                        </span>
                        <span>{textoPercentualComparativoLucro}</span>
                      </span>
                      <p className="text-xs opacity-90 mt-2">
                        Até o dia {comparativoLucroMensal.diaComparacao}:
                        faturamento atual R${" "}
                        {formatarMoeda(comparativoLucroMensal.valorMesAtual)} vs
                        R${" "}
                        {formatarMoeda(comparativoLucroMensal.valorMesAnterior)}{" "}
                        em {mesAnteriorComparacao}.
                      </p>
                      <p
                        className={`text-xs font-semibold mt-1 ${classeTextoDiferencaLucro}`}
                      >
                        Diferença acumulada: {textoDiferencaLucro}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs opacity-75 mt-1">💰 Mês atual</p>
                  )}
                </div>
              </div>
              {/* Fichas Inseridas */}
              <div className="stat-card bg-linear-to-br from-blue-500 to-blue-600 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">
                      Fichas Inseridas
                    </h3>
                    <svg
                      className="w-8 h-8 opacity-80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold">
                    {stats.balanco?.totais?.totalFichas || 0}
                  </p>
                  <p className="text-xs opacity-75 mt-1">
                    🎫 Fichas que entraram
                  </p>
                </div>
              </div>
              {/* Prêmios Saídos */}
              <div className="stat-card bg-linear-to-br from-green-500 to-green-600 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">
                      Prêmios Saídos
                    </h3>
                    <svg
                      className="w-8 h-8 opacity-80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                      />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold">
                    {stats.balanco?.totais?.totalSairam || 0}
                  </p>
                  <p className="text-xs opacity-75 mt-1">
                    🎁 Pelúcias entregues
                  </p>
                </div>
              </div>
              {/* Gastos Variáveis */}
              <div
                className="stat-card bg-linear-to-br from-orange-500 to-red-600 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
                onClick={() => navigate("/gastos-variaveis")}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">
                      Gastos Variáveis
                    </h3>
                    <span className="text-2xl">🧾</span>
                  </div>
                  <p className="text-3xl font-bold">
                    R$ {formatarMoeda(stats.gastoVariavelMes)}
                  </p>
                  <p className="text-xs opacity-75 mt-1">
                    Gasolina, estacionamento e outros no mês
                  </p>
                </div>
              </div>
              {/* Alertas de Estoque */}
              <div
                className="stat-card bg-linear-to-br from-red-500 to-red-600 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
                onClick={() => {
                  const alertSection = document.getElementById(
                    "alertas-estoque-maquinas",
                  );
                  if (alertSection) {
                    alertSection.scrollIntoView({ behavior: "smooth" });
                  }
                }}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">
                      Alertas de Estoque
                    </h3>
                    <svg
                      className="w-8 h-8 opacity-80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold">
                    {stats.alertas.length + alertasEstoqueLoja.length}
                  </p>
                  <p className="text-xs opacity-75 mt-1">
                    ⚠️ {stats.alertas.length} máquinas · 🏪{" "}
                    {alertasEstoqueLoja.length} lojas
                  </p>
                </div>
              </div>
              {/* Jogadas fora da meta */}
              <div
                className="stat-card bg-linear-to-br from-red-500 to-orange-600 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
                onClick={() => {
                  const alertSection = document.getElementById(
                    "alertas-bom-desempenho",
                  );
                  if (alertSection) {
                    alertSection.scrollIntoView({ behavior: "smooth" });
                  }
                }}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">
                      Jogadas fora da meta
                    </h3>
                    <svg
                      className="w-8 h-8 opacity-80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold">
                    {alertasBomDesempenho.length}
                  </p>
                  <p className="text-xs opacity-75 mt-1">
                    ⚠️ Pelúcias fora do esperado
                  </p>
                </div>
              </div>
            </>
          )}
          {["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role) ? (
            <>
              {/* Visão das Lojas */}
              <div
                className="stat-card bg-linear-to-br from-orange-600 to-red-700 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
                onClick={() => navigate("/visao-lojas")}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">
                      Visão das Lojas
                    </h3>
                    <span className="text-2xl">🏪</span>
                  </div>
                  <p className="text-3xl font-bold">{lojas.length}</p>
                  <p className="text-xs opacity-75 mt-1">
                    Operação, estoque e pendências
                  </p>
                </div>
              </div>
              {/* Visão das Máquinas */}
              <div
                className="stat-card bg-linear-to-br from-emerald-600 to-teal-800 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
                onClick={() => navigate("/visao-maquinas")}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">
                      Visão das Máquinas
                    </h3>
                    <span className="text-2xl">🎮</span>
                  </div>
                  <p className="text-3xl font-bold">{maquinas.length}</p>
                  <p className="text-xs opacity-75 mt-1">
                    Status, estoque e operação
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* Olhar roteiro */
            <div
              className="stat-card bg-linear-to-br from-sky-600 to-indigo-700 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
              onClick={() => navigate("/roteiros")}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">
                    Olhar Roteiro
                  </h3>
                  <span className="text-2xl">🗺️</span>
                </div>
                <p className="text-xs opacity-75 mt-1">
                  Veja as lojas e máquinas da sua rota
                </p>
              </div>
            </div>
          )}
          {/* Veículos */}
          <div
            className="stat-card bg-linear-to-br from-gray-700 to-gray-900 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
            onClick={() => navigate("/veiculos")}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">Veículos</h3>
                <svg
                  className="w-8 h-8 opacity-80"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 13l2-2m0 0l7-7 7 7M5 11v8a2 2 0 002 2h10a2 2 0 002-2v-8"
                  />
                </svg>
              </div>
              <p className="text-3xl font-bold">🚗🏍️</p>
              <p className="text-xs opacity-75 mt-1">
                Acessar controle de veículos
              </p>
            </div>
          </div>
          {usuario?.role === "FUNCIONARIO" && (
            <div
              className={`stat-card p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer transition-all ${
                manutencoesPendentes.length > 0
                  ? "bg-linear-to-br from-red-600 to-red-800 animate-pulse"
                  : "bg-linear-to-br from-slate-600 to-slate-700"
              }`}
              onClick={() => navigate("/manutencao")}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">
                    Manutenções Pendentes
                  </h3>
                  <span className="text-2xl">🛠️</span>
                </div>
                <p className="text-3xl font-bold">
                  {loadingManutencoesPendentes
                    ? "..."
                    : manutencoesPendentes.length}
                </p>
                <p className="text-xs opacity-75 mt-1">
                  {manutencoesPendentes.length > 0
                    ? "⚠️ Você possui manutenções para resolver"
                    : "Sem pendências no momento"}
                </p>
              </div>
            </div>
          )}
          {usuario?.role === "FUNCIONARIO" && (
            <div
              className="stat-card bg-linear-to-br from-orange-500 to-red-600 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
              onClick={() => navigate("/pecas")}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">
                    Meu Estoque de Peças
                  </h3>
                  <span className="text-2xl">🧰</span>
                </div>
                <p className="text-3xl font-bold">🔩</p>
                <p className="text-xs opacity-75 mt-1">
                  Ver peças comigo e devolver ao depósito
                </p>
              </div>
            </div>
          )}
          {usuario?.role === "FUNCIONARIO" && (
            <div
              className="stat-card bg-linear-to-br from-emerald-600 to-emerald-800 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
              onClick={() => setModalGastoVariavel(true)}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">
                    Lançar Gasto Variável
                  </h3>
                  <span className="text-2xl">🧾</span>
                </div>
                <p className="text-3xl font-bold">💰</p>
                <p className="text-xs opacity-75 mt-1">
                  Gasolina, estacionamento e outros
                </p>
              </div>
            </div>
          )}
        </div>

        {modalGastoVariavel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="relative w-full max-w-md rounded-lg border border-orange-100 bg-white p-6 shadow-2xl">
              <button
                type="button"
                onClick={() => setModalGastoVariavel(false)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar"
              >
                ×
              </button>
              <LancarGastoVariavel
                lojas={lojas}
                veiculos={veiculos}
                onClose={() => setModalGastoVariavel(false)}
                onSuccess={() => setModalGastoVariavel(false)}
              />
            </div>
          </div>
        )}

        {/* Estoque dos Depósitos - Apenas para ADMIN */}
        {usuario?.role === "ADMIN" && lojasComEstoque.length > 0 && (
          <>
            {/* Modal de Movimentação de Estoque */}
            {mostrarModalMovimentacao && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-8 relative">
                  <button
                    className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl"
                    onClick={() => setMostrarModalMovimentacao(false)}
                    aria-label="Fechar"
                  >
                    ×
                  </button>
                  <h2 className="text-2xl font-bold mb-4 text-gray-900 flex items-center gap-2">
                    <span className="text-3xl">🔄</span>
                    Movimentação de Estoque
                  </h2>
                  <form
                    className="space-y-6"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setMovimentacaoEnviando(true);
                      setMovimentacaoErro("");
                      // Removido setMovimentacaoSucesso (não existe mais)
                      try {
                        await api.post("/movimentacao-estoque-loja", {
                          lojaId: movimentacaoLojaId,
                          // usuarioId: usuario?.id, // Se o backend pegar do token, pode remover isso
                          produtos: produtosMovimentacao.map((p) => ({
                            produtoId: p.produtoId,
                            tipoMovimentacao: p.tipoMovimentacao,
                            quantidade: Number(p.quantidade),
                          })),
                        });
                        Swal.fire({
                          icon: "success",
                          title: "Movimentação registrada",
                          text: "Movimentação registrada com sucesso.",
                          confirmButtonColor: "#ef3b24",
                        });
                        setMostrarModalMovimentacao(false);
                        setMovimentacaoLojaId("");
                        setProdutosMovimentacao([
                          {
                            produtoId: "",
                            quantidade: "",
                            tipoMovimentacao: "entrada",
                          },
                        ]);
                      } catch (erro) {
                        setMovimentacaoErro(
                          "Erro ao registrar movimentação. Tente novamente.",
                          erro.response?.data?.error || erro.message,
                        );
                      } finally {
                        setMovimentacaoEnviando(false);
                      }
                    }}
                  >
                    {/* Campo para selecionar a loja */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Loja de destino
                      </label>
                      <select
                        className="input-field w-full"
                        value={movimentacaoLojaId}
                        onChange={(e) => setMovimentacaoLojaId(e.target.value)}
                        required
                      >
                        <option value="">Selecione a loja</option>
                        {(lojas || []).map((loja) => (
                          <option key={loja.id} value={loja.id}>
                            {loja.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* O reset dos campos já está dentro do try/catch do onSubmit. */}
                    {/* Loop dos Produtos */}
                    {produtosMovimentacao.map((p, idx) => (
                      <div key={idx} className="flex gap-2 mb-2 items-center">
                        {/* Select de Produto */}
                        <select
                          value={p.produtoId}
                          onChange={(e) =>
                            handleProdutoChange(
                              idx,
                              "produtoId",
                              e.target.value,
                            )
                          }
                          className="input-field flex-1"
                          required
                        >
                          <option value="">Produto...</option>
                          {produtos.map((prod) => (
                            <option key={prod.id} value={prod.id}>
                              {prod.nome}
                            </option>
                          ))}
                        </select>

                        {/* Input de Quantidade */}
                        <input
                          type="number"
                          min="1"
                          value={p.quantidade}
                          onChange={(e) =>
                            handleProdutoChange(
                              idx,
                              "quantidade",
                              e.target.value,
                            )
                          }
                          placeholder="Qtd"
                          className="input-field w-20"
                          required
                          onWheel={(e) => e.target.blur()}
                        />

                        {/* Select de Tipo (Entrada/Saída) */}
                        <select
                          value={p.tipoMovimentacao || "saida"}
                          onChange={(e) =>
                            handleProdutoChange(
                              idx,
                              "tipoMovimentacao",
                              e.target.value,
                            )
                          }
                          className="input-field w-28"
                          required
                        >
                          <option value="saida">Saída</option>
                          <option value="entrada">Entrada</option>
                        </select>

                        {/* Botão Remover (X) */}
                        {produtosMovimentacao.length > 1 && (
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-700 font-bold p-2"
                            onClick={() => handleRemoveProduto(idx)}
                            title="Remover item"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Botão Adicionar Mais Produtos */}
                    <button
                      type="button"
                      className="text-sm text-primary hover:text-primary-dark font-semibold flex items-center gap-1 mt-2"
                      onClick={handleAddProduto}
                    >
                      + Adicionar outro produto
                    </button>

                    {/* Mensagens de Erro/Sucesso */}
                    {movimentacaoErro && (
                      <div className="text-red-600 text-sm mt-2">
                        {movimentacaoErro}
                      </div>
                    )}
                    {/* Removido renderização condicional de movimentacaoSucesso */}

                    {/* Botões de Ação (Cancelar e Registrar) */}
                    <div className="flex gap-4 justify-end pt-4 border-t border-gray-200 mt-4">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setMostrarModalMovimentacao(false)}
                        disabled={movimentacaoEnviando}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={movimentacaoEnviando}
                      >
                        {movimentacaoEnviando ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Enviando...
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-5 h-5 mr-2"
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
                            Registrar Movimentação
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            <div className="card mb-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <span className="text-3xl">📦</span>
                    Estoque dos Depósitos
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Visualização rápida do estoque em cada loja
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={imprimirRelatorioConsolidado}
                    className="w-full sm:w-auto px-3 py-2 bg-linear-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold text-sm flex items-center justify-center gap-2 wrap-break-word"
                    style={{ minWidth: 0, maxWidth: "100%" }}
                  >
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
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                      />
                    </svg>
                    Imprimir Relatório Consolidado
                  </button>
                  <button
                    onClick={() => setMostrarModalMovimentacao(true)}
                    className="px-4 py-2 bg-linear-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold text-sm flex items-center gap-2"
                  >
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Movimentação de Estoque
                  </button>
                  {loadingEstoque && (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {lojasComEstoque.map((loja) => (
                  <div
                    key={loja.id}
                    className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors"
                  >
                    {/* Header - sempre visível */}
                    <div className="p-5 bg-gray-50">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div
                          className="flex items-center gap-4 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => toggleLojaEstoque(loja.id)}
                        >
                          <span className="text-3xl">🏪</span>
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg">
                              {loja.nome}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-semibold">
                                {loja.totalProdutos}
                              </span>{" "}
                              {loja.totalProdutos === 1
                                ? "produto"
                                : "produtos"}{" "}
                              ·{" "}
                              <span className="font-semibold">
                                {loja.totalUnidades}
                              </span>{" "}
                              unidades totais
                            </p>
                            {loja.endereco && (
                              <p className="text-xs text-gray-500 mt-1">
                                📍 {loja.endereco}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                imprimirRelatorioLoja(loja);
                              }}
                              className="w-full sm:w-auto px-3 py-2 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm flex items-center justify-center gap-2 wrap-break-word"
                              style={{ minWidth: 0, maxWidth: "100%" }}
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
                                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                />
                              </svg>
                              Imprimir
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirEdicaoEstoque(loja);
                              }}
                              className="w-full sm:w-auto px-4 py-2 bg-primary text-black rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                            >
                              ✏️ Editar Estoque
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                darSaidaEmTodoEstoque(loja);
                              }}
                              disabled={enviandoSaidaTotal[loja.id]}
                              className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {enviandoSaidaTotal[loja.id]
                                ? "Enviando..."
                                : "📤 Dar Saída em Todo Estoque"}
                            </button>
                          </div>
                          <svg
                            className={`w-6 h-6 text-gray-500 transition-transform ${
                              lojaEstoqueExpanded[loja.id] ? "rotate-180" : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Conteúdo - expansível */}
                    {lojaEstoqueExpanded[loja.id] && (
                      <div className="p-5 bg-white border-t-2 border-gray-100">
                        {loja.estoque.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {loja.estoque
                              .sort((a, b) => b.quantidade - a.quantidade)
                              .map((item) => {
                                const abaixoDoMinimo =
                                  item.estoqueMinimo > 0 &&
                                  item.quantidade < item.estoqueMinimo;

                                return (
                                  <div
                                    key={item.id}
                                    className={`p-4 rounded-lg border-2 hover:shadow-md transition-all ${
                                      abaixoDoMinimo
                                        ? "bg-red-50 border-red-300 shadow-md"
                                        : "bg-gray-50 border-gray-200 hover:border-gray-300"
                                    }`}
                                  >
                                    <div className="flex items-start gap-3 mb-3">
                                      <span className="text-3xl">
                                        {item.produto.emoji || "📦"}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="font-bold text-gray-900 text-base truncate">
                                            {item.produto.nome}
                                          </p>
                                          {abaixoDoMinimo && (
                                            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                                              ⚠️
                                            </span>
                                          )}
                                        </div>
                                        {item.produto.codigo && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            Cód: {item.produto.codigo}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div
                                      className={`flex items-end justify-between mt-3 pt-3 border-t ${
                                        abaixoDoMinimo
                                          ? "border-red-200"
                                          : "border-gray-200"
                                      }`}
                                    >
                                      <div>
                                        <p
                                          className={`text-xs mb-1 ${
                                            abaixoDoMinimo
                                              ? "text-red-700 font-semibold"
                                              : "text-gray-600"
                                          }`}
                                        >
                                          Quantidade
                                        </p>
                                        <span
                                          className={`text-3xl font-bold ${
                                            abaixoDoMinimo
                                              ? "text-red-600"
                                              : "text-gray-900"
                                          }`}
                                        >
                                          {item.quantidade}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        <p
                                          className={`text-xs mb-1 ${
                                            abaixoDoMinimo
                                              ? "text-red-700 font-semibold"
                                              : "text-gray-600"
                                          }`}
                                        >
                                          Estoque mín.
                                        </p>
                                        <span
                                          className={`text-lg font-semibold ${
                                            abaixoDoMinimo
                                              ? "text-red-600"
                                              : "text-gray-600"
                                          }`}
                                        >
                                          {item.estoqueMinimo}
                                        </span>
                                      </div>
                                    </div>
                                    {abaixoDoMinimo && (
                                      <div className="mt-3 p-2 bg-red-100 rounded-lg border border-red-200">
                                        <p className="text-xs text-red-800 font-semibold flex items-center gap-1">
                                          <svg
                                            className="w-4 h-4"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                          Estoque abaixo do mínimo!
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <p className="text-5xl mb-3">📭</p>
                            <p className="text-gray-500 font-medium">
                              Nenhum produto no estoque
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                              Clique em "Editar Estoque" acima para adicionar
                              produtos
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Busca de Lojas e Máquinas */}
        <div className="card-gradient mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="text-3xl">🔍</span>
            Buscar Lojas e Máquinas
          </h2>

          {/* Breadcrumb de Navegação */}
          {(lojaSelecionada || maquinaSelecionada) && (
            <div className="mb-6 flex items-center gap-2 text-sm">
              <button
                onClick={handleVoltar}
                className="text-primary hover:text-primary/80 font-semibold flex items-center gap-1"
              >
                ← Voltar
              </button>
              <span className="text-gray-400">/</span>
              {lojaSelecionada && (
                <>
                  <span className="text-gray-700 font-semibold">
                    {lojaSelecionada.nome}
                  </span>
                  {maquinaSelecionada && (
                    <>
                      <span className="text-gray-400">/</span>
                      <span className="text-gray-700 font-semibold">
                        {maquinaSelecionada.codigo} - {maquinaSelecionada.nome}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Barra de Pesquisa - Visível apenas quando não há seleção */}
          {!lojaSelecionada && !maquinaSelecionada && (
            <div className="relative mb-6">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite o nome da loja ou endereço..."
                className="w-full input-field pl-12 text-lg"
              />
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          )}

          {/* Lista de Lojas Filtradas */}
          {!lojaSelecionada && !maquinaSelecionada && (
            <div className="space-y-3">
              {lojasFiltradas.length > 0 ? (
                lojasFiltradas.map((loja) => {
                  const qtdMaquinas = maquinas.filter(
                    (m) => m.lojaId === loja.id,
                  ).length;
                  return (
                    <div
                      key={loja.id}
                      onClick={() => handleSelecionarLoja(loja)}
                      className="p-5 border-2 border-gray-200 rounded-xl hover:border-primary hover:shadow-lg transition-all cursor-pointer bg-white"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">
                            🏪 {loja.nome}
                          </h3>
                          <p className="text-sm text-gray-600">
                            📍 {loja.endereco || "Endereço não cadastrado"}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                              {qtdMaquinas}{" "}
                              {qtdMaquinas === 1 ? "máquina" : "máquinas"}
                            </span>
                            {loja.ativo && (
                              <Badge variant="success">Ativa</Badge>
                            )}
                          </div>
                        </div>
                        <svg
                          className="w-6 h-6 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <p className="text-6xl mb-4">🔍</p>
                  <p className="text-gray-600">
                    {searchTerm
                      ? "Nenhuma loja encontrada"
                      : "Digite para buscar lojas"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Lista de Máquinas da Loja */}
          {lojaSelecionada && !maquinaSelecionada && (
            <div className="space-y-3">
              {maquinasDaLoja.length > 0 ? (
                maquinasDaLoja.map((maquina) => {
                  const produtoAtual = produtoAtualMaquinas[maquina.id];
                  console.log("Dados da máquina:", maquina);
                  if (maquina.movimentacoes) {
                    console.log(
                      `Movimentações da máquina ${maquina.codigo}:`,
                      maquina.movimentacoes,
                    );
                  }
                  if (maquina.sairam !== undefined) {
                    console.log(
                      `Saíram da máquina ${maquina.codigo}:`,
                      maquina.sairam,
                    );
                  }
                  return (
                    <div
                      key={maquina.id}
                      onClick={() => handleSelecionarMaquina(maquina)}
                      className="p-5 border-2 border-gray-200 rounded-xl hover:border-primary hover:shadow-lg transition-all cursor-pointer bg-white"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">
                            🎰 {maquina.codigo} - {maquina.nome}
                          </h3>
                          <div className="flex items-center gap-4 mt-2">
                            {maquina.tipo && (
                              <span className="text-xs text-gray-600">
                                Tipo: {maquina.tipo}
                              </span>
                            )}
                            {produtoAtual && (
                              <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                                <span>{produtoAtual.emoji || "🧸"}</span>
                                <span>{produtoAtual.nome}</span>
                              </span>
                            )}
                            <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-semibold">
                              Capacidade: {maquina.capacidadePadrao || 0}
                            </span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                              Estoque:{" "}
                              {estoqueMaquinas[maquina.id] ??
                                maquina.estoqueAtual ??
                                0}
                              /{maquina.capacidadePadrao || 0}
                            </span>
                            {maquina.ativo && (
                              <Badge variant="success">Ativa</Badge>
                            )}
                          </div>
                        </div>
                        <svg
                          className="w-6 h-6 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <p className="text-6xl mb-4">🎰</p>
                  <p className="text-gray-600">
                    Nenhuma máquina cadastrada nesta loja
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Detalhes da Máquina Selecionada */}
          {maquinaSelecionada && (
            <div className="space-y-6">
              {/* Informações da Máquina */}
              <div className="bg-linear-to-br from-primary/10 to-secondary/10 p-6 rounded-xl">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  📊 Informações da Máquina
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Código</p>
                    <p className="text-lg font-semibold">
                      {maquinaSelecionada.codigo}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Nome</p>
                    <p className="text-lg font-semibold">
                      {maquinaSelecionada.nome}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tipo</p>
                    <p className="text-lg font-semibold">
                      {maquinaSelecionada.ultimoProduto ? (
                        <span className="flex items-center gap-2">
                          <span>
                            {maquinaSelecionada.ultimoProduto.emoji || "🧸"}
                          </span>
                          <span>{maquinaSelecionada.ultimoProduto.nome}</span>
                        </span>
                      ) : (
                        maquinaSelecionada.tipo || "-"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Capacidade</p>
                    <p className="text-lg font-semibold">
                      {maquinaSelecionada.capacidadePadrao || 0}
                    </p>
                  </div>
                  {usuario?.role === "ADMIN" && (
                    <div>
                      <p className="text-sm text-gray-600">Estoque Atual</p>
                      <p className="text-lg font-semibold">
                        {maquinaSelecionada.estoqueAtual || 0}
                      </p>
                    </div>
                  )}
                  {maquinaSelecionada.valorFicha && (
                    <div>
                      <p className="text-sm text-gray-600">Valor da Ficha</p>
                      <p className="text-lg font-semibold">
                        R${" "}
                        {parseFloat(maquinaSelecionada.valorFicha).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {maquinaSelecionada.fichasNecessarias && (
                    <div>
                      <p className="text-sm text-gray-600">
                        🎫 Fichas para Jogar
                      </p>
                      <p className="text-lg font-semibold">
                        {maquinaSelecionada.fichasNecessarias}{" "}
                        {maquinaSelecionada.fichasNecessarias === 1
                          ? "ficha"
                          : "fichas"}
                      </p>
                    </div>
                  )}
                  {maquinaSelecionada.forcaForte !== null &&
                    maquinaSelecionada.forcaForte !== undefined && (
                      <div>
                        <p className="text-sm text-gray-600">💪 Força Forte</p>
                        <p className="text-lg font-semibold">
                          {maquinaSelecionada.forcaForte}%
                        </p>
                      </div>
                    )}
                  {maquinaSelecionada.forcaFraca !== null &&
                    maquinaSelecionada.forcaFraca !== undefined && (
                      <div>
                        <p className="text-sm text-gray-600">🤏 Força Fraca</p>
                        <p className="text-lg font-semibold">
                          {maquinaSelecionada.forcaFraca}%
                        </p>
                      </div>
                    )}
                  {maquinaSelecionada.forcaPremium !== null &&
                    maquinaSelecionada.forcaPremium !== undefined && (
                      <div>
                        <p className="text-sm text-gray-600">
                          ⭐ Força Premium
                        </p>
                        <p className="text-lg font-semibold">
                          {maquinaSelecionada.forcaPremium}%
                        </p>
                      </div>
                    )}
                  {maquinaSelecionada.jogadasPremium && (
                    <div>
                      <p className="text-sm text-gray-600">
                        🎮 Jogadas Premium
                      </p>
                      <p className="text-lg font-semibold">
                        {maquinaSelecionada.jogadasPremium}{" "}
                        {maquinaSelecionada.jogadasPremium === 1
                          ? "jogada"
                          : "jogadas"}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="text-lg font-semibold">
                      {maquinaSelecionada.ativo ? (
                        <Badge variant="success">Ativa</Badge>
                      ) : (
                        <Badge variant="danger">Inativa</Badge>
                      )}
                    </p>
                  </div>
                </div>
                {maquinaSelecionada.localizacao && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">Localização</p>
                    <p className="text-base text-gray-800">
                      {maquinaSelecionada.localizacao}
                    </p>
                  </div>
                )}
              </div>

              {/* Movimentações - Apenas para ADMIN */}
              {usuario?.role === "ADMIN" && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">🔄</span>
                    Histórico de Movimentações
                  </h3>

                  {/* Filtros de Data */}
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          📅 Data Inicial
                        </label>
                        <input
                          type="date"
                          value={dataInicio}
                          onChange={(e) => setDataInicio(e.target.value)}
                          className="input-field w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          📅 Data Final
                        </label>
                        <input
                          type="date"
                          value={dataFim}
                          onChange={(e) => setDataFim(e.target.value)}
                          className="input-field w-full"
                        />
                      </div>
                    </div>
                    {(dataInicio || dataFim) && (
                      <button
                        onClick={() => {
                          setDataInicio("");
                          setDataFim("");
                        }}
                        className="mt-2 text-sm text-primary hover:text-primary-dark flex items-center gap-1"
                      >
                        ✕ Limpar filtros
                      </button>
                    )}
                  </div>
                  {loadingMaquina ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                      <p className="text-gray-600 mt-4">
                        Carregando movimentações...
                      </p>
                    </div>
                  ) : movimentacoes.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {movimentacoes
                        .filter((mov) => {
                          const movData = new Date(mov.createdAt);
                          const inicio = dataInicio
                            ? new Date(dataInicio)
                            : null;
                          const fim = dataFim
                            ? new Date(dataFim + "T23:59:59")
                            : null;

                          if (inicio && movData < inicio) return false;
                          if (fim && movData > fim) return false;
                          return true;
                        })
                        .map((mov) => (
                          <div
                            key={mov.id}
                            className="p-4 border border-gray-200 rounded-lg bg-white"
                          >
                            <div className="flex items-center justify-between mb-2 gap-3">
                              <Badge
                                variant={
                                  mov.tipo === "entrada" ? "success" : "danger"
                                }
                              >
                                {mov.tipo === "entrada"
                                  ? "📥 Entrada"
                                  : "📤 Saída"}
                              </Badge>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600">
                                  {new Date(
                                    mov.dataColeta || mov.createdAt,
                                  ).toLocaleDateString("pt-BR")}{" "}
                                  às{" "}
                                  {new Date(
                                    mov.dataColeta || mov.createdAt,
                                  ).toLocaleTimeString("pt-BR")}
                                </span>
                                {movimentacaoEditandoId === mov.id ? (
                                  <button
                                    type="button"
                                    onClick={cancelarEdicaoMovimentacao}
                                    className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-semibold"
                                    disabled={salvandoMovimentacaoId === mov.id}
                                  >
                                    Cancelar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      iniciarEdicaoMovimentacao(mov)
                                    }
                                    className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold"
                                  >
                                    Editar
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-6 gap-4 mt-3 text-sm">
                              <div>
                                <p className="text-gray-600">Total Pré</p>
                                <p className="font-semibold">
                                  {mov.totalPre || 0}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Saíram</p>
                                <p className="font-semibold text-red-600">
                                  {mov.sairam || 0}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Abastecidas</p>
                                <p className="font-semibold text-green-600">
                                  {mov.abastecidas || 0}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">
                                  Retirada de Produto
                                </p>
                                <p className="font-semibold text-pink-600">
                                  {Array.isArray(mov.detalhesProdutos)
                                    ? mov.detalhesProdutos.reduce(
                                        (soma, p) =>
                                          soma + (p.retiradaProduto || 0),
                                        0,
                                      )
                                    : 0}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600 flex items-center gap-1">
                                  <span>📦</span> Total Atual
                                </p>
                                <p className="font-semibold text-purple-600">
                                  {mov.totalPos ?? 0}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600 flex items-center gap-1">
                                  <span>🎫</span> Fichas
                                </p>
                                <p className="font-semibold text-blue-600">
                                  {mov.fichas || 0}
                                </p>
                              </div>
                            </div>

                            {/* Contadores da Máquina */}
                            {(mov.contadorIn || mov.contadorOut) && (
                              <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-200">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">📥</span>
                                  <div>
                                    <p className="text-xs text-gray-600">
                                      Contador IN
                                    </p>
                                    <p className="font-bold text-green-700">
                                      {mov.contadorIn || "-"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">📤</span>
                                  <div>
                                    <p className="text-xs text-gray-600">
                                      Contador OUT
                                    </p>
                                    <p className="font-bold text-orange-700">
                                      {mov.contadorOut || "-"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {mov.observacoes && (
                              <p className="text-sm text-gray-600 mt-3 italic">
                                💬 {mov.observacoes}
                              </p>
                            )}

                            {movimentacaoEditandoId === mov.id &&
                              movimentacaoForm && (
                                <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Data/Hora
                                      </label>
                                      <input
                                        type="datetime-local"
                                        value={movimentacaoForm.dataColeta}
                                        onChange={(e) =>
                                          atualizarCampoMovimentacao(
                                            "dataColeta",
                                            e.target.value,
                                          )
                                        }
                                        className="input-field w-full"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Total Pré
                                      </label>
                                      <input
                                        type="number"
                                        value={movimentacaoForm.totalPre}
                                        onChange={(e) =>
                                          atualizarCampoMovimentacao(
                                            "totalPre",
                                            e.target.value,
                                          )
                                        }
                                        className="input-field w-full"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Total Atual
                                      </label>
                                      <input
                                        type="number"
                                        value={movimentacaoForm.totalPos}
                                        onChange={(e) =>
                                          atualizarCampoMovimentacao(
                                            "totalPos",
                                            e.target.value,
                                          )
                                        }
                                        className="input-field w-full"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Saíram
                                      </label>
                                      <input
                                        type="number"
                                        value={movimentacaoForm.sairam}
                                        onChange={(e) =>
                                          atualizarCampoMovimentacao(
                                            "sairam",
                                            e.target.value,
                                          )
                                        }
                                        className="input-field w-full"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Abastecidas
                                      </label>
                                      <input
                                        type="number"
                                        value={movimentacaoForm.abastecidas}
                                        onChange={(e) =>
                                          atualizarCampoMovimentacao(
                                            "abastecidas",
                                            e.target.value,
                                          )
                                        }
                                        className="input-field w-full"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Fichas
                                      </label>
                                      <input
                                        type="number"
                                        value={movimentacaoForm.fichas}
                                        onChange={(e) =>
                                          atualizarCampoMovimentacao(
                                            "fichas",
                                            e.target.value,
                                          )
                                        }
                                        className="input-field w-full"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Contador IN
                                      </label>
                                      <input
                                        type="number"
                                        value={movimentacaoForm.contadorIn}
                                        onChange={(e) =>
                                          atualizarCampoMovimentacao(
                                            "contadorIn",
                                            e.target.value,
                                          )
                                        }
                                        className="input-field w-full"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Contador OUT
                                      </label>
                                      <input
                                        type="number"
                                        value={movimentacaoForm.contadorOut}
                                        onChange={(e) =>
                                          atualizarCampoMovimentacao(
                                            "contadorOut",
                                            e.target.value,
                                          )
                                        }
                                        className="input-field w-full"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                      Observações
                                    </label>
                                    <textarea
                                      value={movimentacaoForm.observacoes}
                                      onChange={(e) =>
                                        atualizarCampoMovimentacao(
                                          "observacoes",
                                          e.target.value,
                                        )
                                      }
                                      rows={2}
                                      className="input-field w-full"
                                    />
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-xs font-semibold text-gray-700">
                                        Produtos da Movimentação
                                      </p>
                                      <button
                                        type="button"
                                        onClick={adicionarProdutoMovimentacao}
                                        className="px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700"
                                      >
                                        + Produto
                                      </button>
                                    </div>

                                    <div className="space-y-2">
                                      {(movimentacaoForm.produtos || []).map(
                                        (produto, index) => (
                                          <div
                                            key={`${mov.id}-produto-${index}`}
                                            className="grid grid-cols-1 md:grid-cols-5 gap-2"
                                          >
                                            <select
                                              value={produto.produtoId}
                                              onChange={(e) =>
                                                atualizarProdutoMovimentacao(
                                                  index,
                                                  "produtoId",
                                                  e.target.value,
                                                )
                                              }
                                              className="input-field md:col-span-2"
                                            >
                                              <option value="">
                                                Selecione o produto
                                              </option>
                                              {produtos.map((itemProduto) => (
                                                <option
                                                  key={itemProduto.id}
                                                  value={itemProduto.id}
                                                >
                                                  {itemProduto.nome}
                                                </option>
                                              ))}
                                            </select>
                                            <input
                                              type="number"
                                              min="0"
                                              value={produto.quantidadeSaiu}
                                              onChange={(e) =>
                                                atualizarProdutoMovimentacao(
                                                  index,
                                                  "quantidadeSaiu",
                                                  e.target.value,
                                                )
                                              }
                                              className="input-field"
                                              placeholder="Saiu"
                                            />
                                            <input
                                              type="number"
                                              min="0"
                                              value={
                                                produto.quantidadeAbastecida
                                              }
                                              onChange={(e) =>
                                                atualizarProdutoMovimentacao(
                                                  index,
                                                  "quantidadeAbastecida",
                                                  e.target.value,
                                                )
                                              }
                                              className="input-field"
                                              placeholder="Abastecida"
                                            />
                                            <div className="flex gap-2">
                                              <input
                                                type="number"
                                                min="0"
                                                value={produto.retiradaProduto}
                                                onChange={(e) =>
                                                  atualizarProdutoMovimentacao(
                                                    index,
                                                    "retiradaProduto",
                                                    e.target.value,
                                                  )
                                                }
                                                className="input-field"
                                                placeholder="Retirada"
                                              />
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removerProdutoMovimentacao(
                                                    index,
                                                  )
                                                }
                                                className="px-2 rounded-md bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold"
                                                title="Remover produto"
                                              >
                                                X
                                              </button>
                                            </div>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        salvarEdicaoMovimentacao(mov.id)
                                      }
                                      className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold"
                                      disabled={
                                        salvandoMovimentacaoId === mov.id
                                      }
                                    >
                                      {salvandoMovimentacaoId === mov.id
                                        ? "Salvando..."
                                        : "Salvar edição"}
                                    </button>
                                  </div>
                                </div>
                              )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-6xl mb-4">📭</p>
                      <p className="text-gray-600">
                        Nenhuma movimentação registrada para esta máquina
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {usuario?.role === "ADMIN" && alertasBomDesempenho.length > 0 && (
          <div
            className="card mb-8 border-l-4 border-red-500"
            id="alertas-bom-desempenho"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-red-100 p-2 rounded-lg">⚠️</span>
                Pelúcias saindo fora do esperado
              </h2>
              <span className="badge bg-red-100 text-red-700 border-red-300">
                {alertasBomDesempenho.length}{" "}
                {alertasBomDesempenho.length === 1 ? "alerta" : "alertas"}
              </span>
            </div>
            <div className="space-y-3">
              {alertasBomDesempenho.slice(0, 5).map((alerta) => {
                const acimaDaMeta =
                  alerta.direcao === "acima" ||
                  Number(alerta.jogadasPorPelucia || 0) >
                    Number(alerta.jogadasBoasPorPelucia || 0);

                return (
                  <div
                    key={alerta.id}
                    className={`p-5 rounded-xl shadow-sm ${
                      acimaDaMeta
                        ? "bg-amber-50 border border-amber-200"
                        : "bg-red-50 border border-red-200"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-bold text-lg text-gray-900">
                            🎮 {alerta.maquinaNome || "Máquina"}
                          </span>
                          {alerta.lojaNome && (
                            <span
                              className={`rounded-full bg-white px-3 py-1 text-sm font-bold ${
                                acimaDaMeta
                                  ? "text-amber-700 border border-amber-200"
                                  : "text-red-700 border border-red-200"
                              }`}
                            >
                              🏪 {alerta.lojaNome}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">
                          Saíram <strong>{alerta.sairam}</strong> pelúcia(s). O
                          contador IN subiu <strong>{alerta.diffIn}</strong> no
                          período, equivalente a{" "}
                          <strong>{alerta.jogadasPeriodo}</strong> jogada(s).
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="rounded-xl bg-white p-3 border border-red-100">
                            <p className="text-xs font-bold uppercase text-gray-500">
                              {acimaDaMeta ? "Saindo depois" : "Saindo antes"}
                            </p>
                            <p
                              className={`text-2xl font-black ${
                                acimaDaMeta ? "text-amber-700" : "text-red-700"
                              }`}
                            >
                              {Number(alerta.jogadasPorPelucia || 0).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              jogadas por pelúcia
                            </p>
                          </div>
                          <div className="rounded-xl bg-white p-3 border border-red-100">
                            <p className="text-xs font-bold uppercase text-gray-500">
                              Esperado
                            </p>
                            <p className="text-2xl font-black text-green-700">
                              {Number(
                                alerta.jogadasBoasPorPelucia || 0,
                              ).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              jogadas por pelúcia
                            </p>
                          </div>
                          <div className="rounded-xl bg-white p-3 border border-red-100">
                            <p className="text-xs font-bold uppercase text-gray-500">
                              Valor por jogada
                            </p>
                            <p className="text-2xl font-black text-gray-900">
                              R$ {Number(alerta.valorPorJogada || 0).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              ficha × fichas para jogar
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-3xl font-bold ${
                            acimaDaMeta ? "text-amber-700" : "text-red-700"
                          }`}
                        >
                          {acimaDaMeta ? "+" : "-"}
                          {Number(alerta.diferencaJogadas || 0).toFixed(2)}
                        </p>
                        <p
                          className={`text-xs mt-1 ${
                            acimaDaMeta ? "text-amber-700" : "text-red-700"
                          }`}
                        >
                          jogadas {acimaDaMeta ? "acima" : "abaixo"} da meta
                        </p>
                      </div>
                    </div>
                    {alerta.mensagem && (
                      <p className="text-sm text-gray-600 mt-3 italic">
                        {alerta.mensagem}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Alertas de Estoque - Apenas para ADMIN */}
        {usuario?.role === "ADMIN" && stats.alertas.length > 0 && (
          <div
            className="card mb-8 border-l-4 border-red-500"
            id="alertas-estoque-maquinas"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-red-100 p-2 rounded-lg">⚠️</span>
                Alertas de Estoque em Máquinas
              </h2>
              <span className="badge badge-danger">
                {stats.alertas.length}{" "}
                {stats.alertas.length === 1 ? "alerta" : "alertas"}
              </span>
            </div>
            <div className="space-y-3">
              {stats.alertas.slice(0, 5).map((alerta, index) => (
                <div
                  key={index}
                  className={`p-5 rounded-xl border-l-4 transition-all duration-200 hover:scale-[1.02] ${
                    alerta.nivelAlerta === "CRÍTICO"
                      ? "bg-linear-to-r from-red-50 to-red-100/50 border-red-500 shadow-red-100 shadow-md"
                      : alerta.nivelAlerta === "ALTO"
                        ? "bg-linear-to-r from-orange-50 to-orange-100/50 border-orange-500 shadow-orange-100 shadow-md"
                        : "bg-linear-to-r from-yellow-50 to-yellow-100/50 border-yellow-500 shadow-yellow-100 shadow-md"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg text-gray-900">
                          {alerta.maquina.codigo}
                        </span>
                        <span className="text-gray-600">-</span>
                        <span className="text-gray-800 font-medium">
                          {alerta.maquina.nome}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {alerta.maquina.loja}
                      </p>
                      {alerta.produtos && alerta.produtos.length > 0 && (
                        <p className="text-sm text-gray-700 mt-1 flex flex-wrap gap-1">
                          {alerta.produtos.map((p, i) => (
                            <span
                              key={i}
                              className="bg-white/70 border border-gray-200 px-2 py-0.5 rounded-full text-xs font-medium"
                            >
                              {p.emoji ? `${p.emoji} ` : ""}
                              {p.nome}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-gray-900">
                          {alerta.percentualAtual}
                        </span>
                        <span className="text-lg text-gray-600">%</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 bg-white/60 px-2 py-1 rounded-full">
                        {alerta.estoqueAtual}/{alerta.capacidadePadrao} unidades
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {stats.alertas.length > 5 && !mostrarTodosAlertasMaquinas && (
              <button
                className="block mt-6 w-full text-center bg-linear-to-r from-primary/10 to-accent-yellow/10 hover:from-primary/20 hover:to-accent-yellow/20 text-primary font-bold py-3 rounded-xl transition-all duration-200"
                onClick={() => setMostrarTodosAlertasMaquinas(true)}
              >
                Ver todos os alertas ({stats.alertas.length})
              </button>
            )}
            {mostrarTodosAlertasMaquinas && (
              <div className="mt-6 space-y-3">
                {stats.alertas.slice(5).map((alerta, index) => (
                  <div
                    key={index}
                    className={`p-5 rounded-xl border-l-4 transition-all duration-200 hover:scale-[1.02] ${
                      alerta.nivelAlerta === "CRÍTICO"
                        ? "bg-linear-to-r from-red-50 to-red-100/50 border-red-500 shadow-red-100 shadow-md"
                        : alerta.nivelAlerta === "ALTO"
                          ? "bg-linear-to-r from-orange-50 to-orange-100/50 border-orange-500 shadow-orange-100 shadow-md"
                          : "bg-linear-to-r from-yellow-50 to-yellow-100/50 border-yellow-500 shadow-yellow-100 shadow-md"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-lg text-gray-900">
                            {alerta.maquina.codigo}
                          </span>
                          <span className="text-gray-600">-</span>
                          <span className="text-gray-800 font-medium">
                            {alerta.maquina.nome}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {alerta.maquina.loja}
                        </p>
                        {alerta.produtos && alerta.produtos.length > 0 && (
                          <p className="text-sm text-gray-700 mt-1 flex flex-wrap gap-1">
                            {alerta.produtos.map((p, i) => (
                              <span
                                key={i}
                                className="bg-white/70 border border-gray-200 px-2 py-0.5 rounded-full text-xs font-medium"
                              >
                                {p.emoji ? `${p.emoji} ` : ""}
                                {p.nome}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-gray-900">
                            {alerta.percentualAtual}
                          </span>
                          <span className="text-lg text-gray-600">%</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 bg-white/60 px-2 py-1 rounded-full">
                          {alerta.estoqueAtual}/{alerta.capacidadePadrao}{" "}
                          unidades
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  className="mt-4 w-full text-center bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 rounded-xl transition-all duration-200"
                  onClick={() => setMostrarTodosAlertasMaquinas(false)}
                >
                  Fechar lista de alertas
                </button>
              </div>
            )}
          </div>
        )}

        {/* Alertas de Estoque de Lojas - Apenas para ADMIN */}
        {usuario?.role === "ADMIN" && alertasEstoqueLoja.length > 0 && (
          <div className="card mb-8 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-orange-100 p-2 rounded-lg">🏪</span>
                Alertas de Estoque nas Lojas
              </h2>
              <span className="badge bg-orange-100 text-orange-700 border-orange-300">
                {alertasEstoqueLoja.length}{" "}
                {alertasEstoqueLoja.length === 1 ? "produto" : "produtos"}
              </span>
            </div>
            <div className="space-y-3">
              {alertasEstoqueLoja.slice(0, 5).map((alerta, index) => {
                const percentualAtual =
                  alerta.estoqueMinimo > 0
                    ? Math.round(
                        (alerta.quantidade / alerta.estoqueMinimo) * 100,
                      )
                    : 0;
                const nivelAlerta =
                  percentualAtual <= 25
                    ? "CRÍTICO"
                    : percentualAtual <= 50
                      ? "ALTO"
                      : "MÉDIO";

                return (
                  <div
                    key={`${alerta.lojaId}-${alerta.produtoId}-${index}`}
                    className={`p-5 rounded-xl border-l-4 transition-all duration-200 hover:scale-[1.02] ${
                      nivelAlerta === "CRÍTICO"
                        ? "bg-linear-to-r from-red-50 to-red-100/50 border-red-500 shadow-red-100 shadow-md"
                        : nivelAlerta === "ALTO"
                          ? "bg-linear-to-r from-orange-50 to-orange-100/50 border-orange-500 shadow-orange-100 shadow-md"
                          : "bg-linear-to-r from-yellow-50 to-yellow-100/50 border-yellow-500 shadow-yellow-100 shadow-md"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">
                            {alerta.produto.emoji || "📦"}
                          </span>
                          <span className="font-bold text-lg text-gray-900">
                            {alerta.produto.nome}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {alerta.lojaNome}
                        </p>
                        {alerta.produto.codigo && (
                          <p className="text-xs text-gray-500 mt-1">
                            Código: {alerta.produto.codigo}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-gray-900">
                            {alerta.quantidade}
                          </span>
                          <span className="text-lg text-gray-600">un</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 bg-white/60 px-2 py-1 rounded-full">
                          Min: {alerta.estoqueMinimo} · {percentualAtual}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {alertasEstoqueLoja.length > 5 && (
              <Link
                to="/lojas"
                className="block mt-6 text-center bg-linear-to-r from-orange-500/10 to-orange-600/10 hover:from-orange-500/20 hover:to-orange-600/20 text-orange-700 font-bold py-3 rounded-xl transition-all duration-200"
              >
                Ver todos os alertas de lojas ({alertasEstoqueLoja.length})
              </Link>
            )}
          </div>
        )}

        {/* Distribuição por Loja */}
        {stats.balanco?.distribuicaoLojas?.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-linear-to-br from-primary to-accent-yellow p-2 rounded-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                Performance por Loja
              </h2>
              <span className="badge badge-info">
                {stats.balanco.distribuicaoLojas.length}{" "}
                {stats.balanco.distribuicaoLojas.length === 1
                  ? "loja"
                  : "lojas"}
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-primary"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Loja
                      </div>
                    </th>
                    <th>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path
                            fillRule="evenodd"
                            d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Fichas
                      </div>
                    </th>
                    <th>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                        </svg>
                        Prêmios
                      </div>
                    </th>
                    <th>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-accent-yellow"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Faturamento
                      </div>
                    </th>
                    <th>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-purple-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                        </svg>
                        Média F/P
                      </div>
                    </th>
                    <th>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-pink-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                        </svg>
                        Produtos Vendidos
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.balanco.distribuicaoLojas.map((loja, index) => (
                    <tr key={index}>
                      <td className="font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-linear-to-r from-primary to-accent-yellow"></div>
                          {loja.nome}
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-blue-50 text-blue-700 border-blue-200">
                          {loja.fichas}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-green-50 text-green-700 border-green-200">
                          {loja.sairam}
                        </span>
                      </td>
                      <td>
                        <span className="font-bold text-green-600 text-lg">
                          R$ {loja.faturamento.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-purple-50 text-purple-700 border-purple-200">
                          {loja.mediaFichasPremio}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-pink-50 text-pink-700 border-pink-200">
                          {loja.produtosVendidos || loja.sairam || 0} unidades
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ação Rápida com design destacado */}
        <div className="mt-8 flex justify-center">
          <Link
            to="/movimentacoes?nova=true"
            className="btn-primary text-lg px-10 py-4 flex items-center gap-3 shadow-2xl"
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
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Registrar Nova Movimentação
          </Link>
        </div>
      </div>

      {/* Modal de Edição de Estoque */}
      {estoqueEditando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header do Modal */}
            <div className="bg-linear-to-r from-primary to-accent-yellow p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <span className="text-3xl">✏️</span>
                    Editar Estoque do Depósito
                  </h2>
                  <p className="text-white/90 mt-1">
                    🏪 {estoqueEditando.lojaNome}
                  </p>
                </div>
                <button
                  onClick={fecharEdicaoEstoque}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                  disabled={salvandoEstoque}
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
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Informações e Filtros */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div className="flex-1">
                    <p className="text-sm text-blue-900 font-semibold mb-2">
                      Como usar este painel:
                    </p>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>
                        Use o <strong>checkbox</strong> para selecionar quais
                        produtos aparecerão no estoque desta loja
                      </li>
                      <li>
                        Produtos com estoque <strong>abaixo do mínimo</strong>{" "}
                        aparecem com{" "}
                        <span className="text-red-600">fundo vermelho</span>
                      </li>
                      <li>
                        Edite as quantidades e configure alertas de estoque
                        mínimo
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Botões de Ação Rápida */}
              <div className="mb-6 flex gap-3">
                <button
                  onClick={() => marcarTodosProdutos(true)}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold text-sm flex items-center justify-center gap-2"
                  disabled={salvandoEstoque}
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Marcar Todos
                </button>
                <button
                  onClick={() => marcarTodosProdutos(false)}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold text-sm flex items-center justify-center gap-2"
                  disabled={salvandoEstoque}
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Desmarcar Todos
                </button>
              </div>

              {/* Estatísticas */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="p-4 bg-linear-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
                  <p className="text-sm text-green-700 font-semibold mb-1">
                    ✅ Produtos Ativos
                  </p>
                  <p className="text-3xl font-bold text-green-600">
                    {estoqueEditando.estoque.filter((i) => i.ativo).length}
                  </p>
                </div>
                <div className="p-4 bg-linear-to-br from-orange-50 to-amber-50 rounded-lg border-2 border-orange-200">
                  <p className="text-sm text-orange-700 font-semibold mb-1">
                    ⚠️ Abaixo do Mínimo
                  </p>
                  <p className="text-3xl font-bold text-orange-600">
                    {
                      estoqueEditando.estoque.filter(
                        (i) =>
                          i.ativo &&
                          i.quantidade < i.estoqueMinimo &&
                          i.estoqueMinimo > 0,
                      ).length
                    }
                  </p>
                </div>
              </div>

              {/* Lista de Produtos */}
              {estoqueEditando.estoque.length > 0 ? (
                <div className="space-y-3">
                  {estoqueEditando.estoque.map((item) => {
                    const abaixoDoMinimo =
                      item.ativo &&
                      item.estoqueMinimo > 0 &&
                      item.quantidade < item.estoqueMinimo;

                    return (
                      <div
                        key={item.produtoId}
                        className={`border-2 border-black rounded-xl p-4 transition-all ${
                          abaixoDoMinimo
                            ? "bg-red-50 shadow-md"
                            : item.ativo
                              ? "bg-white hover:border-primary/30"
                              : "bg-gray-50 opacity-60"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Checkbox para ativar/desativar */}
                          <div className="flex items-center pt-2">
                            <input
                              type="checkbox"
                              checked={item.ativo}
                              onChange={() =>
                                toggleProdutoAtivo(item.produtoId)
                              }
                              className="w-6 h-6 text-primary rounded focus:ring-2 focus:ring-primary cursor-pointer"
                              disabled={salvandoEstoque}
                            />
                          </div>

                          <span className="text-4xl">
                            {item.produtoEmoji || "📦"}
                          </span>

                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-bold text-gray-900 text-lg">
                                  {item.produtoNome}
                                </h4>
                                {item.produtoCodigo && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Cód: {item.produtoCodigo}
                                  </p>
                                )}
                              </div>
                              {abaixoDoMinimo && (
                                <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                                  ⚠️ ESTOQUE BAIXO
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Quantidade Atual
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.quantidade}
                                  onChange={(e) =>
                                    atualizarQuantidadeEstoque(
                                      item.produtoId,
                                      e.target.value,
                                    )
                                  }
                                  className={`input-primary w-full text-lg font-bold border border-black ${
                                    abaixoDoMinimo
                                      ? "border-red-400 bg-red-50"
                                      : ""
                                  }`}
                                  disabled={salvandoEstoque || !item.ativo}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Estoque Mínimo
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.estoqueMinimo}
                                  onChange={(e) =>
                                    atualizarEstoqueMinimoEstoque(
                                      item.produtoId,
                                      e.target.value,
                                    )
                                  }
                                  className="input-primary w-full border border-black"
                                  disabled={salvandoEstoque || !item.ativo}
                                />
                              </div>
                            </div>

                            {!item.ativo && (
                              <div className="mt-3 p-2 bg-gray-100 rounded-lg">
                                <p className="text-xs text-gray-600 flex items-center gap-2">
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
                                  Este produto não aparecerá no estoque. Marque
                                  o checkbox para ativá-lo.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-5xl mb-3">📭</p>
                  <p className="text-gray-500 font-medium">
                    Nenhum produto cadastrado no sistema
                  </p>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="border-t-2 border-gray-100 p-6 flex items-center justify-end gap-3">
              <button
                onClick={fecharEdicaoEstoque}
                className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={salvandoEstoque}
              >
                Cancelar
              </button>
              <button
                onClick={salvarEstoque}
                className="px-6 py-3 bg-linear-to-r from-primary to-accent-yellow text-black rounded-lg font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                disabled={salvandoEstoque}
              >
                {salvandoEstoque ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                    Salvando...
                  </>
                ) : (
                  <>
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
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}