import { useEffect, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

const formatarCotacao = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

// Financeiro > Configuração de moeda: cotação do dólar usada pra converter
// compras em US$ para real. Trocar a cotação só vale daqui pra frente —
// compras já recebidas continuam convertidas na cotação da época.
export default function ConfiguracaoMoeda() {
  const [dados, setDados] = useState(null);
  const [novaCotacao, setNovaCotacao] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const carregar = async () => {
    try {
      setLoading(true);
      const response = await api.get("/cotacoes-moeda?moeda=USD");
      setDados(response.data);
    } catch (err) {
      setError(
        "Erro ao carregar cotação: " + (err.response?.data?.error || err.message),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const valor = Number(String(novaCotacao).replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setError("Informe uma cotação maior que zero");
      return;
    }

    try {
      setSalvando(true);
      await api.post("/cotacoes-moeda", { moeda: "USD", valorEmReal: valor });
      setSuccess("Cotação atualizada! Vale a partir de agora.");
      setNovaCotacao("");
      await carregar();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao salvar cotação");
    } finally {
      setSalvando(false);
    }
  };

  if (loading && !dados) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Configuração de Moeda"
          subtitle="Cotação do dólar usada para converter compras em US$ para real"
          icon="💱"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox type="success" message={success} onClose={() => setSuccess("")} />
        )}

        <div className="card-gradient space-y-6">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-600">
              Cotação atual do dólar
            </span>
            <span className="text-3xl font-bold text-gray-900">
              US$ 1,00 = {formatarCotacao(dados?.cotacaoAtual)}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nova cotação (R$ por US$ 1,00)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={novaCotacao}
                onChange={(e) => setNovaCotacao(e.target.value.replace(/[^\d.,]/g, ""))}
                className="input-field"
                placeholder="Ex: 5,35"
              />
            </div>
            <button type="submit" className="btn-primary whitespace-nowrap" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar nova cotação"}
            </button>
          </form>
          <p className="text-xs text-gray-500">
            A nova cotação vale a partir do momento em que for salva. Compras já
            recebidas continuam convertidas na cotação da época — nada do passado
            muda.
          </p>

          {dados?.historico?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Histórico de cotações
              </h4>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Vale desde</th>
                      <th className="px-3 py-2 text-left">Cotação</th>
                      <th className="px-3 py-2 text-left">Alterado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.historico.map((item, indice) => (
                      <tr key={item.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          {new Date(item.vigenteDesde).getFullYear() <= 2000
                            ? "Início (padrão)"
                            : new Date(item.vigenteDesde).toLocaleString("pt-BR")}
                          {indice === 0 && (
                            <span className="ml-2 text-xs font-semibold text-primary">
                              atual
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">{formatarCotacao(item.valorEmReal)}</td>
                        <td className="px-3 py-2">{item.usuario?.nome || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
