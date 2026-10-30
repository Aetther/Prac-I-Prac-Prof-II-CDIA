import os

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine, make_url
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()


def database_url() -> URL:
    """
    Dirección de la base de datos.

    - Si existe DATABASE_URL (por ejemplo, la que da un PostgreSQL en la nube
      como Neon), se usa esa, con el driver psycopg2.
    - Si no, se arma con las variables POSTGRES_* del .env (la base de Docker).
    """
    url = (os.getenv("DATABASE_URL") or "").strip()
    if url:
        parsed = make_url(url)
        if parsed.drivername in ("postgres", "postgresql"):
            parsed = parsed.set(drivername="postgresql+psycopg2")
        return parsed
    return URL.create(
        drivername="postgresql+psycopg2",
        username=os.getenv("POSTGRES_USER", "admin"),
        password=os.getenv("POSTGRES_PASSWORD"),
        host=os.getenv("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "questions_db"),
    )


DATABASE_URL = database_url()

# pool_pre_ping: si la base en la nube cerró una conexión inactiva, se descarta
# y se abre otra en vez de fallar el pedido
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
