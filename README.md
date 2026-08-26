# Infinity Dex Helper

Extensão de navegador **não-oficial** (companion) para o jogo [InfinityMMO](https://infinitymmo.net) — mostra num painel lateral informações úteis enquanto você joga.

> ⚠️ **Ferramenta feita por fã, não-oficial.** Não é afiliada, endossada ou mantida pela equipe do InfinityMMO nem por nenhum detentor de marca. Use por sua conta.

> 🙏 **Créditos / origem:** este projeto foi **baseado no** [pokemon-infinity-mmo-extension, de andaraGui](https://github.com/andaraGui/pokemon-infinity-mmo-extension). A base do código veio desse projeto; a partir dele foram feitas modificações e adições (aba Pokédex, filtros, fórmulas do jogo, etc.). Todos os créditos pelo trabalho original ao **andaraGui**.

## ✨ O que faz

- **Batalha ao vivo**: fraquezas do oponente, **melhor jogada**, **dano estimado** e **chance de captura** (usando as mesmas fórmulas do jogo)
- **Golpes do oponente** e PP já visto
- **Meus Pokémon**: lista com filtros (tipo, nature, IV total, IV por atributo, shiny, item…)
- **Pokédex**: o que você já capturou/viu, com **silhueta** dos não-vistos e **onde encontrar** cada um (mapa, método, nível, %)
- **Nome do mapa atual** no topo do painel

Tudo é **somente leitura** — a extensão não automatiza nada, não é bot, não modifica o jogo nem o servidor, e não coleta nem envia dados de ninguém (roda 100% local no seu navegador).

## 📦 Instalação (modo desenvolvedor)

1. Baixe este repositório (botão **Code → Download ZIP**) e descompacte
2. Abra `chrome://extensions` (ou `edge://extensions`, `opera://extensions`, `brave://extensions`)
3. Ative o **Modo do desenvolvedor**
4. Clique em **Carregar sem compactação** e selecione a pasta descompactada
5. Abra `infinitymmo.net`, dê **F5**, e clique no ícone da extensão

> Precisa de um navegador baseado em Chromium **111+** (qualquer um de 2023 pra frente).

## 💛 Apoie o projeto

A extensão é **gratuita**. Se ela te ajuda, considere uma doação — nas **⚙ Configurações** da extensão tem a chave **Pix** com botão de copiar. Obrigado!

## 🛠️ Como funciona (transparência)

- Lê as respostas de rede que o próprio jogo já faz (batalha/personagem) e o estado do jogo no cliente
- Exibe tudo num painel sobreposto — sem enviar comandos, cliques ou ações ao jogo
- Os sprites mostrados são os que o próprio jogo hospeda (referenciados por URL, não redistribuídos)

## 📄 Licença de uso

Projeto pessoal/fã, **derivado** do trabalho original de [andaraGui](https://github.com/andaraGui/pokemon-infinity-mmo-extension). Os créditos da base do código são dele. Marcas e conteúdos do jogo pertencem aos seus respectivos donos.
