import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import mascoteMicoLeao from "../assets/MascoteMicoLeao.png";
import { filtrarLojasOperacionais } from "../utils/lojas";

export function IAgarraAssistente() {
  const navigate = useNavigate();
  const recognitionRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [mensagem, setMensagem] = useState("");
  const [transcricao, setTranscricao] = useState("");
  const [assistenteNome, setAssistenteNome] = useState("IA Mico");
  const [contextoPendente, setContextoPendente] = useState("");
  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);

  useEffect(() => {
    let ativo = true;

    const carregarContexto = async () => {
      try {
        const [lojasRes, maquinasRes] = await Promise.all([
          api.get("/lojas").catch(() => ({ data: [] })),
          api.get("/maquinas").catch(() => ({ data: [] })),
        ]);

        if (!ativo) return;
        setLojas(filtrarLojasOperacionais(lojasRes.data || []));
        setMaquinas(maquinasRes.data || []);
      } catch {
        if (!ativo) return;
        setLojas([]);
        setMaquinas([]);
      }
    };

    carregarContexto();

    return () => {
      ativo = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const normalizarTexto = useCallback((valor) =>
    String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim(), []);

  const encontrarLoja = useCallback(
    (texto, resultado) => {
      const acao = resultado?.acao || {};
      const prefill = acao.prefill || {};
      const query = acao.query || {};
      const ids = [
        prefill.lojaId,
        prefill.loja_id,
        query.lojaId,
        query.loja_id,
        resultado?.dados?.lojaId,
        resultado?.dados?.loja?.id,
      ].filter((valor) => valor !== undefined && valor !== null && valor !== "");

      if (ids.length > 0) return String(ids[0]);

      const textoNormalizado = normalizarTexto(texto);
      const nomes = [
        prefill.loja,
        prefill.lojaNome,
        query.loja,
        query.lojaNome,
        resultado?.dados?.lojaNome,
        resultado?.dados?.loja?.nome,
        texto,
      ]
        .filter(Boolean)
        .map(normalizarTexto);

      const loja = lojas.find((item) => {
        const nome = normalizarTexto(item.nome);
        const partes = nome.split(/\s+/).filter((parte) => parte.length >= 4);
        return (
          nomes.some((valor) => valor.includes(nome) || nome.includes(valor)) ||
          partes.some((parte) => textoNormalizado.includes(parte))
        );
      });

      return loja?.id ? String(loja.id) : "";
    },
    [lojas, normalizarTexto],
  );

  const extrairNumeroMaquina = useCallback(
    (texto) => {
      const match = normalizarTexto(texto).match(
        /maquina\s*(?:numero|n|no|#)?\s*(\d+)/,
      );
      return match?.[1] || "";
    },
    [normalizarTexto],
  );

  const encontrarMaquina = useCallback(
    (texto, resultado, lojaId) => {
      const acao = resultado?.acao || {};
      const prefill = acao.prefill || {};
      const query = acao.query || {};
      const ids = [
        prefill.maquinaId,
        prefill.maquina_id,
        query.maquinaId,
        query.maquina_id,
        resultado?.dados?.maquinaId,
        resultado?.dados?.maquina?.id,
      ].filter((valor) => valor !== undefined && valor !== null && valor !== "");

      if (ids.length > 0) return String(ids[0]);

      const numero = extrairNumeroMaquina(texto);
      if (!numero) return "";

      const maquina = maquinas
        .filter((item) => !lojaId || String(item.lojaId) === String(lojaId))
        .find((item) => {
          const codigo = normalizarTexto(item.codigo);
          const nome = normalizarTexto(item.nome);
          return (
            String(item.id) === numero ||
            codigo === numero ||
            Number(codigo) === Number(numero) ||
            nome === `maquina ${numero}` ||
            nome.endsWith(` ${numero}`) ||
            nome.includes(`maquina ${numero}`)
          );
        });

      return maquina?.id ? String(maquina.id) : "";
    },
    [extrairNumeroMaquina, maquinas, normalizarTexto],
  );

  const extrairContador = useCallback(
    (texto, tipo) => {
      const textoNormalizado = normalizarTexto(texto);
      const padrao =
        tipo === "in"
          ? /(?:contador\s*)?(?:entrada|in)\s*(\d+)/i
          : /(?:contador\s*)?(?:saida|saída|out)\s*(\d+)/i;
      return textoNormalizado.match(padrao)?.[1] || "";
    },
    [normalizarTexto],
  );

  const abrirMovimentacao = useCallback(
    (resultado, texto) => {
      const acao = resultado?.acao || {};
      const prefill = acao.prefill || {};
      const query = acao.query || {};
      const lojaId = prefill.lojaId || prefill.loja_id || query.lojaId || query.loja_id || encontrarLoja(texto, resultado);
      const maquinaId =
        prefill.maquinaId ||
        prefill.maquina_id ||
        query.maquinaId ||
        query.maquina_id ||
        encontrarMaquina(texto, resultado, lojaId);
      const contadorIn =
        prefill.contadorIn ?? query.contadorIn ?? extrairContador(texto, "in");
      const contadorOut =
        prefill.contadorOut ?? query.contadorOut ?? extrairContador(texto, "out");

      const params = new URLSearchParams({
        abrirFormulario: "true",
        modo: "nova_movimentacao",
      });

      if (lojaId) params.set("lojaId", lojaId);
      if (maquinaId) params.set("maquinaId", maquinaId);
      if (contadorIn !== undefined && contadorIn !== null && contadorIn !== "") {
        params.set("contadorIn", contadorIn);
      }
      if (contadorOut !== undefined && contadorOut !== null && contadorOut !== "") {
        params.set("contadorOut", contadorOut);
      }

      setStatus("processando");
      setMensagem("IA Mico esta abrindo a nova movimentacao...");
      navigate(`${acao.rota || "/movimentacoes"}?${params}`, {
        state: {
          lojaId,
          maquinaId,
          contadorIn: contadorIn || "",
          contadorOut: contadorOut || "",
          abrirFormulario: true,
          modo: "nova_movimentacao",
          origem: "IA Mico",
        },
      });
    },
    [encontrarLoja, encontrarMaquina, extrairContador, navigate],
  );

  const abrirRelatorio = useCallback(
    (resultado) => {
      const query = resultado?.acao?.query || {};
      const lojaId = query.lojaId || query.loja_id;
      const dataInicio = query.dataInicio || query.data_inicio;
      const dataFim = query.dataFim || query.data_fim;
      const params = new URLSearchParams();

      if (lojaId) params.set("lojaId", lojaId);
      if (dataInicio) params.set("dataInicio", dataInicio);
      if (dataFim) params.set("dataFim", dataFim);

      setStatus("processando");
      setMensagem("IA Mico esta abrindo o relatorio...");
      navigate(`/relatorios?${params}`, {
        state: {
          lojaId,
          dataInicio,
          dataFim,
          autoGerar: true,
          origem: "IA Mico",
        },
      });
    },
    [navigate],
  );

  const enviarComando = useCallback(
    async (textoTranscrito) => {
      const textoLimpo = textoTranscrito.trim();
      if (!textoLimpo) {
        setStatus("erro");
        setMensagem("IA Mico nao conseguiu entender.");
        return;
      }

      const texto = contextoPendente
        ? `${contextoPendente} ${textoLimpo}`.trim()
        : textoLimpo;

      setStatus("processando");
      setMensagem("IA Mico pensando...");

      try {
        const response = await api.post("/assistente-ia/comando", { texto });
        const resultado = response.data?.resultado || response.data;
        const assistente = response.data?.assistente || resultado?.assistente;

        if (assistente?.nome) setAssistenteNome(assistente.nome);

        if (resultado?.status === "precisa_confirmacao") {
          setContextoPendente(texto);
          setStatus("resposta");
          setMensagem(resultado?.mensagem || "IA Mico precisa de mais informacoes.");
          return;
        }

        setContextoPendente("");

        if (
          resultado?.acao?.tipo === "abrir_movimentacao" &&
          resultado?.acao?.abrirFormulario === true &&
          resultado?.acao?.modo === "nova_movimentacao"
        ) {
          abrirMovimentacao(resultado, texto);
          return;
        }

        if (
          resultado?.tipo === "relatorio-loja" &&
          resultado?.acao?.tipo === "abrir_relatorio"
        ) {
          abrirRelatorio(resultado);
          return;
        }

        if (resultado?.tipo === "navegacao" && resultado?.acao?.rota) {
          navigate(resultado.acao.rota);
          return;
        }

        setStatus("resposta");
        setMensagem(resultado?.mensagem || "IA Mico respondeu.");
      } catch (error) {
        console.error("Erro ao enviar comando para a IA Mico:", error);
        setStatus("erro");
        setMensagem(
          error.response?.data?.message ||
            error.response?.data?.error ||
            "IA Mico nao conseguiu entender.",
        );
      }
    },
    [abrirMovimentacao, abrirRelatorio, contextoPendente, navigate],
  );

  const iniciarEscuta = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus("erro");
      setMensagem("IA Mico nao conseguiu acessar o reconhecimento de voz.");
      return;
    }

    if (recognitionRef.current) recognitionRef.current.abort();

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let capturouResultado = false;

    recognition.onstart = () => {
      setStatus("ouvindo");
      setMensagem("IA Mico ouvindo...");
      setTranscricao("");
    };

    recognition.onresult = (event) => {
      capturouResultado = true;
      const texto = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      setTranscricao(texto);
      enviarComando(texto);
    };

    recognition.onerror = (event) => {
      capturouResultado = true;
      setStatus("erro");
      setMensagem(
        event.error === "not-allowed"
          ? "Permita o microfone para usar a IA Mico."
          : "IA Mico nao conseguiu entender.",
      );
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (!capturouResultado) {
        setStatus("idle");
        setMensagem("");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [enviarComando]);

  const textoBotao = {
    idle: assistenteNome,
    ouvindo: `${assistenteNome} ouvindo...`,
    processando: `${assistenteNome} pensando...`,
    erro: `${assistenteNome} nao conseguiu entender`,
    resposta: contextoPendente ? `${assistenteNome} complementar` : assistenteNome,
  }[status];

  const statusLabel = {
    idle: assistenteNome,
    ouvindo: `${assistenteNome} ouvindo...`,
    processando: `${assistenteNome} pensando...`,
    erro: `${assistenteNome} nao conseguiu entender`,
    resposta: `${assistenteNome} respondeu`,
  }[status];

  const statusClass =
    status === "ouvindo"
      ? "bg-orange-100 text-orange-800"
      : status === "processando"
        ? "bg-yellow-100 text-yellow-800"
        : status === "erro"
          ? "bg-red-100 text-red-700"
          : status === "resposta"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-100 text-slate-700";

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md no-print">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-orange-100 bg-white shadow-sm">
                <img
                  src={mascoteMicoLeao}
                  alt=""
                  className="h-12 w-12 object-cover object-top"
                  aria-hidden="true"
                />
              </span>
              <h2 className="text-xl font-bold text-gray-900">
                {assistenteNome}
              </h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {mensagem || "Clique na IA Mico e fale um comando."}
          </p>
          {transcricao && (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <span className="font-semibold">Voce disse: </span>
              {transcricao}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={iniciarEscuta}
          disabled={status === "ouvindo" || status === "processando"}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 font-bold text-white shadow-md transition-all sm:w-auto ${
            status === "erro"
              ? "bg-red-600"
              : status === "ouvindo"
                ? "bg-orange-600"
                : status === "processando"
                  ? "bg-yellow-500"
                  : "bg-slate-900 hover:bg-slate-800"
          } disabled:cursor-not-allowed disabled:opacity-85`}
          title="Falar com a IA Mico"
        >
          <svg
            className="h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 18.5a6.5 6.5 0 006.5-6.5M5.5 12a6.5 6.5 0 006.5 6.5m0 0V22m0 0h4m-4 0H8m4-7a3 3 0 003-3V5a3 3 0 10-6 0v7a3 3 0 003 3z"
            />
          </svg>
          {textoBotao}
        </button>
      </div>
    </div>
  );
}
