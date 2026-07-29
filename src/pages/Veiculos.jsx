import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ControleVeiculos from "../components/ControleVeiculos";
import RegistroVeiculosMovimentacao from "../components/RegistroVeiculosMovimentacao";
import AlertasVeiculos from "../components/AlertasVeiculos";
import api from "../services/api";
import { erro, sucesso } from "../utils/alerts";

const initialFormState = {
  tipo: "moto",
  nome: "",
  modelo: "",
  km: "",
  estado: "Bom",
  emoji: "🏍️",
  emUso: false,
  parada: false,
  modo: "trabalho",
  nivelCombustivel: "5 palzinhos",
  nivelLimpeza: "está limpo",
};

export default function Veiculos() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const roteiroRetorno = {
    roteiroId: params.get("roteiroId") || "",
    veiculoId: params.get("veiculoId") || "",
  };
  const [modalCadastro, setModalCadastro] = useState(false);
  const [mostrarAlertas, setMostrarAlertas] = useState(false);
  const [form, setForm] = useState(initialFormState);
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado armazena YYYY-MM-DD para compatibilidade com input type="date"
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const veiculosEmUso = veiculos.filter((veiculo) => veiculo.emUso).length;
  const veiculosDisponiveis = veiculos.length - veiculosEmUso;

  const fetchVeiculos = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/veiculos");
      setVeiculos(data);
    } catch (error) {
      console.error("Erro ao buscar veículos:", error);
      setVeiculos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVeiculos();
  }, [fetchVeiculos]);

  const abrirModal = () => setModalCadastro(true);

  const fecharModal = () => {
    setModalCadastro(false);
    setForm(initialFormState); // Reseta o formulário ao fechar
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name === "tipo") {
        return {
          ...prev,
          [name]: value,
          emoji: value === "moto" ? "🏍️" : "🚗",
        };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/veiculos", form);
      fetchVeiculos();
      fecharModal();
      sucesso("Veículo cadastrado", "Veículo cadastrado com sucesso.");
    } catch (error) {
      console.error("Erro no cadastro:", error);
      erro("Erro ao cadastrar", "Erro ao cadastrar veículo.");
    }
  };

  // Função auxiliar para formatar a data para o componente filho (se necessário DD/MM/YYYY)
//   const getDataFormatada = () => {
//     if (!filtroData) return "";
//     const [ano, mes, dia] = filtroData.split("-");
//     return `${dia}/${mes}/${ano}`;
//   };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              ← Voltar
            </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Veículos
                </h1>
                <p className="text-sm text-slate-500">
                  Controle de retirada, devolução, conservação e quilometragem.
                </p>
              </div>
          </div>

            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs font-medium text-slate-500">Total</div>
                <div className="text-lg font-bold text-slate-900">{veiculos.length}</div>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div className="text-xs font-medium text-emerald-700">Disponíveis</div>
                <div className="text-lg font-bold text-emerald-800">{veiculosDisponiveis}</div>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                <div className="text-xs font-medium text-blue-700">Em uso</div>
                <div className="text-lg font-bold text-blue-800">{veiculosEmUso}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              onClick={abrirModal}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              + Novo Veículo
            </button>
            <button
              onClick={() => setMostrarAlertas(!mostrarAlertas)}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
            >
              {mostrarAlertas ? "Ocultar Alertas" : "Ver Alertas"}
            </button>
          </div>
        </div>

        {mostrarAlertas && (
          <div className="mb-8 animate-fadeIn">
            <AlertasVeiculos />
          </div>
        )}

        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <ControleVeiculos
              veiculos={veiculos}
              onRefresh={fetchVeiculos}
              loading={loading}
              roteiroRetorno={roteiroRetorno}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Histórico de movimentações
              </h2>
              <p className="text-sm text-slate-500">
                Filtre por período para consultar retiradas, devoluções e abastecimentos.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Início
                </label>
            <input
              type="date"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              placeholder="Data início"
            />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Fim
                </label>
            <input
              type="date"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              placeholder="Data fim"
            />
              </div>
            {(filtroDataInicio || filtroDataFim) && (
              <button
                onClick={() => {
                  setFiltroDataInicio("");
                  setFiltroDataFim("");
                }}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Limpar
              </button>
            )}
            </div>
          </div>

          {(filtroDataInicio || filtroDataFim) && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <RegistroVeiculosMovimentacao
                veiculos={veiculos}
                loading={loading}
                filtroDataInicio={filtroDataInicio}
                filtroDataFim={filtroDataFim}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal de cadastro */}
      {modalCadastro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl"
            onSubmit={handleSubmit}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Cadastrar veículo
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Informe os dados iniciais para liberar o veículo no controle.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
                onClick={fecharModal}
              >
                ✕
              </button>
            </div>

            <div className="grid gap-5 px-6 py-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Tipo
                </label>
                <select
                  name="tipo"
                  value={form.tipo}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="moto">Moto</option>
                  <option value="carro">Carro</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Nome
                </label>
                <input
                  name="nome"
                  value={form.nome}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                  placeholder="Ex: Start 160"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Modelo
                </label>
                <input
                  name="modelo"
                  value={form.modelo}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                  placeholder="Ex: Honda"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Km inicial
                </label>
                <input
                  name="km"
                  type="number"
                  value={form.km}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  min="0"
                  required
                  onWheel={(e) => e.target.blur()}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Emoji
                </label>
                <select
                  name="emoji"
                  value={form.emoji}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="🏍️">Moto 🏍️</option>
                  <option value="🚗">Carro 🚗</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Modo
                </label>
                <select
                  name="modo"
                  value={form.modo}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="trabalho">Trabalho</option>
                  <option value="emprestado">Emprestado</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Combustível
                </label>
                <select
                  name="nivelCombustivel"
                  value={form.nivelCombustivel}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="5 palzinhos">5 palzinhos</option>
                  <option value="4 palzinhos">4 palzinhos</option>
                  <option value="3 palzinhos">3 palzinhos</option>
                  <option value="2 palzinhos">2 palzinhos</option>
                  <option value="1 palzinho">1 palzinho</option>
                  <option value="Vazio">Vazio</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Limpeza
                </label>
                <select
                  name="nivelLimpeza"
                  value={form.nivelLimpeza}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="está limpo">Está limpo</option>
                  <option value="precisa limpar">Precisa limpar</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={fecharModal}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Cadastrar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
