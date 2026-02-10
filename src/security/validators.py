"""
Input Validation and Sanitization Module

Provides secure validation for:
- User input sanitization
- File upload validation
- GeoJSON/GIS data validation

SECURITY: Implements defense-in-depth input validation.
"""

import html
import json
import re
import mimetypes
import hashlib
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass

from .config import get_security_config


@dataclass
class ValidationResult:
    """Result of validation operation."""
    is_valid: bool
    errors: List[str]
    sanitized_value: Any = None
    warnings: List[str] = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


class InputSanitizer:
    """
    Sanitizes user input to prevent XSS and injection attacks.

    SECURITY: Always sanitize user input before:
    - Storing in database
    - Displaying in HTML
    - Using in file paths
    - Including in SQL queries
    """

    # Characters that are safe (not requiring escaping in most contexts)
    SAFE_CHARS = frozenset(
        "abcdefghijklmnopqrstuvwxyz"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "0123456789"
        " .,!?;:'-_@#"
    )

    # Patterns for common injection attacks
    INJECTION_PATTERNS = [
        (re.compile(r"<script[^>]*>.*?</script>", re.I | re.S), "script injection"),
        (re.compile(r"javascript:", re.I), "javascript protocol"),
        (re.compile(r"vbscript:", re.I), "vbscript protocol"),
        (re.compile(r"data:text/html", re.I), "data URI injection"),
        (re.compile(r"on\w+\s*=", re.I), "event handler injection"),
        (re.compile(r"expression\s*\(", re.I), "CSS expression"),
        (re.compile(r"url\s*\([^)]*javascript", re.I), "CSS javascript URL"),
        (re.compile(r"<!--.*?-->", re.S), "HTML comment injection"),
        (re.compile(r"<!\[CDATA\[.*?\]\]>", re.S), "CDATA injection"),
    ]

    # SQL injection patterns
    SQL_PATTERNS = [
        (re.compile(r"(\s|^)(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\s", re.I), "SQL keyword"),
        (re.compile(r"(--|#|/\*)", re.I), "SQL comment"),
        (re.compile(r"(\s|^)(OR|AND)\s+['\"]?\d+['\"]?\s*=\s*['\"]?\d+", re.I), "SQL tautology"),
        (re.compile(r"UNION\s+(ALL\s+)?SELECT", re.I), "UNION injection"),
    ]

    @classmethod
    def escape_html(cls, text: str) -> str:
        """
        Escape HTML special characters.

        SECURITY: Use this before inserting user input into HTML.

        Args:
            text: Raw user input

        Returns:
            HTML-escaped string safe for insertion into HTML
        """
        if not text:
            return ""
        return html.escape(str(text), quote=True)

    @classmethod
    def escape_attribute(cls, text: str) -> str:
        """
        Escape text for use in HTML attributes.

        SECURITY: Use this for attribute values.
        """
        if not text:
            return ""
        # Escape HTML entities and quotes
        escaped = html.escape(str(text), quote=True)
        # Additional escaping for attribute context
        escaped = escaped.replace("`", "&#96;")
        return escaped

    @classmethod
    def escape_javascript(cls, text: str) -> str:
        """
        Escape text for use in JavaScript strings.

        SECURITY: Use this when embedding user input in JS.
        """
        if not text:
            return ""

        # Escape special characters
        escapes = {
            "\\": "\\\\",
            "'": "\\'",
            '"': '\\"',
            "\n": "\\n",
            "\r": "\\r",
            "\t": "\\t",
            "<": "\\x3c",
            ">": "\\x3e",
            "&": "\\x26",
        }

        result = str(text)
        for char, escape in escapes.items():
            result = result.replace(char, escape)

        return result

    @classmethod
    def sanitize_filename(cls, filename: str) -> str:
        """
        Sanitize filename for safe file system operations.

        SECURITY: Prevents path traversal and special character attacks.

        Args:
            filename: User-provided filename

        Returns:
            Safe filename with only allowed characters
        """
        if not filename:
            return "unnamed"

        # Remove path components
        filename = Path(filename).name

        # Remove null bytes
        filename = filename.replace("\x00", "")

        # Keep only safe characters
        safe_chars = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
        sanitized = "".join(c if c in safe_chars else "_" for c in filename)

        # Prevent hidden files
        sanitized = sanitized.lstrip(".")

        # Limit length
        if len(sanitized) > 255:
            name, ext = Path(sanitized).stem[:200], Path(sanitized).suffix[:55]
            sanitized = name + ext

        # Ensure not empty
        if not sanitized or sanitized == ".":
            sanitized = "unnamed"

        return sanitized

    @classmethod
    def sanitize_path(cls, path: str, base_dir: str) -> Optional[str]:
        """
        Sanitize and validate file path to prevent traversal.

        SECURITY: Ensures path stays within base directory.

        Args:
            path: User-provided path
            base_dir: Allowed base directory

        Returns:
            Sanitized absolute path within base_dir, or None if invalid
        """
        if not path or not base_dir:
            return None

        try:
            # Resolve to absolute path
            base = Path(base_dir).resolve()
            target = (base / path).resolve()

            # Check if target is within base
            if not str(target).startswith(str(base)):
                return None

            return str(target)

        except (ValueError, OSError):
            return None

    @classmethod
    def detect_injection(cls, text: str) -> List[str]:
        """
        Detect potential injection attacks in text.

        Args:
            text: Text to analyze

        Returns:
            List of detected attack types
        """
        if not text:
            return []

        attacks = []

        # Check XSS patterns
        for pattern, attack_type in cls.INJECTION_PATTERNS:
            if pattern.search(text):
                attacks.append(f"XSS: {attack_type}")

        # Check SQL patterns
        for pattern, attack_type in cls.SQL_PATTERNS:
            if pattern.search(text):
                attacks.append(f"SQL: {attack_type}")

        return attacks

    @classmethod
    def validate_and_sanitize(cls, text: str, max_length: int = 10000) -> ValidationResult:
        """
        Validate and sanitize user input.

        Args:
            text: User input
            max_length: Maximum allowed length

        Returns:
            ValidationResult with sanitized value
        """
        errors = []
        warnings = []

        if not text:
            return ValidationResult(True, [], "", warnings)

        text = str(text)

        # Check length
        if len(text) > max_length:
            errors.append(f"Text exceeds maximum length of {max_length}")
            text = text[:max_length]

        # Detect attacks
        attacks = cls.detect_injection(text)
        if attacks:
            warnings.extend([f"Potential attack detected: {a}" for a in attacks])

        # Sanitize
        sanitized = cls.escape_html(text)

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            sanitized_value=sanitized,
            warnings=warnings
        )


