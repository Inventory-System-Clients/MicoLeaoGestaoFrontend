import React, { useState } from "react";
import api from "../services/api";

const RegistrarDinheiro = ({ lojas, maquinas, onSubmit }) => {
  const obterMesAnteriorPadrao = () => {
    const hoje = new Date();
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const ano = mesAnterior.getFullYear();
    const mes = String(mesAnterior.getMonth() + 1).padStart(2, "0");

    return `${ano}-${mes}`;
  };

  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [maquinaSelecionada, setMaquinaSelecionada] = useState("");
  const [registrarTotalLoja, setRegistrarTotalLoja] = useState(false);
  const [mesReferencia, setMesReferencia] = useState(obterMesAnteriorPadrao);
  const [valorDinheiro, setValorDinheiro] = useState("");
  const [valorCartaoPix, setValorCartaoPix] = useState("");
  const [percentualTaxaCartaoMedia, setPercentualTaxaCartaoMedia] =
    useState("");
  const [observacoes, setObservacoes] = useState("");
  const [gastosVariaveis, setGastosVariaveis] = useState([]);

  const obterPeriodoDoMes = (valorMes) => {
    if (!valorMes) return null;

    const [anoTexto, mesTexto] = valorMes.split("-");
    const ano = Number(anoTexto);
    const mes = Number(mesTexto);

    if (
      !Number.isInteger(ano) ||
      !Number.isInteger(mes) ||
      mes < 1 ||
      mes > 12
    ) {
      return null;
    }

    const inicio = new Date(ano, mes - 1, 1, 0, 0, 0);
    const fim = new Date(ano, mes, 0, 23, 59, 59);

    const formatarDataHoraLocal = (data) => {
      const pad = (numero) => String(numero).padStart(2, "0");

      return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}:${pad(data.getSeconds())}`;
    };

    return {
      inicio: formatarDataHoraLocal(inicio),
      fim: formatarDataHoraLocal(fim),
    };
  };

  const parseLocaleNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    // Aceita formatos como 10,50 e 1.234,56 sem quebrar o parse no backend.
    const normalized = raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw;
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleAddGasto = () => {
    setGastosVariaveis([
      ...gastosVariaveis,
      { nome: "", valor: "", observacao: "" },
    ]);
  };

  const handleRemoveGasto = (idx) => {
    setGastosVariaveis(gastosVariaveis.filter((_, i) => i !== idx));
  };

  const handleChangeGasto = (idx, field, value) => {
    setGastosVariaveis(
      gastosVariaveis.map((g, i) => (i === idx ? { ...g, [field]: value } : g)),
    );
  };

  const handleLojaChange = (e) => {
    setLojaSelecionada(e.target.value);
    setMaquinaSelecionada("");
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    const periodoSelecionado = obterPeriodoDoMes(mesReferencia);

    // Garantir que campos obrigatÃ³rios estejam preenchidos corretamente
    if (!lojaSelecionada || !periodoSelecionado) {
      alert("Preencha todos os campos obrigatÃ³rios: loja e mÃªs de fechamento.");
      return;
    }

    const dinheiroNumero = parseLocaleNumber(valorDinheiro);
    const cartaoPixNumero = parseLocaleNumber(valorCartaoPix);
    const taxaMediaNumero = parseLocaleNumber(percentualTaxaCartaoMedia);

    if (valorDinheiro !== "" && dinheiroNumero === null) {
      alert("Valor de dinheiro invÃ¡lido.");
      return;
    }

    if (valorCartaoPix !== "" && cartaoPixNumero === null) {
      alert("Valor de cartÃ£o/pix invÃ¡lido.");
      return;
    }

    if (percentualTaxaCartaoMedia !== "" && taxaMediaNumero === null) {
      alert("Taxa mÃ©dia de cartÃ£o invÃ¡lida.");
      return;
    }

    const gastosNormalizados = registrarTotalLoja
      ? gastosVariaveis.map((gasto) => ({
          ...gasto,
          valor: parseLocaleNumber(gasto.valor),
        }))
      : [];

    if (gastosNormalizados.some((gasto) => gasto.valor === null)) {
      alert("Preencha os valores dos gastos variÃ¡veis corretamente.");
      return;
    }

    await onSubmit({
      loja: lojaSelecionada,
      maquina: registrarTotalLoja ? null : maquinaSelecionada || null,
      registrarTotalLoja,
      inicio: periodoSelecionado.inicio,
      fim: periodoSelecionado.fim,
      valorDinheiro: dinheiroNumero,
      valorCartaoPix: cartaoPixNumero,
      percentualTaxaCartaoMedia: taxaMediaNumero,
      observacoes: observacoes === "" ? null : observacoes,
      gastosVariaveis: gastosNormalizados,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: 540,
        margin: "0 auto",
        padding: 32,
        background: "#f7ecd7", // bege claro
        borderRadius: 18,
        boxShadow: "0 4px 24px #e2cfa3",
        position: "relative",
        border: "2px solid #e2cfa3",
        overflowY: "auto",
        maxHeight: "90vh",
      }}
    >
      {/* BotÃ£o Voltar no topo Ã  esquerda */}
      <button
        type="button"
        onClick={() => window.history.back()}
        style={{
          top: 16,
          left: 16,
          background: "#e2cfa3",
          color: "#a67c52",
          border: "none",
          borderRadius: 8,
          padding: "8px 18px",
          fontWeight: 600,
          fontSize: 16,
          boxShadow: "0 2px 8px #e2cfa3",
          cursor: "pointer",
        }}
      >
        â† Voltar
      </button>
      {/* PelÃºcia decorativa topo */}
      <div style={{ position: "absolute", left: -38, top: -38 }}>
        <img
          src="/public/pelucia-urso.png"
          alt="PelÃºcia"
          style={{ width: 64, height: 64 }}
        />
      </div>
      <div style={{ position: "absolute", right: -38, top: -38 }}>
        <img
          src="/public/pelucia-coelho.png"
          alt="PelÃºcia"
          style={{ width: 64, height: 64 }}
        />
      </div>
      <h2
        style={{
          fontWeight: 800,
          fontSize: 26,
          marginBottom: 18,
          color: "#a67c52",
          letterSpacing: 1,
        }}
      >
        <span role="img" aria-label="dinheiro" style={{ marginRight: 8 }}>
          ðŸ’°
        </span>
        Registrar Dinheiro
      </h2>
      {/* Gastos VariÃ¡veis - sÃ³ aparece se registrarTotalLoja estiver marcado */}
      {registrarTotalLoja && (
        <div
          style={{
            marginBottom: 18,
            background: "#fffbe6",
            border: "1.5px solid #e2cfa3",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <label style={{ fontWeight: 600, color: "#a67c52", fontSize: 17 }}>
              Gastos VariÃ¡veis:
            </label>
            <button
              type="button"
              onClick={handleAddGasto}
              style={{
                background: "#e2cfa3",
                color: "#a67c52",
                border: "none",
                borderRadius: 8,
                padding: "6px 16px",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              + Adicionar Gasto
            </button>
          </div>
          {gastosVariaveis.length === 0 && (
            <div style={{ color: "#a67c52", fontSize: 15, marginBottom: 8 }}>
              Nenhum gasto adicionado.
            </div>
          )}
          {gastosVariaveis.map((gasto, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-end",
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 2, minWidth: 120 }}>
                <label style={{ fontSize: 14, color: "#a67c52" }}>Nome</label>
                <input
                  type="text"
                  value={gasto.nome}
                  onChange={(e) =>
                    handleChangeGasto(idx, "nome", e.target.value)
                  }
                  required
                  placeholder="Ex: Energia, Limpeza..."
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: "1.5px solid #e2cfa3",
                    background: "#fdf6e9",
                    color: "#a67c52",
                    fontWeight: 500,
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <label style={{ fontSize: 14, color: "#a67c52" }}>
                  Valor (R$)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={gasto.valor}
                  onChange={(e) =>
                    handleChangeGasto(idx, "valor", e.target.value)
                  }
                  required
                  placeholder="0,00"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: "1.5px solid #e2cfa3",
                    background: "#fdf6e9",
                    color: "#a67c52",
                    fontWeight: 500,
                  }}
                />
              </div>
              <div style={{ flex: 2, minWidth: 120 }}>
                <label style={{ fontSize: 14, color: "#a67c52" }}>
                  ObservaÃ§Ã£o
                </label>
                <input
                  type="text"
                  value={gasto.observacao}
                  onChange={(e) =>
                    handleChangeGasto(idx, "observacao", e.target.value)
                  }
                  placeholder="Opcional"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: "1.5px solid #e2cfa3",
                    background: "#fdf6e9",
                    color: "#a67c52",
                    fontWeight: 500,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveGasto(idx)}
                style={{
                  background: "#fff0f0",
                  color: "#a67c52",
                  border: "1px solid #e2cfa3",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontWeight: 600,
                  fontSize: 15,
                  marginLeft: 4,
                  cursor: "pointer",
                }}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
      <label style={{ fontWeight: 600, color: "#a67c52" }}>Loja:</label>
      <select
        value={lojaSelecionada}
        onChange={handleLojaChange}
        required
        style={{
          width: "100%",
          marginTop: 6,
          padding: "10px 12px",
          borderRadius: 8,
          border: "1.5px solid #e2cfa3",
          background: "#fdf6e9",
          fontWeight: 500,
          color: "#a67c52",
          fontSize: 16,
        }}
      >
        <option value="">Selecione a loja</option>
        {lojas &&
          lojas.map((loja) => (
            <option key={loja.id} value={loja.id}>
              {loja.nome}
            </option>
          ))}
      </select>
      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <input
          type="checkbox"
          id="registrarTotalLoja"
          checked={registrarTotalLoja}
          onChange={(e) => setRegistrarTotalLoja(e.target.checked)}
          style={{ accentColor: "#e2cfa3", width: 18, height: 18 }}
        />
        <label
          htmlFor="registrarTotalLoja"
          style={{ fontSize: 15, color: "#a67c52" }}
        >
          Registrar valor total da loja (nÃ£o selecionar mÃ¡quina)
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, color: "#a67c52" }}>MÃ¡quina:</label>
        <select
          value={maquinaSelecionada}
          onChange={(e) => setMaquinaSelecionada(e.target.value)}
          style={{
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1.5px solid #e2cfa3",
            background: registrarTotalLoja ? "#f7ecd7" : "#fdf6e9",
            fontWeight: 500,
            color: "#a67c52",
            fontSize: 16,
            opacity: registrarTotalLoja ? 0.6 : 1,
          }}
          disabled={registrarTotalLoja}
        >
          <option value="">Selecione a mÃ¡quina</option>
          {maquinas &&
            (() => {
              // Encontrar a loja selecionada pelo id
              const lojaObj = lojas?.find((l) => l.id === lojaSelecionada);
              // Se for Agarramais Aeroporto, mostrar todas as mÃ¡quinas da loja
              if (
                lojaObj &&
                lojaObj.nome &&
                lojaObj.nome.trim().toLowerCase().includes("aeroporto")
              ) {
                return maquinas
                  .filter((m) => m.lojaId === lojaSelecionada)
                  .map((maquina) => (
                    <option key={maquina.id} value={maquina.id}>
                      {maquina.nome}
                    </option>
                  ));
              } else {
                // LÃ³gica padrÃ£o: sÃ³ takeball e poltrona
                return maquinas
                  .filter(
                    (m) =>
                      m.lojaId === lojaSelecionada &&
                      ((typeof m.nome === "string" &&
                        m.nome.trim().toUpperCase().endsWith("TAKEBALL")) ||
                        (typeof m.nome === "string" &&
                          m.nome.toLowerCase().includes("poltrona"))),
                  )
                  .map((maquina) => (
                    <option key={maquina.id} value={maquina.id}>
                      {maquina.nome}
                    </option>
                  ));
              }
            })()}
        </select>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, color: "#a67c52" }}>Fechamento:</label>
        <div style={{ marginTop: 6 }}>
          <label style={{ fontSize: 14, color: "#a67c52" }}>MÃªs</label>
          <input
            type="month"
            value={mesReferencia}
            onChange={(e) => setMesReferencia(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1.5px solid #e2cfa3",
              background: "#fdf6e9",
              color: "#a67c52",
              fontWeight: 500,
              minWidth: 0,
            }}
          />
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, color: "#a67c52" }}>
          Dinheiro (R$):
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={valorDinheiro}
          onChange={(e) => setValorDinheiro(e.target.value)}
          placeholder="Ex: 10,50"
          style={{
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1.5px solid #e2cfa3",
            background: "#fdf6e9",
            color: "#a67c52",
            fontWeight: 500,
            fontSize: 16,
          }}
        />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, color: "#a67c52" }}>
          CartÃ£o / Pix (R$):
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={valorCartaoPix}
          onChange={(e) => setValorCartaoPix(e.target.value)}
          placeholder="Ex: 25,90"
          style={{
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1.5px solid #e2cfa3",
            background: "#fdf6e9",
            color: "#a67c52",
            fontWeight: 500,
            fontSize: 16,
          }}
        />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, color: "#a67c52" }}>
          Taxa mÃ©dia de cartÃ£o (%):
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={percentualTaxaCartaoMedia}
          onChange={(e) => setPercentualTaxaCartaoMedia(e.target.value)}
          placeholder="Ex: 4,99"
          style={{
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1.5px solid #e2cfa3",
            background: "#fdf6e9",
            color: "#a67c52",
            fontWeight: 500,
            fontSize: 16,
          }}
        />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, color: "#a67c52" }}>
          ObservaÃ§Ãµes:
        </label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          style={{
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1.5px solid #e2cfa3",
            background: "#fdf6e9",
            color: "#a67c52",
            fontWeight: 500,
            fontSize: 16,
          }}
          rows={3}
        />
      </div>
      <div
        style={{
          color: "#a67c52",
          fontSize: 14,
          marginBottom: 18,
          background: "#fdf6e9",
          borderRadius: 8,
          padding: "10px 14px",
          border: "1px solid #e2cfa3",
        }}
      >
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li>Se marcar valor total da loja, nÃ£o selecione mÃ¡quina.</li>
          <li>
            O lanÃ§amento do dinheiro de cada mÃ¡quina nÃ£o soma no dinheiro total
            da loja.
          </li>
          <li>O dinheiro das fichas nÃ£o soma mais no valor inteiro da loja.</li>
        </ul>
      </div>
      <button
        type="submit"
        style={{
          width: "100%",
          padding: 14,
          background: "linear-gradient(90deg, #e2cfa3 0%, #f7ecd7 100%)",
          color: "#a67c52",
          border: "none",
          borderRadius: 10,
          fontWeight: "bold",
          fontSize: 18,
          boxShadow: "0 2px 8px #e2cfa3",
          letterSpacing: 1,
          marginTop: 8,
        }}
      >
        <span role="img" aria-label="pelÃºcia" style={{ marginRight: 8 }}>
          ðŸ§¸
        </span>
        Registrar
      </button>
    </form>
  );
};

export default RegistrarDinheiro;


