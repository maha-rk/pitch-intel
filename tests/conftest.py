"""
Pytest configuration for Pitch Intel test suite.

Sets dummy environment variables before any module is imported so that
backend.granite doesn't try to connect to watsonx/Groq during collection.
All actual LLM/StatsBomb calls are mocked inside individual test files.
"""

import os
import pytest

# Stub out provider credentials so the Granite client init doesn't hang or error.
# These are set before any backend module is imported.
os.environ.setdefault('LLM_PROVIDER', 'groq')
os.environ.setdefault('GROQ_API_KEY', 'test-stub-key')
os.environ.setdefault('GROQ_MODEL', 'llama-3.3-70b-versatile')
os.environ.setdefault('WATSONX_API_KEY', '')
os.environ.setdefault('WATSONX_PROJECT_ID', '')


def pytest_configure(config):
    config.addinivalue_line(
        'markers',
        'slow: marks tests that require network or large index builds',
    )
