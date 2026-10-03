from collections.abc import Generator

from sqlalchemy import Engine, create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def initialize_schema(engine: Engine) -> None:
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name != "sqlite":
        return
    columns = {
        column["name"]
        for column in inspect(engine).get_columns("class_sessions")
    }
    if "ended_at" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE class_sessions ADD COLUMN ended_at DATETIME")
            )
            connection.execute(
                text("UPDATE class_sessions SET ended_at = held_at WHERE ended_at IS NULL")
            )


def create_database(database_url: str) -> tuple[Engine, sessionmaker[Session]]:
    connect_args = (
        {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    )
    engine = create_engine(database_url, connect_args=connect_args)
    if database_url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def enable_sqlite_foreign_keys(connection, _record) -> None:
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine, sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def create_session_dependency(
    session_factory: sessionmaker[Session],
):
    def get_db() -> Generator[Session, None, None]:
        with session_factory() as session:
            yield session

    return get_db
