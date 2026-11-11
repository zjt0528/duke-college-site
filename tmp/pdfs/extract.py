from pypdf import PdfReader
from pathlib import Path
import re,json
source=Path(r'C:\Users\zjt\xwechat_files\wxid_q83q70mrbgo711_976b\msg\file\2026-11\Book Voc\Book Voc\Book Reading Vocabulary')
for f in sorted(source.glob('Reading*.pdf')):
 text='\n'.join(p.extract_text() for p in PdfReader(f).pages)
 Path('tmp/pdfs',f.stem+'.txt').write_text(text,encoding='utf-8')