class FileValidator:
    """
    Validates uploaded files for security.

    SECURITY: Prevents malicious file uploads:
    - File type validation (extension + magic bytes)
    - Size limits
    - Content analysis
    """

    # Magic bytes for common file types
    MAGIC_BYTES = {
        b"\x89PNG\r\n\x1a\n": (".png",),
        b"\xff\xd8\xff": (".jpg", ".jpeg"),
        b"GIF87a": (".gif",),
        b"GIF89a": (".gif",),
        b"PK\x03\x04": (".zip", ".xlsx", ".docx"),
        b"%PDF": (".pdf",),
        b"SQLite format 3": (".sqlite", ".db", ".gpkg"),
        b'{"': (".json", ".geojson"),
        b"[{": (".json", ".geojson"),
    }

    def __init__(self):
        self.config = get_security_config()

    def validate_file(
        self,
        content: bytes,
        filename: str,
        allowed_extensions: Optional[Set[str]] = None
    ) -> ValidationResult:
        """
        Validate uploaded file.

        Args:
            content: File content as bytes
            filename: Original filename
            allowed_extensions: Set of allowed extensions (e.g., {".pdf", ".xlsx"})

        Returns:
            ValidationResult indicating if file is safe
        """
        errors = []
        warnings = []

        if allowed_extensions is None:
            allowed_extensions = set(self.config.allowed_file_extensions)

        # Check file size
        max_size = self.config.max_upload_size_mb * 1024 * 1024
        if len(content) > max_size:
            errors.append(f"File exceeds maximum size of {self.config.max_upload_size_mb}MB")

        # Sanitize filename
        safe_filename = InputSanitizer.sanitize_filename(filename)

        # Check extension
        ext = Path(safe_filename).suffix.lower()
        if ext not in allowed_extensions:
            errors.append(f"File extension '{ext}' not allowed. Allowed: {allowed_extensions}")

        # Validate magic bytes
        magic_valid = self._validate_magic_bytes(content, ext)
        if not magic_valid:
            warnings.append("File content does not match expected format for extension")

        # Check for embedded scripts in text files
        if ext in (".txt", ".csv", ".json", ".geojson"):
            if self._contains_script(content):
                errors.append("File contains potentially malicious script content")

        # Check for null bytes (file truncation attack)
        if b"\x00" in content[:1000]:
            warnings.append("File contains null bytes in header")

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            sanitized_value=safe_filename,
            warnings=warnings
        )

    def _validate_magic_bytes(self, content: bytes, extension: str) -> bool:
        """Check if file magic bytes match extension."""
        for magic, extensions in self.MAGIC_BYTES.items():
            if content.startswith(magic):
                return extension in extensions

        # For text-based formats, check if content is valid text
        if extension in (".txt", ".csv", ".json", ".geojson", ".dxf"):
            try:
                content[:1000].decode("utf-8")
                return True
            except UnicodeDecodeError:
                return False

        return True  # Unknown format, allow

    def _contains_script(self, content: bytes) -> bool:
        """Check if content contains script tags."""
        try:
            text = content.decode("utf-8", errors="ignore").lower()
            dangerous_patterns = [
                "<script", "javascript:", "vbscript:", "onload=",
                "onerror=", "onclick=", "eval(", "expression("
            ]
            return any(p in text for p in dangerous_patterns)
        except Exception:
            return False

    def compute_hash(self, content: bytes) -> str:
        """Compute SHA-256 hash of file content."""
        return hashlib.sha256(content).hexdigest()


