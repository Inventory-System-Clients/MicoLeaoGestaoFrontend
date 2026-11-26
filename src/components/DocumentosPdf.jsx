import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { enviarPdfParaCloudinary, LIMITE_PDF_MB } from "../utils/cloudinary";
import { confirmar } from "../utils/alerts";

// Documentos em PDF de uma loja (contratos) ou de um projeto de loja.
// `base` = "/lojas/<id>" ou "/projetos-loja/<id>" (rotas .../documentos).
// O PDF vai do navegador direto para o Cloudinary; a API guarda o link.

const tamanhoLegivel = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const dataBr = (valor) => (valor ? new Date(valor).toLocaleDateString("pt-BR") : "");

export function DocumentosPdf({ base, titulo = "📄 Documentos (PDF)", sugestao = "Ex.: Contrato 2026", podeEditar = true }) {
  const [documentos, setDocumentos] = useState(null);
  const [nome, setNome] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [chaveInput, setChaveInput] = useState(0);

  const carregar = useCallback(() => {
    api
      .get(`${base}/documentos`)
      .then(({ data }) => setDocumentos(Array.isArray(data) ? data : []))
      .catch((error) => {
        setDocumentos([]);
        setErro(error?.response?.data?.error || "Não foi possível carregar os documentos.");
      });
  }, [base]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const enviar = async () => {
    setErro("");
    if (!arquivo) return setErro("Escolha o arquivo PDF.");
    const tituloFinal = nome.trim() || arquivo.name.replace(/\.pdf$/i, "");
    setEnviando(true);
    try {
      const url = await enviarPdfParaCloudinary(arquivo);
      await api.post(`${base}/documentos`, {
        titulo: tituloFinal,
        url,
        nomeArquivo: arquivo.name,
        tamanho: arquivo.size,
      });
      setNome("");
      setArquivo(null);
      setChaveInput((n) => n + 1);
      carregar();
    } catch (error) {
      setErro(error?.response?.data?.error || error.message || "Não foi possível enviar o PDF.");
    } finally {
      setEnviando(false);
    }
  };

  const remover = async (documento) => {
    const ok = await confirmar({
      title: "Remover documento?",
      text: `"${documento.titulo}" sai da lista.`,
      confirmButtonText: "Remover",
    });
    if (!ok) return;
    try {
      await api.delete(`${base}/documentos/${documento.id}`);
      carregar();
    } catch (error) {
      setErro(error?.response?.data?.error || "Não foi possível remover.");
    }
  };

  return (
    <div className="card space-y-3 text-left">
      <h3 className="text-lg font-bold text-gray-900">{titulo}</h3>

      {documentos === null ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : documentos.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum documento enviado.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {documentos.map((documento) => (
            <li key={documento.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <a
                  href={documento.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary hover:underline"
                >
                  📄 {documento.titulo}
                </a>
                <p className="text-xs text-gray-500">
                  {[dataBr(documento.created_at || documento.createdAt), documento.enviadoPor?.nome, tamanhoLegivel(documento.tamanho)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => remover(documento)}
                  className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeEditar && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-sm font-semibold text-gray-700">
            Nome do documento
            <input
              className="input-field mt-1"
              value={nome}
              maxLength={150}
              onChange={(e) => setNome(e.target.value)}
              placeholder={sugestao}
            />
          </label>
          <label className="block text-sm font-semibold text-gray-700">
            Arquivo PDF (até {LIMITE_PDF_MB} MB)
            <input
              key={chaveInput}
              type="file"
              accept="application/pdf,.pdf"
              className="mt-1 block w-full text-sm"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            />
          </label>
          <button type="button" className="btn-primary" onClick={enviar} disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar PDF"}
          </button>
        </div>
      )}

      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
    </div>
  );
}

export default DocumentosPdf;
