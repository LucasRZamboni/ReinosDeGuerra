# Reinos De Guerra

Jogo solo de estratégia medieval feito com HTML, CSS, Bootstrap e JavaScript puro.

## Como jogar

1. Abra `index.html` no Chrome, Edge ou Firefox.
2. Evolua os edifícios para aumentar produção, capacidade e população.
3. Siga os requisitos entre edifícios e recrute tropas no menu **Exército**.
4. Abra o **Mapa**, escolha uma aldeia independente e envie um ataque.
5. Recrute Arautos (Quartel nível 4) para reduzir a lealdade e conquistar aldeias.

O progresso é salvo automaticamente no navegador. Use **Ajustes** para exportar um backup.

## Como personalizar

Todos os valores principais estão em `js/config.js`, com comentários. Ali você pode alterar:

- velocidade padrão e opções de velocidade;
- produção de cada recurso;
- custos e duração das construções;
- atributos, custos e treinamento das tropas;
- tamanho do mapa;
- tempo de viagem;
- dano de lealdade e regras de conquista.

## Novidades da versão 2

- aldeias externas possuem crescimento próprio;
- edifícios e tropas possuem requisitos de progressão;
- infantaria e cavalaria têm defesas diferentes, com estimativa e relatórios detalhados;
- produção, custos, tempos e viagem podem ser ajustados dentro do jogo;
- cada novo mundo permite escolher dificuldade e condição de vitória.

## Novidades da versão 3

- mapa ilustrado: as aldeias mudam de aparência conforme se desenvolvem;
- interior da aldeia em forma de assentamento, com edifícios clicáveis;
- aldeias livres crescem passivamente, mas não atacam o jogador;
- modo Administração para editar qualquer aldeia sem custos;
- o administrador pode alterar dono, nome, lealdade, recursos, tropas e níveis dos edifícios.

### Correção 3.1

A interface não é mais reconstruída a cada ciclo do jogo. Recursos e cronômetros são atualizados separadamente, evitando recarregamentos visuais e permitindo editar formulários normalmente.

## Versão 4 — balanceamento clássico e mapa territorial

- edifícios disponíveis: Edifício Principal, Quartel, Estábulo, Oficina, Academia, Ferreiro, Praça de Reuniões, Estátua, Mercado, Bosque, Barreiro, Mina, Fazenda, Armazém, Esconderijo e Muralha;
- níveis máximos, custos-base e multiplicadores próprios por recurso;
- sistema de pontos por edifício e pontos totais da aldeia;
- tabela clássica de produção, capacidade do Armazém e população da Fazenda;
- doze unidades com custos, ataque, três tipos de defesa, velocidade, saque e população;
- Aríetes danificam muralhas, Catapultas danificam edifícios e Nobres reduzem lealdade;
- mapa 12×9 com espaços vazios, florestas, lagos, colinas e aldeias esparsas.

Para experimentar a distribuição territorial completa, crie um novo mundo em **Ajustes**.

## Versão 4.2

- renomeação direta de todas as aldeias em posse;
- administração de nome e posse separada dos controles de recursos e tropas;
- limites máximos visíveis em recursos, tropas e edifícios;
- seis estágios visuais de crescimento;
- mapa compacto com zoom pelo scroll e navegação por arraste;
- níveis dos edifícios sobre a aldeia sem nomes permanentes;
- Edifício Principal abre a lista completa de construções em modal;
- movimentos e fila de treinamento aparecem na tela inicial da aldeia.

## Versão 4.3

- quadro da aldeia menor e quadrado, com treinamento e movimentos ao lado;
- troca de aldeia ativa corrigida;
- administração mais compacta, com recursos ao lado da identidade da aldeia;
- mais aldeias livres no mapa, exibidas em cinza até serem conquistadas.
- edifícios ainda não construídos deixam de exibir marcadores na aldeia;
- Quartel, Estábulo, Oficina e Academia abrem diretamente suas opções de treinamento.

O Bootstrap é carregado pela internet. Sem conexão, o jogo continua funcional, mas usa apenas os estilos próprios.

## Versão 5.0

