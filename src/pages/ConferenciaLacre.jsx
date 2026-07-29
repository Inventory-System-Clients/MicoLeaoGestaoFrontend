import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { AlertBox, PageHeader } from "../components/UIComponents";
import { filtrarLojasOperacionais } from "../utils/lojas";

const formatarDataHora = (dataIso) => {
  if (!dataIso) return "-";
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR");
};

export default function ConferenciaLacre() {
  const { usuario, loading: authLoading } = useAuth();

  const [lojas, setLojas] = useState([]);
  const [lojaId, setLojaId] = useState("");
  const [lacresPendentes, setLacresPendentes] = useState([]);
  const [numerosDigitados, setNumerosDigitados] = useState({});
  const [resultados, setResultados] = useState({});
  const [loading, setLoading] = useState(true);
  const [conferindoId, setConferindoId] = useState(null);
  const [error, setError] = useState("");

  const carregarLojas = useCallback(async () => {
    try {
      setError("");
      const response = await api.get("/lojas");
      const lojasData = filtrarLojasOperacionais(
        Array.isArray(response.data) ? response.data : [],
      );
      setLojas(lojasData);
      setLojaId((atual) => atual || lojasData[0]?.id || "");
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar lojas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    carregarLojas();
  }, [authLoading, carregarLojas]);

  const carregarPendentes = useCallback(async () => {
    if (!lojaId) {
      setLacresPendentes([]);
      return;
    }
    try {
      setError("");
      const response = await api.get("/lacres/pendentes", {
        params: { lojaId },
      });
      setLacresPendentes(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.error || "Erro ao carregar lacres pendentes",
      );
    }
  }, [lojaId]);

  useEffect(() => {
    carregarPendentes();
  }, [carregarPendentes]);

  const handleConferir = async (lacreId) => {
    const numeroDigitado = numerosDigitados[lacreId];
    if (!numeroDigitado || !numeroDigitado.trim()) {
      setError("Digite o número do lacre para conferir.");
      return;
    }

    try {
      setConferindoId(lacreId);
      setError("");
      const response = await api.patch(`/lacres/${lacreId}/conferir`, {
        numeroDigitado,
      });
      setResultados((prev) => ({ ...prev, [lacreId]: response.data.status }));

      // Só recarrega a lista quando confere com sucesso (o item some da
      // fila de pendentes). Quando diverge, mantém o card visível com o
      // aviso — ele só some da fila depois que um admin reabrir o lacre.
      if (response.data.status !== "DIVERGENTE") {
        await carregarPendentes();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao conferir lacre");
    } finally {
      setConferindoId(null);
    }
  };

  if (loading || authLoading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Conferência de Lacre"
          subtitle={`Usuário: ${usuario?.nome || "-"} (${usuario?.role || "-"})`}
          icon="🔏"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}

        <div className="card">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Loja
          </label>
          <select
            value={lojaId}
            onChange={(e) => setLojaId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
          >
            {lojas.map((loja) => (
              <option key={loja.id} value={loja.id}>
                {loja.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Remessas aguardando conferência ({lacresPendentes.length})
          </h2>

          {lacresPendentes.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nenhuma remessa em trânsito para esta loja.
            </p>
          ) : (
            <div className="space-y-3">
              {lacresPendentes.map((lacre) => (
                <div
                  key={lacre.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <p className="text-sm text-gray-700">
                    Despachado em{" "}
                    {formatarDataHora(lacre.envio?.despachadoEm)} — levado por{" "}
                    {lacre.envio?.transportador?.nome || "-"}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {lacre.itens
                      .map(
                        (item) =>
                          `${item.quantidade}x ${item.produto?.nome || "-"}`,
                      )
                      .join(", ")}
                  </p>

                  {resultados[lacre.id] === "DIVERGENTE" ? (
                    <AlertBox
                      type="error"
                      message="Número não confere. Contate o depósito."
                    />
                  ) : (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        value={numerosDigitados[lacre.id] || ""}
                        onChange={(e) =>
                          setNumerosDigitados((prev) => ({
                            ...prev,
                            [lacre.id]: e.target.value,
                          }))
                        }
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        placeholder="Número do lacre físico"
                      />
                      <button
                        type="button"
                        onClick={() => handleConferir(lacre.id)}
                        disabled={conferindoId === lacre.id}
                        className="btn-primary text-sm disabled:opacity-60"
                      >
                        {conferindoId === lacre.id
                          ? "Conferindo..."
                          : "Conferir"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
