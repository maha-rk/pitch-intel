"""
Docling RAG pipeline for FIFA Laws of the Game.

Flow: Docling PDF parse → section chunking → sentence-transformer embeddings
      → FAISS index → semantic retrieval → Granite context injection.
"""
import os
import re
import numpy as np

_instance = None


class FIFALawsRAG:
    def __init__(self, pdf_path: str):
        self.chunks: list[dict] = []
        self.index = None
        self._model = None
        self._build(pdf_path)

    # ------------------------------------------------------------------ build
    def _parse(self, pdf_path: str) -> str:
        from docling.document_converter import DocumentConverter, PdfFormatOption
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        opts = PdfPipelineOptions()
        opts.do_ocr = False
        opts.do_table_structure = False
        converter = DocumentConverter(
            format_options={'pdf': PdfFormatOption(pipeline_options=opts)}
        )
        return converter.convert(pdf_path).document.export_to_markdown()

    def _chunk(self, markdown: str) -> list[dict]:
        # Split on "## Law N" headings — each law becomes one chunk
        parts = re.split(r'(?=## Law \d+)', markdown)
        chunks = []
        for part in parts:
            part = part.strip()
            if not part or len(part) < 80:
                continue
            heading_match = re.match(r'##\s+(.+)', part)
            heading = heading_match.group(1).strip() if heading_match else 'General'
            chunks.append({'heading': heading, 'text': part})
        return chunks

    def _build(self, pdf_path: str):
        import faiss
        from sentence_transformers import SentenceTransformer

        print('[RAG] Parsing FIFA Laws PDF with Docling...')
        markdown = self._parse(pdf_path)
        self.chunks = self._chunk(markdown)
        print(f'[RAG] {len(self.chunks)} law chunks ready')

        self._model = SentenceTransformer('all-MiniLM-L6-v2')
        texts = [c['text'] for c in self.chunks]
        embeddings = self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)

        dim = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dim)
        self.index.add(embeddings.astype('float32'))
        print('[RAG] FAISS index built')

    # --------------------------------------------------------------- retrieve
    def retrieve(self, query: str, k: int = 2) -> list[dict]:
        q_emb = self._model.encode([query], normalize_embeddings=True).astype('float32')
        scores, indices = self.index.search(q_emb, k)
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and float(score) > 0.1:
                results.append({
                    'heading': self.chunks[idx]['heading'],
                    'text': self.chunks[idx]['text'][:800],
                    'score': round(float(score), 3),
                })
        return results


def get_rag(pdf_path: str | None = None) -> FIFALawsRAG | None:
    global _instance
    if _instance is not None:
        return _instance
    path = pdf_path or os.path.join(os.path.dirname(__file__), 'fifa_laws.pdf')
    if not os.path.exists(path):
        return None
    try:
        _instance = FIFALawsRAG(path)
        return _instance
    except Exception as e:
        print(f'[RAG] Build failed: {e}')
        return None
