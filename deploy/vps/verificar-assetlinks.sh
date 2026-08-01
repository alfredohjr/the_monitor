#!/usr/bin/env sh
# Confere o assetlinks.json (#329).
#
# Sem este arquivo — ou com o fingerprint errado — o app da Play Store abre COM
# a barra de endereço do Chrome. Ele funciona, então o erro passa despercebido
# até alguém reparar que "o app parece um navegador". É o engano clássico de
# quem publica TWA.
#
# Uso:
#   ./verificar-assetlinks.sh                 # confere só o arquivo local
#   ./verificar-assetlinks.sh app.exemplo.com # confere também o que está no ar
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"
ARQUIVO="$DIR/well-known/assetlinks.json"
DOMINIO="${1:-}"
FALHAS=0

erro() {
	echo "  ✗ $1"
	FALHAS=$((FALHAS + 1))
}

echo "Arquivo local: $ARQUIVO"

if [ ! -f "$ARQUIVO" ]; then
	erro "não existe"
	exit 1
fi

if ! python3 -m json.tool "$ARQUIVO" >/dev/null 2>&1; then
	erro "não é JSON válido — o Android descarta o arquivo inteiro"
else
	echo "  ✓ JSON válido"
fi

if grep -q "PREENCHA" "$ARQUIVO"; then
	erro "ainda está com o fingerprint de exemplo; veja o README (§ Play Store / TWA)"
else
	echo "  ✓ fingerprint preenchido"
fi

# O fingerprint tem 32 bytes em hex separados por ':' — 95 caracteres.
if ! grep -Eq '"[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){31}"' "$ARQUIVO"; then
	erro "nenhum SHA-256 no formato AA:BB:...:ZZ (32 pares hex)"
else
	echo "  ✓ formato do SHA-256 confere"
fi

if [ -n "$DOMINIO" ]; then
	URL="https://$DOMINIO/.well-known/assetlinks.json"
	echo ""
	echo "No ar: $URL"

	STATUS=$(curl -sS -o /tmp/assetlinks.$$ -w '%{http_code}' "$URL" 2>/dev/null || echo "000")
	TIPO=$(curl -sS -o /dev/null -w '%{content_type}' "$URL" 2>/dev/null || echo "")

	if [ "$STATUS" != "200" ]; then
		erro "respondeu $STATUS (esperado 200)"
	else
		echo "  ✓ 200"
	fi

	case "$TIPO" in
	application/json*) echo "  ✓ Content-Type: $TIPO" ;;
	*) erro "Content-Type é '$TIPO'; o Android exige application/json" ;;
	esac

	if [ -f "/tmp/assetlinks.$$" ] && ! python3 -m json.tool "/tmp/assetlinks.$$" >/dev/null 2>&1; then
		erro "o que está no ar não é JSON válido"
	fi
	rm -f "/tmp/assetlinks.$$"

	echo ""
	echo "Validador oficial do Google (a palavra final — ele testa o mesmo que o Android):"
	echo "  https://developers.google.com/digital-asset-links/tools/generator"
fi

echo ""
if [ "$FALHAS" -gt 0 ]; then
	echo "$FALHAS problema(s). O TWA vai abrir com a barra de endereço."
	exit 1
fi
echo "Tudo certo."
