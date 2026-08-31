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
