import Link from 'next/link'
import { translatedPath } from '@/lib/translated-pages'
import { A, P, ResultsLink, Section, SubSection, Toc, Ul } from './legal'
import type { RulesVars } from './WalkRideDayRules'

/*
 * Walk/Ride Day official rules, Spanish. AI translation pending a native
 * speaker's review. Section for section with the English page
 * (src/app/events/walk-ride-day/rules/page.tsx): when the English changes,
 * this changes in the same edit. Register: usted, as legal text in Spanish
 * usually is; the program pages use tú.
 */

const TOC = [
  { id: 'promotion', title: 'Nombre de la promoción y patrocinador' },
  { id: 'eligibility', title: 'Quién puede participar' },
  { id: 'promotion-period', title: 'Período de la promoción' },
  { id: 'how-to-enter', title: 'Cómo participar' },
  { id: 'prizes', title: 'Premios' },
  { id: 'winner-selection', title: 'Selección y aviso a los ganadores' },
  { id: 'prize-conditions', title: 'Condiciones de los premios' },
  { id: 'tax-obligations', title: 'Impuestos' },
  { id: 'general-conditions', title: 'Condiciones generales' },
  { id: 'privacy', title: 'Privacidad' },
  { id: 'limitation-of-liability', title: 'Limitación de responsabilidad' },
  { id: 'disputes', title: 'Disputas' },
  { id: 'contact', title: 'Contacto' },
]

function entries(n: number): string {
  return n === 1 ? 'una (1) participación' : `${n} participaciones`
}

