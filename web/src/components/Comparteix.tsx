import { useEffect, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { toast } from 'sonner';
import './comparteix.css';

type Props = {
  /** L'adreça canònica de la pàgina, amb el domini. */
  url: string;
  titol: string;
};

function xarxes(url: string, titol: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(titol);
  const tu = encodeURIComponent(`${titol} ${url}`);
  return [
    { nom: 'WhatsApp', href: `https://wa.me/?text=${tu}` },
    { nom: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}` },
    { nom: 'Bluesky', href: `https://bsky.app/intent/compose?text=${tu}` },
    { nom: 'X', href: `https://x.com/intent/post?url=${u}&text=${t}` },
  ];
}

function Icona() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 10V1.5M4.75 4.5 8 1.25l3.25 3.25M5 7H3.5v7.5h9V7H11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Comparteix({ url, titol }: Props) {
  // Amb el full de compartir del sistema (mòbils i alguns navegadors d'escriptori) no cal el menú:
  // ja hi surten totes les aplicacions de la persona. Només se sap al navegador.
  const [natiu, setNatiu] = useState(false);
  const [obert, setObert] = useState(false);

  useEffect(() => {
    setNatiu('share' in navigator && navigator.canShare({ url, title: titol }));
  }, [url, titol]);

  async function comparteixNatiu() {
    try {
      await navigator.share({ url, title: titol });
    } catch (e) {
      // Tancar el full sense triar res també és un AbortError, i no és cap error.
      if (!(e instanceof DOMException && e.name === 'AbortError')) throw e;
    }
  }

  async function copia() {
    try {
      await navigator.clipboard.writeText(url);
      toast('Enllaç copiat');
    } catch {
      // El navegador pot negar el porta-retalls (permisos, pàgina sense focus).
      toast("No s'ha pogut copiar. Copia l'adreça de la barra del navegador.");
    }
  }

  return (
    <Menu.Root
      open={obert}
      onOpenChange={(obre) => {
        if (obre && natiu) void comparteixNatiu();
        else setObert(obre);
      }}
    >
      <Menu.Trigger className="comparteix">
        <Icona />
        <span className="etiqueta-comparteix">Comparteix</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          className="comparteix-posicio"
          sideOffset={6}
          align="end"
          collisionPadding={12}
        >
          <Menu.Popup className="comparteix-menu">
            <Menu.Item className="comparteix-opcio" onClick={copia}>
              Copia l'enllaç
            </Menu.Item>
            {xarxes(url, titol).map((x) => (
              <Menu.LinkItem
                key={x.nom}
                className="comparteix-opcio"
                href={x.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {x.nom}
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
