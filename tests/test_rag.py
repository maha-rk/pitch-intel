"""
Golden-set tests for the IBM Docling + FAISS RAG pipeline (VAR Oracle).

Each test represents a known incident type → expected FIFA Law chapter mapping.
Run with: pytest tests/test_rag.py -v

These tests verify that the semantic retrieval step is routing queries to the
correct law chunk — independent of any LLM call.
"""

import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


PDF_PATH = os.path.join(os.path.dirname(__file__), '../backend/var_oracle/fifa_laws.pdf')

GOLDEN_SET = [
    # (query describing the incident, expected law keyword in heading)
    (
        "handball incident: ball at arm level touching player upper body extended arm",
        "12",
    ),
    (
        "offside position: attacker ahead of second-last defender at time of pass",
        "11",
    ),
    (
        "foul: reckless challenge from behind endangering opponent safety excessive force",
        "12",
    ),
    (
        "tackle: player tackles opponent with excessive force serious foul play red card",
        "12",
    ),
    (
        "simulation: player dives penalty area no contact deceiving the referee",
        "12",
    ),
    (
        "handball: defender controls ball hand unnaturally extended making silhouette bigger",
        "12",
    ),
    (
        "offside: player in offside position interferes with play receiving pass from teammate",
        "11",
    ),
    (
        "foul: direct free kick pushing opponent in penalty area penalty kick",
        "12",
    ),
    (
        "handball: goalkeeper handles ball outside penalty area",
        "12",
    ),
    (
        "offside trap: defensive line catches attacker offside coordinated movement",
        "11",
    ),
]


@pytest.mark.skipif(not os.path.exists(PDF_PATH), reason='fifa_laws.pdf not generated — run generate_laws_pdf.py first')
class TestRAGRetrieval:
    """Verify that the Docling RAG pipeline routes each incident to the correct law."""

    @pytest.fixture(scope='class')
    def rag(self):
        from backend.var_oracle.rag import FIFALawsRAG
        return FIFALawsRAG(PDF_PATH)

    @pytest.mark.parametrize('query,expected_law_number', GOLDEN_SET)
    def test_correct_law_retrieved(self, rag, query, expected_law_number):
        chunks = rag.retrieve(query, k=2)
        assert chunks, f'No chunks returned for: {query[:60]}'
        top = chunks[0]
        assert expected_law_number in top['heading'], (
            f"Expected Law {expected_law_number} in heading '{top['heading']}' for query: {query[:60]}"
        )

    @pytest.mark.parametrize('query,_', GOLDEN_SET)
    def test_minimum_similarity_score(self, rag, query, _):
        chunks = rag.retrieve(query, k=2)
        assert chunks, f'No chunks for: {query[:60]}'
        assert chunks[0]['score'] >= 0.20, (
            f"Score {chunks[0]['score']:.3f} below 0.20 threshold for: {query[:60]}"
        )

    def test_retrieval_is_deterministic(self, rag):
        q = 'handball arm extended unnaturally defender'
        r1 = rag.retrieve(q, k=2)
        r2 = rag.retrieve(q, k=2)
        assert [c['heading'] for c in r1] == [c['heading'] for c in r2], \
            'RAG retrieval is non-deterministic'

    def test_similarity_scores_bounded(self, rag):
        chunks = rag.retrieve('offside attacker position', k=3)
        for c in chunks:
            assert 0.0 <= c['score'] <= 1.0, f"Score {c['score']} out of [0,1]"
