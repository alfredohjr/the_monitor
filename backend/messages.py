"""Mensagens do backend em pt-BR e inglês (#299).

Espelha as decisões que o front tomou no #277/#289:

- **`en` é o padrão.** Locale desconhecido cai nele.
- **Chave ausente devolve a própria chave**, nunca `None`: um `detail=None` vira
  erro sem texto na tela, que é pior do que aparecer `erro.foo` e alguém abrir bug.
- **Frase inteira no catálogo, com `{placeholder}`** — nunca concatenar pedaços,
  porque isso amarra a ordem das palavras de um idioma só.

O `detail` das rotas continua sendo **string**. Trocar por dict ou código de erro
quebraria os testes do backend e o `mensagemDeErro` em `frontend/src/lib/api.ts`.

Esta issue cria só a base: as rotas são migradas em #300, #301 e #302.
"""
from __future__ import annotations

import re
from typing import Annotated, Optional

from fastapi import Depends, Header

LOCALE_PADRAO = "en"
LOCALES = ("en", "pt-BR")

# Catálogo. As chaves são iguais nos dois idiomas — há teste de paridade.
MSG: dict[str, dict[str, str]] = {
    "en": {
        "erro.credenciais_invalidas": "Invalid credentials",
        "notif.meta_fallback": "Goal #{id}",
        "notif.meta_atingida": "🎯 Goal reached: {nome} ({total}/{alvo})",
        "email.reset_ignore": "If it wasn't you, ignore this e-mail.",
        "email.reset_corpo": "We received a request to reset your password. Click the link below (valid for 1h):",
        "email.reset_assunto": "Password reset — The Monitor",
        "email.verificacao_corpo": "Confirm your e-mail by clicking the link below (valid for 24h):",
        "email.verificacao_assunto": "Confirm your e-mail — The Monitor",
        "email.rodape": "The Monitor — goal tracking",
        "email.em_risco": "at risk",
        "email.col_hoje": "Today",
        "email.col_alvo": "Target",
        "email.col_metrica": "Metric",
        "email.resumo_sem_metas": "No goal registered yet.",
        "email.resumo_saudacao": "Hello",
        "email.resumo_cabecalho": "Summary for {data}",
        "email.resumo_assunto": "Goals summary — {data}",
        "email.resumo_titulo": "Daily goals summary",
        "erro.locale_invalido": "Unsupported language",
        "erro.usuario_nao_pertence_org": "User does not belong to this organization",
        "erro.nao_pode_remover_a_si": "You cannot remove yourself",
        "erro.ja_e_membro": "User is already a member of this organization",
        "erro.email_obrigatorio": "E-mail is required",
        "erro.membros_exige_plano_pago": "Adding members requires a paid plan for this organization",
        "erro.acesso_restrito_admin": "Restricted to the organization admin",
        "erro.org_nao_encontrada": "Organization not found",
        "erro.ja_pertence_org": "User already belongs to an organization",
        "erro.ancora_nao_encontrada": "Anchor not found",
        "erro.indice_nao_encontrado": "Index not found",
        "erro.fim_origem_anterior": "Source end is before the start",
        "erro.intervalo_muito_longo": "Range too long (max. 366 days)",
        "erro.data_fim_anterior": "End date is before the start",
        "erro.estrategia_invalida": "Invalid strategy",
        "erro.item_nao_existe": "Item does not exist",
        "erro.sem_permissao_excluir": "No permission to delete this entry",
        "erro.sem_permissao_editar": "No permission to edit this entry",
        "erro.metrica_nao_atribuida": "Metric not assigned to you",
        "erro.so_proprios_lancamentos": "You can only change your own entries",
        "erro.datas_invalidas": "Invalid dates (use YYYY-MM-DD)",
        "erro.subscricao_nao_encontrada": "Subscription not found",
        "erro.notificacao_nao_encontrada": "Notification not found",
        "erro.lancamento_nao_encontrado": "Entry not found",
        "erro.meta_nao_encontrada": "Goal not found",
        "erro.metrica_nao_encontrada": "Metric not found",
        "erro.token_invalido": "Invalid token",
        "erro.usuario_nao_encontrado": "User not found",
        "erro.username_ja_cadastrado": "Username already registered",
        "erro.email_ja_cadastrado": "E-mail already registered",
        "erro.organizacao_obrigatoria": "Organization is required",
        "erro.codigo_org_obrigatorio": "Organization code is required",
        "erro.codigo_org_invalido": "Invalid organization code",
        "erro.org_free_sem_membros": "This organization does not allow new members (free plan)",
        "erro.email_nao_verificado": "E-mail not verified. Check your inbox.",
        "erro.token_expirado": "Expired token",
        "erro.senha_curta": "The password must be at least 6 characters long",
        "erro.token_google_invalido": "Invalid Google token",
        "erro.nome_obrigatorio": "Name is required",
        "erro.sem_acesso_org": "No access to this organization",
        "erro.sem_org_ativa": "No active organization",
        "erro.nome_org_obrigatorio": "Organization name is required",
        "erro.nome_org_em_uso": "Organization name already in use",
    },
    "pt-BR": {
        "erro.credenciais_invalidas": "Credenciais inválidas",
        "notif.meta_fallback": "Meta #{id}",
        "notif.meta_atingida": "🎯 Meta atingida: {nome} ({total}/{alvo})",
        "email.reset_ignore": "Se não foi você, ignore este e-mail.",
        "email.reset_corpo": "Recebemos um pedido para redefinir sua senha. Clique no link abaixo (válido por 1h):",
        "email.reset_assunto": "Redefinição de senha — The Monitor",
        "email.verificacao_corpo": "Confirme seu e-mail clicando no link abaixo (válido por 24h):",
        "email.verificacao_assunto": "Confirme seu e-mail — The Monitor",
        "email.rodape": "The Monitor — acompanhamento de metas",
        "email.em_risco": "em risco",
        "email.col_hoje": "Hoje",
        "email.col_alvo": "Alvo",
        "email.col_metrica": "Métrica",
        "email.resumo_sem_metas": "Nenhuma meta cadastrada ainda.",
        "email.resumo_saudacao": "Olá",
        "email.resumo_cabecalho": "Resumo do dia — {data}",
        "email.resumo_assunto": "Resumo de metas — {data}",
        "email.resumo_titulo": "Resumo diário de metas",
        "erro.locale_invalido": "Idioma não suportado",
        "erro.usuario_nao_pertence_org": "Usuário não pertence a esta organização",
        "erro.nao_pode_remover_a_si": "Você não pode remover a si mesmo",
        "erro.ja_e_membro": "Usuário já é membro desta organização",
        "erro.email_obrigatorio": "E-mail é obrigatório",
        "erro.membros_exige_plano_pago": "Adicionar membros exige um plano pago para esta organização",
        "erro.acesso_restrito_admin": "Acesso restrito ao admin da organização",
        "erro.org_nao_encontrada": "Organização não encontrada",
        "erro.ja_pertence_org": "Usuário já pertence a uma organização",
        "erro.ancora_nao_encontrada": "Âncora não encontrada",
        "erro.indice_nao_encontrado": "Índice não encontrado",
        "erro.fim_origem_anterior": "Fim da origem anterior ao início",
        "erro.intervalo_muito_longo": "Intervalo muito longo (máx. 366 dias)",
        "erro.data_fim_anterior": "Data fim anterior à início",
        "erro.estrategia_invalida": "Estratégia inválida",
        "erro.item_nao_existe": "Item nao existe",
        "erro.sem_permissao_excluir": "Sem permissão para excluir este lançamento",
        "erro.sem_permissao_editar": "Sem permissão para editar este lançamento",
        "erro.metrica_nao_atribuida": "Métrica não atribuída a você",
        "erro.so_proprios_lancamentos": "Você só pode alterar os próprios lançamentos",
        "erro.datas_invalidas": "Datas inválidas (use YYYY-MM-DD)",
        "erro.subscricao_nao_encontrada": "Subscrição não encontrada",
        "erro.notificacao_nao_encontrada": "Notificação não encontrada",
        "erro.lancamento_nao_encontrado": "Lançamento não encontrado",
        "erro.meta_nao_encontrada": "Meta não encontrada",
        "erro.metrica_nao_encontrada": "Métrica não encontrada",
        "erro.token_invalido": "Token inválido",
        "erro.usuario_nao_encontrado": "Usuário não encontrado",
        "erro.username_ja_cadastrado": "Username já cadastrado",
        "erro.email_ja_cadastrado": "Email já cadastrado",
        "erro.organizacao_obrigatoria": "Organização é obrigatória",
        "erro.codigo_org_obrigatorio": "Código da organização é obrigatório",
        "erro.codigo_org_invalido": "Código da organização inválido",
        "erro.org_free_sem_membros": "Esta organização não permite novos membros (plano free)",
        "erro.email_nao_verificado": "E-mail não verificado. Confira sua caixa de entrada.",
        "erro.token_expirado": "Token expirado",
        "erro.senha_curta": "A senha deve ter ao menos 6 caracteres",
        "erro.token_google_invalido": "Token Google inválido",
        "erro.nome_obrigatorio": "Nome é obrigatório",
        "erro.sem_acesso_org": "Sem acesso a esta organização",
        "erro.sem_org_ativa": "Nenhuma organização ativa",
        "erro.nome_org_obrigatorio": "Nome da organização é obrigatório",
        "erro.nome_org_em_uso": "Nome de organização já está em uso",
    },
}


