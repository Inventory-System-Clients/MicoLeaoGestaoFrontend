import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox, Badge } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { filtrarLojasOperacionais } from "../utils/lojas";
import { enviarImagemParaCloudinary } from "../utils/cloudinary";
import { confirmar } from "../utils/alerts";
import { LojaForm } from "./LojaForm";
import { SelectBusca } from "../components/SelectBusca";

const CATEGORIAS_SUGERIDAS = [
  "Totem / Terminais de Pagamento",
  "Estoque Inicial de Pelúcias",
  "Obras, Letreiro e Cenografia",
  "Infraestrutura Elétrica e Rede",
  "Segurança (CFTV)",
  "CDU / Luvas (Shopping)",
  "Projetos, ART e Laudos",
];

const MAX_FOTOS = 7;

// Loja nova do projeto: já existe no banco, mas escondida até concluir
const ehLojaNovaDoProjeto = (loja) =>
  loja?.statusOperacao === "EM_IMPLANTACAO" && loja?.ativo === false;

const parseMoney = (value) => {
  if (value === "" || value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

let contadorLinha = 0;
const novaChave = () => `nova-${Date.now()}-${contadorLinha++}`;

const criarMaquinaVazia = () => ({
  _key: novaChave(),
  maquinaId: "",
  nome: "",
  tipo: "",
  quantidade: "1",
  custoUnitario: "",
  observacao: "",
});

const criarCustoVazio = () => ({
  _key: novaChave(),
  categoria: "",
  descricao: "",
  valor: "",
});

export function ProjetoLojaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const formRef = useRef(null);
  const lojaNovaRef = useRef(null);

  const [lojas, setLojas] = useState([]);
  const [maquinasCatalogo, setMaquinasCatalogo] = useState([]);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [nome, setNome] = useState("");
  // "" = ainda não escolheu | EXISTENTE | NOVA
  const [tipoLoja, setTipoLoja] = useState("");
  const [lojaId, setLojaId] = useState("");
  const [nomeLojaVinculada, setNomeLojaVinculada] = useState("");
  const [status, setStatus] = useState("PLANEJAMENTO");
  const [dataPrevisaoAbertura, setDataPrevisaoAbertura] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [maquinas, setMaquinas] = useState([]);
  // Máquinas que já estavam no projeto ao abrir (podem não estar mais no
  // depósito se o projeto já foi concluído)
  const [maquinasDoProjeto, setMaquinasDoProjeto] = useState([]);
  // Registro gravado no projeto: máquinas que estão na loja (origem LOJA) e
  // o histórico de entradas/saídas. Congela quando o projeto é concluído.
  const [maquinasGravadasDaLoja, setMaquinasGravadasDaLoja] = useState([]);
  const [historicoMaquinas, setHistoricoMaquinas] = useState([]);
  const [lojaIdSalvo, setLojaIdSalvo] = useState("");
  const [custos, setCustos] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [enviandoFotos, setEnviandoFotos] = useState(false);

  const concluido = status === "CONCLUIDO";
  // Depois que a loja nova foi gravada não dá mais pra trocar o tipo
  const podeTrocarTipoLoja = !concluido && !(tipoLoja === "NOVA" && lojaId);

  useEffect(() => {
    const carregarBase = async () => {
      try {
        const [lojasRes, maquinasRes] = await Promise.all([
          api.get("/lojas"),
          api.get("/maquinas"),
        ]);
        setLojas(filtrarLojasOperacionais(lojasRes.data || []));
        setMaquinasCatalogo(maquinasRes.data || []);
      } catch (err) {
        console.error("Erro ao carregar lojas/máquinas:", err);
      }
    };
    carregarBase();
  }, []);

  const aplicarRegistroDeMaquinas = (projeto) => {
    setLojaIdSalvo(projeto.lojaId || "");
    setMaquinasGravadasDaLoja(
      (projeto.maquinas || []).filter((item) => item.origem === "LOJA"),
    );
    setHistoricoMaquinas(projeto.historicoMaquinas || []);
  };

  // Ao voltar pra aba, busca de novo: se alguém transferiu uma máquina com o
  // projeto aberto, a entrada/saída já aparece gravada aqui.
  useEffect(() => {
    const recarregar = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const maquinasRes = await api.get("/maquinas");
        setMaquinasCatalogo(maquinasRes.data || []);
        if (isEdit) {
          const projetoRes = await api.get(`/projetos-loja/${id}`);
          aplicarRegistroDeMaquinas(projetoRes.data);
        }
      } catch (err) {
        console.error("Erro ao recarregar máquinas:", err);
      }
    };
    document.addEventListener("visibilitychange", recarregar);
    return () => document.removeEventListener("visibilitychange", recarregar);
  }, [id, isEdit]);

  useEffect(() => {
    if (!isEdit) return;

    const carregarProjeto = async () => {
      try {
        setLoadingData(true);
        const response = await api.get(`/projetos-loja/${id}`);
        const projeto = response.data;

        setNome(projeto.nome || "");
        setLojaId(projeto.lojaId || "");
        setNomeLojaVinculada(projeto.loja?.nome || "");
        setTipoLoja(
          projeto.lojaId
            ? ehLojaNovaDoProjeto(projeto.loja)
              ? "NOVA"
              : "EXISTENTE"
            : projeto.status === "CONCLUIDO"
              ? "EXISTENTE"
              : "",
        );
        setStatus(projeto.status || "PLANEJAMENTO");
        setDataPrevisaoAbertura(
          projeto.dataPrevisaoAbertura
            ? String(projeto.dataPrevisaoAbertura).slice(0, 10)
            : "",
        );
        setObservacoes(projeto.observacoes || "");

        aplicarRegistroDeMaquinas(projeto);

        // Só as reservas (adicionadas à mão) são editáveis
        setMaquinas(
          (projeto.maquinas || []).filter((item) => item.origem !== "LOJA").map((item) => ({
            _key: `db-${item.id}`,
            maquinaId: item.maquinaId || "",
            nome: item.nome || "",
            tipo: item.tipo || "",
            quantidade: String(item.quantidade ?? 1),
            custoUnitario: String(item.custoUnitario ?? ""),
            observacao: item.observacao || "",
          })),
        );
        setMaquinasDoProjeto(
          (projeto.maquinas || []).map((item) => item.maquina).filter(Boolean),
        );

        setCustos(
          (projeto.custos || []).map((item) => ({
            _key: `db-${item.id}`,
            categoria: item.categoria || "",
            descricao: item.descricao || "",
            valor: String(item.valor ?? ""),
          })),
        );

        setFotos((projeto.midias || []).map((item) => item.url));
      } catch (err) {
        setError(
          "Erro ao carregar projeto: " +
            (err.response?.data?.error || err.message),
        );
      } finally {
        setLoadingData(false);
      }
    };

    carregarProjeto();
  }, [id, isEdit]);

  // Só máquinas do depósito (sem loja) + as que já estão no projeto
  const opcoesMaquinas = useMemo(() => {
    const doDeposito = maquinasCatalogo.filter(
      (m) => !m.lojaId && m.ativo !== false,
    );
    const extras = maquinasDoProjeto.filter(
      (m) => !doDeposito.some((d) => d.id === m.id),
    );
    return [...doDeposito, ...extras];
  }, [maquinasCatalogo, maquinasDoProjeto]);

  const handleEscolherTipoLoja = (tipo) => {
    setTipoLoja(tipo);
    setLojaId("");
    setNomeLojaVinculada("");
  };

  const handleChangeMaquina = (idx, field, value) => {
    setMaquinas((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;

        if (field === "maquinaId") {
          if (!value) {
            return { ...item, maquinaId: "" };
          }
          const maquina = opcoesMaquinas.find((m) => m.id === value);
          return {
            ...item,
            maquinaId: value,
            nome: maquina?.nome || item.nome,
            custoUnitario:
              maquina?.custoAquisicao !== null &&
              maquina?.custoAquisicao !== undefined
                ? String(maquina.custoAquisicao)
                : item.custoUnitario,
            tipo: "",
            quantidade: "1",
          };
        }

        if (field === "quantidade") {
          return { ...item, quantidade: value.replace(/\D/g, "") };
        }

        if (field === "custoUnitario") {
          return { ...item, custoUnitario: value.replace(/[^0-9.,]/g, "") };
        }

        return { ...item, [field]: value };
      }),
    );
  };

  const handleAdicionarMaquina = () => {
    setMaquinas((prev) => [...prev, criarMaquinaVazia()]);
  };

  const handleRemoverMaquina = (idx) => {
    setMaquinas((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleChangeCusto = (idx, field, value) => {
    setCustos((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              [field]:
                field === "valor" ? value.replace(/[^0-9.,]/g, "") : value,
            }
          : item,
      ),
    );
  };

  const handleAdicionarCusto = () => {
    setCustos((prev) => [...prev, criarCustoVazio()]);
  };

  const handleRemoverCusto = (idx) => {
    setCustos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSelecionarFotos = async (e) => {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = "";
    if (arquivos.length === 0) return;

    const espaco = MAX_FOTOS - fotos.length;
    if (espaco <= 0) {
      setError(`O projeto aceita no máximo ${MAX_FOTOS} fotos.`);
      return;
    }
    if (arquivos.length > espaco) {
      setError(
        `Só cabem mais ${espaco} foto(s) — as outras foram ignoradas (máximo ${MAX_FOTOS}).`,
      );
    }

    setEnviandoFotos(true);
    try {
      for (const arquivo of arquivos.slice(0, espaco)) {
        const url = await enviarImagemParaCloudinary(arquivo);
        setFotos((prev) => [...prev, url].slice(0, MAX_FOTOS));
      }
    } catch {
      setError("Não foi possível enviar a foto. Tente novamente.");
    } finally {
      setEnviandoFotos(false);
    }
  };

  const handleRemoverFoto = (idx) => {
    setFotos((prev) => prev.filter((_, i) => i !== idx));
  };

  // Máquinas da loja: as gravadas no projeto; se a loja ainda não foi salva
  // (projeto novo ou loja trocada), mostra uma prévia do que será gravado.
  const previaDaLoja = !(isEdit && lojaId === lojaIdSalvo);
  const maquinasDaLoja = useMemo(() => {
    if (tipoLoja !== "EXISTENTE" || !lojaId) return [];
    if (!previaDaLoja) {
      return maquinasGravadasDaLoja.map((item) => ({
        id: item.maquinaId,
        codigo: item.maquina?.codigo,
        nome: item.maquina?.nome || item.nome,
        custoUnitario: Number(item.custoUnitario || 0),
      }));
    }
    return maquinasCatalogo
      .filter((m) => m.lojaId === lojaId)
      .map((m) => ({ ...m, custoUnitario: Number(m.custoAquisicao || 0) }));
  }, [tipoLoja, lojaId, previaDaLoja, maquinasGravadasDaLoja, maquinasCatalogo]);

  const idsMaquinasDaLoja = useMemo(
    () => new Set(maquinasDaLoja.map((m) => m.id)),
    [maquinasDaLoja],
  );

  const subtotalMaquina = (item) => {
    const quantidade = item.maquinaId ? 1 : Math.max(1, parseInt(item.quantidade, 10) || 1);
    return quantidade * parseMoney(item.custoUnitario);
  };

  const totalMaquinas = useMemo(
    () =>
      maquinasDaLoja.reduce((acc, m) => acc + m.custoUnitario, 0) +
      maquinas
        .filter((item) => !idsMaquinasDaLoja.has(item.maquinaId))
        .reduce((acc, item) => acc + subtotalMaquina(item), 0),
    [maquinas, maquinasDaLoja, idsMaquinasDaLoja],
  );

  const totalCustos = useMemo(
    () => custos.reduce((acc, item) => acc + parseMoney(item.valor), 0),
    [custos],
  );

  const totalGeral = totalMaquinas + totalCustos;

  // Grava a loja nova (se for o caso) e o projeto. Devolve o id do projeto.
  const salvarProjeto = async () => {
    if (!nome.trim()) {
      throw new Error("Informe o nome do projeto.");
    }
    if (!tipoLoja) {
      throw new Error("Escolha se é uma loja existente ou uma loja nova.");
    }

    let lojaIdFinal = lojaId || null;
    if (tipoLoja === "NOVA" && !concluido) {
      lojaIdFinal = await lojaNovaRef.current.salvar();
      setLojaId(lojaIdFinal || "");
    }

    const maquinasValidas = maquinas.filter((item) => item.nome.trim());
    const custosValidos = custos.filter((item) => item.categoria.trim());

    const payload = {
      nome: nome.trim(),
      lojaId: lojaIdFinal,
      status,
      dataPrevisaoAbertura: dataPrevisaoAbertura || null,
      observacoes: observacoes.trim() || null,
      maquinas: maquinasValidas.map((item) => ({
        maquinaId: item.maquinaId || null,
        nome: item.nome.trim(),
        tipo: item.tipo?.trim() || null,
        quantidade: item.maquinaId ? 1 : parseInt(item.quantidade, 10) || 1,
        custoUnitario: parseMoney(item.custoUnitario),
        observacao: item.observacao?.trim() || null,
      })),
      custos: custosValidos.map((item) => ({
        categoria: item.categoria.trim(),
        descricao: item.descricao?.trim() || null,
        valor: parseMoney(item.valor),
      })),
      midias: fotos,
    };

    if (isEdit) {
      await api.put(`/projetos-loja/${id}`, payload);
      return id;
    }
    const response = await api.post("/projetos-loja", payload);
    return response.data?.id;
  };

  const mensagemDeErro = (err, padrao) =>
    err.response ? err.response.data?.error || padrao : err.message || padrao;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      setLoading(true);
      await salvarProjeto();
      setSuccess(
        isEdit ? "Projeto atualizado com sucesso!" : "Projeto criado com sucesso!",
      );
      setTimeout(() => navigate("/projetos-loja"), 1200);
    } catch (err) {
      setError(mensagemDeErro(err, "Não foi possível salvar o projeto."));
    } finally {
      setLoading(false);
    }
  };

  const handleConcluir = async () => {
    setError("");
    setSuccess("");
    if (!formRef.current?.reportValidity()) return;

    const qtdMaquinas = maquinas.filter((item) => item.maquinaId).length;
    const confirmado = await confirmar({
      title: "Marcar o projeto como concluído?",
      text:
        (tipoLoja === "NOVA"
          ? "A loja nova vira uma loja real (ativa) e passa a aparecer em lojas, alertas e relatórios."
          : "O projeto será encerrado.") +
        (qtdMaquinas > 0
          ? ` ${qtdMaquinas} máquina(s) saem do depósito e vão para a loja.`
          : "") +
        " Isso não pode ser desfeito por aqui.",
      confirmButtonText: "Concluir",
    });
    if (!confirmado) return;

    try {
      setLoading(true);
      const projetoId = await salvarProjeto();
      await api.post(`/projetos-loja/${projetoId}/concluir`);
      setStatus("CONCLUIDO");
      setSuccess("Projeto concluído! A loja já está ativa.");
      setTimeout(() => navigate("/projetos-loja"), 1500);
    } catch (err) {
      setError(mensagemDeErro(err, "Não foi possível concluir o projeto."));
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={isEdit ? "Editar Projeto de Loja" : "Novo Projeto de Loja"}
          subtitle="Planeje a loja, as máquinas e os custos de abertura"
          icon="🏗️"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && <AlertBox type="success" message={success} />}

        {/* Passo 1: loja existente ou nova */}
        {!tipoLoja && (
          <div className="card space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              Esse projeto é de uma loja que já existe ou de uma loja nova?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleEscolherTipoLoja("EXISTENTE")}
                className="rounded-lg border-2 border-gray-200 p-6 text-left hover:border-primary hover:bg-orange-50 transition"
              >
                <span className="block text-2xl">🏪</span>
                <span className="block font-bold text-gray-900 mt-2">
                  Loja existente
                </span>
                <span className="block text-sm text-gray-500">
                  Escolher uma loja já cadastrada
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleEscolherTipoLoja("NOVA")}
                className="rounded-lg border-2 border-gray-200 p-6 text-left hover:border-primary hover:bg-orange-50 transition"
              >
                <span className="block text-2xl">🆕</span>
                <span className="block font-bold text-gray-900 mt-2">
                  Loja nova
                </span>
                <span className="block text-sm text-gray-500">
                  Fazer o cadastro da loja aqui no projeto. Ela só vira loja de
                  verdade quando o projeto for concluído.
                </span>
              </button>
            </div>
          </div>
        )}

        {tipoLoja && (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {/* Dados do projeto */}
            <div className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-gray-900">
                  Dados do projeto
                </h3>
                {concluido && <Badge variant="success">Concluído</Badge>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-bold text-gray-700">
                    Nome do projeto
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ex: Shopping Iguatemi — Unidade Nova"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>

                {!concluido && (
                  <div>
                    <label className="mb-1 block text-sm font-bold text-gray-700">
                      Status
                    </label>
                    <select
                      className="select-field"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="PLANEJAMENTO">Planejamento</option>
                      <option value="EM_ANDAMENTO">Em andamento</option>
                      <option value="CANCELADO">Cancelado</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-bold text-gray-700">
                    Previsão de abertura (opcional)
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={dataPrevisaoAbertura}
                    onChange={(e) => setDataPrevisaoAbertura(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-bold text-gray-700">
                    Observações
                  </label>
                  <textarea
                    className="input-field"
                    rows={3}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Loja do projeto */}
            <div className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-gray-900">
                  {tipoLoja === "NOVA" && !concluido
                    ? "🆕 Cadastro da loja nova"
                    : "🏪 Loja"}
                </h3>
                {podeTrocarTipoLoja && (
                  <button
                    type="button"
                    onClick={() =>
                      handleEscolherTipoLoja(
                        tipoLoja === "NOVA" ? "EXISTENTE" : "NOVA",
                      )
                    }
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                  >
                    {tipoLoja === "NOVA"
                      ? "Trocar para loja existente"
                      : "Trocar para loja nova"}
                  </button>
                )}
              </div>

              {concluido && (
                <p className="text-sm text-gray-700">
                  {lojaId ? (
                    <>
                      Loja:{" "}
                      <Link
                        to={`/lojas/${lojaId}`}
                        className="font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {nomeLojaVinculada || "ver loja"}
                      </Link>
                    </>
                  ) : (
                    "Sem loja vinculada."
                  )}
                </p>
              )}

              {!concluido && tipoLoja === "EXISTENTE" && (
                <SelectBusca
                  opcoes={lojas.map((loja) => ({ valor: loja.id, rotulo: loja.nome ?? "" }))}
                  valor={lojaId}
                  aoMudar={(valorEscolhido) => setLojaId(valorEscolhido)}
                  opcaoVazia="Selecione a loja..."
                  placeholder="Selecione a loja..."
                  required
                />
              )}

              {!concluido && tipoLoja === "NOVA" && (
                <>
                  <p className="text-xs text-gray-500">
                    A loja fica <strong>em implantação</strong>: dá pra
                    cadastrar tudo (gastos fixos, extintores, contrato), mas
                    ela não aparece em lojas, alertas nem relatórios até o
                    projeto ser concluído.
                  </p>
                  <LojaForm
                    ref={lojaNovaRef}
                    embutido
                    lojaIdEmbutido={lojaId || null}
                  />
                </>
              )}
            </div>

            {/* Fotos */}
            <div className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-gray-900">
                  📷 Fotos do projeto
                </h3>
                <span className="text-sm font-semibold text-gray-500">
                  {fotos.length}/{MAX_FOTOS}
                </span>
              </div>

              {fotos.length === 0 && (
                <p className="text-sm text-gray-500">
                  Nenhuma foto adicionada ainda.
                </p>
              )}

              {fotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {fotos.map((url, idx) => (
                    <div
                      key={url}
                      className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
                    >
                      <a href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt={`Foto ${idx + 1} do projeto`}
                          className="w-full h-32 object-cover"
                        />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoverFoto(idx)}
                        className="absolute top-1 right-1 rounded bg-white/90 px-2 py-0.5 text-xs font-semibold text-red-600 hover:text-red-800"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {fotos.length < MAX_FOTOS && (
                <label className="btn-secondary text-sm inline-block cursor-pointer">
                  {enviandoFotos ? "Enviando..." : "+ Adicionar fotos"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleSelecionarFotos}
                    disabled={enviandoFotos}
                  />
                </label>
              )}
            </div>

            {/* Máquinas do projeto */}
            <fieldset disabled={concluido} className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-gray-900">
                  🎮 Máquinas do projeto
                </h3>
                {!concluido && (
                  <button
                    type="button"
                    onClick={handleAdicionarMaquina}
                    className="btn-secondary text-sm"
                  >
                    + Adicionar máquina
                  </button>
                )}
              </div>

              {tipoLoja === "EXISTENTE" && lojaId && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-gray-700">
                    {concluido
                      ? "Máquinas da loja na conclusão do projeto"
                      : "Máquinas que estão na loja"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {concluido
                      ? "Registro congelado na conclusão."
                      : previaDaLoja
                        ? "Prévia: estas máquinas serão registradas no projeto ao salvar."
                        : "Registradas no projeto e atualizadas sozinhas: se uma máquina entrar ou sair da loja, fica anotado no histórico abaixo."}
                  </p>
                  {maquinasDaLoja.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Nenhuma máquina nesta loja.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-200 rounded-lg bg-gray-50">
                      {maquinasDaLoja.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
                        >
                          <span className="font-semibold text-gray-800">
                            {m.codigo ? `${m.codigo} — ` : ""}
                            {m.nome}
                          </span>
                          <span className="text-gray-600">
                            R$ {formatCurrency(m.custoUnitario)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {tipoLoja === "EXISTENTE" && lojaId && (
                <p className="text-sm font-bold text-gray-700 pt-2">
                  Máquinas a levar pra loja
                </p>
              )}

              <p className="text-xs text-gray-500">
                {concluido
                  ? "Projeto concluído: as máquinas do depósito já foram para a loja."
                  : "Só aparecem máquinas que estão no depósito (sem loja). Quando o projeto for concluído, elas vão automaticamente para a loja."}
              </p>

              {maquinas.length === 0 && (
                <p className="text-sm text-gray-500">
                  Nenhuma máquina adicionada ainda.
                </p>
              )}

              <div className="space-y-3">
                {maquinas.map((item, idx) => (
                  <div
                    key={item._key}
                    className="bg-gray-50 rounded-lg p-4 flex flex-col gap-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        className="select-field"
                        value={item.maquinaId}
                        onChange={(e) =>
                          handleChangeMaquina(idx, "maquinaId", e.target.value)
                        }
                      >
                        <option value="">🆕 Máquina a comprar (digitar)</option>
                        {opcoesMaquinas.map((maquina) => (
                          <option key={maquina.id} value={maquina.id}>
                            {maquina.codigo ? `${maquina.codigo} — ` : ""}
                            {maquina.nome}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        className="input-field"
                        placeholder="Nome de exibição"
                        value={item.nome}
                        onChange={(e) =>
                          handleChangeMaquina(idx, "nome", e.target.value)
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                      {!item.maquinaId && (
                        <>
                          <div>
                            <label className="mb-1 block text-xs font-bold text-gray-600">
                              Tipo
                            </label>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="Ex: Agarra Mais"
                              value={item.tipo}
                              onChange={(e) =>
                                handleChangeMaquina(idx, "tipo", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold text-gray-600">
                              Quantidade
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="input-field"
                              value={item.quantidade}
                              onChange={(e) =>
                                handleChangeMaquina(
                                  idx,
                                  "quantidade",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                        </>
                      )}
                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-600">
                          Custo unitário (R$)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="input-field"
                          placeholder="0,00"
                          value={item.custoUnitario}
                          onChange={(e) =>
                            handleChangeMaquina(
                              idx,
                              "custoUnitario",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-600">
                          Subtotal
                        </label>
                        <p className="input-field bg-white font-semibold text-gray-700">
                          R$ {formatCurrency(subtotalMaquina(item))}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="input-field flex-1"
                        placeholder="Observação (opcional)"
                        value={item.observacao}
                        onChange={(e) =>
                          handleChangeMaquina(idx, "observacao", e.target.value)
                        }
                      />
                      {!concluido && (
                        <button
                          type="button"
                          onClick={() => handleRemoverMaquina(idx)}
                          className="text-red-600 hover:text-red-800 font-semibold text-sm px-2 whitespace-nowrap"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-right text-sm font-bold text-gray-700">
                Subtotal máquinas: R$ {formatCurrency(totalMaquinas)}
              </p>
            </fieldset>

            {/* Histórico de máquinas do projeto */}
            {isEdit && (
              <div className="card space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  📋 Histórico de máquinas
                </h3>
                {historicoMaquinas.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhuma movimentação registrada ainda.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-200 rounded-lg bg-gray-50 text-sm">
                    {historicoMaquinas.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <span className="w-24 shrink-0 text-gray-500">
                          {String(item.data || "").split("-").reverse().join("/")}
                        </span>
                        <span className="w-20 shrink-0">
                          {item.tipo === "ENTRADA" && (
                            <Badge variant="success">Entrou</Badge>
                          )}
                          {item.tipo === "SAIDA" && (
                            <Badge variant="danger">Saiu</Badge>
                          )}
                          {item.tipo === "INFO" && (
                            <Badge variant="info">Info</Badge>
                          )}
                        </span>
                        <span className="flex-1 text-gray-800">
                          {item.maquinaNome && (
                            <strong className="mr-1">{item.maquinaNome}:</strong>
                          )}
                          {item.detalhe}
                        </span>
                        {item.usuario?.nome && (
                          <span className="text-xs text-gray-500">
                            {item.usuario.nome}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Outros custos do projeto */}
            <div className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-gray-900">
                  💰 Outros custos do projeto
                </h3>
                <button
                  type="button"
                  onClick={handleAdicionarCusto}
                  className="btn-secondary text-sm"
                >
                  + Adicionar custo
                </button>
              </div>

              {custos.length === 0 && (
                <p className="text-sm text-gray-500">
                  Nenhum custo adicionado ainda.
                </p>
              )}

              <div className="space-y-3">
                {custos.map((item, idx) => (
                  <div
                    key={item._key}
                    className="bg-gray-50 rounded-lg p-4 flex flex-col md:flex-row gap-2 md:items-center"
                  >
                    <input
                      type="text"
                      list="categorias-sugeridas"
                      className="input-field flex-1"
                      placeholder="Categoria (ex: Obras, Letreiro e Cenografia)"
                      value={item.categoria}
                      onChange={(e) =>
                        handleChangeCusto(idx, "categoria", e.target.value)
                      }
                    />
                    <input
                      type="text"
                      className="input-field flex-1"
                      placeholder="Descrição / detalhes (opcional)"
                      value={item.descricao}
                      onChange={(e) =>
                        handleChangeCusto(idx, "descricao", e.target.value)
                      }
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input-field md:w-36"
                      placeholder="Valor (R$)"
                      value={item.valor}
                      onChange={(e) =>
                        handleChangeCusto(idx, "valor", e.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoverCusto(idx)}
                      className="text-red-600 hover:text-red-800 font-semibold text-sm px-2 whitespace-nowrap"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>

              <datalist id="categorias-sugeridas">
                {CATEGORIAS_SUGERIDAS.map((categoria) => (
                  <option key={categoria} value={categoria} />
                ))}
              </datalist>

              <p className="text-right text-sm font-bold text-gray-700">
                Subtotal outros custos: R$ {formatCurrency(totalCustos)}
              </p>
            </div>

            {/* Total geral */}
            <div className="card bg-gradient-to-br from-orange-500 to-red-600 text-white flex items-center justify-between">
              <span className="text-lg font-bold">Total investido no projeto</span>
              <span className="text-3xl font-black">
                R$ {formatCurrency(totalGeral)}
              </span>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Link to="/projetos-loja" className="btn-secondary">
                Cancelar
              </Link>
              {!concluido && status !== "CANCELADO" && (
                <button
                  type="button"
                  onClick={handleConcluir}
                  className="btn-secondary border-green-600 text-green-700"
                  disabled={loading || enviandoFotos}
                >
                  ✅ Marcar como concluída
                </button>
              )}
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || enviandoFotos}
              >
                {loading ? "Salvando..." : "Salvar projeto"}
              </button>
            </div>
          </form>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default ProjetoLojaForm;
