import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import { confirmar } from "../utils/alerts";

const videoInicial = {
  titulo: "",
  categoria: "",
  link: "",
  descricao: "",
  tipoUsuario: "TODOS",
  ativo: true,
};

const extrairYoutubeId = (link) => {
  const match = String(link || "").match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/,
  );
  return match?.[1] || "";
};

export function Treinamentos() {
  const { usuario } = useAuth();
  const isAdmin = ["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role);
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [mostrarFormVideo, setMostrarFormVideo] = useState(false);
  const [mostrarMensagens, setMostrarMensagens] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formVideo, setFormVideo] = useState(videoInicial);
  const [feedback, setFeedback] = useState({ tipo: "OBSERVACAO", mensagem: "" });
  const [filtros, setFiltros] = useState({ nome: "", categoria: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const carregarDados = async () => {
    try {
      setLoading(true);
      const videosRes = await api.get("/treinamentos/videos");
      setVideos(videosRes.data || []);
      if (isAdmin) {
        const feedbacksRes = await api.get("/treinamentos/feedbacks");
        setFeedbacks(feedbacksRes.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar treinamentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const salvarVideo = async (event) => {
    event.preventDefault();
    try {
      setError("");
      if (editando) {
        await api.put(`/treinamentos/videos/${editando.id}`, formVideo);
        setSuccess("Treinamento atualizado.");
      } else {
        await api.post("/treinamentos/videos", formVideo);
        setSuccess("Treinamento cadastrado.");
      }
      setFormVideo(videoInicial);
      setEditando(null);
      setMostrarFormVideo(false);
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao salvar treinamento.");
    }
  };

  const editarVideo = (video) => {
    setEditando(video);
    setFormVideo({
      titulo: video.titulo || "",
      categoria: video.categoria || "",
      link: video.link || "",
      descricao: video.descricao || "",
      tipoUsuario: video.tipoUsuario || "TODOS",
      ativo: video.ativo !== false,
    });
    setMostrarFormVideo(true);
  };

  const excluirVideo = async (id) => {
    const confirmado = await confirmar({
      title: "Remover treinamento?",
      text: "Este vídeo não aparecerá mais para os usuários.",
      confirmButtonText: "Remover",
    });
    if (!confirmado) return;
    try {
      await api.delete(`/treinamentos/videos/${id}`);
      setSuccess("Treinamento removido.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao remover treinamento.");
    }
  };

  const enviarFeedback = async (event) => {
    event.preventDefault();
    try {
      setError("");
      await api.post("/treinamentos/feedbacks", feedback);
      setFeedback({ tipo: "OBSERVACAO", mensagem: "" });
      setSuccess("Mensagem enviada para o administrador.");
      if (isAdmin) await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao enviar mensagem.");
    }
  };

  if (loading) return <PageLoader />;

  const categorias = [...new Set(videos.map((video) => video.categoria).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const videosFiltrados = videos.filter((video) => {
    const nomeBusca = filtros.nome.trim().toLowerCase();
    const categoriaBusca = filtros.categoria.trim().toLowerCase();

    if (nomeBusca && !String(video.titulo || "").toLowerCase().includes(nomeBusca)) {
      return false;
    }
    if (
      categoriaBusca &&
      String(video.categoria || "").toLowerCase() !== categoriaBusca
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Treinamentos</h1>
            <p className="mt-2 text-gray-600">
              Videos de apoio, orientacoes e melhorias enviadas pela equipe.
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMostrarMensagens((prev) => !prev)}
              >
                Ver mensagens
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setEditando(null);
                  setFormVideo(videoInicial);
                  setMostrarFormVideo(true);
                }}
              >
                Cadastrar video
              </button>
            </div>
          )}
        </div>

        {error && <AlertBox type="error" message={error} onClose={() => setError("")} />}
        {success && (
          <AlertBox type="success" message={success} onClose={() => setSuccess("")} />
        )}

        {isAdmin && mostrarMensagens && (
          <section className="mb-6 rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">Mensagens recebidas</h2>
            <div className="mt-4 space-y-3">
              {feedbacks.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-gray-900">
                      {item.usuario?.nome || "Usuario"} - {item.tipo}
                    </p>
                    <span className="text-xs text-gray-500">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                    {item.mensagem}
                  </p>
                </div>
              ))}
              {feedbacks.length === 0 && (
                <p className="text-sm text-gray-500">Nenhuma mensagem enviada.</p>
              )}
            </div>
          </section>
        )}

        <section className="mb-6 rounded-lg border border-orange-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            Enviar critica, observacao ou melhoria
          </h2>
          <form onSubmit={enviarFeedback} className="space-y-3">
            <select
              value={feedback.tipo}
              onChange={(e) => setFeedback({ ...feedback, tipo: e.target.value })}
              className="select-field max-w-xs"
            >
              <option value="OBSERVACAO">Observacao</option>
              <option value="CRITICA">Critica</option>
              <option value="MELHORIA">Melhoria</option>
            </select>
            <textarea
              value={feedback.mensagem}
              onChange={(e) => setFeedback({ ...feedback, mensagem: e.target.value })}
              className="input-field min-h-28"
              placeholder="Escreva aqui o que pode melhorar..."
              required
            />
            <div className="flex justify-end">
              <button type="submit" className="btn-primary">
                Enviar mensagem
              </button>
            </div>
          </form>
        </section>

        <section className="mb-6 rounded-lg border border-orange-100 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Filtros</h2>
            <p className="text-sm text-gray-600">
              Pesquise treinamentos pelo nome do video ou pela categoria.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Nome do video
              </label>
              <input
                value={filtros.nome}
                onChange={(e) => setFiltros({ ...filtros, nome: e.target.value })}
                className="input-field"
                placeholder="Buscar por titulo..."
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Categoria
              </label>
              <select
                value={filtros.categoria}
                onChange={(e) =>
                  setFiltros({ ...filtros, categoria: e.target.value })
                }
                className="select-field"
              >
                <option value="">Todas</option>
                {categorias.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {videosFiltrados.map((video) => {
            const youtubeId = extrairYoutubeId(video.link);
            return (
              <article key={video.id} className="rounded-lg border border-orange-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-orange-700">
                      {video.categoria}
                    </p>
                    <h2 className="text-xl font-bold text-gray-900">{video.titulo}</h2>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      Para: {video.tipoUsuario} {video.ativo ? "" : "- Inativo"}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button className="btn-secondary text-sm" onClick={() => editarVideo(video)}>
                        Editar
                      </button>
                      <button className="btn-danger text-sm" onClick={() => excluirVideo(video.id)}>
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
                {youtubeId ? (
                  <div className="aspect-video overflow-hidden rounded-lg border border-slate-200">
                    <iframe
                      className="h-full w-full"
                      src={`https://www.youtube.com/embed/${youtubeId}`}
                      title={video.titulo}
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <a className="font-bold text-orange-700 underline" href={video.link} target="_blank" rel="noreferrer">
                    Abrir video
                  </a>
                )}
                {video.descricao && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                    {video.descricao}
                  </p>
                )}
              </article>
            );
          })}
        </section>

        {videos.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-gray-600">
            Nenhum treinamento cadastrado ainda.
          </div>
        )}
        {videos.length > 0 && videosFiltrados.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-gray-600">
            Nenhum treinamento encontrado com estes filtros.
          </div>
        )}

        {isAdmin && mostrarFormVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <form
              onSubmit={salvarVideo}
              className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-orange-100 bg-white p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  {editando ? "Editar video" : "Cadastrar video"}
                </h2>
                <button type="button" className="btn-secondary" onClick={() => setMostrarFormVideo(false)}>
                  Fechar
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input className="input-field" placeholder="Titulo" value={formVideo.titulo} onChange={(e) => setFormVideo({ ...formVideo, titulo: e.target.value })} required />
                <input className="input-field" placeholder="Categoria" value={formVideo.categoria} onChange={(e) => setFormVideo({ ...formVideo, categoria: e.target.value })} required />
                <input className="input-field md:col-span-2" placeholder="Link do YouTube" value={formVideo.link} onChange={(e) => setFormVideo({ ...formVideo, link: e.target.value })} required />
                <select className="select-field" value={formVideo.tipoUsuario} onChange={(e) => setFormVideo({ ...formVideo, tipoUsuario: e.target.value })}>
                  <option value="TODOS">Todos</option>
                  <option value="ADMIN">Administrador</option>
                  <option value="FUNCIONARIO">Funcionario</option>
                </select>
                <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-gray-700">
                  <input type="checkbox" checked={formVideo.ativo} onChange={(e) => setFormVideo({ ...formVideo, ativo: e.target.checked })} />
                  Ativo
                </label>
                <textarea className="input-field min-h-24 md:col-span-2" placeholder="Descricao" value={formVideo.descricao} onChange={(e) => setFormVideo({ ...formVideo, descricao: e.target.value })} />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setMostrarFormVideo(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar video
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
