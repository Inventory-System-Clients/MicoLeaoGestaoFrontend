import { useEffect, useState } from "react";
import { AlertBox } from "../components/UIComponents";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

export function ModoSeguranca() {
  const { usuario, logout } = useAuth();
  const podeAtivar = ["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role);
  const [status, setStatus] = useState(null);
  const [senha, setSenha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const carregarStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get("/modo-seguranca");
      setStatus(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar modo seguranca.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarStatus();
  }, []);

  const ativar = async () => {
    try {
      setSubmitting(true);
      setError("");
      const response = await api.post("/modo-seguranca/ativar", { senha, motivo });
      setStatus(response.data);
      setSuccess("Modo seguranca ativado. Todos foram bloqueados.");
      setSenha("");
      logout();
      window.location.href = "/login";
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao ativar modo seguranca.");
    } finally {
      setSubmitting(false);
    }
  };

  const desativar = async () => {
    try {
      setSubmitting(true);
      setError("");
      const response = await api.post("/modo-seguranca/desativar", { senha });
      setStatus(response.data);
      setSuccess("Sistema voltou ao normal.");
      setSenha("");
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao desativar modo seguranca.");
    } finally {
      setSubmitting(false);
    }
  };

  const dataAtivacao = status?.ativadoEm
    ? new Date(status.ativadoEm).toLocaleString("pt-BR")
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-10 text-white">
      <main className="w-full max-w-2xl rounded-lg border border-red-500/40 bg-neutral-900 p-6 shadow-2xl">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-wide text-red-300">
            /modo-seguranca
          </p>
          <h1 className="mt-2 text-3xl font-bold">Modo Segurança</h1>
          <p className="mt-2 text-sm text-neutral-300">
            Controle de emergência para travar o sistema inteiro.
          </p>
        </div>

        {error && <AlertBox type="error" message={error} onClose={() => setError("")} />}
        {success && (
          <AlertBox type="success" message={success} onClose={() => setSuccess("")} />
        )}

        {loading ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center">
            Carregando...
          </div>
        ) : (
          <>
            <section
              className={`mb-5 rounded-lg border p-4 ${
                status?.ativo
                  ? "border-red-400 bg-red-950/70"
                  : "border-emerald-400 bg-emerald-950/40"
              }`}
            >
              <h2 className="text-xl font-bold">
                {status?.ativo ? "Sistema travado" : "Sistema normal"}
              </h2>
              {status?.ativo && (
                <div className="mt-3 space-y-1 text-sm text-red-100">
                  <p>Ativado por: {status.ativadoPor?.nome || "usuario"}</p>
                  {dataAtivacao && <p>Data: {dataAtivacao}</p>}
                  {status.motivo && <p>Motivo: {status.motivo}</p>}
                </div>
              )}
            </section>

            <section className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-200">
                  Senha de segurança
                </label>
                <input
                  className="input-field bg-white text-gray-900"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite a senha"
                />
              </div>

              {!status?.ativo && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-neutral-200">
                    Motivo
                  </label>
                  <textarea
                    className="input-field min-h-24 bg-white text-gray-900"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Explique por que o sistema precisa ser travado."
                  />
                </div>
              )}

              {!status?.ativo ? (
                <button
                  type="button"
                  disabled={submitting || !podeAtivar}
                  className="w-full rounded-lg bg-red-600 px-5 py-4 text-base font-bold text-white shadow-lg transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={ativar}
                >
                  Derrubar tudo
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  className="w-full rounded-lg bg-emerald-600 px-5 py-4 text-base font-bold text-white shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={desativar}
                >
                  Voltar ao normal
                </button>
              )}

              {!podeAtivar && !status?.ativo && (
                <p className="text-center text-sm text-red-200">
                  Para derrubar o sistema, entre com um usuario admin ou desenvolvedor.
                </p>
              )}
              {status?.ativo && (
                <p className="text-center text-sm text-neutral-300">
                  Para voltar, nao precisa estar logado. Basta informar a senha.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
