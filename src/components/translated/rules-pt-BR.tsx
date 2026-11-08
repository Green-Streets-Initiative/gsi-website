import Link from 'next/link'
import { translatedPath } from '@/lib/translated-pages'
import { A, P, ResultsLink, Section, SubSection, Toc, Ul } from './legal'
import type { RulesVars } from './WalkRideDayRules'

/*
 * Walk/Ride Day official rules, Brazilian Portuguese. AI translation pending
 * a native speaker's review. Section for section with the English page
 * (src/app/events/walk-ride-day/rules/page.tsx): when the English changes,
 * this changes in the same edit.
 */

const TOC = [
  { id: 'promotion', title: 'Nome da promoção e patrocinador' },
  { id: 'eligibility', title: 'Quem pode participar' },
  { id: 'promotion-period', title: 'Período da promoção' },
  { id: 'how-to-enter', title: 'Como participar' },
  { id: 'prizes', title: 'Prêmios' },
  { id: 'winner-selection', title: 'Escolha e aviso dos ganhadores' },
  { id: 'prize-conditions', title: 'Condições dos prêmios' },
  { id: 'tax-obligations', title: 'Impostos' },
  { id: 'general-conditions', title: 'Condições gerais' },
  { id: 'privacy', title: 'Privacidade' },
  { id: 'limitation-of-liability', title: 'Limitação de responsabilidade' },
  { id: 'disputes', title: 'Disputas' },
  { id: 'contact', title: 'Contato' },
]

function entries(n: number): string {
  return n === 1 ? 'uma (1) participação' : `${n} participações`
}

