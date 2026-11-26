// La part de la pàgina del transport que surt de l'històric. Es llegeix al navegador perquè
// s'actualitza cada mitja hora i la web només es compila un cop al dia.
// Cada operador té la seva secció: Rodalies i FGC no fan servir el mateix criteri i no s'han de
// llegir com si es poguessin comparar.
import { useEffect, useId, useState } from 'react';
import {
  avui,
  HISTORIC,
  horaDe,
  momentDe,
  nomDia,
  nomDiaCurt,
  percentatge,
  sumaLinies,
  totals,
  ultimsDies,
  type Dia,
  type LiniaFgc,
  type LiniaRodalies,
  type Resum,
} from '../dades/transport.ts';

type Estat = { tipus: 'carregant' } | { tipus: 'error' } | { tipus: 'llest'; resum: Resum };
type Dies = 1 | 7 | 30;

const PERIODES: { dies: Dies; nom: string }[] = [
  { dies: 1, nom: '1 dia' },
  { dies: 7, nom: '7 dies' },
  { dies: 30, nom: '30 dies' },
];

/** «Avui» només si el dia més recent és avui: si el workflow s'ha aturat, és un altre dia. */
const elDia = (dia: string) => (dia === avui() ? 'Avui' : `El ${nomDia(dia)}`);

/**
 * Amb pocs trens, un percentatge exagera: 2 de 2 és un 100 % que pesa més a la vista que 5 de 22.
 * Per sota d'aquest nombre només es diuen els trens, sense barra.
 */
export const POCS_TRENS = 10;

const trens = (n: number) => (n === 1 ? '1 tren' : `${n} trens`);

export default function Transport() {
  const [estat, setEstat] = useState<Estat>({ tipus: 'carregant' });
  const [dies, setDies] = useState<Dies>(7);

  useEffect(() => {
    fetch(`${HISTORIC}/resum.json`, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<Resum>;
      })
      .then((resum) => setEstat({ tipus: 'llest', resum }))
      .catch(() => setEstat({ tipus: 'error' }));
  }, []);

  if (estat.tipus === 'carregant')
    return (
      <p className="explica" role="status">
        Carregant les dades…
      </p>
    );
  if (estat.tipus === 'error')
    return (
      <p className="explica" role="alert">
        Ara no es poden carregar les dades. Torna-ho a provar d'aquí a una estona.
      </p>
    );

  const { ara } = estat.resum;
  const periode = estat.resum.dies.slice(0, dies);
  const trentaDies = ultimsDies(estat.resum.dies, 30);
  const rod = totals(Object.entries(ara.rodalies.linies));
  const fgc = 'linies' in ara.fgc ? totals(Object.entries(ara.fgc.linies)) : null;
  const selector = { dies, setDies, periode };

  return (
    <>
      <section className="seccio" aria-labelledby="rodalies-titol">
        <h2 className="titol-seccio" id="rodalies-titol">
          Rodalies
        </h2>
        <p className="valor">
          {rod.amb_retard_de_5_min_o_mes} de {rod.trens}
        </p>
        <p className="que">
          trens que circulaven a les {horaDe(ara.consultat)} portaven 5 minuts o més de retard,
          segons Renfe.{' '}
          {rod.cancellats === 0
            ? 'Cap no estava cancel·lat.'
            : `N'hi havia ${rod.cancellats} més de cancel·lats.`}
          {rod.sense_retard_publicat > 0 &&
            ` De ${trens(rod.sense_retard_publicat)} més, Renfe no en publicava el retard.`}
        </p>
        <h3 className="titol-bloc">Trens amb 5 minuts o més de retard, per línia</h3>
        <Periode {...selector} />
        <Linies
          linies={sumaLinies<LiniaRodalies>(periode, 'rodalies').map(([linia, l]) => ({
            linia,
            part: l.amb_retard_de_5_min_o_mes,
            total: l.trens,
            nota: [
              l.cancellats && `${l.cancellats} cancel·lats`,
              l.sense_retard_publicat && `${l.sense_retard_publicat} sense dada`,
            ]
              .filter(Boolean)
              .join(' · '),
          }))}
        />
        <Columnes
          titol="Dia a dia"
          etiqueta="Amb 5 min o més"
          dies={trentaDies}
          xifra={(d) => {
            const t = totals(Object.entries(d.rodalies));
            return [t.amb_retard_de_5_min_o_mes, t.trens];
          }}
        />
      </section>

      <section className="seccio" aria-labelledby="fgc-titol">
        <h2 className="titol-seccio" id="fgc-titol">
          FGC
        </h2>
        {fgc === null ? (
          <p className="que">A les {horaDe(ara.consultat)}, FGC no donava la posició dels trens.</p>
        ) : (
          <>
            <p className="valor">
              {fgc.fora_d_hora} de {fgc.trens}
            </p>
            <p className="que">
              trens que circulaven a les {horaDe(ara.consultat)} no anaven en hora, segons FGC.
              {fgc.sense_dada > 0 && ` De ${trens(fgc.sense_dada)} més, FGC no ho deia.`}
            </p>
          </>
        )}
        <h3 className="titol-bloc">Trens que no han anat en hora, per línia</h3>
        <Periode {...selector} />
        <Linies
          linies={sumaLinies<LiniaFgc>(periode, 'fgc').map(([linia, l]) => ({
            linia,
            part: l.fora_d_hora,
            total: l.trens,
            nota: l.sense_dada ? `${l.sense_dada} sense dada` : '',
          }))}
        />
        <Columnes
          titol="Dia a dia"
          etiqueta="Fora d'hora"
          dies={trentaDies}
          xifra={(d) => {
            const t = totals(Object.entries(d.fgc));
            return [t.fora_d_hora, t.trens];
          }}
        />
      </section>

      <section className="seccio" aria-labelledby="tmb-titol">
        <h2 className="titol-seccio" id="tmb-titol">
          Metro de TMB
        </h2>
        <p className="valor">{ara.tmb.metro.length}</p>
        <p className="que">
          {ara.tmb.metro.length === 1 ? 'avís' : 'avisos'} al metro a les {horaDe(ara.consultat)}.
          TMB no publica els retards.
        </p>
        <AvisosMetro avisos={ara.tmb.metro} />
      </section>

      <p className="font-dada">
        Fonts: <a href="https://data.renfe.com/dataset/horarios-viaje-cercanias">Renfe</a>,{' '}
        <a href="https://dadesobertes.fgc.cat/explore/dataset/posicionament-dels-trens/">FGC</a> i{' '}
        <a href="https://developer.tmb.cat">TMB</a>. Darrera foto {momentDe(ara.consultat)}.
      </p>
    </>
  );
}

