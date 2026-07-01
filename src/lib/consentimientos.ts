// Plantillas de consentimiento informado para Amatista Dental.
// El texto es editable antes de firmar; estas son solo bases frecuentes.

export interface PlantillaConsentimiento {
  tipo: string
  titulo: string
  texto: string
}

export const CONSENTIMIENTOS_PLANTILLAS: PlantillaConsentimiento[] = [
  {
    tipo: 'general',
    titulo: 'Consentimiento informado — Tratamiento odontológico',
    texto:
      'Declaro que he sido informado(a) de forma clara y comprensible sobre el diagnóstico ' +
      'de mi condición bucodental y el plan de tratamiento propuesto, así como de sus ' +
      'objetivos, beneficios, riesgos, posibles complicaciones y alternativas.\n\n' +
      'Entiendo que la odontología no es una ciencia exacta y que no se me han garantizado ' +
      'resultados. He tenido la oportunidad de hacer preguntas y todas han sido respondidas ' +
      'satisfactoriamente.\n\n' +
      'Autorizo al profesional y a su equipo a realizar el tratamiento acordado, así como ' +
      'los procedimientos complementarios que resulten necesarios durante su ejecución. ' +
      'Me comprometo a seguir las indicaciones y a asistir a los controles programados.',
  },
  {
    tipo: 'extraccion',
    titulo: 'Consentimiento informado — Extracción dental',
    texto:
      'Se me ha explicado la necesidad de realizar la extracción de una o más piezas ' +
      'dentales. Comprendo los riesgos asociados a este procedimiento, que pueden incluir ' +
      'dolor, inflamación, sangrado, infección, alveolitis (alvéolo seco), lesión de ' +
      'estructuras vecinas, comunicación con el seno maxilar o parestesia temporal o ' +
      'permanente.\n\n' +
      'He recibido las indicaciones postoperatorias y me comprometo a cumplirlas. ' +
      'Autorizo la realización de la extracción y la administración de anestesia local.',
  },
  {
    tipo: 'endodoncia',
    titulo: 'Consentimiento informado — Endodoncia (tratamiento de conducto)',
    texto:
      'Se me ha informado que requiero un tratamiento de conducto para conservar la pieza ' +
      'dental afectada. Entiendo que el tratamiento puede requerir varias sesiones y que, ' +
      'pese a realizarse correctamente, existe la posibilidad de fracaso que podría obligar ' +
      'a repetir el tratamiento, realizar una cirugía apical o extraer la pieza.\n\n' +
      'Comprendo que la pieza tratada quedará más frágil y que generalmente necesitará una ' +
      'corona posterior para protegerla. Autorizo la realización del tratamiento.',
  },
  {
    tipo: 'ortodoncia',
    titulo: 'Consentimiento informado — Tratamiento de ortodoncia',
    texto:
      'He sido informado(a) sobre el plan de tratamiento de ortodoncia, su duración estimada, ' +
      'los aparatos a utilizar y los cuidados necesarios. Entiendo que el éxito depende en ' +
      'gran medida de mi colaboración: higiene adecuada, uso de elásticos/aditamentos y ' +
      'asistencia a los controles.\n\n' +
      'Conozco los posibles riesgos: descalcificación y caries por mala higiene, reabsorción ' +
      'radicular, molestias, y recidiva si no se usan los retenedores indicados al finalizar. ' +
      'Autorizo el inicio del tratamiento ortodóntico.',
  },
  {
    tipo: 'datos',
    titulo: 'Consentimiento — Manejo de datos personales',
    texto:
      'Autorizo a Amatista Dental a recopilar y tratar mis datos personales y clínicos con la ' +
      'finalidad de brindarme atención odontológica, dar seguimiento a mi tratamiento y ' +
      'gestionar citas, facturación y recordatorios.\n\n' +
      'Entiendo que mi información será tratada de forma confidencial y no será compartida con ' +
      'terceros salvo obligación legal o autorización expresa de mi parte.',
  },
]
