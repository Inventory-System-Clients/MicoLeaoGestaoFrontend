import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";

const DIAS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const formularioInicial = {
  nome: "",
  usuarioId: "",
  veiculoId: "",
  todosDias: true,
  diasSemana: [],
};

const itemInicial = { tipo: "LOJA", lojaId: "", anotacao: "" };

const textoDias = (roteiro) => {
  if (roteiro.todosDias) return "Todos os dias";
  const dias = Array.isArray(roteiro.diasSemana) ? roteiro.diasSemana : [];
  if (!dias.length) return "Sem dias definidos";
  return dias
    .map((dia) => DIAS.find((item) => item.value === Number(dia))?.label)
    .filter(Boolean)
    .join(", ");
};

const ordenarRoteiro = (roteiro) => ({
  ...roteiro,
  itens: [...(roteiro.itens || [])].sort((a, b) => a.ordem - b.ordem),
});

export function Roteiros() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === "ADMIN";
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [roteiros, setRoteiros] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [form, setForm] = useState(formularioInicial);
  const [itensForm, setItensForm] = useState({});
  const [editando, setEditando] = useState(null);
  const [dragInfo, setDragInfo] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const funcionarios = useMemo(
    () => usuarios.filter((item) => item.role === "FUNCIONARIO" && item.ativo !== false),
    [usuarios],
  );

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError("");

      const [roteirosRes, lojasRes] = await Promise.all([
        api.get("/roteiros"),
        api.get("/lojas"),
      ]);

      setRoteiros((roteirosRes.data || []).map(ordenarRoteiro));
      setLojas((lojasRes.data || []).filter((loja) => loja.ativo !== false));

      if (isAdmin) {
        const [usuariosRes, veiculosRes] = await Promise.all([
          api.get("/usuarios"),
          api.get("/veiculos"),
        ]);
        setUsuarios(usuariosRes.data || []);
        setVeiculos(veiculosRes.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar roteiros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const atualizarDias = (dia) => {
    setForm((prev) => {
      const atual = new Set(prev.diasSemana);
      if (atual.has(dia)) atual.delete(dia);
      else atual.add(dia);
      return { ...prev, diasSemana: [...atual].sort() };
    });
  };

  const criarRoteiro = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setError("");
    setSuccess("");

    try {
      if (!form.nome.trim() || !form.usuarioId) {
        setError("Informe o nome do roteiro e o funcionário.");
        return;
      }

      await api.post("/roteiros", form);
      setForm(formularioInicial);
      setSuccess("Roteiro criado com sucesso.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao criar roteiro.");
    } finally {
      setSalvando(false);
    }
  };

  const atualizarRoteiro = async (roteiroId, dados) => {
    try {
      setError("");
      await api.put(`/roteiros/${roteiroId}`, dados);
      setEditando(null);
      setSuccess("Roteiro atualizado.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao atualizar roteiro.");
    }
  };

  const excluirRoteiro = async (roteiroId) => {
    if (!window.confirm("Excluir este roteiro e todos os itens dele?")) return;
    try {
      await api.delete(`/roteiros/${roteiroId}`);
      setSuccess("Roteiro removido.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao excluir roteiro.");
    }
  };

  const alterarItemForm = (roteiroId, patch) => {
    setItensForm((prev) => ({
      ...prev,
      [roteiroId]: { ...(prev[roteiroId] || itemInicial), ...patch },
    }));
  };

  const adicionarItem = async (roteiroId) => {
    const dados = itensForm[roteiroId] || itemInicial;

    try {
      setError("");
      await api.post(`/roteiros/${roteiroId}/itens`, dados);
      setItensForm((prev) => ({ ...prev, [roteiroId]: itemInicial }));
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao adicionar item.");
    }
  };

  const excluirItem = async (itemId) => {
    try {
      await api.delete(`/roteiros/itens/${itemId}`);
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao remover item.");
    }
  };

  const moverItem = async (destinoRoteiroId, indiceDestino) => {
    if (!dragInfo || !isAdmin) return;

    const proximos = roteiros.map((roteiro) => ({
      ...roteiro,
      itens: [...(roteiro.itens || [])],
    }));
    const origem = proximos.find((roteiro) => roteiro.id === dragInfo.roteiroId);
    const destino = proximos.find((roteiro) => roteiro.id === destinoRoteiroId);
    if (!origem || !destino) return;

    const itemIndex = origem.itens.findIndex((item) => item.id === dragInfo.itemId);
    if (itemIndex < 0) return;

    const [itemMovido] = origem.itens.splice(itemIndex, 1);
    const posicao = Math.max(0, Math.min(indiceDestino, destino.itens.length));
    destino.itens.splice(posicao, 0, { ...itemMovido, roteiroId: destinoRoteiroId });

    proximos.forEach((roteiro) => {
      roteiro.itens = roteiro.itens.map((item, index) => ({ ...item, ordem: index }));
    });

    setRoteiros(proximos);
    setDragInfo(null);

    try {
      const itensAlterados = proximos.flatMap((roteiro) =>
        roteiro.itens.map((item) => ({
          id: item.id,
          roteiroId: roteiro.id,
          ordem: item.ordem,
        })),
      );

      await Promise.all(
        itensAlterados.map((item) =>
          api.put(`/roteiros/itens/${item.id}`, {
            roteiroId: item.roteiroId,
            ordem: item.ordem,
          }),
        ),
      );
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao mover item.");
      await carregarDados();
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Roteiros</h1>
          <p className="mt-2 text-gray-600">
            Organização diária de funcionários, veículos, lojas e tarefas.
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

        {isAdmin && (
          <form
            onSubmit={criarRoteiro}
            className="mb-6 rounded-lg border border-orange-100 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-4 text-lg font-bold text-gray-900">
              Criar roteiro
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Nome do roteiro *
                </label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="input-field"
                  placeholder="Ex: Rota Zona Leste"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Funcionário *
                </label>
                <select
                  value={form.usuarioId}
                  onChange={(e) => setForm({ ...form, usuarioId: e.target.value })}
                  className="select-field"
                >
                  <option value="">Selecione...</option>
                  {funcionarios.map((funcionario) => (
                    <option key={funcionario.id} value={funcionario.id}>
                      {funcionario.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Veículo
                </label>
                <select
                  value={form.veiculoId}
                  onChange={(e) => setForm({ ...form, veiculoId: e.target.value })}
                  className="select-field"
                >
                  <option value="">Sem veículo</option>
                  {veiculos.map((veiculo) => (
                    <option key={veiculo.id} value={veiculo.id}>
                      {veiculo.emoji || ""} {veiculo.nome} - {veiculo.modelo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={salvando}
                >
                  {salvando ? "Salvando..." : "Criar roteiro"}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={form.todosDias}
                  onChange={(e) =>
                    setForm({ ...form, todosDias: e.target.checked, diasSemana: [] })
                  }
                />
                Todos os dias
              </label>
              {!form.todosDias && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {DIAS.map((dia) => (
                    <button
                      type="button"
                      key={dia.value}
                      onClick={() => atualizarDias(dia.value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                        form.diasSemana.includes(dia.value)
                          ? "border-orange-500 bg-orange-100 text-orange-800"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {dia.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </form>
        )}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {roteiros.map((roteiro) => {
            const itemForm = itensForm[roteiro.id] || itemInicial;
            const editandoEste = editando?.id === roteiro.id;
            const editDias = editandoEste
              ? Array.isArray(editando.diasSemana)
                ? editando.diasSemana
                : []
              : [];

            return (
              <article
                key={roteiro.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => moverItem(roteiro.id, roteiro.itens?.length || 0)}
                className="rounded-lg border border-orange-100 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {roteiro.nome}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {roteiro.funcionario?.nome || "Sem funcionário"} ·{" "}
                      {roteiro.veiculo
                        ? `${roteiro.veiculo.emoji || ""} ${roteiro.veiculo.nome}`
                        : "Sem veículo"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-orange-700">
                      {textoDias(roteiro)}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() =>
                          setEditando(
                            editandoEste
                              ? null
                              : {
                                  id: roteiro.id,
                                  nome: roteiro.nome,
                                  usuarioId: roteiro.usuarioId,
                                  veiculoId: roteiro.veiculoId || "",
                                  todosDias: roteiro.todosDias,
                                  diasSemana: roteiro.diasSemana || [],
                                  ativo: roteiro.ativo,
                                },
                          )
                        }
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-danger text-sm"
                        onClick={() => excluirRoteiro(roteiro.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>

                {editandoEste && (
                  <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <input
                        value={editando.nome}
                        onChange={(e) =>
                          setEditando({ ...editando, nome: e.target.value })
                        }
                        className="input-field"
                      />
                      <select
                        value={editando.usuarioId}
                        onChange={(e) =>
                          setEditando({ ...editando, usuarioId: e.target.value })
                        }
                        className="select-field"
                      >
                        {funcionarios.map((funcionario) => (
                          <option key={funcionario.id} value={funcionario.id}>
                            {funcionario.nome}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editando.veiculoId}
                        onChange={(e) =>
                          setEditando({ ...editando, veiculoId: e.target.value })
                        }
                        className="select-field"
                      >
                        <option value="">Sem veículo</option>
                        {veiculos.map((veiculo) => (
                          <option key={veiculo.id} value={veiculo.id}>
                            {veiculo.emoji || ""} {veiculo.nome}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={editando.todosDias}
                          onChange={(e) =>
                            setEditando({
                              ...editando,
                              todosDias: e.target.checked,
                              diasSemana: [],
                            })
                          }
                        />
                        Todos os dias
                      </label>
                    </div>
                    {!editando.todosDias && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {DIAS.map((dia) => (
                          <button
                            type="button"
                            key={dia.value}
                            onClick={() => {
                              const atual = new Set(editDias);
                              if (atual.has(dia.value)) atual.delete(dia.value);
                              else atual.add(dia.value);
                              setEditando({
                                ...editando,
                                diasSemana: [...atual].sort(),
                              });
                            }}
                            className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                              editDias.includes(dia.value)
                                ? "border-orange-500 bg-orange-100 text-orange-800"
                                : "border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            {dia.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() => setEditando(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn-primary text-sm"
                        onClick={() => atualizarRoteiro(roteiro.id, editando)}
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                )}

                {isAdmin && (
                  <div className="mb-4 rounded-lg border border-slate-200 p-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[150px_1fr_auto]">
                      <select
                        value={itemForm.tipo}
                        onChange={(e) =>
                          alterarItemForm(roteiro.id, {
                            tipo: e.target.value,
                            lojaId: "",
                            anotacao: "",
                          })
                        }
                        className="select-field"
                      >
                        <option value="LOJA">Loja</option>
                        <option value="ANOTACAO">Anotação</option>
                      </select>
                      {itemForm.tipo === "LOJA" ? (
                        <select
                          value={itemForm.lojaId}
                          onChange={(e) =>
                            alterarItemForm(roteiro.id, { lojaId: e.target.value })
                          }
                          className="select-field"
                        >
                          <option value="">Selecione uma loja...</option>
                          {lojas.map((loja) => (
                            <option key={loja.id} value={loja.id}>
                              {loja.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={itemForm.anotacao}
                          onChange={(e) =>
                            alterarItemForm(roteiro.id, { anotacao: e.target.value })
                          }
                          className="input-field"
                          placeholder="Ex: Conferir extintor, levar troco..."
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => adicionarItem(roteiro.id)}
                        className="btn-primary"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {(roteiro.itens || []).map((item, index) => (
                    <div
                      key={item.id}
                      draggable={isAdmin}
                      onDragStart={() =>
                        setDragInfo({ itemId: item.id, roteiroId: roteiro.id })
                      }
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => moverItem(roteiro.id, index)}
                      className={`flex items-start gap-3 rounded-lg border p-3 ${
                        item.tipo === "ANOTACAO"
                          ? "border-blue-200 bg-blue-50"
                          : "border-slate-200 bg-slate-50"
                      } ${isAdmin ? "cursor-move" : ""}`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-gray-700">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900">
                          {item.tipo === "ANOTACAO"
                            ? "Anotação"
                            : item.loja?.nome || "Loja removida"}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                          {item.tipo === "ANOTACAO"
                            ? item.anotacao
                            : item.loja
                              ? [item.loja.endereco, item.loja.cidade, item.loja.estado]
                                  .filter(Boolean)
                                  .join(" · ")
                              : "Esta loja não está mais disponível"}
                        </p>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => excluirItem(item.id)}
                          className="text-sm font-bold text-red-600 hover:text-red-800"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}

                  {(!roteiro.itens || roteiro.itens.length === 0) && (
                    <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-gray-500">
                      Nenhuma loja ou anotação neste roteiro.
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        {roteiros.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-gray-600">
            Nenhum roteiro criado ainda.
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
