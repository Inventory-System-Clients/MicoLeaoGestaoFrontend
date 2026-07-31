import { useState } from "react";
import { Link } from "react-router-dom";
import AlertAdmin from "../components/AlertAdmin";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";
import { PageHeader, AlertBox } from "../components/UIComponents";
import api from "../services/api";
import { useAlertas } from "../contexts/AlertasContext";

const TEMA_COR = {
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    badge: "bg-purple-100 text-purple-800 border-purple-300",
    text: "text-purple-700",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-800 border-red-300",
    text: "text-red-700",
  },
  orange: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    badge: "bg-orange-100 text-orange-800 border-orange-300",
    text: "text-orange-700",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    text: "text-amber-700",
  },
  rose: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    badge: "bg-rose-100 text-rose-800 border-rose-300",
    text: "text-rose-700",
  },
  yellow: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    badge: "bg-yellow-100 text-yellow-800 border-yellow-300",
    text: "text-yellow-700",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-800 border-blue-300",
    text: "text-blue-700",
  },
};

const formatarData = (valor) => {
  if (!valor) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleString("pt-BR");
};

const rolarParaSecao = (id) => {
  document
    .getElementById(`alerta-secao-${id}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const obterMaquinaId = (item) => item.maquina?.id || item.maquinaId;
const obterLojaId = (item) => item.loja?.id || item.lojaId;

function LinhaInfo({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <p className="text-sm text-gray-600">
      {label}: <strong>{value}</strong>
    </p>
  );
}

function ItemGenerico({ item, tipo }) {
  const maquinaId = obterMaquinaId(item);
  const lojaId = obterLojaId(item);
  const maquinaNome =
    item.maquina?.nome ||
    item.maquinaNome ||
    item.maquina?.codigo ||
    item.codigoMaquina ||
    "Máquina";
  const lojaNome = item.loja?.nome || item.lojaNome || item.maquina?.loja || "";
  const produtoNome =
    item.produto?.nome || item.produtoNome || item.nomeProduto;
  const data = formatarData(
    item.dataMovimentacao || item.dataColeta || item.createdAt,
  );

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-white/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-bold text-gray-900">
            {tipo.icone}{" "}
            {produtoNome || item.titulo || item.veiculo || maquinaNome}
          </span>
          {lojaNome && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-700">
              {lojaNome}
            </span>
          )}
        </div>
        <LinhaInfo label="Máquina" value={maquinaNome} />
        <LinhaInfo
          label="Estoque atual"
          value={item.estoqueAtual ?? item.quantidade}
        />
        <LinhaInfo
          label="Mínimo"
          value={item.estoqueMinimo ?? item.produto?.estoqueMinimo}
        />
        <LinhaInfo label="Capacidade" value={item.capacidadePadrao} />
        <LinhaInfo
          label="Mensagem"
          value={item.mensagem || item.descricao || item.observacao}
        />
        <LinhaInfo label="Data" value={data} />
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        {maquinaId && (
          <Link
            to={`/maquinas/${maquinaId}`}
            className="text-sm font-bold text-primary hover:text-primary/80"
          >
            Ver máquina →
          </Link>
        )}
        {lojaId && (
          <Link
            to={`/lojas/${lojaId}`}
            className="text-sm font-bold text-orange-700 hover:text-orange-900"
          >
            Ver loja →
          </Link>
        )}
        {[
          "manutencao",
          "manutencao-atrasada",
          "manutencao-recorrente",
        ].includes(tipo.id) && (
          <Link
            to="/manutencao"
            className="text-sm font-bold text-yellow-700 hover:text-yellow-900"
          >
            Ver manutenção →
          </Link>
        )}
        {tipo.id === "carrinho-transito" && (
          <Link
            to="/envios"
            className="text-sm font-bold text-blue-700 hover:text-blue-900"
          >
            Ver envios →
          </Link>
        )}
        {tipo.id === "lacres-divergentes" && (
          <Link
            to="/conferencia-lacre"
            className="text-sm font-bold text-red-700 hover:text-red-900"
          >
            Ver lacres divergentes →
          </Link>
        )}
        {tipo.id === "compra-pendente" && (
          <Link
            to="/compras"
            className="text-sm font-bold text-amber-700 hover:text-amber-900"
          >
            Ver compras →
          </Link>
        )}
        {tipo.id === "veiculos" && (
          <Link
            to="/veiculos"
            className="text-sm font-bold text-blue-700 hover:text-blue-900"
          >
            Ver veículos →
          </Link>
        )}
      </div>
    </article>
  );
}

export default function Alertas() {
  const { tipos, totalGeral, carregando, recarregar } = useAlertas();
  const [resolvendoId, setResolvendoId] = useState(null);
  const [erroResolucao, setErroResolucao] = useState("");

  const handleResolverLacre = async (lacreId) => {
    try {
      setErroResolucao("");
      setResolvendoId(lacreId);
      await api.patch(`/lacres/${lacreId}/resolver`);
      await recarregar();
    } catch (error) {
      setErroResolucao(
        error.response?.data?.error || "Falha ao resolver o lacre divergente",
      );
    } finally {
      setResolvendoId(null);
    }
  };

  const handleResolverDivergenciaBlink = async (registroId) => {
    try {
      setErroResolucao("");
      setResolvendoId(registroId);
      await api.patch(`/registro-dinheiro/${registroId}/resolver-alerta-blink`);
      await recarregar();
    } catch (error) {
      setErroResolucao(
        error.response?.data?.error ||
          "Falha ao resolver a divergência do Blink",
      );
    } finally {
      setResolvendoId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Alertas"
          subtitle="Painel geral de avisos ativos do sistema"
          icon="🔔"
          action={{
            label: carregando ? "Atualizando..." : "Atualizar",
            onClick: recarregar,
          }}
        />

        <section className="mb-8 rounded-lg border border-orange-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-bold uppercase text-gray-500">
            Total de alertas ativos
          </p>
          <p
            className={`mt-2 text-6xl font-black ${totalGeral > 0 ? "animate-pulse text-red-600" : "text-emerald-600"}`}
          >
            {totalGeral}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            {totalGeral > 0
              ? "Existem pontos que precisam de atenção."
              : "Nenhum alerta ativo no momento."}
          </p>
        </section>

        <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tipos.map((tipo) => {
            const tema = TEMA_COR[tipo.cor] || TEMA_COR.blue;
            return (
              <button
                key={tipo.id}
                type="button"
                onClick={() => rolarParaSecao(tipo.id)}
                className={`rounded-lg border-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${tema.bg} ${tema.border}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-2xl">{tipo.icone}</span>
                  <span
                    className={`text-2xl font-black ${tipo.total > 0 ? `${tema.text} animate-pulse` : "text-gray-400"}`}
                  >
                    {tipo.total}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-800">{tipo.label}</p>
              </button>
            );
          })}
        </section>

        {erroResolucao && (
          <div className="mb-4">
            <AlertBox
              type="error"
              message={erroResolucao}
              onClose={() => setErroResolucao("")}
            />
          </div>
        )}
        {tipos.map((tipo) => {
          const tema = TEMA_COR[tipo.cor] || TEMA_COR.blue;
          return (
            <section
              key={tipo.id}
              id={`alerta-secao-${tipo.id}`}
              className={`mb-6 rounded-lg border p-5 shadow-sm ${tema.bg} ${tema.border}`}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                  <span className="text-2xl">{tipo.icone}</span>
                  {tipo.label}
                </h2>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${tema.badge}`}
                >
                  {tipo.total} {tipo.total === 1 ? "alerta" : "alertas"}
                </span>
              </div>

              {tipo.id === "movimentacao" ? (
                <AlertAdmin />
              ) : tipo.total === 0 ? (
                <div className="rounded-lg border border-dashed border-white/90 bg-white/60 p-8 text-center text-sm text-gray-500">
                  Nenhum alerta neste tipo.
                </div>
              ) : tipo.id === "lacres-divergentes" ? (
                <div className="space-y-3">
                  {tipo.itens.map((item) => (
                    <article
                      key={item.id}
                      className="flex flex-col gap-3 rounded-lg border border-red-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{item.titulo}</p>
                        <p className="text-sm text-gray-600">{item.mensagem}</p>
                        {item.lojaNome && (
                          <p className="text-sm text-gray-600">
                            Loja: <strong>{item.lojaNome}</strong>
                          </p>
                        )}
                        {item.createdAt && (
                          <p className="text-sm text-gray-600">
                            Registrado em:{" "}
                            <strong>{formatarData(item.createdAt)}</strong>
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleResolverLacre(item.id)}
                        disabled={resolvendoId === item.id}
                        className="btn-secondary text-sm disabled:opacity-60"
                      >
                        {resolvendoId === item.id
                          ? "Resolvendo..."
                          : "Marcar como resolvido"}
                      </button>
                    </article>
                  ))}
                </div>
              ) : tipo.id === "divergencia-blink" ? (
                <div className="space-y-3">
                  {tipo.itens.map((item) => (
                    <article
                      key={item.id}
                      className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{item.titulo}</p>
                        <p className="text-sm text-gray-600">{item.mensagem}</p>
                        {item.lojaNome && (
                          <p className="text-sm text-gray-600">
                            Loja: <strong>{item.lojaNome}</strong>
                          </p>
                        )}
                        {item.createdAt && (
                          <p className="text-sm text-gray-600">
                            Registrado em:{" "}
                            <strong>{formatarData(item.createdAt)}</strong>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <Link
                          to="/registrar-dinheiro"
                          className="text-sm font-bold text-amber-700 hover:text-amber-900"
                        >
                          Ver registros →
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleResolverDivergenciaBlink(item.id)}
                          disabled={resolvendoId === item.id}
                          className="btn-secondary text-sm disabled:opacity-60"
                        >
                          {resolvendoId === item.id
                            ? "Resolvendo..."
                            : "Marcar como resolvido"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {tipo.itens.map((item, index) => (
                    <ItemGenerico
                      key={item.id || `${tipo.id}-${index}`}
                      item={item}
                      tipo={tipo}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>
      <Footer />
    </div>
  );
}
