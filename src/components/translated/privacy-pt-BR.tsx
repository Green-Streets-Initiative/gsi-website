import { H3, Mail, P, Section, Ul, A } from './legal'

/*
 * Privacy policy, Brazilian Portuguese (November 2026 text). AI translation
 * pending a native speaker's review. Section for section with
 * src/app/privacy/page.tsx. Product and company names stay in English
 * (Shift, Apple Health, Health Connect, Supabase, What Moves Us); feature
 * names the app shows in Portuguese are given in Portuguese.
 */

export default function PrivacyPtBR() {
  return (
    <>
      <Section title="Quem somos">
        <P>
          O Shift é um aplicativo de celular operado pela Green Streets Initiative (&ldquo;GSI&rdquo;,
          &ldquo;nós&rdquo; ou &ldquo;nosso&rdquo;), uma organização sem fins lucrativos dedicada a
          ajudar as pessoas a trocar suas viagens por opções mais saudáveis, mais baratas e mais
          limpas, e a medir o impacto, viagem por viagem, comunidade por comunidade.
        </P>
        <P>
          Esta Política de Privacidade explica como coletamos, usamos, divulgamos, armazenamos,
          guardamos e protegemos informações pessoais quando você usa o app Shift, o site da Green
          Streets Initiative e os serviços, recursos, programas, desafios, rankings, recompensas,
          comunicações e campanhas comunitárias relacionados.
        </P>
        <P>
          Ao usar o Shift, o site ou qualquer serviço relacionado, você aceita as práticas descritas
          nesta Política de Privacidade.
        </P>
        <P>
          Se você não concorda com esta Política de Privacidade, por favor não use o Shift, o site nem
          nossos serviços relacionados.
        </P>
      </Section>

      <Section title="Quais informações coletamos">
        <P>
          Coletamos informações que você nos dá diretamente, informações obtidas automaticamente do seu
          aparelho quando você usa o Shift ou nosso site, informações da sua participação em programas,
          campanhas, competições, recompensas e desafios, e informações de prestadores de serviços ou
          parceiros de programas que nos ajudam a operar o Shift.
        </P>
        <P>
          Algumas informações que o Shift usa podem ser sensíveis pelo que podem revelar sobre você,
          como dados de localização precisa, locais salvos, dados inferidos do perfil de trajetos e,
          quando for o caso, informações sobre menores de idade ou estudantes.
        </P>
        <P>
          Usamos essas informações só para oferecer e proteger o Shift, operar os recursos descritos
          nesta Política de Privacidade, cumprir a lei ou para outra finalidade que informarmos a você.
        </P>
      </Section>

      <Section title="Dados de localização">
        <P>
          Com a permissão do seu aparelho, o Shift pode acessar a localização GPS precisa em segundo
          plano, inclusive quando o app não está aberto ou em uso, porque a detecção automática de
          viagens depende do acesso à localização.
        </P>
        <P>
          Usamos os dados de localização para detectar quando você completa uma viagem a pé, de
          bicicleta, de transporte público ou de veículo, para que as viagens sejam registradas
          automaticamente, sem você precisar anotar.
        </P>
        <P>Coletamos:</P>
        <Ul>
          <li>Coordenadas GPS durante as viagens detectadas</li>
          <li>Pontos de início e fim da viagem durante a detecção e o processamento da viagem</li>
          <li>Distância e duração de cada viagem</li>
          <li>Meio de transporte detectado (a pé, de bicicleta, de transporte público ou de veículo)</li>
        </Ul>
        <P>Também podemos coletar ou obter:</P>
        <Ul>
          <li>O status da permissão dos serviços de localização no aparelho</li>
          <li>Informações gerais sobre o bairro, o trajeto ou a região, usadas para classificar as viagens e calcular o impacto</li>
          <li>Metadados técnicos necessários para processar uma viagem, como data e hora, sistema operacional do aparelho e versão do app</li>
        </Ul>
        <P>
          Os dados de localização são usados para identificar as viagens completadas. De cada viagem,
          guardamos onde ela começou e terminou e o caminho que fez, junto com o meio de transporte, a
          distância, a duração, a data e hora e as métricas de impacto relacionadas, como descrito em
          Registros de viagens. Leituras de localização feitas fora de uma viagem não são guardadas como
          um histórico contínuo de localização.
        </P>
        <P>
          As leituras de GPS brutas também podem ser processadas no aparelho, durante a transmissão ou
          temporariamente nos nossos sistemas, conforme necessário para a detecção de viagens, a
          correção de erros, a segurança, a prevenção de fraudes ou o funcionamento do serviço.
        </P>
      </Section>

      <Section title="Dados de movimento e atividade">
        <P>
          Usamos o acelerômetro e os sensores de movimento do seu aparelho, junto com o recurso de
          reconhecimento de atividade do aparelho, para classificar o seu meio de transporte. Esses
          dados são usados só para detectar viagens e não são guardados separadamente dos registros de
          viagens.
        </P>
      </Section>

      <Section title="Dados de apps de saúde (Apple Health e Health Connect)">
        <P>
          Se você ativar a importação de exercícios nas configurações do Shift, o Shift lê os exercícios
          que você registrou no Apple Health (iOS) ou no Health Connect (Android): o tipo de exercício
          (caminhada, corrida, trilha ou ciclismo), a hora de início e de fim, a distância, e o primeiro
          e o último ponto do percurso. Não lemos frequência cardíaca, passos, sono nem nenhum outro dado
          de saúde, e nunca gravamos nada no Apple Health ou no Health Connect.
        </P>
        <P>
          Usamos esses dados com uma única finalidade: encontrar caminhadas, corridas e pedaladas que a
          detecção automática de viagens do Shift não pegou e oferecê-las a você como viagens. Um
          exercício que nenhuma viagem do Shift já cobre é adicionado à sua lista de viagens como viagem
          não confirmada, para você confirmar ou remover; um exercício confirmado vira um registro de
          viagem comum, tratado como descrito em Registros de viagens. Quando você remove um, a viagem é
          apagada; guardamos uma nota curta de que não era uma viagem, com os pontos de início e fim,
          para que a detecção de viagens aprenda com isso. Os dados de apps de saúde nunca são vendidos,
          compartilhados com anunciantes ou usados para publicidade.
        </P>
        <P>
          Você pode desativar a importação de exercícios a qualquer momento nas configurações do Shift,
          ou retirar o acesso do Shift no app Apple Health ou Health Connect. As viagens que você já
          confirmou continuam no seu histórico até você apagá-las ou apagar sua conta.
        </P>
      </Section>

      <Section title="Informações da conta">
        <P>Quando você cria uma conta, coletamos:</P>
        <Ul>
          <li>Seu nome e seu endereço de email</li>
          <li>Credenciais de acesso (guardadas com segurança; as senhas nunca são guardadas em texto legível)</li>
          <li>Informações opcionais de perfil, como seu bairro ou seu vínculo com uma escola ou empresa</li>
        </Ul>
        <P>
          Também podemos coletar as comunicações que você nos envia, pedidos de suporte, perguntas ou
          pedidos sobre privacidade, comentários e informações parecidas quando você entra em contato
          conosco por qualquer motivo.
        </P>
        <P>
          Você é responsável por manter as credenciais da sua conta em segurança e por nos avisar logo
          se achar que alguém entrou na sua conta sem permissão.
        </P>
      </Section>

      <Section title="Registros de viagens">
        <P>De cada viagem detectada ou registrada manualmente, guardamos:</P>
        <Ul>
          <li>Data e hora</li>
          <li>Meio de transporte da viagem (a pé, de bicicleta, de transporte público, de carro)</li>
          <li>Distância</li>
          <li>Onde a viagem começou e terminou, e o caminho que fez</li>
          <li>O bairro e a cidade onde ela começou e terminou</li>
          <li>Métricas de impacto calculadas (CO&#8322; evitado, economia estimada, calorias queimadas)</li>
        </Ul>
        <P>
          Os pontos de início e fim e os caminhos são usados para mostrar suas viagens num mapa,
          reconhecer viagens entre os seus locais salvos, classificar viagens de transporte público e
          contar as viagens por bairro e por cidade. Eles são guardados enquanto sua conta estiver ativa
          e são apagados quando você apaga a viagem ou a sua conta, como descrito em Guarda de dados.
        </P>
      </Section>

      <Section title="Dados de competições e da comunidade">
        <P>
          Se você entrar num desafio ou ranking, guardamos sua participação, suas pontuações e suas
          posições nessa competição. Seu nome de exibição e suas estatísticas gerais podem ficar
          visíveis para outros participantes, conforme as configurações de visibilidade da competição.
        </P>
      </Section>

      <Section title="Dados de uso">
        <P>
          Coletamos dados de uso comuns do app e do site, como relatórios de falhas, interações com os
          recursos, diagnósticos de desempenho, informações do aparelho e do navegador, endereço IP,
          horários de acesso, páginas ou telas vistas e informações técnicas parecidas.
        </P>
        <P>
          Usamos essas informações para operar, proteger, resolver problemas, analisar e melhorar o
          Shift e o site.
        </P>
        <P>
          Quando é viável, os dados de diagnóstico e de uso ficam separados da localização precisa e do
          histórico de viagens, mas alguns dados técnicos podem ser associados à sua conta quando for
          necessário para dar suporte, manter a segurança, investigar erros ou cumprir a lei.
        </P>
      </Section>

      <Section title="Perfil de trajetos (inferido, não declarado)">
        <P>
          Para classificar as viagens de transporte público e proteger suas sequências, o Shift monta
          um perfil de trajetos inferido a partir do seu histórico de viagens, depois que você completa
          pelo menos 10 viagens. Esse perfil guarda:
        </P>
        <Ul>
          <li>A região aproximada da sua casa (o ponto central dos inícios das suas viagens da manhã; não é um endereço exato)</li>
          <li>A região aproximada do seu trabalho (o ponto central dos fins das suas viagens da manhã; não é um endereço exato)</li>
          <li>Paradas da MBTA próximas e trajetos habituais inferidos dos seus padrões de viagem</li>
        </Ul>
        <P>
          Esse perfil <strong>nunca se baseia em informações que você digita</strong>: ele vem
          inteiramente do seu histórico de viagens. Ele é apagado quando você apaga a sua conta, e você
          pode vê-lo e apagá-lo a qualquer momento nas configurações do app.
        </P>
      </Section>

      <Section title="Assistente do Shift">
        <P>
          O app Shift inclui um assistente opcional que responde perguntas sobre como se locomover e
          sobre a sua própria atividade no Shift.
        </P>
        <P>
          Para responder, ele lê a sua pergunta, os seus locais salvos, as suas viagens recentes
          (horários, distância e como você viajou, e &ldquo;Casa&rdquo; ou &ldquo;Trabalho&rdquo;, não
          pontos no mapa), seus pontos, insígnias e recompensas, seus desafios e grupos (a sua própria
          contagem e posição, nunca o nome de outras pessoas), os benefícios de transporte que a sua
          empresa configurou no Shift, se ela oferece o programa de deslocamento do Shift, os planos que
          o Shift fez para fechamentos da MBTA nas suas viagens, os trajetos de carro que o Shift viu que
          você faz com frequência e as alternativas que encontrou para comparar, as respostas que você
          deu no app sobre os custos do seu carro, seu plano de mudança, suas sequências, seus recordes
          pessoais e seu nível no Shift, e a localização do seu celular quando você permite,
          arredondada para cerca de 100 metros. Ele só salva um local, muda uma configuração ou inscreve
          você num passeio depois que você toca no botão do cartão dele.
        </P>
        <P>
          Se você pedir para ele inscrever você num passeio ou caminhada em grupo do Shift e tocar no
          botão, ele coloca você nesse passeio e marca a sua resposta para aquela data, como quando você
          toca em Vou no app. Quem organiza o passeio vê o seu nome e a sua resposta.
        </P>
        <P>
          Se você tocar em Avise-me para uma viagem, guardamos o ponto de partida, o destino e o horário
          junto com essa conversa. Mandamos o lembrete e depois olhamos as suas viagens perto desse
          horário para achar uma que comece ou termine perto desses lugares, para avisar que ela contou.
          Apagar a conversa apaga o lembrete.
        </P>
        <P>
          Se você tocar em Lembrar numa nota que o assistente oferece, como &ldquo;Tenho uma bicicleta
          elétrica&rdquo;, ele guarda essa nota para as suas próximas conversas. Você pode ver e apagar
          suas notas na tela O que eu lembro do assistente (na versão mais recente do app). Uma nota é
          apagada quando você a apaga ali ou pede para o assistente esquecer, quando você apaga a sua
          conta, ou 12 meses depois da última vez que você usou o assistente.
        </P>
        <P>
          Se você anexar uma imagem, como uma captura de tela, o assistente olha a imagem para
          responder. Ela fica guardada de forma privada com essa conversa e é apagada junto com ela. Se
          você relatar um problema, a equipe da Green Streets vê a imagem com o seu relato. Se você
          compartilhar um link de rota do Ride with GPS, lemos essa rota pública no Ride with GPS para
          responder.
        </P>
        <P>
          Suas perguntas, e o que o assistente busca para respondê-las, são processadas pela Anthropic,
          que fornece o modelo de inteligência artificial; lugares e rotas de transporte público são
          buscados com o Google Maps Platform, como descrito em Com prestadores de serviços.
        </P>
        <P>
          A equipe da GSI pode ler as conversas para resolver problemas e melhorar o assistente. As
          conversas são apagadas 12 meses depois da sua última mensagem, e quando você apaga a sua
          conta. Você pode apagar uma conversa, ou todas, no assistente do app, ou escrevendo para{' '}
          <Mail />.
        </P>
        <P>
          Mais detalhes em{' '}
          <a href="/shift/assistant-data" className={A}>The Shift assistant and your data</a> (em inglês).
        </P>
      </Section>

      <Section title="Locais salvos">
        <P>Só você pode ver os seus locais salvos dentro da sua conta.</P>
        <P>
          Não divulgamos os seus locais salvos para outros usuários do Shift, empresas, escolas,
          patrocinadores ou parceiros de recompensas sem o seu consentimento explícito.
        </P>
        <P>
          Os locais salvos podem ser processados pelos nossos prestadores de serviços conforme
          necessário para oferecer, hospedar, proteger e dar suporte ao Shift, e podem ser divulgados se
          a lei ou um processo legal válido exigir.
        </P>
        <P>Você pode ver, editar ou apagar os seus locais salvos a qualquer momento nas configurações do app.</P>
        <P>
          Os locais salvos são apagados quando você apaga a sua conta, sujeito aos ciclos normais de
          backup, às obrigações legais, às necessidades de segurança ou a outra guarda limitada
          permitida pela lei aplicável.
        </P>
      </Section>

      <Section title="Encontrar alguém para ir junto">
        <P>
          Se você se inscrever para ir com alguém que conhece o caminho, para mostrar o caminho a
          alguém, para encontrar alguém para caminhar junto ou para encontrar uma carona, usamos a sua
          Casa e o seu Trabalho salvos (ou a viagem que você nos contar), os horários que você der e as
          suas viagens recentes entre esses lugares para sugerir pessoas que fazem uma viagem parecida.
          Usamos a sua Casa só para encontrar pessoas perto de você: nunca mostramos o seu endereço para
          ninguém. Só fazemos isso depois que você se inscreve, e você pode parar a qualquer momento.
        </P>
        <P>
          Antes de vocês dois dizerem sim, a outra pessoa vê o seu primeiro nome, a que distância uma da
          outra as viagens de vocês começam e terminam, os meios de transporte que você usa e o que você
          mais usa, seus dias e horários de costume, os idiomas que você disse que fala, quando você
          entrou no Shift, seu status no Shift e qualquer grupo de trabalho, escola ou bairro de que os
          dois façam parte. Se o seu perfil for público, ela também vê a sua foto de perfil. Se você se
          ofereceu para mostrar o caminho, ela vê quantas viagens você fez por esse caminho
          recentemente. Para uma carona, ela vê se você dirigiria ou iria de passageiro, a que horas você
          chega ao trabalho e quantos minutos a mais buscar e deixar a outra pessoa somariam ao trajeto.
          Ela nunca vê o seu endereço. Só se os dois disserem sim é que cada um vê o email do outro e,
          se você fizer parte de um local de trabalho no Shift, o nome dele.
        </P>
        <P>
          Quando você planeja uma primeira viagem com alguém que vai mostrar o caminho, o Shift sugere
          lugares públicos para se encontrarem e para terminar, como a estação do T mais próxima, para que
          nenhum dos dois precise compartilhar o endereço de casa ou do trabalho.
        </P>
        <P>
          Para ajudar as pessoas a se encontrarem, o Shift pode avisar alguém próximo que faz uma viagem
          parecida quantas pessoas perto dela pediram para alguém mostrar o caminho, ou se ofereceram
          para mostrar. Essa mensagem é só um número: nunca inclui o seu nome, a sua foto ou onde você
          mora.
        </P>
        <P>
          Seus comentários depois de uma viagem e qualquer problema que você relatar vão só para a
          equipe da Green Streets. As empresas nunca veem quem se inscreveu nem quem foi combinado com
          quem.
        </P>
      </Section>

      <Section title="Dados da campanha What Moves Us">
        <P>
          Se você decidir participar de uma campanha comunitária de histórias What Moves Us, coletamos
          estes dados adicionais:
        </P>
        <Ul>
          <li>Gravações curtas de vídeo ou áudio das suas respostas às perguntas da campanha</li>
          <li>A sua confirmação do consentimento e a data em que foi dada</li>
          <li>A quais perguntas da campanha você respondeu e se pulou alguma</li>
        </Ul>
        <P>
          <strong>Como esses dados são usados:</strong> suas gravações podem ser compartilhadas
          publicamente numa página da Green Streets Initiative e podem ser entregues à organização que
          encomendou a campanha, como uma prefeitura, uma agência de planejamento de transporte ou uma
          organização de planejamento parecida, como descrito nos termos de consentimento próprios da
          campanha, mostrados a você antes de gravar qualquer coisa.
        </P>
        <P>
          Como as gravações de vídeo ou áudio podem incluir a sua imagem, a sua voz, o que você diz ou
          outras características que identificam você, as gravações podem permitir a sua identificação
          mesmo quando os relatórios relacionados usam temas agrupados ou anônimos.
        </P>
        <P>
          Os termos específicos de cada campanha sobre compartilhamento, publicação e exclusão serão
          mostrados a você antes de enviar qualquer gravação.
        </P>
        <P>
          <strong>Guarda:</strong> as gravações da campanha são guardadas enquanto durar o projeto para
          o qual foram coletadas, normalmente de 12 a 24 meses, a menos que os termos de consentimento da
          campanha indiquem um período mais curto ou mais longo, ou que a lei exija. Você pode retirar o
          seu consentimento e pedir que as suas gravações sejam apagadas a qualquer momento nas
          configurações do app ou escrevendo para <Mail />, ressalvados os materiais legais, de arquivo,
          operacionais ou já publicados que não possam ser retirados de forma razoável.
        </P>
        <P>
          <strong>O que nunca é compartilhado:</strong> seus dados individuais de viagens, sua Taxa Shift
          ou seu histórico de localização nunca entram nos materiais do What Moves Us. Os dados de
          participação na campanha ficam totalmente separados dos seus registros de viagens e de
          competições.
        </P>
      </Section>

      <Section title="Como usamos os seus dados">
        <P>
          Usamos as suas informações principalmente para operar, oferecer, manter, proteger,
          personalizar, analisar e melhorar o Shift, o site e os serviços relacionados, e para cumprir as
          finalidades para as quais você nos deu as informações.
        </P>
        <Ul>
          <li><strong>Detecção e registro de viagens:</strong> os dados de localização e de movimento são usados para detectar quando você completa uma viagem e classificar o meio de transporte.</li>
          <li><strong>Cálculo do impacto:</strong> os registros de viagens são usados para calcular as suas métricas pessoais de impacto ambiental e financeiro.</li>
          <li><strong>Recursos da comunidade:</strong> dados de viagens agrupados são usados nos rankings de bairros, nos desafios de escolas e empresas e nos painéis de impacto da comunidade.</li>
          <li><strong>Notificações:</strong> usamos os seus padrões de viagem para enviar lembretes relevantes, avisos de conquistas, notificações de sequências e resumos semanais.</li>
          <li><strong>Melhorias do app:</strong> os dados de uso e de diagnóstico são usados para corrigir erros, melhorar a precisão e criar novos recursos.</li>
          <li><strong>Classificação de viagens de transporte público:</strong> nas viagens em que o seu movimento corresponde à velocidade de um veículo, comparamos o seu trajeto com os dados de posição em tempo real dos veículos da MBTA para classificar automaticamente a viagem como ônibus, metrô ou trem suburbano.</li>
          <li><strong>Proteção de sequências:</strong> se houver uma interrupção importante no serviço da MBTA no seu trajeto habitual de transporte público, podemos usar o seu perfil de trajetos inferido para proteger automaticamente a sua sequência ativa.</li>
          <li><strong>Administração de contas:</strong> usamos as informações da conta para criar e administrar contas, verificar a identidade dos usuários, dar suporte, responder pedidos e manter a segurança das contas.</li>
          <li><strong>Prevenção de fraudes e integridade:</strong> usamos as informações para detectar viagens falsas ou inventadas, manipulação de rankings, uso indevido de XP, níveis, recompensas, ofertas e códigos de desconto, acesso não autorizado a contas e outras possíveis fraudes, atividades ilegais ou violações dos nossos termos.</li>
          <li><strong>Cumprimento da lei:</strong> podemos usar as informações para cumprir leis, regulamentos, ordens judiciais, intimações, processos legais, obrigações fiscais ou pedidos de autoridades aplicáveis.</li>
          <li><strong>Prestadores de serviços:</strong> podemos usar e divulgar informações para prestadores de serviços que nos ajudam a hospedar, operar, proteger, analisar, manter e melhorar o Shift e os serviços relacionados.</li>
          <li><strong>Relatórios com dados agrupados e anônimos:</strong> podemos tornar as informações anônimas ou agrupá-las para que não identifiquem mais você, e podemos usar e divulgar essas informações anônimas ou agrupadas em relatórios, pesquisas, medição do impacto na comunidade, relatórios para parceiros, relatórios de subsídios, planejamento e outras finalidades legais.</li>
          <li><strong>Administração de programas:</strong> podemos usar as informações para administrar desafios, competições, recompensas, o acesso a ofertas de parceiros ou seu uso, programas de escolas e empresas, campanhas What Moves Us e os termos dos programas relacionados.</li>
        </Ul>
        <P>
          Não vendemos as suas informações pessoais, não usamos as suas informações pessoais para
          publicidade direcionada e não usamos as suas informações pessoais para publicidade de
          terceiros.
        </P>
        <P>
          Não compartilhamos registros individuais de viagens, histórico de localização precisa, locais
          salvos ou dados do perfil de trajetos inferido com empresas, escolas, patrocinadores, parceiros
          de recompensas ou outros terceiros sem o seu consentimento explícito, exceto como descrito
          nesta Política de Privacidade ou quando a lei exigir. Não compartilhamos a sua Taxa Shift
          pessoal com escolas, patrocinadores ou parceiros de recompensas sem o seu consentimento
          explícito. Se você entrar no grupo da sua empresa, a empresa vê as informações descritas em
          &ldquo;Com empresas&rdquo;, abaixo, incluindo a sua Taxa Shift.
        </P>
        <P>
          Se mudarmos de forma importante como coletamos, usamos, compartilhamos ou guardamos
          informações pessoais, vamos atualizar esta Política de Privacidade e avisar você quando for o
          caso.
        </P>
      </Section>

      <Section title="Como compartilhamos as suas informações">
        <P>
          Compartilhamos informações pessoais como descrito nesta Política de Privacidade, conforme você
          indicar ou consentir, conforme necessário para oferecer o Shift e os serviços relacionados, ou
          conforme a lei permitir ou exigir.
        </P>

        <H3>Com outros usuários do Shift</H3>
        <P>
          Seu nome de exibição e suas estatísticas gerais de impacto podem ficar visíveis para outros
          usuários em competições compartilhadas ou rankings da comunidade, conforme as configurações de
          visibilidade dessas competições. Competições privadas (por exemplo, desafios de escolas ou de
          empresas) só são visíveis para participantes verificados.
        </P>

        <H3>Com prestadores de serviços</H3>
        <P>Usamos um número limitado de prestadores de serviços terceirizados para operar o app:</P>
        <Ul>
          <li><strong>Supabase</strong> (infraestrutura de banco de dados e de login): os dados da sua conta e das suas viagens ficam guardados na infraestrutura segura na nuvem da Supabase.</li>
          <li><strong>Expo / EAS</strong> (entrega e atualizações do app): usado para entregar o app e enviar atualizações pela internet.</li>
          <li><strong>Serviços de notificação push</strong> (Apple APNs / Google FCM): usados para enviar notificações ao seu aparelho. Esses serviços recebem o identificador do seu aparelho, mas não a sua localização nem os seus dados de viagens.</li>
          <li><strong>Anthropic</strong> (a inteligência artificial por trás do assistente do Shift): recebe as suas perguntas ao assistente e o que ele busca para respondê-las. Pelos termos dela, a Anthropic não usa isso para treinar os seus modelos.</li>
          <li><strong>Google Maps Platform:</strong> encontra lugares e planeja viagens de transporte público para o assistente do Shift e o mapa Perto de você. Recebe os lugares envolvidos, não o seu nome nem o seu email.</li>
          <li><strong>API da MBTA ou fornecedores de dados de transporte público:</strong> usados para comparar padrões de viagem com dados do transporte público, para classificar viagens de transporte público e para os recursos sobre interrupções do serviço.</li>
          <li><strong>Fornecedores de análise, diagnóstico e infraestrutura:</strong> usados para entender o desempenho do app, diagnosticar falhas, manter a segurança e melhorar o funcionamento.</li>
        </Ul>
        <P>
          Nossos prestadores de serviços só estão autorizados a usar informações pessoais conforme
          necessário para nos prestar serviços, e precisam tratar as informações pessoais de acordo com a
          lei aplicável e com as nossas instruções.
        </P>
        <P>
          Quando for o caso, firmamos contratos que exigem que os prestadores de serviços mantenham as
          informações pessoais em sigilo e não as usem para outras finalidades além de nos prestar
          serviços.
        </P>

        <H3>Com patrocinadores e parceiros</H3>
        <P>
          Na maioria das ofertas de parceiros baseadas em acesso, não damos ao parceiro o seu histórico
          individual de localização, os seus locais salvos, os dados do seu perfil de trajetos inferido,
          os seus registros de viagens nem a sua Taxa Shift pessoal.
        </P>
        <P>
          Se uma recompensa, oferta ou benefício exigir verificação, entrega, prevenção de fraudes,
          atendimento ao cliente ou ajuda pedida por você, podemos compartilhar só as informações
          limitadas e razoavelmente necessárias para essa finalidade, como uma confirmação de acesso, o
          status de um código de desconto, a atividade da oferta, o seu primeiro nome ou os detalhes do
          resgate, quando for o caso.
        </P>
        <P>
          Só podemos compartilhar mais informações com um patrocinador ou parceiro com o seu
          consentimento explícito ou quando a lei exigir.
        </P>

        <H3>Com empresas</H3>
        <P>
          Entrar no grupo da sua empresa no Shift, com um código de convite, um link de entrada ou o seu
          email de trabalho, é voluntário. As pessoas que cuidam do programa da sua empresa podem ver o
          seguinte sobre você, com o seu nome, dos últimos 7 dias, dos últimos 30 dias ou desde o
          início, e podem baixar isso como planilha:
        </P>
        <Ul>
          <li>Seu nome de exibição, sua foto de perfil e a data em que você entrou</li>
          <li>Quantas viagens você fez, e quantas foram a pé, de bicicleta, de transporte público ou outras viagens ativas</li>
          <li>Sua Taxa Shift (a parcela das suas viagens que foram viagens ativas)</li>
          <li>As milhas que você mudou e as emissões de CO2 que essas viagens evitaram</li>
          <li>Se a sua empresa paga recompensas, as recompensas que você recebeu</li>
        </Ul>
        <P>
          A sua empresa não vê aonde você vai. Ela não recebe os trajetos ou mapas das suas viagens, as
          localizações GPS, os pontos de início ou fim das viagens, os locais salvos (como a sua casa)
          nem os dados do perfil de trajetos inferido.
        </P>
        <P>
          Você pode sair do grupo da sua empresa a qualquer momento no app. Quando você sai, deixa de
          aparecer na lista de membros da empresa.
        </P>

        <H3>Com escolas</H3>
        <P>
          Se você entrar num desafio de escola com um código de convite, a sua participação é
          voluntária, e as suas contagens gerais de viagens e estatísticas de impacto podem entrar nos
          relatórios entregues a essa escola.
        </P>
        <P>
          Esses relatórios contêm só dados anônimos ou agrupados, a menos que você tenha aceitado
          explicitamente ser identificado individualmente.
        </P>
        <P>
          As escolas não recebem dados individuais de viagens, informações de localização, locais
          salvos, dados do perfil de trajetos inferido nem a sua Taxa Shift pessoal sem o seu
          consentimento explícito.
        </P>

        <H3>Exigências legais</H3>
        <P>
          Podemos divulgar as suas informações se a lei, um regulamento ou um processo legal válido
          exigir, ou para proteger os direitos e a segurança da GSI, dos nossos usuários ou do público.
        </P>

        <H3>Transferência da empresa ou organização</H3>
        <P>
          Podemos divulgar ou transferir informações pessoais em caso de fusão, venda de uma parte,
          reestruturação, reorganização, dissolução, transferência de bens, transição de programa ou
          operação parecida que envolva todos ou parte dos bens ou das operações da GSI, sujeito à lei
          aplicável.
        </P>

        <H3>Dados agrupados e anônimos</H3>
        <P>
          Podemos usar e divulgar informações que foram agrupadas ou tornadas anônimas, de modo que não
          identifiquem mais você, para qualquer finalidade legal, incluindo relatórios de impacto na
          comunidade, pesquisas, planejamento, relatórios para parceiros, relatórios de subsídios e
          comunicações públicas.
        </P>
      </Section>

      <Section title="Guarda de dados">
        <P>
          Guardamos informações pessoais pelo tempo razoavelmente necessário para as finalidades para as
          quais foram coletadas, incluindo oferecer o Shift, manter a sua conta, administrar XP, nível,
          recompensas, atividade de ofertas, competições, desafios, campanhas e programas, cumprir
          obrigações legais, resolver disputas, fazer cumprir acordos, proteger a segurança e manter
          registros administrativos corretos.
        </P>
        <Ul>
          <li><strong>Conta ativa:</strong> os registros de viagens e os dados da conta são guardados enquanto a sua conta estiver ativa.</li>
          <li><strong>Exclusão da conta:</strong> quando você apaga a sua conta, os seus dados pessoais, incluindo nome, email, locais salvos, perfil de trajetos inferido e registros de viagens obtidos da localização, são apagados ou desvinculados da sua identidade nos sistemas ativos em até 30 dias, a menos que a lei, necessidades de segurança, ciclos de backup, resolução de disputas, prevenção de fraudes ou necessidades operacionais limitadas descritas nesta Política de Privacidade exijam ou permitam um prazo maior. Dados anônimos ou agrupados podem ser guardados para relatórios, pesquisas, planejamento, relatórios para parceiros, relatórios de subsídios e medição do impacto na comunidade, porque não identificam mais você.</li>
          <li><strong>Contas inativas:</strong> contas sem atividade por 24 meses seguidos podem ser desativadas e os dados apagados, com aviso prévio enviado para o seu email cadastrado.</li>
          <li><strong>XP, recompensas e atividade de ofertas:</strong> o seu XP ou nível, o seu histórico de recompensas, o seu histórico de acesso a ofertas e os registros relacionados são apagados ou desvinculados da sua identidade quando você apaga a sua conta, sujeito aos ciclos normais de backup, obrigações legais, prevenção de fraudes, exigências fiscais ou contábeis, resolução de disputas e necessidades de relatórios para programas, patrocinadores ou parceiros. Contagens agrupadas ou anônimas podem ser guardadas para relatórios de programas, relatórios para patrocinadores, relatórios para parceiros, relatórios de subsídios, pesquisas, planejamento e medição do impacto na comunidade, porque não identificam mais você.</li>
          <li><strong>Perfil de trajetos:</strong> o seu perfil de trajetos inferido é apagado em até 30 dias depois da exclusão da conta.</li>
          <li><strong>Conversas com o assistente:</strong> apagadas 12 meses depois da sua última mensagem numa conversa, ou antes, quando você as apaga ou apaga a sua conta.</li>
        </Ul>
      </Section>

      <Section title="Cookies e outras tecnologias de rastreamento">
        <P>
          O nosso site e o nosso app podem usar cookies, pixels, SDKs, identificadores do aparelho,
          ferramentas de análise e tecnologias de rastreamento parecidas para operar os nossos serviços,
          manter a segurança, lembrar preferências, analisar o funcionamento e o desempenho, entender o
          uso e melhorar a experiência.
        </P>
        <P>
          As tecnologias estritamente necessárias nos ajudam a oferecer as funções básicas, como o login
          na conta, a segurança, o funcionamento do app e a operação do serviço.
        </P>
        <P>
          As tecnologias de análise e desempenho nos ajudam a entender como as pessoas usam o site ou o
          app e a melhorar o funcionamento dos nossos serviços.
        </P>
        <P>
          As tecnologias de funcionalidade podem nos ajudar a lembrar preferências ou a personalizar
          recursos do app ou do site.
        </P>
        <P>
          Não usamos cookies nem tecnologias de rastreamento para vender informações pessoais ou mostrar
          publicidade direcionada.
        </P>
        <P>
          Se as nossas práticas mudarem, vamos atualizar esta Política de Privacidade antes de usar
          cookies ou tecnologias parecidas para publicidade direcionada.
        </P>
        <P>
          Normalmente você pode configurar o seu navegador para bloquear ou limitar cookies, mas alguns
          cookies ou tecnologias parecidas podem ser necessários para o site ou o app funcionarem
          direito.
        </P>
      </Section>

      <Section title="Suas escolhas de privacidade e controles da conta">
        <P>Você pode gerenciar muitas escolhas de privacidade diretamente no Shift:</P>
        <Ul>
          <li><strong>Informações da conta:</strong> você pode ver e atualizar algumas informações da conta no app.</li>
          <li><strong>Permissões de localização:</strong> você pode retirar a permissão de localização em segundo plano a qualquer momento nas configurações do aparelho. Isso desativa a detecção automática de viagens, mas você ainda poderá usar o Shift para registrar viagens manualmente.</li>
          <li><strong>Locais salvos:</strong> você pode ver, editar ou apagar os seus locais salvos nas configurações do app.</li>
          <li><strong>Conversas com o assistente:</strong> você pode apagar uma conversa, ou todas, no assistente do app, ou escrevendo para <Mail />.</li>
          <li><strong>Perfil de trajetos inferido:</strong> você pode ver e apagar o seu perfil de trajetos inferido nas configurações do app.</li>
          <li><strong>Notificações:</strong> você pode ajustar ou desativar as notificações nas configurações de notificação do app ou do aparelho.</li>
          <li><strong>Exclusão da conta:</strong> você pode apagar a sua conta no app ou escrevendo para <Mail />. Quando você apaga a sua conta, apagamos ou desvinculamos da sua identidade as informações pessoais associadas à conta, como descrito na seção Guarda de dados.</li>
          <li><strong>Gravações do What Moves Us:</strong> se você participar de uma campanha What Moves Us, pode retirar o seu consentimento e pedir que as suas gravações sejam apagadas, como descrito nos termos de consentimento da campanha e nesta Política de Privacidade.</li>
          <li><strong>Comunicações de marketing:</strong> você pode deixar de receber emails ou mensagens de texto de marketing como descrito na seção Emails de marketing e mensagens de texto (SMS).</li>
        </Ul>
        <P>
          Você também pode escrever para <Mail /> para tirar dúvidas sobre as suas informações, pedir
          ajuda para acessar ou apagar a sua conta, ou levantar uma preocupação de privacidade.
        </P>
        <P>
          Podemos precisar confirmar a sua identidade antes de ajudar com acesso à conta, exclusão ou
          outros pedidos sobre a sua conta. Vamos analisar e responder às perguntas e pedidos sobre
          privacidade num prazo razoável. Vamos seguir as leis de privacidade que se aplicam a nós. Se
          não pudermos atender um pedido, vamos explicar o motivo quando for o caso.
        </P>
      </Section>

      <Section title="Emails de marketing e mensagens de texto (SMS)">
        <P>
          Você pode deixar de receber emails de marketing seguindo as instruções de cancelamento de
          inscrição em qualquer email de marketing ou promocional que receber, ou escrevendo para{' '}
          <Mail />.
        </P>
        <P>
          Se enviarmos mensagens de texto (SMS) de marketing e você não quiser mais recebê-las, pode
          cancelar respondendo &ldquo;STOP&rdquo; ou seguindo qualquer outra instrução de cancelamento da
          mensagem.
        </P>
        <P>
          Mensagens operacionais, de transações, de segurança, da conta e do serviço ainda poderão ser
          enviadas quando a lei permitir.
        </P>
      </Section>

      <Section title="Privacidade das crianças">
        <P>Você precisa ter pelo menos 13 anos para criar uma conta no Shift.</P>
        <P>
          Se você tem entre 13 e 18 anos, você confirma que tem a permissão do seu pai, da sua mãe ou do
          seu responsável para usar o app.
        </P>
        <P>
          O programa escolar do Shift é pensado para crianças com menos de 13 anos, mas funciona por meio
          de contas de professores, administradores escolares ou instituições, e não de contas diretas
          de alunos.
        </P>
        <P>
          Alunos com menos de 13 anos não devem criar contas pessoais no Shift nem usar o app
          diretamente, a menos que a GSI tenha implantado e informado um processo adequado de
          consentimento e de autorização da escola.
        </P>
        <P>
          Não coletamos, de forma consciente, informações pessoais diretamente de crianças com menos de
          13 anos sem o consentimento verificável dos pais ou responsáveis, a autorização da escola ou
          outra base permitida pela lei.
        </P>
        <P>
          Se você acha que, sem querer, coletamos informações pessoais de uma criança com menos de 13
          anos sem o consentimento ou a autorização adequados, escreva imediatamente para <Mail /> e
          vamos tomar medidas razoáveis para apagar as informações ou cumprir de outra forma a lei
          aplicável.
        </P>
      </Section>

      <Section title="Segurança">
        <P>
          Usamos medidas de proteção físicas, eletrônicas, técnicas e administrativas comercialmente
          razoáveis, pensadas para proteger as informações que coletamos.
        </P>
        <P>Usamos medidas de segurança comercialmente razoáveis pensadas para proteger os seus dados, incluindo:</P>
        <Ul>
          <li>Armazenamento de dados criptografado, incluindo a criptografia dos dados armazenados oferecida pelos nossos fornecedores de infraestrutura quando for o caso</li>
          <li>Segurança por linha no nosso banco de dados, pensada para ajudar a garantir que cada usuário só acesse os próprios dados</li>
          <li>Credenciais de acesso que expiram e são renovadas regularmente</li>
        </Ul>
        <P>
          Nenhum método de transmissão ou armazenamento é totalmente seguro. Não podemos garantir
          segurança absoluta, mas nos comprometemos a proteger as suas informações com medidas razoáveis
          e adequadas.
        </P>
        <P>
          A transmissão de informações pela internet ou por aplicativos de celular não é totalmente
          segura, e qualquer transmissão de informações é por sua conta e risco. Você é responsável por
          manter o sigilo das credenciais da sua conta e por nos avisar logo se achar que alguém entrou
          na sua conta sem permissão.
        </P>
      </Section>

      <Section title="Sites e serviços de terceiros">
        <P>
          O Shift e o site podem incluir links para, integrações com ou dados de sites, plataformas,
          APIs, serviços, lojas de apps, serviços de notificação e fornecedores de dados de transporte
          público de terceiros.
        </P>
        <P>
          O uso de sites ou serviços de terceiros pode estar sujeito aos termos e às políticas de
          privacidade desses terceiros.
        </P>
        <P>
          Não somos responsáveis pelas práticas de privacidade, pelo conteúdo, pela exatidão, pela
          disponibilidade ou pelas políticas de sites ou serviços de terceiros que não controlamos.
        </P>
      </Section>

      <Section title="Acessibilidade">
        <P>Queremos que esta Política de Privacidade seja acessível a todas as pessoas.</P>
        <P>Para pedir esta Política de Privacidade em outro formato, escreva para <Mail />.</P>
      </Section>

      <Section title="Mudanças nesta política">
        <P>
          Podemos atualizar esta Política de Privacidade de tempos em tempos, e recomendamos que você a
          revise regularmente. Se fizermos mudanças importantes, incluindo mudanças importantes na forma
          como coletamos, usamos, compartilhamos ou guardamos dados de localização, vamos avisar você pelo
          app, por email, com um aviso no nosso site ou por outro meio razoável antes de as mudanças
          entrarem em vigor, quando for o caso.
        </P>
        <P>
          Se você continuar usando o Shift, o site ou os serviços relacionados depois da data de vigência
          de uma Política de Privacidade atualizada, isso significa que você aceita a Política de
          Privacidade atualizada.
        </P>
        <P>
          Se você não concordar com a Política de Privacidade atualizada, deve parar de usar o Shift, o
          site e os serviços relacionados.
        </P>
      </Section>

      <Section title="Fale conosco">
        <P>
          Green Streets Initiative<br />
          519 Somerville Ave, Ste 2, Box 103<br />
          Somerville, MA 02143<br />
          <Mail />
        </P>
        <P>
          Se você tiver dúvidas sobre esta política ou sobre como os seus dados são tratados, escreva
          para nós. Somos uma equipe pequena e vamos responder pessoalmente.
        </P>
      </Section>
    </>
  )
}