export default function RulesEs({ v }: { v: RulesVars }) {
  const name = v.name ?? 'Walk/Ride Day'
  const ref = v.referralOpensLabel
  return (
    <>
      <div className="mt-6 rounded-[12px] border border-navy/10 bg-navy/[0.04] p-5">
        <p className="text-[1.0625rem] leading-[1.7] text-navy">
          <strong>Usted participa automáticamente.</strong> No tiene que inscribirse. Cada viaje
          válido que registre en la app Shift durante el Walk/Ride Day le da una participación en el
          sorteo. No se requiere ninguna compra, pago ni acción de inscripción de ningún tipo.
          {ref && (
            <>
              {' '}También puede recibir participaciones adicionales si invita a sus amistades a Shift
              entre el {ref} y el {v.dayLabel}. Vea la Sección 4.
            </>
          )}
        </p>
      </div>

      <hr className="my-10 border-navy/10" />
      <Toc title="Contenido" items={TOC} />
      <hr className="my-10 border-navy/10" />

      <div className="space-y-10">
        <Section id="promotion" title="1. Nombre de la promoción y patrocinador">
          <Ul>
            <li><strong>Promoción:</strong> Sorteo de tarjetas de regalo del {name}</li>
            <li><strong>Patrocinador:</strong> Green Streets Initiative, Inc., organización sin fines de lucro 501(c)(3), Somerville, MA (&ldquo;GSI&rdquo;)</li>
            <li>
              Se administra a través de la app móvil Shift, disponible en la{' '}
              <a href="https://apps.apple.com/us/app/shift-by-gsi/id6761119037" className={A}>App Store</a>{' '}y en{' '}
              <a href="https://play.google.com/store/apps/details?id=org.greenstreets.shift" className={A}>Google Play</a>
            </li>
            <li>
              Este sorteo es aparte e independiente del sorteo Shift Your Summer 2026. Las
              participaciones en uno no afectan al otro.
            </li>
          </Ul>
        </Section>

        <Section id="eligibility" title="2. Quién puede participar">
          <Ul>
            <li>
              Pueden participar los residentes de los Estados Unidos que tengan al menos 18 años de
              edad y vivan en el Estado Libre Asociado (Commonwealth) de Massachusetts.
            </li>
            <li>
              Los empleados y los miembros de la junta directiva de GSI, y los familiares inmediatos de
              todas esas personas, no pueden ganar.
            </li>
            <li>
              <strong>Se confirma que una persona puede participar cuando reclama un premio, no al
              momento de participar.</strong> Las participaciones se suman automáticamente a partir de
              los viajes válidos{ref ? ' y de las invitaciones' : ''}, por lo que una persona que no
              cumpla los requisitos podría salir seleccionada de todos modos. Toda persona seleccionada
              que no confirme que tiene 18 años o más y que reside en Massachusetts pierde el premio, y
              el premio se entrega a otra persona seleccionada por el mismo método. Vea la Sección 7.
            </li>
            <li>
              GSI no exige que las personas tengan registrada su fecha de nacimiento ni su estado de
              residencia para recibir participaciones. Si los datos de una persona no permiten
              confirmar que cumple los requisitos, sigue en el sorteo y, si sale seleccionada, se le
              pide que lo confirme.
            </li>
            <li>
              No es necesario comprar nada para participar ni para ganar. Esta promoción está sujeta a
              todas las leyes y normas federales, estatales y locales, y es nula donde esté prohibida.
            </li>
          </Ul>
        </Section>

        <Section id="promotion-period" title="3. Período de la promoción">
          <Ul>
            {v.dayLabel ? (
              <li>El Período de la promoción es el {v.dayLabel}, de 12:00 a. m. a 11:59 p. m., hora del Este.</li>
            ) : (
              <li>
                El Período de la promoción es un solo Walk/Ride Day, de 12:00 a. m. a 11:59 p. m., hora
                del Este. El Walk/Ride Day es el último viernes de la mayoría de los meses.
              </li>
            )}
            <li>
              Solo los viajes registrados dentro del Período de la promoción cuentan como
              participaciones por viajes. Los viajes registrados antes o después no cuentan, sin
              importar cuándo se confirmen en la app.
            </li>
            {ref && (
              <li>
                El Período de invitaciones va desde las 12:00 a. m., hora del Este, del {ref} hasta las
                11:59 p. m., hora del Este, del {v.dayLabel}. Una participación por invitación (Sección 4)
                se recibe solo cuando la persona invitada ingresa el código y además registra su primer
                viaje dentro del Período de invitaciones.
              </li>
            )}
          </Ul>
        </Section>

        <Section id="how-to-enter" title="4. Cómo participar">
          <P>
            La participación es automática. Registre un viaje válido en la app Shift durante el
            Período de la promoción y ya está participando. No hay que aceptar nada, ni llenar un
            formulario, ni hacer un registro aparte.
            {ref && (
              <>
                {' '}También puede recibir participaciones adicionales si invita a sus amistades, como
                se explica abajo. Invitar a sus amistades es opcional y nunca es un requisito para
                participar ni para ganar.
              </>
            )}
          </P>

          <SubSection title="Qué cuenta como viaje válido">
            <Ul>
              <li>
                Un viaje a pie, en bicicleta, en scooter eléctrico, en autobús, en metro o tren ligero,
                en tren de cercanías, en ferry o en auto compartido (dos o más personas en el auto).
              </li>
              <li>
                La app Shift debe registrar el viaje y verificar su ubicación. Los viajes que se
                ingresan a mano, o que la app no puede verificar, no cuentan como participaciones.
              </li>
              <li>Un viaje en auto con solo el conductor a bordo no cuenta como participación.</li>
            </Ul>
          </SubSection>

          <SubSection title="Cuántas participaciones">
            <Ul>
              <li>Cada viaje válido cuenta como una (1) participación.</li>
              <li>
                Cada persona puede recibir un máximo de {entries(v.maxEntries)} por viajes durante el
                Período de la promoción. Los viajes válidos adicionales son bienvenidos, pero no
                aumentan el número de participaciones.
                {ref && ' Las participaciones por invitaciones se cuentan aparte, como se explica abajo.'}
              </li>
              <li>
                Las participaciones son por persona, no por dispositivo ni por cuenta. Intentar obtener
                participaciones adicionales con varias cuentas es motivo de descalificación.
              </li>
            </Ul>
          </SubSection>

          {ref && (
            <SubSection title="Participaciones por invitaciones">
              <Ul>
                <li>
                  Cada miembro de Shift tiene un código personal de invitación en la app Shift. Usted
                  recibe {entries(v.referralPerFriend)} en este sorteo por cada amistad que ingrese su
                  código en la app Shift y después registre su primer viaje verificado por la app Shift.
                  Las dos cosas deben ocurrir durante el Período de invitaciones (del {ref} al {v.dayLabel}).
                </li>
                <li>
                  Cada persona puede recibir un máximo de {v.referralMax === 1 ? 'una (1) participación' : `${v.referralMax} participaciones`}{' '}
                  por invitaciones. Las participaciones por invitaciones se suman al máximo de
                  participaciones por viajes indicado arriba.
                </li>
                <li>
                  Las participaciones por invitaciones cuentan solo en este sorteo del Walk/Ride Day y no
                  pasan a ningún otro sorteo. El primer viaje de una amistad registrado después de las
                  11:59 p. m., hora del Este, del {v.dayLabel} no agrega participaciones.
                </li>
                <li>
                  El código de invitación debe ingresarse dentro de los 30 días después de que la
                  amistad cree su cuenta de Shift. Cada persona puede usar un solo código de invitación,
                  y nadie puede usar su propio código. La amistad recibe participaciones por sus propios
                  viajes válidos de la forma habitual.
                </li>
                <li>Invitar a sus amistades es gratis y opcional, y nunca es un requisito para participar ni para ganar.</li>
                <li>
                  Cada invitación debe ser de una persona distinta y real. GSI puede revisar y anular
                  participaciones por invitaciones que involucren un dispositivo compartido, más de una
                  cuenta de la misma persona o cualquier otro mal uso. Las participaciones por
                  invitaciones no cambian quién puede ganar (Sección 2).
                </li>
              </Ul>
            </SubSection>
          )}

          <SubSection title="No se requiere otra forma de participar">
            <P>
              Como para participar no se requiere ninguna compra, pago, suscripción ni acción de
              inscripción de ningún tipo (las participaciones vienen del uso normal de una app
              gratuita), este sorteo no ofrece otra forma de participar. Descargar y usar la app Shift
              es gratis.
              {ref && ' Invitar a una amistad es gratis y opcional, y nunca es un requisito para participar ni para ganar.'}
            </P>
          </SubSection>
        </Section>

        <Section id="prizes" title="5. Premios">
          {v.prizes.length === 0 ? (
            <P><em>Los premios de este Walk/Ride Day se publicarán aquí cuando estén definidos.</em></P>
          ) : (
            <>
              <Ul>
                {v.prizes.map(p => (
                  <li key={p.id}>
                    <strong>{p.quantity} &times;</strong> {p.text}
                    {p.value && <> &mdash; valor comercial aproximado de {p.value}{p.quantity > 1 ? ' cada una' : ''}</>}
                  </li>
                ))}
              </Ul>
              {v.totalArv && (
                <P><strong>Valor comercial aproximado total de todos los premios: {v.totalArv}.</strong></P>
              )}
            </>
          )}
          <Ul>
            <li>
              Los premios son tarjetas de regalo digitales que se entregan por medios electrónicos. La
              persona ganadora elige el comercio entre las opciones que GSI ofrezca al momento de
              canjearla.
            </li>
            <li>
              Los premios no se pueden transferir ni cambiar por otros, excepto que GSI puede
              reemplazar un premio por otro de igual o mayor valor si un premio deja de estar
              disponible.
            </li>
            <li>Los premios no tienen valor en efectivo y no se pueden canjear por dinero.</li>
            <li>Límite de un premio por persona.</li>
            {v.prizes.length > 1 && (
              <li>
                Cada participación cuenta para todos los niveles de premio indicados arriba. Las
                personas que participan no eligen un nivel de premio.
              </li>
            )}
          </Ul>
        </Section>

        <Section id="winner-selection" title="6. Selección y aviso a los ganadores">
          <Ul>
            <li>
              Los ganadores se eligen al azar entre todas las participaciones recibidas durante el
              Período de la promoción. La probabilidad de ganar de cada persona es proporcional al
              número de participaciones que recibió, hasta {ref ? 'los máximos' : 'el máximo'} de la Sección 4.
            </li>
            {v.prizes.length > 1 && (
              <li>
                Los premios se sortean en el orden de la Sección 5, empezando por el premio de mayor
                valor. Una persona seleccionada para un premio no puede ser seleccionada para otro
                premio en el mismo sorteo.
              </li>
            )}
            <li>
              {v.drawLabel
                ? <>El sorteo se realizará el {v.drawLabel} o alrededor de esa fecha.</>
                : <>El sorteo se realizará el día después de que termine el Período de la promoción o alrededor de esa fecha.</>}
            </li>
            <li>
              GSI realiza el sorteo con un proceso automático de selección al azar, y cada sorteo
              queda guardado en un registro de auditoría que GSI conserva. Todas las decisiones de GSI
              sobre la selección de ganadores son definitivas.
            </li>
            <li>
              Se avisa a los ganadores en la app Shift, y por notificación push y por correo
              electrónico cuando la persona los tiene activados. GSI no es responsable si un aviso no
              llega a la persona ganadora por una dirección de correo incorrecta, un buzón lleno, un
              filtro de correo no deseado o notificaciones desactivadas.
            </li>
            <li>
              Después del sorteo, GSI publica los resultados, con la lista de ganadores, en{' '}
              <ResultsLink href={v.resultsHref} /> (en inglés), y avisa a todas las personas que
              participaron que ya están los resultados. Los ganadores aparecen con su nombre, la
              inicial de su apellido y su ciudad, o solo con su ciudad cuando su perfil de Shift es
              privado o lo piden.
            </li>
            <li>
              Se les puede pedir a los ganadores que participen en actividades promocionales
              (publicación en redes sociales, foto, testimonio). Aceptar un premio puede constituir un
              permiso para usar el nombre y la imagen de la persona ganadora con fines promocionales
              (excepto donde la ley lo prohíba).
            </li>
          </Ul>
        </Section>

        <Section id="prize-conditions" title="7. Condiciones de los premios">
          <Ul>
            <li>
              Para reclamar un premio, la persona seleccionada debe confirmar en la app Shift que tiene
              18 años o más y que reside en Massachusetts, aceptar haber leído estas Reglas oficiales y
              dar una dirección de correo electrónico válida para la entrega.
            </li>
            <li>
              <strong>El premio debe reclamarse dentro de los siete (7) días siguientes al aviso.</strong>{' '}
              Un premio que no se reclama se pierde y se entrega a otra persona seleccionada por el
              mismo método.
            </li>
            <li>
              Una persona seleccionada que confirme que es menor de 18 años, o que reside fuera de
              Massachusetts, pierde el premio. El premio se entrega entonces a otra persona. Perderlo
              por esta razón no tiene ninguna otra consecuencia ni afecta ninguna otra parte de su
              cuenta de Shift.
            </li>
            <li>
              Una persona seleccionada puede rechazar un premio. Un premio rechazado se entrega a otra
              persona.
            </li>
          </Ul>
        </Section>

        <Section id="tax-obligations" title="8. Impuestos">
          <Ul>
            <li>Los ganadores son responsables de cualquier impuesto federal, estatal y local que resulte de un premio.</li>
            <li>
              GSI declara los ingresos por premios cuando la ley lo exige. Si aplican obligaciones de
              declaración, se le puede pedir a la persona ganadora un Número de Identificación del
              Contribuyente (TIN) antes de entregarle el premio.
            </li>
          </Ul>
        </Section>

        <Section id="general-conditions" title="9. Condiciones generales">
          <Ul>
            <li>Al participar, las personas aceptan cumplir estas Reglas oficiales.</li>
            <li>
              GSI se reserva el derecho de descalificar a cualquier persona que manipule el proceso de
              participación, registre viajes de forma fraudulenta, use varias cuentas o actúe de
              cualquier otra manera que GSI, con un criterio razonable, considere contraria a estas
              Reglas o de mala fe.
            </li>
            <li>
              GSI se reserva el derecho de modificar, suspender o cancelar este sorteo si no se puede
              realizar como estaba previsto, incluso por una falla técnica. Si se cancela el sorteo,
              GSI puede entregar los premios entre las participaciones válidas recibidas hasta el
              momento de la cancelación.
            </li>
            <li>
              Nada en estas Reglas obliga a nadie a hacer un viaje que no haría de otro modo, ni a
              trasladarse de una forma que considere insegura. Cada participante es responsable de su
              propia seguridad y de cumplir todas las leyes de tránsito.
            </li>
          </Ul>
        </Section>

        <Section id="privacy" title="10. Privacidad">
          <Ul>
            <li>
              La información que se recoge en relación con este sorteo se usa para administrar el
              sorteo y entregar los premios. Se trata de acuerdo con la{' '}
              <Link href={translatedPath('es', 'privacy')} className={A}>Política de privacidad de GSI</Link>.
            </li>
            <li>
              La fecha de nacimiento y el estado de residencia que se dan al reclamar un premio se usan
              para confirmar que la persona puede participar, y se conservan como constancia de esa
              confirmación.
            </li>
            <li>
              GSI no vende información personal, y no comparte información de las personas que
              participan con los comercios de los premios más allá de lo necesario para entregar una
              tarjeta de regalo.
            </li>
          </Ul>
        </Section>

        <Section id="limitation-of-liability" title="11. Limitación de responsabilidad">
          <Ul>
            <li>
              Al participar, las personas liberan a GSI, y a sus directores, funcionarios, empleados y
              voluntarios, de toda responsabilidad por pérdidas, perjuicios o daños que resulten de
              participar en este sorteo o de aceptar o usar un premio.
            </li>
            <li>
              GSI no es responsable de participaciones que no se registren por una falla del
              dispositivo, una falla de los servicios de ubicación, una caída de la red o cualquier
              otro problema técnico fuera de su control razonable.
            </li>
          </Ul>
        </Section>

        <Section id="disputes" title="12. Disputas">
          <Ul>
            <li>
              Estas Reglas oficiales se rigen por las leyes del Estado Libre Asociado (Commonwealth) de
              Massachusetts, sin tener en cuenta sus normas sobre conflictos de leyes.
            </li>
            <li>
              Cualquier disputa que surja de este sorteo se resolverá en los tribunales estatales o
              federales ubicados en Massachusetts.
            </li>
          </Ul>
        </Section>

        <Section id="contact" title="13. Contacto">
          <P>
            Puede enviar sus preguntas sobre este sorteo, o sobre un premio, a{' '}
            <a href="mailto:info@gogreenstreets.org" className={A}>info@gogreenstreets.org</a>.
          </P>
          <P>Green Streets Initiative, Inc. &middot; Somerville, Massachusetts</P>
        </Section>
      </div>
    </>
  )
}
