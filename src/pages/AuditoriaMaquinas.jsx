// Página desativada: ainda não está registrada em App.jsx nem no Navbar.
// Para ativar, descomente a rota /auditoria-maquinas em App.jsx.
import { useEffect, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { filtrarLojasOperacionais } from "../utils/lojas";

export function AuditoriaMaquinas() {
  const [loading, setLoading] = useState(true);
  const [roteiros, setRoteiros] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [salvandoAuditoria, setSalvandoAuditoria] = useState(false);
  const [auditoriaEscopo, setAuditoriaEscopo] = useState("maquinas");
  const [auditoriaMaquinasSelecionadas, setAuditoriaMaquinasSelecionadas] =
    useState([]);
  const [auditoriaLojaId, setAuditoriaLojaId] = useState("");
  const [auditoriaRoteiroId, setAuditoriaRoteiroId] = useState("");
  const [auditoriaModo, setAuditoriaModo] = useState("dia");
  const [auditoriaData, setAuditoriaData] = useState("");

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError("");

      const [roteirosRes, lojasRes, maquinasRes] = await Promise.all([
        api.get("/roteiros"),
        api.get("/lojas"),
        api.get("/maquinas"),
      ]);

      setRoteiros(roteirosRes.data || []);
      setLojas(
        filtrarLojasOperacionais(
          (lojasRes.data || []).filter((loja) => loja.ativo !== false),
        ),
      );
      setMaquinas(maquinasRes.data || []);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const toggleMaquinaAuditoriaSelecionada = (maquinaId) => {
    setAuditoriaMaquinasSelecionadas((prev) =>
      prev.includes(maquinaId)
        ? prev.filter((id) => id !== maquinaId)
        : [...prev, maquinaId],
    );
  };

  const resolverMaquinasAlvoAuditoria = () => {
    if (auditoriaEscopo === "maquinas") {
      return maquinas.filter((m) =>
        auditoriaMaquinasSelecionadas.includes(m.id),
      );
    }
    if (auditoriaEscopo === "loja") {
      return maquinas.filter(
        (m) => String(m.lojaId) === String(auditoriaLojaId),
      );
    }
    if (auditoriaEscopo === "roteiro") {
      const roteiroAlvo = roteiros.find((r) => r.id === auditoriaRoteiroId);
      const lojaIds = new Set(
        (roteiroAlvo?.itens || [])
          .filter((item) => item.tipo === "LOJA")
          .map((item) => String(item.lojaId)),
      );
      return maquinas.filter((m) => lojaIds.has(String(m.lojaId)));
    }
    return maquinas;
  };

  const resolverDatasAlvoAuditoria = () => {
    if (!auditoriaData) return [];
    if (auditoriaModo === "dia") return [auditoriaData];

    const datas = [];
    const base = new Date(`${auditoriaData}T00:00:00`);
    for (let i = 0; i < 7; i += 1) {
      const data = new Date(base);
      data.setDate(base.getDate() + i);
      datas.push(data.toISOString().slice(0, 10));
    }
    return datas;
  };

  const agendarAuditoria = async () => {
    const maquinasAlvo = resolverMaquinasAlvoAuditoria();
    const datasAlvo = resolverDatasAlvoAuditoria();

    if (maquinasAlvo.length === 0) {
      setError("Selecione ao menos uma máquina, loja ou rota para a auditoria.");
      return;
    }
    if (datasAlvo.length === 0) {
      setError("Escolha a data da auditoria.");
      return;
    }

    setSalvandoAuditoria(true);
    setError("");
    try {
      await Promise.all(
        maquinasAlvo.map((maquina) => {
          const atuais = new Set(maquina.datasAuditoria || []);
          datasAlvo.forEach((data) => atuais.add(data));
          return api.put(`/maquinas/${maquina.id}`, {
            datasAuditoria: [...atuais].sort(),
          });
        }),
      );
      setSuccess(
        `Auditoria agendada para ${maquinasAlvo.length} máquina(s).`,
      );
      setAuditoriaMaquinasSelecionadas([]);
      setAuditoriaLojaId("");
      setAuditoriaRoteiroId("");
      setAuditoriaData("");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao agendar auditoria.");
    } finally {
      setSalvandoAuditoria(false);
    }
  };

  const removerDataAuditoriaMaquina = async (maquina, data) => {
    try {
      const novasDatas = (maquina.datasAuditoria || []).filter(
        (d) => d !== data,
      );
      await api.put(`/maquinas/${maquina.id}`, { datasAuditoria: novasDatas });
      await carregarDados();
    } catch (err) {
      setError(
        err.response?.data?.error || "Erro ao remover data de auditoria.",
      );
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
            <span>🔍</span>
            Auditoria de Máquinas
          </h1>
          <p className="mt-2 text-gray-600">
            Agende dias em que a máquina fica em modo auditoria: o registro de
            movimentação fica 100% manual, sem sugerir quanto tem, quanto
            abastecer ou fichas.
          </p>
        </div>

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

        <section className="mb-6 rounded-lg border border-red-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <label className="mb-2 block text-sm font-bold text-gray-700">
              Onde aplicar
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "maquinas", label: "Máquina(s) específica(s)" },
                { value: "loja", label: "Loja inteira" },
                { value: "roteiro", label: "Rota específica" },
                { value: "todas", label: "Todas as rotas" },
              ].map((opcao) => (
                <button
                  key={opcao.value}
                  type="button"
                  onClick={() => setAuditoriaEscopo(opcao.value)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                    auditoriaEscopo === opcao.value
                      ? "bg-red-600 text-white"
                      : "bg-slate-100 text-gray-700 hover:bg-slate-200"
                  }`}
                >
                  {opcao.label}
                </button>
              ))}
            </div>
          </div>

          {auditoriaEscopo === "maquinas" && (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Selecione as máquinas
              </label>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-3">
                {lojas.map((loja) => {
                  const maquinasDaLoja = maquinas.filter(
                    (m) => String(m.lojaId) === String(loja.id),
                  );
                  if (maquinasDaLoja.length === 0) return null;
                  return (
                    <div key={loja.id} className="mb-2">
                      <p className="text-xs font-bold uppercase text-gray-500">
                        {loja.nome}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {maquinasDaLoja.map((maquina) => (
                          <label
                            key={maquina.id}
                            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold cursor-pointer ${
                              auditoriaMaquinasSelecionadas.includes(maquina.id)
                                ? "border-red-400 bg-red-50 text-red-700"
                                : "border-gray-200 text-gray-700"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={auditoriaMaquinasSelecionadas.includes(
                                maquina.id,
                              )}
                              onChange={() =>
                                toggleMaquinaAuditoriaSelecionada(maquina.id)
                              }
                            />
                            {maquina.nome} - {maquina.codigo}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {auditoriaEscopo === "loja" && (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Loja
              </label>
              <select
                value={auditoriaLojaId}
                onChange={(e) => setAuditoriaLojaId(e.target.value)}
                className="select-field"
              >
                <option value="">Selecione...</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {auditoriaEscopo === "roteiro" && (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Rota
              </label>
              <select
                value={auditoriaRoteiroId}
                onChange={(e) => setAuditoriaRoteiroId(e.target.value)}
                className="select-field"
              >
                <option value="">Selecione...</option>
                {roteiros.map((roteiro) => (
                  <option key={roteiro.id} value={roteiro.id}>
                    {roteiro.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[200px_200px_auto] sm:items-end">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Período
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAuditoriaModo("dia")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                    auditoriaModo === "dia"
                      ? "bg-red-600 text-white"
                      : "bg-slate-100 text-gray-700"
                  }`}
                >
                  Um dia
                </button>
                <button
                  type="button"
                  onClick={() => setAuditoriaModo("semana")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                    auditoriaModo === "semana"
                      ? "bg-red-600 text-white"
                      : "bg-slate-100 text-gray-700"
                  }`}
                >
                  Semana inteira
                </button>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                {auditoriaModo === "dia" ? "Data" : "Data inicial"}
              </label>
              <input
                type="date"
                value={auditoriaData}
                onChange={(e) => setAuditoriaData(e.target.value)}
                className="input-field"
              />
            </div>
            <button
              type="button"
              onClick={agendarAuditoria}
              disabled={salvandoAuditoria}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvandoAuditoria ? "Agendando..." : "Agendar auditoria"}
            </button>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="mb-2 text-sm font-bold text-gray-700">
              Auditorias já agendadas
            </p>
            <div className="space-y-2">
              {maquinas
                .filter((m) => (m.datasAuditoria || []).length > 0)
                .map((maquina) => (
                  <div
                    key={maquina.id}
                    className="rounded-lg border border-gray-200 p-2 text-sm"
                  >
                    <span className="font-semibold text-gray-800">
                      {maquina.nome} - {maquina.codigo}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {[...maquina.datasAuditoria].sort().map((data) => (
                        <span
                          key={data}
                          className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700"
                        >
                          {data}
                          <button
                            type="button"
                            onClick={() =>
                              removerDataAuditoriaMaquina(maquina, data)
                            }
                            className="text-red-400 hover:text-red-700"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              {maquinas.every((m) => (m.datasAuditoria || []).length === 0) && (
                <p className="text-xs text-gray-400">
                  Nenhuma auditoria agendada.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
