import { toast } from 'sonner';

type Props = { text: string };

export default function Copia({ text }: Props) {
  async function copia() {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copiat');
    } catch {
      // El navegador pot negar el porta-retalls (permisos, pàgina sense focus): el text segueix a la vista.
      toast("No s'ha pogut copiar. Selecciona el text i copia'l a mà.");
    }
  }

  return (
    <button type="button" className="copia" onClick={copia}>
      Copia
    </button>
  );
}
