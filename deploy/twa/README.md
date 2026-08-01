# TWA — app Android da Play Store (#330)

O app publicado é uma **Trusted Web Activity**: uma casca Android que abre este
mesmo site no motor do Chrome. Não é WebView e não é um app separado — é o
código React que já está em produção.

A consequência prática importa mais do que parece: **corrigir o site corrige o
app**, sem passar pela revisão da loja. Só se sobe versão nova na Play quando
muda algo da casca (ícone, nome, domínio, permissões).

## O que este diretório versiona — e o que não

| | Versionado? | Por quê |
|---|---|---|
| `twa-manifest.json` | **sim** | É a configuração: packageId, versão, cores, ícone. Sem ela no repositório, quem for gerar o próximo build precisa adivinhar o que foi escolhido no primeiro. |
| `gerar-app.sh` | **sim** | O procedimento, com as verificações que evitam os erros conhecidos. |
| `app/`, `gradle*`, `build.gradle` | **não** | Projeto Android **derivado**: o `bubblewrap update` regenera tudo a partir do manifesto. Versionar é carregar centenas de arquivos que ninguém edita à mão e que conflitam a cada regeneração. |
| `*.keystore`, `*.jks` | **NUNCA** | É credencial. Quem tem o keystore publica atualização em nome deste app. |
| `*.aab`, `*.apk` | **não** | Artefato de build, reconstruível, e pesado. |

**Sobre o keystore.** Guarde fora do repositório, com backup — perdê-lo é pior
que vazá-lo em um aspecto: sem ele você não consegue mais atualizar o app.
Com o **Play App Signing** ligado (o padrão), o Google guarda a chave de
assinatura final e a sua é só a de *upload*, o que torna a perda recuperável por
um pedido no Play Console. Ainda assim, faça backup.

O `.gitignore` deste diretório já impede os commits perigosos, e há um teste
(`frontend/src/__tests__/deploy-assetlinks.test.ts`) que falha se essas regras
sumirem — um keystore commitado não se desfaz apagando o commit.

## Gerar

```bash
./gerar-app.sh app.seudominio.com            # primeira vez
./gerar-app.sh app.seudominio.com --update   # depois de mudar a config
```

Pré-requisitos: Node e um **JDK 17+**. O script confere os dois, além de o
manifest e o `assetlinks.json` estarem no ar, antes de começar — falhar aqui é
muito mais barato que falhar no meio do build.

## Os três erros que custam caro

**1. `packageId` não muda depois da publicação.** Trocá-lo cria um app novo na
loja; quem instalou o antigo nunca recebe a atualização. Escolha no padrão de
domínio invertido e use o mesmo valor no `package_name` do
`deploy/vps/well-known/assetlinks.json` — divergência aí faz o TWA abrir com a
barra de endereço, sem nenhuma mensagem de erro.

**2. `appVersionCode` precisa aumentar a cada upload.** A Play recusa número
igual ou menor que o anterior, e a mensagem não deixa isso claro. É a rejeição
mais comum.

**3. O SHA-256 do `assetlinks.json` vem do Play App Signing, não do keystore
local.** Detalhado em `deploy/vps/README.md` (§ *Play Store / TWA*).

## Requisitos que não são código

- Conta no Google Play Console — **US$ 25**, pagamento único.
- URL pública de política de privacidade (a Play exige).
- **Lighthouse PWA ≥ 80** no domínio de produção. Se estiver abaixo, a causa
  costuma estar nas issues #319–#325, não aqui.
