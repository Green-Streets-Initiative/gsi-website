import { H3, Mail, P, Section, Ul, A } from './legal'

/*
 * Privacy policy, Spanish (November 2026 text). AI translation pending a
 * native speaker's review. Section for section with src/app/privacy/page.tsx.
 * Register: usted. Product and company names stay in English (Shift, Apple
 * Health, Health Connect, Supabase, What Moves Us); feature names the app
 * shows in Spanish are given in Spanish.
 */

export default function PrivacyEs() {
  return (
    <>
      <Section title="Quiénes somos">
        <P>
          Shift es una aplicación móvil operada por Green Streets Initiative (&ldquo;GSI&rdquo;,
          &ldquo;nosotros&rdquo; o &ldquo;nuestro&rdquo;), una organización sin fines de lucro dedicada
          a ayudar a las personas a cambiar sus viajes por opciones más saludables, más económicas y
          más limpias, y a medir el impacto, viaje por viaje, comunidad por comunidad.
        </P>
        <P>
          Esta Política de privacidad explica cómo recogemos, usamos, divulgamos, guardamos,
          conservamos y protegemos la información personal cuando usted usa la app Shift, el sitio web
          de Green Streets Initiative y los servicios, funciones, programas, desafíos, clasificaciones,
          recompensas, comunicaciones y campañas comunitarias relacionados.
        </P>
        <P>
          Al usar Shift, el sitio web o cualquier servicio relacionado, usted acepta las prácticas
          descritas en esta Política de privacidad.
        </P>
        <P>
          Si no está de acuerdo con esta Política de privacidad, por favor no use Shift, el sitio web
          ni nuestros servicios relacionados.
        </P>
      </Section>

      <Section title="Qué información recogemos">
        <P>
          Recogemos información que usted nos da directamente, información que se obtiene
          automáticamente de su dispositivo cuando usa Shift o nuestro sitio web, información de su
          participación en programas, campañas, competencias, recompensas y desafíos, e información de
          proveedores de servicios o socios de programas que nos ayudan a operar Shift.
        </P>
        <P>
          Parte de la información que usa Shift puede ser delicada por lo que puede revelar sobre usted,
          como los datos de ubicación precisa, los lugares guardados, los datos inferidos del perfil de
          rutas y, cuando corresponda, la información sobre menores de edad o estudiantes.
        </P>
        <P>
          Usamos esa información solo para ofrecer y proteger Shift, operar las funciones descritas en
          esta Política de privacidad, cumplir la ley o para otro fin que le informemos.
        </P>
      </Section>

      <Section title="Datos de ubicación">
        <P>
          Con el permiso de su dispositivo, Shift puede acceder a la ubicación GPS precisa en segundo
          plano, incluso cuando la app no está abierta o en uso activo, porque la detección automática
          de viajes depende del acceso a la ubicación.
        </P>
        <P>
          Usamos los datos de ubicación para detectar cuándo usted completa un viaje a pie, en
          bicicleta, en transporte público o en vehículo, para que los viajes se registren
          automáticamente sin que tenga que anotarlos.
        </P>
        <P>Recogemos:</P>
        <Ul>
          <li>Coordenadas GPS durante los viajes detectados</li>
          <li>Puntos de inicio y fin del viaje durante la detección y el procesamiento del viaje</li>
          <li>Distancia y duración de cada viaje</li>
          <li>Modo de transporte detectado (a pie, en bicicleta, en transporte público o en vehículo)</li>
        </Ul>
        <P>También podemos recoger u obtener:</P>
        <Ul>
          <li>El estado del permiso de los servicios de ubicación en el dispositivo</li>
          <li>Información general sobre el vecindario, la ruta o la zona, que se usa para clasificar los viajes y calcular el impacto</li>
          <li>Metadatos técnicos necesarios para procesar un viaje, como la fecha y hora, el sistema operativo del dispositivo y la versión de la app</li>
        </Ul>
        <P>
          Los datos de ubicación se usan para identificar los viajes completados. De cada viaje
          guardamos dónde empezó y dónde terminó y el recorrido que hizo, junto con su modo,
          distancia, duración, fecha y hora, y las métricas de impacto relacionadas, como se describe
          en Registros de viajes. Las lecturas de ubicación tomadas fuera de un viaje no se guardan
          como un historial continuo de ubicación.
        </P>
        <P>
          Las lecturas GPS sin procesar también pueden procesarse en el dispositivo, durante la
          transmisión o de forma temporal en nuestros sistemas, según sea necesario para la detección
          de viajes, la corrección de errores, la seguridad, la prevención de fraude o el
          funcionamiento del servicio.
        </P>
      </Section>

      <Section title="Datos de movimiento y actividad">
        <P>
          Usamos el acelerómetro y los sensores de movimiento de su dispositivo, junto con la función
          de reconocimiento de actividad del dispositivo, para clasificar su modo de transporte. Estos
          datos se usan solo para detectar viajes y no se guardan aparte de los registros de viajes.
        </P>
      </Section>

      <Section title="Datos de apps de salud (Apple Health y Health Connect)">
        <P>
          Si activa la importación de entrenamientos en la configuración de Shift, Shift lee los
          entrenamientos que usted haya registrado con Apple Health (iOS) o Health Connect (Android): el
          tipo de entrenamiento (caminar, correr, senderismo o ciclismo), su hora de inicio y de fin, su
          distancia, y el primer y el último punto de su recorrido. No leemos la frecuencia cardíaca,
          los pasos, el sueño ni ningún otro dato de salud, y nunca escribimos en Apple Health ni en
          Health Connect.
        </P>
        <P>
          Usamos estos datos con un solo fin: encontrar caminatas, carreras y paseos en bici que la
          detección automática de viajes de Shift no captó, y ofrecérselos como viajes. Un
          entrenamiento que ningún viaje de Shift cubre todavía se agrega a su lista de viajes como un
          viaje sin confirmar, para que usted lo confirme o lo quite; un entrenamiento confirmado se
          convierte en un registro de viaje normal, tratado como se describe en Registros de viajes.
          Cuando quita uno, el viaje se borra; guardamos una nota breve de que no era un viaje, con sus
          puntos de inicio y fin, para que la detección de viajes aprenda de eso. Los datos de las apps
          de salud nunca se venden, no se comparten con anunciantes y no se usan para publicidad.
        </P>
        <P>
          Puede desactivar la importación de entrenamientos en cualquier momento en la configuración
          de Shift, o quitarle a Shift el acceso en la app Apple Health o Health Connect. Los viajes que
          ya confirmó siguen en su historial hasta que los borre o borre su cuenta.
        </P>
      </Section>

      <Section title="Información de la cuenta">
        <P>Cuando crea una cuenta, recogemos:</P>
        <Ul>
          <li>Su nombre y su dirección de correo electrónico</li>
          <li>Credenciales de acceso (guardadas de forma segura; las contraseñas nunca se guardan como texto legible)</li>
          <li>Información de perfil opcional, como su vecindario o su vínculo con una escuela o un empleador</li>
        </Ul>
        <P>
          También podemos recoger las comunicaciones que nos envíe, solicitudes de ayuda, preguntas o
          solicitudes sobre privacidad, comentarios e información similar cuando se comunique con
          nosotros por cualquier motivo.
        </P>
        <P>
          Usted es responsable de mantener seguras las credenciales de su cuenta y de avisarnos pronto
          si cree que alguien entró a su cuenta sin permiso.
        </P>
      </Section>

      <Section title="Registros de viajes">
        <P>De cada viaje detectado o anotado a mano, guardamos:</P>
        <Ul>
          <li>Fecha y hora</li>
          <li>Modo del viaje (a pie, en bicicleta, en transporte público, en auto)</li>
          <li>Distancia</li>
          <li>Dónde empezó y dónde terminó el viaje, y el recorrido que hizo</li>
          <li>El vecindario y la ciudad donde empezó y donde terminó</li>
          <li>Métricas de impacto calculadas (CO&#8322; evitado, ahorro estimado, calorías quemadas)</li>
        </Ul>
        <P>
          Los puntos de inicio y fin y los recorridos se usan para mostrar sus viajes en un mapa,
          reconocer viajes entre sus lugares guardados, clasificar los viajes en transporte público y
          contar los viajes por vecindario y por ciudad. Se conservan mientras su cuenta esté activa y
          se borran cuando usted borra el viaje o su cuenta, como se describe en Conservación de datos.
        </P>
      </Section>

      <Section title="Datos de competencias y de la comunidad">
        <P>
          Si se une a un desafío o a una clasificación, guardamos su participación, sus puntajes y sus
          posiciones en esa competencia. Su nombre visible y sus estadísticas generales pueden ser
          visibles para otras personas que participan, según la configuración de visibilidad de la
          competencia.
        </P>
      </Section>

      <Section title="Datos de uso">
        <P>
          Recogemos datos de uso habituales de la app y del sitio web, como informes de fallas,
          interacciones con las funciones, diagnósticos de rendimiento, información del dispositivo y
          del navegador, dirección IP, horas de acceso, páginas o pantallas vistas e información
          técnica similar.
        </P>
        <P>
          Usamos esta información para operar, proteger, resolver problemas, analizar y mejorar Shift y
          el sitio web.
        </P>
        <P>
          Cuando es práctico, los datos de diagnóstico y de uso se mantienen separados de la ubicación
          precisa y del historial de viajes, pero algunos datos técnicos pueden asociarse con su cuenta
          cuando hace falta para darle ayuda, mantener la seguridad, investigar errores o cumplir la ley.
        </P>
      </Section>

      <Section title="Perfil de rutas (inferido, no declarado)">
        <P>
          Para clasificar los viajes en transporte público y proteger sus rachas, Shift crea un perfil
          de rutas inferido a partir de su historial de viajes, después de que usted complete al menos
          10 viajes. Este perfil guarda:
        </P>
        <Ul>
          <li>La zona aproximada de su casa (el punto central de los inicios de sus viajes de la mañana; no es una dirección exacta)</li>
          <li>La zona aproximada de su trabajo (el punto central de los finales de sus viajes de la mañana; no es una dirección exacta)</li>
          <li>Paradas cercanas de la MBTA y rutas habituales inferidas de sus patrones de viaje</li>
        </Ul>
        <P>
          Este perfil <strong>nunca se basa en información que usted ingresa a mano</strong>: se obtiene
          por completo de su historial de viajes. Se borra cuando usted borra su cuenta, y puede verlo
          y borrarlo en cualquier momento en la configuración de la app.
        </P>
      </Section>

      <Section title="Asistente de Shift">
        <P>
          La app Shift incluye un asistente opcional que responde preguntas sobre cómo moverse y sobre
          su propia actividad en Shift.
        </P>
        <P>
          Para responder, lee su pregunta, sus lugares guardados, sus viajes recientes (horas, qué
          distancia y cómo viajó, y &ldquo;Casa&rdquo; o &ldquo;Trabajo&rdquo;, no puntos en el mapa),
          sus puntos, insignias y recompensas, sus desafíos y grupos (su propio conteo y posición,
          nunca los nombres de otras personas), los beneficios de transporte que su empleador configuró
          en Shift, si ofrece el programa de transporte al trabajo de Shift, los planes que Shift hizo
          para los cierres de la MBTA en sus viajes, los trayectos en auto que Shift encontró que usted
          hace con frecuencia junto con las alternativas que encontró para comparar, las respuestas que
          dio en la app sobre los costos de su auto, su plan para cambiar, sus rachas, sus mejores
          marcas y su nivel de Shift, y la ubicación de su teléfono cuando usted lo permite, redondeada
          a unos 100 metros. Solo guarda un lugar, cambia una configuración o le inscribe en un paseo
          después de que usted toca el botón de su tarjeta.
        </P>
        <P>
          Si le pide que le inscriba en un paseo o una caminata en grupo de Shift y toca el botón, le
          une a ese paseo y marca su respuesta para esa fecha, igual que cuando toca Voy en la app. Quien
          organiza el paseo ve su nombre y su respuesta.
        </P>
        <P>
          Si toca Avísame para un viaje, guardamos su punto de partida, su destino y la hora junto
          con esa conversación. Le enviamos el recordatorio y luego revisamos sus viajes de alrededor de
          esa hora para buscar uno que empiece o termine cerca de esos lugares, y así decirle que contó.
          Al borrar la conversación se borra el recordatorio.
        </P>
        <P>
          Si toca Recordar en una nota que el asistente le ofrece, como &ldquo;Tengo una bicicleta
          eléctrica&rdquo;, guarda esa nota para sus conversaciones futuras. Puede ver y borrar sus notas
          en la pantalla Lo que recuerdo del asistente (en la versión más reciente de la app). Una nota
          se borra cuando usted la borra ahí o le pide al asistente que la olvide, cuando borra su
          cuenta, o 12 meses después de la última vez que usó el asistente.
        </P>
        <P>
          Si adjunta una imagen, como una captura de pantalla, el asistente la mira para responderle.
          Se guarda de forma privada con esa conversación y se borra con ella. Si reporta un problema, el
          equipo de Green Streets ve la imagen junto con su reporte. Si comparte un enlace a una ruta de
          Ride with GPS, leemos esa ruta pública en Ride with GPS para responderle.
        </P>
        <P>
          Sus preguntas, y lo que el asistente busca para responderlas, las procesa Anthropic, que
          ofrece el modelo de inteligencia artificial; los lugares y las indicaciones de transporte
          público se buscan con Google Maps Platform, como se describe en Con proveedores de servicios.
        </P>
        <P>
          El personal de GSI puede leer las conversaciones para resolver problemas y mejorar el
          asistente. Las conversaciones se borran 12 meses después de su último mensaje, y cuando usted
          borra su cuenta. Puede borrar una conversación, o todas, desde el asistente en la app, o
          escribiendo a <Mail />.
        </P>
        <P>
          Hay más detalles en{' '}
          <a href="/shift/assistant-data" className={A}>The Shift assistant and your data</a> (en inglés).
        </P>
      </Section>

      <Section title="Lugares guardados">
        <P>Solo usted puede ver sus lugares guardados dentro de su cuenta.</P>
        <P>
          No divulgamos sus lugares guardados a otras personas que usan Shift, ni a empleadores,
          escuelas, patrocinadores o socios de recompensas, sin su consentimiento explícito.
        </P>
        <P>
          Nuestros proveedores de servicios pueden procesar los lugares guardados según sea necesario
          para ofrecer, alojar, proteger y dar soporte a Shift, y pueden divulgarse si lo exige la ley o
          un proceso legal válido.
        </P>
        <P>Puede ver, editar o borrar sus lugares guardados en cualquier momento en la configuración de la app.</P>
        <P>
          Los lugares guardados se borran cuando usted borra su cuenta, sujeto a los ciclos normales de
          copias de seguridad, las obligaciones legales, las necesidades de seguridad u otra
          conservación limitada que permita la ley aplicable.
        </P>
      </Section>

      <Section title="Encontrar a alguien con quien ir">
        <P>
          Si se inscribe para ir con alguien que conoce el camino, para mostrarle el camino a alguien,
          para encontrar a alguien con quien caminar o para encontrar a alguien con quien compartir el
          auto, usamos su Casa y su Trabajo guardados (o el viaje que nos cuente), los horarios que nos
          dé y sus viajes recientes entre esos lugares para sugerirle personas que hacen un viaje
          parecido. Usamos su Casa solo para encontrar personas cerca de usted: nunca le mostramos su
          dirección a nadie. Solo hacemos esto después de que usted se inscribe, y puede dejarlo en
          cualquier momento.
        </P>
        <P>
          Antes de que los dos digan que sí, la otra persona ve su primer nombre, qué tan lejos uno del
          otro empiezan y terminan sus viajes, las formas en que usted se mueve y la que más usa, sus
          días y horarios habituales, los idiomas que dijo que habla, cuándo se unió a Shift, su estatus
          en Shift, y cualquier grupo de trabajo, escuela o vecindario al que los dos pertenezcan. Si su
          perfil es público, también ve su foto de perfil. Si se ofreció a mostrar el camino, ve cuántos
          viajes hizo por ese camino recientemente. Para compartir el auto, ve si usted manejaría o iría
          de pasajero, a qué hora llega al trabajo y cuántos minutos más le sumaría al trayecto recoger
          y dejar a la otra persona. Nunca ve su dirección. Solo si los dos dicen que sí, cada uno ve el
          correo electrónico del otro y, si usted pertenece a un lugar de trabajo en Shift, el nombre de
          ese lugar.
        </P>
        <P>
          Cuando planea un primer viaje con alguien que le va a mostrar el camino, Shift sugiere lugares
          públicos para encontrarse y para terminar, como la estación del T más cercana, para que ninguno
          de los dos tenga que compartir la dirección de su casa o de su trabajo.
        </P>
        <P>
          Para ayudar a que las personas se encuentren, Shift puede decirle a alguien cercano que hace
          un viaje parecido cuántas personas cerca de esa persona pidieron que les mostraran el camino,
          o se ofrecieron a mostrarlo. Ese mensaje es solo un número: nunca incluye su nombre, su foto ni
          dónde vive.
        </P>
        <P>
          Sus comentarios después de un viaje y cualquier problema que reporte van solo al equipo de
          Green Streets. Los empleadores nunca ven quién se inscribió ni a quién emparejamos.
        </P>
      </Section>

      <Section title="Datos de la campaña What Moves Us">
        <P>
          Si decide participar en una campaña comunitaria de relatos What Moves Us, recogemos estos
          datos adicionales:
        </P>
        <Ul>
          <li>Grabaciones cortas de video o de audio de sus respuestas a las preguntas de la campaña</li>
          <li>Su aceptación del consentimiento y la fecha en que lo dio</li>
          <li>A qué preguntas de la campaña respondió y si se saltó alguna</li>
        </Ul>
        <P>
          <strong>Cómo se usan estos datos:</strong> sus grabaciones pueden compartirse públicamente en
          una página web de Green Streets Initiative y pueden entregarse a la organización que encargó la
          campaña, como un municipio, una agencia de planificación del transporte o una organización de
          planificación parecida, como se describe en los términos de consentimiento propios de la
          campaña que se le muestran antes de grabar cualquier cosa.
        </P>
        <P>
          Como las grabaciones de video o de audio pueden incluir su imagen, su voz, lo que dice u otras
          características que le identifican, las grabaciones pueden permitir identificarle incluso
          cuando los informes relacionados usan temas agrupados o anónimos.
        </P>
        <P>
          Antes de enviar cualquier grabación, se le mostrarán los términos específicos de cada campaña
          sobre cómo se comparte, se publica y se borra.
        </P>
        <P>
          <strong>Conservación:</strong> las grabaciones de la campaña se conservan mientras dure el
          proyecto para el que se recogieron, normalmente de 12 a 24 meses, a menos que los términos de
          consentimiento de la campaña indiquen un período más corto o más largo, o que la ley lo
          exija. Puede retirar su consentimiento y pedir que se borren sus grabaciones en cualquier
          momento en la configuración de la app o escribiendo a <Mail />, sujeto a materiales legales,
          de archivo, operativos o ya publicados que no se puedan retirar razonablemente.
        </P>
        <P>
          <strong>Lo que nunca se comparte:</strong> sus datos individuales de viajes, su Shift Rate o
          su historial de ubicación nunca se incluyen en los materiales de What Moves Us. Los datos de
          participación en la campaña se mantienen completamente separados de sus registros de viajes
          y de competencias.
        </P>
      </Section>

      <Section title="Cómo usamos sus datos">
        <P>
          Usamos su información principalmente para operar, ofrecer, mantener, proteger, personalizar,
          analizar y mejorar Shift, el sitio web y los servicios relacionados, y para cumplir los fines
          para los que usted nos dio la información.
        </P>
        <Ul>
          <li><strong>Detección y registro de viajes:</strong> los datos de ubicación y de movimiento se usan para detectar cuándo usted completa un viaje y clasificar el modo de transporte.</li>
          <li><strong>Cálculo del impacto:</strong> los registros de viajes se usan para calcular sus métricas personales de impacto ambiental y económico.</li>
          <li><strong>Funciones de la comunidad:</strong> los datos de viajes agrupados se usan para las clasificaciones de vecindarios, los desafíos de escuelas y empleadores, y los paneles de impacto de la comunidad.</li>
          <li><strong>Notificaciones:</strong> usamos sus patrones de viaje para enviarle recordatorios útiles, avisos de logros, notificaciones de rachas y resúmenes semanales.</li>
          <li><strong>Mejoras de la app:</strong> los datos de uso y de diagnóstico se usan para corregir errores, mejorar la precisión y crear funciones nuevas.</li>
          <li><strong>Clasificación de viajes en transporte público:</strong> en los viajes en que su movimiento coincide con la velocidad de un vehículo, comparamos su ruta con los datos de posición en tiempo real de los vehículos de la MBTA para clasificar automáticamente el viaje como autobús, metro o tren de cercanías.</li>
          <li><strong>Protección de rachas:</strong> si hay una interrupción importante del servicio de la MBTA en su ruta habitual de transporte público, podemos usar su perfil de rutas inferido para proteger automáticamente su racha activa.</li>
          <li><strong>Administración de cuentas:</strong> usamos la información de la cuenta para crear y administrar cuentas, verificar la identidad de las personas usuarias, dar ayuda, responder solicitudes y mantener la seguridad de las cuentas.</li>
          <li><strong>Prevención de fraude e integridad:</strong> usamos la información para detectar viajes falsos o inventados, manipulación de las clasificaciones, mal uso de XP, niveles, recompensas, ofertas y códigos de descuento, el acceso no autorizado a cuentas y otros posibles fraudes, actividades ilegales o incumplimientos de nuestros términos.</li>
          <li><strong>Cumplimiento legal:</strong> podemos usar la información para cumplir la ley, las normas, órdenes judiciales, citaciones, procesos legales, obligaciones tributarias o solicitudes de las autoridades aplicables.</li>
          <li><strong>Proveedores de servicios:</strong> podemos usar y divulgar información a proveedores de servicios que nos ayudan a alojar, operar, proteger, analizar, mantener y mejorar Shift y los servicios relacionados.</li>
          <li><strong>Informes con datos agrupados y anónimos:</strong> podemos anonimizar o agrupar la información para que ya no le identifique, y podemos usar y divulgar esa información anónima o agrupada para informes, investigación, medición del impacto en la comunidad, informes a socios, informes de subvenciones, planificación y otros fines legales.</li>
          <li><strong>Administración de programas:</strong> podemos usar la información para administrar desafíos, competencias, recompensas, el acceso a las ofertas de socios o su uso, los programas de escuelas y empleadores, las campañas What Moves Us y los términos de los programas relacionados.</li>
        </Ul>
        <P>
          No vendemos su información personal, no usamos su información personal para publicidad
          dirigida y no usamos su información personal para publicidad de terceros.
        </P>
        <P>
          No compartimos registros individuales de viajes, historial de ubicación precisa, lugares
          guardados ni datos del perfil de rutas inferido con empleadores, escuelas, patrocinadores,
          socios de recompensas u otros terceros sin su consentimiento explícito, excepto como se
          describe en esta Política de privacidad o cuando la ley lo exija. No compartimos su Shift Rate
          personal con escuelas, patrocinadores ni socios de recompensas sin su consentimiento
          explícito. Si se une al grupo de su empleador, su empleador ve la información descrita en
          &ldquo;Con empleadores&rdquo;, más abajo, incluido su Shift Rate.
        </P>
        <P>
          Si cambiamos de forma importante cómo recogemos, usamos, compartimos o conservamos la
          información personal, actualizaremos esta Política de privacidad y le avisaremos cuando
          corresponda.
        </P>
      </Section>

      <Section title="Cómo compartimos su información">
        <P>
          Compartimos información personal como se describe en esta Política de privacidad, según usted
          lo indique o lo consienta, según sea necesario para ofrecer Shift y los servicios
          relacionados, o según lo permita o lo exija la ley.
        </P>

        <H3>Con otras personas que usan Shift</H3>
        <P>
          Su nombre visible y sus estadísticas generales de impacto pueden ser visibles para otras
          personas dentro de competencias compartidas o clasificaciones de la comunidad, según la
          configuración de visibilidad de esas competencias. Las competencias privadas (por ejemplo,
          los desafíos de escuelas o de empleadores) solo las ven las personas participantes
          verificadas.
        </P>

        <H3>Con proveedores de servicios</H3>
        <P>Usamos un número limitado de proveedores de servicios externos para operar la app:</P>
        <Ul>
          <li><strong>Supabase</strong> (infraestructura de base de datos y de inicio de sesión): los datos de su cuenta y de sus viajes se guardan en la infraestructura segura en la nube de Supabase.</li>
          <li><strong>Expo / EAS</strong> (entrega y actualizaciones de la app): se usa para entregar la app y enviar actualizaciones por internet.</li>
          <li><strong>Servicios de notificaciones push</strong> (Apple APNs / Google FCM): se usan para enviar notificaciones a su dispositivo. Estos servicios reciben el identificador de su dispositivo, pero no su ubicación ni sus datos de viajes.</li>
          <li><strong>Anthropic</strong> (la inteligencia artificial del asistente de Shift): recibe sus preguntas al asistente y lo que busca para responderlas. Según sus términos, Anthropic no usa esto para entrenar sus modelos.</li>
          <li><strong>Google Maps Platform:</strong> busca lugares y planea viajes en transporte público para el asistente de Shift y el mapa Cerca de ti. Recibe los lugares del viaje, no su nombre ni su correo electrónico.</li>
          <li><strong>API de la MBTA o proveedores de datos de transporte público:</strong> se usan para comparar los patrones de viaje con los datos del transporte público, para clasificar los viajes en transporte público y para las funciones sobre interrupciones del servicio.</li>
          <li><strong>Proveedores de análisis, diagnóstico e infraestructura:</strong> se usan para entender el rendimiento de la app, diagnosticar fallas, mantener la seguridad y mejorar el funcionamiento.</li>
        </Ul>
        <P>
          Nuestros proveedores de servicios están autorizados a usar la información personal solo según
          sea necesario para prestarnos sus servicios, y deben tratarla de acuerdo con la ley aplicable
          y con nuestras instrucciones.
        </P>
        <P>
          Cuando corresponde, firmamos contratos que obligan a los proveedores de servicios a mantener la
          información personal en confidencialidad y a no usarla para fines distintos de prestarnos sus
          servicios.
        </P>

        <H3>Con patrocinadores y socios</H3>
        <P>
          En la mayoría de las ofertas de socios basadas en el acceso, no le damos al socio su historial
          individual de ubicación, sus lugares guardados, los datos de su perfil de rutas inferido, sus
          registros de viajes ni su Shift Rate personal.
        </P>
        <P>
          Si una recompensa, oferta o beneficio requiere verificación, entrega, prevención de fraude,
          atención al cliente o ayuda que usted pida, podemos compartir solo la información limitada que
          sea razonablemente necesaria para ese fin, como una confirmación de acceso, el estado de un
          código de descuento, la actividad de la oferta, su primer nombre o los detalles del canje,
          cuando corresponda.
        </P>
        <P>
          Podemos compartir más información con un patrocinador o socio solo con su consentimiento
          explícito o cuando la ley lo exija.
        </P>

        <H3>Con empleadores</H3>
        <P>
          Unirse al grupo de su empleador en Shift, con un código de invitación, un enlace para unirse o
          su correo del trabajo, es voluntario. Las personas que manejan el programa de su empleador
          pueden ver lo siguiente sobre usted, con su nombre, de los últimos 7 días, los últimos 30 días
          o desde el principio, y pueden descargarlo como hoja de cálculo:
        </P>
        <Ul>
          <li>Su nombre visible, su foto de perfil y la fecha en que se unió</li>
          <li>Cuántos viajes hizo, y cuántos fueron a pie, en bicicleta, en transporte público u otros viajes activos</li>
          <li>Su Shift Rate (el porcentaje de sus viajes que fueron viajes activos)</li>
          <li>Las millas que cambió y las emisiones de CO2 que esos viajes evitaron</li>
          <li>Si su empleador financia recompensas, las recompensas que usted recibió</li>
        </Ul>
        <P>
          Su empleador no ve a dónde va usted. No recibe las rutas ni los mapas de sus viajes, sus
          ubicaciones GPS, los puntos de inicio o fin de sus viajes, sus lugares guardados (como su casa)
          ni los datos de su perfil de rutas inferido.
        </P>
        <P>
          Puede salir del grupo de su empleador en cualquier momento en la app. Cuando sale, ya no
          aparece en la lista de miembros de su empleador.
        </P>

        <H3>Con escuelas</H3>
        <P>
          Si se une a un desafío de una escuela con un código de invitación, su participación es
          voluntaria, y sus conteos generales de viajes y sus estadísticas de impacto pueden incluirse
          en los informes que se le dan a esa escuela.
        </P>
        <P>
          Estos informes contienen solo datos anónimos o agrupados, a menos que usted haya aceptado
          explícitamente que se le identifique individualmente.
        </P>
        <P>
          Las escuelas no reciben datos individuales de viajes, información de ubicación, lugares
          guardados, datos del perfil de rutas inferido ni su Shift Rate personal sin su consentimiento
          explícito.
        </P>

        <H3>Requisitos legales</H3>
        <P>
          Podemos divulgar su información si la ley, las normas o un proceso legal válido nos lo exigen,
          o para proteger los derechos y la seguridad de GSI, de nuestras personas usuarias o del público.
        </P>

        <H3>Transferencia de la empresa u organización</H3>
        <P>
          Podemos divulgar o transferir información personal en relación con una fusión, venta de una
          parte, reestructuración, reorganización, disolución, transferencia de bienes, transición de un
          programa o una operación similar que afecte a todos o a parte de los bienes u operaciones de
          GSI, sujeto a la ley aplicable.
        </P>

        <H3>Datos agrupados y anónimos</H3>
        <P>
          Podemos usar y divulgar información que se haya agrupado o anonimizado para que ya no le
          identifique, para cualquier fin legal, como informes de impacto en la comunidad,
          investigación, planificación, informes a socios, informes de subvenciones y comunicaciones
          públicas.
        </P>
      </Section>

      <Section title="Conservación de datos">
        <P>
          Conservamos la información personal mientras sea razonablemente necesario para los fines con
          los que se recogió, incluido ofrecer Shift, mantener su cuenta, administrar XP, nivel,
          recompensas, actividad de ofertas, competencias, desafíos, campañas y programas, cumplir las
          obligaciones legales, resolver disputas, hacer cumplir los acuerdos, proteger la seguridad y
          mantener registros administrativos correctos.
        </P>
        <Ul>
          <li><strong>Cuenta activa:</strong> los registros de viajes y los datos de la cuenta se conservan mientras su cuenta esté activa.</li>
          <li><strong>Borrado de la cuenta:</strong> cuando usted borra su cuenta, sus datos personales, incluidos su nombre, su correo electrónico, sus lugares guardados, su perfil de rutas inferido y los registros de viajes obtenidos de la ubicación, se borran o se desvinculan de su identidad en los sistemas activos dentro de 30 días, a menos que la ley, las necesidades de seguridad, los ciclos de copias de seguridad, la resolución de disputas, la prevención de fraude o las necesidades operativas limitadas descritas en esta Política de privacidad requieran o permitan un plazo más largo. Los datos anónimos o agrupados pueden conservarse para informes, investigación, planificación, informes a socios, informes de subvenciones y medición del impacto en la comunidad, porque ya no le identifican.</li>
          <li><strong>Cuentas inactivas:</strong> las cuentas sin actividad durante 24 meses seguidos pueden desactivarse y sus datos borrarse, con un aviso previo a su correo electrónico registrado.</li>
          <li><strong>XP, recompensas y actividad de ofertas:</strong> su XP o su nivel, su historial de recompensas, su historial de acceso a ofertas y los registros relacionados se borran o se desvinculan de su identidad cuando usted borra su cuenta, sujeto a los ciclos normales de copias de seguridad, las obligaciones legales, la prevención de fraude, los requisitos tributarios o contables, la resolución de disputas y las necesidades de informes a programas, patrocinadores o socios. Los conteos agrupados o anónimos pueden conservarse para informes de programas, informes a patrocinadores, informes a socios, informes de subvenciones, investigación, planificación y medición del impacto en la comunidad, porque ya no le identifican.</li>
          <li><strong>Perfil de rutas:</strong> su perfil de rutas inferido se borra dentro de los 30 días después de borrar la cuenta.</li>
          <li><strong>Conversaciones con el asistente:</strong> se borran 12 meses después de su último mensaje en una conversación, o antes si usted las borra o borra su cuenta.</li>
        </Ul>
      </Section>

      <Section title="Cookies y otras tecnologías de seguimiento">
        <P>
          Nuestro sitio web y nuestra app pueden usar cookies, píxeles, SDK, identificadores del
          dispositivo, herramientas de análisis y tecnologías de seguimiento similares para operar
          nuestros servicios, mantener la seguridad, recordar preferencias, analizar el funcionamiento y
          el rendimiento, entender el uso y mejorar la experiencia.
        </P>
        <P>
          Las tecnologías estrictamente necesarias nos ayudan a ofrecer las funciones básicas, como el
          inicio de sesión en la cuenta, la seguridad, el funcionamiento de la app y la operación del
          servicio.
        </P>
        <P>
          Las tecnologías de análisis y rendimiento nos ayudan a entender cómo las personas usan el
          sitio web o la app y a mejorar el funcionamiento de nuestros servicios.
        </P>
        <P>
          Las tecnologías de funcionalidad pueden ayudarnos a recordar preferencias o a personalizar
          funciones de la app o del sitio web.
        </P>
        <P>
          No usamos cookies ni tecnologías de seguimiento para vender información personal ni para
          mostrar publicidad dirigida.
        </P>
        <P>
          Si nuestras prácticas cambian, actualizaremos esta Política de privacidad antes de usar
          cookies o tecnologías similares para publicidad dirigida.
        </P>
        <P>
          Por lo general, puede configurar su navegador para bloquear o limitar las cookies, pero
          algunas cookies o tecnologías similares pueden ser necesarias para que el sitio web o la app
          funcionen bien.
        </P>
      </Section>

      <Section title="Sus opciones de privacidad y controles de la cuenta">
        <P>Puede manejar muchas opciones de privacidad directamente en Shift:</P>
        <Ul>
          <li><strong>Información de la cuenta:</strong> puede ver y actualizar parte de la información de su cuenta en la app.</li>
          <li><strong>Permisos de ubicación:</strong> puede quitar el permiso de ubicación en segundo plano en cualquier momento en la configuración de su dispositivo. Quitarlo desactiva la detección automática de viajes, pero es posible que pueda seguir usando Shift para anotar viajes a mano.</li>
          <li><strong>Lugares guardados:</strong> puede ver, editar o borrar sus lugares guardados en la configuración de la app.</li>
          <li><strong>Conversaciones con el asistente:</strong> puede borrar una conversación, o todas, desde el asistente en la app, o escribiendo a <Mail />.</li>
          <li><strong>Perfil de rutas inferido:</strong> puede ver y borrar su perfil de rutas inferido en la configuración de la app.</li>
          <li><strong>Notificaciones:</strong> puede ajustar o desactivar las notificaciones en la configuración de notificaciones de la app o en la configuración de su dispositivo.</li>
          <li><strong>Borrado de la cuenta:</strong> puede borrar su cuenta en la app o escribiendo a <Mail />. Cuando borra su cuenta, borramos o desvinculamos de su identidad la información personal asociada a su cuenta, como se describe en la sección Conservación de datos.</li>
          <li><strong>Grabaciones de What Moves Us:</strong> si participa en una campaña What Moves Us, puede retirar su consentimiento y pedir que se borren sus grabaciones, como se describe en los términos de consentimiento de la campaña y en esta Política de privacidad.</li>
          <li><strong>Comunicaciones de marketing:</strong> puede dejar de recibir correos o mensajes de texto de marketing como se describe en la sección Correos de marketing y mensajes de texto (SMS).</li>
        </Ul>
        <P>
          También puede escribirnos a <Mail /> para hacer preguntas sobre su información, pedir ayuda
          para acceder a su cuenta o borrarla, o plantear una inquietud sobre privacidad.
        </P>
        <P>
          Es posible que necesitemos verificar su identidad antes de ayudarle con el acceso a la cuenta,
          su borrado u otras solicitudes sobre su cuenta. Revisaremos y responderemos las preguntas y
          solicitudes sobre privacidad en un plazo razonable. Cumpliremos las leyes de privacidad que nos
          apliquen. Si no podemos completar una solicitud, le explicaremos por qué cuando corresponda.
        </P>
      </Section>

      <Section title="Correos de marketing y mensajes de texto (SMS)">
        <P>
          Puede dejar de recibir correos de marketing siguiendo las instrucciones para cancelar la
          suscripción que vienen en cualquier correo de marketing o promocional que reciba, o
          escribiendo a <Mail />.
        </P>
        <P>
          Si le enviamos mensajes de texto (SMS) de marketing y ya no quiere recibirlos, puede cancelarlos
          respondiendo &ldquo;STOP&rdquo; o siguiendo cualquier otra instrucción para cancelar que venga en
          el mensaje.
        </P>
        <P>
          Es posible que le sigamos enviando mensajes operativos, de transacciones, de seguridad, de la
          cuenta y del servicio, cuando la ley lo permita.
        </P>
      </Section>

      <Section title="Privacidad de los niños">
        <P>Debe tener al menos 13 años para crear una cuenta de Shift.</P>
        <P>
          Si tiene entre 13 y 18 años, usted confirma que tiene permiso de su madre, su padre o su tutor
          para usar la app.
        </P>
        <P>
          El programa escolar de Shift está pensado para niños menores de 13 años, pero funciona a través
          de cuentas de maestros, administradores escolares o instituciones, no de cuentas directas de
          estudiantes.
        </P>
        <P>
          Los estudiantes menores de 13 años no deben crear cuentas personales de Shift ni usar la app
          directamente, a menos que GSI haya puesto en marcha e informado un proceso adecuado de
          consentimiento y de autorización de la escuela.
        </P>
        <P>
          No recogemos a sabiendas información personal directamente de niños menores de 13 años sin un
          consentimiento verificable de su madre, padre o tutor, una autorización de la escuela u otra
          base que la ley permita.
        </P>
        <P>
          Si cree que, sin querer, hemos recogido información personal de un niño menor de 13 años sin el
          consentimiento o la autorización adecuados, escríbanos de inmediato a <Mail /> y tomaremos
          medidas razonables para borrar la información o cumplir de otra forma con la ley aplicable.
        </P>
      </Section>

      <Section title="Seguridad">
        <P>
          Usamos medidas de protección físicas, electrónicas, técnicas y administrativas
          comercialmente razonables, diseñadas para proteger la información que recogemos.
        </P>
        <P>
          Usamos medidas de seguridad comercialmente razonables diseñadas para proteger sus datos,
          entre ellas:
        </P>
        <Ul>
          <li>Almacenamiento de datos cifrado, incluido el cifrado de los datos guardados que ofrecen nuestros proveedores de infraestructura cuando corresponde</li>
          <li>Seguridad por fila en nuestra base de datos, diseñada para ayudar a que cada persona solo pueda acceder a sus propios datos</li>
          <li>Credenciales de acceso que vencen y se renuevan con regularidad</li>
        </Ul>
        <P>
          Ningún método de transmisión o de almacenamiento es completamente seguro. No podemos
          garantizar una seguridad absoluta, pero nos comprometemos a proteger su información con medidas
          razonables y adecuadas.
        </P>
        <P>
          La transmisión de información por internet o a través de aplicaciones móviles no es
          completamente segura, y cualquier transmisión de información es bajo su propio riesgo. Usted
          es responsable de mantener la confidencialidad de las credenciales de su cuenta y de avisarnos
          pronto si cree que alguien entró a su cuenta sin permiso.
        </P>
      </Section>

      <Section title="Sitios web y servicios de terceros">
        <P>
          Shift y el sitio web pueden incluir enlaces a, integraciones con o datos de sitios web,
          plataformas, API, servicios, tiendas de apps, servicios de notificaciones y proveedores de
          datos de transporte público de terceros.
        </P>
        <P>
          El uso de sitios web o servicios de terceros puede estar sujeto a los términos y las políticas
          de privacidad de esos terceros.
        </P>
        <P>
          No somos responsables de las prácticas de privacidad, el contenido, la exactitud, la
          disponibilidad ni las políticas de sitios web o servicios de terceros que no controlamos.
        </P>
      </Section>

      <Section title="Accesibilidad">
        <P>Queremos que todas las personas puedan acceder a esta Política de privacidad.</P>
        <P>Para pedir esta Política de privacidad en otro formato, escríbanos a <Mail />.</P>
      </Section>

      <Section title="Cambios a esta política">
        <P>
          Podemos actualizar esta Política de privacidad de vez en cuando, y le recomendamos revisarla
          con regularidad. Si hacemos cambios importantes, incluidos cambios importantes en cómo
          recogemos, usamos, compartimos o conservamos los datos de ubicación, se lo avisaremos en la
          app, por correo electrónico, con un aviso en nuestro sitio web o por otro medio razonable
          antes de que los cambios entren en vigor, cuando corresponda.
        </P>
        <P>
          Si sigue usando Shift, el sitio web o los servicios relacionados después de la fecha de
          entrada en vigor de una Política de privacidad actualizada, significa que acepta la Política
          de privacidad actualizada.
        </P>
        <P>
          Si no está de acuerdo con la Política de privacidad actualizada, debe dejar de usar Shift, el
          sitio web y los servicios relacionados.
        </P>
      </Section>

      <Section title="Contáctenos">
        <P>
          Green Streets Initiative<br />
          519 Somerville Ave, Ste 2, Box 103<br />
          Somerville, MA 02143<br />
          <Mail />
        </P>
        <P>
          Si tiene preguntas sobre esta política o sobre cómo se manejan sus datos, escríbanos. Somos un
          equipo pequeño y le responderemos personalmente.
        </P>
      </Section>
    </>
  )
}