- mapa ampliado para 100×100 com cerca de 400 aldeias variadas;
- aldeias bônus de madeira, argila, ferro, fazenda, recursos, Quartel e Estábulo;
- porcentagens dos bônus personalizáveis em Ajustes e bônus individual editável pela Administração;
- alternância entre ilustração e lista de edifícios na tela da aldeia;
- recursos mostram quantidade atual e capacidade máxima;
- requisitos desaparecem automaticamente quando cumpridos;
- pontos atuais e do próximo nível aparecem na lista de edifícios;
- Praça de Reuniões abre ataques por coordenadas com estimativa de viagem;
- relatórios resumidos e detalhes de baixas, sobreviventes, saque e espionagem por Batedores.

## Revisão 2026-08-31
- Diagnóstico de pontuação máxima exibido no Admin; com a configuração padrão atual, todos os edifícios máximos resultam da tabela de pontos configurada (descontando níveis gratuitos iniciais).
- Nascimento automático de bárbaras/bônus corrigido no loop do jogo, com salvamento separado e botão de teste “Gerar ciclo agora”.
- Presets de edifícios: inicial, 50%, máximo e personalizável (Admin/configurações).
- Regras de inimigos centralizadas: ataques, conquistas, limite de expansão e raio.
- Otimização: tick reduzido para 1/s, autosave padrão a cada 10s e cache de pontuação por níveis.

## Histórico consolidado — evolução do projeto até 2026-09-02

Esta seção consolida as alterações implementadas nas revisões posteriores. Ela serve como referência do estado atual do projeto e complementa as notas de versão acima.

### Contas, jogadores e mundo

- Tela de login com separação entre conta de jogador e Administrador.
- Criação de contas de jogador e identificação por `playerId`/`ownerId`.
- Aldeias pertencentes a jogadores diferentes são distinguidas corretamente no mesmo estado local do mundo.
- A aldeia ativa passou a ser tratada por jogador, evitando que a sessão do Admin herde visualmente a aldeia ativa de uma conta comum.
- O Admin pode permanecer com zero aldeias, zero pontos e continuar usando as ferramentas administrativas.
- Jogador que perde sua última aldeia recebe estado de derrota, com opções de reiniciar no mesmo mundo ou iniciar um novo mundo.
- Novos jogadores recebem aldeia inicial em coordenada vazia quando aplicável.
- O projeto continua sendo executado no navegador/localStorage; multiplayer real entre dispositivos ainda exige backend, banco de dados e autenticação no servidor.

### Mapa e coordenadas

- Mundo ampliado para 100×100 campos.
- Sistema de coordenadas migrado para ser centralizado em `0|0`, incluindo coordenadas negativas.
- Admin inicial pode ocupar `0|0` quando a configuração de criação do mundo assim determinar.
- Campos de ataque/apoio aceitam coordenadas negativas de acordo com os limites do mapa.
- Zoom por roda do mouse, botões e gesto de pinça no mobile.
- Minimap quadrado, ocultável, com navegação por clique e indicador da área visível.
- Centro do mapa acompanha a aldeia ativa quando apropriado.
- Aldeias próprias, inimigas, bárbaras e bônus possuem diferenciação visual.
- Indicadores de ataques e retornos podem aparecer no mapa.
- Filtros administrativos por quadrante: NO, NE, SO e SE.
- Admin pode escolher campo vazio para criar aldeia e também criar várias aldeias em coordenadas aleatórias vazias.

### Aldeias, edifícios, pontos e população

- Sistema de requisitos entre edifícios; mensagens de requisito deixam de aparecer quando cumpridas.
- Edifícios bloqueados podem permanecer ocultos até que seus requisitos sejam atingidos, com opção de exibir todos.
- Alternância entre desenho da aldeia e visualização em lista.
- Seletor/renomeação de aldeia reorganizado para facilitar a gestão de várias aldeias.
- Limites máximos de edifícios são respeitados inclusive em conclusões administrativas e filas.
- Pontuação é calculada pela progressão de pontos configurada de cada edifício, descontando níveis gratuitos quando aplicável.
- Configuração inicial pretendida: Edifício Principal 1 = 10 pontos, Bosque 1 = 6, Barreiro 1 = 6 e Mina 1 = 6, totalizando 28 pontos; Fazenda/Armazém/Praça iniciais podem ser níveis gratuitos.
- Diagnóstico de pontuação atual e pontuação máxima disponível no Admin.
- População usada passou a considerar edifícios, tropas existentes e população reservada em treinamento.
- Construções não podem ultrapassar a capacidade da Fazenda.
- Edifício Principal nível 30 segue a referência de consumo populacional configurada para a progressão clássica.
- Presets de edifícios: Inicial, 50% evoluído, Máximo e Personalizável.
- Opção para ocultar edifícios já finalizados/maximizados na lista sem removê-los do desenho da aldeia.

