import { Toaster } from 'sonner';

// Fora del bloc de codi: el Toaster afegeix una secció que, dins d'un contenidor flex, ocuparia espai.
export default function Avisos() {
  return (
    <Toaster
      position="bottom-center"
      duration={2000}
      toastOptions={{
        style: {
          background: 'var(--ink)',
          color: '#fff',
          border: 0,
          borderRadius: '14px',
          fontFamily: 'var(--font)',
          fontSize: '0.9375rem',
        },
      }}
    />
  );
}
