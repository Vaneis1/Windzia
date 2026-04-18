"""Validate user-submitted profile_blocks JSON structure.
 
Ensures the JSON is well-formed, doesn't contain dangerous content,
and has reasonable size limits.
"""
 
MAX_JSON_DEPTH = 20
MAX_BLOCKS_TOTAL = 500
MAX_STRING_LENGTH = 100_000  # 100 KB per string field
 
# Allowed block types (must match BlockDefs in blocks.js)
ALLOWED_TYPES = {
    'container', 'cards', 'slider_v', 'slider_h',
    'richtext', 'text', 'heading', 'quote', 'badge',
    'image', 'divider', 'spacer',
}
 
 
def validate_blocks(data, depth=0, count=None) -> tuple[bool, str | None, int]:
    """Returns (is_valid, error_message, total_count)."""
    if count is None:
        count = [0]
 
    if depth > MAX_JSON_DEPTH:
        return False, f"Struktura zbyt głęboka (max {MAX_JSON_DEPTH} poziomów)", count[0]
 
    if not isinstance(data, list):
        return False, "Główny element musi być tablicą", count[0]
 
    for block in data:
        count[0] += 1
        if count[0] > MAX_BLOCKS_TOTAL:
            return False, f"Za dużo bloków (max {MAX_BLOCKS_TOTAL})", count[0]
 
        if not isinstance(block, dict):
            return False, f"Blok #{count[0]} musi być obiektem", count[0]
 
        # Required: type
        block_type = block.get('type')
        if not block_type or not isinstance(block_type, str):
            return False, f"Blok #{count[0]} nie ma pola 'type'", count[0]
 
        if block_type not in ALLOWED_TYPES:
            return False, f"Blok #{count[0]}: nieznany typ '{block_type}'", count[0]
 
        # Validate string lengths in props
        props = block.get('props', {})
        if not isinstance(props, dict):
            return False, f"Blok #{count[0]}: 'props' musi być obiektem", count[0]
        for key, value in props.items():
            if isinstance(value, str) and len(value) > MAX_STRING_LENGTH:
                return False, f"Blok #{count[0]}: pole '{key}' za długie", count[0]
 
        # Recurse into children
        children = block.get('children')
        if children is not None:
            ok, err, _ = validate_blocks(children, depth + 1, count)
            if not ok:
                return False, err, count[0]
 
    return True, None, count[0]
 
 
def validate_profile_blocks(payload) -> tuple[bool, str | None]:
    """Validate the full profile_blocks payload (can be array or {blocks, settings})."""
    if isinstance(payload, list):
        ok, err, _ = validate_blocks(payload)
        return ok, err
 
    if isinstance(payload, dict):
        # New format: {blocks: [...], settings: {...}}
        blocks = payload.get('blocks', [])
        if not isinstance(blocks, list):
            return False, "Pole 'blocks' musi być tablicą"
        ok, err, _ = validate_blocks(blocks)
        if not ok:
            return False, err
 
        settings = payload.get('settings', {})
        if not isinstance(settings, dict):
            return False, "Pole 'settings' musi być obiektem"
 
        # Validate settings strings aren't too long
        for key, value in settings.items():
            if isinstance(value, str) and len(value) > 5000:
                return False, f"Ustawienie '{key}' za długie"
 
        return True, None
 
    return False, "Nieprawidłowy format danych"
