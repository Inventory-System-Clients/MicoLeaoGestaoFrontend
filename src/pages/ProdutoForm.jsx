import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

const EMOJIS_PELUCIA = [
  "🧸",
  "🐻",
  "🐼",
  "🐨",
  "🐰",
  "🐱",
  "🐶",
  "🐷",
  "🐯",
  "🦁",
  "🐮",
  "🐵",
  "🐣",
  "🐥",
  "🦆",
  "🐧",
  "🦉",
  "🦄",
  "🐘",
  "🦒",
];

export function ProdutoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    categoria: "",
    descricao: "",
    emoji: "🧸",
    ativo: true,
  });

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [gerandoCodigo, setGerandoCodigo] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isEdit) {
      carregarProduto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const carregarProduto = async () => {
    try {
      setLoadingData(true);
      const response = await api.get(`/produtos/${id}`);
      setFormData({
        codigo: response.data.codigo || "",
        nome: response.data.nome || "",
        categoria: response.data.categoria || "",
        descricao: response.data.descricao || "",
        emoji: response.data.emoji || "🧸",
        ativo: response.data.ativo !== undefined ? response.data.ativo : true,
      });
    } catch (error) {
      setError(
        "Erro ao carregar produto: " +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const gerarCodigoProduto = async () => {
    setGerandoCodigo(true);
    setError("");
    try {
      const response = await api.get("/produtos?incluirInativos=true");
      const codigosExistentes = new Set(
        response.data.map((p) => (p.codigo || "").trim().toUpperCase())
      );
      let numero = 1;
      let novoCodigo;
      do {
        novoCodigo = `PROD-${String(numero).padStart(3, "0")}`;
        numero += 1;
      } while (codigosExistentes.has(novoCodigo));
      setFormData((prev) => ({ ...prev, codigo: novoCodigo }));
    } catch (error) {
      setError(
        "Erro ao gerar código: " +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setGerandoCodigo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Validação
      if (!formData.codigo || formData.codigo.trim() === "") {
        setError("Por favor, informe o código do produto");
        setLoading(false);
        return;
      }

      if (!formData.nome || formData.nome.trim() === "") {
        setError("Por favor, informe o nome do produto");
        setLoading(false);
        return;
      }

      const data = {
        codigo: formData.codigo.trim(),
        nome: formData.nome.trim(),
        categoria: formData.categoria.trim(),
        emoji: formData.emoji,
        descricao: formData.descricao?.trim() || null,
        ativo: formData.ativo,
      };

      if (isEdit) {
        await api.put(`/produtos/${id}`, data);
        setSuccess("Produto atualizado com sucesso!");
      } else {
        await api.post("/produtos", data);
        setSuccess("Produto criado com sucesso!");
      }

      setTimeout(() => navigate("/produtos"), 1500);
    } catch (error) {
      setError(error.response?.data?.error || "Erro ao salvar produto");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={isEdit ? "Editar Produto" : "Novo Produto"}
          subtitle={
            isEdit
              ? "Atualize as informações do produto"
              : "Cadastre um novo produto no sistema"
          }
          icon="🧸"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && <AlertBox type="success" message={success} />}

        <div className="card-gradient">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Visual e Identificação */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clipRule="evenodd"
                  />
                </svg>
                Visual e Identificação
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Emoji do Produto
                  </label>
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-5xl">
                      {formData.emoji}
                    </div>
                    <div className="flex-1">
                      <div className="grid grid-cols-10 gap-2">
                        {EMOJIS_PELUCIA.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setFormData({ ...formData, emoji })}
                            className={`w-10 h-10 rounded-lg text-2xl hover:scale-110 transition-transform ${
                              formData.emoji === emoji
                                ? "bg-primary/20 ring-2 ring-primary"
                                : "bg-gray-100 hover:bg-gray-200"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Código do Produto *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="codigo"
                      value={formData.codigo}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="Ex: PROD-001"
                      required
                    />
                    <button
                      type="button"
                      onClick={gerarCodigoProduto}
                      className="btn-secondary whitespace-nowrap"
                      disabled={gerandoCodigo}
                      title="Gera automaticamente um código sequencial (Ex: PROD-001) que ainda não está em uso"
                    >
                      {gerandoCodigo ? "Gerando..." : "Gerar código"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: Urso de Pelúcia Grande"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Categoria *
                  </label>
                  <input
                    type="text"
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: Ursos, Coelhos, Unicórnios..."
                    list="categorias"
                    required
                  />
                  <datalist id="categorias">
                    <option value="Ursos" />
                    <option value="Coelhos" />
                    <option value="Unicórnios" />
                    <option value="Cachorros" />
                    <option value="Gatos" />
                    <option value="Outros" />
                  </datalist>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="ativo"
                      checked={formData.ativo}
                      onChange={handleChange}
                      className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary"
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      Produto Ativo
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {false && (
              <>
            {/* Estoque */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
                Controle de Estoque
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estoque Atual
                  </label>
                  <input
                    type="number"
                    name="estoque_atual"
                    value={formData.estoque_atual}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantidade total disponível em todas as máquinas
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estoque Mínimo
                  </label>
                  <input
                    type="number"
                    name="estoque_minimo"
                    value={formData.estoque_minimo}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Alerta quando o estoque atingir este valor
                  </p>
                </div>
              </div>
            </div>

              </>
            )}

            {/* Descrição */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Descrição
              </label>
              <textarea
                name="descricao"
                value={formData.descricao}
                onChange={handleChange}
                className="input-field"
                rows="3"
                placeholder="Informações adicionais sobre o produto..."
              />
            </div>

            {/* Botões */}
            <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate("/produtos")}
                className="btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Salvando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {isEdit ? "Atualizar Produto" : "Criar Produto"}
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Footer />
    </div>
  );
}
