import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

const ordenarRoteiro = (roteiro) => ({
  ...roteiro,
  itens: [...(roteiro.itens || [])].sort((a, b) => a.ordem - b.ordem),
});

const formularioMovimentacaoInicial = {
  produtoId: "",
  quantidadeAtualMaquina: "",
  quantidadeAdicionada: "",
  fichas: "",
  contadorIn: "",
  contadorOut: "",
  quantidadeNotasEntrada: "",
  valorEntradaPix: "",
  retiradaProduto: "",
  retiradaProdutoDevolverEstoque: false,
  ignoreInOut: false,
  observacao: "",
};

const numeroInteiroValido = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return null;
  const numero = Number.parseInt(valor, 10);
  return Number.isNaN(numero) ? null : numero;
};

const numeroAnteriorValido = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return null;
  const numero = Number.parseInt(valor, 10);
  return Number.isNaN(numero) ? null : numero;
};

const calcularSugestaoPorContadores = (form, ultimaMovimentacao, maquina) => {
  if (!ultimaMovimentacao || form.ignoreInOut) {
    return { patch: {}, erro: "" };
  }

  const contadorInAtual = numeroInteiroValido(form.contadorIn);
  const contadorOutAtual = numeroInteiroValido(form.contadorOut);
  if (contadorInAtual === null && contadorOutAtual === null) {
    return { patch: {}, erro: "" };
  }

  const contadorInAnterior = numeroAnteriorValido(
    ultimaMovimentacao.ultimoContadorIn ?? ultimaMovimentacao.contadorIn,
  );
  const contadorOutAnterior = numeroAnteriorValido(
    ultimaMovimentacao.ultimoContadorOut ?? ultimaMovimentacao.contadorOut,
  );
  const totalPosAnterior = numeroAnteriorValido(ultimaMovimentacao.totalPos);
  const capacidadePadrao = Number(
    maquina?.capacidadePadrao || maquina?.capacidade || 0,
  );

  const saidaCalculada =
    contadorOutAtual === null || contadorOutAnterior === null
      ? null
      : contadorOutAtual - contadorOutAnterior;
  const fichasCalculadas =
    contadorInAtual === null || contadorInAnterior === null
      ? null
      : contadorInAtual - contadorInAnterior;

  if (
    (saidaCalculada !== null && saidaCalculada < 0) ||
    (fichasCalculadas !== null && fichasCalculadas < 0)
  ) {
    return {
      patch: {},
      erro: "O contador informado esta menor que o contador anterior.",
    };
  }

  const totalPreEsperado =
    saidaCalculada === null || totalPosAnterior === null
      ? null
      : Math.max(0, totalPosAnterior - saidaCalculada);
  const abastecimentoSugerido =
    totalPreEsperado === null || capacidadePadrao <= 0
      ? null
      : Math.max(0, capacidadePadrao - totalPreEsperado);

  const patch = {};
  if (totalPreEsperado !== null) {
    patch.quantidadeAtualMaquina = String(totalPreEsperado);
  }
  if (abastecimentoSugerido !== null) {
    patch.quantidadeAdicionada = String(abastecimentoSugerido);
  }
  if (fichasCalculadas !== null) {
    patch.fichas = String(fichasCalculadas);
  }

  const semBaseOut = contadorOutAtual !== null && contadorOutAnterior === null;
  const semBaseIn = contadorInAtual !== null && contadorInAnterior === null;

  return {
    patch,
    erro:
      semBaseOut || semBaseIn
        ? "Nao encontrei contador anterior salvo para calcular automaticamente."
        : "",
  };
};

