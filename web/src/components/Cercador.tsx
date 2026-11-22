import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Command } from 'cmdk';
import { Dialog } from '@base-ui/react/dialog';
import './cercador.css';

type Enllac = { nom: string; href: string };

type Props = {
  exemple: string;
  preguntes: string[];
  respostes: Enllac[];
  llocs: Enllac[];
};

function Lupa() {
  return (
    <svg className="lupa" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="m11 11 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function Cercador({ exemple, preguntes, respostes, llocs }: Props) {
  const [obert, setObert] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [camp, setCamp] = useState('');
  const desti = useRef<HTMLElement | null>(null);

  function obre(text: string) {
    setConsulta(text);
    setObert(true);
  }

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      // L'emplenament automàtic de Chrome envia keydown sense `key`, i cridar-hi un mètode petaria.
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setConsulta('');
        setObert((ara) => !ara);
      }
    }
    function boto() {
      setConsulta('');
      setObert(true);
    }
    document.addEventListener('keydown', tecla);
    document.addEventListener('obre-cercador', boto);
    // Els botons de la barra surten desactivats de l'HTML perquè un clic abans que l'illa escolti es perdria.
    for (const b of document.querySelectorAll<HTMLButtonElement>('[data-obre-cercador]'))
      b.disabled = false;
    return () => {
      document.removeEventListener('keydown', tecla);
      document.removeEventListener('obre-cercador', boto);
    };
  }, []);

  function envia(e: FormEvent) {
    e.preventDefault();
    obre(camp);
  }

  function ves(href: string) {
    if (!href.startsWith('#')) {
      window.location.href = href;
      return;
    }
    // En tancar-se, el diàleg torna el focus a qui l'ha obert i la pàgina hi torna a saltar.
    // Per evitar-ho, no torna el focus enlloc i, quan ja és tancat, la pàgina va a la secció.
    const seccio = document.querySelector<HTMLElement>(href);
    if (seccio === null) throw new Error(`No hi ha cap secció ${href} a la pàgina.`);
    desti.current = seccio;
    history.pushState(null, '', href);
    setObert(false);
  }

  function enTancarse(ara: boolean) {
    const seccio = desti.current;
    if (ara || seccio === null) return;
    desti.current = null;
    seccio.tabIndex = -1;
    seccio.focus({ preventScroll: true });
    seccio.scrollIntoView();
  }

  return (
    <>
      {/* Sense JavaScript, o abans que s'hidrati, enviar porta al bloc on es pot preguntar a una IA. */}
      <form className="cercador" role="search" action="#ia" onSubmit={envia}>
        <Lupa />
        <input
          type="search"
          aria-label="Què vols saber?"
          placeholder={exemple}
          value={camp}
          onChange={(e) => setCamp(e.target.value)}
          enterKeyHint="search"
        />
        <button type="submit" className="pregunta">
          Pregunta
        </button>
      </form>
      <ul className="xips" aria-label="Preguntes freqüents">
        {preguntes.map((p) => (
          <li key={p}>
            <button type="button" className="xip" onClick={() => obre(p)}>
              {p}
            </button>
          </li>
        ))}
      </ul>

      <Dialog.Root open={obert} onOpenChange={setObert} onOpenChangeComplete={enTancarse}>
        <Dialog.Portal>
          <Dialog.Backdrop className="paleta-fons" />
          <Dialog.Popup className="paleta" finalFocus={() => desti.current === null}>
            <Dialog.Title className="visualment-amagat">Cerca</Dialog.Title>
            <Command label="Cerca">
              <div className="paleta-camp">
                <Lupa />
                <Command.Input
                  value={consulta}
                  onValueChange={setConsulta}
                  aria-label="Què vols saber?"
                  placeholder="Què vols saber?"
                />
              </div>
              <Command.List className="paleta-llista">
                <Command.Group heading="Respostes d'exemple">
                  {respostes.map((r) => (
                    <Command.Item key={r.href} value={r.nom} onSelect={() => ves(r.href)}>
                      {r.nom}
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Group heading="A la pàgina">
                  {llocs.map((l) => (
                    <Command.Item key={l.href} value={l.nom} onSelect={() => ves(l.href)}>
                      {l.nom}
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Item forceMount value="ia" onSelect={() => ves('#ia')}>
                  Pregunta-ho a la teva IA
                </Command.Item>
              </Command.List>
            </Command>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
