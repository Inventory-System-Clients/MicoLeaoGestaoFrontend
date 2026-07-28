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

export function RoteiroExecucao() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [roteiro, setRoteiro] = useState(null);
  const [maquinas, setMaquinas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState(
    searchParams.get("lojaId") || "",
  );
  const [error, setError] = useState("");

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [roteirosRes, maquinasRes] = await Promise.all([
        api.get("/roteiros"),
        api.get("/maquinas"),
      ]);
      const encontrado = (roteirosRes.data || []).find(
        (item) => String(item.id) === String(id),
      );
      setRoteiro(encontrado ? ordenarRoteiro(encontrado) : null);
      setMaquinas(maquinasRes.data || []);
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

  const lojasDoRoteiro = (roteiro.itens || []).filter((item) => item.tipo === "LOJA");
  const itemLojaSelecionada = lojasDoRoteiro.find(
    (item) => String(item.lojaId) === String(lojaSelecionada),
  );
  const maquinasDaLojaSelecionada = lojaSelecionada
    ? maquinas.filter((maquina) => String(maquina.lojaId) === String(lojaSelecionada))
    : [];

  const abrirMovimentacaoRoteiro = (item, maquinaId) => {
    const params = new URLSearchParams({
      abrirFormulario: "true",
      modo: "nova_movimentacao",
      lojaId: item.lojaId,
      maquinaId,
      roteiroId: item.roteiroId,
      roteiroItemId: item.id,
      origemRoteiro: "true",
      bloquearLojaMaquina: "true",
    });

    navigate(`/movimentacoes?${params}`);
  };

  const concluirItem = async (item, concluido = true) => {
    try {
      await api.patch(`/roteiros/itens/${item.id}/concluir`, { concluido });
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao atualizar item do roteiro.");
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
                    onClick={() =>
                      item.tipo === "LOJA" && setLojaSelecionada(item.lojaId)
                    }
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      lojaConcluida
                        ? "border-emerald-300 bg-emerald-50"
                        : item.tipo === "ANOTACAO"
                          ? "border-blue-200 bg-blue-50"
                          : String(lojaSelecionada) === String(item.lojaId)
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
              {lojaSelecionada ? (
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
                            abrirMovimentacaoRoteiro(itemLojaSelecionada, maquina.id)
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
                  Selecione uma loja do roteiro para ver as maquinas.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
