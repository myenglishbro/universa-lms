// Contenido de la landing cuando no hay Strapi configurado (o no responde). Copiado del contenido inicial del proyecto
// universa-strapi-project. Cuando el CMS está disponible, manda el CMS; este texto es solo el respaldo.
// Formato normalizado: el mismo que produce src/services/cms.js al leer Strapi.
export const WHATSAPP = '51945311934'

export const landingFallback = {
  sitio: {
    nombre: 'Universa',
    lema: 'Aprende inglés. Transforma tu futuro.',
    descripcion:
      'Un ecosistema de aprendizaje de inglés: programas para adultos, juniors y empresas, con metodología comunicativa, acompañamiento humano y tecnología a tu servicio.',
    correo: 'hola@somosuniversa.com',
    whatsapp: WHATSAPP,
    telefono: '+51 945 311 934',
    direccion: 'Perú / Online',
  },
  secciones: [
    {
      tipo: 'carrusel',
      titulo: 'Aprende inglés. Transforma tu futuro.',
      slides: [
        { desktop: '/landing/slide-1.webp', mobile: '/landing/slide-1-movil.webp', alt: 'Aprende inglés y transforma tu futuro. Programas que se adaptan al ritmo, objetivos y contexto de cada estudiante.', href: '#/servicios' },
        { desktop: '/landing/slide-2.webp', mobile: '/landing/slide-2-movil.webp', alt: 'Conversation Clubs, Virtual Coffee. Practica inglés cada semana y mantén tu fluidez viva.', href: '#/virtual-coffee' },
        { desktop: '/landing/slide-3.webp', mobile: '/landing/slide-3-movil.webp', alt: 'Talleres profesionales para quienes hablan inglés. Incrementa tu competencia y prepárate para las situaciones del mundo globalizado.', href: '#/professional-mastery-lab' },
      ],
    },
    {
      tipo: 'textoImagen',
      eyebrow: 'Conócenos',
      titulo: 'Un equipo obsesionado con tu progreso',
      cta: { label: 'Conoce Universa', href: '#/nosotros' },
      imagen: '/landing/hero.png',
      parrafos: [
        'En Universa creemos que aprender inglés es una habilidad estratégica: abre trabajo, estudios, cultura y confianza.',
        'Combinamos método, comunidad y acompañamiento para que avances con constancia, no solo con «clases sueltas».',
      ],
    },
    {
      tipo: 'programas',
      eyebrow: 'Nuestros programas',
      titulo: 'Encuentra el programa ideal para ti',
      items: [
        { titulo: 'Programa Continuo Privado', resumen: 'Aprende a tu ritmo con un profesor particular.', descripcion: 'La misma estructura por niveles, en sesiones exclusivas 1 a 1, con horario adaptable y avance a tu ritmo.', imagen: '/landing/continuo-privado.webp', href: '#/programa-continuo-privado', cta: 'Ver programa' },
        { titulo: 'Programa Continuo Grupal', resumen: 'Aprende inglés en grupos reducidos y dinámicos.', descripcion: 'Clases en vivo en grupos de 4 a 8 estudiantes, con horarios fijos y 120 horas académicas por nivel.', imagen: '/landing/continuo-grupal.webp', href: '#/programa-continuo-grupal', cta: 'Ver programa' },
        { titulo: 'Programa Dynamic', resumen: 'El formato ideal para agendas exigentes y cambiantes.', descripcion: 'Aula invertida en grupos de 1 a 6 estudiantes, con un horario distinto cada semana.', imagen: '/landing/dynamic.webp', href: '#/programa-dynamic', cta: 'Ver programa' },
        { titulo: 'Flex Signature', resumen: 'Máxima personalización con reprogramación ilimitada.', descripcion: 'El programa premium: 1 a 1, sin niveles fijos, diseñado alrededor de tu meta.', imagen: '/landing/flex-signature.webp', href: '#/programa-flex-privado', cta: 'Ver programa' },
      ],
    },
    { tipo: 'logos', items: [{ src: '/landing/spark.png', alt: 'Spark' }, { src: '/landing/cefr.png', alt: 'Marco Común Europeo de Referencia (CEFR)' }, { src: '/landing/natgeo.png', alt: 'National Geographic Learning' }] },
    {
      tipo: 'caracteristicas',
      eyebrow: 'Por qué Universa',
      titulo: 'Diseñado para resultados reales',
      subtitulo: 'Lo que nos diferencia no es «más contenido», sino mejor práctica y mejor acompañamiento.',
      items: [
        { titulo: 'Metodología comunicativa', descripcion: 'Menos teoría abstracta y más uso del idioma desde el día uno.' },
        { titulo: 'Certificación Aptis', descripcion: 'Al completar tu nivel puedes certificarte con Aptis by British Council, reconocido bajo el MCER.' },
        { titulo: 'Materiales premium', descripcion: 'National Geographic Learning como base de aprendizaje significativo.' },
        { titulo: 'Plataforma Spark', descripcion: 'Práctica estructurada, seguimiento y recursos en un solo lugar.' },
        { titulo: 'Comunidad y clubes', descripcion: 'Conversation clubs y dinámicas para ganar fluidez.' },
        { titulo: 'Evaluación y claridad', descripcion: 'Sabrás en qué estás fuerte y qué entrenar a continuación.' },
      ],
    },
    {
      tipo: 'ecosistema',
      eyebrow: 'Ecosistema Universa',
      titulo: 'Aprende · Conecta · Impacta',
      subtitulo: 'Un ciclo que convierte el inglés en una ventaja sostenible.',
      items: [
        { fase: 'Aprende', titulo: 'Domina el idioma con método', descripcion: 'Rutas por nivel, práctica constante y recursos de clase mundial.' },
        { fase: 'Conecta', titulo: 'Ponlo a prueba en la vida real', descripcion: 'Comunidad, clubes y desafíos para ganar confianza.' },
        { fase: 'Impacta', titulo: 'Multiplica oportunidades', descripcion: 'Mejor empleabilidad, estudios y relaciones globales.' },
      ],
    },
    {
      tipo: 'pasos',
      eyebrow: 'Proceso',
      titulo: 'Así empezamos juntos',
      items: [
        { numero: '01', titulo: 'Diagnóstico rápido', descripcion: 'Nivel, objetivos y disponibilidad.' },
        { numero: '02', titulo: 'Recomendación', descripcion: 'Te proponemos programa, ritmo y plan.' },
        { numero: '03', titulo: 'Onboarding', descripcion: 'Accesos, materiales y primeras metas.' },
        { numero: '04', titulo: 'Acompañamiento', descripcion: 'Práctica semanal y seguimiento.' },
      ],
    },
    {
      tipo: 'testimonios',
      eyebrow: 'Testimonios',
      titulo: 'Historias de transformación',
      items: [
        {
          cita: 'Pasé de «entiendo pero no me animo» a sostener reuniones en inglés. El acompañamiento y la práctica constante marcaron la diferencia.',
          nombre: 'Mariana G.',
          rol: 'Estudiante Universa Adultos',
        },
      ],
    },
    {
      tipo: 'faq',
      eyebrow: 'FAQs',
      titulo: 'Preguntas frecuentes',
      subtitulo: 'Lo esencial antes de empezar.',
      items: [
        { pregunta: '¿Las clases son 100% online?', respuesta: 'Sí, puedes estudiar online con una experiencia guiada. También tenemos alternativas presenciales o híbridas según programa y disponibilidad.' },
        { pregunta: '¿Qué materiales utilizan?', respuesta: 'Trabajamos con materiales de National Geographic Learning y práctica estructurada en nuestra plataforma Spark.' },
        { pregunta: '¿Cómo sé qué programa me conviene?', respuesta: 'Te recomendamos una asesoría corta para entender tu nivel, objetivos y disponibilidad.' },
        { pregunta: '¿Puedo certificarme?', respuesta: 'Sí. Acompañamos rutas hacia certificaciones con validez internacional, según tu meta y cronograma.' },
        { pregunta: '¿Universa Empresas incluye reportes para RR.HH.?', respuesta: 'Podemos estructurar seguimiento por cohorte o equipo con indicadores acordados, según el alcance del proyecto.' },
      ],
    },
    {
      tipo: 'contacto',
      eyebrow: 'Contacto',
      titulo: 'Cuéntanos tu objetivo',
      subtitulo: 'Te respondemos con una recomendación clara y próximos pasos.',
    },
  ],
}
