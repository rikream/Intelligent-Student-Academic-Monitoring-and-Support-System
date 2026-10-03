import hashlib
import json
import secrets

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException, status


def _cipher(encryption_key: str) -> AESGCM:
    if len(encryption_key.encode("utf-8")) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Face templates are unavailable until "
                "FACE_TEMPLATE_ENCRYPTION_KEY is configured with at least 32 bytes."
            ),
        )
    return AESGCM(hashlib.sha256(encryption_key.encode("utf-8")).digest())


def encrypt_descriptor(
    descriptor: list[float], student_id: int, encryption_key: str
) -> bytes:
    nonce = secrets.token_bytes(12)
    associated_data = f"student:{student_id}".encode("ascii")
    plaintext = json.dumps(
        descriptor, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")
    return nonce + _cipher(encryption_key).encrypt(nonce, plaintext, associated_data)


def decrypt_descriptor(
    encrypted_descriptor: bytes, student_id: int, encryption_key: str
) -> list[float]:
    cipher = _cipher(encryption_key)
    if len(encrypted_descriptor) <= 12:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The stored face template is invalid.",
        )
    nonce, ciphertext = encrypted_descriptor[:12], encrypted_descriptor[12:]
    associated_data = f"student:{student_id}".encode("ascii")
    try:
        plaintext = cipher.decrypt(nonce, ciphertext, associated_data)
        descriptor = json.loads(plaintext)
    except (InvalidTag, UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "The stored face template could not be decrypted. "
                "Verify FACE_TEMPLATE_ENCRYPTION_KEY."
            ),
        ) from None
    if (
        not isinstance(descriptor, list)
        or len(descriptor) != 128
        or any(
            not isinstance(value, (int, float))
            or isinstance(value, bool)
            or not -1 <= value <= 1
            for value in descriptor
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The stored face template is invalid.",
        )
    return [float(value) for value in descriptor]
