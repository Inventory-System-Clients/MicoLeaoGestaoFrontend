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
    (km !== "" &&
      Number.isFinite(Number(km)) &&
      Number(km) >= kmAtualVeiculo);

  const valorValido = valor !== "" && Number.isFinite(Number(valor)) && Number(valor) > 0;

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
    <div className="w-full max-w-md">
      <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-gray-900">
        <span className="text-2xl" aria-hidden="true">
          💸
        </span>
        Lançar Gasto Variável
      </h2>

      <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        <div>
          <label className={labelClass}>Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className={inputClass}
          >
            <option value="Gasolina">Gasolina</option>
            <option value="Estacionamento">Estacionamento</option>
            <option value="Outros">Outros</option>
          </select>
        </div>

        {isOutros && (
          <div>
            <label className={labelClass}>Descreva o gasto</label>
            <input
              value={nomeOutros}
              onChange={(e) => setNomeOutros(e.target.value)}
              className={inputClass}
              placeholder="Ex: Manutenção, Material de limpeza..."
            />
          </div>
        )}

        <div>
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

        <div>
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

        <div>
          <label className={labelClass}>Observação</label>
          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className={inputClass}
            placeholder="Opcional"
          />
        </div>

        {isGasolina && (
          <>
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
              <p className="mt-1 text-xs text-gray-500">
                {veiculoId
                  ? `Mínimo: ${kmAtualVeiculo} km.`
                  : "Selecione o veículo primeiro."}
              </p>
            </div>

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
          </>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
        <button
          type="button"
          className="btn-secondary"
          onClick={onClose}
          disabled={salvando}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleSubmit}
          disabled={salvando || !formValido}
        >
          {salvando ? "Salvando..." : "Lançar Gasto"}
        </button>
      </div>
    </div>
  );
}
