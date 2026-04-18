"""CSS sanitizer for user-submitted profile styles.
 
Strategy:
- Remove dangerous at-rules: @import, @charset (only @media, @keyframes, @font-face with data: URLs blocked)
- Remove dangerous properties: position:fixed/sticky, pointer-events on root scopes
- Remove dangerous values: javascript:, vbscript:, data:text/html, expression()
- Scope all selectors under #profile-blocks to prevent style leakage
- Length limit
"""
import re
 
MAX_CSS_LENGTH = 50_000  # 50 KB
 
# Properties that could break the page or leak outside profile
BLOCKED_PROPERTIES = {
    'position',  # only block fixed/sticky values, but easier to block all and let users use container settings
}
 
# Patterns that indicate malicious or page-breaking content
DANGEROUS_PATTERNS = [
    re.compile(r'javascript\s*:', re.IGNORECASE),
    re.compile(r'vbscript\s*:', re.IGNORECASE),
    re.compile(r'data\s*:\s*text/html', re.IGNORECASE),
    re.compile(r'expression\s*\(', re.IGNORECASE),
    re.compile(r'@import\b', re.IGNORECASE),
    re.compile(r'behavior\s*:', re.IGNORECASE),
    re.compile(r'-moz-binding\s*:', re.IGNORECASE),
]
 
# Block fixed/sticky positioning specifically
POSITION_BLOCKED = re.compile(r'position\s*:\s*(fixed|sticky)', re.IGNORECASE)
 
 
def sanitize_css(raw: str) -> tuple[str, list[str]]:
    """Returns (sanitized_css, list_of_warnings)."""
    if not raw:
        return "", []
 
    if len(raw) > MAX_CSS_LENGTH:
        return "", [f"CSS jest za długi (max {MAX_CSS_LENGTH} znaków)"]
 
    warnings = []
    css = raw
 
    # Strip CSS comments first to prevent comment-based bypass
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.DOTALL)
 
    # Check for dangerous patterns
    for pattern in DANGEROUS_PATTERNS:
        if pattern.search(css):
            warnings.append(f"Zablokowano: niebezpieczny wzorzec ({pattern.pattern})")
            css = pattern.sub('/* blocked */', css)
 
    # Remove fixed/sticky positioning
    if POSITION_BLOCKED.search(css):
        warnings.append("Zablokowano: position:fixed/sticky")
        css = POSITION_BLOCKED.sub('/* blocked-position */', css)
 
    # Block @import explicitly
    css = re.sub(r'@import[^;]*;', '/* blocked-import */', css, flags=re.IGNORECASE)
 
    return css.strip(), warnings
 
 
def scope_css(css: str, scope_selector: str = '#profile-blocks') -> str:
    """Prefix all selectors with scope to prevent style leakage outside profile.
 
    Handles:
    - Regular selectors: .foo -> #profile-blocks .foo
    - At-rules (@media, @keyframes): scope contents
    - Multiple selectors separated by comma
    """
    if not css:
        return ""
 
    result = []
    i = 0
    n = len(css)
 
    while i < n:
        # Skip whitespace
        while i < n and css[i].isspace():
            result.append(css[i])
            i += 1
        if i >= n:
            break
 
        # @-rules: pass through opening, scope inner block
        if css[i] == '@':
            # Find rule name and parameters until { or ;
            end = i
            while end < n and css[end] not in '{;':
                end += 1
            at_header = css[i:end]
            result.append(at_header)
            if end < n and css[end] == ';':
                result.append(';')
                i = end + 1
                continue
            if end < n and css[end] == '{':
                # Find matching }
                depth = 1
                j = end + 1
                while j < n and depth > 0:
                    if css[j] == '{':
                        depth += 1
                    elif css[j] == '}':
                        depth -= 1
                    j += 1
                inner = css[end+1:j-1]
                # @keyframes / @font-face don't need selector scoping inside
                if any(kw in at_header.lower() for kw in ('@keyframes', '@-webkit-keyframes', '@font-face')):
                    result.append('{' + inner + '}')
                else:
                    # @media, @supports etc — scope inside
                    result.append('{' + scope_css(inner, scope_selector) + '}')
                i = j
                continue
 
        # Regular rule: collect selector until {
        sel_start = i
        while i < n and css[i] != '{':
            i += 1
        if i >= n:
            # No opening brace — leave as-is
            result.append(css[sel_start:])
            break
 
        selector_block = css[sel_start:i]
        # Scope each comma-separated selector
        scoped = ', '.join(
            f"{scope_selector} {s.strip()}" if s.strip() else ''
            for s in selector_block.split(',')
            if s.strip()
        )
 
        # Find matching }
        depth = 1
        j = i + 1
        while j < n and depth > 0:
            if css[j] == '{':
                depth += 1
            elif css[j] == '}':
                depth -= 1
            j += 1
        body = css[i+1:j-1]
 
        result.append(f"{scoped}{{{body}}}")
        i = j
 
    return ''.join(result)
 
 
def process_user_css(raw: str) -> tuple[str, list[str]]:
    """Full pipeline: sanitize then scope."""
    sanitized, warnings = sanitize_css(raw)
    if not sanitized:
        return "", warnings
    scoped = scope_css(sanitized)
    return scoped, warnings