def t(chave: str, lang: str = LOCALE_PADRAO, **vars) -> str:
    """Traduz `chave` no idioma pedido.

    Ordem: idioma pedido → `en` → a própria chave. `vars` interpola
    `{nome}` no texto já traduzido; placeholder sem valor fica visível.
    """
    catalogo = MSG.get(lang) or MSG[LOCALE_PADRAO]
    texto = catalogo.get(chave) or MSG[LOCALE_PADRAO].get(chave) or chave
    return _interpolar(texto, vars) if vars else texto


def _interpolar(texto: str, vars: dict) -> str:
    def troca(m: re.Match) -> str:
        nome = m.group(1)
        return str(vars[nome]) if nome in vars else m.group(0)

    return re.sub(r"\{(\w+)\}", troca, texto)


# Um item do Accept-Language: "pt-BR;q=0.9" → ("pt-br", "0.9").
# O peso é capturado como texto livre de propósito: um `q` malformado
# ("q=abc") não pode descartar a preferência de idioma inteira — o cliente
# disse qual idioma quer, só errou o peso.
_ITEM = re.compile(r"^\s*([A-Za-z*-]+)\s*(?:;\s*q\s*=\s*([^;,]*))?\s*$")


def locale_de_accept_language(header: Optional[str]) -> str:
    """Escolhe o locale a partir do header `Accept-Language`.

    Respeita o peso `q` da RFC 9110: o cliente lista preferências com qualidade,
    e a ordem de escrita não é a ordem de preferência. Empate mantém a ordem em
    que veio. Idiomas que não atendemos são ignorados; se não sobrar nenhum,
    devolve `en`.
    """
    if not header:
        return LOCALE_PADRAO

    candidatos: list[tuple[float, int, str]] = []
    for posicao, parte in enumerate(header.split(",")):
        m = _ITEM.match(parte)
        if not m:
            continue
        tag, q_bruto = m.group(1).lower(), m.group(2)
        try:
            q = float(q_bruto) if q_bruto is not None else 1.0
        except ValueError:
            # "q=abc" é lixo; trata como sem qualidade declarada em vez de
            # descartar a preferência inteira.
            q = 1.0

        if tag == "pt" or tag.startswith("pt-"):
            # Só existe uma variante de português no app; pt-PT também cai aqui.
            candidatos.append((q, posicao, "pt-BR"))
        elif tag == "en" or tag.startswith("en-"):
            candidatos.append((q, posicao, "en"))

    if not candidatos:
        return LOCALE_PADRAO

    # Maior q primeiro; empate resolve pela ordem de aparição.
    candidatos.sort(key=lambda c: (-c[0], c[1]))
    return candidatos[0][2]


def get_locale(accept_language: Optional[str] = Header(default=None)) -> str:
    """Dependency do FastAPI: o locale da requisição.

    Uso nas rotas (a partir do #300):

        def rota(lang: LocaleDep):
            raise HTTPException(400, detail=t("erro.x", lang))
    """
    return locale_de_accept_language(accept_language)


LocaleDep = Annotated[str, Depends(get_locale)]
