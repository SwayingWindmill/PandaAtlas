from app.main import app


def test_guess_panda_public_question_contract_hides_answer() -> None:
    openapi = app.openapi()
    paths = openapi["paths"]
    schemas = openapi["components"]["schemas"]

    assert "get" in paths["/api/v1/games/guess/question"]
    assert "post" in paths["/api/v1/games/guess/answer"]
    question = schemas["GuessQuestionRead"]["properties"]
    assert set(question) == {"question_id", "image_url", "image_alt", "difficulty", "options"}
    assert "panda_id" not in question
    assert "answer_panda_id" not in question
    assert "is_correct" not in question


def test_admin_guess_question_bank_routes_are_explicit_commands() -> None:
    paths = app.openapi()["paths"]
    base = "/api/v1/admin/games/guess/questions"

    assert {"get", "post"}.issubset(paths[base])
    assert "patch" in paths[f"{base}/{{question_id}}"]
    assert "post" in paths[f"{base}/{{question_id}}/publish"]
    assert "post" in paths[f"{base}/{{question_id}}/disable"]