### Recursos, produção e bônus

- Produção de madeira, argila e ferro é processada para todas as aldeias, não apenas para a aldeia ativa.
- Capacidade do Armazém é respeitada na produção e nas ferramentas administrativas.
- Aldeias bônus podem conceder bônus de madeira, argila, ferro, Fazenda, produção geral, Quartel e Estábulo.
- Percentuais dos bônus são configuráveis e o bônus individual pode ser editado pelo Admin.
- Recursos no cabeçalho são clicáveis e podem abrir detalhes de produção atual por minuto/hora e estimativa do próximo nível.
- Regras de nascimento automático de aldeias bárbaras/bônus possuem salvamento separado e ferramenta administrativa de teste do ciclo.
- O nascimento automático pode ser limitado por intervalo, quantidade por ciclo, limite total e chance de aldeia bônus.
- Há opção administrativa para gerar novas aldeias já maximizadas no ciclo de nascimento.

### Exército, recrutamento e população militar

- Unidades possuem custos, população, velocidade, saque, ataque e defesas diferenciadas.
- Recrutamento respeita recursos, população, edifícios e requisitos.
- Filas de treinamento mostram progresso e unidades são liberadas progressivamente de acordo com o tempo de treinamento, em vez de somente ao final de um lote inteiro.
- Administração possui ferramentas para finalizar próximo treinamento e finalizar filas.
- Presets militares de Defesa, Ataque e Personalizado foram adicionados à gestão de aldeias e ferramentas administrativas.
- Edição administrativa de tropas passou a limitar composições à população realmente disponível da Fazenda, considerando a população dos edifícios.
- Administração em massa pode aplicar presets, recursos, bônus, edifícios e outras alterações a múltiplas aldeias.
- Ferramentas de seleção em massa incluem Todas, Minhas, Inimigas e seleção de uma IA específica, além de categorias de aldeias livres/bônus conforme a classificação do mundo.

### Combate, conquista e espionagem

- Combate diferencia ataque e tipos de defesa.
- Aldeias possuem defesa-base além das tropas/muralha quando configurado.
- Aríetes atacam a Muralha e relatórios registram a destruição.
- Catapultas permitem escolher alvo e relatórios registram níveis destruídos.
- Nobres reduzem lealdade e podem conquistar aldeias quando sobrevivem com escolta suficiente.
- Relatórios mostram lealdade antes/depois da ação de conquista.
- Batedores possuem espionagem progressiva: conforme o sucesso/força da espionagem, podem revelar recursos, edifícios e tropas.
- Ataques comuns possuem validação de população militar mínima configurável.
- Sistema de ataques agendados permite definir horário de saída ou de chegada.
- Tropas de ataques agendados ficam reservadas antes da partida e são liberadas se o agendamento for cancelado.
- Ataques sincronizados podem partir de múltiplas aldeias visando um horário comum de chegada, com cálculo de saída por origem.

### Apoios e comandos

- Sistema de Apoio permite enviar tropas para permanecer em outra aldeia.
- Apoios estacionados podem ser retirados, criando movimento de retorno.
- Central de Comandos reúne ataques enviados, ataques recebidos, apoios e retornos.
- Origem e destino podem ser usados para navegar até as aldeias no mapa.
- Admin possui visão global dos movimentos ativos do mundo, independentemente do proprietário.
- Informações sobre tropas em comandos respeitam a permissão do jogador; o Admin pode visualizar o conjunto global.
- Avisos de conquista são destinados ao jogador somente quando uma aldeia dele é conquistada, evitando notificações irrelevantes de conquistas entre IAs/bárbaras.
- Ataques inimigos direcionados a aldeias do jogador podem gerar indicação de ataque a caminho.
- Proteções adicionais foram incluídas para evitar que um erro durante a resolução de um movimento apague silenciosamente o comando e as tropas sobreviventes.

### Relatórios

