import { useEffect } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Mapa do ponto (Leaflet + OpenStreetMap, sem chave de API).
// locais: áreas cadastradas (círculo do raio)
// pontos: [{ id, latitude, longitude, cor, titulo, descricao }] — batidas/pessoas
// aoClicar(lat, lng): para marcar um local no mapa
// selecionado: { latitude, longitude, raioMetros } — local sendo editado
const CENTRO_PADRAO = [-23.5505, -46.6333];

function AjustarVisao({ coordenadas }) {
  const map = useMap();
  const chave = coordenadas.map((c) => c.join(",")).join("|");
  useEffect(() => {
    if (coordenadas.length === 1) map.setView(coordenadas[0], 16);
    else if (coordenadas.length > 1) map.fitBounds(coordenadas, { padding: [30, 30], maxZoom: 16 });
    // Só quando os pontos mudam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return null;
}

function CliqueNoMapa({ aoClicar }) {
  useMapEvents({ click: (evento) => aoClicar?.(evento.latlng.lat, evento.latlng.lng) });
  return null;
}

export function MapaPonto({
  locais = [],
  pontos = [],
  aoClicar,
  selecionado,
  altura = 320,
  enquadrar = "tudo",
}) {
  const coordenadas = [
    ...pontos.map((p) => [p.latitude, p.longitude]),
    ...(enquadrar === "tudo" ? locais.map((l) => [l.latitude, l.longitude]) : []),
    ...(selecionado ? [[selecionado.latitude, selecionado.longitude]] : []),
  ].filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

  return (
    // isolate: as camadas do Leaflet (z-index 400+) não passam por cima de
    // modais e listas abertas da página
    <div className="isolate overflow-hidden rounded-xl border border-gray-200" style={{ height: altura }}>
      <MapContainer
        center={coordenadas[0] || CENTRO_PADRAO}
        zoom={13}
        scrollWheelZoom={false}
        className={`h-full w-full ${aoClicar ? "cursor-crosshair" : ""}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AjustarVisao coordenadas={coordenadas} />
        {aoClicar && <CliqueNoMapa aoClicar={aoClicar} />}

        {locais.map((local) => (
          <Circle
            key={local.id}
            center={[local.latitude, local.longitude]}
            radius={local.raioMetros}
            pathOptions={{ color: "#f97316", fillOpacity: 0.12, weight: 2 }}
          >
            <Tooltip>{local.nome} · raio {local.raioMetros} m</Tooltip>
          </Circle>
        ))}

        {selecionado && (
          <Circle
            center={[selecionado.latitude, selecionado.longitude]}
            radius={selecionado.raioMetros || 200}
            pathOptions={{ color: "#2563eb", fillOpacity: 0.2, weight: 3, dashArray: "6 6" }}
          />
        )}

        {pontos.map((ponto) => (
          <CircleMarker
            key={ponto.id}
            center={[ponto.latitude, ponto.longitude]}
            radius={9}
            pathOptions={{ color: "#fff", weight: 2, fillColor: ponto.cor || "#2563eb", fillOpacity: 1 }}
          >
            {ponto.titulo && <Tooltip>{ponto.titulo}</Tooltip>}
            {ponto.descricao && <Popup>{ponto.descricao}</Popup>}
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export default MapaPonto;
