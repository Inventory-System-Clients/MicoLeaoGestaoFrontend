import { useEffect, useMemo, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatarDataHora = (valor) => {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  return data.toLocaleString("pt-BR");
};

const obterStatusClasses = (status) => {
  if (status === "online") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (status === "offline") {
    return "bg-red-100 text-red-800 border-red-200";
  }
  if (status === "erro") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
};

const obterStatusVendaClasses = (status) => {
  const texto = String(status || "").toLowerCase();
  if (texto.includes("devolv")) {
    return "bg-red-100 text-red-800 border-red-200";
  }
  if (texto.includes("aprova")) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
};

const obterPulsoClasses = (pulsoConsultado) =>
  pulsoConsultado
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : "bg-red-100 text-red-800 border-red-200";

const valoresRapidosCredito = [2, 5, 10, 20, 50, 100];

const parseValorCredito = (valor) => {
  const normalizado = String(valor || "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
};

const formatarValorInput = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function MachinePay() {
  const { isAdmin } = useAuth();
  const admin = isAdmin();

  const hoje = new Date().toISOString().slice(0, 10);
  const [periodoInicio, setPeriodoInicio] = useState(hoje);
  const [periodoFim, setPeriodoFim] = useState(hoje);

  const [maquinas, setMaquinas] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [transacoesPorMaquina, setTransacoesPorMaquina] = useState({});
  const [maquinaSelecionadaId, setMaquinaSelecionadaId] = useState("");
  const [modalCreditoMaquina, setModalCreditoMaquina] = useState(null);
  const [valorCredito, setValorCredito] = useState("2,00");
  const [mensagemCredito, setMensagemCredito] = useState("");
  const [loading, setLoading] = useState(true);
  const [buscandoStatus, setBuscandoStatus] = useState(false);
  const [buscandoTransacoesId, setBuscandoTransacoesId] = useState("");
  const [enviandoCreditosId, setEnviandoCreditosId] = useState("");
  const [devolvendoId, setDevolvendoId] = useState("");
  const [error, setError] = useState("");

  const maquinaSelecionada = useMemo(
    () => maquinas.find((maquina) => maquina.id === maquinaSelecionadaId),
    [maquinaSelecionadaId, maquinas],
  );

  const carregarMaquinas = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/machine-pay/maquinas");
      const lista = response.data || [];
      setMaquinas(lista);
      setMaquinaSelecionadaId((atual) => atual || lista[0]?.id || "");
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Nao foi possivel carregar as maquinas Machine Pay.",
      );
      setMaquinas([]);
    } finally {
      setLoading(false);
    }
  };

  const buscarStatus = async () => {
    try {
      setBuscandoStatus(true);
      setError("");
      const response = await api.get("/machine-pay/status");
      const mapa = {};
      (response.data?.resultados || []).forEach((item) => {
        mapa[item.maquinaId] = item.status;
      });
      setStatuses(mapa);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Nao foi possivel buscar o status na Machine Pay.",
      );
    } finally {
      setBuscandoStatus(false);
    }
  };

  const abrirModalCredito = (maquina) => {
    setModalCreditoMaquina(maquina);
    setValorCredito("2,00");
    setMensagemCredito("");
  };

  const atualizarValorCredito = () => {
    const valor = parseValorCredito(valorCredito);
    setValorCredito(formatarValorInput(valor > 0 ? valor : 2));
  };

  const enviarCreditos = async () => {
    if (!modalCreditoMaquina) return;

    const creditos = parseValorCredito(valorCredito);

    if (creditos <= 0) {
      setMensagemCredito("Informe um valor maior que zero.");
      return;
    }

    try {
      setMensagemCredito("");
      setEnviandoCreditosId(modalCreditoMaquina.id);
      const response = await api.post(
        `/machine-pay/maquinas/${modalCreditoMaquina.id}/mqtt-creditos`,
        { creditos },
      );

      setMensagemCredito(
        response.data?.sucesso
          ? "Enviado e gravado no banco!"
          : "Solicitacao enviada para a Machine Pay.",
      );
    } catch (err) {
      setMensagemCredito(
        err.response?.data?.error ||
          "Nao foi possivel enviar credito MQTT pela Machine Pay.",
      );
    } finally {
      setEnviandoCreditosId("");
    }
  };

  const buscarTransacoes = async (maquina) => {
    try {
      setBuscandoTransacoesId(maquina.id);
      setError("");
      const params = admin
        ? `?inicio=${periodoInicio}T00:00&fim=${periodoFim}T23:59`
        : "";
      const response = await api.get(
        `/machine-pay/maquinas/${maquina.id}/transacoes-24h${params}`,
      );
      setTransacoesPorMaquina((prev) => ({
        ...prev,
        [maquina.id]: response.data,
      }));
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Nao foi possivel buscar as transacoes na Machine Pay.",
      );
    } finally {
      setBuscandoTransacoesId("");
    }
  };

  const devolverPagamento = async (maquina, transacao) => {
    if (!transacao.idwebhook) return;

    const confirmado = window.confirm(
      `Confirma a devolução do pagamento de R$ ${formatarMoeda(transacao.valor)}?`,
    );
    if (!confirmado) return;

    try {
      setError("");
      setDevolvendoId(transacao.idwebhook);
      await api.post(
        `/machine-pay/pagamentos/${transacao.idwebhook}/devolver`,
      );

      setTransacoesPorMaquina((prev) => {
        const atual = prev[maquina.id];
        if (!atual) return prev;

        return {
          ...prev,
          [maquina.id]: {
            ...atual,
            transacoes: atual.transacoes.map((item) =>
              item.idwebhook === transacao.idwebhook
                ? { ...item, jaDevolvido: true, podeDevolver: false }
                : item,
            ),
          },
        };
      });
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Nao foi possivel devolver o pagamento na Machine Pay.",
      );
    } finally {
      setDevolvendoId("");
    }
  };

  useEffect(() => {
    carregarMaquinas();
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Machine Pay"
          subtitle="Consulte status, envie creditos e busque transacoes apenas quando precisar"
          icon="💳"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}

        <section className="card-gradient mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Maquinas com ID Machine Pay
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {maquinas.length} maquina(s) cadastrada(s). O status so atualiza
                quando voce clicar em buscar.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={buscarStatus}
              disabled={buscandoStatus || maquinas.length === 0}
            >
              {buscandoStatus ? "Buscando..." : "Buscar status"}
            </button>
          </div>
        </section>

        {maquinas.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-5xl mb-3">💳</p>
            <h3 className="text-xl font-bold text-gray-900">
              Nenhuma maquina com Machine Pay
            </h3>
            <p className="text-gray-600 mt-2">
              Cadastre o ID da Machine Pay no formulario da maquina.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-1 space-y-3">
              {maquinas.map((maquina) => {
                const status = statuses[maquina.id];
                const statusTexto = status?.status || "nao consultado";

                return (
                  <button
                    type="button"
                    key={maquina.id}
                    onClick={() => setMaquinaSelecionadaId(maquina.id)}
                    className={`w-full rounded-lg border-2 bg-white p-4 text-left transition ${
                      maquinaSelecionadaId === maquina.id
                        ? "border-primary shadow-md"
                        : "border-gray-200 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-gray-900">
                          {maquina.nome || maquina.codigo}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {maquina.loja?.nome || "Loja nao informada"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          POS {maquina.machinePayPosId}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${obterStatusClasses(
                          statusTexto,
                        )}`}
                      >
                        {statusTexto}
                      </span>
                    </div>
                    {status?.consultadoEm && (
                      <p className="text-xs text-gray-400 mt-3">
                        Consultado em {formatarDataHora(status.consultadoEm)}
                      </p>
                    )}
                    {status?.ultimaTransacaoEm && (
                      <p className="text-xs text-amber-600 mt-1 font-medium">
                        Ultima tx: {status.ultimaTransacaoEm}
                      </p>
                    )}
                    {status && !status.ultimaTransacaoEm && status.status !== "nao consultado" && (
                      <p className="text-xs text-gray-400 mt-1">
                        Sem transacoes recentes
                      </p>
                    )}
                  </button>
                );
              })}
            </section>

            <section className="lg:col-span-2">
              {maquinaSelecionada && (
                <div className="card-gradient">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-gray-900">
                        {maquinaSelecionada.nome || maquinaSelecionada.codigo}
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {maquinaSelecionada.loja?.nome || "Loja nao informada"}{" "}
                        · POS {maquinaSelecionada.machinePayPosId}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => abrirModalCredito(maquinaSelecionada)}
                    >
                      Enviar creditos MQTT
                    </button>
                  </div>

                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {admin ? "Transacoes por periodo" : "Transacoes das ultimas 24h"}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Esta consulta so chama a Machine Pay quando voce clicar.
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:items-end">
                        {admin && (
                          <div className="flex gap-2 items-center flex-wrap">
                            <div className="flex gap-1 items-center">
                              <label className="text-xs font-semibold text-gray-600">De</label>
                              <input
                                type="date"
                                value={periodoInicio}
                                onChange={(e) => setPeriodoInicio(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-sm"
                              />
                            </div>
                            <div className="flex gap-1 items-center">
                              <label className="text-xs font-semibold text-gray-600">Ate</label>
                              <input
                                type="date"
                                value={periodoFim}
                                onChange={(e) => setPeriodoFim(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-sm"
                              />
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => buscarTransacoes(maquinaSelecionada)}
                          disabled={buscandoTransacoesId === maquinaSelecionada.id}
                        >
                          {buscandoTransacoesId === maquinaSelecionada.id
                            ? "Buscando..."
                            : "Buscar transacoes"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {transacoesPorMaquina[maquinaSelecionada.id] ? (
                    <div className="mt-5">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
                        <div className="rounded-lg border border-gray-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase text-gray-500">
                            Quantidade
                          </p>
                          <p className="text-2xl font-black text-gray-900">
                            {
                              transacoesPorMaquina[maquinaSelecionada.id]
                                .quantidade
                            }
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase text-gray-500">
                            Valor total
                          </p>
                          <p className="text-2xl font-black text-emerald-700">
                            R${" "}
                            {formatarMoeda(
                              transacoesPorMaquina[maquinaSelecionada.id].total,
                            )}
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase text-gray-500">
                            Periodo
                          </p>
                          <p className="text-sm font-bold text-gray-900">
                            {formatarDataHora(
                              transacoesPorMaquina[maquinaSelecionada.id]
                                .inicio,
                            )}
                          </p>
                          <p className="text-sm text-gray-500">
                            ate{" "}
                            {formatarDataHora(
                              transacoesPorMaquina[maquinaSelecionada.id].fim,
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">
                                Data
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">
                                Tipo
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">
                                Pulso
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">
                                Valor
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-500">
                                Devolução
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {transacoesPorMaquina[
                              maquinaSelecionada.id
                            ].transacoes.length > 0 ? (
                              transacoesPorMaquina[
                                maquinaSelecionada.id
                              ].transacoes.map((transacao) => (
                                <tr key={transacao.id}>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {formatarDataHora(transacao.data)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {transacao.tipo}
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <span
                                      className={`rounded-full border px-3 py-1 text-xs font-bold ${obterStatusVendaClasses(
                                        transacao.status,
                                      )}`}
                                    >
                                      {transacao.status || "-"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <span
                                      className={`rounded-full border px-3 py-1 text-xs font-bold ${obterPulsoClasses(
                                        transacao.pulsoConsultado,
                                      )}`}
                                    >
                                      {transacao.pulsoConsultado ? "Consultado" : "Não Consultado"}
                                    </span>
                                    {transacao.pulsoStatus && (
                                      <div className="mt-1 text-xs text-gray-500">
                                        {transacao.pulsoStatus}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                                    R$ {formatarMoeda(transacao.valor)}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm">
                                    {transacao.podeDevolver ? (
                                      <button
                                        type="button"
                                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-red-600 disabled:opacity-60"
                                        onClick={() =>
                                          devolverPagamento(
                                            maquinaSelecionada,
                                            transacao,
                                          )
                                        }
                                        disabled={
                                          devolvendoId === transacao.idwebhook
                                        }
                                      >
                                        {devolvendoId === transacao.idwebhook
                                          ? "Devolvendo..."
                                          : "Devolver"}
                                      </button>
                                    ) : transacao.jaDevolvido ? (
                                      <span className="rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                                        Devolvido
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-300">
                                        -
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td
                                  colSpan="6"
                                  className="px-4 py-8 text-center text-sm text-gray-500"
                                >
                                  Nenhuma transacao encontrada nas ultimas 24h.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-lg border border-dashed border-gray-300 bg-white/70 p-8 text-center text-gray-500">
                      Clique em buscar transacoes para consultar a Machine Pay.
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {modalCreditoMaquina && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-28 items-center justify-center rounded-full bg-gray-900 text-sm font-black text-white">
                MACHINE <span className="ml-1 rounded-full bg-orange-400 px-2 py-1 text-xs">PAY</span>
              </div>
              <p className="font-semibold text-gray-700">
                Digite ou selecione um valor de credito:
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {modalCreditoMaquina.nome || modalCreditoMaquina.codigo} · POS{" "}
                {modalCreditoMaquina.machinePayPosId}
              </p>
            </div>

            <input
              type="text"
              inputMode="decimal"
              value={valorCredito}
              onChange={(event) => setValorCredito(event.target.value)}
              onBlur={atualizarValorCredito}
              className="input-field mb-5 text-center text-lg"
              placeholder="2,00"
            />

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {valoresRapidosCredito.slice(0, 4).map((valor) => (
                <button
                  type="button"
                  key={valor}
                  className="rounded-lg bg-blue-600 px-3 py-3 font-bold text-white shadow hover:bg-blue-700"
                  onClick={() => setValorCredito(formatarValorInput(valor))}
                >
                  R$ {formatarMoeda(valor)}
                </button>
              ))}
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {valoresRapidosCredito.slice(4).map((valor) => (
                <button
                  type="button"
                  key={valor}
                  className="rounded-lg bg-blue-600 px-3 py-3 font-bold text-white shadow hover:bg-blue-700"
                  onClick={() => setValorCredito(formatarValorInput(valor))}
                >
                  R$ {formatarMoeda(valor)}
                </button>
              ))}
              <button
                type="button"
                className="rounded-lg bg-violet-600 px-3 py-3 font-bold text-white shadow hover:bg-violet-700"
                onClick={atualizarValorCredito}
              >
                Atualizar
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                className="rounded-lg bg-green-600 px-6 py-3 font-bold text-white shadow hover:bg-green-700 disabled:opacity-60"
                onClick={enviarCreditos}
                disabled={enviandoCreditosId === modalCreditoMaquina.id}
              >
                {enviandoCreditosId === modalCreditoMaquina.id
                  ? "Enviando..."
                  : "Enviar Credito"}
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-500 px-6 py-3 font-bold text-white shadow hover:bg-red-600"
                onClick={() => setModalCreditoMaquina(null)}
                disabled={enviandoCreditosId === modalCreditoMaquina.id}
              >
                Fechar
              </button>
            </div>

            {mensagemCredito && (
              <p
                className={`mt-4 text-center text-sm font-black ${
                  /enviado|gravado|solicitacao/i.test(mensagemCredito)
                    ? "text-green-700"
                    : "text-red-600"
                }`}
              >
                {mensagemCredito}
              </p>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