- Relatórios detalham vitória/derrota, sobreviventes, baixas, saque, espionagem, dano de lealdade, Aríetes e Catapultas.
- Sobreviventes e mortos possuem diferenciação visual.
- Navegação anterior/próximo dentro do modal de relatório.
- Exclusão individual e exclusão em massa.
- Relatórios 2.0 adicionaram filtros por tipo, lido/não lido, favoritos e seleção múltipla.
- Relatórios são associados aos destinatários relevantes por `playerId` quando possível.
- Origem/destino e participantes foram preparados para integração com mapa/perfis.

### Ranking, perfis e estatísticas

- Ranking geral por pontos e número de aldeias.
- Jogadores humanos, Admin e jogadores IA podem aparecer no ranking.
- Rankings adicionais de Atacantes, Defensores e Conquistadores.
- Pontos militares foram estruturados para representar a população equivalente de tropas inimigas derrotadas em ataque/defesa.
- Perfil público pode mostrar nome, posição, pontos, aldeias, conquistas e estatísticas permitidas sem revelar tropas ou recursos privados.
- Aldeias do perfil são clicáveis e podem direcionar o mapa.
- Aldeias conquistadas por uma IA permanecem vinculadas ao mesmo `aiId`, permitindo somar corretamente pontos e aldeias daquele jogador IA.

### Inteligência Artificial

- IAs possuem perfis de comportamento: Ofensiva, Defensiva, Econômica e Expansiva.
- IAs produzem recursos, constroem, recrutam e atacam seguindo as regras econômicas do mundo em vez de receber progressão artificial gratuita.
- Aldeias inimigas conquistadas continuam pertencendo à mesma IA por `aiId`.
- Regras configuráveis incluem ataques a jogadores, bárbaras/bônus e outras IAs, conquistas, raio de ação e limite de expansão.
- Comportamentos podem controlar construção, recrutamento, produção de Nobres, uso de cerco e tamanho dos lotes de recrutamento.
- IAs ofensivas/expansivas receberam prioridade maior para perseguir a cadeia de requisitos até a Academia e produzir Nobres quando a conquista estiver habilitada.
- Novas IAs devem iniciar em aldeias normais, não em aldeias bônus; aldeias bônus ainda podem ser conquistadas posteriormente conforme as regras.
- Salvamento do comportamento das IAs foi separado da criação/quantidade de inimigos para evitar recriar ou resetar IAs existentes ao alterar regras.
- Diagnóstico de IA foi adicionado à Administração para expor estados como construção, recrutamento, economia, Fazenda cheia, preparação de Nobre e ausência de alvo permitido.

### Administração

- Administração organizada em abas para Mundo, Regras, criação/edição de aldeias, edição em massa e diagnóstico/ferramentas relacionadas.
- Edição em massa permite selecionar várias aldeias e aplicar recursos, bônus, presets de edifícios/tropas e outras operações administrativas.
- Seleção por proprietário/IA e filtros territoriais foram adicionados.
- Alteração de proprietário pode atribuir aldeia a uma IA específica existente.
- Pesquisa de aldeias por nome, coordenada, proprietário/IA para evitar rolagem de listas extensas.
- Criação de aldeia permite configurar coordenadas, proprietário, bônus, recursos, edifícios e tropas.
- Criação em lote pode preencher coordenadas aleatórias vazias.
- Contadores administrativos exibem total de aldeias e divisões por Admin/jogador, inimigas, bárbaras e bônus conforme o estado atual.
- Ferramentas para concluir construções, treinamentos e filas.
- Presets e botões administrativos preenchem campos antes da aplicação, evitando alterações imediatas acidentais.
- Salvamentos foram separados por grupos para reduzir efeitos colaterais entre configurações não relacionadas.

### Regras do Mundo e Ajustes

- Editor de Regras do Mundo com presets Clássico, Rápido, Guerra e Casual.
- Cada preset possui proposta própria de ritmo e pode servir como base para personalização.
- Valores do mundo podem sobrescrever configurações padrão sem alterar chaves protegidas do salvamento.
- Ajustes foram reorganizados em grupos como velocidade, mundo, bônus, regras/objetivos e jogabilidade.
- Regras persistentes de jogabilidade ficam preferencialmente em Ajustes; ferramentas de manipulação do estado ficam em Administração.
- Proteção de iniciante/reinício configurável, com indicação visual de escudo e impedimento de ataques de IA enquanto ativa.
- Sistema de condição de vitória configurável: desativado, percentual de domínio, quantidade de aldeias, pontos, conquistas ou último participante restante, conforme as opções disponíveis.

### Progressão, recompensas e Visão Geral