export default function RulesPtBR({ v }: { v: RulesVars }) {
  const name = v.name ?? 'Walk/Ride Day'
  const ref = v.referralOpensLabel
  return (
    <>
      <div className="mt-6 rounded-[12px] border border-navy/10 bg-navy/[0.04] p-5">
        <p className="text-[1.0625rem] leading-[1.7] text-navy">
          <strong>Você participa automaticamente.</strong> Não é preciso se inscrever. Cada viagem
          válida que você registrar no app Shift durante o Walk/Ride Day vale uma participação no
          sorteio. Não é necessária nenhuma compra, pagamento ou ação de inscrição de qualquer tipo.
          {ref && (
            <>
              {' '}Você também pode receber participações extras convidando amigos para o Shift entre{' '}
              {ref} e {v.dayLabel}. Veja a Seção 4.
            </>
          )}
        </p>
      </div>

      <hr className="my-10 border-navy/10" />
      <Toc title="Conteúdo" items={TOC} />
      <hr className="my-10 border-navy/10" />

      <div className="space-y-10">
        <Section id="promotion" title="1. Nome da promoção e patrocinador">
          <Ul>
            <li><strong>Promoção:</strong> Sorteio de cartões-presente do {name}</li>
            <li><strong>Patrocinador:</strong> Green Streets Initiative, Inc., organização sem fins lucrativos 501(c)(3), Somerville, MA (&ldquo;GSI&rdquo;)</li>
            <li>
              Administrado pelo app de celular Shift, disponível na{' '}
              <a href="https://apps.apple.com/us/app/shift-by-gsi/id6761119037" className={A}>App Store</a>{' '}e no{' '}
              <a href="https://play.google.com/store/apps/details?id=org.greenstreets.shift" className={A}>Google Play</a>
            </li>
            <li>
              Este sorteio é separado e independente do sorteio Shift Your Summer 2026. Participações
              em um não afetam o outro.
            </li>
          </Ul>
        </Section>

        <Section id="eligibility" title="2. Quem pode participar">
          <Ul>
            <li>
              Aberto a residentes dos Estados Unidos com pelo menos 18 anos de idade que morem no
              Commonwealth (estado) de Massachusetts.
            </li>
            <li>
              Funcionários e diretores da GSI, e os familiares imediatos de todas essas pessoas, não
              podem ganhar.
            </li>
            <li>
              <strong>A elegibilidade é confirmada quando o prêmio é resgatado, e não no momento da
              participação.</strong> As participações são contadas automaticamente a partir das viagens
              válidas{ref ? ' e dos convites' : ''}, então uma pessoa que não cumpre os requisitos de
              elegibilidade pode, mesmo assim, ser sorteada. Qualquer pessoa sorteada que não confirmar
              que tem 18 anos ou mais e mora em Massachusetts perde o prêmio, e o prêmio vai para outra
              pessoa sorteada pelo mesmo método. Veja a Seção 7.
            </li>
            <li>
              A GSI não exige que os participantes tenham data de nascimento ou estado de residência
              cadastrados para receber participações. Quem não tiver dados que comprovem a
              elegibilidade continua no sorteio e, se for sorteado, deverá confirmar a elegibilidade.
            </li>
            <li>
              Não é necessário comprar nada para participar ou ganhar. Esta promoção está sujeita a
              todas as leis e regulamentos federais, estaduais e locais, e é nula onde for proibida.
            </li>
          </Ul>
        </Section>

        <Section id="promotion-period" title="3. Período da promoção">
          <Ul>
            {v.dayLabel ? (
              <li>O Período da promoção é {v.dayLabel}, das 0h00 às 23h59, horário do Leste dos EUA.</li>
            ) : (
              <li>
                O Período da promoção é um único Walk/Ride Day, das 0h00 às 23h59, horário do Leste dos
                EUA. O Walk/Ride Day cai na última sexta-feira da maioria dos meses.
              </li>
            )}
            <li>
              Só contam como participações por viagem as viagens registradas dentro do Período da
              promoção. Viagens registradas antes ou depois não contam, não importa quando forem
              confirmadas no app.
            </li>
            {ref && (
              <li>
                O Período de convites vai das 0h00, horário do Leste dos EUA, de {ref} até as 23h59,
                horário do Leste dos EUA, de {v.dayLabel}. Uma participação por convite (Seção 4) só é
                recebida quando o amigo digita o código e também registra a primeira viagem dentro do
                Período de convites.
              </li>
            )}
          </Ul>
        </Section>

        <Section id="how-to-enter" title="4. Como participar">
          <P>
            A participação é automática. Registre uma viagem válida no app Shift durante o Período da
            promoção e você já está participando. Não é preciso aceitar nada, preencher formulário nem
            fazer cadastro separado.
            {ref && (
              <>
                {' '}Você também pode receber participações extras convidando amigos, como explicado
                abaixo. Convidar amigos é opcional e nunca é exigido para participar ou ganhar.
              </>
            )}
          </P>

          <SubSection title="O que conta como viagem válida">
            <Ul>
              <li>
                Uma viagem a pé, de bicicleta, de patinete elétrico, de ônibus, de metrô ou VLT, de trem
                suburbano, de barca ou de carona (duas ou mais pessoas no carro).
              </li>
              <li>
                A viagem precisa ser registrada pelo app Shift, com a localização verificada. Viagens
                digitadas à mão, ou que o app não consegue verificar, não contam como participações.
              </li>
              <li>Uma viagem de carro só com o motorista a bordo não conta como participação.</li>
            </Ul>
          </SubSection>

          <SubSection title="Quantas participações">
            <Ul>
              <li>Cada viagem válida conta como uma (1) participação.</li>
              <li>
                Cada pessoa pode receber no máximo {entries(v.maxEntries)} por viagens durante o Período
                da promoção. Mais viagens válidas são bem-vindas, mas não aumentam o número de
                participações.
                {ref && ' As participações por convites são contadas à parte, como explicado abaixo.'}
              </li>
              <li>
                As participações são por pessoa, e não por aparelho ou por conta. Tentar conseguir
                participações extras com várias contas é motivo de desclassificação.
              </li>
            </Ul>
          </SubSection>

          {ref && (
            <SubSection title="Participações por convites">
              <Ul>
                <li>
                  Cada membro do Shift tem um código de convite pessoal no app Shift. Você recebe{' '}
                  {entries(v.referralPerFriend)} neste sorteio para cada amigo que digitar o seu código
                  no app Shift e depois registrar a primeira viagem verificada pelo app Shift. As duas
                  coisas precisam acontecer durante o Período de convites ({ref} até {v.dayLabel}).
                </li>
                <li>
                  Cada pessoa pode receber no máximo {v.referralMax === 1 ? 'uma (1) participação' : `${v.referralMax} participações`}{' '}
                  por convites. As participações por convites se somam ao máximo por viagens indicado
                  acima.
                </li>
                <li>
                  As participações por convites valem só neste sorteio do Walk/Ride Day e não passam para
                  nenhum outro sorteio. A primeira viagem de um amigo registrada depois das 23h59,
                  horário do Leste dos EUA, de {v.dayLabel} não acrescenta participação.
                </li>
                <li>
                  O código de convite precisa ser digitado em até 30 dias depois que o amigo criar a
                  conta no Shift. Cada pessoa pode usar um único código de convite, e ninguém pode usar
                  o próprio código. O amigo recebe participações pelas próprias viagens válidas,
                  normalmente.
                </li>
                <li>Convidar amigos é grátis e opcional, e nunca é exigido para participar ou ganhar.</li>
                <li>
                  Cada convite precisa ser de uma pessoa diferente e real. A GSI pode revisar e anular
                  participações por convites que envolvam um aparelho compartilhado, mais de uma conta
                  da mesma pessoa ou qualquer outro uso indevido. As participações por convites não
                  mudam quem pode ganhar (Seção 2).
                </li>
              </Ul>
            </SubSection>
          )}

          <SubSection title="Não é exigida outra forma de participação">
            <P>
              Como a participação não exige compra, pagamento, assinatura ou ação de inscrição de
              qualquer tipo (as participações vêm do uso normal de um app gratuito), este sorteio não
              oferece outra forma de participação. Baixar e usar o app Shift é grátis.
              {ref && ' Convidar um amigo é grátis e opcional, e nunca é exigido para participar ou ganhar.'}
            </P>
          </SubSection>
        </Section>

        <Section id="prizes" title="5. Prêmios">
          {v.prizes.length === 0 ? (
            <P><em>Os prêmios deste Walk/Ride Day serão listados aqui quando estiverem definidos.</em></P>
          ) : (
            <>
              <Ul>
                {v.prizes.map(p => (
                  <li key={p.id}>
                    <strong>{p.quantity} &times;</strong> {p.text}
                    {p.value && <> &mdash; valor de varejo aproximado de {p.value}{p.quantity > 1 ? ' cada' : ''}</>}
                  </li>
                ))}
              </Ul>
              {v.totalArv && (
                <P><strong>Valor de varejo aproximado total de todos os prêmios: {v.totalArv}.</strong></P>
              )}
            </>
          )}
          <Ul>
            <li>
              Os prêmios são cartões-presente digitais, entregues por meio eletrônico. Quem ganhar
              escolhe a loja entre as opções que a GSI oferecer no momento do resgate.
            </li>
            <li>
              Os prêmios não podem ser transferidos nem trocados, exceto que a GSI pode substituir um
              prêmio por outro de valor igual ou maior se um prêmio deixar de estar disponível.
            </li>
            <li>Os prêmios não têm valor em dinheiro e não podem ser trocados por dinheiro.</li>
            <li>Limite de um prêmio por pessoa.</li>
            {v.prizes.length > 1 && (
              <li>
                Cada participação conta para todos os níveis de prêmio listados acima. Os participantes
                não escolhem um nível de prêmio.
              </li>
            )}
          </Ul>
        </Section>

        <Section id="winner-selection" title="6. Escolha e aviso dos ganhadores">
          <Ul>
            <li>
              Os ganhadores são sorteados entre todas as participações recebidas durante o Período da
              promoção. A chance de cada pessoa ganhar é proporcional ao número de participações que
              recebeu, até {ref ? 'os limites' : 'o limite'} da Seção 4.
            </li>
            {v.prizes.length > 1 && (
              <li>
                Os prêmios são sorteados na ordem da Seção 5, começando pelo prêmio de maior valor.
                Uma pessoa sorteada para um prêmio não pode ser sorteada para outro prêmio no mesmo
                sorteio.
              </li>
            )}
            <li>
              {v.drawLabel
                ? <>O sorteio será realizado em {v.drawLabel}, ou por volta dessa data.</>
                : <>O sorteio será realizado no dia seguinte ao fim do Período da promoção, ou por volta dessa data.</>}
            </li>
            <li>
              A GSI realiza o sorteio com um processo automático de escolha aleatória, e cada sorteio
              fica gravado num registro de auditoria guardado pela GSI. Todas as decisões da GSI sobre
              a escolha dos ganhadores são definitivas.
            </li>
            <li>
              Os ganhadores são avisados no app Shift, e por notificação push e email quando a pessoa
              ativou esses avisos. A GSI não é responsável se um aviso não chegar a quem ganhou por
              causa de um email incorreto, uma caixa de entrada cheia, um filtro de spam ou notificações
              desativadas.
            </li>
            <li>
              Depois do sorteio, a GSI publica os resultados, com a lista de ganhadores, em{' '}
              <ResultsLink href={v.resultsHref} /> (em inglês), e avisa a todos os participantes que
              os resultados saíram. Os ganhadores aparecem pelo primeiro nome, a inicial do sobrenome
              e a cidade, ou só pela cidade quando o perfil no Shift é privado ou quando pedem.
            </li>
            <li>
              Os ganhadores podem ser convidados a participar de ações promocionais (post em rede
              social, foto, depoimento). Aceitar um prêmio pode significar autorização para usar o nome
              e a imagem de quem ganhou para fins promocionais (exceto onde a lei proibir).
            </li>
          </Ul>
        </Section>

        <Section id="prize-conditions" title="7. Condições dos prêmios">
          <Ul>
            <li>
              Para resgatar um prêmio, a pessoa sorteada precisa confirmar no app Shift que tem 18 anos
              ou mais e mora em Massachusetts, declarar ciência deste Regulamento oficial e informar um
              email válido para a entrega.
            </li>
            <li>
              <strong>O prêmio precisa ser resgatado em até sete (7) dias depois do aviso.</strong>{' '}
              Um prêmio não resgatado é perdido e vai para outra pessoa sorteada pelo mesmo método.
            </li>
            <li>
              Uma pessoa sorteada que confirmar ter menos de 18 anos, ou morar fora de Massachusetts,
              perde o prêmio. O prêmio vai então para outra pessoa. Perder o prêmio por esse motivo não
              traz nenhuma outra consequência e não afeta nenhuma outra parte da conta no Shift.
            </li>
            <li>Uma pessoa sorteada pode recusar um prêmio. Um prêmio recusado vai para outra pessoa.</li>
          </Ul>
        </Section>

        <Section id="tax-obligations" title="8. Impostos">
          <Ul>
            <li>Os ganhadores são responsáveis por quaisquer impostos federais, estaduais e locais decorrentes de um prêmio.</li>
            <li>
              A GSI declara a renda de prêmios quando a lei exige. Se houver obrigação de declaração,
              a pessoa que ganhou pode precisar informar um Número de Identificação de Contribuinte
              (TIN) antes de receber o prêmio.
            </li>
          </Ul>
        </Section>

        <Section id="general-conditions" title="9. Condições gerais">
          <Ul>
            <li>Ao participar, os participantes concordam em seguir este Regulamento oficial.</li>
            <li>
              A GSI se reserva o direito de desclassificar qualquer participante que interfira no
              processo de participação, registre viagens de forma fraudulenta, use várias contas ou aja
              de qualquer outra forma que a GSI, com critério razoável, considere contrária a este
              Regulamento ou de má-fé.
            </li>
            <li>
              A GSI se reserva o direito de alterar, suspender ou cancelar este sorteio se ele não puder
              ser realizado como planejado, inclusive por falha técnica. Se o sorteio for cancelado, a
              GSI pode entregar os prêmios entre as participações válidas recebidas até o momento do
              cancelamento.
            </li>
            <li>
              Nada neste Regulamento obriga alguém a fazer uma viagem que não faria de outra forma, ou
              a se deslocar de um jeito que considere inseguro. Cada participante é responsável pela
              própria segurança e por cumprir todas as leis de trânsito.
            </li>
          </Ul>
        </Section>

        <Section id="privacy" title="10. Privacidade">
          <Ul>
            <li>
              As informações coletadas em relação a este sorteio são usadas para administrar o sorteio
              e entregar os prêmios. Elas são tratadas de acordo com a{' '}
              <Link href={translatedPath('pt-BR', 'privacy')} className={A}>Política de Privacidade da GSI</Link>.
            </li>
            <li>
              A data de nascimento e o estado de residência informados no resgate de um prêmio são
              usados para confirmar a elegibilidade e guardados como registro dessa confirmação.
            </li>
            <li>
              A GSI não vende informações pessoais, e não compartilha informações dos participantes com
              as lojas dos prêmios além do necessário para entregar um cartão-presente.
            </li>
          </Ul>
        </Section>

        <Section id="limitation-of-liability" title="11. Limitação de responsabilidade">
          <Ul>
            <li>
              Ao participar, os participantes isentam a GSI, e seus diretores, dirigentes,
              funcionários e voluntários, de qualquer responsabilidade por perdas, prejuízos ou danos
              decorrentes da participação neste sorteio ou da aceitação ou uso de um prêmio.
            </li>
            <li>
              A GSI não é responsável por participações que não forem registradas por causa de falha
              no aparelho, falha nos serviços de localização, queda da rede ou qualquer outro problema
              técnico fora do seu controle razoável.
            </li>
          </Ul>
        </Section>

        <Section id="disputes" title="12. Disputas">
          <Ul>
            <li>
              Este Regulamento oficial é regido pelas leis do Commonwealth (estado) de Massachusetts,
              sem levar em conta suas regras sobre conflito de leis.
            </li>
            <li>
              Qualquer disputa decorrente deste sorteio será resolvida nos tribunais estaduais ou
              federais localizados em Massachusetts.
            </li>
          </Ul>
        </Section>

        <Section id="contact" title="13. Contato">
          <P>
            Dúvidas sobre este sorteio, ou sobre um prêmio, podem ser enviadas para{' '}
            <a href="mailto:info@gogreenstreets.org" className={A}>info@gogreenstreets.org</a>.
          </P>
          <P>Green Streets Initiative, Inc. &middot; Somerville, Massachusetts</P>
        </Section>
      </div>
    </>
  )
}
