import React, { useState } from "react";
import Swal from "sweetalert2";
import api from "../services/api";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500";
const labelClass = "mb-1 block text-sm font-medium text-gray-700";

export default function LancarGastoVariavel({
  lojas = [],
  veiculos = [],
  onClose,
  onSuccess,
}) {
  const [categoria, setCategoria] = useState("Gasolina");
  const [nomeOutros, setNomeOutros] = useState("");
  const [lojaId, setLojaId] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [veiculoId, setVeiculoId] = useState("");
  const [estado, setEstado] = useState("Bom");
  const [km, setKm] = useState("");
  const [modo, setModo] = useState("trabalho");
  const [combustivel, setCombustivel] = useState("5");
  const [limpeza, setLimpeza] = useState("esta limpo");

  const isGasolina = categoria === "Gasolina";
  const isOutros = categoria === "Outros";

  const veiculoSelecionado = veiculos.find((v) => v.id === veiculoId);
  const kmAtualVeiculo = Number(veiculoSelecionado?.km || 0);
  const kmValido =
    !isGasolina ||
    (km !== "" && Number.isFinite(Number(km)) && Number(km) >= kmAtualVeiculo);

  const valorValido =
    valor !== "" && Number.isFinite(Number(valor)) && Number(valor) > 0;

  const formValido =
    lojaId &&
    valorValido &&
    (!isOutros || nomeOutros.trim()) &&
    (!isGasolina || (veiculoId && kmValido));

  const handleSubmit = async () => {
    if (!formValido || salvando) return;

    setSalvando(true);
    try {
      const nome = isOutros ? nomeOutros.trim() : categoria;
      const payload = {
        lojaId,
        nome,
        valor: Number(valor),
        observacao: observacao || undefined,
      };

      if (isGasolina) {
        payload.veiculoId = veiculoId;
        payload.km = parseInt(km, 10);
        payload.estado = estado;
        payload.modo = modo;
        payload.combustivel = combustivel;
        payload.limpeza = limpeza;
      }

      await api.post("/gastos-variaveis", payload);

      Swal.fire({
        icon: "success",
        title: "Gasto lançado com sucesso!",
        showConfirmButton: true,
        confirmButtonText: "OK",
      });

      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (error) {
      console.error("Erro ao lançar gasto variável:", error);
      Swal.fire(
        "Erro",
        error?.response?.data?.error || "Não foi possível lançar o gasto.",
        "error",
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-full md:max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50">
      <div className="mb-5 rounded-3xl bg-gradient-to-r from-amber-400 to-orange-500 p-4 text-white shadow-inner">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-amber-100/90">
              🧾 Lançamento rápido
            </p>
            <h2 className="mt-2 text-2xl font-extrabold">Gasto Variável</h2>
          </div>
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-2xl shadow-sm shadow-black/5">
            💸
          </span>
        </div>
        <p className="mt-3 text-sm text-white/90">
          Use este formulário para registrar gastos operacionais com mais
          facilidade.
        </p>
      </div>

      <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Categoria
          </label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
          >
            <option value="Gasolina">⛽ Gasolina</option>
            <option value="Estacionamento">🅿️ Estacionamento</option>
            <option value="Outros">✏️ Outros</option>
          </select>
        </div>

        {isOutros && (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <label className={labelClass}>Descreva o gasto</label>
            <input
              value={nomeOutros}
              onChange={(e) => setNomeOutros(e.target.value)}
              className={inputClass}
              placeholder="Ex: Manutenção, Material de limpeza..."
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <label className={labelClass}>Loja</label>
            <select
              value={lojaId}
              onChange={(e) => setLojaId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione a loja</option>
              {lojas.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <label className={labelClass}>Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={inputClass}
              onWheel={(e) => e.target.blur()}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <label className={labelClass}>Observação</label>
          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className={inputClass}
            placeholder="Opcional"
          />
          <p className="mt-2 text-xs text-slate-500">
            Deixe uma nota rápida para ajudar no controle interno.
          </p>
        </div>

        {isGasolina && (
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <div className="flex items-center justify-between rounded-2xl bg-orange-100 px-4 py-3 text-sm font-semibold text-orange-800">
              <span>🚗 Gasolina detalhada</span>
              <span className="rounded-full bg-orange-200 px-3 py-1 text-xs uppercase tracking-[0.22em] text-orange-800">
                Exige veículo
              </span>
            </div>

            <div>
              <label className={labelClass}>Veículo</label>
              <select
                value={veiculoId}
                onChange={(e) => setVeiculoId(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione o veículo</option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Estado da moto</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className={inputClass}
                >
                  <option value="Bom">Sem avaria</option>
                  <option value="Ruim">Com avaria</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Km atual</label>
                <input
                  type="number"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  className={inputClass}
                  min={kmAtualVeiculo}
                  disabled={!veiculoId}
                  onWheel={(e) => e.target.blur()}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {veiculoId
                    ? `Mínimo: ${kmAtualVeiculo} km.`
                    : "Selecione o veículo primeiro."}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Modo</label>
                <select
                  value={modo}
                  onChange={(e) => setModo(e.target.value)}
                  className={inputClass}
                >
                  <option value="trabalho">Trabalho</option>
                  <option value="emprestado">Emprestado</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Nível de combustível</label>
                <select
                  value={combustivel}
                  onChange={(e) => setCombustivel(e.target.value)}
                  className={inputClass}
                >
                  <option value="5">5 palzinhos</option>
                  <option value="4">4 palzinhos</option>
                  <option value="3">3 palzinhos</option>
                  <option value="2">2 palzinhos</option>
                  <option value="1">1 palzinho</option>
                  <option value="0">Vazio</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Nível de limpeza</label>
              <select
                value={limpeza}
                onChange={(e) => setLimpeza(e.target.value)}
                className={inputClass}
              >
                <option value="esta limpo">Está limpo</option>
                <option value="precisa limpar">Precisa limpar</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onClose}
          disabled={salvando}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-5 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleSubmit}
          disabled={salvando || !formValido}
        >
          {salvando ? "Salvando..." : "Lançar Gasto"}
        </button>
      </div>
    </div>
  );
}
