import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { filtrarLojasOperacionais } from "../utils/lojas";

const CATEGORIAS_SUGERIDAS = [
  "Totem / Terminais de Pagamento",
  "Estoque Inicial de Pelúcias",
  "Obras, Letreiro e Cenografia",
  "Infraestrutura Elétrica e Rede",
  "Segurança (CFTV)",
  "CDU / Luvas (Shopping)",
  "Projetos, ART e Laudos",
];

const parseMoney = (value) => {
  if (value === "" || value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

let contadorLinha = 0;
const novaChave = () => `nova-${Date.now()}-${contadorLinha++}`;

const criarMaquinaVazia = () => ({
  _key: novaChave(),
  maquinaId: "",
  nome: "",
  tipo: "",
  quantidade: "1",
  custoUnitario: "",
  observacao: "",
});

const criarCustoVazio = () => ({
  _key: novaChave(),
  categoria: "",
  descricao: "",
  valor: "",
});

export function ProjetoLojaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [lojas, setLojas] = useState([]);
  const [maquinasCatalogo, setMaquinasCatalogo] = useState([]);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [nome, setNome] = useState("");
  const [lojaId, setLojaId] = useState("");
  const [status, setStatus] = useState("PLANEJAMENTO");
  const [dataPrevisaoAbertura, setDataPrevisaoAbertura] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [maquinas, setMaquinas] = useState([]);
  const [custos, setCustos] = useState([]);

  useEffect(() => {
    const carregarBase = async () => {
      try {
        const [lojasRes, maquinasRes] = await Promise.all([
          api.get("/lojas"),
          api.get("/maquinas"),
        ]);
        setLojas(filtrarLojasOperacionais(lojasRes.data || []));
        setMaquinasCatalogo(maquinasRes.data || []);
      } catch (err) {
        console.error("Erro ao carregar lojas/máquinas:", err);
      }
    };
    carregarBase();
  }, []);

  useEffect(() => {
    if (!isEdit) return;

    const carregarProjeto = async () => {
      try {
        setLoadingData(true);
        const response = await api.get(`/projetos-loja/${id}`);
        const projeto = response.data;

        setNome(projeto.nome || "");
        setLojaId(projeto.lojaId || "");
        setStatus(projeto.status || "PLANEJAMENTO");
        setDataPrevisaoAbertura(
          projeto.dataPrevisaoAbertura
            ? String(projeto.dataPrevisaoAbertura).slice(0, 10)
            : "",
        );
        setObservacoes(projeto.observacoes || "");

        setMaquinas(
          (projeto.maquinas || []).map((item) => ({
            _key: `db-${item.id}`,
            maquinaId: item.maquinaId || "",
            nome: item.nome || "",
            tipo: item.tipo || "",
            quantidade: String(item.quantidade ?? 1),
            custoUnitario: String(item.custoUnitario ?? ""),
            observacao: item.observacao || "",
          })),
        );

        setCustos(
          (projeto.custos || []).map((item) => ({
            _key: `db-${item.id}`,
            categoria: item.categoria || "",
            descricao: item.descricao || "",
            valor: String(item.valor ?? ""),
          })),
        );
      } catch (err) {
        setError(
          "Erro ao carregar projeto: " +
            (err.response?.data?.error || err.message),
        );
      } finally {
        setLoadingData(false);
      }
    };

    carregarProjeto();
  }, [id, isEdit]);

  const handleChangeMaquina = (idx, field, value) => {
    setMaquinas((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;

        if (field === "maquinaId") {
          if (!value) {
            return { ...item, maquinaId: "" };
          }
          const maquina = maquinasCatalogo.find((m) => m.id === value);
          return {
            ...item,
            maquinaId: value,
            nome: maquina?.nome || item.nome,
            custoUnitario:
              maquina?.custoAquisicao !== null &&
              maquina?.custoAquisicao !== undefined
                ? String(maquina.custoAquisicao)
                : item.custoUnitario,
            tipo: "",
            quantidade: "1",
          };
        }

        if (field === "quantidade") {
          return { ...item, quantidade: value.replace(/\D/g, "") };
        }

        if (field === "custoUnitario") {
          return { ...item, custoUnitario: value.replace(/[^0-9.,]/g, "") };
        }

        return { ...item, [field]: value };
      }),
    );
  };

  const handleAdicionarMaquina = () => {
    setMaquinas((prev) => [...prev, criarMaquinaVazia()]);
  };

  const handleRemoverMaquina = (idx) => {
    setMaquinas((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleChangeCusto = (idx, field, value) => {
    setCustos((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              [field]:
                field === "valor" ? value.replace(/[^0-9.,]/g, "") : value,
            }
          : item,
      ),
    );
  };

  const handleAdicionarCusto = () => {
    setCustos((prev) => [...prev, criarCustoVazio()]);
  };

  const handleRemoverCusto = (idx) => {
    setCustos((prev) => prev.filter((_, i) => i !== idx));
  };

  const subtotalMaquina = (item) => {
    const quantidade = item.maquinaId ? 1 : Math.max(1, parseInt(item.quantidade, 10) || 1);
    return quantidade * parseMoney(item.custoUnitario);
  };

  const totalMaquinas = useMemo(
    () => maquinas.reduce((acc, item) => acc + subtotalMaquina(item), 0),
    [maquinas],
  );

  const totalCustos = useMemo(
    () => custos.reduce((acc, item) => acc + parseMoney(item.valor), 0),
    [custos],
  );

  const totalGeral = totalMaquinas + totalCustos;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!nome.trim()) {
      setError("Informe o nome do projeto.");
      return;
    }

    const maquinasValidas = maquinas.filter((item) => item.nome.trim());
    const custosValidos = custos.filter((item) => item.categoria.trim());

    const payload = {
      nome: nome.trim(),
      lojaId: lojaId || null,
      status,
      dataPrevisaoAbertura: dataPrevisaoAbertura || null,
      observacoes: observacoes.trim() || null,
      maquinas: maquinasValidas.map((item) => ({
        maquinaId: item.maquinaId || null,
        nome: item.nome.trim(),
        tipo: item.tipo?.trim() || null,
        quantidade: item.maquinaId ? 1 : parseInt(item.quantidade, 10) || 1,
        custoUnitario: parseMoney(item.custoUnitario),
        observacao: item.observacao?.trim() || null,
      })),
      custos: custosValidos.map((item) => ({
        categoria: item.categoria.trim(),
        descricao: item.descricao?.trim() || null,
        valor: parseMoney(item.valor),
      })),
    };

    try {
      setLoading(true);
      if (isEdit) {
        await api.put(`/projetos-loja/${id}`, payload);
        setSuccess("Projeto atualizado com sucesso!");
      } else {
        await api.post("/projetos-loja", payload);
        setSuccess("Projeto criado com sucesso!");
      }
      setTimeout(() => navigate("/projetos-loja"), 1200);
    } catch (err) {
      setError(
        err.response?.data?.error || "Não foi possível salvar o projeto.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={isEdit ? "Editar Projeto de Loja" : "Novo Projeto de Loja"}
          subtitle="Planeje as máquinas e os custos de abertura da loja"
          icon="🏗️"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && <AlertBox type="success" message={success} />}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do projeto */}
          <div className="card space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Dados do projeto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Nome do projeto
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ex: Shopping Iguatemi — Unidade Nova"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Loja vinculada (opcional)
                </label>
                <select
                  className="select-field"
                  value={lojaId}
                  onChange={(e) => setLojaId(e.target.value)}
                >
                  <option value="">Sem loja vinculada ainda</option>
                  {lojas.map((loja) => (
                    <option key={loja.id} value={loja.id}>
                      {loja.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Status
                </label>
                <select
                  className="select-field"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="PLANEJAMENTO">Planejamento</option>
                  <option value="EM_ANDAMENTO">Em andamento</option>
                  <option value="CONCLUIDO">Concluído</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Previsão de abertura (opcional)
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={dataPrevisaoAbertura}
                  onChange={(e) => setDataPrevisaoAbertura(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Observações
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Máquinas do projeto */}
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-gray-900">
                🎮 Máquinas do projeto
              </h3>
              <button
                type="button"
                onClick={handleAdicionarMaquina}
                className="btn-secondary text-sm"
              >
                + Adicionar máquina
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Vincular uma máquina já existente aqui é só pra contar o custo
              dela no investimento do projeto — isso não move a máquina pra
              essa loja. Pra mover de verdade, use Transferência de Máquina.
            </p>

            {maquinas.length === 0 && (
              <p className="text-sm text-gray-500">
                Nenhuma máquina adicionada ainda.
              </p>
            )}

            <div className="space-y-3">
              {maquinas.map((item, idx) => (
                <div
                  key={item._key}
                  className="bg-gray-50 rounded-lg p-4 flex flex-col gap-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      className="select-field"
                      value={item.maquinaId}
                      onChange={(e) =>
                        handleChangeMaquina(idx, "maquinaId", e.target.value)
                      }
                    >
                      <option value="">🆕 Máquina a comprar (digitar)</option>
                      {maquinasCatalogo.map((maquina) => (
                        <option key={maquina.id} value={maquina.id}>
                          {maquina.codigo ? `${maquina.codigo} — ` : ""}
                          {maquina.nome}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      className="input-field"
                      placeholder="Nome de exibição"
                      value={item.nome}
                      onChange={(e) =>
                        handleChangeMaquina(idx, "nome", e.target.value)
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                    {!item.maquinaId && (
                      <>
                        <div>
                          <label className="mb-1 block text-xs font-bold text-gray-600">
                            Tipo
                          </label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Ex: Agarra Mais"
                            value={item.tipo}
                            onChange={(e) =>
                              handleChangeMaquina(idx, "tipo", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold text-gray-600">
                            Quantidade
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="input-field"
                            value={item.quantidade}
                            onChange={(e) =>
                              handleChangeMaquina(
                                idx,
                                "quantidade",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="mb-1 block text-xs font-bold text-gray-600">
                        Custo unitário (R$)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input-field"
                        placeholder="0,00"
                        value={item.custoUnitario}
                        onChange={(e) =>
                          handleChangeMaquina(
                            idx,
                            "custoUnitario",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-gray-600">
                        Subtotal
                      </label>
                      <p className="input-field bg-white font-semibold text-gray-700">
                        R$ {formatCurrency(subtotalMaquina(item))}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      className="input-field flex-1"
                      placeholder="Observação (opcional)"
                      value={item.observacao}
                      onChange={(e) =>
                        handleChangeMaquina(idx, "observacao", e.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoverMaquina(idx)}
                      className="text-red-600 hover:text-red-800 font-semibold text-sm px-2 whitespace-nowrap"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-right text-sm font-bold text-gray-700">
              Subtotal máquinas: R$ {formatCurrency(totalMaquinas)}
            </p>
          </div>

          {/* Outros custos do projeto */}
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-gray-900">
                💰 Outros custos do projeto
              </h3>
              <button
                type="button"
                onClick={handleAdicionarCusto}
                className="btn-secondary text-sm"
              >
                + Adicionar custo
              </button>
            </div>

            {custos.length === 0 && (
              <p className="text-sm text-gray-500">
                Nenhum custo adicionado ainda.
              </p>
            )}

            <div className="space-y-3">
              {custos.map((item, idx) => (
                <div
                  key={item._key}
                  className="bg-gray-50 rounded-lg p-4 flex flex-col md:flex-row gap-2 md:items-center"
                >
                  <input
                    type="text"
                    list="categorias-sugeridas"
                    className="input-field flex-1"
                    placeholder="Categoria (ex: Obras, Letreiro e Cenografia)"
                    value={item.categoria}
                    onChange={(e) =>
                      handleChangeCusto(idx, "categoria", e.target.value)
                    }
                  />
                  <input
                    type="text"
                    className="input-field flex-1"
                    placeholder="Descrição / detalhes (opcional)"
                    value={item.descricao}
                    onChange={(e) =>
                      handleChangeCusto(idx, "descricao", e.target.value)
                    }
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input-field md:w-36"
                    placeholder="Valor (R$)"
                    value={item.valor}
                    onChange={(e) =>
                      handleChangeCusto(idx, "valor", e.target.value)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoverCusto(idx)}
                    className="text-red-600 hover:text-red-800 font-semibold text-sm px-2 whitespace-nowrap"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>

            <datalist id="categorias-sugeridas">
              {CATEGORIAS_SUGERIDAS.map((categoria) => (
                <option key={categoria} value={categoria} />
              ))}
            </datalist>

            <p className="text-right text-sm font-bold text-gray-700">
              Subtotal outros custos: R$ {formatCurrency(totalCustos)}
            </p>
          </div>

          {/* Total geral */}
          <div className="card bg-gradient-to-br from-orange-500 to-red-600 text-white flex items-center justify-between">
            <span className="text-lg font-bold">Total investido no projeto</span>
            <span className="text-3xl font-black">
              R$ {formatCurrency(totalGeral)}
            </span>
          </div>

          <div className="flex justify-end gap-3">
            <Link to="/projetos-loja" className="btn-secondary">
              Cancelar
            </Link>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Salvando..." : "Salvar projeto"}
            </button>
          </div>
        </form>
      </div>

      <Footer />
    </div>
  );
}

export default ProjetoLojaForm;
