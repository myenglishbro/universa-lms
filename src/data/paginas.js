import terminos from './legal/terminos.txt?raw'
import privacidad from './legal/privacidad.txt?raw'

// Páginas del sitio público. Contenido tomado de universa-strapi-project (src/bootstrap): programas, nosotros, metodología,
// servicios, talleres, café virtual, Sesiones On Demand y textos legales. Cada página es una lista de secciones que renderiza Landing.jsx.
export const WA_ASESOR = '51945311934'
export const WA_ADMISION = '51938403729'
export const wa = (texto, numero = WA_ASESOR) => `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
const diagnostico = (programa, numero = WA_ADMISION) =>
  wa(`Hola, vengo de la página de ${programa} en la web de Universa y quiero más información.`, numero)

const encabezado = (eyebrow, titulo, subtitulo, extra = {}) => ({ tipo: 'encabezado', eyebrow, titulo, subtitulo, ...extra })
const texto = (eyebrow, titulo, parrafos, extra = {}) => ({ tipo: 'textoImagen', eyebrow, titulo, parrafos, ...extra })
const carac = (eyebrow, titulo, subtitulo, items) => ({ tipo: 'caracteristicas', eyebrow, titulo, subtitulo, items })
const cierre = (titulo, subtitulo, label, href) => ({ tipo: 'cta', titulo, subtitulo, cta: { label, href } })

export const PROGRAMAS_MENU = [
  ['Programa Continuo Grupal', '/programa-continuo-grupal'],
  ['Programa Continuo Privado', '/programa-continuo-privado'],
  ['Programa Dynamic', '/programa-dynamic'],
  ['Flex Signature', '/programa-flex-privado'],
  ['Sesiones On Demand', '/sesiones-on-demand'],
  ['Conversation Clubs', '/conversation-clubs'],
  ['Professional Mastery Lab', '/professional-mastery-lab'],
]

const FOTOS = {
  'Programa Continuo Privado': { imagen: '/landing/continuo-privado.webp', resumen: 'Aprende a tu ritmo con un profesor particular.' },
  'Programa Continuo Grupal': { imagen: '/landing/continuo-grupal.webp', resumen: 'Aprende inglés en grupos reducidos y dinámicos.' },
  'Programa Dynamic': { imagen: '/landing/dynamic.webp', resumen: 'El formato ideal para agendas exigentes y cambiantes.' },
  'Flex Signature': { imagen: '/landing/flex-signature.webp', resumen: 'Máxima personalización con reprogramación ilimitada.' },
}

const FILAS_SERVICIOS = [
  { titulo: 'Programa Continuo Privado', modalidad: '1 a 1', grupo: 'Individual', horario: 'Preestablecido y/o programable', ideal: 'Quienes buscan ritmo constante con atención exclusiva', descripcion: 'Aprende a tu propio ritmo con la guía exclusiva de un profesor particular. Diseñado para maximizar tu tiempo de habla y enfocarse directamente en tus fortalezas y oportunidades de mejora.', href: '#/programa-continuo-privado' },
  { titulo: 'Programa Continuo Grupal', modalidad: 'Grupal', grupo: '4 a 8 personas', horario: 'Preestablecido, sincrónico', ideal: 'Quienes prefieren aprender en comunidad, con horario estable', descripcion: 'Aprende inglés interactuando en grupos reducidos. Practica con dinámicas participativas y debates, manteniendo un horario de clases fijo para asegurar constancia.', href: '#/programa-continuo-grupal' },
  { titulo: 'Programa Dynamic', modalidad: 'Grupal reducido', grupo: '1 a 6 personas', horario: 'Programable, reprogramable, rotativo cada semana', ideal: 'Quienes necesitan flexibilidad con ritmo de estudio autónomo (aula invertida)', descripcion: 'El formato ideal para agendas exigentes. Cambia tus horarios semana a semana mientras avanzas con nuestro moderno modelo híbrido de aprendizaje activo.', href: '#/programa-dynamic' },
  { titulo: 'Flex Signature', modalidad: '1 a 1 (premium)', grupo: 'Individual', horario: '100% programable', ideal: 'Objetivos específicos, plazos definidos, máxima personalización', descripcion: 'El servicio premium de Universa. Diseñado a medida para ti, con reprogramación ilimitada de clases y un currículo desarrollado exclusivamente para tus metas profesionales o académicas.', href: '#/programa-flex-privado' },
  { titulo: 'Sesiones On Demand', modalidad: 'Actividad suelta', grupo: 'Individual', horario: 'A demanda', ideal: 'Reforzar una habilidad específica sin compromiso de programa', descripcion: 'Sesiones individuales programables a la carta. Prepárate para una entrevista de trabajo, un viaje importante o una presentación específica sin atarte a un ciclo completo.', href: '#/sesiones-on-demand' },
  { titulo: 'Conversation Clubs', modalidad: 'Taller grupal', grupo: 'Grupo pequeño', horario: 'Preestablecido, agendable', ideal: 'Practicar conversación de forma recurrente', descripcion: 'Clubs de conversación guiados por un tutor para soltar la lengua, ganar fluidez y expandir tu vocabulario social y profesional en un ambiente de apoyo y debate.', href: '#/conversation-clubs' },
  { titulo: 'Professional Mastery Lab', modalidad: 'Taller especializado', grupo: 'Grupal o privado', horario: 'Según taller', ideal: 'Necesidades profesionales puntuales (negociación, entrevistas, presentaciones)', descripcion: 'Talleres prácticos intensivos enfocados en habilidades de negocio específicas. Desarrolla las destrezas de comunicación necesarias para destacar en entornos corporativos internacionales.', href: '#/professional-mastery-lab' },
]

const area = (a, publico, items) => items.map(([titulo, niveles], i) => ({ titulo, area: a, publico: Array.isArray(publico) ? publico[i] : publico, niveles }))
const CATALOGO = [
  ...area('Producción oral y fonética', ['General', 'General', 'General', 'General', 'Profesional', 'Profesional'], [['Clínica de Pronunciación (Natural Flow)', 'Niveles 1–10 (A1.1 – C1)'], ['Roleplay de Situaciones Cotidianas', 'Niveles 1–4 (A1.1 – A2.2)'], ['Storytelling Colaborativo', 'Niveles 3–7 (A2.1 – B1.3)'], ['Speed Chatting', 'Niveles 5–8 (B1.1 – B2.1)'], ['Debate de Actualidad', 'Niveles 8–10 (B2.1 – C1)'], ['Elevator Pitch Personal', 'Niveles 8–10 (B2.1 – C1)']]),
  ...area('Comprensión auditiva y crítica', ['General', 'General', 'General', 'Profesional', 'Profesional', 'Profesional'], [['Deep Dive: Video Journals de NatGeo', 'Niveles 3–5 (A2.1 – B1.1)'], ['Inmersión Documental', 'Niveles 5–7 (B1.1 – B1.3)'], ['Podcast Breakdown', 'Niveles 6–8 (B1.2 – B2.1)'], ['Decodificación de Acentos', 'Niveles 7–10 (B1.3 – C1)'], ['Business Meeting Breakdown', 'Niveles 7–10 (B1.3 – C1)'], ['Análisis de TED Talks', 'Niveles 8–10 (B2.1 – C1)']]),
  ...area('Producción escrita y corrección', ['General', 'General', 'Profesional', 'Profesional', 'Profesional'], [['Messaging & Social Media English', 'Niveles 1–4 (A1.1 – A2.2)'], ['Creative Writing Workshop', 'Niveles 4–7 (A2.2 – B1.3)'], ['Laboratorio de Corrección de Errores', 'Niveles 6–10 (B1.2 – C1)'], ['Writing Clinic: Coherencia y Cohesión', 'Niveles 6–8 (B1.2 – B2.1)'], ['Estructura de Ensayos Persuasivos', 'Niveles 8–10 (B2.1 – C1)']]),
  ...area('Comprensión lectora y vocabulario', ['Profesional', 'General', 'Profesional', 'Profesional'], [['Skimming & Scanning Mastery', 'Niveles 5–8 (B1.1 – B2.1)'], ['Análisis de Narrativas Reales', 'Niveles 5–7 (B1.1 – B1.3)'], ['Exploración de Vocabulario Académico', 'Niveles 8–10 (B2.1 – C1)'], ['Lectura Crítica de Noticias', 'Niveles 9–10 (B2.2 – C1)']]),
  ...area('Soporte lingüístico estratégico', 'General', [['Grammar in Context (Uso Real)', 'Niveles 1–10 (A1.1 – C1)'], ['Idioms & Phrasal Verbs Clinic', 'Niveles 5–10 (B1.1 – C1)']]),
  ...area('Sesiones recreativas y de inmersión social', 'Social / Recreativo', [['Games Night', 'Niveles 1–10 (A1.1 – C1)'], ['Music Time', 'Niveles 3–10 (A2.1 – C1)'], ['Movie Time', 'Niveles 3–10 (A2.1 – C1)'], ['Trivia Night: Pop Culture & Beyond', 'Niveles 3–10 (A2.1 – C1)'], ['Around the World: Cultural Exchange', 'Niveles 4–10 (A2.2 – C1)'], ['Comedy Club: Stand-Up & Memes', 'Niveles 6–10 (B1.2 – C1)']]),
]

const paquete = (titulo, descripcion, horas, precio, porHora) => ({ titulo, descripcion, horas, precio, porHora })
const PAQUETES = [
  { nombre: 'Privado 1 a 1', items: [
    paquete('1 mes · 8 h', 'Horario flexible 1:1, ideal para reforzar temas puntuales.', 8, 576, 72),
    paquete('1 mes · 12 h', 'Sesiones 1:1 para mayor ritmo y práctica continua.', 12, 768, 64),
    paquete('2 meses · 16 h', 'Refuerzo intermedio con ahorro por hora.', 16, 896, 56),
    paquete('2 meses · 24 h', 'Preparación intensiva para metas específicas.', 24, 1152, 48),
    paquete('3 meses · 36 h', 'El mejor valor por hora para fluidez sostenida.', 36, 1584, 44),
  ] },
  { nombre: 'Grupal', items: [
    paquete('1 mes · 8 h', 'Sesiones en grupo para inmersión y conversación.', 8, 416, 52),
    paquete('1 mes · 12 h', 'Conversación grupal intensiva.', 12, 528, 44),
    paquete('2 meses · 16 h', 'Socio-cultural y debates en grupo.', 16, 576, 36),
    paquete('2 meses · 24 h', 'Mayor exposición y participación activa.', 24, 672, 28),
    paquete('3 meses · 36 h', 'Sostenimiento de inmersión social a largo plazo.', 36, 864, 24),
  ] },
]

const TALLERES = [
  {
    nombre: 'Taller de Business English & Presentation Skills',
    resumen: 'Domina las presentaciones, reuniones de negocios y el networking en inglés. Ideal para profesionales.',
    descripcion: 'Este taller intensivo está diseñado para profesionales que necesitan comunicarse de manera efectiva en el entorno laboral internacional. Aprenderás técnicas clave para estructurar tus ideas, modular tu tono y captar la atención de tu audiencia en inglés. Trabajaremos con casos prácticos, vocabulario corporativo y simulación de reuniones de negocios reales.',
    syllabus: ['Introducción al Business English y estructura de presentaciones', 'Vocabulario clave para reuniones de negocios y negociaciones', 'Técnicas de lenguaje corporal y modulación de voz en inglés', 'Práctica final: presentación y retroalimentación personalizada de tu proyecto'],
    aprenderas: ['Presentar ideas comerciales con mayor convicción y estructura.', 'Utilizar vocabulario corporativo clave en inglés en negociaciones.', 'Dominar técnicas de lenguaje corporal y modulación de voz.', 'Recibir retroalimentación personalizada sobre tu proyecto de presentación.'],
    precio: 120, precioDesc: 89.99, grupal: 80, grupalDesc: 59.99,
  },
  {
    nombre: 'Taller de Pronunciación y Fluidez (Accents & Intonation)',
    resumen: 'Mejora tu entonación, conecta palabras de manera natural y reduce la fricción al hablar inglés.',
    descripcion: 'Supera el miedo a hablar y hazte entender con mayor claridad. En este taller dinámico de pronunciación nos enfocaremos en los sonidos más difíciles del inglés para hispanohablantes. Aprenderás reglas de entonación, reducción de vocales, unión de palabras (linking words) y ritmos conversacionales para que tu inglés suene mucho más natural y fluido.',
    syllabus: ['Fonética básica: consonantes y vocales críticas del inglés', 'El ritmo del inglés: palabras con acento y reducción vocálica (Schwa)', 'Linking words: conexión de sonidos para una mayor fluidez', 'Práctica interactiva: grabación de voz y feedback de entonación'],
    aprenderas: ['Pronunciar correctamente las consonantes y vocales críticas del inglés.', 'Aplicar el ritmo del inglés y la reducción vocálica (sonido Schwa).', 'Conectar palabras de manera fluida y natural al hablar (linking words).', 'Evaluar tu propia entonación y corregir desvíos comunes.'],
    precio: 95, grupal: 65,
  },
  {
    nombre: 'Taller de Preparación para Entrevistas Laborales (Job Interview Prep)',
    resumen: 'Prepárate para responder preguntas difíciles, estructurar tus logros y negociar tu oferta en inglés.',
    descripcion: 'Consigue el trabajo que deseas en empresas multinacionales o internacionales. Este taller te brindará las herramientas y la confianza para afrontar cualquier entrevista de trabajo en inglés. Aprenderás la metodología STAR para responder preguntas de comportamiento, estructurar tu elevator pitch y hablar con seguridad sobre tu trayectoria académica y laboral.',
    syllabus: ['Elevator Pitch: cómo presentarte en 60 segundos de forma impactante', 'Preguntas típicas de entrevista y cómo estructurar respuestas bajo el método STAR', 'Simulación de entrevistas en vivo (mock interviews) con retroalimentación', 'Preguntas inteligentes para hacer al entrevistador y negociación básica'],
    aprenderas: ['Presentar un Elevator Pitch estructurado y de alto impacto.', 'Responder preguntas difíciles de comportamiento usando el método STAR.', 'Afrontar simulacros de entrevistas de trabajo en vivo con retroalimentación directa.', 'Negociar ofertas salariales iniciales con mayor seguridad y tacto.'],
    precio: 150, precioDesc: 119.99, grupal: 100, grupalDesc: 79.99,
  },
]

const FAQ_GENERAL = [
  { pregunta: '¿Las clases son 100% online?', respuesta: 'Sí, puedes estudiar online con una experiencia guiada. También tenemos alternativas presenciales o híbridas según programa y disponibilidad.' },
  { pregunta: '¿Qué materiales utilizan?', respuesta: 'Trabajamos con materiales de National Geographic Learning y práctica estructurada en nuestra plataforma Spark.' },
  { pregunta: '¿Cómo sé qué programa me conviene?', respuesta: 'Te recomendamos una asesoría corta para entender tu nivel, objetivos y disponibilidad. También puedes comparar los formatos en la página de Servicios.' },
  { pregunta: '¿Puedo certificarme?', respuesta: 'Sí. Acompañamos rutas hacia certificaciones con validez internacional, según tu meta y cronograma.' },
  { pregunta: '¿Universa Empresas incluye reportes para RR.HH.?', respuesta: 'Podemos estructurar seguimiento por cohorte o equipo con indicadores acordados, según el alcance del proyecto.' },
]

export const PAGINAS = {
  '/nosotros': {
    titulo: 'Nosotros',
    secciones: [
      encabezado('Quiénes somos', 'Un programa de inglés diseñado alrededor de ti, no al revés'),
      texto('Nuestra razón de ser', 'Nuestra razón de ser', ['La mayoría de programas de inglés fuerzan a sus estudiantes a encajar en un horario, un ritmo y un método únicos. En Universa hicimos lo contrario: construimos siete caminos distintos para aprender inglés, porque entendemos que un ejecutivo con agenda apretada, un adolescente que recién empieza y un profesional que necesita un resultado puntual en tres meses no pueden aprender de la misma forma.']),
      carac('Nuestro respaldo académico', 'Nuestro respaldo académico', 'Cada programa de Universa está construido sobre dos pilares de respaldo internacional:', [
        { titulo: 'National Geographic Learning', descripcion: 'Nuestro material didáctico está basado en historias reales, documentales y contenido audiovisual auténtico, no en diálogos artificiales de libro de texto.' },
        { titulo: 'British Council (Aptis)', descripcion: 'Al completar tu nivel, puedes certificar tu inglés con Aptis by British Council, reconocido internacionalmente bajo el Marco Común Europeo de Referencia (MCER).' },
      ]),
      texto('Nuestra comunidad', 'Nuestra comunidad', ['Creemos que las mejores historias de aprendizaje merecen ser contadas. Por eso creamos el Beneficio Comunidad Universa, un programa de embajadores para estudiantes que representan genuinamente el impacto de Universa en sus vidas.'], { cta: { label: 'Conoce la Comunidad Universa', href: '#/comunidad-universa' } }),
      cierre('¿Quieres conocer el programa que se adapta a ti?', '', 'Ver todos los programas', '#/servicios'),
    ],
  },
  '/metodologia': {
    titulo: 'Metodología',
    secciones: [
      encabezado('Vivir el idioma desde el primer día', 'Metodología Universa: aprende a pensar en inglés, no a traducirlo', 'Nuestra metodología parte de una premisa simple: el inglés se aprende de la misma forma en que aprendiste tu lengua materna, a través del uso constante y contextualizado, no de la repetición mecánica de reglas. Desde tu primera clase, te sumerges en situaciones reales —presentarte, pedir información, resolver un problema cotidiano— y el idioma se convierte en una herramienta viva, no en una materia de examen.', { imagen: '/landing/hero.png' }),
      texto('Enfoque natural', 'Por qué no enseñamos gramática primero', ['El método tradicional suele priorizar la memorización de estructuras antes que la comunicación efectiva. Esto genera estudiantes que pueden conjugar verbos a la perfección en un examen escrito, pero que dudan al pedir un café o participar en una reunión.', 'Nuestro enfoque invierte ese orden: primero comunicas, después entiendes por qué funciona así. La gramática se internaliza de forma natural, como resultado del uso, no como un requisito previo.']),
      carac('Garantía de calidad', 'El respaldo de National Geographic Learning', 'Todo nuestro material didáctico está sustentado por National Geographic Learning, a través de la plataforma Spark. Esto te expone a contextos culturales auténticos y ritmos de habla reales.', [
        { titulo: 'Video Journals', descripcion: 'Historias reales y documentales breves para conectar con el mundo real.' },
        { titulo: 'TED Talks', descripcion: 'Charlas de alto impacto seleccionadas por nivel para exponerte a acentos variados.' },
        { titulo: 'Contextos auténticos', descripcion: 'Material diseñado para internalizar la gramática a través del uso práctico.' },
      ]),
      { tipo: 'cita', eyebrow: 'Pensar en inglés: la verdadera meta', texto: 'El objetivo central de nuestra metodología es eliminar el paso invisible que más frena a los estudiantes: la traducción mental. Cuando pensar en inglés se vuelve tu forma habitual de comunicarte, las respuestas dejan de tardar segundos valiosos y la comunicación fluye con naturalidad.', autor: 'Metodología Universa' },
      texto('Flexibilidad y consistencia', '¿Esta metodología es igual en todos los programas?', ['Sí: la metodología natural y el enfoque comunicativo son la base de todos nuestros programas.', 'Lo que cambia entre programas no es el método, sino el formato: horario fijo o flexible, grupal o individual, estructurado por niveles o diseñado por objetivos puntuales y enfoques académicos.'], { cta: { label: 'Compara todos los programas', href: '#/servicios' } }),
      cierre('Empieza a hablar inglés con confianza hoy mismo', 'Inscríbete en nuestros programas y vive el idioma desde el primer día.', 'Escríbenos por WhatsApp', wa('Hola, quiero información sobre los programas de Universa.')),
    ],
  },
  '/programas': {
    titulo: 'Programas',
    secciones: [
      encabezado('Programas', 'Nuestros programas de inglés', 'Cuatro modalidades principales para distintos ritmos, objetivos y niveles de acompañamiento. ¿Quieres ver los siete formatos lado a lado? Visita Servicios.'),
      { tipo: 'programas', items: [
        { titulo: 'Programa Continuo Grupal', descripcion: 'Clases en vivo en grupos reducidos con horarios estructurados y beneficios Comunidad Universa.', detalle: 'Grupal · 4 a 8 personas', cta: 'Ver programa', href: '#/programa-continuo-grupal', ...FOTOS['Programa Continuo Grupal'] },
        { titulo: 'Programa Continuo Privado', descripcion: 'Ruta 1:1 personalizada con avance acelerado, horarios flexibles y certificaciones internacionales.', detalle: '1 a 1 · 120 h por nivel', cta: 'Ver programa', href: '#/programa-continuo-privado', ...FOTOS['Programa Continuo Privado'] },
        { titulo: 'Programa Flex Privado', descripcion: 'Autonomía total: clases por horas, sin libro fijo ni plataforma SPARK. Tú defines qué reforzar.', detalle: '1 a 1 · Por horas · Plan a medida', cta: 'Ver programa', href: '#/programa-flex-privado' },
        { titulo: 'Sesiones On Demand', descripcion: 'Refuerzo privado por horas en Speaking, Listening, Grammar y más. Paquetes desde S/. 80.', detalle: 'Por horas · Privado o grupal', cta: 'Ver programa', href: '#/sesiones-on-demand' },
      ] },
      { tipo: 'tabla-enlace', texto: 'Comparar los siete formatos', href: '#/servicios' },
    ],
  },
  '/servicios': {
    titulo: 'Servicios',
    secciones: [
      encabezado('Nuestros servicios', '¿Cuál es tu programa de inglés ideal?', 'Cada estudiante llega con una necesidad distinta: algunos buscan estructura y ritmo grupal, otros necesitan flexibilidad total, y otros solo quieren reforzar una habilidad puntual. Por eso Universa ofrece siete formatos distintos, todos con la misma base de metodología natural y enfoque comunicativo para sincronizarnos con tu objetivo de aprendizaje.'),
      cierre('¿Aún no sabes qué programa elegir?', 'Antes de comparar, conoce tu nivel real de inglés. En minutos tendrás una base clara para saber qué programa se ajusta mejor a ti.', 'Solicitar diagnóstico de nivel', wa('Hola, quiero hacer el diagnóstico de nivel de inglés de Universa.')),
      { tipo: 'niveles', eyebrow: 'Alineados con estándares internacionales', titulo: 'Niveles Universa', subtitulo: 'Para garantizar la calidad y tus estándares académicos, todos nuestros niveles y cursos guardan correlación con el Marco Común Europeo de Referencia para las Lenguas (MCER). Nuestros niveles se dividen en un rango de ciclos del 0 al 12.' },
      { tipo: 'tabla', eyebrow: 'Comparativa', titulo: 'Tabla comparativa de programas', subtitulo: 'Compara nuestros siete formatos y elige el que mejor se adapte a tus ritmos diarios y necesidades de aprendizaje.', filas: FILAS_SERVICIOS },
      { tipo: 'programas', eyebrow: 'Explora', titulo: 'Explora nuestros programas individuales', subtitulo: 'Conoce las ventajas exclusivas y el enfoque de cada uno de los formatos que hemos desarrollado para ti.', items: FILAS_SERVICIOS.map((f) => ({ titulo: f.titulo, descripcion: f.descripcion, detalle: `${f.modalidad} · ${f.grupo}`, cta: 'Ver detalles del programa', href: f.href, ...(FOTOS[f.titulo] ?? {}) })) },
    ],
  },
  '/programa-continuo-grupal': {
    titulo: 'Programa Continuo Grupal',
    secciones: [
      encabezado('Grupal reducido', 'Programa Continuo Grupal: aprende inglés en comunidad', 'Aprende inglés en grupos pequeños de 4 a 8 personas, con horarios fijos sincrónicos.', { imagen: '/landing/continuo-grupal.webp', cta: { label: 'Solicitar mi diagnóstico de nivel', href: diagnostico('Programa Continuo Grupal') } }),
      texto('Introducción', '¿Qué es el Programa Continuo Grupal?', ['Son clases sincrónicas en vivo, en horarios fijos, con grupos reducidos de 4 a 8 estudiantes. Mismo estándar de 120 horas académicas por nivel y mismo material de National Geographic Learning que el resto del programa continuo.']),
      carac('Ventajas exclusivas', 'El valor de aprender en grupo', 'Aprender con otros acelera tus habilidades comunicativas y te mantiene motivado.', [
        { titulo: 'Práctica', descripcion: 'Práctica de conversación real con distintos compañeros, simulando contextos sociales diversos.' },
        { titulo: 'Motivación y constancia', descripcion: 'Motivación y constancia reforzadas por la dinámica grupal.' },
        { titulo: 'Mejor relación costo-beneficio', descripcion: 'Mejor relación costo-beneficio frente a las modalidades privadas.' },
      ]),
      texto('Público objetivo', '¿Para quién es ideal?', ['Ideal para estudiantes que disfrutan del intercambio social como parte del aprendizaje, y que pueden comprometerse con un horario fijo semanal.']),
      cierre('Empieza tu Programa Continuo Grupal.', 'Únete a un grupo y empieza tu proceso.', 'Más información', diagnostico('Programa Continuo Grupal')),
    ],
  },
  '/programa-continuo-privado': {
    titulo: 'Programa Continuo Privado',
    secciones: [
      encabezado('Individual 1 a 1', 'Programa Continuo Privado: tu ritmo, tu horario, toda la atención para ti', 'El estándar académico más alto con la exclusividad y flexibilidad de un tutor personal. Diseñado para optimizar tu tiempo de práctica y lograr fluidez real.', { imagen: '/landing/continuo-privado.webp', chips: ['Adolescentes · 14 a 17 años', 'Adultos · 18 a 49 años', 'Seniors · 50+ años'], cta: { label: 'Empieza tu Programa Continuo Privado', href: wa('Hola, quiero más información sobre el Programa Continuo Privado') } }),
      texto('Introducción', '¿Qué es el Programa Continuo Privado?', ['El Programa Continuo Privado es la versión individual de nuestro programa estructurado por niveles que guarda correlación con el Marco Común Europeo de Referencia para las lenguas (MCER): mismo estándar académico de 120 horas por nivel, mismo material de National Geographic Learning, pero en sesiones exclusivas 1 a 1 con horario preestablecido y/o programable.']),
      carac('Ventajas de la atención individual', 'Beneficios de la atención individual', 'Atención 100% dedicada a potenciar tus habilidades.', [
        { titulo: 'Ritmo adaptado', descripcion: 'Ritmo 100% adaptado a la velocidad de aprendizaje del estudiante.' },
        { titulo: 'Mayor conversación', descripcion: 'Mayor tiempo de práctica oral por sesión, sin compartir tiempo con compañeros.' },
        { titulo: 'Docente enfocado', descripcion: 'Docente enfocado exclusivamente en las fortalezas y áreas de mejora del estudiante.' },
      ]),
      carac('Certificaciones', 'Certifica tu avance', '', [
        { titulo: 'Certificado APTIS', descripcion: 'Certificación internacional de inglés reconocida globalmente para acreditar tu nivel.' },
        { titulo: 'Certificado English Score', descripcion: 'Certificación digital que valida tu competencia comunicativa en entornos profesionales.' },
        { titulo: 'Certificate of Completion Universa', descripcion: 'Certificado de finalización oficial que acredita tu progreso en el programa privado.' },
      ]),
      texto('¿Para quién es ideal?', '¿Para quién es ideal?', ['Este programa es ideal para estudiantes que valoran la constancia de una estructura clara y un inglés integral (General English), pero prefieren una atención personalizada del profesor.']),
      texto('Comparativa', 'Diferencia con Flex Signature', ['El Programa Continuo Privado sigue la estructura por niveles, con 120 horas académicas como estándar. Flex Signature, en cambio, es nuestro programa premium: no tiene niveles fijos, y se diseña por completo alrededor de un objetivo puntual.'], { cta: { label: 'Conoce Flex Signature, nuestra línea premium', href: '#/programa-flex-privado' } }),
      cierre('Empieza tu Programa Continuo Privado.', 'Da el paso hacia un aprendizaje de inglés exclusivo y a tu propia medida.', 'Contactar por WhatsApp', wa('Hola, quiero más información sobre el Programa Continuo Privado')),
    ],
  },
  '/programa-dynamic': {
    titulo: 'Programa Dynamic',
    secciones: [
      encabezado('Grupal reducido', 'Programa Dynamic: tu horario cambia cada semana, tu constancia no', '', { imagen: '/landing/dynamic.webp', cta: { label: 'Solicitar mi diagnóstico de nivel', href: diagnostico('Programa Dynamic') } }),
      texto('Introducción', '¿Qué es el Programa Dynamic?', ['El Programa Dynamic funciona bajo el modelo de aula invertida (flipped classroom): antes de cada sesión en vivo, el estudiante revisa material y contenido de forma autónoma; la sesión sincrónica se enfoca en practicar, resolver dudas y aplicar lo aprendido con el docente y el grupo.', 'A diferencia del Programa Continuo, el horario no es fijo: los días y horarios de las sesiones se programan de forma distinta cada semana, según la disponibilidad real del estudiante.']),
      carac('Ventajas exclusivas', 'Modelo de aula invertida', 'Un programa diseñado para adaptarse a tu estilo de vida profesional o académico sin interrupciones.', [
        { titulo: 'Ritmo 100% adaptado', descripcion: 'Ritmo 100% adaptado a la velocidad de aprendizaje del estudiante.' },
        { titulo: 'Actividades complementarias', descripcion: 'Actividades complementarias ilimitadas.' },
        { titulo: 'Grupos reducidos', descripcion: 'Grupos de 1 a 6 estudiantes, lo que mantiene una atención cercana sin llegar al formato 1 a 1.' },
        { titulo: 'Horarios variables', descripcion: 'Ideal para quienes tienen una agenda cambiante semana a semana: freelancers, estudiantes con horarios variables, profesionales con turnos rotativos.' },
      ]),
      texto('Aula invertida', 'Aula invertida: ¿por qué funciona?', ['El modelo de aula invertida maximiza el tiempo en vivo con el docente para práctica activa, en vez de usarlo para exposición pasiva de contenido. Esto acelera resultados frente a un formato tradicional con la misma cantidad de horas.'], { cta: { label: 'Conoce Flex Signature, nuestra línea premium', href: '#/programa-flex-privado' } }),
      texto('Público objetivo', '¿Para quién es ideal?', ['Para estudiantes que necesitan más estructura que Flex Signature (premium, sin niveles fijos) pero más flexibilidad que el Programa Continuo (horario fijo).']),
      cierre('Empieza tu Programa Dynamic.', 'Aprende con un horario que se adapta a tu semana.', 'Más información', diagnostico('Programa Dynamic')),
    ],
  },
  '/programa-flex-privado': {
    titulo: 'Flex Signature',
    secciones: [
      encabezado('1 a 1 personalizado', 'Flex Signature: el programa premium de Universa, diseñado alrededor de tu meta', '', { imagen: '/landing/flex-signature.webp', cta: { label: 'Solicitar mi diagnóstico de nivel', href: diagnostico('Flex Signature') } }),
      texto('Línea premium', 'Un programa exclusivo, no una modalidad más', ['Flex Signature es nuestra línea premium: todas las sesiones son en vivo y estrictamente 1 a 1 con el docente, sin compartir espacio ni ritmo con otros estudiantes. El ingreso implica un proceso de admisión más riguroso, que inicia con un diagnóstico integral de tu nivel de inglés actual, tus objetivos específicos y tus necesidades reales frente al idioma.']),
      texto('Metodología por objetivos', 'Diseñado por objetivos, no por niveles', ['Flex Signature no utiliza el material de National Geographic Learning ni sigue necesariamente la estructura de niveles del programa continuo. Cada estudiante recibe un plan de estudios diseñado específicamente para sus metas, con duración variable y los paquetes de horas ajustados a la necesidad. Los horarios son completamente programables y la intensidad puede ajustarse semana a semana.'], { cta: { label: 'Compara con las sesiones On Demand', href: '#/sesiones-on-demand' } }),
      cierre('Inicia tu admisión', 'Da el paso hacia un aprendizaje de inglés exclusivo y a tu propia medida.', 'Más información', diagnostico('Flex Signature')),
    ],
  },
  '/sesiones-on-demand': {
    titulo: 'Sesiones On Demand',
    secciones: [
      encabezado('Universa English Program · On Demand · 1 to 1', 'Sesiones On Demand', 'Clases privadas 1 a 1 adaptadas 100% a tus necesidades. Revisa temas puntuales y vocabulario en contextos reales con un profesor certificado: tú eliges qué reforzar y cuándo.', { cta: { label: 'Reservar sesión', href: wa('Hola, quiero reservar una sesión On Demand.') } }),
      { tipo: 'catalogo', eyebrow: 'Banco de actividades dinámicas', titulo: 'Banco de actividades dinámicas', subtitulo: 'Busca y filtra el temario del portafolio On Demand de Universa.', items: CATALOGO },
      carac('A tu medida', 'Un servicio diseñado a tu medida', 'Cada sesión parte de un diagnóstico y un plan alineado a tus objetivos concretos.', [
        { titulo: 'Diagnóstico previo', descripcion: 'Evaluamos tu nivel y metas para establecer un plan personalizado acorde a lo que necesitas reforzar.' },
        { titulo: 'Virtual Tutoring', descripcion: 'Tutoría 1:1 en vivo por Zoom con un profesor certificado dedicado a tu progreso.' },
        { titulo: 'Vocabulario especializado', descripcion: 'Revisión de vocabulario técnico o contextual según tu área: laboral, académica o personal.' },
      ]),
      { tipo: 'precios', eyebrow: 'Inversión por horas', titulo: 'Paquetes de sesiones On Demand', subtitulo: 'Precios fijos por paquete de horas. Ideal para reforzar antes de una entrevista, examen o presentación.', grupos: PAQUETES, nota: 'Si deseas un paquete diferente de horas, solicita una cotización personalizada con tu asesor Universa.', cta: { label: 'WhatsApp con un asesor', href: wa('Hola, quiero cotizar un paquete de sesiones On Demand.') } },
      texto('Modalidad', '100% online, 1:1 y a tu ritmo', ['Sesiones privadas en vivo por Zoom con horarios acordados según tu disponibilidad.', 'Sin curso fijo: cada hora se invierte en lo que tú necesitas reforzar.', 'Profesores certificados con experiencia en tutoring personalizado.']),
      { tipo: 'faq', eyebrow: 'Preguntas frecuentes', titulo: 'Preguntas frecuentes', subtitulo: 'Resuelve tus dudas sobre las Sesiones On Demand.', items: [
        { pregunta: '¿Cómo programo mis sesiones?', respuesta: 'Una vez adquirido el paquete de horas, tu asesor de Universa se pondrá en contacto contigo para coordinar el horario de tus sesiones de acuerdo a tu disponibilidad.' },
        { pregunta: '¿Puedo cancelar o reprogramar una sesión?', respuesta: 'Sí, puedes reprogramar tus sesiones con un mínimo de 24 horas de anticipación directamente con tu profesor asignado.' },
      ] },
      cierre('Refuerza lo que necesitas, cuando lo necesitas', 'Paquetes personalizados disponibles vía WhatsApp.', 'WhatsApp +51 945 311 934', wa('Hola, quiero un paquete de horas personalizado.')),
    ],
  },
  '/conversation-clubs': {
    titulo: 'Conversation Clubs',
    secciones: [
      encabezado('Taller grupal', 'Conversation Clubs', 'Clubs de conversación guiados por un tutor para soltar la lengua, ganar fluidez y expandir tu vocabulario social y profesional en un ambiente de apoyo y debate.', { cta: { label: 'Escríbenos para unirte', href: wa('Hola, quiero unirme a un Conversation Club de Universa.') } }),
      carac('Cómo funcionan', 'Práctica social guiada', 'Grupo pequeño, horario preestablecido y agendable.', [
        { titulo: 'Conversación recurrente', descripcion: 'Practica de forma recurrente con otros estudiantes, guiado por un tutor.' },
        { titulo: 'Comunidad', descripcion: 'La comunidad refuerza hábitos: encuentros guiados, retos semanales y networking con propósito.' },
        { titulo: 'Café Virtual', descripcion: 'Por cada café virtual que agregues, recibes un pase digital para una sesión guiada de conversación en vivo.' },
      ]),
      cierre('Conoce el Café Virtual', 'Apoya a la comunidad y recibe pases para los clubes.', 'Ver Café Virtual', '#/virtual-coffee'),
    ],
  },
  '/professional-mastery-lab': {
    titulo: 'Professional Mastery Lab',
    secciones: [
      encabezado('Especialidades focalizadas', 'Nuestros talleres de inglés', 'Entrena habilidades específicas del idioma de forma dinámica, práctica e intensiva. Elige tu taller e inscríbete de manera directa por WhatsApp.'),
      { tipo: 'talleres', eyebrow: '', titulo: 'Talleres disponibles', subtitulo: 'Abre cualquier taller para ver el syllabus completo y los detalles de aprendizaje.', items: TALLERES },
    ],
  },
  '/virtual-coffee': {
    titulo: 'Café Virtual',
    secciones: [
      encabezado('☕ Ecosistema Universa', 'Café Virtual (Virtual Coffee)', 'Apoya la sostenibilidad de la comunidad de Universa invitando un café virtual a nuestro equipo. Por cada café, recibes pases extra para participar en nuestros Conversation Clubs.', { cta: { label: 'Invitar un café por WhatsApp', href: wa('Hola, quiero invitar un Café Virtual a Universa.') } }),
      { tipo: 'faq', eyebrow: 'Detalles', titulo: 'Preguntas y beneficios del Café Virtual', subtitulo: 'Conoce cómo funciona y cómo retribuimos tu apoyo.', abiertoInicial: true, items: [
        { pregunta: '¿Cómo funciona y qué impacto tiene?', respuesta: 'En Universa estamos comprometidos con construir un ecosistema educativo de inglés exigente, humano y accesible. Gran parte de nuestros clubes de conversación informales son mantenidos por la dedicación de nuestros coaches y voluntarios.\n\nEl Café Virtual es un canal directo para apoyar este esfuerzo:\n• Financiamiento de becas: el 40% de cada café se destina al fondo de becas de impacto de Universa para alumnos de escasos recursos.\n• Acceso a Conversation Clubs: por cada café que agregues, te regalamos un pase digital para ingresar a una sesión guiada de conversación en vivo.\n• Sostenimiento de la comunidad: ayudas a costear las herramientas técnicas y servidores que mantienen viva la plataforma Spark.' },
        { pregunta: 'Beneficios por cantidad de cafés', respuesta: '• 01 café: 1 pase para el Club de Conversación informal + mención de agradecimiento.\n• 03 cafés: 3 pases para el Club de Conversación + participación automática en sorteos de libros digitales y materiales premium.\n• 05 cafés o más: pases ilimitados para los clubes durante el mes en curso + acceso prioritario a grabaciones de talleres anteriores.' },
      ] },
    ],
  },
  '/comunidad-universa': {
    titulo: 'Comunidad Universa',
    secciones: [
      encabezado('Comunidad Universa', 'Una comunidad que te sostiene', 'Conversation clubs, retos y encuentros para practicar con propósito. La comunidad acelera la confianza y la constancia.'),
      texto('Beneficio Comunidad Universa', 'Embajadores Universa', ['Las mejores historias de aprendizaje merecen ser contadas. El Beneficio Comunidad Universa es un programa de embajadores para estudiantes que representan genuinamente el impacto de Universa en sus vidas.']),
      carac('Participa', 'Conecta y practica', 'La comunidad refuerza hábitos: encuentros guiados, retos semanales y networking con propósito.', [
        { titulo: 'Conversation Clubs', descripcion: 'Práctica social guiada con otros estudiantes.' },
        { titulo: 'Retos semanales', descripcion: 'Dinámicas para practicar fuera de clase con guía.' },
        { titulo: 'Café Virtual', descripcion: 'Apoya a la comunidad y recibe pases para los clubes.' },
      ]),
      cierre('Explora la comunidad', '', 'Ver Conversation Clubs', '#/conversation-clubs'),
    ],
  },
  '/impacto-universa': {
    titulo: 'Impacto Universa',
    secciones: [
      encabezado('Impacto Universa', 'Aprender para transformar', 'Impulsamos proyectos que conectan aprendizaje de idiomas con desarrollo social y profesional: mentorías, alianzas y proyectos colaborativos.'),
      texto('Becas', 'Becas y comunidad', ['Iniciativas para ampliar oportunidades de aprendizaje y conectar talento con propósito. Con el Café Virtual, el 40% de cada café se destina al fondo de becas de impacto de Universa para alumnos de escasos recursos.'], { cta: { label: 'Conoce el Café Virtual', href: '#/virtual-coffee' } }),
    ],
  },
  '/faqs': {
    titulo: 'Preguntas frecuentes',
    secciones: [
      encabezado('FAQs', 'Resolvemos tus dudas', 'Preguntas frecuentes sobre programas, metodología y operación.'),
      { tipo: 'faq', items: FAQ_GENERAL },
      cierre('¿Te quedó alguna duda?', 'Escríbenos y te ayudamos a elegir el mejor camino para tu objetivo.', 'Contactar a un asesor', '#/contacto'),
    ],
  },
  '/trabaja-con-nosotros': {
    titulo: 'Trabaja con nosotros',
    secciones: [
      encabezado('Únete al equipo', 'Trabaja con nosotros', 'Buscamos personas con mentalidad de servicio, pasión por la educación y foco en impacto real.'),
      texto('Vacante abierta', 'Academic Coach (Inglés)', ['Área: Académico · Modalidad: remoto · LATAM (según país).', 'Buscamos personas obsesionadas con el progreso real de los estudiantes: feedback accionable, empatía y excelencia operativa.', 'Requisitos: inglés avanzado, experiencia en enseñanza o acompañamiento educativo, y cultura de trabajo remota.'], { cta: { label: 'Postular por WhatsApp', href: wa('Hola, quiero postular como Academic Coach (Inglés) en Universa.') } }),
    ],
  },
  '/contacto': {
    titulo: 'Contacto',
    secciones: [
      encabezado('Contacto', 'Hablemos de tu objetivo', 'Cuéntanos qué buscas y te respondemos con una recomendación clara y próximos pasos.'),
      { tipo: 'formulario', asuntos: ['Consulta general', 'Programas (Adultos / Juniors)', 'Universa Empresas', 'Certificaciones', 'Otro'] },
      { tipo: 'contacto', titulo: 'También puedes escribirnos directo', eyebrow: '', subtitulo: '' },
    ],
  },
  '/privacidad': { titulo: 'Política de Privacidad', legal: privacidad },
  '/terminos': { titulo: 'Términos y Condiciones', legal: terminos },
}

export const RUTAS_LEGALES = [['Política de Privacidad', '/privacidad'], ['Términos y Condiciones', '/terminos']]
