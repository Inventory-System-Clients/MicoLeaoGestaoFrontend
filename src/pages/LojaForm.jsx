import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

export function LojaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

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
    dataVencimentoExtintor: "",
    dataFimContrato: "",
    diasAvisoContrato: "60",
    valorFichaPadrao: "2,50",
    ativo: true,
  });

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
  }, [isEdit]);
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
        dataVencimentoExtintor:
          response.data?.dataVencimentoExtintor ||
          response.data?.data_vencimento_extintor ||
          "",
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
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
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

  // Valida nomes duplicados e devolve só os gastos preenchidos. Retorna
  // null (e já seta o erro na tela) se achar nomes repetidos.
  const validarGastosFixos = () => {
    const gastosValidos = gastosFixos.filter(
      (g) => g.nome && g.nome.trim() !== "",
    );

    const nomesVistos = new Set();
    for (const g of gastosValidos) {
      const chave = normalizarNomeGasto(g.nome);
      if (nomesVistos.has(chave)) {
        setError(
          `Há mais de um gasto fixo chamado "${g.nome.trim()}". Dê um nome diferente pra cada um.`,
        );
        return null;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Validação
      if (!formData.nome || formData.nome.trim() === "") {
        setError("Por favor, informe o nome da loja");
        setLoading(false);
        return;
      }

      const gastosValidos = validarGastosFixos();
      if (gastosValidos === null) {
        setLoading(false);
        return;
      }

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
        dataVencimentoExtintor: formData.dataVencimentoExtintor || null,
        dataFimContrato: formData.dataFimContrato || null,
        diasAvisoContrato: formData.diasAvisoContrato
          ? parseInt(formData.diasAvisoContrato, 10)
          : 60,
        valorFichaPadrao: parseDecimalInput(formData.valorFichaPadrao, 2.5),
        ativo: formData.statusOperacao
          ? formData.statusOperacao !== "INATIVA"
          : formData.ativo,
      };

      if (isEdit) {
        await api.put(`/lojas/${id}`, data);
        await salvarGastosFixos(id, gastosValidos);
        setSuccess("Loja atualizada com sucesso!");
      } else {
        const response = await api.post("/lojas", data);
        const novaLojaId = response.data?.id;
        if (novaLojaId && gastosValidos.length > 0) {
          await salvarGastosFixos(novaLojaId, gastosValidos);
        }
        setSuccess("Loja criada com sucesso!");
      }

      setTimeout(() => navigate("/lojas"), 1500);
    } catch (error) {
      setError(error.response?.data?.error || "Erro ao salvar loja");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={isEdit ? "Editar Loja" : "Nova Loja"}
          subtitle={
            isEdit
              ? "Atualize as informações da loja"
              : "Cadastre uma nova loja no sistema"
          }
          icon="🏪"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && <AlertBox type="success" message={success} />}

        <div className="card-gradient">
          <form onSubmit={handleSubmit} className="space-y-6">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome da Loja *
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: Loja Shopping Center"
                    required
                  />
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
                    Vencimento do extintor
                  </label>
                  <input
                    type="date"
                    name="dataVencimentoExtintor"
                    value={formData.dataVencimentoExtintor || ""}
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

            {/* Botões */}
            <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate("/lojas")}
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
          </form>
        </div>
      </div>

      <Footer />
    </div>
  );
}
