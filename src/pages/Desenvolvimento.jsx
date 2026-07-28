import { useEffect, useMemo, useState } from "react";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { Navbar } from "../components/Navbar";
import { AlertBox } from "../components/UIComponents";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

const colunas = [
  { status: "PENDENTE", titulo: "Pendentes", cor: "border-orange-200 bg-orange-50" },
  { status: "ACEITO", titulo: "Aceitas", cor: "border-blue-200 bg-blue-50" },
  { status: "RECUSADO", titulo: "Nao aceitas", cor: "border-red-200 bg-red-50" },
  {
    status: "DESENVOLVIMENTO",
    titulo: "Em desenvolvimento",
    cor: "border-purple-200 bg-purple-50",
  },
  { status: "PRONTO", titulo: "Pronto", cor: "border-emerald-200 bg-emerald-50" },
];

const sugestaoVazia = { titulo: "", descricao: "" };

export function Desenvolvimento() {
  const { usuario } = useAuth();
  const isDev = usuario?.role === "DESENVOLVEDOR";
  const [loading, setLoading] = useState(true);
  const [sugestoes, setSugestoes] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(sugestaoVazia);
  const [respostas, setRespostas] = useState({});
  const [revisoes, setRevisoes] = useState({});
  const [filtro, setFiltro] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const carregarSugestoes = async () => {
    try {
      setLoading(true);
      const response = await api.get("/desenvolvimento");
      setSugestoes(response.data || []);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar desenvolvimento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarSugestoes();
  }, []);

  const criarSugestao = async (event) => {
    event.preventDefault();
    try {
      setError("");
      await api.post("/desenvolvimento", form);
      setForm(sugestaoVazia);
      setMostrarForm(false);
      setSuccess("Sugestao criada.");
      await carregarSugestoes();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao criar sugestao.");
    }
  };

  const responder = async (sugestao, acao) => {
    try {
      setError("");
      await api.patch(`/desenvolvimento/${sugestao.id}/responder`, {
        acao,
        resposta: respostas[sugestao.id] || "",
      });
      setSuccess(acao === "ACEITAR" ? "Sugestao aceita." : "Sugestao recusada.");
      await carregarSugestoes();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao responder sugestao.");
    }
  };

  const pedirNovamente = async (sugestao) => {
    try {
      setError("");
      await api.patch(`/desenvolvimento/${sugestao.id}/revisao`, {
        motivoRevisao: revisoes[sugestao.id] || "",
      });
      setSuccess("Sugestao voltou para pendente.");
      await carregarSugestoes();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao pedir revisao.");
    }
  };

  const mover = async (sugestao, status) => {
    try {
      setError("");
      await api.patch(`/desenvolvimento/${sugestao.id}/mover`, { status });
      setSuccess(status === "PRONTO" ? "Marcado como pronto." : "Movido para desenvolvimento.");
      await carregarSugestoes();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao mover sugestao.");
    }
  };

  const baixar = async (sugestao) => {
    try {
      setError("");
      await api.patch(`/desenvolvimento/${sugestao.id}/baixar`);
      setSuccess("Baixa registrada.");
      await carregarSugestoes();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao baixar sugestao.");
    }
  };

  const sugestoesFiltradas = useMemo(() => {
    const busca = filtro.trim().toLowerCase();
    return sugestoes.filter((sugestao) => {
      if (sugestao.status === "BAIXADO") return false;
      if (!busca) return true;
      return [sugestao.titulo, sugestao.descricao, sugestao.criadoPor?.nome]
        .join(" ")
        .toLowerCase()
        .includes(busca);
    });
  }, [sugestoes, filtro]);

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Desenvolvimento</h1>
            <p className="mt-2 text-gray-600">
              Kanban de melhorias, respostas, desenvolvimento e entrega.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setMostrarForm((prev) => !prev)}
          >
            Criar sugestao
          </button>
        </div>

        {error && <AlertBox type="error" message={error} onClose={() => setError("")} />}
        {success && (
          <AlertBox type="success" message={success} onClose={() => setSuccess("")} />
        )}

        {mostrarForm && (
          <section className="mb-6 rounded-lg border border-orange-100 bg-white p-5 shadow-sm">
            <form onSubmit={criarSugestao} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Titulo *
                </label>
                <input
                  className="input-field"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex: filtro de compras por fornecedor"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Descricao *
                </label>
                <textarea
                  className="input-field min-h-28"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Explique o que precisa mudar e por que isso ajuda a operacao."
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMostrarForm(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar sugestao
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Filtrar kanban
          </label>
          <input
            className="input-field"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por titulo, descricao ou criador..."
          />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          {colunas.map((coluna) => {
            const itens = sugestoesFiltradas.filter(
              (sugestao) => sugestao.status === coluna.status,
            );
            return (
              <div key={coluna.status} className={`rounded-lg border p-3 ${coluna.cor}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="font-bold text-gray-900">{coluna.titulo}</h2>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-gray-600">
                    {itens.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {itens.map((sugestao) => (
                    <article
                      key={sugestao.id}
                      className="rounded-lg border border-white/80 bg-white p-4 shadow-sm"
                    >
                      <h3 className="font-bold text-gray-900">{sugestao.titulo}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                        {sugestao.descricao}
                      </p>
                      <p className="mt-3 text-xs font-semibold text-gray-500">
                        Criado por {sugestao.criadoPor?.nome || "usuario"} em{" "}
                        {new Date(sugestao.createdAt).toLocaleDateString("pt-BR")}
                      </p>

                      {sugestao.resposta && (
                        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-gray-700">
                          <p className="font-bold text-gray-900">Resposta</p>
                          <p className="whitespace-pre-wrap">{sugestao.resposta}</p>
                        </div>
                      )}

                      {sugestao.motivoRevisao && (
                        <div className="mt-3 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-900">
                          <p className="font-bold">Precisa de novo</p>
                          <p className="whitespace-pre-wrap">{sugestao.motivoRevisao}</p>
                        </div>
                      )}

                      {["PENDENTE", "ACEITO", "RECUSADO"].includes(sugestao.status) && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            className="input-field min-h-20 text-sm"
                            value={respostas[sugestao.id] || ""}
                            onChange={(e) =>
                              setRespostas({
                                ...respostas,
                                [sugestao.id]: e.target.value,
                              })
                            }
                            placeholder="Resposta ou motivo..."
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-primary text-sm"
                              onClick={() => responder(sugestao, "ACEITAR")}
                            >
                              Aceitar
                            </button>
                            <button
                              type="button"
                              className="btn-danger text-sm"
                              onClick={() => responder(sugestao, "RECUSAR")}
                            >
                              Nao aceitar
                            </button>
                          </div>
                        </div>
                      )}

                      {["ACEITO", "RECUSADO", "DESENVOLVIMENTO", "PRONTO"].includes(
                        sugestao.status,
                      ) && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            className="input-field min-h-16 text-sm"
                            value={revisoes[sugestao.id] || ""}
                            onChange={(e) =>
                              setRevisoes({
                                ...revisoes,
                                [sugestao.id]: e.target.value,
                              })
                            }
                            placeholder="Se precisa voltar, explique o que precisa de novo..."
                          />
                          <button
                            type="button"
                            className="btn-secondary text-sm"
                            onClick={() => pedirNovamente(sugestao)}
                          >
                            Precisa de novo
                          </button>
                        </div>
                      )}

                      {isDev && sugestao.status === "ACEITO" && (
                        <button
                          type="button"
                          className="btn-primary mt-3 w-full text-sm"
                          onClick={() => mover(sugestao, "DESENVOLVIMENTO")}
                        >
                          Colocar em desenvolvimento
                        </button>
                      )}

                      {isDev && sugestao.status === "DESENVOLVIMENTO" && (
                        <button
                          type="button"
                          className="btn-primary mt-3 w-full text-sm"
                          onClick={() => mover(sugestao, "PRONTO")}
                        >
                          Marcar como pronto
                        </button>
                      )}

                      {sugestao.status === "PRONTO" && (
                        <button
                          type="button"
                          className="btn-secondary mt-3 w-full text-sm"
                          onClick={() => baixar(sugestao)}
                        >
                          Dar baixa
                        </button>
                      )}
                    </article>
                  ))}
                  {itens.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/90 bg-white/60 p-5 text-center text-sm text-gray-500">
                      Nada aqui.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </main>
      <Footer />
    </div>
  );
}