class GeoDataValidator:
    """
    Validates GeoJSON and other GIS data formats.

    SECURITY: Prevents malicious GIS data:
    - Schema validation
    - Coordinate bounds checking
    - Property sanitization
    """

    # Valid GeoJSON geometry types
    VALID_GEOMETRY_TYPES = frozenset([
        "Point", "MultiPoint", "LineString", "MultiLineString",
        "Polygon", "MultiPolygon", "GeometryCollection"
    ])

    # Valid coordinate ranges
    COORDINATE_BOUNDS = {
        "lon": (-180, 180),
        "lat": (-90, 90),
    }

    @classmethod
    def validate_geojson(cls, data: Dict[str, Any]) -> ValidationResult:
        """
        Validate GeoJSON data structure and content.

        Args:
            data: Parsed GeoJSON dictionary

        Returns:
            ValidationResult with sanitized GeoJSON
        """
        errors = []
        warnings = []

        if not isinstance(data, dict):
            return ValidationResult(False, ["GeoJSON must be a JSON object"], None)

        # Check type
        geojson_type = data.get("type")
        if not geojson_type:
            errors.append("Missing 'type' property")
        elif geojson_type not in ("Feature", "FeatureCollection", *cls.VALID_GEOMETRY_TYPES):
            errors.append(f"Invalid GeoJSON type: {geojson_type}")

        # Validate based on type
        if geojson_type == "FeatureCollection":
            features = data.get("features", [])
            if not isinstance(features, list):
                errors.append("'features' must be an array")
            else:
                for i, feature in enumerate(features):
                    result = cls._validate_feature(feature, i)
                    errors.extend(result.errors)
                    warnings.extend(result.warnings)

        elif geojson_type == "Feature":
            result = cls._validate_feature(data, 0)
            errors.extend(result.errors)
            warnings.extend(result.warnings)

        elif geojson_type in cls.VALID_GEOMETRY_TYPES:
            result = cls._validate_geometry(data)
            errors.extend(result.errors)
            warnings.extend(result.warnings)

        # Sanitize properties
        sanitized = cls._sanitize_geojson(data) if len(errors) == 0 else None

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            sanitized_value=sanitized,
            warnings=warnings
        )

    @classmethod
    def _validate_feature(cls, feature: Dict, index: int) -> ValidationResult:
        """Validate a single GeoJSON feature."""
        errors = []
        warnings = []
        prefix = f"Feature[{index}]: "

        if not isinstance(feature, dict):
            return ValidationResult(False, [f"{prefix}must be an object"], None)

        if feature.get("type") != "Feature":
            errors.append(f"{prefix}type must be 'Feature'")

        # Validate geometry
        geometry = feature.get("geometry")
        if geometry is not None:
            result = cls._validate_geometry(geometry)
            errors.extend([f"{prefix}geometry: {e}" for e in result.errors])
            warnings.extend([f"{prefix}geometry: {w}" for w in result.warnings])

        # Check properties
        properties = feature.get("properties")
        if properties is not None and not isinstance(properties, dict):
            errors.append(f"{prefix}properties must be an object or null")

        return ValidationResult(len(errors) == 0, errors, None, warnings)

    @classmethod
    def _validate_geometry(cls, geometry: Dict) -> ValidationResult:
        """Validate a GeoJSON geometry."""
        errors = []
        warnings = []

        if not isinstance(geometry, dict):
            return ValidationResult(False, ["Geometry must be an object"], None)

        geom_type = geometry.get("type")
        if geom_type not in cls.VALID_GEOMETRY_TYPES:
            errors.append(f"Invalid geometry type: {geom_type}")
            return ValidationResult(False, errors, None)

        coordinates = geometry.get("coordinates")
        if geom_type != "GeometryCollection" and coordinates is None:
            errors.append("Missing 'coordinates' property")
        elif coordinates is not None:
            result = cls._validate_coordinates(coordinates, geom_type)
            errors.extend(result.errors)
            warnings.extend(result.warnings)

        return ValidationResult(len(errors) == 0, errors, None, warnings)

    @classmethod
    def _validate_coordinates(cls, coords: Any, geom_type: str) -> ValidationResult:
        """Validate coordinates based on geometry type."""
        errors = []
        warnings = []

        def check_point(point, path=""):
            if not isinstance(point, (list, tuple)):
                errors.append(f"{path}Point must be an array")
                return
            if len(point) < 2:
                errors.append(f"{path}Point must have at least 2 coordinates")
                return
            if len(point) > 4:
                warnings.append(f"{path}Point has more than 4 coordinates")

            lon, lat = point[0], point[1]
            lon_min, lon_max = cls.COORDINATE_BOUNDS["lon"]
            lat_min, lat_max = cls.COORDINATE_BOUNDS["lat"]

            if not (lon_min <= lon <= lon_max):
                warnings.append(f"{path}Longitude {lon} out of typical range")
            if not (lat_min <= lat <= lat_max):
                warnings.append(f"{path}Latitude {lat} out of typical range")

        if geom_type == "Point":
            check_point(coords)
        elif geom_type == "MultiPoint":
            for i, point in enumerate(coords or []):
                check_point(point, f"[{i}]")
        elif geom_type in ("LineString", "MultiLineString", "Polygon", "MultiPolygon"):
            # Recursive validation for nested coordinate arrays
            def validate_nested(arr, depth, path=""):
                if depth == 0:
                    check_point(arr, path)
                elif isinstance(arr, list):
                    for i, item in enumerate(arr):
                        validate_nested(item, depth - 1, f"{path}[{i}]")

            depth = {"LineString": 1, "MultiLineString": 2, "Polygon": 2, "MultiPolygon": 3}
            validate_nested(coords, depth.get(geom_type, 0))

        return ValidationResult(len(errors) == 0, errors, None, warnings)

    @classmethod
    def _sanitize_geojson(cls, data: Dict) -> Dict:
        """Sanitize GeoJSON by escaping string properties."""
        if not isinstance(data, dict):
            return data

        sanitized = {}

        for key, value in data.items():
            safe_key = InputSanitizer.escape_html(str(key))

            if isinstance(value, str):
                sanitized[safe_key] = InputSanitizer.escape_html(value)
            elif isinstance(value, dict):
                sanitized[safe_key] = cls._sanitize_geojson(value)
            elif isinstance(value, list):
                sanitized[safe_key] = [
                    cls._sanitize_geojson(item) if isinstance(item, dict)
                    else InputSanitizer.escape_html(item) if isinstance(item, str)
                    else item
                    for item in value
                ]
            else:
                sanitized[safe_key] = value

        return sanitized


def validate_json_depth(data: Any, max_depth: int = 10, current_depth: int = 0) -> bool:
    """
    Check if JSON nesting depth is within limits.

    SECURITY: Prevents stack overflow from deeply nested JSON.
    """
    if current_depth > max_depth:
        return False

    if isinstance(data, dict):
        return all(
            validate_json_depth(v, max_depth, current_depth + 1)
            for v in data.values()
        )
    elif isinstance(data, list):
        return all(
            validate_json_depth(item, max_depth, current_depth + 1)
            for item in data
        )

    return True