- Estágios visuais da aldeia acompanham sua evolução.
- Sistema de marcos de evolução permite configurar recompensas por pontos e por percentual de desenvolvimento.
- Recompensas podem conceder recursos proporcionais à capacidade do Armazém ou tropas, com registro para evitar recebimento repetido do mesmo marco.
- Visão Geral do Reino reúne pontos, aldeias, produção total, tropas, população, construções, treinamentos e ataques chegando.
- Gestão de múltiplas aldeias possui filtros, pesquisa, construção rápida, recrutamento e acesso direto à aldeia/mapa.
- Cabeçalho/indicadores exibem total de pontos e número de aldeias do reino quando aplicável.

### Interface, mobile e desempenho

- Interface deixou de executar `render()` completo nos ticks automáticos; atualizações de recursos e cronômetros são feitas separadamente.
- Ações explícitas podem atualizar imediatamente os componentes afetados, evitando depender de F5 sem reintroduzir flicker global.
- Layout da aldeia reorganizado com área principal e painéis compactos para tropas, construções, treinamento e movimentos.
- Navegação, Administração, tabelas, modais, Ranking, Comandos e gestão de aldeias receberam ajustes responsivos.
- Menus/abas mobile ganharam melhor área de toque, rolagem horizontal onde necessária e menor densidade vertical.
- Contraste de textos, campos, botões e superfícies escuras foi revisado em várias telas.
- Design evoluiu para um painel medieval mais compacto, com cards, métricas e hierarquia visual mais consistente.
- Cache de pontuação reduz recálculos repetidos.
- Frequência de processamento visual/autosave foi reduzida em revisões de performance para diminuir trabalho desnecessário em mundos grandes.
- Processamento de produção e filas foi ampliado para todas as aldeias sem exigir que estejam visíveis na tela.

## Próxima rodada — ajustes já levantados, ainda pendentes nesta versão

Os itens abaixo foram identificados durante os testes posteriores e estão registrados aqui para não se perderem, mas **não devem ser considerados concluídos apenas por constarem no README**:

- impedir rerender/tick da tabela de edifícios dentro do Edifício Principal;
- corrigir definitivamente os relatórios do topo da lista que ainda podem não abrir;
- bônus periódico global configurável, inicialmente proposto como 1.000 de cada recurso a cada 20 minutos, respeitando Armazém e categorias de aldeia;
- separar definitivamente as filas de treinamento por edifício militar (Quartel, Estábulo, Oficina e Academia), com FIFO dentro de cada edifício e liberação unidade a unidade;
- revisar a tela de Diagnóstico da IA, que em testes recentes pode não abrir;
- investigar e eliminar qualquer duplicação de tropas durante treinamento, processamento offline, IA ou recompensas;
- transformar recompensas sem espaço de Armazém/Fazenda em recompensas **pendentes**, visíveis para resgate posterior;
- um ataque com vários Nobres deve aplicar somente uma redução de lealdade; múltiplas reduções exigem ataques separados;
- atualizar preset **Ataque** para 6.000 Bárbaros, 200 Batedores, 3.000 Cavalarias Leves e 200 Aríetes (19.400 de população com os custos atuais);
- atualizar preset **Defesa** para 5.000 Lanceiros, 5.000 Espadachins, 5.000 Arqueiros, 250 Batedores, 500 Cavalarias Pesadas e 250 Catapultas (20.500 de população com os custos atuais);
- atualizar preset **Ataque + Nobre** para o preset de ataque mais 4 Nobres (19.800 de população com os custos atuais);
- preset Personalizado deve abrir modal completo de composição, reutilizável na gestão de aldeias e no Admin para edição individual/em massa;
- revisão integral da IA para garantir que todas continuem produzindo, evoluindo, recrutando, atacando e conquistando quando as regras permitirem;
- reorganizar parâmetros e localização das configurações entre Ajustes e Administração, unificando duplicidades e separando responsabilidades quando necessário.

## Observação sobre o simulador de balanceamento

Foi discutida a criação de um simulador administrativo de 1h, 6h, 12h, 1 dia, 3 dias e 7 dias para testar economia, IA, ataques e expansão sobre uma cópia isolada do estado do mundo. A ideia foi considerada viável, mas **não foi implementada até esta versão**.

## Revisão de consolidação (setembro de 2026)

