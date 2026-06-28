from sqlmodel import Session, select

from models import Goal, Membership, Metric, Organization, User


def seed_exemplo(user: User, session: Session) -> None:
    if session.exec(select(Metric)).first():
        return

    org = Organization(nome="Minha Organização")
    session.add(org)
    session.commit()
    session.refresh(org)

    session.add(Membership(user_id=user.id, organization_id=org.id))

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
