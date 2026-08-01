from datetime import datetime

from sqlmodel import Field, SQLModel


class PushSubscription(SQLModel, table=True):
    """Um aparelho inscrito para receber notificação push (#326).

    Uma linha por (aparelho, organização). O mesmo aparelho aparece duas vezes
    se a pessoa participa de duas orgs: notificação pertence a uma organização,
    e sem esse escopo alguém receberia no celular um aviso da org que não estava
    olhando.

    `endpoint` é a URL que o navegador dá para o servidor de push (FCM, Mozilla,
    Apple). É **único**: o navegador reentrega a mesma inscrição a cada
    carregamento da página, e sem a unicidade a tabela cresceria sem limite e o
    aparelho receberia a notificação uma vez por linha duplicada.

    `p256dh` e `auth` são as chaves de criptografia da inscrição — sem elas o
    servidor não consegue cifrar o payload que só aquele navegador abre.
    """

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    organization_id: int = Field(foreign_key="organization.id", index=True)

    # "web" | "android" | "ios". Já existe pensando no app nativo da 0.7
    # (expo-notifications), que reusa esta tabela: sem o campo agora, aquela
    # issue começaria por uma migration só para acrescentá-lo.
    platform: str = Field(default="web", max_length=20)

    endpoint: str = Field(unique=True, max_length=500)
    p256dh: str = Field(max_length=200)
    auth: str = Field(max_length=100)
    created_at: datetime = Field(default_factory=datetime.utcnow)
