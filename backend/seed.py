from sqlmodel import Session, select

from models import Goal, GoalTemplate, Metric, Organization, User, ExternalIndex

_METRICAS_PADRAO = [
    dict(codigo="PAD_RECEITA_DIARIA",  nome="Receita do Dia",       descricao="Valor total faturado no dia.",                tipo="currency", periodo="daily",   valor_padrao="0"),
    dict(codigo="PAD_RECEITA_MENSAL",  nome="Receita Mensal",        descricao="Faturamento total do mês.",                   tipo="currency", periodo="monthly", valor_padrao="0"),
    dict(codigo="PAD_HORAS_ESTUDO",    nome="Horas Estudadas",       descricao="Tempo dedicado ao estudo no dia (horas).",    tipo="decimal",  periodo="daily",   valor_padrao="0"),
    dict(codigo="PAD_PAGINAS_LIDAS",   nome="Páginas Lidas",         descricao="Quantidade de páginas lidas no dia.",         tipo="number",   periodo="daily",   valor_padrao="0"),
    dict(codigo="PAD_EXERCICIO",       nome="Exercício Físico",      descricao="Realizou atividade física hoje? (true/false)", tipo="boolean",  periodo="daily",   valor_padrao="false"),
    dict(codigo="PAD_HORAS_SONO",      nome="Horas de Sono",         descricao="Horas dormidas na noite anterior.",           tipo="decimal",  periodo="daily",   valor_padrao="7"),
    dict(codigo="PAD_PESO_CORPORAL",   nome="Peso Corporal (kg)",    descricao="Peso registrado em kg.",                      tipo="decimal",  periodo="daily",   valor_padrao=None),
    dict(codigo="PAD_TAXA_CONVERSAO",  nome="Taxa de Conversão (%)", descricao="Percentual de leads convertidos.",            tipo="percent",  periodo="monthly", valor_padrao="0"),
]


def seed_metricas_padrao(session: Session) -> None:
    codigos_existentes = {m.codigo for m in session.exec(select(Metric)).all()}
    for dados in _METRICAS_PADRAO:
        if dados["codigo"] in codigos_existentes:
            continue
        session.add(Metric(**dados, is_default=True))
    session.commit()


_TEMPLATES_PADRAO = [
    dict(nome="Faturamento do mês", descricao="Distribui a meta de receita ao longo do mês, pesando mais o fim.",
         metric_codigo="PAD_RECEITA_MENSAL", alvo_sugerido="30000", estrategia="sazonal_mes", categoria="Negócios"),
    dict(nome="Rotina de estudos", descricao="Horas de estudo nos dias úteis (fim de semana livre).",
         metric_codigo="PAD_HORAS_ESTUDO", alvo_sugerido="40", estrategia="peso_semana", categoria="Educação"),
    dict(nome="Meta de leitura", descricao="Páginas lidas por dia, distribuídas por igual.",
         metric_codigo="PAD_PAGINAS_LIDAS", alvo_sugerido="600", estrategia="linear", categoria="Educação"),
]


def seed_goal_templates(session: Session) -> None:
    """Semeia o catálogo curado de metas-modelo (idempotente por nome)."""
    existentes = {t.nome for t in session.exec(select(GoalTemplate)).all()}
    for dados in _TEMPLATES_PADRAO:
        if dados["nome"] in existentes:
            continue
        session.add(GoalTemplate(**dados))
    session.commit()


_INDICES_EXTERNOS = [
    dict(code="IPCA", nome="IPCA (inflação, BCB/SGS 433)", provider="bcb_sgs_433",
         frequencia="monthly", unidade="%", value_type="variacao_pct"),
]


def seed_external_indices(session: Session) -> None:
    """Semeia as DEFINIÇÕES dos índices externos (#167), idempotente por code. Os
    pontos são preenchidos depois via POST /external-indices/{code}/refresh."""
    existentes = {i.code for i in session.exec(select(ExternalIndex)).all()}
    for dados in _INDICES_EXTERNOS:
        if dados["code"] in existentes:
            continue
        session.add(ExternalIndex(**dados))
    session.commit()


def seed_exemplo(user: User, org: Organization, session: Session) -> None:
    # Cria a métrica/meta de exemplo da organização (uma vez por org). Fica
    # escopada à org para que o novo usuário veja algo ao entrar. O `codigo` da
    # métrica é único no banco, então incluímos o id da org para não colidir
    # entre organizações.
    ja_tem = session.exec(
        select(Metric).where(Metric.organization_id == org.id)
    ).first()
    if ja_tem:
        return

    metric = Metric(
        codigo=f"EXEMPLO_META_ORG{org.id}",
        nome="Meta de exemplo",
        descricao=(
            "Esta é uma métrica de exemplo. "
            "Ela representa algo que você quer acompanhar diariamente. "
            "Crie suas próprias métricas e metas!"
        ),
        tipo="number",
        periodo="daily",
        valor_padrao="0",
        organization_id=org.id,
    )
    session.add(metric)
    session.commit()
    session.refresh(metric)

    session.add(Goal(metric=metric.id, alvo="10", periodo_referencia="daily", organization_id=org.id))
    session.commit()