function Periode(props: { dies: Dies; setDies: (d: Dies) => void; periode: Dia[] }) {
  const nom = useId();
  const primer = props.periode.at(-1);
  const darrer = props.periode[0];
  return (
    <>
      <fieldset className="periode">
        <legend className="visualment-amagat">Període</legend>
        {PERIODES.map((p) => (
          <label key={p.dies}>
            <input
              type="radio"
              name={nom}
              checked={props.dies === p.dies}
              onChange={() => props.setDies(p.dies)}
            />
            {p.nom}
          </label>
        ))}
      </fieldset>
      {primer && darrer && (
        <p className="secundari">
          {primer === darrer
            ? `${elDia(primer.dia)}, fins a les ${horaDe(primer.darrera)}.`
            : `Del ${nomDia(primer.dia)} al ${nomDia(darrer.dia)}, fins a les ${horaDe(darrer.darrera)}.`}
        </p>
      )}
    </>
  );
}

type Fila = { linia: string; part: number; total: number; nota: string };

/** Una fila per línia: el codi, la barra i la xifra. Amb pocs trens, només la xifra. */
function Linies({ linies }: { linies: Fila[] }) {
  return (
    <ol className="linies">
      {linies.map(({ linia, part, total, nota }) => {
        const pocs = total < POCS_TRENS;
        return (
          <li key={linia}>
            <span className="codi-linia">{linia}</span>
            {pocs ? (
              <span className="pocs">pocs trens</span>
            ) : (
              <span className="barra" aria-hidden="true">
                <span className="ple" style={{ width: `${(part / total) * 100}%` }} />
              </span>
            )}
            <span className="xifra">
              {part} de {trens(total)}
              {!pocs && <strong> · {percentatge(part, total)}</strong>}
              {nota && <span className="secundari"> · {nota}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Columnes(props: {
  titol: string;
  etiqueta: string;
  dies: Dia[];
  xifra: (d: Dia) => [number, number];
}) {
  const files = props.dies.map((d) => {
    const [part, total] = props.xifra(d);
    return { d, part, total, p: percentatge(part, total) };
  });
  const darrer = files.at(-1);
  return (
    <figure className="columnes">
      <figcaption className="titol-bloc">{props.titol}</figcaption>
      <div className="grafic" aria-hidden="true">
        <span className="referencia" style={{ bottom: '50%' }}>
          50&nbsp;%
        </span>
        <div className="eix">
          {files.map(({ d, part, total }) => (
            <span key={d.dia} className="columna">
              {total >= POCS_TRENS && (
                <span className="ple" style={{ height: `${(part / total) * 100}%` }} />
              )}
            </span>
          ))}
        </div>
      </div>
      <p className="secundari eix-dates" aria-hidden="true">
        <span>{files[0] && nomDiaCurt(files[0].d.dia)}</span>
        <span>{darrer && `${elDia(darrer.d.dia)}, fins a les ${horaDe(darrer.d.darrera)}`}</span>
      </p>
      <details>
        <summary>Les xifres de cada dia</summary>
        <div className="taula">
          <table>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col">{props.etiqueta}</th>
                <th scope="col">Trens</th>
                <th scope="col">Part</th>
              </tr>
            </thead>
            <tbody>
              {[...files].reverse().map(({ d, part, total, p }) => (
                <tr key={d.dia}>
                  <th scope="row">{nomDia(d.dia)}</th>
                  <td>{part}</td>
                  <td>{total}</td>
                  <td>{total < POCS_TRENS ? '—' : p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

type AvisMetro = Resum['ara']['tmb']['metro'][number];

/**
 * Els avisos per línia, tal com els publica TMB. Un avís que afecta dues línies surt a totes dues, i
 * un que no en diu cap surt a part: la llista té tots els avisos de la xifra de dalt.
 */
function AvisosMetro({ avisos }: { avisos: AvisMetro[] }) {
  const perLinia = new Map<string, AvisMetro[]>();
  for (const a of avisos)
    for (const l of a.linies.length ? a.linies : ['Sense línia']) {
      perLinia.set(l, [...(perLinia.get(l) ?? []), a]);
    }
  const linies = [...perLinia].sort(([a], [b]) =>
    a === 'Sense línia'
      ? 1
      : b === 'Sense línia'
        ? -1
        : a.localeCompare(b, 'ca', { numeric: true }),
  );
  return (
    <ul className="avisos">
      {linies.map(([linia, llista]) => (
        <li key={linia}>
          <details>
            <summary>
              <span className="codi-linia">{linia}</span>
              {llista.length === 1 ? '1 avís' : `${llista.length} avisos`}
            </summary>
            <ul>
              {llista.map((a) => (
                <li key={a.id} className="secundari">
                  {a.estacions.length > 0 && `${a.estacions.join(', ')}: `}
                  {a.textos.join(' ')}
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}
