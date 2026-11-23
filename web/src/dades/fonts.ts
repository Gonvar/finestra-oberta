// Les fonts de cada pàgina, per a «D'on surten les dades». El nom, l'enllaç i la data surten dels JSON
// que publica el workflow, i així la pàgina no pot dir una font o una data diferent de la que fa servir.
import agenda from '../../../dades/agenda.json' with { type: 'json' };
import { activitat } from './activitat.ts';
import { contractes } from './contractes.ts';
import { govern, parlament, transparencia } from './institucions.ts';
import { pressupost } from './pressupost.ts';

/**
 * - `dades`: la data en què la font va actualitzar les dades, segons la font.
 * - `consulta`: la font no publica cap data, i és el dia en què el workflow la va llegir.
 * - `copia`: el dia en què algú la va copiar a mà (només les fitxes de govern.cat).
 */
export type Data = { tipus: 'dades' | 'consulta' | 'copia'; dia: string };

export type Font = { que: string; nom: string; url: string; data: Data };

export type Seccio = { titol: string; ruta: string; fonts: Font[] };

export const seccions: Seccio[] = [
  {
    titol: 'Govern',
    ruta: '/govern/',
    fonts: [
      {
        que: 'Qui forma el Govern, quin departament porta cadascú i què cobra',
        nom: govern.font,
        url: govern.url,
        data: { tipus: 'dades', dia: govern.data_dades },
      },
      {
        que: 'El nom de cada persona amb majúscules i accents',
        nom: govern.font_noms,
        url: govern.url_noms,
        data: { tipus: 'dades', dia: govern.data_noms },
      },
      {
        que: 'La foto i el currículum',
        // font_perfils explica com es copia, amb la ruta del repositori; aquí només cal d'on surt.
        nom: 'govern.cat: el Consell Executiu',
        url: govern.url_perfils,
        data: { tipus: 'copia', dia: govern.data_perfils },
      },
      {
        que: 'Les declaracions d’activitats',
        nom: transparencia.declaracions.font,
        url: transparencia.declaracions.url,
        data: { tipus: 'dades', dia: transparencia.declaracions.data_dades },
      },
      {
        que: 'Les reunions amb grups d’interès',
        nom: transparencia.agenda.font,
        url: transparencia.agenda.url,
        data: { tipus: 'dades', dia: transparencia.agenda.data_dades },
      },
      {
        que: 'Els viatges a l’estranger',
        nom: transparencia.viatges.font,
        url: transparencia.viatges.url,
        data: { tipus: 'dades', dia: transparencia.viatges.data_dades },
      },
    ],
  },
  {
    titol: 'Parlament',
    ruta: '/parlament/',
    fonts: [
      {
        que: 'Els grups, els escons, les persones diputades i les seves fotos',
        nom: parlament.font,
        url: parlament.url,
        data: { tipus: 'consulta', dia: parlament.data_consulta },
      },
    ],
  },
  {
    titol: 'Què ha decidit el Parlament',
    ruta: '/parlament/decisions/',
    fonts: [
      {
        que: 'Les sessions del Ple i què s’hi va acordar',
        nom: activitat.font,
        url: activitat.url,
        data: { tipus: 'consulta', dia: activitat.data_consulta },
      },
      {
        que: 'Les lleis i els decrets llei',
        nom: activitat.normes.font,
        url: activitat.normes.url,
        data: { tipus: 'dades', dia: activitat.normes.data_dades },
      },
    ],
  },
  {
    titol: 'Agenda',
    ruta: '/agenda/',
    fonts: [
      {
        que: 'Els actes del Govern',
        nom: agenda.govern.font,
        url: agenda.govern.url,
        data: { tipus: 'dades', dia: agenda.govern.data_dades },
      },
      {
        que: 'Els actes del Parlament',
        nom: agenda.parlament.font,
        url: agenda.parlament.url,
        data: { tipus: 'consulta', dia: agenda.parlament.data_consulta },
      },
    ],
  },
  {
    titol: 'On van els diners de la Generalitat',
    ruta: '/pressupost/',
    fonts: [
      {
        que: 'Quant pot gastar la Generalitat i a què ho dedica',
        nom: pressupost.font_despeses,
        url: pressupost.url_despeses,
        data: { tipus: 'dades', dia: pressupost.data_despeses },
      },
      {
        que: 'D’on surten els diners',
        nom: pressupost.font_ingressos,
        url: pressupost.url_ingressos,
        data: { tipus: 'dades', dia: pressupost.data_ingressos },
      },
    ],
  },
  {
    titol: 'Com contracten les administracions',
    ruta: '/contractes/',
    fonts: [
      {
        que: 'Quants contractes han adjudicat les administracions, per quin import i amb quin procediment',
        nom: contractes.font,
        url: contractes.url,
        data: { tipus: 'dades', dia: contractes.data_dades },
      },
    ],
  },
];