Nesta revisão foram aplicadas correções estruturais adicionais levantadas nos testes: o Diagnóstico IA passa a ser reconhecido pelo roteador da Administração; mudanças automáticas do mundo deixam de disparar reconstrução completa das views (ticks salvam o estado e atualizam apenas elementos vivos); a abertura de relatórios ganhou delegação de eventos estável; filas de treinamento passam a operar independentemente por Quartel, Estábulo, Oficina, Academia e Estátua, mantendo FIFO dentro de cada edifício e liberação unidade a unidade; múltiplos Nobres no mesmo comando aplicam somente uma redução de lealdade; foi incluído bônus periódico configurável de recursos (padrão 1.000 de cada a cada 20 minutos, respeitando o Armazém); e os presets militares foram atualizados para Ataque 6.000 Bárbaros/200 Batedores/3.000 CL/200 Aríetes, Defesa 5.000 Lanceiros/5.000 Espadachins/5.000 Arqueiros/250 Batedores/500 CP/250 Catapultas e Ataque + 4 Nobres.

Continuam como evolução planejada da mesma frente: tela completa de Conquistas com recompensas pendentes quando não houver espaço; editor modal unificado de presets personalizados; regras completas do Herói/Paladino (um por proprietário, Estátua somente na primeira aldeia, sem armas/XP); metas de IA por composição militar e revisão profunda de autonomia de todas as IAs; e reorganização final de parâmetros entre Ajustes e Administração.


## Consolidação 2026-09-02
- Regras críticas centralizadas no `config.js`: combate, treinamento, Herói, perfis de IA, presets, bônus periódico e conquistas.
- Filas militares independentes por Quartel/Estábulo/Oficina/Academia/Estátua, com liberação unidade a unidade. `Finalizar próximo treinamento` conclui somente a próxima unidade; `Finalizar todas` continua sendo a exceção administrativa.
- IA usa composição-alvo por perfil e recruta por fila real, sem ganhar tropas instantaneamente; limites de Batedores e metas de Nobres ficam parametrizados.
- Bônus periódico padrão: 1.000 de cada recurso a cada 20 minutos, configurável por categoria de aldeia e respeitando Armazém.
- Recompensas de evolução que não cabem ficam pendentes em vez de ultrapassar Fazenda/Armazém.
- Presets: Ataque 6000 Bárbaros/200 Batedores/3000 CL/200 Aríetes; Defesa 5000 Lanceiros/5000 Espadachins/5000 Arqueiros/250 Batedores/500 CP/250 Catapultas; Ataque+Nobre acrescenta 4 Nobres.
- Preset personalizado editável em modal e reutilizável nas ferramentas administrativas/coletivas.
- Regra de conquista: vários Nobres no mesmo comando causam apenas um golpe de lealdade.
- Herói/Paladino: um por proprietário, criado pela Estátua; Estátua restrita à primeira aldeia; bárbaras/bônus não usam Herói por padrão.
- Diagnóstico IA permanece como aba própria da Administração e não deve cair no fallback Mundo.
- Interface automática continua event-driven: `game-tick` atualiza somente dados vivos, sem renderização completa de tabelas/formulários.

## Conquistas unificadas

Os antigos `villageMilestones` foram incorporados a `GAME_CONFIG.achievements`. O mesmo motor agora controla conquistas do reino e marcos por aldeia (`repeat: "perVillage"`), incluindo progresso, estado bloqueado/disponível/em espera/resgatado e validação de capacidade do Armazém/Fazenda. Saves antigos com `claimedMilestones`/`pendingMilestones` são migrados ao carregar.

## Consolidação IA e objetivos (02/09/2026)
- `ai.actionIntervalSeconds` é agora a fonte única do intervalo estratégico das IAs.
- O campo "Intervalo de ação da IA (segundos)" foi incluído em Administração > Mundo > Comportamento dos inimigos.
- Saves antigos que possuam `enemyRules.actionIntervalSeconds` são migrados/aceitos como fallback, mas novos salvamentos usam `settings.ai.actionIntervalSeconds`.
- `enemyRules.actionIntervalSeconds` foi removido do `config.js` para evitar duas configurações concorrentes.
- Objetivos `enemy1` e `enemyAll` são processados pelo motor: um inimigo é derrotado somente quando perde sua última aldeia; bárbaras e aldeias bônus não contam como inimigos.
- Os textos dos objetivos de domínio permanecem corrigidos para 25% e 50%.
