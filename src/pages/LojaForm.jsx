import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { DocumentosPdf } from "../components/DocumentosPdf";

// embutido: usado dentro do Projeto Loja (loja nova). Sem navbar, cabeçalho
// e botões; o projeto chama ref.salvar() e recebe o id da loja, que nasce
// escondida (em implantação) até o projeto ser concluído.
export const LojaForm = forwardRef(function LojaForm(
  { embutido = false, lojaIdEmbutido = null, shoppingIdProjeto },
  ref,
) {
  const params = useParams();
  const id = embutido ? lojaIdEmbutido : params.id;
  const navigate = useNavigate();
  const isEdit = !!id;
  // /lojas/nova?tipo=AVULSA&shoppingId=... (vem da tela Shoppings)
  const [busca] = useSearchParams();

  const [formData, setFormData] = useState({
    nome: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    telefone: "",
    responsavel: "",
    statusOperacao: "ATIVA",
    dataInicio: "",
    observacoes: "",
    dataFimContrato: "",
    diasAvisoContrato: "60",
    valorFichaPadrao: "2,50",
    ativo: true,
    shoppingId: (!embutido && busca.get("shoppingId")) || "",
    tipo: !embutido && busca.get("tipo") === "AVULSA" ? "AVULSA" : "LOJA",
    estoqueLojaId: "",
    // Loja sem estoque: usa o estoque de outra loja (estoqueLojaId)
    semEstoque: false,
  });
  const avulsa = formData.tipo === "AVULSA";

  const parseDecimalInput = (value, defaultValue = 0) => {
    const raw = String(value || "").trim();
    if (!raw) return defaultValue;

    // Aceita formatos: 5,00 | 5.00 | 1.234,56 | 1234.56
    let normalized = raw;
    const hasComma = normalized.includes(",");
    const hasDot = normalized.includes(".");

    if (hasComma && hasDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (hasComma) {
      normalized = normalized.replace(",", ".");
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  };

  const formatarValorFichaParaInput = (valor) => {
    if (valor === undefined || valor === null || valor === "") return "2,50";
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return "2,50";
    return numero.toFixed(2).replace(".", ",");
  };

  const normalizarNomeGasto = (nomeOriginal) =>
    String(nomeOriginal || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const mesAtualStr = () => {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  };

  let contadorGastoFixo = 0;
  const criarGastoFixoVazio = () => ({
    _key: `novo-${Date.now()}-${contadorGastoFixo++}`,
    nome: "",
    valor: "",
    observacao: "",
    vigenciaInicio: "",
    vigenciaFim: "",
  });

  let contadorExtintor = 0;
  const criarExtintorVazio = () => ({
    _key: `novo-${Date.now()}-${contadorExtintor++}`,
    id: null,
    identificacao: "",
    numero: "",
    dataVencimento: "",
  });

  // "sempre" (sem data), "unico" (so um mes) ou "apartir" (a partir de um
  // mes, sem data de fim).
  const obterTipoVigencia = (gasto) => {
    if (!gasto.vigenciaInicio && !gasto.vigenciaFim) return "sempre";
    if (
      gasto.vigenciaInicio &&
      gasto.vigenciaFim &&
      gasto.vigenciaInicio === gasto.vigenciaFim
    ) {
      return "unico";
    }
    if (gasto.vigenciaInicio && !gasto.vigenciaFim) return "apartir";
    return "sempre";
  };

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Gastos fixos da loja
  const [gastosFixos, setGastosFixos] = useState([]);

  // Extintores da loja
  const [extintores, setExtintores] = useState([]);
  const [shoppings, setShoppings] = useState([]);
  // Lojas que podem emprestar o estoque (as que têm estoque próprio)
  const [lojasEstoque, setLojasEstoque] = useState([]);

  useEffect(() => {
    api
      .get("/shoppings")
      .then(({ data }) => setShoppings(Array.isArray(data) ? data : []))
      .catch(() => setShoppings([]));
    api
      .get("/lojas")
      .then(({ data }) =>
        setLojasEstoque(
          (Array.isArray(data) ? data : []).filter((l) => l.ativo !== false && !l.estoqueLojaId),
        ),
      )
      .catch(() => setLojasEstoque([]));
  }, []);

  useEffect(() => {
    if (isEdit) {
      carregarLoja();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Carregar gastos fixos da loja ao editar
  useEffect(() => {
    if (isEdit) {
      carregarGastosFixos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Carregar extintores da loja ao editar
  useEffect(() => {
    if (isEdit) {
      carregarExtintores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const carregarExtintores = async () => {
    try {
      const response = await api.get(`/extintores-loja/${id}`);
      const lista = Array.isArray(response.data) ? response.data : [];
      setExtintores(
        lista.map((item) => ({
          _key: `db-${item.id}`,
          id: item.id,
          identificacao: item.identificacao || "",
          numero: item.numero || "",
          dataVencimento: item.dataVencimento || item.data_vencimento || "",
        })),
      );
    } catch (error) {
      setExtintores([]);
    }
  };
  // Função para carregar gastos fixos do backend
  const carregarGastosFixos = async () => {
    try {
      const response = await api.get(`/gastos-fixos-loja/${id}`);
      const lista = Array.isArray(response.data) ? response.data : [];
      setGastosFixos(
        lista.map((item) => ({
          _key: `db-${item.id}`,
          nome: item.nome || "",
          valor:
            item.valor !== undefined && item.valor !== null
              ? String(item.valor)
              : "",
          observacao: item.observacao || "",
          vigenciaInicio: String(
            item.vigenciaInicio || item.vigencia_inicio || "",
          ).slice(0, 7),
          vigenciaFim: String(
            item.vigenciaFim || item.vigencia_fim || "",
          ).slice(0, 7),
        })),
      );
    } catch (error) {
      setGastosFixos([]);
    }
  };

  const carregarLoja = async () => {
    try {
      setLoadingData(true);
      const response = await api.get(`/lojas/${id}`);
      const valorFichaApi =
        response.data?.valorFichaPadrao ?? response.data?.valor_ficha_padrao;

      setFormData({
        ...response.data,
        statusOperacao:
          response.data?.statusOperacao ||
          response.data?.status_operacao ||
          (response.data?.ativo === false ? "INATIVA" : "ATIVA"),
        dataInicio: response.data?.dataInicio || response.data?.data_inicio || "",
        observacoes: response.data?.observacoes || "",
        shoppingId: response.data?.shoppingId || "",
        tipo: response.data?.tipo || "LOJA",
        estoqueLojaId: response.data?.estoqueLojaId || "",
        semEstoque: Boolean(response.data?.estoqueLojaId),
        dataFimContrato:
          response.data?.dataFimContrato ||
          response.data?.data_fim_contrato ||
          "",
        diasAvisoContrato: String(
          response.data?.diasAvisoContrato ??
            response.data?.dias_aviso_contrato ??
            60,
        ),
        valorFichaPadrao: formatarValorFichaParaInput(valorFichaApi),
      });
    } catch (error) {
      setError(
        "Erro ao carregar loja: " +
          (error.response?.data?.error || error.message),
      );
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const novo = { ...formData, [name]: type === "checkbox" ? checked : value };
    // Máquina avulsa: endereço vazio vem do shopping
    if (name === "shoppingId" && novo.tipo === "AVULSA") {
      const shopping = shoppings.find((s) => s.id === value);
      if (shopping) {
        if (!novo.endereco) novo.endereco = shopping.endereco || shopping.nome;
        if (!novo.cidade) novo.cidade = shopping.cidade || "";
        if (!novo.estado) novo.estado = shopping.estado || "";
      }
    }
    setFormData(novo);
  };

  // Manipula alteração dos campos de gastos fixos
  const handleChangeGastoFixo = (idx, field, value) => {
    setGastosFixos((prev) =>
      prev.map((g, i) =>
        i === idx
          ? {
              ...g,
              [field]:
                field === "valor" ? value.replace(/[^0-9.,]/g, "") : value,
            }
          : g,
      ),
    );
  };

  const handleAdicionarGastoFixo = () => {
    setGastosFixos((prev) => [...prev, criarGastoFixoVazio()]);
  };

  const handleRemoverGastoFixo = (idx) => {
    setGastosFixos((prev) => prev.filter((_, i) => i !== idx));
  };

  // Manipula alteração dos campos de extintores
  const handleChangeExtintor = (idx, field, value) => {
    setExtintores((prev) =>
      prev.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex)),
    );
  };

  const handleAdicionarExtintor = () => {
    setExtintores((prev) => [...prev, criarExtintorVazio()]);
  };

  const handleRemoverExtintor = (idx) => {
    setExtintores((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleChangeTipoVigencia = (idx, tipo) => {
    setGastosFixos((prev) =>
      prev.map((g, i) => {
        if (i !== idx) return g;
        if (tipo === "sempre") {
          return { ...g, vigenciaInicio: "", vigenciaFim: "" };
        }
        if (tipo === "unico") {
          const mes = g.vigenciaInicio || g.vigenciaFim || mesAtualStr();
          return { ...g, vigenciaInicio: mes, vigenciaFim: mes };
        }
        // apartir
        return {
          ...g,
          vigenciaInicio: g.vigenciaInicio || mesAtualStr(),
          vigenciaFim: "",
        };
      }),
    );
  };

  const handleChangeMesUnico = (idx, mes) => {
    setGastosFixos((prev) =>
      prev.map((g, i) =>
        i === idx ? { ...g, vigenciaInicio: mes, vigenciaFim: mes } : g,
      ),
    );
  };

  // Valida nomes duplicados e devolve só os gastos preenchidos. Lança erro
  // se achar nomes repetidos.
  const validarGastosFixos = () => {
    const gastosValidos = gastosFixos.filter(
      (g) => g.nome && g.nome.trim() !== "",
    );

    const nomesVistos = new Set();
    for (const g of gastosValidos) {
      const chave = normalizarNomeGasto(g.nome);
      if (nomesVistos.has(chave)) {
        throw new Error(
          `Há mais de um gasto fixo chamado "${g.nome.trim()}". Dê um nome diferente pra cada um.`,
        );
      }
      nomesVistos.add(chave);
    }

    return gastosValidos;
  };

  const salvarGastosFixos = async (lojaId, gastosValidos) => {
    await api.post(`/gastos-fixos-loja/${lojaId}`, {
      gastos: gastosValidos.map((g) => ({
        nome: g.nome.trim(),
        valor: parseFloat(String(g.valor).replace(",", ".")) || 0,
        observacao: g.observacao,
        vigenciaInicio: g.vigenciaInicio ? `${g.vigenciaInicio}-01` : null,
        vigenciaFim: g.vigenciaFim ? `${g.vigenciaFim}-01` : null,
      })),
    });
  };

  // Só considera extintores com data de validade preenchida
  const extintoresValidos = () =>
    extintores.filter((ex) => ex.dataVencimento);

  const salvarExtintores = async (lojaId, extintoresValidosLista) => {
    await api.post(`/extintores-loja/${lojaId}`, {
      extintores: extintoresValidosLista.map((ex) => ({
        id: ex.id || undefined,
        identificacao: ex.identificacao?.trim() || null,
        numero: ex.numero?.trim() || null,
        dataVencimento: ex.dataVencimento,
      })),
    });
  };

  // Salva loja, gastos fixos e extintores e devolve o id da loja. Lança erro
  // se algo não passar na validação ou na API.
  const salvarLoja = async () => {
    if (!formData.nome || formData.nome.trim() === "") {
      throw new Error("Por favor, informe o nome da loja");
    }

    if (formData.semEstoque && !formData.estoqueLojaId) {
      throw new Error("Escolha de qual loja vem o estoque (loja sem estoque próprio)");
    }

    const gastosValidos = validarGastosFixos();

    const data = {
      nome: formData.nome.trim(),
      endereco: formData.endereco.trim(),
      cidade: formData.cidade.trim(),
      estado: formData.estado,
      cep: formData.cep?.trim() || null,
      telefone: formData.telefone.trim(),
      responsavel: formData.responsavel?.trim() || null,
      statusOperacao: formData.statusOperacao || "ATIVA",
      dataInicio: formData.dataInicio || null,
      observacoes: formData.observacoes?.trim() || null,
      // Loja nova do projeto: o shopping é o escolhido em "Dados do projeto"
      shoppingId: (embutido && shoppingIdProjeto !== undefined ? shoppingIdProjeto : formData.shoppingId) || null,
      tipo: embutido ? "LOJA" : formData.tipo || "LOJA",
      estoqueLojaId: formData.semEstoque ? formData.estoqueLojaId || null : null,
      dataFimContrato: formData.dataFimContrato || null,
      diasAvisoContrato: formData.diasAvisoContrato
        ? parseInt(formData.diasAvisoContrato, 10)
        : 60,
      valorFichaPadrao: parseDecimalInput(formData.valorFichaPadrao, 2.5),
      ativo: formData.statusOperacao
        ? formData.statusOperacao !== "INATIVA"
        : formData.ativo,
      ...(embutido ? { projetoEmImplantacao: true } : {}),
    };

    const extintoresValidosLista = extintoresValidos();

    if (isEdit) {
      await api.put(`/lojas/${id}`, data);
      await salvarGastosFixos(id, gastosValidos);
      await salvarExtintores(id, extintoresValidosLista);
      return id;
    }

    const response = await api.post("/lojas", data);
    const novaLojaId = response.data?.id;
    if (novaLojaId && gastosValidos.length > 0) {
      await salvarGastosFixos(novaLojaId, gastosValidos);
    }
    if (novaLojaId && extintoresValidosLista.length > 0) {
      await salvarExtintores(novaLojaId, extintoresValidosLista);
    }
    return novaLojaId;
  };

  useImperativeHandle(ref, () => ({ salvar: salvarLoja }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await salvarLoja();
      setSuccess(
        isEdit ? "Loja atualizada com sucesso!" : "Loja criada com sucesso!",
      );
      setTimeout(() => navigate("/visao-lojas"), 1500);
    } catch (error) {
      setError(
        error.response
          ? error.response.data?.error || "Erro ao salvar loja"
          : error.message || "Erro ao salvar loja",
      );
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return embutido ? (
      <p className="text-sm text-gray-500">Carregando dados da loja...</p>
    ) : (
      <PageLoader />
    );
  }

  // Embutido, quem envia é o formulário do projeto: aqui vira só um bloco
  const Container = embutido ? "div" : "form";
  const containerProps = embutido ? {} : { onSubmit: handleSubmit };

  return (
    <div
      className={
        embutido ? "" : "min-h-screen bg-background-light bg-pattern teddy-pattern"
      }
    >
      {!embutido && <Navbar />}

      <div
        className={embutido ? "" : "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}
      >
        {!embutido && (
          <PageHeader
            title={
              avulsa
                ? isEdit ? "Editar máquina avulsa" : "Nova máquina avulsa"
                : isEdit ? "Editar Loja" : "Nova Loja"
            }
            subtitle={
              avulsa
                ? "Máquina solta no shopping, sem loja: tem contrato, dinheiro e fechamento próprios"
                : isEdit
                  ? "Atualize as informações da loja"
                  : "Cadastre uma nova loja no sistema"
            }
            icon={avulsa ? "🎮" : "🏪"}
          />
        )}

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && <AlertBox type="success" message={success} />}

        <div className={embutido ? "" : "card-gradient"}>
          <Container {...containerProps} className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 12H9v-2h2v2zm0-4H9V7h2v3z" />
                </svg>
                Gastos Fixos
              </h3>

              {gastosFixos.length === 0 && (
                  <p className="text-sm text-gray-500 mb-3">
                    Nenhum gasto fixo cadastrado ainda.
                  </p>
                )}

                <div className="space-y-3">
                  {gastosFixos.map((gasto, idx) => {
                    const tipoVigencia = obterTipoVigencia(gasto);
                    return (
                      <div
                        key={gasto._key || idx}
                        className="bg-gray-50 rounded-lg p-4 flex flex-col gap-3"
                      >
                        <div className="flex flex-col md:flex-row gap-2 md:items-center">
                          <input
                            type="text"
                            className="input-field flex-1"
                            placeholder="Nome do gasto (ex: Aluguel)"
                            value={gasto.nome}
                            onChange={(e) =>
                              handleChangeGastoFixo(idx, "nome", e.target.value)
                            }
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9.,]*"
                            className="input-field md:w-32"
                            placeholder="Valor (R$)"
                            value={gasto.valor}
                            onChange={(e) =>
                              handleChangeGastoFixo(idx, "valor", e.target.value)
                            }
                          />
                          <input
                            type="text"
                            className="input-field flex-1"
                            placeholder="Observação (opcional)"
                            value={gasto.observacao}
                            onChange={(e) =>
                              handleChangeGastoFixo(
                                idx,
                                "observacao",
                                e.target.value,
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoverGastoFixo(idx)}
                            className="text-red-600 hover:text-red-800 font-semibold text-sm px-2 whitespace-nowrap"
                            title="Remover este gasto fixo"
                          >
                            Remover
                          </button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                          <select
                            className="input-field sm:w-56"
                            value={tipoVigencia}
                            onChange={(e) =>
                              handleChangeTipoVigencia(idx, e.target.value)
                            }
                          >
                            <option value="sempre">Sempre (todo mês)</option>
                            <option value="unico">
                              Só em um mês específico
                            </option>
                            <option value="apartir">
                              A partir de um mês (contínuo)
                            </option>
                          </select>

                          {tipoVigencia === "unico" && (
                            <input
                              type="month"
                              className="input-field sm:w-44"
                              value={gasto.vigenciaInicio}
                              onChange={(e) =>
                                handleChangeMesUnico(idx, e.target.value)
                              }
                            />
                          )}

                          {tipoVigencia === "apartir" && (
                            <input
                              type="month"
                              className="input-field sm:w-44"
                              value={gasto.vigenciaInicio}
                              onChange={(e) =>
                                handleChangeGastoFixo(
                                  idx,
                                  "vigenciaInicio",
                                  e.target.value,
                                )
                              }
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleAdicionarGastoFixo}
                  className="btn-secondary mt-3 text-sm"
                >
                  + Adicionar gasto fixo
                </button>
              </div>

            {/* Extintores */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-xl leading-none">🧯</span>
                Extintores
              </h3>

              {extintores.length === 0 && (
                <p className="text-sm text-gray-500 mb-3">
                  Nenhum extintor cadastrado ainda.
                </p>
              )}

              <div className="space-y-3">
                {extintores.map((extintor, idx) => (
                  <div
                    key={extintor._key || idx}
                    className="bg-gray-50 rounded-lg p-4 flex flex-col md:flex-row gap-2 md:items-center"
                  >
                    <input
                      type="text"
                      className="input-field flex-1"
                      placeholder="Identificação (ex: corredor, cozinha) — opcional"
                      value={extintor.identificacao}
                      onChange={(e) =>
                        handleChangeExtintor(idx, "identificacao", e.target.value)
                      }
                    />
                    <input
                      type="text"
                      className="input-field md:w-40"
                      placeholder="Nº do extintor — opcional"
                      value={extintor.numero}
                      onChange={(e) =>
                        handleChangeExtintor(idx, "numero", e.target.value)
                      }
                    />
                    <input
                      type="date"
                      className="input-field md:w-48"
                      value={extintor.dataVencimento}
                      onChange={(e) =>
                        handleChangeExtintor(idx, "dataVencimento", e.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoverExtintor(idx)}
                      className="text-red-600 hover:text-red-800 font-semibold text-sm px-2 whitespace-nowrap"
                      title="Remover este extintor"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAdicionarExtintor}
                className="btn-secondary mt-3 text-sm"
              >
                + Adicionar extintor
              </button>
            </div>

            {/* Informações Básicas */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                Informações Básicas
              </h3>

              {!embutido && (
                <div className="mb-4">
                  <p className="mb-2 text-sm font-semibold text-gray-700">Tipo *</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      ["LOJA", "🏪 Loja", "Loja com uma ou mais máquinas"],
                      ["AVULSA", "🎮 Máquina avulsa", "Uma máquina solta no shopping, sem loja"],
                    ].map(([valor, rotulo, ajuda]) => (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => setFormData((atual) => ({ ...atual, tipo: valor }))}
                        className={`rounded-lg border px-3 py-2 text-left transition ${
                          formData.tipo === valor
                            ? "border-primary bg-primary/10"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <span className={`block text-sm font-bold ${formData.tipo === valor ? "text-primary" : "text-gray-800"}`}>{rotulo}</span>
                        <span className="block text-xs text-gray-500">{ajuda}</span>
                      </button>
                    ))}
                  </div>
                  {avulsa && (
                    <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      Depois de salvar, coloque a máquina nela pelo cadastro da máquina ou por Transferir. A avulsa aceita uma máquina só.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {avulsa ? "Nome da máquina avulsa *" : "Nome da Loja *"}
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    className="input-field"
                    placeholder={avulsa ? "Ex: Avulsa M12 · Shopping Norte" : "Ex: Loja Shopping Center"}
                    required
                  />
                </div>

                {!(embutido && shoppingIdProjeto !== undefined) && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Shopping{avulsa ? " *" : ""}
                  </label>
                  <select
                    name="shoppingId"
                    value={formData.shoppingId || ""}
                    onChange={handleChange}
                    className="select-field"
                    required={avulsa}
                  >
                    <option value="">{avulsa ? "Escolha o shopping" : "Sem shopping (loja de rua)"}</option>
                    {shoppings.map((shopping) => (
                      <option key={shopping.id} value={shopping.id}>
                        {shopping.nome}
                      </option>
                    ))}
                  </select>
                </div>
                )}

                <div className="md:col-span-2">
                  <p className="block text-sm font-semibold text-gray-700 mb-2">
                    {avulsa ? "Tem estoque próprio?" : "A loja tem estoque próprio?"}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      [false, "📦 Sim, tem estoque próprio", "O abastecimento sai do estoque dela"],
                      [true, "🔗 Não, é sem estoque", "Usa o estoque de outra loja"],
                    ].map(([valor, rotulo, ajuda]) => (
                      <button
                        key={String(valor)}
                        type="button"
                        onClick={() =>
                          setFormData((atual) => ({
                            ...atual,
                            semEstoque: valor,
                            estoqueLojaId: valor ? atual.estoqueLojaId : "",
                          }))
                        }
                        className={`rounded-lg border px-3 py-2 text-left transition ${
                          formData.semEstoque === valor
                            ? "border-primary bg-primary/10"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <span className={`block text-sm font-bold ${formData.semEstoque === valor ? "text-primary" : "text-gray-800"}`}>{rotulo}</span>
                        <span className="block text-xs text-gray-500">{ajuda}</span>
                      </button>
                    ))}
                  </div>
                  {formData.semEstoque && (
                    <div className="mt-3">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Usa o estoque de qual loja? *
                      </label>
                      <select
                        name="estoqueLojaId"
                        value={formData.estoqueLojaId || ""}
                        onChange={handleChange}
                        className="select-field"
                        required
                      >
                        <option value="">Escolha a loja que tem o estoque</option>
                        {lojasEstoque
                          .filter((l) => l.id !== id)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.tipo === "AVULSA" ? "🎮 " : ""}{l.nome}
                            </option>
                          ))}
                      </select>
                      <span className="mt-1 block text-xs text-gray-500">
                        Na movimentação, o abastecimento sai do estoque dessa loja, e as telas de estoque mostram o estoque dela.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Responsável
                  </label>
                  <input
                    type="text"
                    name="responsavel"
                    value={formData.responsavel}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Nome do responsável"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Telefone *
                  </label>
                  <input
                    type="tel"
                    name="telefone"
                    value={formData.telefone}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Valor da Ficha (R$) *
                  </label>
                  <input
                    type="text"
                    name="valorFichaPadrao"
                    inputMode="decimal"
                    pattern="[0-9.,]*"
                    value={formData.valorFichaPadrao ?? ""}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: 2,50"
                    required
                  />
                </div>

                {!embutido && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Status da loja *
                    </label>
                    <select
                      name="statusOperacao"
                      value={formData.statusOperacao || "ATIVA"}
                      onChange={handleChange}
                      className="select-field"
                      required
                    >
                      <option value="ATIVA">Ativa / em operação</option>
                      <option value="EM_IMPLANTACAO">Em implantação</option>
                      <option value="INATIVA">Inativa / pausada</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data de início
                  </label>
                  <input
                    type="date"
                    name="dataInicio"
                    value={formData.dataInicio || ""}
                    onChange={handleChange}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Fim do contrato
                  </label>
                  <input
                    type="date"
                    name="dataFimContrato"
                    value={formData.dataFimContrato || ""}
                    onChange={handleChange}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Avisar com quantos dias de antecedência
                  </label>
                  <input
                    type="number"
                    min="1"
                    name="diasAvisoContrato"
                    value={formData.diasAvisoContrato}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="60"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Quantos dias antes do vencimento do contrato o sistema
                    deve mostrar o alerta. Padrão: 60 dias.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    name="observacoes"
                    value={formData.observacoes || ""}
                    onChange={handleChange}
                    className="input-field"
                    rows="3"
                    placeholder="Observações operacionais, combinados com a loja, restrições de acesso..."
                  />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                    clipRule="evenodd"
                  />
                </svg>
                Endereço
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Endereço Completo *
                  </label>
                  <input
                    type="text"
                    name="endereco"
                    value={formData.endereco}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Rua, número, complemento"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    name="cidade"
                    value={formData.cidade}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="São Paulo"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estado *
                  </label>
                  <select
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                    className="select-field"
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="AC">Acre</option>
                    <option value="AL">Alagoas</option>
                    <option value="AP">Amapá</option>
                    <option value="AM">Amazonas</option>
                    <option value="BA">Bahia</option>
                    <option value="CE">Ceará</option>
                    <option value="DF">Distrito Federal</option>
                    <option value="ES">Espírito Santo</option>
                    <option value="GO">Goiás</option>
                    <option value="MA">Maranhão</option>
                    <option value="MT">Mato Grosso</option>
                    <option value="MS">Mato Grosso do Sul</option>
                    <option value="MG">Minas Gerais</option>
                    <option value="PA">Pará</option>
                    <option value="PB">Paraíba</option>
                    <option value="PR">Paraná</option>
                    <option value="PE">Pernambuco</option>
                    <option value="PI">Piauí</option>
                    <option value="RJ">Rio de Janeiro</option>
                    <option value="RN">Rio Grande do Norte</option>
                    <option value="RS">Rio Grande do Sul</option>
                    <option value="RO">Rondônia</option>
                    <option value="RR">Roraima</option>
                    <option value="SC">Santa Catarina</option>
                    <option value="SP">São Paulo</option>
                    <option value="SE">Sergipe</option>
                    <option value="TO">Tocantins</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    CEP
                  </label>
                  <input
                    type="text"
                    name="cep"
                    value={formData.cep}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="00000-000"
                  />
                </div>
              </div>
            </div>

            {/* Documentos em PDF (contratos) */}
            {!embutido &&
              (isEdit ? (
                <div className="mt-6">
                  <DocumentosPdf
                    base={`/lojas/${id}`}
                    titulo={avulsa ? "📄 Contratos e documentos (PDF) da máquina avulsa" : "📄 Contratos e documentos (PDF)"}
                  />
                </div>
              ) : (
                <p className="mt-6 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  📄 Depois de salvar, abra Editar para anexar o PDF do contrato.
                </p>
              ))}

            {/* Botões */}
            {!embutido && (
              <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => navigate("/visao-lojas")}
                  className="btn-secondary"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (
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
                      {isEdit ? "Atualizar Loja" : "Criar Loja"}
                    </span>
                  )}
                </button>
              </div>
            )}
          </Container>
        </div>
      </div>

      {!embutido && <Footer />}
    </div>
  );
});
