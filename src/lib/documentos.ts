// Tipos de documento clínico imprimible y sus plantillas.

export interface TipoDoc {
  value: string
  label: string
  titulo: string           // título que sale impreso
  usaDestinatario?: boolean
  plantilla: (paciente: string) => string
}

export const TIPOS_DOCUMENTO: TipoDoc[] = [
  {
    value: 'certificado',
    label: 'Certificado médico',
    titulo: 'CERTIFICADO MÉDICO',
    plantilla: (p) =>
      `Por medio de la presente certifico que el/la paciente ${p} ha sido evaluado(a) en la fecha indicada.\n\n` +
      `Se recomienda reposo por ____ día(s) a partir de hoy.\n\n` +
      `Se expide el presente certificado a solicitud de la parte interesada, para los fines que estime convenientes.`,
  },
  {
    value: 'referimiento',
    label: 'Referimiento médico',
    titulo: 'REFERIMIENTO MÉDICO',
    usaDestinatario: true,
    plantilla: (p) =>
      `Estimado(a) colega:\n\n` +
      `Remito a usted al/la paciente ${p} para su evaluación y manejo.\n\n` +
      `Motivo del referimiento: \n\n` +
      `Resumen clínico: \n\n` +
      `Agradezco de antemano su valoración.`,
  },
  {
    value: 'orden_laboratorio',
    label: 'Orden de laboratorio',
    titulo: 'ORDEN DE LABORATORIO',
    plantilla: () =>
      `Estudios solicitados:\n` +
      `- \n` +
      `- \n` +
      `- \n\n` +
      `Indicaciones: `,
  },
  {
    value: 'orden_imagenes',
    label: 'Orden de imágenes diagnósticas',
    titulo: 'ORDEN DE IMÁGENES DIAGNÓSTICAS',
    plantilla: () =>
      `Estudio solicitado: \n\n` +
      `Indicaciones clínicas: `,
  },
  {
    value: 'otro',
    label: 'Otro documento',
    titulo: 'DOCUMENTO',
    plantilla: () => ``,
  },
]

export function tipoDocDef(t: string): TipoDoc {
  return TIPOS_DOCUMENTO.find((x) => x.value === t) ?? TIPOS_DOCUMENTO[TIPOS_DOCUMENTO.length - 1]
}
export function labelDoc(t: string): string {
  return tipoDocDef(t).label
}
