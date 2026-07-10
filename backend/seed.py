from sqlmodel import Session, select

from models import Goal, Metric, User

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


def seed_exemplo(user: User, session: Session) -> None:
    # Cria apenas a métrica/meta de exemplo (uma vez). A organização e o vínculo
    # do usuário são criados no cadastro (endpoint /register/), a partir do que
    # ele preenche no formulário.
    if session.exec(select(Metric)).first():
        return

    metric = Metric(
        codigo="EXEMPLO_META",
        nome="Meta de exemplo",
        descricao=(
            "Esta é uma métrica de exemplo. "
            "Ela representa algo que você quer acompanhar diariamente. "
            "Crie suas próprias métricas e metas!"
        ),
        tipo="number",
        periodo="daily",
        valor_padrao="0",
    )
    session.add(metric)
    session.commit()
    session.refresh(metric)

    session.add(Goal(metric=metric.id, alvo="10", periodo_referencia="daily"))
    session.commit()
