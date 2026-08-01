#!/usr/bin/env bash
# Empacota o PWA como TWA para a Play Store (#330).
#
# O TWA roda o site no motor do Chrome dentro de uma casca Android — o app
# publicado é o MESMO código React que já está em produção. Não há build
# separado do app: mudou o site, mudou o app, sem passar pela loja.
#
# Só se sobe uma versão nova na Play quando muda algo da CASCA (ícone, nome,
# domínio, permissões). Correção no site chega ao usuário sozinha.
#
# Uso:
#   ./gerar-app.sh app.seudominio.com          # primeira vez (init + build)
#   ./gerar-app.sh app.seudominio.com --update # regera após mudar a config
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
DOMINIO="${1:-}"
MODO="${2:-}"

falhar() {
	echo "ERRO: $1" >&2
	exit 1
}

[ -n "$DOMINIO" ] || falhar "informe o domínio. Ex.: ./gerar-app.sh app.seudominio.com"

# --------------------------------------------------------------------------
# Pré-requisitos — falhar aqui é muito mais barato que falhar no meio do build
# --------------------------------------------------------------------------
command -v node >/dev/null || falhar "node não encontrado (o Bubblewrap é um CLI Node)"
command -v java >/dev/null || falhar "java não encontrado — o Bubblewrap precisa de um JDK 17+"

echo "== Verificações no domínio =="

MANIFEST_URL="https://$DOMINIO/manifest.webmanifest"
if ! curl -sSf -o /dev/null "$MANIFEST_URL"; then
	falhar "manifest inacessível em $MANIFEST_URL — o Bubblewrap lê o app a partir dele (#319)"
fi
echo "  ✓ manifest acessível"

# O assetlinks precisa estar no ar ANTES de gerar o app: é o que faz o TWA abrir
# sem a barra de endereço do Chrome (#329). Dá para publicar sem ele, mas o app
# sai parecendo um navegador — e corrigir depois exige nova verificação.
if "$DIR/../vps/verificar-assetlinks.sh" "$DOMINIO" >/dev/null 2>&1; then
	echo "  ✓ assetlinks.json no ar e bem formado"
else
	echo "  ⚠ assetlinks.json com problema — rode:"
	echo "      deploy/vps/verificar-assetlinks.sh $DOMINIO"
	echo "    Você pode seguir, mas o app vai abrir COM a barra de endereço."
fi

cd "$DIR"

# --------------------------------------------------------------------------
# init ou update
# --------------------------------------------------------------------------
if [ ! -f "twa-manifest.json" ]; then
	echo ""
	echo "== Primeira geração =="
	echo "O Bubblewrap vai perguntar o packageId, o nome do app e a senha do keystore."
	echo ""
	echo "  · packageId: use algo estável, no padrão de domínio invertido."
	echo "    Ele NÃO pode mudar depois da publicação — trocá-lo cria outro app na loja,"
	echo "    e quem instalou o antigo nunca recebe a atualização."
	echo "  · O mesmo valor precisa entrar em deploy/vps/well-known/assetlinks.json,"
	echo "    no campo package_name."
	echo ""
	npx @bubblewrap/cli init --manifest "$MANIFEST_URL"
else
	echo ""
	echo "== Config existente encontrada (twa-manifest.json) =="
	if [ "$MODO" = "--update" ]; then
		npx @bubblewrap/cli update
	fi
	echo ""
	echo "Lembre do appVersionCode: a Play RECUSA um upload com número igual ou menor"
	echo "que o anterior. É a rejeição mais comum, e a mensagem dela não é óbvia."
	echo "Confira em twa-manifest.json antes de subir."
fi

echo ""
echo "== Build =="
npx @bubblewrap/cli build

echo ""
echo "Pronto. O .aab está neste diretório."
echo ""
echo "Antes de subir na Play Console:"
echo "  1. Lighthouse (aba PWA) >= 80 em https://$DOMINIO"
echo "  2. Instale pela faixa de teste interna e confirme que abre SEM a barra do Chrome"
echo "  3. Se a barra aparecer: o SHA-256 do assetlinks.json está errado."
echo "     Ele vem do Play App Signing, NÃO do keystore local — veja deploy/vps/README.md"
