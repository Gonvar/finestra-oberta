// Dibuixa els límits de l'ICGC en SVG. Només canvia com es veuen, no la dada: la geometria original
// és a dades/mapa-municipis.json, i aquí es projecta i es treuen els punts que no es veurien.
type Posicio = number[];
type Geometria = { type: string; coordinates: unknown };

// Una projecció plana amb el cosinus de la latitud del centre de Catalunya: a aquesta escala no es
// distingeix d'una projecció cartogràfica, i no cal cap llibreria.
const LAT_CENTRE = 41.7;
const ESCALA = 280;
const COS = Math.cos((LAT_CENTRE * Math.PI) / 180);
// Un punt a menys d'aquesta distància de l'anterior no es veu a la mida del mapa.
const DISTANCIA_MINIMA = 1.2;

const projecta = ([lon, lat]: Posicio) => [lon! * COS * ESCALA, -lat! * ESCALA] as const;

function anells(g: Geometria): Posicio[][] {
  if (g.type === 'Polygon') return g.coordinates as Posicio[][];
  if (g.type === 'MultiPolygon') return (g.coordinates as Posicio[][][]).flat();
  throw new Error(`Geometria inesperada: ${g.type}.`);
}

/** El camí SVG d'un municipi, en coordenades del mapa. */
export function cami(g: Geometria) {
  return anells(g)
    .map((anell) => {
      const punts: (readonly [number, number])[] = [];
      for (const p of anell.map(projecta)) {
        const darrer = punts.at(-1);
        if (darrer && Math.hypot(p[0] - darrer[0], p[1] - darrer[1]) < DISTANCIA_MINIMA) continue;
        punts.push(p);
      }
      return `M${punts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
    })
    .join('');
}

/** El rectangle que ocupen tots els municipis, per al viewBox. */
export function marc(geometries: Geometria[]) {
  const punts = geometries.flatMap((g) => anells(g).flat().map(projecta));
  const xs = punts.map((p) => p[0]);
  const ys = punts.map((p) => p[1]);
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const x of xs) [x0, x1] = [Math.min(x0, x), Math.max(x1, x)];
  for (const y of ys) [y0, y1] = [Math.min(y0, y), Math.max(y1, y)];
  return [x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4].map((n) => n.toFixed(1)).join(' ');
}
