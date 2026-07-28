import mascoteMicoLeao from "../assets/MascoteMicoLeao.png";

export function LoadingSpinner({ size = "md", message = "Carregando..." }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative">
        <div className={`${sizeClasses[size]} spinner border-4`}></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={mascoteMicoLeao}
            alt="Mascote Mico Leao"
            className="h-10 w-10 animate-bounce object-contain"
          />
        </div>
      </div>

      {message && (
        <p className="text-gray-600 font-medium animate-pulse">{message}</p>
      )}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background-light to-accent-cream/30 bg-pattern flex items-center justify-center">
      <div className="card-gradient text-center p-8">
        <div className="relative inline-block mb-6">
          <div className="w-20 h-20 spinner border-4"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={mascoteMicoLeao}
              alt="Mascote Mico Leao"
              className="h-14 w-14 animate-bounce object-contain"
            />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">
          <span className="text-gradient">Mico Leao</span>
        </h2>
        <p className="text-gray-600 animate-pulse">Carregando seu sistema...</p>
      </div>
    </div>
  );
}

export function EmptyState({
  icon = "📦",
  title,
  description,
  message,
  action,
}) {
  return (
    <div className="card text-center py-12">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6">{description || message}</p>
      {action && (
        <div>
          {typeof action === "object" && action.label ? (
            <button onClick={action.onClick} className="btn-primary">
              {action.label}
            </button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}