export function RoteiroExecucao() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [roteiro, setRoteiro] = useState(null);
  const [maquinas, setMaquinas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [itemSelecionadoId, setItemSelecionadoId] = useState(
    searchParams.get("itemId") || "",
  );
  const [modalMovimentacao, setModalMovimentacao] = useState(null);
  const [formMovimentacao, setFormMovimentacao] = useState(
    formularioMovimentacaoInicial,
  );
  const [ultimaMovimentacao, setUltimaMovimentacao] = useState(null);
  const [salvandoMovimentacao, setSalvandoMovimentacao] = useState(false);
  const [avisoCalculoContadores, setAvisoCalculoContadores] = useState("");
  const [error, setError] = useState("");

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [roteirosRes, maquinasRes, produtosRes] = await Promise.all([
        api.get("/roteiros"),
        api.get("/maquinas"),
        api.get("/produtos"),
      ]);
      const encontrado = (roteirosRes.data || []).find(
        (item) => String(item.id) === String(id),
      );
      setRoteiro(encontrado ? ordenarRoteiro(encontrado) : null);
      setMaquinas(maquinasRes.data || []);
      setProdutos(produtosRes.data || []);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar roteiro.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (
      !modalMovimentacao ||
      !ultimaMovimentacao ||
      formMovimentacao.ignoreInOut
    ) {
      return;
    }

    const { patch, erro } = calcularSugestaoPorContadores(
      formMovimentacao,
      ultimaMovimentacao,
      modalMovimentacao.maquina,
    );
    setAvisoCalculoContadores(erro);

    setFormMovimentacao((prev) => ({
      ...prev,
      ...patch,
    }));
  }, [
    formMovimentacao.contadorIn,
    formMovimentacao.contadorOut,
    formMovimentacao.ignoreInOut,
    modalMovimentacao,
    ultimaMovimentacao,
  ]);

  if (loading) return <PageLoader />;

  if (!roteiro) {
    return (
      <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <AlertBox type="error" message="Roteiro nao encontrado." />
          <button className="btn-secondary mt-4" onClick={() => navigate("/roteiros")}>
            Voltar
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  const itemSelecionado = (roteiro.itens || []).find(
    (item) => String(item.id) === String(itemSelecionadoId),
  );
  const itemLojaSelecionada =
    itemSelecionado?.tipo === "LOJA" ? itemSelecionado : null;
  const maquinasDaLojaSelecionada = itemLojaSelecionada
    ? maquinas.filter(
        (maquina) => String(maquina.lojaId) === String(itemLojaSelecionada.lojaId),
      )
    : [];
  const anotacaoSelecionada =
    itemSelecionado?.tipo === "ANOTACAO" ? itemSelecionado : null;

  const abrirMovimentacaoRoteiro = async (item, maquina) => {
    setError("");
    setModalMovimentacao({ item, maquina });
    setFormMovimentacao(formularioMovimentacaoInicial);
    setUltimaMovimentacao(null);
    setAvisoCalculoContadores("");

    try {
      const [ultimaRes, sugestaoRes] = await Promise.all([
        api
          .get(`/movimentacoes/loja/${item.lojaId}/maquina/${maquina.id}/ultima`)
          .catch(() => ({ data: null })),
        api
          .get(`/maquinas/${maquina.id}/produto-sugerido`)
          .catch(() => ({ data: null })),
      ]);

      const ultima = ultimaRes.data || null;
      setUltimaMovimentacao(ultima);
      setFormMovimentacao((prev) => ({
        ...prev,
        produtoId: sugestaoRes.data?.produtoSugerido?.id || "",
        quantidadeAtualMaquina:
          ultima?.totalPos !== undefined && ultima?.totalPos !== null
            ? String(ultima.totalPos)
            : String(maquina.estoqueAtual || 0),
      }));
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao preparar movimentacao.");
    }
  };

  const concluirItem = async (item, concluido = true) => {
    try {
      await api.patch(`/roteiros/itens/${item.id}/concluir`, { concluido });
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao atualizar item do roteiro.");
    }
  };

  const fecharModalMovimentacao = () => {
    if (salvandoMovimentacao) return;
    setModalMovimentacao(null);
    setFormMovimentacao(formularioMovimentacaoInicial);
    setUltimaMovimentacao(null);
    setAvisoCalculoContadores("");
  };

  const salvarMovimentacaoRoteiro = async (event) => {
    event.preventDefault();
    if (!modalMovimentacao || salvandoMovimentacao) return;

    const totalPre = Number.parseInt(formMovimentacao.quantidadeAtualMaquina, 10) || 0;
    const quantidadeAdicionada =
      Number.parseInt(formMovimentacao.quantidadeAdicionada, 10) || 0;
    const retiradaProduto =
      Number.parseInt(formMovimentacao.retiradaProduto, 10) || 0;
    const fichas = Number.parseInt(formMovimentacao.fichas, 10) || 0;
    const ultimoTotalPos = Number(ultimaMovimentacao?.totalPos || 0);
    const quantidadeSaiu = Math.max(0, ultimoTotalPos - totalPre);
    const observacaoFinal = formMovimentacao.observacao.trim() || null;

    if (!formMovimentacao.produtoId) {
      setError("Selecione o produto da movimentacao.");
      return;
    }

    setSalvandoMovimentacao(true);
    setError("");

    try {
      await api.post("/movimentacoes", {
        maquinaId: modalMovimentacao.maquina.id,
        totalPre,
        sairam: quantidadeSaiu,
        abastecidas: quantidadeAdicionada,
        totalPos: totalPre + quantidadeAdicionada - retiradaProduto,
        fichas,
        contadorIn: formMovimentacao.ignoreInOut
          ? null
          : Number.parseInt(formMovimentacao.contadorIn, 10) || null,
        contadorOut: formMovimentacao.ignoreInOut
          ? null
          : Number.parseInt(formMovimentacao.contadorOut, 10) || null,
        quantidade_notas_entrada: formMovimentacao.quantidadeNotasEntrada
          ? Number.parseFloat(formMovimentacao.quantidadeNotasEntrada)
          : null,
        valor_entrada_maquininha_pix: formMovimentacao.valorEntradaPix
          ? Number.parseFloat(formMovimentacao.valorEntradaPix)
          : null,
        retiradaEstoque: false,
        contadorMaquina: null,
        observacoes: observacaoFinal,
        produtos: [
          {
            produtoId: formMovimentacao.produtoId,
            quantidadeSaiu,
            quantidadeAbastecida: quantidadeAdicionada,
            retiradaProduto,
            retiradaProdutoDevolverEstoque:
              formMovimentacao.retiradaProdutoDevolverEstoque,
          },
        ],
      });

      await api.patch(
        `/roteiros/itens/${modalMovimentacao.item.id}/maquinas/${modalMovimentacao.maquina.id}/concluir`,
      );

      setModalMovimentacao(null);
      setFormMovimentacao(formularioMovimentacaoInicial);
      setUltimaMovimentacao(null);
      await carregarDados();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Erro ao registrar movimentacao.",
      );
    } finally {
      setSalvandoMovimentacao(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{roteiro.nome}</h1>
            <p className="mt-2 text-gray-600">
              Selecione a loja, escolha a maquina e lance a movimentacao.
            </p>
          </div>
          <button className="btn-secondary" onClick={() => navigate("/roteiros")}>
            Voltar para roteiros
          </button>
        </div>

        {error && <AlertBox type="error" message={error} onClose={() => setError("")} />}

        <section className="rounded-lg border border-orange-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
            <div className="space-y-2">
              {(roteiro.itens || []).map((item, index) => {
                const maquinasDaLojaItem =
                  item.tipo === "LOJA"
                    ? maquinas.filter(
                        (maquina) => String(maquina.lojaId) === String(item.lojaId),
                      )
                    : [];
                const maquinasConcluidas = new Set(
                  (item.maquinasConcluidas || []).map(String),
                );
                const totalConcluidas = maquinasDaLojaItem.filter((maquina) =>
                  maquinasConcluidas.has(String(maquina.id)),
                ).length;
                const lojaConcluida =
                  item.concluido ||
                  (maquinasDaLojaItem.length > 0 &&
                    totalConcluidas === maquinasDaLojaItem.length);

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setItemSelecionadoId(item.id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      lojaConcluida
                        ? "border-emerald-300 bg-emerald-50"
                        : item.tipo === "ANOTACAO"
                          ? "border-blue-200 bg-blue-50"
                          : String(itemSelecionadoId) === String(item.id)
                            ? "border-orange-400 bg-orange-50"
                            : "border-slate-200 bg-slate-50 hover:border-orange-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-gray-700">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-gray-900">
                          {item.tipo === "ANOTACAO"
                            ? "Anotacao"
                            : item.loja?.nome || "Loja"}
                        </span>
                        <span className="mt-1 block text-sm text-gray-600">
                          {item.tipo === "ANOTACAO"
                            ? item.anotacao
                            : lojaConcluida
                              ? "Concluida"
                              : "Abrir maquinas desta loja"}
                        </span>
                      </span>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          concluirItem(item, !item.concluido);
                        }}
                        className={`rounded-lg bg-white px-3 py-1 text-xs font-bold ${
                          lojaConcluida ? "text-emerald-700" : "text-orange-700"
                        }`}
                      >
                        {lojaConcluida ? "Concluido" : "Concluir"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              {anotacaoSelecionada ? (
                <div className="min-h-48 rounded-lg border border-blue-200 bg-blue-50 p-5">
                  <p className="text-sm font-bold uppercase text-blue-700">
                    Anotacao
                  </p>
                  <div className="mt-3 whitespace-pre-wrap text-lg font-semibold leading-relaxed text-gray-900">
                    {anotacaoSelecionada.anotacao}
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      className={`rounded-lg px-4 py-2 text-sm font-bold ${
                        anotacaoSelecionada.concluido
                          ? "bg-white text-emerald-700"
                          : "bg-white text-orange-700"
                      }`}
                      onClick={() =>
                        concluirItem(
                          anotacaoSelecionada,
                          !anotacaoSelecionada.concluido,
                        )
                      }
                    >
                      {anotacaoSelecionada.concluido ? "Concluido" : "Concluir"}
                    </button>
                  </div>
                </div>
              ) : itemLojaSelecionada ? (
                <>
                  <h2 className="text-lg font-bold text-gray-900">Maquinas da loja</h2>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {maquinasDaLojaSelecionada.map((maquina) => {
                      const maquinaConcluida = new Set(
                        (itemLojaSelecionada?.maquinasConcluidas || []).map(String),
                      ).has(String(maquina.id));

                      return (
                        <button
                          type="button"
                          key={maquina.id}
                          className={`rounded-lg border p-4 text-left ${
                            maquinaConcluida
                              ? "border-emerald-300 bg-emerald-50"
                              : "border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-orange-50"
                          }`}
                          onClick={() =>
                            itemLojaSelecionada &&
                            abrirMovimentacaoRoteiro(itemLojaSelecionada, maquina)
                          }
                        >
                          <p className="font-bold text-gray-900">
                            {maquina.nome || maquina.codigo}
                          </p>
                          <p className="mt-1 text-sm text-gray-600">
                            Codigo: {maquina.codigo}
                          </p>
                          {maquinaConcluida && (
                            <p className="mt-2 text-xs font-black uppercase text-emerald-700">
                              Concluido
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {maquinasDaLojaSelecionada.length === 0 && (
                    <p className="mt-3 text-sm text-gray-500">
                      Nenhuma maquina cadastrada nesta loja.
                    </p>
                  )}
                </>
              ) : (
                <div className="flex min-h-48 items-center justify-center text-center text-gray-500">
                  Selecione uma loja ou anotacao do roteiro.
                </div>
              )}
            </div>
          </div>
        </section>

        {modalMovimentacao && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <form
              onSubmit={salvarMovimentacaoRoteiro}
              className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-lg border border-orange-200 bg-orange-50/95 p-5 shadow-2xl"
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    📝 Registrar Movimentacao
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {itemLojaSelecionada?.loja?.nome || "Loja"} -{" "}
                    {modalMovimentacao.maquina.nome ||
                      modalMovimentacao.maquina.codigo}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={fecharModalMovimentacao}
                  disabled={salvandoMovimentacao}
                >
                  Fechar
                </button>
              </div>

              <div className="mb-4 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800 shadow-sm">
                <strong>💡 Como funciona:</strong> Informe quantos produtos tem AGORA na
                maquina. Se abastecer, informe quantos foram adicionados.
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 rounded-lg border border-orange-100 bg-white/90 p-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    🏪 Loja
                  </label>
                  <input
                    value={itemLojaSelecionada?.loja?.nome || ""}
                    className="input-field bg-slate-100"
                    disabled
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    🧸 Maquina
                  </label>
                  <input
                    value={`${modalMovimentacao.maquina.nome || ""} ${
                      modalMovimentacao.maquina.codigo || ""
                    }`.trim()}
                    className="input-field bg-slate-100"
                    disabled
                  />
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  📷 Foto dos contadores
                </label>
                <label className="inline-flex cursor-pointer items-center rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                  Tirar foto dos contadores
                  <input type="file" accept="image/*" capture="environment" className="sr-only" />
                </label>
                <p className="mt-2 text-xs text-gray-500">
                  No celular, o botao abre a camera para fotografar os dois
                  contadores. Confira e ajuste se precisar.
                </p>
              </div>

              <div className="rounded-lg border border-orange-100 bg-white/90 p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-1 md:order-last">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    🧸 Produto *
                  </label>
                  <select
                    value={formMovimentacao.produtoId}
                    onChange={(e) =>
                      setFormMovimentacao({
                        ...formMovimentacao,
                        produtoId: e.target.value,
                      })
                    }
                    className="select-field"
                    required
                  >
                    <option value="">Selecione...</option>
                    {produtos.map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.emoji || ""} {produto.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    📥 Contador IN (Entrada)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMovimentacao.contadorIn}
                    disabled={formMovimentacao.ignoreInOut}
                    onChange={(e) =>
                      setFormMovimentacao({
                        ...formMovimentacao,
                        contadorIn: e.target.value,
                      })
                    }
                    className="input-field"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Numero do contador IN da maquina
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    📤 Contador OUT (Saida)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMovimentacao.contadorOut}
                    disabled={formMovimentacao.ignoreInOut}
                    onChange={(e) =>
                      setFormMovimentacao({
                        ...formMovimentacao,
                        contadorOut: e.target.value,
                      })
                    }
                    className="input-field"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Numero do contador OUT da maquina
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-3">
                  <input
                    type="checkbox"
                    checked={formMovimentacao.ignoreInOut}
                    onChange={(e) =>
                      setFormMovimentacao({
                        ...formMovimentacao,
                        ignoreInOut: e.target.checked,
                      })
                    }
                  />
                  Nao preciso informar IN/OUT nesta movimentacao
                </label>

                {avisoCalculoContadores && (
                  <p className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm font-semibold text-yellow-800 md:col-span-3">
                    {avisoCalculoContadores}
                  </p>
                )}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    📦 Quantidade Atual na Maquina *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMovimentacao.quantidadeAtualMaquina}
                    onChange={(e) =>
                      setFormMovimentacao({
                        ...formMovimentacao,
                        quantidadeAtualMaquina: e.target.value,
                      })
                    }
                    className="input-field"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Quantos produtos tem agora
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    🧺 Quantidade Adicionada
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMovimentacao.quantidadeAdicionada}
                    onChange={(e) =>
                      setFormMovimentacao({
                        ...formMovimentacao,
                        quantidadeAdicionada: e.target.value,
                      })
                    }
                    className="input-field"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Quantos produtos foram adicionados
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    🎟️ Quantidade de Fichas
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMovimentacao.fichas}
                    onChange={(e) =>
                      setFormMovimentacao({
                        ...formMovimentacao,
                        fichas: e.target.value,
                      })
                    }
                    className="input-field"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Fichas coletadas da maquina
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    ❌ Retirada de Produto
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMovimentacao.retiradaProduto}
                    onChange={(e) =>
                      setFormMovimentacao({
                        ...formMovimentacao,
                        retiradaProduto: e.target.value,
                      })
                    }
                    className="input-field"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Quantidade retirada sem contar como saida financeira
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    💵 Valor em Notas (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formMovimentacao.quantidadeNotasEntrada}
                    onChange={(e) =>
                      setFormMovimentacao({
                        ...formMovimentacao,
                        quantidadeNotasEntrada: e.target.value,
                      })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    💳 Valor Digital (Pix/Maquininha) (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formMovimentacao.valorEntradaPix}
                    onChange={(e) =>
                      setFormMovimentacao({
                        ...formMovimentacao,
                        valorEntradaPix: e.target.value,
                      })
                    }
                    className="input-field"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-3">
                  <input
                    type="checkbox"
                    checked={formMovimentacao.retiradaProdutoDevolverEstoque}
                    onChange={(e) =>
                      setFormMovimentacao({
                        ...formMovimentacao,
                        retiradaProdutoDevolverEstoque: e.target.checked,
                      })
                    }
                  />
                  Devolver retirada para o estoque da loja
                </label>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-orange-100 bg-white/90 p-4 shadow-sm">
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  📝 Observacao
                </label>
                <textarea
                  value={formMovimentacao.observacao}
                  onChange={(e) =>
                    setFormMovimentacao({
                      ...formMovimentacao,
                      observacao: e.target.value,
                    })
                  }
                  className="input-field min-h-24"
                />
              </div>

              {ultimaMovimentacao && (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-gray-600">
                  Ultima movimentacao: total pos{" "}
                  {ultimaMovimentacao.totalPos ?? 0}. Ultimos contadores salvos:
                  IN{" "}
                  {ultimaMovimentacao.ultimoContadorIn ??
                    ultimaMovimentacao.contadorIn ??
                    "-"}
                  , OUT{" "}
                  {ultimaMovimentacao.ultimoContadorOut ??
                    ultimaMovimentacao.contadorOut ??
                    "-"}
                  .
                </p>
              )}

              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={fecharModalMovimentacao}
                  disabled={salvandoMovimentacao}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={salvandoMovimentacao}
                >
                  {salvandoMovimentacao ? "Salvando..." : "Salvar movimentacao"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
